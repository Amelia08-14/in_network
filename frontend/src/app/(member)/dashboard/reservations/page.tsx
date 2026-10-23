'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Clock, Users, X } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AddToCartButton } from '@/components/features/AddToCartButton';
import { api, ApiRequestError } from '@/lib/api';
import { money } from '@/lib/crm';
import { capacityText, hasMemberRate, hourLabel, PRICE_BASIS_LABEL, roomPrice, type RoomHours } from '@/lib/spaces';
import { cn } from '@/lib/utils';
import type { SpaceResource } from '@/types';

// Réservation d'une salle de réunion (décision du 24/10/2026) : la salle, le
// jour, puis le matin, l'après-midi ou la journée et « de telle heure à telle
// heure » ; facturé à l'heure (plafonné au forfait demi-journée / journée).
// Les bureaux privatifs se louent au mois : ils ne se réservent pas ici.

interface Slot {
  hour: number;
  startAt: string;
  endAt: string;
  available: boolean;
}
interface Availability {
  hours: RoomHours;
  slots: Slot[];
}
interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  price: string;
  space: { name: string };
}
type Period = 'MORNING' | 'AFTERNOON' | 'DAY';

const STATUS: Record<Booking['status'], { label: string; className: string }> = {
  PENDING: { label: 'En attente de confirmation', className: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmée', className: 'bg-accent-green/20 text-green-800' },
  CANCELLED: { label: 'Annulée', className: 'bg-ink-900/8 text-ink-500' },
  COMPLETED: { label: 'Terminée', className: 'bg-ink-900/8 text-ink-600' },
};

const today = () => new Date().toLocaleDateString('en-CA');
const dayFr = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFr = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function periodBounds(period: Period, hours: RoomHours) {
  if (period === 'MORNING') return { from: hours.opening, to: hours.midday };
  if (period === 'AFTERNOON') return { from: hours.midday, to: hours.closing };
  return { from: hours.opening, to: hours.closing };
}

function rateSummary(space: SpaceResource) {
  if (!hasMemberRate(space)) return 'Tarif à confirmer : sur devis';
  const parts = [
    space.hourlyRateMember && Number(space.hourlyRateMember) > 0 ? `${money(space.hourlyRateMember)} / h` : null,
    space.halfDayRateMember && Number(space.halfDayRateMember) > 0 ? `demi-journée ${money(space.halfDayRateMember)}` : null,
    space.dailyRateMember && Number(space.dailyRateMember) > 0 ? `journée ${money(space.dailyRateMember)}` : null,
  ].filter(Boolean);
  return `${parts.join(' · ')} HT`;
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<Period>('MORNING');
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: rooms } = useQuery({
    queryKey: ['spaces', 'MEETING_ROOM'],
    queryFn: () => api.get<{ data: SpaceResource[] }>('/api/spaces?type=MEETING_ROOM').then((r) => r.data),
  });
  const { data: bookings } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/api/bookings').then((r) => r.data),
  });
  const room = rooms?.find((s) => s.id === spaceId);
  const bookable = room ? hasMemberRate(room) : false;
  const { data: availability } = useQuery({
    queryKey: ['availability', spaceId, date],
    queryFn: () => api.get<{ data: Availability }>(`/api/spaces/${spaceId}/availability?date=${date}`).then((r) => r.data),
    enabled: Boolean(spaceId && date && bookable),
  });

  const hours = availability?.hours;
  const bounds = hours ? periodBounds(period, hours) : null;
  const periodSlots = useMemo(() => (availability && bounds ? availability.slots.filter((s) => s.hour >= bounds.from && s.hour < bounds.to) : []), [availability, bounds]);
  const free = (hour: number) => availability?.slots.find((s) => s.hour === hour)?.available ?? false;

  // « De » : heures libres de la plage ; « À » : jusqu'au premier créneau occupé.
  const startOptions = periodSlots.filter((s) => s.available).map((s) => s.hour);
  const endOptions = useMemo(() => {
    if (!range || !bounds) return [];
    const options: number[] = [];
    for (let h = range.from; h < bounds.to && free(h); h += 1) options.push(h + 1);
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, bounds?.to, availability]);

  // Choix d'une plage : toute la plage si elle est libre, sinon la première heure libre.
  function choosePeriod(next: Period, slotsHours = availability?.hours) {
    setPeriod(next);
    setFeedback(null);
    if (!slotsHours || !availability) return setRange(null);
    const b = periodBounds(next, slotsHours);
    const allFree = availability.slots.filter((s) => s.hour >= b.from && s.hour < b.to).every((s) => s.available);
    if (allFree) return setRange({ from: b.from, to: b.to });
    const first = availability.slots.find((s) => s.hour >= b.from && s.hour < b.to && s.available);
    setRange(first ? { from: first.hour, to: first.hour + 1 } : null);
  }

  const price = room && hours && range ? roomPrice(room, range.from, range.to, hours) : null;
  const selection = range && availability ? { startAt: availability.slots.find((s) => s.hour === range.from)?.startAt, endAt: availability.slots.find((s) => s.hour === range.to - 1)?.endAt } : null;

  const book = useMutation({
    mutationFn: () => api.post('/api/bookings', { spaceId, startAt: selection!.startAt, endAt: selection!.endAt }),
    onSuccess: () => {
      setFeedback({ ok: true, text: 'Réservation envoyée : l’équipe la confirme et vous êtes prévenu.' });
      setRange(null);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability', spaceId, date] });
    },
    onError: (e) => setFeedback({ ok: false, text: e instanceof ApiRequestError ? e.message : 'Réservation impossible pour le moment.' }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.put(`/api/bookings/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  const upcoming = (bookings ?? []).filter((b) => new Date(b.endAt) > new Date() && b.status !== 'CANCELLED');
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Réservations</h1>
        <p className="mt-1 text-sm text-ink-500">Réservez une salle de réunion le matin, l’après-midi ou la journée, de l’heure de votre choix : c’est facturé à l’heure.</p>
      </div>

      <Card>
        <div className="p-5">
          <CardTitle>Nouvelle réservation</CardTitle>
        </div>
        <CardContent className="space-y-6 pt-0">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-700">1 · La salle</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {rooms?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === spaceId}
                  onClick={() => {
                    setSpaceId(s.id);
                    setRange(null);
                    setFeedback(null);
                  }}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    s.id === spaceId ? 'border-ink-900 bg-ink-900/[0.03] ring-1 ring-ink-900' : 'border-ink-900/10 hover:border-ink-900/30',
                  )}
                >
                  <span className="block font-heading font-bold text-ink-900">{s.name}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                    <Users className="h-3.5 w-3.5" /> {capacityText(s)}
                  </span>
                  {s.description && <span className="mt-2 block text-xs leading-relaxed text-ink-600">{s.description}</span>}
                  <span className="mt-2 block text-xs font-medium text-ink-800">{rateSummary(s)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {room && !bookable && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="flex-1">Le tarif de la {room.name.toLowerCase().startsWith('salle') ? '' : 'salle '}{room.name} reste à confirmer : ajoutez-la à une demande de devis, l’équipe vous propose un créneau et un prix.</span>
              <AddToCartButton item={{ targetType: 'SPACE', targetId: room.id, title: room.name, price: null, category: 'SPACE' }} label="Demander sur devis" size="sm" />
            </div>
          )}

          {room && bookable && (
            <>
              <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <div>
                  <Label htmlFor="r-date">2 · Le jour</Label>
                  <Input
                    id="r-date"
                    type="date"
                    min={today()}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setRange(null);
                      setFeedback(null);
                    }}
                  />
                </div>
                {hours && (
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink-700">3 · Le moment</span>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['MORNING', `Matin (${hourLabel(hours.opening)} – ${hourLabel(hours.midday)})`],
                          ['AFTERNOON', `Après-midi (${hourLabel(hours.midday)} – ${hourLabel(hours.closing)})`],
                          ['DAY', 'Journée'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={period === value && Boolean(range)}
                          onClick={() => choosePeriod(value)}
                          className={cn(
                            'rounded-pill px-4 py-2 text-sm font-medium',
                            period === value && range ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-900/15 hover:bg-ink-900/5',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {availability && bounds && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5" aria-label="Disponibilités">
                    {periodSlots.map((s) => {
                      const selected = range && s.hour >= range.from && s.hour < range.to;
                      return (
                        <span
                          key={s.hour}
                          title={s.available ? 'Libre' : 'Indisponible'}
                          className={cn(
                            'rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums',
                            selected ? 'bg-ink-900 text-white' : s.available ? 'bg-accent-green/15 text-green-800' : 'bg-ink-900/5 text-ink-400 line-through',
                          )}
                        >
                          {hourLabel(s.hour)}
                        </span>
                      );
                    })}
                  </div>
                  {startOptions.length === 0 ? (
                    <p className="text-sm text-ink-500">Plus de créneau libre sur cette plage : essayez un autre moment ou un autre jour.</p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <Label htmlFor="r-from">De</Label>
                        <Select
                          id="r-from"
                          className="w-28"
                          value={range?.from ?? ''}
                          onChange={(e) => {
                            const from = Number(e.target.value);
                            setRange({ from, to: from + 1 });
                            setFeedback(null);
                          }}
                        >
                          {!range && <option value="">—</option>}
                          {startOptions.map((h) => (
                            <option key={h} value={h}>
                              {hourLabel(h)}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="r-to">À</Label>
                        <Select id="r-to" className="w-28" disabled={!range} value={range?.to ?? ''} onChange={(e) => range && setRange({ from: range.from, to: Number(e.target.value) })}>
                          {endOptions.map((h) => (
                            <option key={h} value={h}>
                              {hourLabel(h)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {range && selection?.startAt && (
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-900/15 bg-ink-900/[0.03] p-4">
                  <div className="min-w-0 flex-1 text-sm text-ink-700">
                    <p className="font-semibold text-ink-900">
                      {room.name} · {dayFr(date)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2">
                      <Clock className="h-3.5 w-3.5" /> {hourLabel(range.from)} – {hourLabel(range.to)} ({range.to - range.from} h)
                      {price && (
                        <span>
                          · <strong className="text-ink-900">{money(price.price)} HT</strong> ({PRICE_BASIS_LABEL[price.basis]})
                        </span>
                      )}
                    </p>
                  </div>
                  <Button onClick={() => book.mutate()} disabled={book.isPending || !price}>
                    {book.isPending ? 'Envoi…' : 'Réserver ce créneau'}
                  </Button>
                </div>
              )}
            </>
          )}

          {feedback && (
            <p role={feedback.ok ? 'status' : 'alert'} className={cn('rounded-xl px-4 py-2.5 text-sm', feedback.ok ? 'bg-accent-green/10 text-green-800' : 'bg-red-50 text-red-700')}>
              {feedback.text}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="p-5">
          <CardTitle>Mes réservations</CardTitle>
        </div>
        <CardContent className="pt-0">
          {!bookings || bookings.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Aucune réservation" />
          ) : (
            <ul className="divide-y divide-ink-900/8">
              {[...upcoming, ...past].map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink-800">{b.space.name}</p>
                    <p className="text-xs text-ink-500">
                      {new Date(b.startAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {timeFr(b.startAt)} – {timeFr(b.endAt)} · {money(b.price)} HT
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('rounded-pill px-2.5 py-0.5 text-xs font-semibold', STATUS[b.status]?.className)}>{STATUS[b.status]?.label ?? b.status}</span>
                    {upcoming.includes(b) && (b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                      <button type="button" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-orange/10 hover:text-brand-orange" aria-label={`Annuler la réservation ${b.space.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
