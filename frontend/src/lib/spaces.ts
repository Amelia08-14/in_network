import type { SpaceResource } from '@/types';

// Salles et bureaux : capacité affichée et prix d'un créneau de salle de
// réunion, calculé comme côté serveur (backend spaces/roomBooking.ts) — le
// serveur reste la référence, ceci sert au récapitulatif avant confirmation.

/** « 6 à 8 personnes », « 30 personnes ». */
export function capacityText(space: Pick<SpaceResource, 'capacity' | 'capacityMin'>, short = false) {
  const unit = short ? 'pers.' : 'personnes';
  return space.capacityMin && space.capacityMin < space.capacity ? `${space.capacityMin} à ${space.capacity} ${unit}` : `${space.capacity} ${unit}`;
}

export interface RoomHours {
  opening: number;
  midday: number;
  closing: number;
}
export type PriceBasis = 'HOURLY' | 'HALF_DAY' | 'DAY';
export const PRICE_BASIS_LABEL: Record<PriceBasis, string> = { HOURLY: 'tarif horaire', HALF_DAY: 'forfait demi-journée', DAY: 'forfait journée' };

const positive = (rate: string | null | undefined) => (rate && Number(rate) > 0 ? Number(rate) : null);

/** Tarif horaire, plafonné au forfait demi-journée (matin ou après-midi) ou journée. */
export function roomPrice(space: Pick<SpaceResource, 'hourlyRateMember' | 'halfDayRateMember' | 'dailyRateMember'>, start: number, end: number, hours: RoomHours) {
  const options: { price: number; basis: PriceBasis }[] = [];
  const hourly = positive(space.hourlyRateMember);
  const halfDay = positive(space.halfDayRateMember);
  const day = positive(space.dailyRateMember);
  if (hourly) options.push({ price: hourly * (end - start), basis: 'HOURLY' });
  const withinHalf = (start >= hours.opening && end <= hours.midday) || (start >= hours.midday && end <= hours.closing);
  if (halfDay && withinHalf) options.push({ price: halfDay, basis: 'HALF_DAY' });
  if (day) options.push({ price: day, basis: 'DAY' });
  if (options.length === 0) return null;
  return options.reduce((best, option) => (option.price < best.price ? option : best));
}

/** La salle a-t-elle au moins un tarif membre (sinon : sur devis) ? */
export const hasMemberRate = (space: Pick<SpaceResource, 'hourlyRateMember' | 'halfDayRateMember' | 'dailyRateMember'>) =>
  Boolean(positive(space.hourlyRateMember) || positive(space.halfDayRateMember) || positive(space.dailyRateMember));

export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
