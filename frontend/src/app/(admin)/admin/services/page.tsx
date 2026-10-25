'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { revalidatePublic } from '@/lib/revalidate-public';
import { ServicesTarifsHeader, useCanEditCatalogue } from '@/components/admin/ServicesTarifsHeader';
import { cn, slugify } from '@/lib/utils';
import { HUE, SERVICE_HUE } from '@/lib/palette';
import { CATEGORY_LABEL } from '@/components/features/ServiceCard';
import type { PricingTier, ServiceCatalogItem } from '@/types';

type AdminService = ServiceCatalogItem & { isActive: boolean };

const CATEGORIES = ['OFFRE', 'DOMICILIATION', 'CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'INCUBATION', 'DIASPORA', 'AUTRE'];
const POLES = [
  { value: 'SPACES', label: 'Espaces et domiciliation' },
  { value: 'COMPANY_CREATION', label: 'Création d’entreprise' },
  { value: 'IN_GROUP', label: 'Solutions IN Group' },
] as const;

const errorText = (e: unknown, fallback: string) => (e instanceof ApiRequestError ? e.message : fallback);

/**
 * Réglages de livraison d'un service (processus v1.3) : le pôle qui le livre
 * et sa durée de validité, qui fixe l'échéance et les alertes de
 * renouvellement des services vendus. Enregistrés à la volée.
 */
function DeliverySettings({ service, onSaved }: { service: AdminService; onSaved: () => void }) {
  const [duration, setDuration] = useState(service.durationMonths ? String(service.durationMonths) : '');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/services/${service.id}`, body),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (e) => setError(errorText(e, 'Enregistrement impossible')),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={`Pôle de ${service.title}`} className="h-9 w-52" value={service.pole ?? 'SPACES'} onChange={(e) => save.mutate({ pole: e.target.value })}>
        {POLES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      <Input
        aria-label={`Durée de ${service.title} en mois`}
        type="number"
        min="1"
        className="h-9 w-24"
        placeholder="Mois"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        onBlur={() => {
          const value = duration.trim() === '' ? null : Number(duration);
          if (value !== (service.durationMonths ?? null)) save.mutate({ durationMonths: value });
        }}
      />
      {error && <span className="text-xs text-brand-orange">{error}</span>}
    </div>
  );
}

interface FormState {
  title: string;
  category: string;
  description: string;
  priceFrom: string;
  tiers: PricingTier[];
}

const EMPTY_FORM: FormState = { title: '', category: 'AUTRE', description: '', priceFrom: '', tiers: [] };

const formFrom = (service: AdminService): FormState => ({
  title: service.title,
  category: service.category,
  description: service.description,
  priceFrom: service.pricingTiers?.length ? '' : (service.priceFrom ?? ''),
  tiers: service.pricingTiers ?? [],
});

/** Création ou modification d'un service : titre, catégorie, description, prix (unique, paliers ou sur devis). */
function ServiceForm({ service, onDone }: { service: AdminService | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(service ? formFrom(service) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const tiers = form.tiers.filter((t) => t.label.trim());

  const save = useMutation({
    mutationFn: () => {
      // Un service à paliers affiche « à partir de » son palier le moins cher ; sans prix ni palier, il est « sur devis ».
      const priceFrom = tiers.length ? Math.min(...tiers.map((t) => Number(t.price))) : form.priceFrom.trim() ? Number(form.priceFrom) : null;
      const body = { title: form.title.trim(), category: form.category, description: form.description.trim(), priceFrom, pricingTiers: tiers.length ? tiers : null };
      return service
        ? api.patch(`/api/admin/services/${service.id}`, body)
        : api.post('/api/admin/services', { ...body, slug: slugify(form.title), priceFrom: priceFrom ?? undefined, pricingTiers: tiers.length ? tiers : undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      revalidatePublic('services');
      onDone();
    },
    onError: (e) => setError(errorText(e, service ? 'Enregistrement impossible' : 'Erreur lors de la création')),
  });

  const setTier = (index: number, patch: Partial<PricingTier>) => setForm({ ...form, tiers: form.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="font-heading text-base font-bold text-ink-900">{service ? `Modifier « ${service.title} »` : 'Nouveau service'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="svc-title">Titre</Label>
            <Input id="svc-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="svc-category">Catégorie</Label>
            <Select id="svc-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="svc-description">Description</Label>
          <Textarea id="svc-description" rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <p className="mt-1 text-xs text-ink-500">Première ligne : l’accroche affichée sur la carte. Lignes suivantes commençant par « • » : les points détaillés.</p>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Formules et prix (DA)</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, tiers: [...form.tiers, { label: '', price: 0 }] })}>
              <Plus className="h-3.5 w-3.5" /> Ajouter une formule
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.tiers.map((tier, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input aria-label={`Libellé de la formule ${index + 1}`} placeholder="Libellé (ex. NET)" value={tier.label} onChange={(e) => setTier(index, { label: e.target.value })} />
                <Input aria-label={`Prix de la formule ${index + 1}`} type="number" min="0" placeholder="Prix DA" className="w-36" value={tier.price} onChange={(e) => setTier(index, { price: Number(e.target.value) })} />
                <button type="button" aria-label={`Retirer la formule ${index + 1}`} onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) })} className="text-ink-500 hover:text-brand-orange">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {form.tiers.length === 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Input aria-label="Prix unique" type="number" min="0" placeholder="Prix unique (vide : sur devis)" className="w-64" value={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.value })} />
              <span className="text-xs text-ink-500">Sans prix ni formule, le service est proposé « sur devis ».</span>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-brand-orange">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.description.trim()}>
            {save.isPending ? 'Enregistrement…' : service ? 'Enregistrer' : 'Créer le service'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminServicesPage() {
  const canEditCatalogue = useCanEditCatalogue();
  const queryClient = useQueryClient();
  // null : fermé ; 'new' : création ; sinon : le service modifié.
  const [editing, setEditing] = useState<AdminService | 'new' | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => api.get<{ data: AdminService[] }>('/api/admin/services').then((r) => r.data),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-services'] });
  const toggle = useMutation({
    mutationFn: (service: AdminService) => api.patch(`/api/admin/services/${service.id}`, { isActive: !service.isActive }),
    onSuccess: () => {
      refresh();
      revalidatePublic('services');
    },
  });

  return (
    // Hors Direction : catalogue en lecture seule (le serveur refuse toute modification).
    <fieldset disabled={!canEditCatalogue} className="min-w-0 space-y-6">
      <ServicesTarifsHeader active="catalogue" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-ink-900">Catalogue de services</h2>
          <p className="mt-1 text-sm text-ink-500">Offres, services aux entreprises et packs : créez, modifiez ou masquez un service. Le pôle désigne qui le livre ; la durée fixe son échéance (vide : sans échéance, comme une création d’entreprise).</p>
        </div>
        {canEditCatalogue && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Nouveau service
          </Button>
        )}
      </div>

      {editing && <ServiceForm key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-ink-500">Chargement…</p>
          ) : services.length === 0 ? (
            <EmptyState title="Aucun service" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-900/8 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Titre</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3">Tarif</th>
                    <th className="px-5 py-3">Pôle · durée (mois)</th>
                    {canEditCatalogue && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {services.map((service) => (
                    <tr key={service.id} className={cn(!service.isActive && 'bg-ink-900/[0.03] text-ink-400')}>
                      <td className="px-5 py-3 font-medium text-ink-800">
                        {service.title}
                        {!service.isActive && <span className="ml-2 rounded-pill bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">Masqué</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold', HUE[SERVICE_HUE[service.category] ?? 'gray'].soft, HUE[SERVICE_HUE[service.category] ?? 'gray'].text)}>
                          {CATEGORY_LABEL[service.category] ?? service.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-600">
                        {service.pricingTiers && service.pricingTiers.length > 0
                          ? service.pricingTiers.map((t) => `${t.label} : ${Number(t.price).toLocaleString('fr-FR')} DA`).join(' · ')
                          : service.priceFrom
                            ? `${Number(service.priceFrom).toLocaleString('fr-FR')} DA`
                            : 'Sur devis'}
                      </td>
                      <td className="px-5 py-3">
                        <DeliverySettings service={service} onSaved={refresh} />
                      </td>
                      {canEditCatalogue && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" aria-label={`Modifier ${service.title}`} onClick={() => setEditing(service)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label={service.isActive ? `Masquer ${service.title}` : `Réafficher ${service.title}`} title={service.isActive ? 'Masquer du site et des devis' : 'Réafficher'} disabled={toggle.isPending} onClick={() => toggle.mutate(service)}>
                              {service.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </fieldset>
  );
}
