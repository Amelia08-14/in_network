'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { revalidatePublic } from '@/lib/revalidate-public';
import { capacityText } from '@/lib/spaces';
import { ServicesTarifsHeader } from '@/components/admin/ServicesTarifsHeader';
import type { ApiListResponse, MembershipPlan, Site, SpaceResource } from '@/types';

const SPACE_TYPE_LABEL: Record<SpaceResource['type'], string> = {
  DESK: 'Poste de coworking',
  PRIVATE_OFFICE: 'Bureau privatif',
  MEETING_ROOM: 'Salle de réunion',
};

const EMPTY_SPACE_FORM = {
  name: '',
  type: 'MEETING_ROOM' as SpaceResource['type'],
  capacity: 1,
  capacityMin: '',
  description: '',
  hourlyRateMember: '',
  halfDayRateMember: '',
  dailyRateMember: '',
  hourlyRateExternal: '',
  halfDayRateExternal: '',
  dailyRateExternal: '',
};

function PlanRow({ plan }: { plan: MembershipPlan }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(plan.price);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/api/admin/plans/${plan.id}`, { price: Number(price) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      revalidatePublic('plans');
      setEditing(false);
    },
  });

  return (
    <tr>
      <td className="px-5 py-3 font-medium text-ink-800">{plan.name}</td>
      <td className="px-5 py-3 text-ink-500">{plan.billingCycle}</td>
      <td className="px-5 py-3">
        {editing ? (
          <Input className="h-9 w-32" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        ) : (
          <span className="text-ink-800">{Number(plan.price).toLocaleString('fr-FR')} {plan.currency}</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </Button>
        )}
      </td>
    </tr>
  );
}

const MEETING_RATE_FIELDS = [
  ['hourlyRateMember', '1h membre'],
  ['halfDayRateMember', '1/2j membre'],
  ['dailyRateMember', 'jour membre'],
  ['hourlyRateExternal', '1h externe'],
  ['halfDayRateExternal', '1/2j externe'],
  ['dailyRateExternal', 'jour externe'],
] as const;
type RateKey = (typeof MEETING_RATE_FIELDS)[number][0] | 'monthlyRate';

const amount = (value: string | null) => (value === null || value === '' ? null : Number(value));
const rateText = (value: string | null) => (value ? `${Number(value).toLocaleString('fr-FR')} DA` : '—');

// Un espace : salle de réunion (tarifs à l'heure, demi-journée, journée ; vide =
// tarif à confirmer, la salle se demande alors sur devis) ou bureau privatif
// (loyer mensuel). Le descriptif reste court et factuel : il est montré au membre.
function SpaceRow({ space }: { space: SpaceResource }) {
  const queryClient = useQueryClient();
  const isRoom = space.type === 'MEETING_ROOM';
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: space.name,
    capacityMin: space.capacityMin ? String(space.capacityMin) : '',
    capacity: String(space.capacity),
    description: space.description ?? '',
    hourlyRateMember: space.hourlyRateMember ?? '',
    halfDayRateMember: space.halfDayRateMember ?? '',
    dailyRateMember: space.dailyRateMember ?? '',
    hourlyRateExternal: space.hourlyRateExternal ?? '',
    halfDayRateExternal: space.halfDayRateExternal ?? '',
    dailyRateExternal: space.dailyRateExternal ?? '',
    monthlyRate: space.monthlyRate ?? '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/spaces/${space.id}`, {
        name: form.name.trim(),
        capacity: Number(form.capacity) || 1,
        capacityMin: form.capacityMin ? Number(form.capacityMin) : null,
        description: form.description.trim() || null,
        ...(isRoom
          ? Object.fromEntries(MEETING_RATE_FIELDS.map(([key]) => [key, amount(form[key])]))
          : { monthlyRate: amount(form.monthlyRate) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
      revalidatePublic('spaces');
      setError(null);
      setEditing(false);
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : 'Enregistrement impossible'),
  });

  if (!editing) {
    return (
      <tr className="align-top">
        <td className="px-5 py-3">
          <p className="font-medium text-ink-800">{space.name}</p>
          <p className="text-xs text-ink-500">{capacityText(space, true)}</p>
          {space.description && <p className="mt-1 max-w-md text-xs text-ink-500">{space.description}</p>}
        </td>
        {isRoom ? (
          <>
            <td className="px-5 py-3 text-ink-600">
              {rateText(space.hourlyRateMember)} / {rateText(space.halfDayRateMember)} / {rateText(space.dailyRateMember)}
            </td>
            <td className="px-5 py-3 text-ink-600">
              {rateText(space.hourlyRateExternal)} / {rateText(space.halfDayRateExternal)} / {rateText(space.dailyRateExternal)}
            </td>
          </>
        ) : (
          <td className="px-5 py-3 text-ink-600">{space.monthlyRate ? `${rateText(space.monthlyRate)} HT / mois` : 'Selon la formule souscrite'}</td>
        )}
        <td className="px-5 py-3 text-right">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </Button>
        </td>
      </tr>
    );
  }

  const rateFields: readonly (readonly [RateKey, string])[] = isRoom ? MEETING_RATE_FIELDS : [['monthlyRate', 'Loyer mensuel HT (facultatif)']];
  return (
    <tr className="align-top">
      <td className="px-5 py-3" colSpan={isRoom ? 3 : 2}>
        <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
          <div>
            <Label className="text-xs">Nom</Label>
            <Input className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">De (pers.)</Label>
            <Input className="h-9" type="number" min={1} value={form.capacityMin} onChange={(e) => setForm({ ...form, capacityMin: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">À (pers.)</Label>
            <Input className="h-9" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
        </div>
        <div className="mt-2">
          <Label className="text-xs">Descriptif (court, factuel : capacité, équipements)</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {rateFields.map(([key, fieldLabel]) => (
            <div key={key}>
              <Label className="text-xs">{fieldLabel}</Label>
              <Input className="h-9" type="number" min={0} placeholder="—" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        {isRoom && <p className="mt-1 text-xs text-ink-500">Sans aucun tarif membre, la salle se demande sur devis (pas de réservation en ligne).</p>}
        {error && <p className="mt-1 text-xs text-brand-orange">{error}</p>}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminTarifsPage() {
  const queryClient = useQueryClient();
  const [showSpaceForm, setShowSpaceForm] = useState(false);
  const [spaceForm, setSpaceForm] = useState(EMPTY_SPACE_FORM);
  const [spaceFormError, setSpaceFormError] = useState<string | null>(null);

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get<ApiListResponse<MembershipPlan> | { data: MembershipPlan[] }>('/api/admin/plans'),
  });
  const { data: spacesData, isLoading: spacesLoading } = useQuery({
    queryKey: ['admin-spaces'],
    queryFn: () => api.get<ApiListResponse<SpaceResource> | { data: SpaceResource[] }>('/api/admin/spaces'),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['admin-sites'],
    queryFn: () => api.get<ApiListResponse<Site> | { data: Site[] }>('/api/admin/sites'),
  });

  const plans = plansData?.data ?? [];
  const spaces = spacesData?.data ?? [];
  const rooms = spaces.filter((space) => space.type === 'MEETING_ROOM');
  const offices = spaces.filter((space) => space.type !== 'MEETING_ROOM');
  const sites = sitesData?.data ?? [];

  const createSpaceMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/spaces', {
        siteId: sites[0]?.id,
        name: spaceForm.name,
        type: spaceForm.type,
        capacity: Number(spaceForm.capacity),
        capacityMin: spaceForm.capacityMin ? Number(spaceForm.capacityMin) : null,
        description: spaceForm.description.trim() || null,
        hourlyRateMember: spaceForm.hourlyRateMember ? Number(spaceForm.hourlyRateMember) : undefined,
        halfDayRateMember: spaceForm.halfDayRateMember ? Number(spaceForm.halfDayRateMember) : undefined,
        dailyRateMember: spaceForm.dailyRateMember ? Number(spaceForm.dailyRateMember) : undefined,
        hourlyRateExternal: spaceForm.hourlyRateExternal ? Number(spaceForm.hourlyRateExternal) : undefined,
        halfDayRateExternal: spaceForm.halfDayRateExternal ? Number(spaceForm.halfDayRateExternal) : undefined,
        dailyRateExternal: spaceForm.dailyRateExternal ? Number(spaceForm.dailyRateExternal) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
      revalidatePublic('spaces');
      setSpaceForm(EMPTY_SPACE_FORM);
      setShowSpaceForm(false);
      setSpaceFormError(null);
    },
    onError: (e) => setSpaceFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  return (
    <div className="space-y-8">
      <ServicesTarifsHeader active="tarifs" />

      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 pt-5 font-heading text-sm font-bold uppercase tracking-wide text-ink-500">Formules</h2>
          {plansLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : plans.length === 0 ? (
            <EmptyState title="Aucune formule" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-5 py-3">Cycle</th>
                    <th className="px-5 py-3">Prix</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {plans.map((plan) => (
                    <PlanRow key={plan.id} plan={plan} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-ink-500">Espaces</h2>
        <Button size="sm" onClick={() => setShowSpaceForm((v) => !v)} disabled={sites.length === 0}>
          <Plus className="h-4 w-4" /> Nouvel espace
        </Button>
      </div>

      {showSpaceForm && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nom</Label>
                <Input value={spaceForm.name} onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={spaceForm.type}
                  onChange={(e) => setSpaceForm({ ...spaceForm, type: e.target.value as SpaceResource['type'] })}
                >
                  {Object.entries(SPACE_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>De (pers.)</Label>
                  <Input type="number" min={1} value={spaceForm.capacityMin} onChange={(e) => setSpaceForm({ ...spaceForm, capacityMin: e.target.value })} />
                </div>
                <div>
                  <Label>À (pers.)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={spaceForm.capacity}
                    onChange={(e) => setSpaceForm({ ...spaceForm, capacity: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Descriptif (court, factuel)</Label>
              <Textarea rows={2} value={spaceForm.description} onChange={(e) => setSpaceForm({ ...spaceForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['hourlyRateMember', '1h membre'],
                  ['halfDayRateMember', '1/2j membre'],
                  ['dailyRateMember', 'jour membre'],
                  ['hourlyRateExternal', '1h externe'],
                  ['halfDayRateExternal', '1/2j externe'],
                  ['dailyRateExternal', 'jour externe'],
                ] as const
              ).map(([key, fieldLabel]) => (
                <div key={key}>
                  <Label className="text-xs">{fieldLabel}</Label>
                  <Input
                    className="h-9"
                    type="number"
                    value={spaceForm[key]}
                    onChange={(e) => setSpaceForm({ ...spaceForm, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {spaceFormError && <p className="text-sm text-brand-orange">{spaceFormError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => createSpaceMutation.mutate()} disabled={createSpaceMutation.isPending || !spaceForm.name}>
                {createSpaceMutation.isPending ? 'Création...' : "Créer l'espace"}
              </Button>
              <Button variant="ghost" onClick={() => setShowSpaceForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 pt-5 font-heading text-sm font-bold uppercase tracking-wide text-ink-500">Salles de réunion (réservées à l’heure)</h2>
          {spacesLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : rooms.length === 0 ? (
            <EmptyState title="Aucune salle" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Salle</th>
                    <th className="px-5 py-3">Membre (h / demi-j / j)</th>
                    <th className="px-5 py-3">Externe (h / demi-j / j)</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {rooms.map((space) => (
                    <SpaceRow key={space.id} space={space} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 pt-5 font-heading text-sm font-bold uppercase tracking-wide text-ink-500">Bureaux privatifs (loués au mois)</h2>
          <p className="px-5 pt-1 text-xs text-ink-500">Le bureau est attribué par l’Office Manager sur le service du membre (Services clients). Le prix vient de la formule souscrite.</p>
          {spacesLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement...</p>
          ) : offices.length === 0 ? (
            <EmptyState title="Aucun bureau" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Bureau</th>
                    <th className="px-5 py-3">Loyer</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {offices.map((space) => (
                    <SpaceRow key={space.id} space={space} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
