'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Check, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
    companyName: z.string().min(2, 'Raison sociale requise'),
    sector: z.string().optional(),
    website: z.string().optional(),
    seatLimit: z.coerce
      .number({ invalid_type_error: 'Indiquez un nombre' })
      .int('Nombre entier')
      .min(1, 'Au moins 1 poste')
      .max(200, 'Maximum 200 postes'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
type Form = z.infer<typeof schema>;

const STEPS = [
  { id: 'account', title: 'Compte', fields: ['email', 'password', 'confirmPassword'] as const },
  { id: 'contact', title: 'Représentant', fields: ['firstName', 'lastName', 'phone', 'jobTitle'] as const },
  { id: 'company', title: 'Entreprise', fields: ['companyName', 'sector', 'website', 'seatLimit'] as const },
];

export default function RegisterCompanyPage() {
  const registerCompany = useAuthStore((s) => s.registerCompany);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Anti double-clic : « Suivant » et « Créer le compte » apparaissent au même
  // endroit — on ignore une soumission dans les 400 ms suivant l'arrivée sur
  // la dernière étape (un ref, pas un state, pour ne pas cascader de renders).
  const lastStepAt = useRef(0);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { seatLimit: 3 },
  });

  async function goNext() {
    const valid = await trigger(STEPS[step].fields as never);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  useEffect(() => {
    if (step === STEPS.length - 1) lastStepAt.current = Date.now();
  }, [step]);

  async function submit(values: Form) {
    setServerError(null);
    setSubmitting(true);
    try {
      await registerCompany({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        jobTitle: values.jobTitle || undefined,
        companyName: values.companyName,
        sector: values.sector || undefined,
        website: values.website || undefined,
        seatLimit: values.seatLimit,
      });
      router.push('/dashboard/equipe');
    } catch (e) {
      setServerError(
        e instanceof ApiRequestError
          ? e.message
          : 'Problème de connexion réseau — vérifie ta connexion internet et réessaie.',
      );
      setSubmitting(false);
    }
  }

  async function handleStepSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      await goNext();
      return;
    }
    if (submitting || Date.now() - lastStepAt.current < 400) return;
    await handleSubmit(submit)();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2.5 text-brand-orange">
          <Building2 className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Compte entreprise</span>
        </div>
        <h1 className="mt-3 font-heading text-2xl font-bold text-ink-900">Inscrire mon entreprise</h1>
        <p className="mt-1 text-sm text-ink-500">
          Créez le compte de votre entreprise, choisissez le nombre de postes, puis invitez vos
          collaborateurs depuis votre tableau de bord.
        </p>

        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  i < step
                    ? 'bg-accent-green text-white'
                    : i === step
                      ? 'bg-brand-orange text-white'
                      : 'bg-ink-900/8 text-ink-400',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-0.5 flex-1 bg-ink-900/8" />}
            </div>
          ))}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleStepSubmit}>
          {step === 0 && (
            <>
              <Field label="Email professionnel" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field label="Mot de passe" error={errors.password?.message}>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirmer le mot de passe" error={errors.confirmPassword?.message}>
                <Input type={showPassword ? 'text' : 'password'} {...register('confirmPassword')} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom" error={errors.firstName?.message}>
                  <Input {...register('firstName')} />
                </Field>
                <Field label="Nom" error={errors.lastName?.message}>
                  <Input {...register('lastName')} />
                </Field>
              </div>
              <Field label="Téléphone (optionnel)">
                <Input {...register('phone')} />
              </Field>
              <Field label="Votre fonction (optionnel)">
                <Input placeholder="Dirigeant·e, DRH, Office Manager…" {...register('jobTitle')} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Raison sociale" error={errors.companyName?.message}>
                <Input {...register('companyName')} />
              </Field>
              <Field label="Secteur d'activité (optionnel)">
                <Input {...register('sector')} />
              </Field>
              <Field label="Site web (optionnel)">
                <Input placeholder="exemple.dz" {...register('website')} />
              </Field>
              <Field
                label="Nombre de postes"
                error={errors.seatLimit?.message}
                hint="Vous compris. Vous pourrez ajuster ce nombre plus tard depuis votre tableau de bord."
              >
                <Input type="number" min={1} max={200} {...register('seatLimit')} />
              </Field>
            </>
          )}

          {serverError && <p className="text-sm text-brand-orange">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
                Précédent
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" className="flex-1" onClick={goNext}>
                Suivant
              </Button>
            ) : (
              <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le compte entreprise'}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Vous êtes indépendant·e ?{' '}
          <Link href="/register" className="font-medium text-brand-blue hover:underline">
            Inscription individuelle
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-brand-orange">{error}</p>}
    </div>
  );
}
