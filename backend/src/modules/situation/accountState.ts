import { prisma } from '../../lib/prisma';

// « Compte validé » = l'équipe a approuvé le membre (MemberProfile.isPublic,
// cf. PATCH /api/admin/members/:id/approve et /admin/validations). Tant qu'il ne
// l'est pas, l'espace membre est verrouillé hors « Situation » et « Mon profil ».
// - Les comptes staff (ADMIN, OFFICE_MANAGER…) ne sont jamais concernés.
// - Un collaborateur invité dans une entreprise dont le représentant est
//   validé est considéré validé : la validation porte sur l'entreprise.
export async function isAccountValidated(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      profile: { select: { isPublic: true } },
      company: { select: { owner: { select: { profile: { select: { isPublic: true } } } } } },
    },
  });
  if (!user) return false;
  if (user.role !== 'MEMBER') return true;
  if (user.profile?.isPublic) return true;
  return Boolean(user.company?.owner.profile?.isPublic);
}
