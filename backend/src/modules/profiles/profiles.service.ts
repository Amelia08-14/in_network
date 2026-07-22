import { Prisma, TagCategory, TagRelationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { buildPaginationMeta } from '../../utils/apiResponse';
import { hasAcceptedConnection } from '../connections/connections.service';
import type { ListProfilesQuery, UpdateProfileInput } from './profiles.schema';

const profileWithTags = Prisma.validator<Prisma.MemberProfileInclude>()({
  tags: { include: { tag: true } },
  user: { select: { id: true, email: true, phone: true, createdAt: true } },
});

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

export async function getMyProfile(userId: string) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: profileWithTags,
  });
  if (!profile) throw ApiError.notFound('Profil introuvable');
  return serializeProfile(profile, userId);
}

async function replaceProfileTags(
  profileId: string,
  category: TagCategory,
  relation: TagRelationType,
  labels: string[],
) {
  const normalized = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];

  const tags = await Promise.all(
    normalized.map((label) =>
      prisma.tag.upsert({
        where: { label },
        update: {},
        create: { label, category },
      }),
    ),
  );

  await prisma.profileTag.deleteMany({
    where: { profileId, relation, tag: { category } },
  });

  if (tags.length > 0) {
    await prisma.profileTag.createMany({
      data: tags.map((tag) => ({ profileId, tagId: tag.id, relation })),
      skipDuplicates: true,
    });
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Profil introuvable');

  const { skillsOffered, skillsWanted, sectors, ...rest } = input;

  await prisma.memberProfile.update({
    where: { userId },
    data: rest,
  });

  if (skillsOffered) await replaceProfileTags(profile.id, 'SKILL', 'OFFER', skillsOffered);
  if (skillsWanted) await replaceProfileTags(profile.id, 'SKILL', 'NEED', skillsWanted);
  if (sectors) await replaceProfileTags(profile.id, 'SECTOR', 'OFFER', sectors);

  return getMyProfile(userId);
}
