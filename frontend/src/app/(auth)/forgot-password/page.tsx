'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await api.post('/api/auth/forgot-password', { email }).catch(() => undefined);
    setLoading(false);
    setSent(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-gray-500">
          Indique ton email : si un compte existe, tu recevras un lien de réinitialisation.
        </p>

        {sent ? (
          <p className="mt-6 text-sm text-accent-green">
            Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
