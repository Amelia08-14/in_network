import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';

// Messagerie entre membres (demande client 19/10/2026) : une mise en relation
// acceptée (ConnectionRequest ACCEPTED) ouvre une conversation privée entre les
// deux membres. Le fil EST la demande acceptée — voir le modèle Message.

const PEER_SELECT = {
  id: true,
  isActive: true,
  profile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      companyName: true,
      avatarUrl: true,
      companyLogoUrl: true,
    },
  },
} as const;

type Peer = {
  id: string;
  isActive: boolean;
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    companyName: string | null;
    avatarUrl: string | null;
    companyLogoUrl: string | null;
  } | null;
};

function peerView(peer: Peer) {
  return {
    userId: peer.id,
    profileId: peer.profile?.id ?? null,
    name: peer.profile ? `${peer.profile.firstName} ${peer.profile.lastName}`.trim() : 'Membre IN NETWORK',
    jobTitle: peer.profile?.jobTitle ?? null,
    companyName: peer.profile?.companyName ?? null,
    avatarUrl: peer.profile?.avatarUrl ?? null,
    companyLogoUrl: peer.profile?.companyLogoUrl ?? null,
    isActive: peer.isActive,
  };
}

/** La mise en relation acceptée dont `userId` est l'une des deux parties, sinon 404. */
async function loadConnection(userId: string, connectionId: string) {
  const connection = await prisma.connectionRequest.findUnique({
    where: { id: connectionId },
    include: { fromUser: { select: PEER_SELECT }, toUser: { select: PEER_SELECT } },
  });
  const involved = connection && (connection.fromUserId === userId || connection.toUserId === userId);
  if (!connection || !involved || connection.status !== 'ACCEPTED') {
    throw ApiError.notFound('Conversation introuvable');
  }
  const peer = connection.fromUserId === userId ? connection.toUser : connection.fromUser;
  return { connection, peer };
}

export async function listConversations(userId: string) {
  const connections = await prisma.connectionRequest.findMany({
    where: { status: 'ACCEPTED', OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include: { fromUser: { select: PEER_SELECT }, toUser: { select: PEER_SELECT } },
  });
  if (connections.length === 0) return [];

  const ids = connections.map((c) => c.id);
  const [unread, lastMessages] = await Promise.all([
    prisma.message.groupBy({
      by: ['connectionId'],
      where: { connectionId: { in: ids }, senderId: { not: userId }, readAt: null },
      _count: { _all: true },
    }),
    Promise.all(
      ids.map((connectionId) =>
        prisma.message.findFirst({ where: { connectionId }, orderBy: { createdAt: 'desc' }, select: { body: true, senderId: true, createdAt: true } }),
      ),
    ),
  ]);
  const unreadById = new Map(unread.map((row) => [row.connectionId, row._count._all]));

  return connections
    .map((connection, index) => {
      const peer = connection.fromUserId === userId ? connection.toUser : connection.fromUser;
      // Sans message échangé, le fil s'ouvre sur la demande initiale.
      const last = lastMessages[index] ?? { body: connection.message, senderId: connection.fromUserId, createdAt: connection.createdAt };
      return {
        id: connection.id,
        peer: peerView(peer),
        lastMessage: { body: last.body.slice(0, 160), fromMe: last.senderId === userId, createdAt: last.createdAt },
        unread: unreadById.get(connection.id) ?? 0,
      };
    })
    .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
}

export async function getThread(userId: string, connectionId: string) {
  const { connection, peer } = await loadConnection(userId, connectionId);

  // Ouvrir le fil = lire les messages reçus.
  await prisma.message.updateMany({
    where: { connectionId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
  const messages = await prisma.message.findMany({
    where: { connectionId },
    orderBy: { createdAt: 'asc' },
    take: 500,
    select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
  });

  return {
    id: connection.id,
    peer: peerView(peer),
    // La demande de mise en relation fait office de premier message du fil.
    intro: { fromMe: connection.fromUserId === userId, body: connection.message, createdAt: connection.createdAt },
    messages: messages.map((m) => ({ id: m.id, fromMe: m.senderId === userId, body: m.body, createdAt: m.createdAt, readAt: m.readAt })),
  };
}

export async function sendMessage(userId: string, connectionId: string, body: string) {
  const { peer } = await loadConnection(userId, connectionId);
  if (!peer.isActive) throw ApiError.conflict('Ce membre n’est plus joignable.');

  const message = await prisma.message.create({
    data: { connectionId, senderId: userId, body },
    select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
  });

  // Une seule notification tant que la précédente n'est pas lue (pas de spam à chaque message).
  const sender = await prisma.memberProfile.findUnique({ where: { userId }, select: { firstName: true, lastName: true } });
  const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Un membre';
  const title = `Nouveau message de ${senderName}`;
  const pending = await prisma.notification.findFirst({ where: { userId: peer.id, type: 'new_message', title, isRead: false }, select: { id: true } });
  if (!pending) {
    await prisma.notification.create({
      data: { userId: peer.id, type: 'new_message', title, body: body.length > 140 ? `${body.slice(0, 137)}...` : body, href: `/dashboard/messages?c=${connectionId}` },
    });
  }

  return { id: message.id, fromMe: true, body: message.body, createdAt: message.createdAt, readAt: message.readAt };
}

export async function unreadCount(userId: string) {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      connection: { status: 'ACCEPTED', OR: [{ fromUserId: userId }, { toUserId: userId }] },
    },
  });
}
