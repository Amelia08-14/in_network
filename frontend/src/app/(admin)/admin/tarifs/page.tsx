'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { revalidatePublic } from '@/lib/revalidate-public';
import type { ApiListResponse, MembershipPlan, Site, SpaceResource } from '@/types';

const SPACE_TYPE_LABEL: Record<SpaceResource['type'], string> = {
  DESK: 'Poste de coworking',
  PRIVATE_OFFICE: 'Bureau privé',
  MEETING_ROOM: 'Salle de réunion',
};

const EMPTY_SPACE_FORM = {
  name: '',
  type: 'MEETING_ROOM' as SpaceResource['type'],
  capacity: 1,
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
      <td className="px-5 py-3 font-medium text-gray-800">{plan.name}</td>
      <td className="px-5 py-3 text-gray-500">{plan.billingCycle}</td>
      <td className="px-5 py-3">
        {editing ? (
          <Input className="h-9 w-32" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        ) : (
          <span className="text-gray-800">{Number(plan.price).toLocaleString('fr-FR')} {plan.currency}</span>
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

function SpaceRow({ space }: { space: SpaceResource }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rates, setRates] = useState({
    hourlyRateMember: space.hourlyRateMember ?? '',
    halfDayRateMember: space.halfDayRateMember ?? '',
    dailyRateMember: space.dailyRateMember ?? '',
    hourlyRateExternal: space.hourlyRateExternal ?? '',
    halfDayRateExternal: space.halfDayRateExternal ?? '',
    dailyRateExternal: space.dailyRateExternal ?? '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/spaces/${space.id}`, {
        hourlyRateMember: Number(rates.hourlyRateMember),
        halfDayRateMember: Number(rates.halfDayRateMember),
        dailyRateMember: Number(rates.dailyRateMember),
        hourlyRateExternal: Number(rates.hourlyRateExternal),
        halfDayRateExternal: Number(rates.halfDayRateExternal),
        dailyRateExternal: Number(rates.dailyRateExternal),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spaces'] });
      revalidatePublic('spaces');
      setEditing(false);
    },
  });

  if (!editing) {
    return (
      <tr>
        <td className="px-5 py-3 font-medium text-gray-800">{space.name}</td>
        <td className="px-5 py-3 text-gray-600">
          {space.hourlyRateMember}/{space.halfDayRateMember}/{space.dailyRateMember} DA
        </td>
        <td className="px-5 py-3 text-gray-600">
          {space.hourlyRateExternal}/{space.halfDayRateExternal}/{space.dailyRateExternal} DA
        </td>
        <td className="px-5 py-3 text-right">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-5 py-3 font-medium text-gray-800 align-top">{space.name}</td>
      <td className="px-5 py-3 align-top" colSpan={2}>
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
                value={rates[key]}
                onChange={(e) => setRates({ ...rates, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </td>
      <td className="px-5 py-3 text-right align-top">
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
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
  const sites = sitesData?.data ?? [];

  const createSpaceMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/spaces', {
        siteId: sites[0]?.id,
        name: spaceForm.name,
        type: spaceForm.type,
        capacity: Number(spaceForm.capacity),
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
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Tarifs & espaces</h1>
        <p className="mt-1 text-sm text-gray-500">Formules d&apos;abonnement et tarifs des salles de réunion.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 pt-5 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">Formules</h2>
          {plansLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : plans.length === 0 ? (
            <EmptyState title="Aucune formule" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-5 py-3">Cycle</th>
                    <th className="px-5 py-3">Prix</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gray-500">Espaces</h2>
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
              <div>
                <Label>Capacité</Label>
                <Input
                  type="number"
                  min={1}
                  value={spaceForm.capacity}
                  onChange={(e) => setSpaceForm({ ...spaceForm, capacity: Number(e.target.value) })}
                />
              </div>
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
          <h2 className="px-5 pt-5 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
            Salles de réunion (tarif membre / externe)
          </h2>
          {spacesLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : spaces.length === 0 ? (
            <EmptyState title="Aucune salle" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Salle</th>
                    <th className="px-5 py-3">Membre (h/demi-j/j)</th>
                    <th className="px-5 py-3">Externe (h/demi-j/j)</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {spaces.map((space) => (
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
