'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

// Inscription unique « Devenir membre » : indépendant·e ou entreprise dans le
// même formulaire (un seul choix en tête, deux champs de plus pour une
// entreprise). Le membre arrive ensuite sur « Situation du compte » où il suit
// sa validation, répond à son devis et envoie son reçu de paiement.

type AccountType = 'individual' | 'company';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  email: z.string().trim().email('Email invalide'),
  phone: z.string().trim().min(6, 'Téléphone requis pour vous recontacter'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  memberType: z.enum(['FREELANCE', 'STARTUP']),
  companyName: z.string().trim().optional(),
  seatLimit: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const TYPES: { value: AccountType; label: string; hint: string; icon: typeof UserRound }[] = [
  { value: 'individual', label: 'Indépendant·e', hint: 'Freelance, porteur de projet, startup', icon: UserRound },
  { value: 'company', label: 'Entreprise', hint: 'Plusieurs postes, une équipe', icon: Building2 },
];

export function RegisterForm({ initialType }: { initialType: AccountType }) {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const registerCompany = useAuthStore((s) => s.registerCompany);
  const [type, setType] = useState<AccountType>(initialType);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extraErrors, setExtraErrors] = useState<{ companyName?: string; seatLimit?: string }>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { memberType: 'FREELANCE', seatLimit: '3' },
  });

  async function submit(values: Form) {
    setServerError(null);

    // Champs propres au compte entreprise, contrôlés ici car facultatifs pour un·e indépendant·e.
    let seatLimit = 0;
    if (type === 'company') {
      const next: typeof extraErrors = {};
      if (!values.companyName || values.companyName.length < 2) next.companyName = 'Raison sociale requise';
      seatLimit = Number(values.seatLimit);
      if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 200) next.seatLimit = 'Entre 1 et 200 postes';
      setExtraErrors(next);
      if (next.companyName || next.seatLimit) return;
    }

    setSubmitting(true);
    try {
      if (type === 'company') {
        await registerCompany({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          companyName: values.companyName!,
          seatLimit,
        });
      } else {
        await registerUser({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          memberType: values.memberType,
          phone: values.phone,
        });
      }
      router.push('/dashboard/situation');
    } catch (e) {
      setServerError(
        e instanceof ApiRequestError
          ? e.message
          : 'Problème de connexion réseau — vérifiez votre connexion internet et réessayez.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-heading text-2xl font-bold text-ink-900">Devenir membre</h1>
        <p className="mt-1 text-sm text-ink-500">
          Créez votre compte en une minute. Vous suivrez ensuite votre validation et votre devis depuis votre espace.
        </p>

        <div role="radiogroup" aria-label="Type de compte" className="mt-5 grid grid-cols-2 gap-2">
          {TYPES.map((option) => {
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(option.value)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                  active
                    ? 'border-brand-orange bg-brand-orange/[0.06] ring-1 ring-brand-orange'
                    : 'border-ink-900/12 hover:border-ink-900/25',
                )}
              >
                <span className={cn('flex items-center gap-2 text-sm font-bold', active ? 'text-brand-orange' : 'text-ink-900')}>
                  <option.icon className="h-4 w-4" /> {option.label}
                </span>
                <span className="text-xs leading-snug text-ink-500">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
            </Field>
            <Field label="Nom" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
            </Field>
          </div>

          {type === 'company' && (
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Raison sociale" htmlFor="companyName" error={extraErrors.companyName}>
                <Input id="companyName" autoComplete="organization" {...register('companyName')} />
              </Field>
              <Field label="Postes" htmlFor="seatLimit" error={extraErrors.seatLimit}>
                <Input id="seatLimit" type="number" min={1} max={200} {...register('seatLimit')} />
              </Field>
            </div>
          )}

          {type === 'individual' && (
            <Field label="Profil" htmlFor="memberType">
              <select
                id="memberType"
                className="flex h-11 w-full rounded-card border border-ink-900/15 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ink-900"
                {...register('memberType')}
              >
                <option value="FREELANCE">Freelance / porteur de projet</option>
                <option value="STARTUP">Startup</option>
              </select>
            </Field>
          )}

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
          </Field>
          <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {serverError && (
            <p role="alert" className="text-sm text-brand-orange">
              {serverError}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'Création…' : type === 'company' ? 'Créer le compte entreprise' : 'Créer mon compte'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Déjà membre ?{' '}
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-brand-orange">{error}</p>}
    </div>
  );
}
