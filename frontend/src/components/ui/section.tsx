import { cn } from '@/lib/utils';
import { Container } from './container';
import { NetworkMotif, type MotifVariant } from './network-motif';

type SectionTone = 'paper' | 'tint' | 'navy' | 'orange';

const TONE: Record<SectionTone, string> = {
  paper: 'bg-brand-paper text-ink-700',
  tint: 'bg-brand-paper-deep text-ink-700',
  navy: 'bg-ink-900 text-white/80',
  orange: 'bg-brand-orange text-white',
};

/**
 * Bloc de section unifié : rythme vertical constant, largeur de contenu
 * unifiée (Container), et — sur les fonds sombres/orange — la texture
 * « réseau » signature en filigrane. La profondeur navy structurelle (pas
 * seulement le footer) est un retour client explicite.
 */
export function Section({
  children,
  tone = 'paper',
  motif,
  motifVariant = 'sparse',
  bleed = false,
  className,
  containerClassName,
  id,
}: {
  children: React.ReactNode;
  tone?: SectionTone;
  /** Affiche la texture réseau en fond (auto sur navy/orange). */
  motif?: boolean;
  motifVariant?: MotifVariant;
  /** true = contenu pleine largeur (pas de Container). */
  bleed?: boolean;
  className?: string;
  containerClassName?: string;
  id?: string;
}) {
  const showMotif = motif ?? (tone === 'navy' || tone === 'orange');

  return (
    <section
      id={id}
      className={cn('relative isolate overflow-hidden py-20 md:py-28', TONE[tone], className)}
    >
      {showMotif && (
        <NetworkMotif
          tone="white"
          variant={motifVariant}
          className="pointer-events-none absolute -right-24 -top-16 h-[420px] w-[560px] opacity-[0.12]"
        />
      )}
      {bleed ? children : <Container className={cn('relative', containerClassName)}>{children}</Container>}
    </section>
  );
}

/**
 * En-tête de section homogène : eyebrow + titre display + chapô optionnel.
 * Bascule automatiquement de palette selon `tone`.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  tone = 'paper',
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  tone?: 'paper' | 'navy';
  align?: 'left' | 'center';
  className?: string;
}) {
  const dark = tone === 'navy';
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center [&_.eyebrow-line]:mx-auto',
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            'flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]',
            align === 'center' && 'justify-center',
            dark ? 'text-white/55' : 'text-ink-500',
          )}
        >
          <span className="eyebrow-line h-px w-8 bg-brand-orange" />
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          'mt-4 font-heading text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.03em]',
          dark ? 'text-white' : 'text-ink-900',
        )}
      >
        {title}
      </h2>
      {lead && (
        <p className={cn('mt-4 text-base leading-relaxed md:text-lg', dark ? 'text-white/65' : 'text-ink-500')}>
          {lead}
        </p>
      )}
    </div>
  );
}
