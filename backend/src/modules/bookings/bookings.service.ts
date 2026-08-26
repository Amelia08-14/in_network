import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { sendEmail } from '../../lib/email';

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

function bookingEmailBody(spaceName: string, start: Date, end: Date, statusLabel: string): string {
  return `<p>Ta réservation pour <strong>${spaceName}</strong> le ${DATE_FMT.format(start)} (jusqu'à ${new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(end)}) est <strong>${statusLabel}</strong>.</p>`;
}

// Notification (email + in-app) — retour QA : aucune confirmation n'était
// envoyée au membre à la création ni au changement de statut d'une
// réservation. sendEmail() n'est jamais attendu bloquant ici : un aléa SMTP
// ne doit pas faire échouer la réservation elle-même.
const STATUS_LABEL: Record<'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED', string> = {
  PENDING: 'en attente de confirmation',
  CONFIRMED: 'confirmée',
  CANCELLED: 'annulée',
  COMPLETED: 'terminée',
};
const STATUS_TITLE: Record<'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED', string> = {
  PENDING: 'Réservation reçue',
  CONFIRMED: 'Réservation confirmée',
  CANCELLED: 'Réservation annulée',
  COMPLETED: 'Réservation terminée',
};

export async function notifyBookingStatus(
  userId: string,
  userEmail: string,
  spaceName: string,
  start: Date,
  end: Date,
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
) {
  const label = STATUS_LABEL[status];
  const title = STATUS_TITLE[status];

  await prisma.notification.create({
    data: {
      userId,
      type: `booking_${status.toLowerCase()}`,
      title,
      body: `${spaceName} — ${DATE_FMT.format(start)}, ${label}.`,
    },
  });

  sendEmail({
    to: userEmail,
    subject: `IN NETWORK — ${title}`,
    html: bookingEmailBody(spaceName, start, end, label),
  }).catch((err) => console.error('[bookings] échec envoi email de notification', err));
}

// Retour QA critique : une nouvelle demande de réservation (statut PENDING)
// était bien enregistrée et visible dans /admin/reservations, mais
// n'émettait absolument aucune alerte — l'admin ne pouvait la découvrir
// qu'en repensant à aller vérifier la page manuellement ("aucune
// notification" remonté par la QA, à distinguer de "aucune trace" qui, lui,
// était déjà faux : la demande apparaît bien dans le listing).
async function notifyAdminsOfNewBooking(spaceName: string, memberEmail: string, start: Date, end: Date) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { email: true },
  });
  if (admins.length === 0) return;

  const html = `<p>Nouvelle demande de réservation de <strong>${memberEmail}</strong> pour <strong>${spaceName}</strong>, le ${DATE_FMT.format(start)} (jusqu'à ${new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(end)}).</p><p>À confirmer ou annuler depuis le backoffice — Réservations.</p>`;

  sendEmail({
    to: admins.map((a) => a.email).join(','),
    subject: 'IN NETWORK — nouvelle demande de réservation',
    html,
  }).catch((err) => console.error('[bookings] échec envoi email admin (nouvelle demande)', err));
}

export async function listMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: { space: true, payment: true },
    orderBy: { startAt: 'desc' },
  });
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

// CDC §6.2 — contrainte métier critique : vérifier l'absence de chevauchement
// sur le même spaceId, dans une transaction, pour éviter les doubles
// réservations en cas de requêtes concurrentes.
export async function createBooking(userId: string, spaceId: string, startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  return prisma.$transaction(async (tx) => {
    const space = await tx.spaceResource.findUnique({ where: { id: spaceId } });
    if (!space || !space.isActive) throw ApiError.notFound('Espace introuvable');

    const overlapping = await tx.booking.findFirst({
      where: {
        spaceId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
      },
    });
    if (overlapping) {
      throw ApiError.conflict('Ce créneau est déjà réservé pour cet espace');
    }

    // Retour QA : une réservation pouvait se créer avec un prix de 0 DZD
    // silencieux quand hourlyRateMember n'était pas configuré pour l'espace
    // (valait alors 0 par défaut au lieu de bloquer). Un espace sans tarif
    // horaire membre configuré ne doit jamais produire de réservation
    // gratuite — on bloque explicitement plutôt que de laisser passer.
    if (!space.hourlyRateMember || Number(space.hourlyRateMember) <= 0) {
      throw ApiError.badRequest("Cet espace n'a pas de tarif horaire configuré — contacte l'administration");
    }
    const hourlyRate = Number(space.hourlyRateMember);
    const price = hourlyRate * hoursBetween(start, end);

    return tx.booking.create({
      data: {
        userId,
        spaceId,
        startAt: start,
        endAt: end,
        price,
        status: 'PENDING',
      },
      include: { space: true, user: { select: { email: true } } },
    });
  }).then(async (booking) => {
    await notifyBookingStatus(booking.userId, booking.user.email, booking.space.name, booking.startAt, booking.endAt, 'PENDING');
    await notifyAdminsOfNewBooking(booking.space.name, booking.user.email, booking.startAt, booking.endAt);
    // Le user complet (avec passwordHash/tokens) ne doit jamais atteindre le
    // client — on ne renvoie de la relation user que ce qu'on vient d'y lire.
    const { user, ...safeBooking } = booking;
    return safeBooking;
  });
}

export async function cancelBooking(userId: string, bookingId: string, isAdmin: boolean) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { space: true, user: true } });
  if (!booking) throw ApiError.notFound('Réservation introuvable');
  if (!isAdmin && booking.userId !== userId) throw ApiError.forbidden();
  if (booking.status === 'CANCELLED') return booking;

  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
  await notifyBookingStatus(booking.userId, booking.user.email, booking.space.name, booking.startAt, booking.endAt, 'CANCELLED');
  return updated;
}
