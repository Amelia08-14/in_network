'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { AppointmentFormModal } from '@/components/admin/AppointmentFormModal';
import { PageTitle, Pill, useStaff } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';
import { APPOINTMENT_LABEL, staffName } from '@/lib/crm';
import { cn } from '@/lib/utils';
import type { Appointment, AppointmentStatus } from '@/types/crm';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const time = (value: string) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const CHIP: Record<string, string> = {
  CALL: 'bg-brand-blue/10 text-brand-blue',
  VISIT: 'bg-brand-orange/10 text-brand-orange',
  MEETING: 'bg-ink-900/8 text-ink-800',
};

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [assignee, setAssignee] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: staff } = useStaff();

  // Grille de 6 semaines, lundi en premier.
  const days = useMemo(() => {
    const offset = (month.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const from = days[0];
  const to = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1);
  const { data: appointments } = useQuery({
    queryKey: ['crm-appointments', from.toISOString(), assignee],
    queryFn: () =>
      api
        .get<{ data: Appointment[] }>(`/api/admin/crm/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${assignee ? `&assigneeId=${assignee}` : ''}`)
        .then((r) => r.data),
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: AppointmentStatus }) => api.patch(`/api/admin/crm/appointments/${input.id}`, { status: input.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] });
    },
  });

  const forDay = (day: Date) => (appointments ?? []).filter((a) => sameDay(new Date(a.startAt), day));
  const dayItems = forDay(selected);
  const scheduled = (appointments ?? []).filter((a) => a.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6">
      <PageTitle
        hue="teal"
        title="Agenda commercial"
        description={`${scheduled} rendez-vous prévu${scheduled > 1 ? 's' : ''} sur la période affichée.`}
        actions={
          <>
            <Select aria-label="Filtrer par commercial" className="h-10 w-52" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Toute l’équipe</option>
              {staff?.map((u) => (
                <option key={u.id} value={u.id}>
                  {staffName(u)}
                </option>
              ))}
            </Select>
            <Button onClick={() => setCreating(true)}>
              <CalendarPlus className="h-4 w-4" /> Nouveau rendez-vous
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-ink-900/8 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold capitalize text-ink-900">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-2 hover:bg-ink-900/5">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Button variant="outline" size="sm" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}>
                Aujourd’hui
              </Button>
              <button type="button" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-2 hover:bg-ink-900/5">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-900/8 bg-ink-900/8 text-xs">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-ink-900/3 py-2 text-center font-semibold uppercase tracking-wide text-ink-500">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const items = forDay(day);
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = sameDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-label={`${day.toLocaleDateString('fr-FR', { dateStyle: 'full' })}${items.length ? `, ${items.length} rendez-vous` : ''}`}
                  aria-pressed={isSelected}
                  className={cn('flex min-h-24 flex-col items-stretch gap-1 bg-white p-1.5 text-left transition-colors hover:bg-ink-900/3', !inMonth && 'bg-ink-900/2 text-ink-400', isSelected && 'ring-2 ring-inset ring-brand-orange')}
                >
                  <span className={cn('mb-0.5 inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs font-semibold', sameDay(day, today) && 'bg-ink-900 text-white')}>{day.getDate()}</span>
                  {items.slice(0, 2).map((a) => (
                    <span key={a.id} className={cn('truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', a.status === 'CANCELLED' ? 'bg-ink-900/5 text-ink-400 line-through' : CHIP[a.type])}>
                      {time(a.startAt)} {a.lead?.companyName || a.lead?.contactName}
                    </span>
                  ))}
                  {items.length > 2 && <span className="px-1 text-[11px] font-medium text-ink-500">+ {items.length - 2} de plus</span>}
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-bold capitalize text-ink-900">{selected.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            {dayItems.length === 0 ? (
              <p className="text-sm text-ink-500">Aucun rendez-vous ce jour-là.</p>
            ) : (
              <ul className="space-y-2.5">
                {dayItems.map((a) => (
                  <li key={a.id} className="rounded-xl border border-ink-900/8 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-900">
                        {time(a.startAt)} · {APPOINTMENT_LABEL[a.type]}
                      </span>
                      <Pill tone={a.status === 'DONE' ? 'green' : a.status === 'CANCELLED' ? 'gray' : 'blue'}>{a.status === 'DONE' ? 'Effectué' : a.status === 'CANCELLED' ? 'Annulé' : 'Prévu'}</Pill>
                    </div>
                    {a.lead && (
                      <Link href={`/admin/crm/leads/${a.lead.id}`} className="mt-1 block font-medium text-brand-blue hover:underline">
                        {a.lead.reference} — {a.lead.title}
                      </Link>
                    )}
                    <p className="text-xs text-ink-500">
                      {a.lead?.companyName || a.lead?.contactName} · {staffName(a.assignee)}
                      {a.location ? ` · ${a.location}` : ''}
                    </p>
                    {a.notes && <p className="mt-1 text-xs text-ink-600">{a.notes}</p>}
                    {a.status === 'SCHEDULED' && (
                      <div className="mt-2 flex gap-3 text-xs">
                        <button type="button" className="font-medium text-green-700 hover:underline" onClick={() => setStatus.mutate({ id: a.id, status: 'DONE' })}>
                          Effectué
                        </button>
                        <button type="button" className="text-ink-500 hover:text-brand-orange" onClick={() => setStatus.mutate({ id: a.id, status: 'CANCELLED' })}>
                          Annuler
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentFormModal key={`${creating}-${selected.toDateString()}`} open={creating} onClose={() => setCreating(false)} defaultStart={new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 10)} />
    </div>
  );
}
