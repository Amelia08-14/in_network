import { getSettings } from '../settings/settings.service';

// Réservation des salles de réunion (décision du 24/10/2026) : le membre
// choisit le matin, l'après-midi ou la journée, puis « de telle heure à telle
// heure » ; c'est facturé à l'heure. Les bureaux privatifs, eux, se louent au
// mois (demande de devis, bureau attribué par l'Office Manager).

// Heures exprimées à l'heure d'Alger (UTC+1, sans heure d'été), quel que soit
// le fuseau du serveur.
const SITE_UTC_OFFSET_HOURS = 1;
const HOUR_MS = 3600 * 1000;

export const atSiteHour = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+0${SITE_UTC_OFFSET_HOURS}:00`);
const shifted = (d: Date) => new Date(d.getTime() + SITE_UTC_OFFSET_HOURS * HOUR_MS);
/** Jour (AAAA-MM-JJ) à Alger. */
export const siteDate = (d: Date) => shifted(d).toISOString().slice(0, 10);
/** Heure à Alger, null si elle ne tombe pas pile sur l'heure. */
export const siteHour = (d: Date) => {
  const s = shifted(d);
  return s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0 && s.getUTCMilliseconds() === 0 ? s.getUTCHours() : null;
};

export interface RoomHours {
  opening: number;
  midday: number;
  closing: number;
}

/** Plages matin / après-midi, réglables dans les paramètres (retombe sur 8h–13h–20h si incohérent). */
export async function getRoomHours(): Promise<RoomHours> {
  const s = await getSettings();
  const hours = { opening: s.roomOpeningHour, midday: s.roomMiddayHour, closing: s.roomClosingHour };
  return hours.opening < hours.midday && hours.midday < hours.closing ? hours : { opening: 8, midday: 13, closing: 20 };
}

type Rate = { toString(): string } | number | null | undefined;
export interface RoomRates {
  hourlyRateMember: Rate;
  halfDayRateMember: Rate;
  dailyRateMember: Rate;
}
const positive = (rate: Rate) => (rate !== null && rate !== undefined && Number(rate) > 0 ? Number(rate) : null);

export type PriceBasis = 'HOURLY' | 'HALF_DAY' | 'DAY';
export const PRICE_BASIS_LABEL: Record<PriceBasis, string> = { HOURLY: 'tarif horaire', HALF_DAY: 'tarif demi-journée', DAY: 'tarif journée' };

/**
 * Prix membre d'un créneau [start, end[ (heures pleines) : le tarif horaire,
 * plafonné au forfait demi-journée (créneau tenant dans le matin ou dans
 * l'après-midi) ou journée quand il est plus avantageux. Une salle sans tarif
 * horaire se facture au forfait. null = aucun tarif applicable (à confirmer).
 */
export function roomPrice(space: RoomRates, start: number, end: number, hours: RoomHours): { price: number; basis: PriceBasis } | null {
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
