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
    .trim()
    .toLowerCase();
}

const uniq = (values: string[]) => [...new Set(values.map(normalize))];

/** Part de mes besoins couverte par l'offre de l'autre (0 à 1). */
function coverage(needs: string[], offers: string[]): number {
  const wanted = uniq(needs);
  if (wanted.length === 0 || offers.length === 0) return 0;
  const offered = new Set(uniq(offers));
  return wanted.filter((need) => offered.has(need)).length / wanted.length;
}

/**
 * Domaines en commun, vus de mon côté : la part des domaines de l'autre que je
 * couvre, légèrement atténuée si je coche beaucoup de domaines. C'est
 * volontairement asymétrique : cocher « tous les domaines » me montre tous les
 * membres de ces domaines (retour client 04/11/2026 : une première version
 * pénalisait les listes larges, ce qui vidait les suggestions), mais ne
 * m'impose pas à eux, car pour eux je ne couvre qu'une petite part de mes domaines.
 */
function sharedSectors(mine: string[], theirs: string[]): number {
  const left = new Set(uniq(mine));
  const right = uniq(theirs);
  if (left.size === 0 || right.length === 0) return 0;
  const covered = right.filter((s) => left.has(s)).length / right.length;
  return covered * (0.5 + 0.5 * specificity(mine));
}

/**
 * Spécificité d'une liste de domaines : pleine jusqu'à 5 domaines, puis
 * décroissante. Un membre qui coche 30 domaines répond à toutes les recherches,
 * mais moins nettement qu'un spécialiste (30 domaines → 0,41).
 */
const specificity = (sectors: string[]) => Math.sqrt(Math.min(1, 5 / Math.max(uniq(sectors).length, 1)));

const firstCommon = (a: string[], b: string[]) => {
  const right = new Set(uniq(b));
  return a.find((value) => right.has(normalize(value)));
};

// Table de bonus fixe (CDC §8.2) — point de départ, à ajuster après
// observation des taux d'acceptation réels par tranche de score.
const COMPLEMENTARITY: Record<string, number> = {
  'FREELANCE|STARTUP': 1,
  'FREELANCE|ENTREPRISE': 0.7,
  'FREELANCE|FREELANCE': 0.3,
  'STARTUP|STARTUP': 0.3,
  'STARTUP|ENTREPRISE': 0.8,
  'ENTREPRISE|ENTREPRISE': 0.3,
};

function memberTypeComplementarity(a: MemberType, b: MemberType): number {
  const key = [a, b].sort().join('|');
  return COMPLEMENTARITY[key] ?? 0.5;
}

// Poids des critères (audit du matching, 04/11/2026). Un critère ne compte que
// si l'information existe (ex. « compétences recherchées » renseignées) : le
// score est ramené aux seuls critères applicables. Sans cela, un membre qui ne
// renseigne que ses domaines d'activité — le cas le plus courant — plafonnait
// à 30/100, sous le seuil de 40 : il ne recevait jamais de suggestion.
const WEIGHTS = {
  skillNeed: 0.3, // je recherche une compétence que l'autre propose
  sectorNeed: 0.25, // je recherche un domaine dans lequel l'autre travaille
  skillGive: 0.15, // l'autre recherche une compétence que je propose
  sectorGive: 0.2, // l'autre recherche mon domaine
  sharedSector: 0.15, // nous travaillons dans les mêmes domaines
  memberType: 0.05, // profils complémentaires (freelance ↔ startup…)
};

export function scoreMatch(me: MatchCandidate, other: MatchCandidate): number {
  const parts: [weight: number, value: number, applicable: boolean][] = [
    [WEIGHTS.skillNeed, coverage(me.skillsWanted, other.skillsOffered), me.skillsWanted.length > 0],
    [WEIGHTS.sectorNeed, coverage(me.sectorsWanted, other.sectors) * specificity(other.sectors), me.sectorsWanted.length > 0],
    [WEIGHTS.skillGive, coverage(other.skillsWanted, me.skillsOffered), other.skillsWanted.length > 0],
    [WEIGHTS.sectorGive, coverage(other.sectorsWanted, me.sectors) * specificity(me.sectors), other.sectorsWanted.length > 0],
    [WEIGHTS.sharedSector, sharedSectors(me.sectors, other.sectors), me.sectors.length > 0 && other.sectors.length > 0],
    [WEIGHTS.memberType, memberTypeComplementarity(me.memberType, other.memberType), true],
  ];
  const applicable = parts.filter(([, , ok]) => ok);
  const total = applicable.reduce((sum, [w]) => sum + w, 0);
  const value = applicable.reduce((sum, [w, v]) => sum + w * v, 0);
  // Aucun point commun réel (seul le type de profil joue) : pas de suggestion.
  const substantive = applicable.some(([w, v]) => w !== WEIGHTS.memberType && v > 0);
  return substantive && total > 0 ? Math.round((value / total) * 100) : 0;
}

function buildReason(a: MatchCandidate, b: MatchCandidate): { type: string; detail: string } {
  const needMatch = firstCommon(a.skillsWanted, b.skillsOffered);
  if (needMatch) return { type: 'skill_match', detail: `Vous recherchez « ${needMatch} », que ce membre propose` };
  const sectorNeed = firstCommon(a.sectorsWanted, b.sectors);
  if (sectorNeed) return { type: 'sector_need', detail: `Vous recherchez des contacts en « ${sectorNeed} » : c’est son domaine` };
  const offerMatch = firstCommon(a.skillsOffered, b.skillsWanted);
  if (offerMatch) return { type: 'skill_match', detail: `Ce membre recherche « ${offerMatch} », que vous proposez` };
  const sectorGive = firstCommon(a.sectors, b.sectorsWanted);
  if (sectorGive) return { type: 'sector_need', detail: `Ce membre recherche des contacts en « ${sectorGive} », votre domaine` };
  const shared = firstCommon(a.sectors, b.sectors);
  if (shared) return { type: 'sector_match', detail: `Vous travaillez tous deux en « ${shared} »` };
  return { type: 'profile_complementarity', detail: 'Profils complémentaires' };
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
