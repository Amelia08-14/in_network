import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import type { SuggestionStatus, ConnectionRequestStatus } from '@prisma/client';

export async function listMySuggestions(userId: string) {
  return prisma.connectionSuggestion.findMany({
    where: { userId },
    include: {
      suggestedUser: { include: { profile: true } },
    },
    orderBy: { score: 'desc' },
  });
}

export async function updateSuggestionStatus(userId: string, id: string, status: SuggestionStatus) {
  const suggestion = await prisma.connectionSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.userId !== userId) throw ApiError.notFound('Suggestion introuvable');

  return prisma.connectionSuggestion.update({ where: { id }, data: { status } });
}

export async function listMyConnectionRequests(userId: string) {
  const [received, sent] = await Promise.all([
    prisma.connectionRequest.findMany({
      where: { toUserId: userId },
      include: { fromUser: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.connectionRequest.findMany({
      where: { fromUserId: userId },
      include: { toUser: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { received, sent };
}

export async function createConnectionRequest(fromUserId: string, toUserId: string, message: string) {
  if (fromUserId === toUserId) throw ApiError.badRequest('Impossible de se contacter soi-même');

  const target = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!target || !target.isActive) throw ApiError.notFound('Membre introuvable');

  const request = await prisma.connectionRequest.create({
    data: { fromUserId, toUserId, message },
  });

  await prisma.notification.create({
    data: {
      userId: toUserId,
      type: 'connection_request',
      title: 'Nouvelle demande de mise en relation',
      body: message,
    },
  });

  return request;
}

// CDC §6.2 — quand une demande est acceptée, les deux profils reçoivent les
// coordonnées de contact complètes de l'autre (email visible), jusque-là masquées.
export async function respondToConnectionRequest(
  userId: string,
  id: string,
  status: ConnectionRequestStatus,
) {
  const request = await prisma.connectionRequest.findUnique({ where: { id } });
  if (!request || request.toUserId !== userId) throw ApiError.notFound('Demande introuvable');
  if (request.status !== 'PENDING') throw ApiError.conflict('Cette demande a déjà reçu une réponse');

  const updated = await prisma.connectionRequest.update({ where: { id }, data: { status } });

  if (status === 'ACCEPTED') {
    await prisma.notification.create({
      data: {
        userId: request.fromUserId,
        type: 'connection_accepted',
        title: 'Demande de mise en relation acceptée',
        body: 'Vous pouvez désormais échanger vos coordonnées.',
      },
    });
  }

  return updated;
}

export async function hasAcceptedConnection(userIdA: string, userIdB: string): Promise<boolean> {
  const accepted = await prisma.connectionRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: userIdA, toUserId: userIdB },
        { fromUserId: userIdB, toUserId: userIdA },
      ],
    },
  });
  return Boolean(accepted);
}
