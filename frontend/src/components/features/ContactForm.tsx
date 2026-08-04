'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';

// Formulaire /contact — cf. POST /api/contact (backend/src/modules/contact/contact.routes.ts).
// Public, sans compte, pas de ciblage (contrairement à InquiryForm) : nom,
// email, message.
export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/api/contact', form);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossible d'envoyer le message, réessaie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-ink-900/[0.08] bg-white p-5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" />
        <p className="text-sm text-ink-700">Message envoyé — l&apos;équipe IN NETWORK te répond rapidement à {form.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="contact-name">Nom complet</Label>
        <Input
          id="contact-name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          rows={5}
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-brand-orange">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Envoi...' : 'Envoyer le message'}
      </Button>
    </form>
  );
}
