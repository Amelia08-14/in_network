'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ExpertConnectionRequest({ expertId, expertName }: { expertId: string; expertName: string }) {
  const { user, status } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(
    `Bonjour, je souhaite être mis(e) en relation avec ${expertName} afin d'échanger sur mon projet.`,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/api/experts/${expertId}/connection-request`, { message });
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossible d'envoyer la demande.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === 'loading' || status === 'idle') {
    return <Button size="lg" disabled>Chargement...</Button>;
  }

  if (!user) {
    return (
      <div>
        <Link href={`/login?redirect=/experts/${expertId}`} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
          Se connecter pour faire une demande
        </Link>
        <p className="mt-2 text-xs text-ink-500">La connexion est nécessaire pour envoyer une demande.</p>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-accent-green/30 bg-accent-green/10 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
        <p className="text-sm font-medium text-ink-700">
          Demande envoyée. L&apos;expert ou l&apos;équipe IN NETWORK vous recontactera rapidement.
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button variant="primary" size="lg" onClick={() => setIsOpen(true)}>
        Demander une mise en relation
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-2xl border border-ink-900/8 bg-white p-5 shadow-soft">
      <div>
        <Label htmlFor="expert-connection-message">Votre message</Label>
        <Textarea
          id="expert-connection-message"
          rows={4}
          required
          maxLength={1000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {error && <p className="text-sm text-brand-orange">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting || !message.trim()}>
          {isSubmitting ? 'Envoi...' : 'Envoyer la demande'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
