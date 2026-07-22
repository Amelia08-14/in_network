import type { MemberType } from '@prisma/client';

export interface MatchCandidate {
  userId: string;
  skillsOffered: string[];
  skillsWanted: string[];
  sectors: string[];
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

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function sectorOverlap(a: MatchCandidate, b: MatchCandidate): number {
  return a.sectors.some((s) => b.sectors.includes(s)) ? 1 : 0;
}

// Table de bonus fixe (CDC §8.2) — point de départ, à ajuster après
// observation des taux d'acceptation réels par tranche de score.
const COMPLEMENTARITY: Record<string, number> = {
  'FREELANCE|STARTUP': 1,
  'FREELANCE|PME': 0.7,
  'FREELANCE|DIASPORA': 0.6,
  'FREELANCE|AUTRE': 0.4,
  'FREELANCE|FREELANCE': 0.3,
  'STARTUP|STARTUP': 0.3,
  'STARTUP|PME': 0.8,
  'STARTUP|DIASPORA': 0.6,
  'STARTUP|AUTRE': 0.4,
  'PME|PME': 0.3,
  'PME|DIASPORA': 0.5,
  'PME|AUTRE': 0.4,
  'DIASPORA|DIASPORA': 0.3,
  'DIASPORA|AUTRE': 0.4,
  'AUTRE|AUTRE': 0.3,
};

function memberTypeComplementarity(a: MemberType, b: MemberType): number {
  const key = [a, b].sort().join('|');
  return COMPLEMENTARITY[key] ?? 0.5;
}

function buildReason(a: MatchCandidate, b: MatchCandidate): { type: string; detail: string } {
  const needMatch = a.skillsWanted.find((skill) => b.skillsOffered.includes(skill));
  if (needMatch) {
    return { type: 'skill_match', detail: `Tu recherches "${needMatch}", que ce membre propose` };
  }
  const offerMatch = a.skillsOffered.find((skill) => b.skillsWanted.includes(skill));
  if (offerMatch) {
    return { type: 'skill_match', detail: `Ce membre recherche "${offerMatch}", que tu proposes` };
  }
  if (sectorOverlap(a, b)) {
    return { type: 'sector_match', detail: 'Vous partagez le même secteur d\'activité' };
  }
  return { type: 'profile_complementarity', detail: 'Profils complémentaires' };
}

export class RuleBasedMatchingEngine implements MatchingEngine {
  generateSuggestions(userId: string, pool: MatchCandidate[]): ConnectionSuggestionInput[] {
    const me = pool.find((c) => c.userId === userId);
    if (!me) return [];

    const scored = pool
      .filter((other) => other.userId !== userId)
      .map((other) => {
        const score =
          0.35 * jaccard(me.skillsWanted, other.skillsOffered) +
          0.35 * jaccard(me.skillsOffered, other.skillsWanted) +
          0.2 * sectorOverlap(me, other) +
          0.1 * memberTypeComplementarity(me.memberType, other.memberType);

        return {
          userId,
          suggestedUserId: other.userId,
          score: Math.round(score * 100),
          reason: buildReason(me, other),
        };
      })
      .sort((a, b) => b.score - a.score);

    return scored;
  }
}

// V2 : export class AIMatchingEngine implements MatchingEngine { ... }
export const matchingEngine: MatchingEngine = new RuleBasedMatchingEngine();
