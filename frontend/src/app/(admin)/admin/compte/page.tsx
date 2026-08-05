'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/admin-api';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function AdminComptePage() {
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
      setError(e instanceof ApiRequestError ? e.message : 'Erreur lors du changement de mot de passe');
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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Mon compte</h1>
        <p className="mt-1 text-sm text-gray-500">Change ton mot de passe administrateur.</p>
      </div>

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
    </div>
  );
}
