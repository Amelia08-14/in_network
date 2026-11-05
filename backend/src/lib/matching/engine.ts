import type { MemberType } from '../../generated/prisma/client';

export interface MatchCandidate {
  userId: string;
  skillsOffered: string[];
  skillsWanted: string[];
  /** Domaines d'activité du membre. */
  sectors: string[];
  /** Domaines recherchés : secteurs où le membre cherche clients ou partenaires. */
  sectorsWanted: string[];
  memberType: MemberType;
}

export interface ConnectionSuggestionInput {
  userId: string;
  suggestedUserId: string;
  score: number;
  reason: { type: string; detail: string };
}

// Interface stable (CDC §8.4) — remplaçable en V2 par un moteur IA
// (embeddings/LLM) sans toucher aux routes API ni au frontend.
export interface MatchingEngine {
  generateSuggestions(userId: string, pool: MatchCandidate[]): ConnectionSuggestionInput[];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Éléments de `mine` qui trouvent un écho dans `theirs`. Domaines : libellés
 * identiques (liste fermée). Compétences, saisies plus librement : un libellé
 * contenu dans l'autre suffit (« Marketing digital » ↔ « marketing »).
 */
function linked(mine: string[], theirs: string[], loose = false): string[] {
  const others = [...new Set(theirs.map(normalize))];
  const seen = new Set<string>();
  return mine.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return others.some((other) => other === key || (loose && Math.min(other.length, key.length) >= 4 && (other.includes(key) || key.includes(other))));
  });
}

// Liens entre deux membres (retour client 05/11/2026 : « tout ce qui peut les
// relier »). Chaque lien trouvé rapporte des points — le premier suffit à
// dépasser le seuil de suggestion (40), les suivants font remonter la
// suggestion (plafond 100). La version précédente faisait une MOYENNE des
// critères : plus un membre remplissait son profil, plus ses scores baissaient
// (un membre qui propose exactement la compétence recherchée obtenait 8/100).
const LINKS = {
  skillNeed: { first: 50, extra: 10 }, // je recherche une compétence qu'il propose
  sectorNeed: { first: 45, extra: 5 }, // il travaille dans un domaine que je recherche
  skillGive: { first: 45, extra: 5 }, // il recherche une compétence que je propose
  sectorGive: { first: 40, extra: 5 }, // il recherche un domaine dans lequel je travaille
  sharedSector: { first: 40, extra: 5 }, // nous travaillons dans les mêmes domaines
} as const;
const MAX_EXTRA_LINKS = 3;

// Bonus léger de complémentarité des profils (CDC §8.2), seulement s'il existe
// déjà un lien réel.
const COMPLEMENTARITY: Record<string, number> = {
  'FREELANCE|STARTUP': 5,
  'ENTREPRISE|FREELANCE': 4,
  'ENTREPRISE|STARTUP': 4,
};

function memberTypeBonus(a: MemberType, b: MemberType): number {
  return COMPLEMENTARITY[[a, b].sort().join('|')] ?? 2;
}

function links(me: MatchCandidate, other: MatchCandidate) {
  return {
    skillNeed: linked(me.skillsWanted, other.skillsOffered, true),
    sectorNeed: linked(me.sectorsWanted, other.sectors),
    skillGive: linked(me.skillsOffered, other.skillsWanted, true),
    sectorGive: linked(me.sectors, other.sectorsWanted),
    sharedSector: linked(me.sectors, other.sectors),
  };
}

export function scoreMatch(me: MatchCandidate, other: MatchCandidate): number {
  const found = links(me, other);
  let score = 0;
  for (const [key, values] of Object.entries(found) as [keyof typeof LINKS, string[]][]) {
    if (values.length === 0) continue;
    score += LINKS[key].first + LINKS[key].extra * Math.min(values.length - 1, MAX_EXTRA_LINKS);
  }
  if (score === 0) return 0;
  return Math.min(100, score + memberTypeBonus(me.memberType, other.memberType));
}

function buildReason(me: MatchCandidate, other: MatchCandidate): { type: string; detail: string } {
  const found = links(me, other);
  const list = (values: string[]) => values.slice(0, 2).map((v) => `« ${v} »`).join(', ') + (values.length > 2 ? '…' : '');
  const parts: string[] = [];
  if (found.skillNeed.length) parts.push(`propose ${list(found.skillNeed)}, que vous recherchez`);
  if (found.sectorNeed.length) parts.push(`travaille en ${list(found.sectorNeed)}, un domaine que vous recherchez`);
  if (found.skillGive.length) parts.push(`recherche ${list(found.skillGive)}, que vous proposez`);
  if (found.sectorGive.length) parts.push(`recherche des contacts en ${list(found.sectorGive)}, votre domaine`);
  if (found.sharedSector.length && parts.length < 2) parts.push(`travaille comme vous en ${list(found.sharedSector)}`);
  const type = found.skillNeed.length || found.skillGive.length ? 'skill_match' : found.sectorNeed.length || found.sectorGive.length ? 'sector_need' : 'sector_match';
  return parts.length ? { type, detail: `Ce membre ${parts.slice(0, 2).join(' ; ')}` } : { type: 'profile_complementarity', detail: 'Profils complémentaires' };
}

export class RuleBasedMatchingEngine implements MatchingEngine {
  generateSuggestions(userId: string, pool: MatchCandidate[]): ConnectionSuggestionInput[] {
    const me = pool.find((c) => c.userId === userId);
    if (!me) return [];

    return pool
      .filter((other) => other.userId !== userId)
      .map((other) => ({
        userId,
        suggestedUserId: other.userId,
        score: scoreMatch(me, other),
        reason: buildReason(me, other),
      }))
      .filter((suggestion) => suggestion.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

// V2 : export class AIMatchingEngine implements MatchingEngine { ... }
export const matchingEngine: MatchingEngine = new RuleBasedMatchingEngine();
