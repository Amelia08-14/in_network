import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { sendEmail } from '../../lib/email';
import { getRoomHours, roomPrice, siteDate, siteHour } from '../spaces/roomBooking';

// Heures du lieu (Alger), quel que soit le fuseau du serveur.
const SITE_TIME_ZONE = 'Africa/Algiers';
const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: SITE_TIME_ZONE });

function bookingEmailBody(spaceName: string, start: Date, end: Date, statusLabel: string): string {
  return `<p>Ta réservation pour <strong>${spaceName}</strong> le ${DATE_FMT.format(start)} (jusqu'à ${new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: SITE_TIME_ZONE }).format(end)}) est <strong>${statusLabel}</strong>.</p>`;
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

  const html = `<p>Nouvelle demande de réservation de <strong>${memberEmail}</strong> pour <strong>${spaceName}</strong>, le ${DATE_FMT.format(start)} (jusqu'à ${new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: SITE_TIME_ZONE }).format(end)}).</p><p>À confirmer ou annuler depuis le backoffice — Réservations.</p>`;

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

// CDC §6.2 — contrainte métier critique : vérifier l'absence de chevauchement
// sur le même spaceId, dans une transaction, pour éviter les doubles
// réservations en cas de requêtes concurrentes.
// Salles de réunion uniquement (les bureaux privatifs se louent au mois), sur
// un même jour, en heures pleines entre l'ouverture et la fermeture ; prix
// membre calculé par roomPrice (horaire, plafonné demi-journée / journée).
export async function createBooking(userId: string, spaceId: string, startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hours = await getRoomHours();

  return prisma.$transaction(async (tx) => {
    const space = await tx.spaceResource.findUnique({ where: { id: spaceId } });
    if (!space || !space.isActive) throw ApiError.notFound('Espace introuvable');
    if (space.type !== 'MEETING_ROOM') {
      throw ApiError.badRequest('Les bureaux se louent au mois : faites une demande de devis depuis « Demander un service ».');
    }

    const startHour = siteHour(start);
    const endHour = siteHour(end);
    if (startHour === null || endHour === null) throw ApiError.badRequest('Une réservation commence et finit à l’heure pile.');
    const sameDay = siteDate(start) === siteDate(new Date(end.getTime() - 1));
    const closingOk = endHour === 0 ? hours.closing === 24 : endHour <= hours.closing;
    const lastHour = endHour === 0 ? 24 : endHour;
    if (!sameDay || startHour < hours.opening || !closingOk || lastHour <= startHour) {
      throw ApiError.badRequest(`Les salles se réservent sur une même journée, entre ${hours.opening} h et ${hours.closing} h.`);
    }
    if (start < new Date()) throw ApiError.badRequest('Ce créneau est déjà passé.');

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

    // Retour QA : jamais de réservation gratuite silencieuse — une salle sans
    // tarif applicable se demande sur devis.
    const priced = roomPrice(space, startHour, lastHour, hours);
    if (!priced) {
      throw ApiError.badRequest('Le tarif de cette salle reste à confirmer : demandez-la sur devis, l’équipe vous répond rapidement.');
    }

    return tx.booking.create({
      data: {
        userId,
        spaceId,
        startAt: start,
        endAt: end,
        price: priced.price,
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
