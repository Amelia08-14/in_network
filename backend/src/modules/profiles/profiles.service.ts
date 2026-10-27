import { Prisma, TagCategory, TagRelationType } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { buildPaginationMeta } from '../../utils/apiResponse';
import { hasAcceptedConnection } from '../connections/connections.service';
import type { ListProfilesQuery, UpdateProfileInput } from './profiles.schema';

// Migration Prisma 7 (§0 brief) : `Prisma.validator` n'existe plus sur le
// nouveau générateur — `satisfies` (TS natif) est le remplacement recommandé,
// avec exactement le même effet (littéral typé, vérifié contre l'include réel).
const profileWithTags = {
  tags: { include: { tag: true } },
  user: { select: { id: true, email: true, phone: true, createdAt: true } },
} satisfies Prisma.MemberProfileInclude;

type ProfileWithTags = Prisma.MemberProfileGetPayload<{ include: typeof profileWithTags }>;

function tagsByRelation(profile: ProfileWithTags, category: TagCategory, relation: TagRelationType) {
  return profile.tags
    .filter((pt) => pt.tag.category === category && pt.relation === relation)
    .map((pt) => pt.tag.label);
}

// CDC §6.2 — le niveau de détail retourné dépend de la session : un visiteur
// non connecté ne reçoit que les champs publics de base, jamais l'email brut.
function serializeProfile(
  profile: ProfileWithTags,
  viewerId: string | undefined,
  contactUnlocked = false,
) {
  const isOwner = viewerId === profile.userId;
  const isAuthenticatedViewer = Boolean(viewerId);

  const base = {
    id: profile.id,
    userId: profile.userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    memberType: profile.memberType,
    avatarUrl: profile.avatarUrl,
    companyLogoUrl: profile.companyLogoUrl,
    city: profile.city,
    jobTitle: profile.jobTitle,
    companyName: profile.companyName,
    siteId: profile.siteId,
    sectors: tagsByRelation(profile, 'SECTOR', 'OFFER'),
  };

  if (!isAuthenticatedViewer && !isOwner) {
    return base;
  }

  return {
    ...base,
    bio: profile.bio,
    website: profile.website,
    linkedinUrl: profile.linkedinUrl,
    skillsOffered: tagsByRelation(profile, 'SKILL', 'OFFER'),
    skillsWanted: tagsByRelation(profile, 'SKILL', 'NEED'),
    // Email masqué tant qu'aucune demande de mise en relation n'a été acceptée
    // entre le visiteur et ce membre (CDC §6.2), sauf pour le propriétaire du profil.
    email: isOwner || contactUnlocked ? profile.user.email : undefined,
    phone: isOwner || contactUnlocked ? profile.user.phone : undefined,
    isPublic: isOwner ? profile.isPublic : undefined,
    updatedAt: isOwner ? profile.updatedAt : undefined,
  };
}

export async function listProfiles(query: ListProfilesQuery, viewerId: string | undefined) {
  const { page, limit, search, memberType, tag, skill } = query;

  const where: Prisma.MemberProfileWhereInput = {
    isPublic: true,
    user: { isActive: true },
    ...(memberType ? { memberType } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { companyName: { contains: search } },
          ],
        }
      : {}),
    // Chaque critère (secteur, compétence proposée) doit être satisfait.
    AND: [
      ...(tag ? [{ tags: { some: { tag: { label: { equals: tag } } } } }] : []),
      ...(skill ? [{ tags: { some: { relation: 'OFFER' as const, tag: { label: { equals: skill } } } } }] : []),
    ],
  };

  const [total, profiles] = await Promise.all([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      include: profileWithTags,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: profiles.map((p) => serializeProfile(p, viewerId)),
    meta: buildPaginationMeta(page, limit, total),
  };
}

export async function getProfileById(id: string, viewerId: string | undefined) {
  const profile = await prisma.memberProfile.findUnique({ where: { id }, include: profileWithTags });
  if (!profile || (!profile.isPublic && profile.userId !== viewerId)) {
    throw ApiError.notFound('Profil introuvable');
  }
  const contactUnlocked =
    Boolean(viewerId) && viewerId !== profile.userId
      ? await hasAcceptedConnection(viewerId as string, profile.userId)
      : false;
  return serializeProfile(profile, viewerId, contactUnlocked);
}

// Complétude du profil (demande client 07/09/2026) : sert la bannière du
// dashboard membre et le garde-fou `requireCompleteProfile` (une action
// engageante — souscription, demande, réservation, mise en relation — exige
// un profil complet). Une seule source de vérité, facile à ajuster ici.
const COMPLETENESS_FIELDS = [
  { key: 'jobTitle', label: 'Poste / activité' },
  { key: 'companyName', label: 'Entreprise' },
  { key: 'bio', label: 'Présentation (bio)' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'sectors', label: 'Au moins un secteur d’activité' },
] as const;

export interface ProfileCompleteness {
  isComplete: boolean;
  missing: string[];
  missingKeys: string[];
}

export async function getProfileCompleteness(userId: string): Promise<ProfileCompleteness> {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: { user: { select: { phone: true } }, tags: { include: { tag: true } } },
  });
  if (!profile) {
    return { isComplete: false, missing: ['Profil membre'], missingKeys: ['profile'] };
  }

  const checks: Record<(typeof COMPLETENESS_FIELDS)[number]['key'], boolean> = {
    jobTitle: Boolean(profile.jobTitle?.trim()),
    companyName: Boolean(profile.companyName?.trim()),
    bio: Boolean(profile.bio?.trim()),
    phone: Boolean(profile.user.phone?.trim()),
    sectors: profile.tags.some((pt) => pt.tag.category === 'SECTOR' && pt.relation === 'OFFER'),
  };

  const missing = COMPLETENESS_FIELDS.filter((f) => !checks[f.key]);
  return {
    isComplete: missing.length === 0,
    missing: missing.map((f) => f.label),
    missingKeys: missing.map((f) => f.key),
  };
}

export async function getMyProfile(userId: string) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: profileWithTags,
  });
  if (!profile) throw ApiError.notFound('Profil introuvable');
  return { ...serializeProfile(profile, userId), completeness: await getProfileCompleteness(userId) };
}

/** Refuse un domaine d'activité hors référentiel, sauf s'il figure déjà sur le profil (`profileId` null : inscription). */
export async function assertClosedSectors(db: Prisma.TransactionClient, profileId: string | null, labels: string[]) {
  if (labels.length === 0) return;
  const [known, current] = await Promise.all([
    db.tag.findMany({ where: { category: 'SECTOR', group: { not: null }, label: { in: labels } }, select: { label: true } }),
    profileId
      ? db.profileTag.findMany({ where: { profileId, relation: 'OFFER', tag: { category: 'SECTOR' } }, select: { tag: { select: { label: true } } } })
      : Promise.resolve([] as { tag: { label: string } }[]),
  ]);
  const allowed = new Set([...known.map((t) => t.label), ...current.map((pt) => pt.tag.label)]);
  const unknown = labels.filter((label) => !allowed.has(label));
  if (unknown.length > 0) {
    throw ApiError.badRequest(`Domaine d’activité hors liste : ${unknown.join(', ')}. Choisissez dans la liste proposée.`, { field: 'sectors', unknown });
  }
}

async function replaceProfileTags(
  db: Prisma.TransactionClient,
  profileId: string,
  category: TagCategory,
  relation: TagRelationType,
  labels: string[],
) {
  const normalized = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];

  // Domaines d'activité : liste fermée (audit 27/10/2026) — seuls les libellés
  // du référentiel (taxonomy.ts, group renseigné) sont acceptés. Les anciennes
  // saisies libres déjà portées par ce profil restent tolérées jusqu'à la
  // migration (prisma/migrate-sectors.ts), pour ne pas bloquer l'enregistrement.
  if (category === 'SECTOR') await assertClosedSectors(db, profileId, normalized);

  const tags = await Promise.all(
    normalized.map((label) =>
      db.tag.upsert({
        where: { label },
        update: {},
        create: { label, category },
      }),
    ),
  );

  await db.profileTag.deleteMany({
    where: { profileId, relation, tag: { category } },
  });

  if (tags.length > 0) {
    await db.profileTag.createMany({
      data: tags.map((tag) => ({ profileId, tagId: tag.id, relation })),
      skipDuplicates: true,
    });
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Profil introuvable');

  const { skillsOffered, skillsWanted, sectors, phone, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.update({ where: { userId }, data: rest });
    if (phone !== undefined) await tx.user.update({ where: { id: userId }, data: { phone } });

    if (skillsOffered) await replaceProfileTags(tx, profile.id, 'SKILL', 'OFFER', skillsOffered);
    if (skillsWanted) await replaceProfileTags(tx, profile.id, 'SKILL', 'NEED', skillsWanted);
    if (sectors) await replaceProfileTags(tx, profile.id, 'SECTOR', 'OFFER', sectors);
  });

  return getMyProfile(userId);
}

/**
 * Vitrine publique de la communauté (page d'accueil, audit du 25/10/2026) :
 * l'annuaire reste réservé aux connectés ; le visiteur voit seulement le
 * prénom et l'initiale du nom, l'activité, les secteurs et la ville de
 * quelques membres validés, et les chiffres réels de la communauté.
 */
export async function getCommunityShowcase() {
  const where: Prisma.MemberProfileWhereInput = { isPublic: true, user: { isActive: true, role: 'MEMBER' } };
  const [members, profiles, sectors] = await Promise.all([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      // Fiches mises en avant (audit 27/10/2026) : seulement les fiches complètes
      // — activité, ville et au moins un domaine d'activité. Les chiffres
      // (membres, secteurs) restent calculés sur tous les profils validés.
      where: {
        ...where,
        AND: [{ jobTitle: { not: null } }, { jobTitle: { not: '' } }, { city: { not: null } }, { city: { not: '' } }],
        tags: { some: { relation: 'OFFER', tag: { category: 'SECTOR' } } },
      },
      include: { tags: { include: { tag: true } } },
      // Les profils les plus complets d'abord (photo, intitulé), puis les plus récents.
      orderBy: [{ avatarUrl: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 12,
    }),
    prisma.tag.count({ where: { category: 'SECTOR', profileTags: { some: { relation: 'OFFER', profile: where } } } }),
  ]);
  return {
    members,
    sectors,
    profiles: profiles.map((p) => ({
      id: p.id,
      displayName: `${p.firstName} ${p.lastName ? `${p.lastName.charAt(0).toUpperCase()}.` : ''}`.trim(),
      memberType: p.memberType,
      avatarUrl: p.avatarUrl,
      jobTitle: p.jobTitle,
      city: p.city,
      tags: p.tags
        .filter((pt) => pt.relation === 'OFFER')
        .sort((a, b) => Number(b.tag.category === 'SECTOR') - Number(a.tag.category === 'SECTOR'))
        .slice(0, 2)
        .map((pt) => pt.tag.label),
    })),
  };
}
