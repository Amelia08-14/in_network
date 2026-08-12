'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EVENT_ORIGIN_LABEL } from '@/components/ui/badge';
import { api } from '@/lib/admin-api';
import type { EventItem } from '@/types';

interface ServiceRequestItem {
  id: string;
  notes: string | null;
  targetType: 'SERVICE' | 'SPACE' | 'PLAN';
  service: { title: string } | null;
  space: { name: string } | null;
  plan: { name: string } | null;
  user: { email: string; profile: { firstName: string; lastName: string } | null } | null;
  guestName: string | null;
  guestEmail: string | null;
}

interface PaymentItem {
  id: string;
  amount: string;
  currency: string;
  createdAt: string;
  user: { email: string; profile: { firstName: string; lastName: string } | null };
}

interface PendingMemberItem {
  userId: string;
  firstName: string;
  lastName: string;
  memberType: string;
  companyName: string | null;
  user: { email: string; emailVerified: string | null };
}

interface ValidationsResponse {
  pendingEvents: EventItem[];
  pendingServiceRequests: ServiceRequestItem[];
  pendingBankTransfers: PaymentItem[];
  pendingMembers: PendingMemberItem[];
}

function userLabel(user: { email: string; profile: { firstName: string; lastName: string } | null }) {
  return user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email;
}

// Une demande est soit rattachée à un compte (user), soit soumise par un
// visiteur non connecté (guestName/guestEmail) — cf. services.routes.ts.
function requesterLabel(req: ServiceRequestItem) {
  if (req.user) return userLabel(req.user);
  if (req.guestName) return `${req.guestName} (visiteur)${req.guestEmail ? ` · ${req.guestEmail}` : ''}`;
  return 'Visiteur';
}

function targetLabel(req: ServiceRequestItem) {
  return req.service?.title ?? req.space?.name ?? req.plan?.name ?? 'Demande';
}

export default function AdminValidationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-validations'],
    queryFn: () => api.get<{ data: ValidationsResponse }>('/api/admin/validations').then((r) => r.data),
  });

  const publishEvent = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/events/${id}`, { status: 'PUBLISHED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-validations'] }),
  });
  const rejectEvent = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/events/${id}`, { status: 'DRAFT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-validations'] }),
  });
  const resolveServiceRequest = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/service-requests/${id}`, { status: 'IN_PROGRESS' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-validations'] }),
  });
  const confirmPayment = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/payments/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-validations'] }),
  });
  const approveMember = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/members/${userId}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-validations'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Chargement...</p>;

  const events = data?.pendingEvents ?? [];
  const serviceRequests = data?.pendingServiceRequests ?? [];
  const payments = data?.pendingBankTransfers ?? [];
  const members = data?.pendingMembers ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Validations</h1>
        <p className="mt-1 text-sm text-gray-500">Tout ce qui attend une décision admin, au même endroit.</p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
          Nouveaux membres ({members.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {members.length === 0 ? (
              <EmptyState title="Rien à valider" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800">
                        {m.firstName} {m.lastName}
                        {m.companyName && <span className="font-normal text-gray-500"> — {m.companyName}</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {m.user.email} · {m.memberType}
                        {!m.user.emailVerified && <span className="ml-1.5 text-brand-orange">· email non vérifié</span>}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => approveMember.mutate(m.userId)}>
                      Approuver
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
          Événements en attente ({events.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <EmptyState title="Rien à valider" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800">{event.title}</p>
                      <p className="text-sm text-gray-500">
                        {EVENT_ORIGIN_LABEL[event.origin]} · {new Date(event.startAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => publishEvent.mutate(event.id)}>
                      Publier
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectEvent.mutate(event.id)}>
                      Renvoyer en brouillon
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
          Demandes de service ({serviceRequests.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {serviceRequests.length === 0 ? (
              <EmptyState title="Rien à valider" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {serviceRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800">{targetLabel(req)}</p>
                      <p className="text-sm text-gray-500">{requesterLabel(req)}</p>
                      {req.notes && <p className="mt-1 text-sm text-gray-600">{req.notes}</p>}
                    </div>
                    <Button size="sm" onClick={() => resolveServiceRequest.mutate(req.id)}>
                      Prendre en charge
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">
          Virements bancaires en attente ({payments.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <EmptyState title="Rien à valider" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800">
                        {payment.amount} {payment.currency}
                      </p>
                      <p className="text-sm text-gray-500">{userLabel(payment.user)}</p>
                    </div>
                    <Button size="sm" onClick={() => confirmPayment.mutate(payment.id)}>
                      Confirmer la réception
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
