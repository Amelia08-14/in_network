'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api';

interface Client {
  post: <T>(path: string, body?: unknown) => Promise<T>;
}

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

function PasswordField({ id, label, value, onChange, hint, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={visible ? 'text' : 'password'} required minLength={id === 'currentPassword' ? undefined : 8} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="pr-11" />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-900/5">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** Changement de mot de passe (espace membre et back-office) : POST /api/auth/change-password. */
export function ChangePasswordCard({ client, className }: { client: Client; className?: string }) {
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const change = useMutation({
    mutationFn: () => client.post('/api/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      setForm(EMPTY);
      setMessage({ text: 'Mot de passe modifié. Pour votre sécurité, vous devrez vous reconnecter sur vos autres appareils.', kind: 'ok' });
    },
    onError: (e) => setMessage({ text: e instanceof ApiRequestError ? e.message : 'Impossible de modifier le mot de passe pour le moment.', kind: 'err' }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) return setMessage({ text: 'Les deux nouveaux mots de passe ne correspondent pas.', kind: 'err' });
    if (form.newPassword === form.currentPassword) return setMessage({ text: 'Le nouveau mot de passe doit être différent de l’actuel.', kind: 'err' });
    setMessage(null);
    change.mutate();
  }

  return (
    <Card className={className}>
      <CardContent>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-ink-900">Mot de passe</h2>
            <p className="text-sm text-ink-500">Choisissez un mot de passe d’au moins 8 caractères, que vous n’utilisez pas ailleurs.</p>
          </div>
        </div>
        <form className="grid max-w-xl gap-4" onSubmit={submit}>
          <PasswordField id="currentPassword" label="Mot de passe actuel" autoComplete="current-password" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField id="newPassword" label="Nouveau mot de passe" autoComplete="new-password" hint="Au moins 8 caractères." value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} />
            <PasswordField id="confirmPassword" label="Confirmer" autoComplete="new-password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />
          </div>
          {message && (
            <p role={message.kind === 'err' ? 'alert' : 'status'} className={message.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-brand-orange'}>
              {message.text}
            </p>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={change.isPending || !form.currentPassword || !form.newPassword}>
              {change.isPending ? 'Modification…' : 'Modifier le mot de passe'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
