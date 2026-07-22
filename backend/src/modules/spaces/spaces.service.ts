import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';

// CDC §1.4 — hypothèse de travail par défaut: créneaux d'1h, horaires ouverts
// 08h-20h. À ajuster une fois les horaires officiels du lieu Hydra confirmés.
const OPENING_HOUR = 8;
const CLOSING_HOUR = 20;

export async function listSpaces(siteId?: string, type?: string) {
  return prisma.spaceResource.findMany({
    where: {
      isActive: true,
      ...(siteId ? { siteId } : {}),
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { name: 'asc' },
  });
}

export async function getSpaceById(id: string) {
  const space = await prisma.spaceResource.findUnique({ where: { id } });
  if (!space || !space.isActive) throw ApiError.notFound('Espace introuvable');
  return space;
}

export async function getAvailability(spaceId: string, dateStr: string) {
  const space = await getSpaceById(spaceId);

  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);

  const bookings = await prisma.booking.findMany({
    where: {
      spaceId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });

  const slots: { startAt: string; endAt: string; available: boolean }[] = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
    const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
    const slotEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, '0')}:00:00`);

    const overlaps = bookings.some((b) => b.startAt < slotEnd && b.endAt > slotStart);

    slots.push({
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      available: !overlaps,
    });
  }

  return { spaceId: space.id, date: dateStr, slots };
}
