'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api';
import { getAttribution } from '@/lib/attribution';
import { usePlatformOptions } from '@/lib/options';

// Formulaire /contact — cf. POST /api/contact (backend/src/modules/contact/contact.routes.ts).
// Public, sans compte. Le sujet vient de la liste réglée par le super
// administrateur (Paramètres) et qualifie le lead créé dans le CRM.
// Pensé pour un fond sombre (carte « Écrivez-nous » de la page Contact).
export function ContactForm({ defaultSubject = '' }: { defaultSubject?: string }) {
  const subjects = usePlatformOptions().data?.lists.contactSubjects ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: defaultSubject, message: '' });
  const subjectOptions = form.subject && !subjects.includes(form.subject) ? [form.subject, ...subjects] : subjects;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/api/contact', {
        name: form.name,
        email: form.email,
        phone: form.phone.trim() || undefined,
        subject: form.subject || undefined,
        message: form.message,
        attribution: getAttribution(),
      });
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossible d'envoyer le message, réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-white/[0.08] p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-green" />
        <p className="text-sm text-white/90">Message envoyé — l&apos;équipe IN NETWORK vous répond dans les meilleurs délais à {form.email}.</p>
      </div>
    );
  }

  const field = 'border-white/15 bg-white/[0.07] text-white placeholder:text-white/40 focus-visible:border-white/40';
  const label = 'text-white/85';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name" className={label}>
            Nom complet <span className="text-brand-orange">*</span>
          </Label>
          <Input id="contact-name" required autoComplete="name" placeholder="Votre nom et prénom" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="contact-email" className={label}>
            Adresse e-mail <span className="text-brand-orange">*</span>
          </Label>
          <Input id="contact-email" type="email" required autoComplete="email" placeholder="votre@email.com" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-subject" className={label}>
            Sujet de votre demande <span className="text-brand-orange">*</span>
          </Label>
          <Select id="contact-subject" required className={field} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
            <option value="" className="text-ink-900">
              Sélectionnez un sujet
            </option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject} className="text-ink-900">
                {subject}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="contact-phone" className={label}>
            Téléphone <span className="font-normal text-white/50">(facultatif)</span>
          </Label>
          <Input id="contact-phone" type="tel" autoComplete="tel" placeholder="+213 …" className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-message" className={label}>
          Message <span className="text-brand-orange">*</span>
        </Label>
        <Textarea id="contact-message" rows={5} required placeholder="Écrivez votre message ici…" className={field} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </div>
      {error && (
        <p className="text-sm text-brand-orange" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? 'Envoi…' : 'Envoyer mon message'} <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-white/55">
        <Lock className="h-3 w-3" /> Vos informations restent confidentielles.
      </p>
    </form>
  );
}
