'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/admin-api';

interface MemberDetail {
  id: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  emailVerified: string | null;
  createdAt: string;
  profile: {
    firstName: string;
    lastName: string;
    memberType: string;
    companyName: string | null;
    jobTitle: string | null;
    bio: string | null;
    website: string | null;
    linkedinUrl: string | null;
    isPublic: boolean;
    tags: Array<{ relation: 'OFFER' | 'NEED'; tag: { label: string; category: 'SKILL' | 'SECTOR' } }>;
  } | null;
  subscriptions: Array<{ id: string; status: string; startDate: string; endDate: string }>;
  bookings: Array<{ id: string; status: string; startAt: string; endAt: string }>;
}

function tagsByRelation(profile: MemberDetail['profile'], category: 'SKILL' | 'SECTOR', relation: 'OFFER' | 'NEED') {
  return (profile?.tags ?? []).filter((t) => t.tag.category === category && t.relation === relation).map((t) => t.tag.label);
}

export function MemberDetailsPanel({
  memberId,
  onClose,
  onStatusChanged,
}: {
  memberId: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: member, isLoading } = useQuery({
    queryKey: ['admin-member-detail', memberId],
    queryFn: () => api.get<{ data: MemberDetail }>(`/api/admin/members/${memberId}`).then((response) => response.data),
    enabled: Boolean(memberId),
  });
  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/api/admin/members/${memberId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-member-detail', memberId] });
      onStatusChanged();
    },
  });

  if (!memberId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/35 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-ink-900">Détails du membre</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></Button>
        </div>

        {isLoading || !member ? (
          <p className="mt-8 text-sm text-ink-500">Chargement du profil...</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl bg-ink-900 p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-bold">
                    {member.profile ? `${member.profile.firstName} ${member.profile.lastName}` : 'Profil incomplet'}
                  </p>
                  <p className="mt-1 text-sm text-white/65">{member.profile?.jobTitle || member.profile?.memberType}</p>
                </div>
                <Badge variant={member.isActive ? 'success' : 'startup'}>{member.isActive ? 'Actif' : 'Désactivé'}</Badge>
              </div>
            </div>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Coordonnées</h3>
              <dl className="mt-3 grid gap-4 rounded-2xl border border-ink-900/[0.08] p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-ink-500">Email</dt><dd className="mt-1 break-all font-medium text-ink-900">{member.email}</dd></div>
                <div><dt className="text-ink-500">Téléphone</dt><dd className="mt-1 font-medium text-ink-900">{member.phone || 'Non renseigné'}</dd></div>
                <div><dt className="text-ink-500">Entreprise</dt><dd className="mt-1 font-medium text-ink-900">{member.profile?.companyName || 'Non renseignée'}</dd></div>
                <div><dt className="text-ink-500">Poste</dt><dd className="mt-1 font-medium text-ink-900">{member.profile?.jobTitle || 'Non renseigné'}</dd></div>
                <div><dt className="text-ink-500">Type</dt><dd className="mt-1 font-medium text-ink-900">{member.profile?.memberType || 'Non renseigné'}</dd></div>
                <div>
                  <dt className="text-ink-500">Site web</dt>
                  <dd className="mt-1 break-all font-medium text-ink-900">
                    {member.profile?.website ? (
                      <a href={member.profile.website} target="_blank" rel="noreferrer" className="text-brand-orange hover:underline">
                        {member.profile.website}
                      </a>
                    ) : (
                      'Non renseigné'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">LinkedIn</dt>
                  <dd className="mt-1 break-all font-medium text-ink-900">
                    {member.profile?.linkedinUrl ? (
                      <a href={member.profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-brand-orange hover:underline">
                        {member.profile.linkedinUrl}
                      </a>
                    ) : (
                      'Non renseigné'
                    )}
                  </dd>
                </div>
                <div><dt className="text-ink-500">Email vérifié</dt><dd className="mt-1 font-medium text-ink-900">{member.emailVerified ? 'Oui' : 'Non'}</dd></div>
                <div><dt className="text-ink-500">Inscription</dt><dd className="mt-1 font-medium text-ink-900">{new Date(member.createdAt).toLocaleDateString('fr-FR')}</dd></div>
              </dl>
            </section>

            {member.profile?.bio && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Présentation</h3>
                <p className="mt-3 whitespace-pre-line rounded-2xl border border-ink-900/[0.08] p-4 text-sm leading-relaxed text-ink-600">{member.profile.bio}</p>
              </section>
            )}

            {(() => {
              const sectors = tagsByRelation(member.profile, 'SECTOR', 'OFFER');
              const skillsOffered = tagsByRelation(member.profile, 'SKILL', 'OFFER');
              const skillsWanted = tagsByRelation(member.profile, 'SKILL', 'NEED');
              if (!sectors.length && !skillsOffered.length && !skillsWanted.length) return null;
              return (
                <section className="space-y-4">
                  {sectors.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Secteur(s) d&apos;activité</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sectors.map((s) => (
                          <Badge key={s} variant="neutral">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {skillsOffered.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Compétences proposées</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skillsOffered.map((s) => (
                          <Badge key={s} variant="success">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {skillsWanted.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Compétences recherchées</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skillsWanted.map((s) => (
                          <Badge key={s} variant="startup">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink-900/[0.08] p-4"><p className="text-sm text-ink-500">Abonnements</p><p className="mt-1 text-3xl font-bold text-ink-900">{member.subscriptions.length}</p></div>
              <div className="rounded-2xl border border-ink-900/[0.08] p-4"><p className="text-sm text-ink-500">Réservations</p><p className="mt-1 text-3xl font-bold text-ink-900">{member.bookings.length}</p></div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-ink-900/[0.08] pt-5">
              <a href={`mailto:${member.email}`}><Button variant="primary">Contacter par email</Button></a>
              <Button variant="outline" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(!member.isActive)}>
                {member.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
