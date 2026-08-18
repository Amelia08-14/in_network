'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, PartyPopper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

const registerSchema = z
  .object({
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    phone: z.string().optional(),
    memberType: z.enum(['FREELANCE', 'STARTUP', 'ENTREPRISE']),
    companyName: z.string().optional(),
    jobTitle: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
type RegisterForm = z.infer<typeof registerSchema>;

const STEPS = [
  { id: 'account', title: 'Compte', fields: ['email', 'password', 'confirmPassword'] as const },
  { id: 'identity', title: 'Identité', fields: ['firstName', 'lastName', 'phone'] as const },
  { id: 'activity', title: 'Activité', fields: ['memberType', 'companyName', 'jobTitle'] as const },
];

const MEMBER_TYPES = [
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
];

export default function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register);
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [finalStepReady, setFinalStepReady] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { memberType: 'FREELANCE' },
  });

  async function goNext() {
    const valid = await trigger(STEPS[step].fields as never);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  useEffect(() => {
    if (step !== STEPS.length - 1) {
      setFinalStepReady(false);
      return;
    }

    // Empêche le clic sur « Suivant » (ou un double-clic) d'être rejoué sur
    // le bouton de création qui apparaît exactement au même emplacement.
    const timer = window.setTimeout(() => setFinalStepReady(true), 400);
    return () => window.clearTimeout(timer);
  }, [step]);

  async function createAccount(values: RegisterForm) {
    setServerError(null);
    setSubmitting(true);
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        memberType: values.memberType,
        phone: values.phone,
      });

      if (values.companyName || values.jobTitle) {
        await api.put('/api/profiles/me', {
          companyName: values.companyName || undefined,
          jobTitle: values.jobTitle || undefined,
        });
      }

      setDone(true);
    } catch (e) {
      setServerError(e instanceof ApiRequestError ? e.message : "Une erreur est survenue");
      setSubmitting(false);
    }
  }

  async function handleStepSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < STEPS.length - 1) {
      await goNext();
      return;
    }

    if (!finalStepReady || submitting) return;

    await handleSubmit(createAccount)();
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
            <PartyPopper className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Merci pour ton inscription !</h1>
          <p className="max-w-sm text-sm text-gray-500">
            Ton compte IN NETWORK a bien été créé. Notre équipe revient vers toi très prochainement.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="font-heading text-2xl font-bold text-brand-violet-dark">Devenir membre</h1>
        <p className="mt-1 text-sm text-gray-500">Crée ton profil en {STEPS.length} étapes.</p>

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
                      : 'bg-gray-100 text-gray-400',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-0.5 flex-1 bg-gray-100" />}
            </div>
          ))}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleStepSubmit}>
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-brand-orange">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="mt-1 text-xs text-brand-orange">{errors.password.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-brand-orange">{errors.confirmPassword.message}</p>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-brand-orange">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-brand-orange">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone (optionnel)</Label>
                <Input id="phone" {...register('phone')} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label htmlFor="memberType">Type de profil</Label>
                <Select id="memberType" {...register('memberType')}>
                  {MEMBER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="companyName">Entreprise (optionnel)</Label>
                <Input id="companyName" {...register('companyName')} />
              </div>
              <div>
                <Label htmlFor="jobTitle">Poste / activité (optionnel)</Label>
                <Input id="jobTitle" {...register('jobTitle')} />
              </div>
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
              <Button type="submit" variant="primary" className="flex-1" disabled={!finalStepReady || submitting}>
                {submitting ? 'Création...' : 'Créer mon compte'}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà membre ?{' '}
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
