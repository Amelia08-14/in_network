'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export function EventRegisterButton({ eventId, isFull }: { eventId: string; isFull: boolean }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!user) {
      router.push('/login');
      return;
    }
    setState('loading');
    setError(null);
    try {
      await api.post(`/api/events/${eventId}/register`);
      setState('done');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiRequestError ? e.message : "Une erreur est survenue");
    }
  }

  if (state === 'done') {
    return <p className="text-sm font-medium text-accent-green">Inscription confirmée !</p>;
  }

  return (
    <div>
      <Button variant="primary" size="lg" disabled={isFull || state === 'loading'} onClick={handleRegister}>
        {isFull ? 'Événement complet' : state === 'loading' ? 'Inscription...' : "S'inscrire"}
      </Button>
      {!user && <p className="mt-2 text-xs text-accent-gray">Connecte-toi pour t'inscrire.</p>}
      {error && <p className="mt-2 text-xs text-brand-orange">{error}</p>}
    </div>
  );
}
