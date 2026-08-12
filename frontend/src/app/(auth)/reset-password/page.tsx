'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiRequestError ? e.message : 'Lien invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Réinitialisation du mot de passe</h1>
          <p className="mt-4 text-sm text-brand-orange">Lien de réinitialisation invalide.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Réinitialisation du mot de passe</h1>

        {status === 'success' ? (
          <p className="mt-6 text-sm text-accent-green">
            Ton mot de passe a été mis à jour. Tu peux te{' '}
            <Link href="/login" className="font-medium underline">
              connecter
            </Link>
            .
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {status === 'error' && <p className="text-sm text-brand-orange">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-gray-500">Chargement...</p>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
