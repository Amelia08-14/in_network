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
    isPublic: isOwner ? profile.isPublic : undefined,
    updatedAt: isOwner ? profile.updatedAt : undefined,
  };
}

export async function listProfiles(query: ListProfilesQuery, viewerId: string | undefined) {
  const { page, limit, search, memberType, tag } = query;

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
    ...(tag
      ? { tags: { some: { tag: { label: { equals: tag } } } } }
      : {}),
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

async function replaceProfileTags(
  db: Prisma.TransactionClient,
  profileId: string,
  category: TagCategory,
  relation: TagRelationType,
  labels: string[],
) {
  const normalized = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];

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

  const { skillsOffered, skillsWanted, sectors, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.update({ where: { userId }, data: rest });

    if (skillsOffered) await replaceProfileTags(tx, profile.id, 'SKILL', 'OFFER', skillsOffered);
    if (skillsWanted) await replaceProfileTags(tx, profile.id, 'SKILL', 'NEED', skillsWanted);
    if (sectors) await replaceProfileTags(tx, profile.id, 'SECTOR', 'OFFER', sectors);
  });

  return getMyProfile(userId);
}
