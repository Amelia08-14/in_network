import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';

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
      include: { space: true },
    });
  });
}

export async function cancelBooking(userId: string, bookingId: string, isAdmin: boolean) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw ApiError.notFound('Réservation introuvable');
  if (!isAdmin && booking.userId !== userId) throw ApiError.forbidden();
  if (booking.status === 'CANCELLED') return booking;

  return prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
}
