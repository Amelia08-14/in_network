import { prisma } from '../prisma';
import { env } from '../../config/env';
import { matchingEngine, type MatchCandidate } from './engine';

const TOP_N_PER_MEMBER = 5;

async function buildCandidatePool(): Promise<MatchCandidate[]> {
  const profiles = await prisma.memberProfile.findMany({
    where: { isPublic: true, user: { isActive: true } },
    include: { tags: { include: { tag: true } } },
  });

  return profiles.map((profile) => ({
    userId: profile.userId,
    memberType: profile.memberType,
    skillsOffered: profile.tags
      .filter((t) => t.tag.category === 'SKILL' && t.relation === 'OFFER')
      .map((t) => t.tag.label),
    skillsWanted: profile.tags
      .filter((t) => t.tag.category === 'SKILL' && t.relation === 'NEED')
      .map((t) => t.tag.label),
    sectors: profile.tags
      .filter((t) => t.tag.category === 'SECTOR')
      .map((t) => t.tag.label),
  }));
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

export async function runMatchingForUser(userId: string) {
  const pool = await buildCandidatePool();
  const suggestionsWritten = await writeSuggestionsForUser(userId, pool);
  return { suggestionsWritten };
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
