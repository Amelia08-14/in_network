import { prisma } from '../prisma';
import { env } from '../../config/env';
import { matchingEngine, type MatchCandidate } from './engine';
import { canonicalSector } from './sectorAliases';

// Suggestions gardées par membre (10 depuis le 05/11/2026 : « tout ce qui peut les relier »).
const TOP_N_PER_MEMBER = 10;

type ProfileWithTags = {
  userId: string;
  memberType: MatchCandidate['memberType'];
  tags: { relation: string; tag: { label: string; category: string } }[];
};

/** Domaines d'un profil, anciennes saisies libres traduites vers le référentiel. */
const sectorLabels = (profile: ProfileWithTags, relation: 'OFFER' | 'NEED') => [
  ...new Set(
    profile.tags
      .filter((t) => t.tag.category === 'SECTOR' && t.relation === relation)
      .map((t) => canonicalSector(t.tag.label))
      .filter((label): label is string => Boolean(label)),
  ),
];

/** Ce que le moteur voit d'un profil (partagé avec prisma/matching-diagnostic.ts). */
export function toCandidate(profile: ProfileWithTags): MatchCandidate {
  return {
    userId: profile.userId,
    memberType: profile.memberType,
    skillsOffered: profile.tags.filter((t) => t.tag.category === 'SKILL' && t.relation === 'OFFER').map((t) => t.tag.label),
    skillsWanted: profile.tags.filter((t) => t.tag.category === 'SKILL' && t.relation === 'NEED').map((t) => t.tag.label),
    // Domaines d'activité (OFFER) et domaines recherchés (NEED), distingués depuis le 04/11/2026.
    sectors: sectorLabels(profile, 'OFFER'),
    sectorsWanted: sectorLabels(profile, 'NEED'),
  };
}

async function buildCandidatePool(): Promise<MatchCandidate[]> {
  const profiles = await prisma.memberProfile.findMany({
    where: { isPublic: true, user: { isActive: true } },
    select: { userId: true, memberType: true, tags: { select: { relation: true, tag: { select: { label: true, category: true } } } } },
  });
  return profiles.map(toCandidate);
}

async function writeSuggestionsForUser(userId: string, pool: MatchCandidate[]) {
  const blockedRelations = await prisma.connectionRequest.findMany({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    select: { fromUserId: true, toUserId: true },
  });
  const blockedUserIds = new Set(
    blockedRelations.map((request) =>
      request.fromUserId === userId ? request.toUserId : request.fromUserId,
    ),
  );
  const suggestions = matchingEngine
    .generateSuggestions(userId, pool)
    .filter((suggestion) => suggestion.score >= env.matchingScoreThreshold)
    .filter((suggestion) => !blockedUserIds.has(suggestion.suggestedUserId))
    .slice(0, TOP_N_PER_MEMBER);

  // Les suggestions encore « nouvelles » qui ne font plus partie du classement
  // (profil modifié, membre parti) sont retirées ; celles que le membre a déjà
  // vues, contactées ou écartées sont conservées.
  await prisma.connectionSuggestion.deleteMany({
    where: { userId, status: 'NEW', suggestedUserId: { notIn: suggestions.map((s) => s.suggestedUserId) } },
  });

  for (const suggestion of suggestions) {
    await prisma.connectionSuggestion.upsert({
      where: {
        userId_suggestedUserId: {
          userId: suggestion.userId,
          suggestedUserId: suggestion.suggestedUserId,
        },
      },
      update: {
        score: suggestion.score,
        reason: suggestion.reason,
        generatedAt: new Date(),
      },
      create: suggestion,
    });
  }
  return suggestions.length;
}

/**
 * Recalcul pour un membre. Le résultat dit aussi POURQUOI la liste peut rester
 * vide : profil pas encore validé (hors réservoir), aucun autre membre validé,
 * ou aucun point commun suffisant — l'espace membre l'explique au lieu d'un
 * message générique.
 */
export async function runMatchingForUser(userId: string) {
  const pool = await buildCandidatePool();
  const inPool = pool.some((c) => c.userId === userId);
  const suggestionsWritten = inPool ? await writeSuggestionsForUser(userId, pool) : 0;
  return { suggestionsWritten, inPool, othersInPool: pool.filter((c) => c.userId !== userId).length };
}

// CDC §8.3 — recalcul planifié (nuit) plutôt qu'à la volée à chaque visite,
// pour ne pas imposer une charge de calcul inutile sur un facteur qui ne
// varie pas d'une minute à l'autre.
export async function runMatchingJob(): Promise<{ usersProcessed: number; suggestionsWritten: number }> {
  const pool = await buildCandidatePool();
  let suggestionsWritten = 0;

  for (const candidate of pool) {
    suggestionsWritten += await writeSuggestionsForUser(candidate.userId, pool);
  }

  return { usersProcessed: pool.length, suggestionsWritten };
}
