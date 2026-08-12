'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

type InquiryTargetType = 'SERVICE' | 'SPACE' | 'PLAN';

export interface InquiryOption {
  /** Identifiant unique de l'entrée dans la liste (peut différer de targetId :
   * plusieurs paliers d'un même service partagent le même targetId). */
  key: string;
  label: string;
  targetId: string;
  /** Pré-rempli le champ message quand cette option est choisie (ex: le nom
   * du palier) — la demande envoyée ne cible que le service, pas un palier
   * précis côté backend, donc c'est ce qui porte cette précision. */
  noteHint?: string;
  subOptions?: Array<{
    key: string;
    label: string;
    noteHint?: string;
  }>;
}

interface InquiryFormProps {
  targetType: InquiryTargetType;
  targetId: string;
  /** Quand fourni, remplace la cible fixe par un <select> : le visiteur choisit
   * lui-même parmi ces options (ex: "quel service ?", paliers inclus). */
  options?: InquiryOption[];
  ctaLabel?: string;
  ctaVariant?: 'primary' | 'secondary' | 'outline' | 'link';
  ctaSize?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Destination pour un visiteur non connecté (défaut /login). Pour une
   * formule d'abonnement (targetType PLAN), passer /register : choisir une
   * formule implique de créer un compte, pas de se connecter à un compte
   * existant. */
  loggedOutHref?: string;
}

const TARGET_FIELD: Record<InquiryTargetType, 'serviceId' | 'spaceId' | 'planId'> = {
  SERVICE: 'serviceId',
  SPACE: 'spaceId',
  PLAN: 'planId',
};

// Formulaire "Demander" générique — services entrepreneuriaux, espaces
// (salles de réunion) ou formules d'abonnement, cf. POST /api/services/requests
// (backend/src/modules/services/services.routes.ts). Réservé aux membres
// connectés (retour QA E2E#3/#5 : le mode "invité" a été retiré — un visiteur
// non connecté est renvoyé vers /login au lieu de pouvoir soumettre).
export function InquiryForm({ targetType, targetId, options, ctaLabel = 'Demander', ctaVariant = 'primary', ctaSize = 'lg', className, loggedOutHref = '/login' }: InquiryFormProps) {
  const user = useAuthStore((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState(() => options?.[0]?.key ?? targetId);
  const [selectedSubOptionKey, setSelectedSubOptionKey] = useState(
    () => options?.[0]?.subOptions?.[0]?.key ?? '',
  );
  const [notes, setNotes] = useState('');
  const activeOption = options?.find((o) => o.key === selectedOptionKey);
  const activeSubOption = activeOption?.subOptions?.find((o) => o.key === selectedSubOptionKey);
  const activeTargetId = options && options.length > 0 ? (activeOption?.targetId ?? targetId) : targetId;

  function handleOptionChange(key: string) {
    setSelectedOptionKey(key);
    const opt = options?.find((o) => o.key === key);
    setSelectedSubOptionKey(opt?.subOptions?.[0]?.key ?? '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/api/services/requests', {
        targetType,
        [TARGET_FIELD[targetType]]: activeTargetId,
        notes: [
          activeSubOption?.noteHint ?? activeOption?.noteHint,
          notes.trim() || undefined,
        ].filter(Boolean).join('\n\n') || undefined,
      });
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Impossible d'envoyer la demande, réessaie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <Card accent="green" className={className}>
        <CardContent className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" />
          <p className="text-sm text-ink-700">Demande envoyée — l&apos;équipe IN NETWORK te recontacte rapidement.</p>
        </CardContent>
      </Card>
    );
  }

  // Visiteur non connecté : on ne montre jamais le formulaire.
  if (!user) {
    return (
      <Link
        href={loggedOutHref}
        className={cn(buttonVariants({ variant: ctaVariant, size: ctaSize }), className)}
        title="Connecte-toi pour envoyer une demande"
      >
        {ctaLabel}
      </Link>
    );
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className={cn(buttonVariants({ variant: ctaVariant, size: ctaSize }), className)}>
        {ctaLabel}
      </button>
    );
  }

  return (
    <Card className={cn('w-full sm:max-w-md', className)}>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {options && options.length > 0 && (
            <div>
              <Label htmlFor="inquiry-target-select">Service concerné</Label>
              <Select
                id="inquiry-target-select"
                value={selectedOptionKey}
                onChange={(e) => handleOptionChange(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {activeOption?.subOptions && activeOption.subOptions.length > 0 && (
            <div>
              <Label htmlFor="inquiry-sub-service-select">Sous-service / formule</Label>
              <Select
                id="inquiry-sub-service-select"
                value={selectedSubOptionKey}
                onChange={(e) => setSelectedSubOptionKey(e.target.value)}
              >
                {activeOption.subOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-ink-500">
                Le tarif sélectionné sera joint automatiquement à votre demande.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor={`${activeTargetId}-notes`}>Message (optionnel)</Label>
            <Textarea
              id={`${activeTargetId}-notes`}
              rows={3}
              placeholder="Précise ta demande, tes disponibilités..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-brand-orange">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
