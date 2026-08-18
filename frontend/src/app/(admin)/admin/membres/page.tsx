'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Search, Trash2 } from 'lucide-react';
import { MemberDetailsPanel } from '@/components/features/MemberDetailsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/admin-api';
import type { ApiListResponse } from '@/types';

interface AdminMember {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  profile: { firstName: string; lastName: string; memberType: string } | null;
}

export default function AdminMembresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-members', search, page],
    queryFn: () =>
      api.get<ApiListResponse<AdminMember>>(
        `/api/admin/members?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/admin/members/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-members'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-members'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Membres</h1>
        <p className="mt-1 text-sm text-gray-500">{data?.meta.total ?? 0} membres inscrits.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Rechercher..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Chargement...</p>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Aucun membre trouvé" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-accent-gray">
                  <tr>
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3">Inscrit le</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((member) => (
                    <tr key={member.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {member.profile ? `${member.profile.firstName} ${member.profile.lastName}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{member.email}</td>
                      <td className="px-5 py-3 text-gray-600">{member.profile?.memberType ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={member.isActive ? 'success' : 'startup'}>
                          {member.isActive ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(member.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mr-2"
                          onClick={() => setSelectedMemberId(member.id)}
                        >
                          <Eye className="h-4 w-4" /> Détails
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={() => toggleMutation.mutate({ id: member.id, isActive: !member.isActive })}
                        >
                          {member.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-brand-orange hover:text-brand-orange"
                          onClick={() => {
                            const name = member.profile
                              ? `${member.profile.firstName} ${member.profile.lastName}`
                              : member.email;
                            if (
                              window.confirm(
                                `Supprimer définitivement le compte de ${name} ? Toutes ses données (réservations, demandes, abonnements...) seront effacées. Cette action est irréversible.`,
                              )
                            ) {
                              deleteMutation.mutate(member.id);
                            }
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-gray-500">
            Page {data.meta.page} / {data.meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}
      <MemberDetailsPanel
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onStatusChanged={() => queryClient.invalidateQueries({ queryKey: ['admin-members'] })}
      />
    </div>
  );
}
