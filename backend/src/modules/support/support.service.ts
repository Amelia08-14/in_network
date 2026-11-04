import type { Role, SupportDepartment, SupportThreadStatus } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { emailButton, emailPanel, escapeHtml } from '../../lib/emailLayout';
import { ApiError } from '../../utils/apiResponse';
import { staffName } from '../crm/staff';

// Messagerie membre ↔ équipe IN NETWORK (demande cliente 04/11/2026). Le membre
// choisit le service à qui il écrit ; chaque conversation n'est reçue que par
// les comptes du backoffice de ce service, la Direction (ADMIN, SUPER_ADMIN)
// voit tout. Actualisation par interrogation régulière côté interface, comme
// la messagerie entre membres (modules/messages).

export const DEPARTMENTS: Record<SupportDepartment, { label: string; description: string; roles: Role[] }> = {
  OFFICE_MANAGER: {
    label: 'Office manager',
    description: 'Vie sur place, espaces, réservations, services en cours',
    roles: ['OFFICE_MANAGER'],
  },
  ADMINISTRATION: {
    label: 'Administration',
    description: 'Compte, documents, facturation et paiements',
    roles: ['ADMIN_SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
  },
  COMMERCIAL: {
    label: 'Service commercial',
    description: 'Devis, offres, abonnements, nouveaux services',
    roles: ['SALES_MANAGER', 'SALES_AGENT'],
  },
};

const ALL_DEPARTMENTS = Object.keys(DEPARTMENTS) as SupportDepartment[];

/** Services dont un compte du backoffice reçoit les conversations. */
export function departmentsForRole(role: Role): SupportDepartment[] {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return ALL_DEPARTMENTS;
  return ALL_DEPARTMENTS.filter((d) => DEPARTMENTS[d].roles.includes(role));
}

const MEMBER_SELECT = {
  id: true,
  email: true,
  isActive: true,
  profile: { select: { firstName: true, lastName: true, companyName: true, avatarUrl: true } },
} as const;

type MemberRow = { id: string; email: string; isActive: boolean; profile: { firstName: string; lastName: string; companyName: string | null; avatarUrl: string | null } | null };

const memberName = (m: MemberRow) => (m.profile ? `${m.profile.firstName} ${m.profile.lastName}`.trim() : m.email);

const memberView = (m: MemberRow) => ({
  id: m.id,
  name: memberName(m),
  email: m.email,
  companyName: m.profile?.companyName ?? null,
  avatarUrl: m.profile?.avatarUrl ?? null,
});

const isAfter = (a: Date | null, b: Date | null) => Boolean(a && (!b || a > b));

const snippet = (body: string) => (body.length > 140 ? `${body.slice(0, 137)}…` : body);

/** Une notification par destinataire, sauf s'il en a déjà une non lue pour ce fil (pas de rafale). */
async function notifyOnce(userIds: string[], type: string, title: string, body: string, href: string) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  const pending = await prisma.notification.findMany({ where: { userId: { in: unique }, href, isRead: false }, select: { userId: true } });
  const already = new Set(pending.map((n) => n.userId));
  const fresh = unique.filter((id) => !already.has(id));
  if (fresh.length) await prisma.notification.createMany({ data: fresh.map((userId) => ({ userId, type, title, body, href })) });
  return fresh;
}

/** Comptes actifs qui reçoivent les messages d'un service (à défaut : la Direction). */
async function departmentRecipients(department: SupportDepartment) {
  const staff = await prisma.user.findMany({ where: { role: { in: DEPARTMENTS[department].roles }, isActive: true }, select: { id: true } });
  if (staff.length) return staff.map((s) => s.id);
  const direction = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true }, select: { id: true } });
  return direction.map((s) => s.id);
}

function messageView(message: { id: string; body: string; createdAt: Date; fromStaff: boolean; sender: { displayName: string | null; email: string } | null }, viewerIsStaff: boolean) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    fromStaff: message.fromStaff,
    fromMe: message.fromStaff === viewerIsStaff,
    // Côté membre, l'équipe signe de son nom (ou « Équipe IN NETWORK »).
    author: message.fromStaff ? (message.sender ? staffName(message.sender) : 'Équipe IN NETWORK') : null,
  };
}

async function loadThread(id: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id },
    include: {
      member: { select: MEMBER_SELECT },
      messages: { orderBy: { createdAt: 'asc' }, take: 500, include: { sender: { select: { displayName: true, email: true } } } },
    },
  });
  if (!thread) throw ApiError.notFound('Conversation introuvable');
  return thread;
}

async function addMessage(threadId: string, senderId: string, fromStaff: boolean, body: string) {
  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { threadId, senderId, fromStaff, body }, include: { sender: { select: { displayName: true, email: true } } } }),
    prisma.supportThread.update({
      where: { id: threadId },
      // Écrire = avoir lu le fil ; un nouveau message rouvre une conversation close.
      data: fromStaff
        ? { lastStaffMessageAt: now, staffReadAt: now, lastMessageAt: now, status: 'OPEN' }
        : { lastMemberMessageAt: now, memberReadAt: now, lastMessageAt: now, status: 'OPEN' },
    }),
  ]);
  return message;
}

/** Prévient le service destinataire d'un message de membre. */
async function alertStaff(thread: { id: string; department: SupportDepartment; subject: string }, member: MemberRow, body: string) {
  const recipients = await departmentRecipients(thread.department);
  await notifyOnce(recipients, 'support_message', `${memberName(member)} — ${DEPARTMENTS[thread.department].label}`, `${thread.subject} : ${snippet(body)}`, `/admin/messagerie?t=${thread.id}`);
}

/** Prévient le membre d'une réponse de l'équipe (notification + e-mail, sans rafale). */
async function alertMember(thread: { id: string; department: SupportDepartment; subject: string }, member: MemberRow, author: string, body: string) {
  const href = `/dashboard/equipe-in-network?t=${thread.id}`;
  const notified = await notifyOnce([member.id], 'support_reply', `Réponse de l’équipe IN NETWORK — ${DEPARTMENTS[thread.department].label}`, snippet(body), href);
  if (!notified.length || !member.isActive) return;
  sendEmail({
    to: member.email,
    subject: `IN NETWORK — Nouvelle réponse : ${thread.subject}`,
    html: `<p>Bonjour ${escapeHtml(member.profile?.firstName)},</p><p>${escapeHtml(author)} (${DEPARTMENTS[thread.department].label}) vous a répondu au sujet de « ${escapeHtml(thread.subject)} ».</p>${emailPanel(`<p style="margin:0;white-space:pre-wrap;">${escapeHtml(snippet(body))}</p>`)}${emailButton('Lire et répondre', `${env.appUrl}${href}`)}<p>L’équipe IN NETWORK</p>`,
  }).catch((err) => console.error('[support] e-mail de réponse non envoyé', err instanceof Error ? err.message : err));
}

// ================================ Membre ================================

export function listDepartments() {
  return ALL_DEPARTMENTS.map((key) => ({ key, label: DEPARTMENTS[key].label, description: DEPARTMENTS[key].description }));
}

export async function listMemberThreads(memberId: string) {
  const threads = await prisma.supportThread.findMany({
    where: { memberId },
    orderBy: { lastMessageAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromStaff: true } } },
  });
  return threads.map((t) => ({
    id: t.id,
    department: t.department,
    departmentLabel: DEPARTMENTS[t.department].label,
    subject: t.subject,
    status: t.status,
    lastMessageAt: t.lastMessageAt,
    lastMessage: t.messages[0] ? { body: t.messages[0].body.slice(0, 160), fromMe: !t.messages[0].fromStaff } : null,
    unread: isAfter(t.lastStaffMessageAt, t.memberReadAt),
  }));
}

export async function createMemberThread(memberId: string, input: { department: SupportDepartment; subject: string; body: string }) {
  const member = await prisma.user.findUnique({ where: { id: memberId }, select: MEMBER_SELECT });
  if (!member) throw ApiError.notFound('Compte introuvable');
  const thread = await prisma.supportThread.create({ data: { memberId, department: input.department, subject: input.subject } });
  await addMessage(thread.id, memberId, false, input.body);
  await alertStaff(thread, member, input.body);
  return getMemberThread(memberId, thread.id);
}

export async function getMemberThread(memberId: string, id: string) {
  const thread = await loadThread(id);
  if (thread.memberId !== memberId) throw ApiError.notFound('Conversation introuvable');
  await prisma.supportThread.update({ where: { id }, data: { memberReadAt: new Date() } });
  return {
    id: thread.id,
    department: thread.department,
    departmentLabel: DEPARTMENTS[thread.department].label,
    subject: thread.subject,
    status: thread.status,
    messages: thread.messages.map((m) => messageView(m, false)),
  };
}

export async function memberReply(memberId: string, id: string, body: string) {
  const thread = await loadThread(id);
  if (thread.memberId !== memberId) throw ApiError.notFound('Conversation introuvable');
  const message = await addMessage(id, memberId, false, body);
  await alertStaff(thread, thread.member, body);
  return messageView(message, false);
}

export async function memberUnreadCount(memberId: string) {
  const threads = await prisma.supportThread.findMany({ where: { memberId, lastStaffMessageAt: { not: null } }, select: { lastStaffMessageAt: true, memberReadAt: true } });
  return threads.filter((t) => isAfter(t.lastStaffMessageAt, t.memberReadAt)).length;
}

// ================================ Équipe ================================

function assertScope(role: Role, department: SupportDepartment) {
  if (!departmentsForRole(role).includes(department)) throw ApiError.notFound('Conversation introuvable');
}

export async function listStaffThreads(role: Role, filters: { department?: SupportDepartment; status?: SupportThreadStatus; search?: string }) {
  const scope = departmentsForRole(role);
  if (scope.length === 0) return { departments: [], threads: [] };
  const departments = filters.department && scope.includes(filters.department) ? [filters.department] : scope;
  const search = filters.search?.trim();
  const threads = await prisma.supportThread.findMany({
    where: {
      department: { in: departments },
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search } },
              { member: { email: { contains: search } } },
              { member: { profile: { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { companyName: { contains: search } }] } } },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
    include: {
      member: { select: MEMBER_SELECT },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromStaff: true } },
    },
  });
  return {
    departments: scope.map((key) => ({ key, label: DEPARTMENTS[key].label })),
    threads: threads.map((t) => ({
      id: t.id,
      department: t.department,
      departmentLabel: DEPARTMENTS[t.department].label,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      member: memberView(t.member),
      lastMessage: t.messages[0] ? { body: t.messages[0].body.slice(0, 160), fromStaff: t.messages[0].fromStaff } : null,
      unread: isAfter(t.lastMemberMessageAt, t.staffReadAt),
    })),
  };
}

export async function getStaffThread(role: Role, id: string) {
  const thread = await loadThread(id);
  assertScope(role, thread.department);
  await prisma.supportThread.update({ where: { id }, data: { staffReadAt: new Date() } });
  return {
    id: thread.id,
    department: thread.department,
    departmentLabel: DEPARTMENTS[thread.department].label,
    subject: thread.subject,
    status: thread.status,
    member: memberView(thread.member),
    messages: thread.messages.map((m) => messageView(m, true)),
  };
}

export async function staffReply(staff: { id: string; role: Role }, id: string, body: string) {
  const thread = await loadThread(id);
  assertScope(staff.role, thread.department);
  const message = await addMessage(id, staff.id, true, body);
  await alertMember(thread, thread.member, message.sender ? staffName(message.sender) : 'L’équipe IN NETWORK', body);
  return messageView(message, true);
}

export async function setThreadStatus(role: Role, id: string, status: SupportThreadStatus) {
  const thread = await prisma.supportThread.findUnique({ where: { id }, select: { department: true } });
  if (!thread) throw ApiError.notFound('Conversation introuvable');
  assertScope(role, thread.department);
  await prisma.supportThread.update({ where: { id }, data: { status } });
  return { id, status };
}

/** L'équipe écrit la première à un membre (depuis sa fiche ou la messagerie). */
export async function createStaffThread(staff: { id: string; role: Role }, input: { memberId: string; department: SupportDepartment; subject: string; body: string }) {
  assertScope(staff.role, input.department);
  const member = await prisma.user.findFirst({ where: { id: input.memberId, role: 'MEMBER' }, select: MEMBER_SELECT });
  if (!member) throw ApiError.notFound('Membre introuvable');
  const thread = await prisma.supportThread.create({ data: { memberId: member.id, department: input.department, subject: input.subject } });
  const message = await addMessage(thread.id, staff.id, true, input.body);
  await alertMember(thread, member, message.sender ? staffName(message.sender) : 'L’équipe IN NETWORK', input.body);
  return getStaffThread(staff.role, thread.id);
}

/** Recherche de membres pour écrire un nouveau message (nom, e-mail, entreprise). */
export async function searchMembers(search: string) {
  const q = search.trim();
  if (q.length < 2) return [];
  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      OR: [
        { email: { contains: q } },
        { profile: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { companyName: { contains: q } }] } },
      ],
    },
    select: MEMBER_SELECT,
    take: 10,
  });
  return members.map(memberView);
}

export async function staffUnreadCount(role: Role) {
  const scope = departmentsForRole(role);
  if (scope.length === 0) return 0;
  const threads = await prisma.supportThread.findMany({
    where: { department: { in: scope }, lastMemberMessageAt: { not: null } },
    select: { lastMemberMessageAt: true, staffReadAt: true },
  });
  return threads.filter((t) => isAfter(t.lastMemberMessageAt, t.staffReadAt)).length;
}
