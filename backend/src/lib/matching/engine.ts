import type { MemberType } from '../../generated/prisma/client';

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

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function coverage(needs: string[], offers: string[]): number {
  if (needs.length === 0 || offers.length === 0) return 0;
  const normalizedOffers = new Set(offers.map(normalize));
  const matches = needs.map(normalize).filter((need) => normalizedOffers.has(need));
  return matches.length / new Set(needs.map(normalize)).size;
}

function sectorOverlap(a: MatchCandidate, b: MatchCandidate): number {
  const otherSectors = new Set(b.sectors.map(normalize));
  return a.sectors.some((sector) => otherSectors.has(normalize(sector))) ? 1 : 0;
}

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

function buildReason(a: MatchCandidate, b: MatchCandidate): { type: string; detail: string } {
  const offeredByB = new Set(b.skillsOffered.map(normalize));
  const wantedByB = new Set(b.skillsWanted.map(normalize));
  const needMatch = a.skillsWanted.find((skill) => offeredByB.has(normalize(skill)));
  if (needMatch) {
    return { type: 'skill_match', detail: `Tu recherches "${needMatch}", que ce membre propose` };
  }
  const offerMatch = a.skillsOffered.find((skill) => wantedByB.has(normalize(skill)));
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
          0.45 * coverage(me.skillsWanted, other.skillsOffered) +
          0.25 * coverage(other.skillsWanted, me.skillsOffered) +
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
