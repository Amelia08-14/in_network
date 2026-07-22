'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide.');
      return;
    }
    api
      .post('/api/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error');
        setMessage(e instanceof ApiRequestError ? e.message : 'Lien invalide ou expiré.');
      });
  }, [token]);

  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Vérification de l'email</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-gray-500">Vérification en cours...</p>}
        {status === 'success' && (
          <p className="mt-4 text-sm text-accent-green">
            Ton email est confirmé ! Tu peux te{' '}
            <Link href="/login" className="font-medium underline">
              connecter
            </Link>
            .
          </p>
        )}
        {status === 'error' && <p className="mt-4 text-sm text-brand-orange">{message}</p>}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-gray-500">Chargement...</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
