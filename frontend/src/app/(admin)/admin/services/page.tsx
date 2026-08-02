'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { slugify } from '@/lib/utils';
import type { ApiListResponse, PricingTier, ServiceCatalogItem } from '@/types';

const CATEGORIES = ['DOMICILIATION', 'CREATION_ENTREPRISE', 'COMPTABILITE', 'JURIDIQUE', 'MARKETING', 'SECRETARIAT', 'AUTRE'];

const EMPTY_FORM = {
  title: '',
  category: 'AUTRE',
  description: '',
  priceFrom: '',
  tiers: [] as PricingTier[],
};

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => api.get<ApiListResponse<ServiceCatalogItem> | { data: ServiceCatalogItem[] }>('/api/services'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/services', {
        title: form.title,
        slug: slugify(form.title),
        category: form.category,
        description: form.description,
        priceFrom: form.priceFrom ? Number(form.priceFrom) : undefined,
        pricingTiers: form.tiers.length > 0 ? form.tiers : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  const services = data?.data ?? [];

  function addTier() {
    setForm({ ...form, tiers: [...form.tiers, { label: '', price: 0 }] });
  }
  function updateTier(index: number, patch: Partial<PricingTier>) {
    setForm({ ...form, tiers: form.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }
  function removeTier(index: number) {
    setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Catalogue de services</h1>
          <p className="mt-1 text-sm text-gray-500">Secrétariat, création juridique et autres prestations à la carte.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nouveau service
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Prix "à partir de" (si pas de paliers)</Label>
              <Input type="number" value={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Paliers de prix</Label>
                <Button type="button" size="sm" variant="outline" onClick={addTier}>
                  <Plus className="h-3.5 w-3.5" /> Ajouter un palier
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {form.tiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input placeholder="Libellé" value={tier.label} onChange={(e) => updateTier(index, { label: e.target.value })} />
                    <Input
                      type="number"
                      placeholder="Prix DA"
                      className="w-32"
                      value={tier.price}
                      onChange={(e) => updateTier(index, { price: Number(e.target.value) })}
                    />
                    <button type="button" onClick={() => removeTier(index)} className="text-ink-500 hover:text-brand-orange">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title}>
                {createMutation.isPending ? 'Création...' : 'Créer le service'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : services.length === 0 ? (
            <EmptyState title="Aucun service" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Titre</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3">Tarif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">{service.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant="neutral">{service.category}</Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {service.pricingTiers && service.pricingTiers.length > 0
                          ? service.pricingTiers.map((t) => `${t.label}: ${t.price} DA`).join(' · ')
                          : service.priceFrom
                            ? `à partir de ${service.priceFrom} DA`
                            : '—'}
                      </td>
                    </tr>
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
