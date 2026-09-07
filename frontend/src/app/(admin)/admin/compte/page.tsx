'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { useAdminAuthStore } from '@/store/admin-auth';
import { DASHBOARD_RESOURCES, type DashboardPermissions, type SystemUser } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  OFFICE_MANAGER: 'Office Manager',
};

const LEVEL_OPTIONS = [
  { value: '', label: 'Aucun accès' },
  { value: 'read', label: 'Lecture seule' },
  { value: 'write', label: 'Lecture + modification' },
];

function errorText(e: unknown) {
  return e instanceof ApiRequestError ? e.message : 'Une erreur est survenue.';
}

/* -------------------------------------------------------------------------- */
/*  Éditeur de permissions (matrice bloc → niveau)                            */
/* -------------------------------------------------------------------------- */
function PermissionMatrix({
  value,
  onChange,
}: {
  value: DashboardPermissions;
  onChange: (next: DashboardPermissions) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {DASHBOARD_RESOURCES.map((res) => (
        <label key={res.key} className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 px-3 py-2 text-sm">
          <span className="text-gray-700">{res.label}</span>
          <Select
            className="h-8 w-44 text-xs"
            value={value[res.key] ?? ''}
            onChange={(e) => {
              const next = { ...value };
              if (e.target.value === '') delete next[res.key];
              else next[res.key] = e.target.value as 'read' | 'write';
              onChange(next);
            }}
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Formulaire de création                                                    */
/* -------------------------------------------------------------------------- */
function CreateSystemUserForm({ canCreateAdmin }: { canCreateAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', phone: '', role: 'OFFICE_MANAGER' });
  const [permissions, setPermissions] = useState<DashboardPermissions>({});
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/admin/system-users', {
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        permissions: form.role === 'OFFICE_MANAGER' ? permissions : undefined,
      }),
    onSuccess: () => {
      setMessage({ text: 'Compte créé — le mot de passe a été envoyé par email.', kind: 'success' });
      setForm({ email: '', displayName: '', phone: '', role: 'OFFICE_MANAGER' });
      setPermissions({});
      queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
    },
    onError: (e) => setMessage({ text: errorText(e), kind: 'error' }),
  });

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1.5 h-4 w-4" /> Ajouter un utilisateur
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="su-name">Nom affiché</Label>
            <Input id="su-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="su-email">Email</Label>
            <Input id="su-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="su-phone">Téléphone (optionnel)</Label>
            <Input id="su-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="su-role">Rôle</Label>
            <Select id="su-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="OFFICE_MANAGER">Office Manager (accès restreint)</option>
              {canCreateAdmin && <option value="ADMIN">Administrateur (accès total)</option>}
            </Select>
          </div>
        </div>

        {form.role === 'OFFICE_MANAGER' && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Accès par bloc</p>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
        )}

        {message && (
          <p className={message.kind === 'success' ? 'text-sm text-accent-green' : 'text-sm text-brand-orange'}>
            {message.text}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="primary"
            disabled={create.isPending || !form.email.trim() || !form.displayName.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Création...' : 'Créer et envoyer les accès'}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ligne utilisateur (édition inline)                                        */
/* -------------------------------------------------------------------------- */
function SystemUserRow({ user, currentUserId }: { user: SystemUser; currentUserId: string | undefined }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [permissions, setPermissions] = useState<DashboardPermissions>(user.permissions ?? {});
  const [message, setMessage] = useState<string | null>(null);

  const isSelf = user.id === currentUserId;
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const locked = isSelf || isSuperAdmin;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/system-users/${user.id}`, body),
    onSuccess: () => {
      setMessage('Enregistré.');
      invalidate();
    },
    onError: (e) => setMessage(errorText(e)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/system-users/${user.id}`),
    onSuccess: invalidate,
    onError: (e) => setMessage(errorText(e)),
  });

  const resetPassword = useMutation({
    mutationFn: () => api.post(`/api/admin/system-users/${user.id}/reset-password`),
    onSuccess: () => setMessage('Nouveau mot de passe envoyé par email.'),
    onError: (e) => setMessage(errorText(e)),
  });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-800">
            {user.displayName || user.email}
            {isSelf && <span className="ml-2 text-xs font-normal text-gray-400">(vous)</span>}
          </p>
          <p className="text-sm text-gray-500">
            {user.email} · {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
        <Badge variant={user.isActive ? 'success' : 'startup'}>{user.isActive ? 'Actif' : 'Désactivé'}</Badge>
        {user.role === 'OFFICE_MANAGER' && !locked && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Masquer' : 'Gérer les accès'}
          </Button>
        )}
        {!locked && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={resetPassword.isPending}
              onClick={() => {
                if (window.confirm(`Réinitialiser le mot de passe de ${user.email} ? Un nouveau mot de passe lui sera envoyé par email.`))
                  resetPassword.mutate();
              }}
            >
              <KeyRound className="mr-1.5 h-4 w-4" /> Mot de passe
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ isActive: !user.isActive })}
            >
              {user.isActive ? 'Désactiver' : 'Réactiver'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement le compte ${user.email} ?`)) remove.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {expanded && user.role === 'OFFICE_MANAGER' && (
        <div className="mt-4 space-y-3 rounded-2xl border border-ink-900/8 p-4">
          <PermissionMatrix value={permissions} onChange={setPermissions} />
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              disabled={update.isPending}
              onClick={() => update.mutate({ permissions })}
            >
              Enregistrer les accès
            </Button>
            {message && <span className="text-xs text-gray-500">{message}</span>}
          </div>
        </div>
      )}
      {message && !expanded && <p className="mt-2 text-xs text-brand-orange">{message}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */
export default function AdminSystemUsersPage() {
  const currentUser = useAdminAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-system-users'],
    queryFn: () => api.get<{ data: SystemUser[] }>('/api/admin/system-users').then((r) => r.data),
    enabled: canManage,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Utilisateurs système</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comptes de l&apos;équipe backoffice : rôles et accès par bloc. Le mot de passe est généré et envoyé par email
          à la création.
        </p>
      </div>

      {canManage && (
        <section className="space-y-4">
          <CreateSystemUserForm canCreateAdmin={currentUser?.role === 'SUPER_ADMIN'} />

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-5 text-sm text-gray-500">Chargement...</p>
              ) : !users || users.length === 0 ? (
                <EmptyState title="Aucun utilisateur système" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <SystemUserRow key={u.id} user={u} currentUserId={currentUser?.id} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-gray-500">Mon mot de passe</h2>
        <ChangePasswordCard />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Changement de mot de passe (inchangé)                                     */
/* -------------------------------------------------------------------------- */
const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setSuccess(true);
      setError(null);
    },
    onError: (e) => {
      setError(errorText(e));
      setSuccess(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (form.newPassword !== form.confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Card className="max-w-md">
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères.</p>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-brand-orange">{error}</p>}
          {success && <p className="text-sm text-accent-green">Mot de passe changé avec succès.</p>}

          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Changement...' : 'Changer le mot de passe'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
