import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';

import { atSiteHour, getRoomHours, roomPrice } from './roomBooking';

export async function listSpaces(siteId?: string, type?: string) {
  return prisma.spaceResource.findMany({
    where: {
      isActive: true,
      ...(siteId ? { siteId } : {}),
      ...(type ? { type: type as never } : {}),
    },
    // De la plus petite à la plus grande salle.
    orderBy: [{ capacity: 'asc' }, { name: 'asc' }],
  });
}

export async function getSpaceById(id: string) {
  const space = await prisma.spaceResource.findUnique({ where: { id } });
  if (!space || !space.isActive) throw ApiError.notFound('Espace introuvable');
  return space;
}

// Disponibilités d'une salle de réunion pour un jour : une case par heure
// pleine entre l'ouverture et la fermeture (paramètres), avec les plages matin /
// après-midi et les prix de référence pour le récapitulatif côté membre.
export async function getAvailability(spaceId: string, dateStr: string) {
  const space = await getSpaceById(spaceId);
  const hours = await getRoomHours();

  const dayStart = atSiteHour(dateStr, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { spaceId, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
    select: { startAt: true, endAt: true },
  });

  const now = new Date();
  const slots: { hour: number; startAt: string; endAt: string; available: boolean }[] = [];
  for (let hour = hours.opening; hour < hours.closing; hour += 1) {
    const slotStart = atSiteHour(dateStr, hour);
    const slotEnd = atSiteHour(dateStr, hour + 1);
    const taken = bookings.some((b) => b.startAt < slotEnd && b.endAt > slotStart);
    slots.push({ hour, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), available: !taken && slotStart > now });
  }

  return {
    spaceId: space.id,
    date: dateStr,
    hours,
    // Prix d'une matinée, d'un après-midi, d'une journée : repères affichés au membre.
    reference: {
      morning: roomPrice(space, hours.opening, hours.midday, hours),
      afternoon: roomPrice(space, hours.midday, hours.closing, hours),
      day: roomPrice(space, hours.opening, hours.closing, hours),
    },
    slots,
  };
}
