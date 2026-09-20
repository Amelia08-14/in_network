// Palette de couleurs fonctionnelles du site et du back-office : une teinte
// = un sens (catégorie de service, étape du pipeline, type de KPI…), jamais de
// la décoration gratuite. Les classes Tailwind sont écrites en toutes lettres
// pour être détectées au build. Pas de violet dans la charte.

export type Hue = 'blue' | 'orange' | 'green' | 'amber' | 'ink' | 'teal' | 'red' | 'gray';

export interface HueStyle {
  /** Fond plein (barres, pastilles, pucks). */
  solid: string;
  /** Fond teinté léger (cartes, chips). */
  soft: string;
  /** Fond teinté très léger (bandeaux de section). */
  wash: string;
  /** Texte lisible sur fond clair. */
  text: string;
  /** Bordure discrète. */
  border: string;
  /** Bordure gauche épaisse (lignes de liste). */
  edge: string;
  /** Valeur hexadécimale pour les graphiques (recharts). */
  hex: string;
}

export const HUE: Record<Hue, HueStyle> = {
  blue: { solid: 'bg-brand-blue', soft: 'bg-brand-blue/10', wash: 'bg-brand-blue/[0.04]', text: 'text-brand-blue', border: 'border-brand-blue/25', edge: 'border-l-brand-blue', hex: '#1D4ED8' },
  orange: { solid: 'bg-brand-orange', soft: 'bg-brand-orange/10', wash: 'bg-brand-orange/[0.04]', text: 'text-brand-orange', border: 'border-brand-orange/25', edge: 'border-l-brand-orange', hex: '#D44835' },
  green: { solid: 'bg-accent-green', soft: 'bg-accent-green/20', wash: 'bg-accent-green/[0.08]', text: 'text-green-700', border: 'border-accent-green/40', edge: 'border-l-accent-green', hex: '#73B866' },
  amber: { solid: 'bg-accent-yellow', soft: 'bg-accent-yellow/25', wash: 'bg-accent-yellow/[0.10]', text: 'text-amber-700', border: 'border-accent-yellow/50', edge: 'border-l-accent-yellow', hex: '#F0A92E' },
  ink: { solid: 'bg-ink-700', soft: 'bg-ink-900/8', wash: 'bg-ink-900/[0.03]', text: 'text-ink-800', border: 'border-ink-900/15', edge: 'border-l-ink-700', hex: '#2B3B54' },
  teal: { solid: 'bg-teal-600', soft: 'bg-teal-600/10', wash: 'bg-teal-600/[0.05]', text: 'text-teal-700', border: 'border-teal-600/25', edge: 'border-l-teal-600', hex: '#0F766E' },
  red: { solid: 'bg-red-600', soft: 'bg-red-100', wash: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', edge: 'border-l-red-500', hex: '#DC2626' },
  gray: { solid: 'bg-ink-400', soft: 'bg-ink-900/6', wash: 'bg-ink-900/[0.02]', text: 'text-ink-600', border: 'border-ink-900/10', edge: 'border-l-ink-400', hex: '#94A3B8' },
};

// Teinte → bandeau coloré d'une <Card accent=…>.
export const HUE_ACCENT: Record<Hue, 'orange' | 'blue' | 'green' | 'yellow' | 'teal' | 'ink' | 'none'> = {
  blue: 'blue',
  orange: 'orange',
  green: 'green',
  amber: 'yellow',
  teal: 'teal',
  ink: 'ink',
  red: 'orange',
  gray: 'none',
};

// Catégories du catalogue de services → teinte.
export const SERVICE_HUE: Record<string, Hue> = {
  SECRETARIAT: 'green',
  ADMINISTRATION: 'blue',
  CREATION_ENTREPRISE: 'orange',
  JURIDIQUE: 'ink',
  COMPTABILITE: 'amber',
  MARKETING: 'teal',
  DOMICILIATION: 'blue',
  AUTRE: 'gray',
};

// Formules d'abonnement (par nom) → teinte.
export function planHue(name: string): Hue {
  const n = name.toLowerCase();
  if (n.includes('domiciliation')) return 'blue';
  if (n.includes('open space')) return 'orange';
  if (n.includes('privatif')) return 'green';
  if (n.includes('casier')) return 'amber';
  return 'ink';
}

// Types de ligne d'une demande de devis qui ne sont pas des services du catalogue.
export const CART_KIND_HUE: Record<string, Hue> = { PLAN: 'blue', SPACE: 'teal' };
