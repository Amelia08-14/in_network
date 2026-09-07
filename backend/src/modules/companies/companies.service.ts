import { Prisma, MemberType } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { generatePassword, sendCredentialsEmail } from '../../lib/account-provisioning';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { uniqueSlug } from '../../utils/slugify';
import type { AddMemberInput, RegisterCompanyInput, UpdateMyCompanyInput } from './companies.schema';

// Sélection sûre des champs d'un collaborateur exposés au propriétaire de
// l'entreprise (jamais de passwordHash / tokens — cf. SAFE_USER_SELECT admin).
const MEMBER_SELECT = {
  id: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      jobTitle: true,
      avatarUrl: true,
      isPublic: true,
    },
  },
} satisfies Prisma.UserSelect;

type MemberRow = Prisma.UserGetPayload<{ select: typeof MEMBER_SELECT }>;

function serializeMember(row: MemberRow, ownerId: string) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt,
    firstName: row.profile?.firstName ?? null,
    lastName: row.profile?.lastName ?? null,
    jobTitle: row.profile?.jobTitle ?? null,
    avatarUrl: row.profile?.avatarUrl ?? null,
    isPublic: row.profile?.isPublic ?? false,
    isOwner: row.id === ownerId,
  };
}

interface CompanyWithMembers {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  sector: string | null;
  website: string | null;
  seatLimit: number;
  isActive: boolean;
  ownerId: string;
  members: MemberRow[];
}

function serializeCompany(company: CompanyWithMembers) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    sector: company.sector,
    website: company.website,
    seatLimit: company.seatLimit,
    isActive: company.isActive,
    // Un poste = un collaborateur rattaché (companyId non nul), qu'il soit
    // actif ou en pause. « Retirer » un membre le détache et libère le poste.
    usedSeats: company.members.length,
    members: company.members.map((m) => serializeMember(m, company.ownerId)),
  };
}

async function requireOwnedCompany(ownerId: string) {
  const company = await prisma.company.findUnique({
    where: { ownerId },
    include: { members: { select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } } },
  });
  if (!company) throw ApiError.forbidden('Vous ne gérez aucun compte entreprise.');
  return company;
}

export async function getMyCompany(ownerId: string) {
  return serializeCompany(await requireOwnedCompany(ownerId));
}

export async function updateMyCompany(ownerId: string, input: UpdateMyCompanyInput) {
  const company = await requireOwnedCompany(ownerId);
  const seatFloor = company.members.length;

  if (input.seatLimit !== undefined && input.seatLimit < seatFloor) {
    throw ApiError.badRequest(
      `Vous avez déjà ${seatFloor} collaborateur(s) rattaché(s) — impossible de descendre en dessous de ${seatFloor} postes. Retirez d'abord un collaborateur.`,
    );
  }

  const data: Prisma.CompanyUpdateInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.sector !== undefined ? { sector: input.sector } : {}),
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.seatLimit !== undefined ? { seatLimit: input.seatLimit } : {}),
  };

  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data });

    // Le logo et le nom de l'entreprise sont l'identité de l'organisation :
    // on les répercute sur les profils des collaborateurs rattachés.
    const profileSync: Prisma.MemberProfileUpdateManyMutationInput = {};
    if (input.logoUrl !== undefined) profileSync.companyLogoUrl = input.logoUrl;
    if (input.name !== undefined) profileSync.companyName = input.name;
    if (Object.keys(profileSync).length > 0) {
      await tx.memberProfile.updateMany({
        where: { user: { companyId: company.id } },
        data: profileSync,
      });
    }
  });

  return getMyCompany(ownerId);
}

export async function addMember(ownerId: string, input: AddMemberInput) {
  const company = await requireOwnedCompany(ownerId);
  if (!company.isActive) {
    throw ApiError.forbidden('Ce compte entreprise est désactivé. Contactez IN NETWORK.');
  }
  if (company.members.length >= company.seatLimit) {
    throw ApiError.conflict(
      'Tous vos postes sont attribués. Augmentez le nombre de postes pour inviter un nouveau collaborateur.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('Un compte existe déjà avec cet email.');

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const created = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'MEMBER',
      phone: input.phone,
      emailVerified: new Date(),
      company: { connect: { id: company.id } },
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          jobTitle: input.jobTitle,
          memberType: MemberType.ENTREPRISE,
          companyName: company.name,
          companyLogoUrl: company.logoUrl,
          siteId: company.siteId,
          isPublic: false,
        },
      },
    },
    select: MEMBER_SELECT,
  });

  // Même rappel de complétion de profil qu'à l'inscription individuelle.
  prisma.notification
    .create({
      data: {
        userId: created.id,
        type: 'profile_incomplete',
        title: 'Complétez votre profil',
        body: 'Renseignez votre poste, votre présentation et vos secteurs pour activer les demandes, réservations et la mise en relation.',
      },
    })
    .catch((err) => console.error('[companies] échec création notification profil', err));

  sendCredentialsEmail({
    to: input.email,
    name: `${input.firstName} ${input.lastName}`,
    password,
    loginPath: '/login',
    subject: 'IN NETWORK — Vos accès à votre espace membre',
    intro: `${company.name} vous a ouvert un accès à l'espace membre IN NETWORK. Vous êtes rattaché(e) au compte de l'entreprise.`,
  });

  return serializeMember(created, company.ownerId);
}

async function findManagedMember(ownerId: string, memberId: string) {
  const company = await prisma.company.findUnique({ where: { ownerId } });
  if (!company) throw ApiError.forbidden('Vous ne gérez aucun compte entreprise.');
  if (memberId === ownerId) {
    throw ApiError.forbidden('Vous ne pouvez pas vous appliquer cette action à vous-même.');
  }
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId: company.id },
    select: { id: true, email: true, companyId: true, profile: { select: { firstName: true, lastName: true } } },
  });
  if (!member) throw ApiError.notFound('Ce collaborateur est introuvable dans votre équipe.');
  return { company, member };
}

export async function resendMemberAccess(ownerId: string, memberId: string) {
  const { member } = await findManagedMember(ownerId, memberId);
  const password = generatePassword();
  await prisma.user.update({
    where: { id: member.id },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.refreshToken.updateMany({
    where: { userId: member.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  sendCredentialsEmail({
    to: member.email,
    name: `${member.profile?.firstName ?? ''} ${member.profile?.lastName ?? ''}`.trim() || member.email,
    password,
    loginPath: '/login',
    subject: 'IN NETWORK — Nouveau mot de passe',
    intro: 'Votre mot de passe pour l’espace membre IN NETWORK vient d’être réinitialisé.',
  });
}

export async function setMemberActive(ownerId: string, memberId: string, isActive: boolean) {
  const { member } = await findManagedMember(ownerId, memberId);
  await prisma.$transaction([
    prisma.user.update({ where: { id: member.id }, data: { isActive } }),
    // Un collaborateur désactivé sort de l'annuaire ; la réactivation ne
    // republie pas automatiquement (repasse par la validation admin).
    ...(isActive
      ? []
      : [prisma.memberProfile.updateMany({ where: { userId: member.id }, data: { isPublic: false } })]),
    ...(isActive
      ? []
      : [prisma.refreshToken.updateMany({ where: { userId: member.id, revokedAt: null }, data: { revokedAt: new Date() } })]),
  ]);
}

export async function removeMember(ownerId: string, memberId: string) {
  const { member } = await findManagedMember(ownerId, memberId);
  // Le profil est conservé (historique) mais détaché de l'entreprise et
  // dépublié : le poste est immédiatement libéré.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: member.id },
      data: { companyId: null, isActive: false },
    }),
    prisma.memberProfile.updateMany({ where: { userId: member.id }, data: { isPublic: false } }),
    prisma.refreshToken.updateMany({
      where: { userId: member.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Inscription entreprise (appelée depuis le module auth)                    */
/* -------------------------------------------------------------------------- */

export async function createCompanyAccount(input: RegisterCompanyInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('Un compte existe déjà avec cet email.');

  const site = await prisma.site.findFirst({ where: { isActive: true } });
  if (!site) throw new Error('Aucun site actif configuré — lance le seed avant de tester');

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.companyName, async (candidate) =>
    Boolean(await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const user = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        phone: input.phone,
        role: 'MEMBER',
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            jobTitle: input.jobTitle,
            memberType: MemberType.ENTREPRISE,
            companyName: input.companyName,
            companyLogoUrl: input.logoUrl ?? null,
            siteId: site.id,
            isPublic: false,
          },
        },
      },
    });

    const company = await tx.company.create({
      data: {
        name: input.companyName,
        slug,
        logoUrl: input.logoUrl ?? null,
        sector: input.sector ?? null,
        website: input.website ?? null,
        seatLimit: input.seatLimit,
        ownerId: owner.id,
        siteId: site.id,
      },
    });

    await tx.user.update({ where: { id: owner.id }, data: { companyId: company.id } });

    await tx.notification.create({
      data: {
        userId: owner.id,
        type: 'profile_incomplete',
        title: 'Complétez le profil de votre entreprise',
        body: 'Renseignez votre présentation et vos secteurs, puis invitez vos collaborateurs depuis « Mon équipe ».',
      },
    });

    return owner;
  });

  sendEmail({
    to: user.email,
    subject: "Bienvenue dans l'espace IN NETWORK",
    html: `<p>Bonjour ${input.firstName},</p><p>Le compte entreprise <strong>${input.companyName}</strong> est créé. Vous pouvez dès maintenant inviter vos collaborateurs depuis l'onglet « Mon équipe » de votre tableau de bord.</p><p>À très vite,<br/>L'équipe IN NETWORK</p>`,
  }).catch((err) => console.error("[companies] échec d'envoi de l'email de bienvenue", err));

  return user.id;
}

/* -------------------------------------------------------------------------- */
/*  Backoffice                                                                */
/* -------------------------------------------------------------------------- */

export async function listCompaniesForAdmin() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      _count: { select: { members: true } },
    },
  });
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logoUrl,
    sector: c.sector,
    website: c.website,
    seatLimit: c.seatLimit,
    usedSeats: c._count.members,
    isActive: c.isActive,
    createdAt: c.createdAt,
    ownerEmail: c.owner.email,
    ownerName: `${c.owner.profile?.firstName ?? ''} ${c.owner.profile?.lastName ?? ''}`.trim() || null,
  }));
}

export async function adminUpdateCompany(
  companyId: string,
  input: { seatLimit?: number; isActive?: boolean },
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { _count: { select: { members: true } } },
  });
  if (!company) throw ApiError.notFound('Entreprise introuvable.');

  if (input.seatLimit !== undefined && input.seatLimit < company._count.members) {
    throw ApiError.badRequest(
      `Cette entreprise a ${company._count.members} collaborateurs rattachés — le nombre de postes ne peut pas être inférieur.`,
    );
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      ...(input.seatLimit !== undefined ? { seatLimit: input.seatLimit } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: { id: true, seatLimit: true, isActive: true },
  });
}
