'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChangePasswordCard } from '@/components/features/ChangePasswordCard';
import { api } from '@/lib/admin-api';
import { useAdminAuthStore } from '@/store/admin-auth';
import { ROLE_LABEL } from '@/types';

// Page personnelle de tout compte du back-office (administrateur, office manager,
// responsable commercial, commercial) : identité et changement de mot de passe.
export default function MyAccountPage() {
  const user = useAdminAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Mon compte</h1>
        <p className="mt-1 text-sm text-ink-500">Vos informations de connexion et votre mot de passe.</p>
      </div>

      <Card className="max-w-xl">
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Nom</dt>
              <dd className="mt-0.5 text-ink-900">{user.displayName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Rôle</dt>
              <dd className="mt-0.5 text-ink-900">{ROLE_LABEL[user.role] ?? user.role}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email (identifiant de connexion)</dt>
              <dd className="mt-0.5 text-ink-900">{user.email}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-500">Pour modifier votre nom, votre email ou vos accès, adressez-vous à un administrateur.</p>
        </CardContent>
      </Card>

      <ChangePasswordCard client={api} className="max-w-xl" />
    </div>
  );
}
