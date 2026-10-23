// Origine d'un visiteur venu d'un réseau social ou d'une campagne : à
// l'arrivée sur le site, on mémorise les paramètres du lien (utm_source,
// utm_medium, utm_campaign, utm_content), l'identifiant de clic publicitaire
// (fbclid, gclid, li_fat_id, ttclid) et le site d'où il vient. Ces
// informations accompagnent ensuite son inscription, sa demande de devis ou
// son message de contact : le lead arrive classé LinkedIn, Réseaux sociaux,
// Publicité… au lieu de « Site web » (cf. backend crm/attribution.ts).
// Dernière origine identifiée, conservée 60 jours dans ce navigateur.

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  clickId?: 'fbclid' | 'gclid' | 'li_fat_id' | 'ttclid';
  referrer?: string;
}

const KEY = 'in_attribution';
const TTL_MS = 60 * 24 * 3600 * 1000;
const CLICK_IDS = ['fbclid', 'gclid', 'li_fat_id', 'ttclid'] as const;

const clean = (value: string | null) => (value ? value.trim().slice(0, 190) || undefined : undefined);

/** À appeler à chaque arrivée sur une page : ne mémorise que si le visiteur vient d'ailleurs. */
export function captureAttribution() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const next: Attribution = {
      source: clean(params.get('utm_source')),
      medium: clean(params.get('utm_medium')),
      campaign: clean(params.get('utm_campaign')),
      content: clean(params.get('utm_content')),
      clickId: CLICK_IDS.find((id) => params.get(id)),
    };
    // Site de provenance : seulement s'il est extérieur au nôtre.
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) next.referrer = host;
    }
    if (!next.source && !next.clickId && !next.referrer) return;
    window.localStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
  } catch {
    // Stockage indisponible (navigation privée…) : l'origine n'est simplement pas suivie.
  }
}

/** Origine mémorisée (moins de 60 jours), à joindre aux formulaires qui créent un lead. */
export function getAttribution(): Attribution | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return undefined;
    const { at, ...attribution } = JSON.parse(raw) as Attribution & { at?: number };
    if (!at || Date.now() - at > TTL_MS) return undefined;
    return attribution;
  } catch {
    return undefined;
  }
}
