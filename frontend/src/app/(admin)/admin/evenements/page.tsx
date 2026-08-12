'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, EVENT_ORIGIN_LABEL } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ImageUploader } from '@/components/features/upload/ImageUploader';
import { VideoUploader } from '@/components/features/upload/VideoUploader';
import { api, ApiRequestError } from '@/lib/admin-api';
import { revalidatePublic } from '@/lib/revalidate-public';
import { slugify } from '@/lib/utils';
import type { ApiListResponse, EventItem, EventOrigin, EventStatus } from '@/types';

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'En attente',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
};
const STATUS_VARIANT: Record<EventStatus, 'neutral' | 'startup' | 'success'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'startup',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  type: 'NETWORKING' as const,
  origin: 'IN_EVENT' as EventOrigin,
  location: '',
  startAt: '',
  endAt: '',
  capacity: 30,
  coOrganizerName: '',
  coverImage: null as string | null,
  videoUrl: null as string | null,
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventRow({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState(event.type);
  const [origin, setOrigin] = useState<EventOrigin>(event.origin);
  const [location, setLocation] = useState(event.location ?? '');
  const [startAt, setStartAt] = useState(toDatetimeLocal(event.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocal(event.endAt));
  const [capacity, setCapacity] = useState(event.capacity);
  const [description, setDescription] = useState(event.description);
  const [coverImage, setCoverImage] = useState<string | null>(event.coverImage);
  const [videoUrl, setVideoUrl] = useState<string | null>(event.videoUrl);
  const [coOrganizerName, setCoOrganizerName] = useState(event.coOrganizerName ?? '');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/events/${event.id}`, {
        title,
        type,
        origin,
        location: location || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        capacity: Number(capacity),
        description,
        coverImage: coverImage || undefined,
        videoUrl: videoUrl || undefined,
        coOrganizerName: origin === 'CO_ORGANIZED' ? coOrganizerName || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      revalidatePublic('events');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la mise à jour'),
  });

  return (
    <tr>
      <td colSpan={6} className="bg-gray-50 p-5">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={origin} onChange={(e) => setOrigin(e.target.value as EventOrigin)}>
                {Object.entries(EVENT_ORIGIN_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as EventItem['type'])}>
                {['CONFERENCE', 'ATELIER', 'NETWORKING', 'MASTERCLASS'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Lieu</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label>Début</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div>
              <Label>Capacité</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
            {origin === 'CO_ORGANIZED' && (
              <div>
                <Label>Nom du co-organisateur</Label>
                <Input value={coOrganizerName} onChange={(e) => setCoOrganizerName(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUploader value={coverImage} onChange={setCoverImage} category="events" label="Visuel de couverture" />
            <VideoUploader value={videoUrl} onChange={setVideoUrl} category="events" label="Vidéo récap" />
          </div>
          {error && <p className="text-sm text-brand-orange">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminEvenementsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.get<ApiListResponse<EventItem> | { data: EventItem[] }>('/api/admin/events'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/admin/events', {
        title: form.title,
        slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
        description: form.description,
        type: form.type,
        origin: form.origin,
        location: form.location || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        capacity: Number(form.capacity),
        coOrganizerName: form.origin === 'CO_ORGANIZED' ? form.coOrganizerName || undefined : undefined,
        coverImage: form.coverImage || undefined,
        videoUrl: form.videoUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      revalidatePublic('events');
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e) => setFormError(e instanceof ApiRequestError ? e.message : 'Erreur lors de la création'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      api.patch(`/api/admin/events/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      revalidatePublic('events');
    },
  });

  const events = (data?.data ?? []).filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Événements</h1>
          <p className="mt-1 text-sm text-gray-500">IN EVENT (interne), externes et co-organisés.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nouvel événement
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
                <Select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value as EventOrigin })}>
                  {Object.entries(EVENT_ORIGIN_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                  {['CONFERENCE', 'ATELIER', 'NETWORKING', 'MASTERCLASS'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Lieu</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <Label>Début</Label>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div>
                <Label>Fin</Label>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
              <div>
                <Label>Capacité</Label>
                <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
              </div>
              {form.origin === 'CO_ORGANIZED' && (
                <div>
                  <Label>Nom du co-organisateur</Label>
                  <Input value={form.coOrganizerName} onChange={(e) => setForm({ ...form, coOrganizerName: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUploader value={form.coverImage} onChange={(url) => setForm({ ...form, coverImage: url })} category="events" label="Visuel de couverture" />
              <VideoUploader value={form.videoUrl} onChange={(url) => setForm({ ...form, videoUrl: url })} category="events" label="Vidéo récap (événement déjà réalisé)" />
            </div>

            {formError && <p className="text-sm text-brand-orange">{formError}</p>}
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.title || !form.startAt || !form.endAt}
              >
                {createMutation.isPending ? 'Création...' : "Créer l'événement (brouillon)"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Rechercher un événement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : events.length === 0 ? (
            <EmptyState title={search ? 'Aucun événement ne correspond à la recherche' : 'Aucun événement'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Titre</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Inscrits</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((event) =>
                    editingId === event.id ? (
                      <EditEventRow key={event.id} event={event} onClose={() => setEditingId(null)} />
                    ) : (
                      <tr key={event.id}>
                        <td className="px-5 py-3 font-medium text-gray-800">{event.title}</td>
                        <td className="px-5 py-3">
                          <Badge variant="neutral">{EVENT_ORIGIN_LABEL[event.origin] ?? event.origin}</Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(event.startAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {event._count?.registrations ?? 0}/{event.capacity}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={STATUS_VARIANT[event.status ?? 'DRAFT']}>{STATUS_LABEL[event.status ?? 'DRAFT']}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(event.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {event.status !== 'PUBLISHED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => statusMutation.mutate({ id: event.id, status: 'PUBLISHED' })}
                              >
                                Publier
                              </Button>
                            )}
                            {event.status === 'PUBLISHED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => statusMutation.mutate({ id: event.id, status: 'ARCHIVED' })}
                              >
                                Archiver
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
