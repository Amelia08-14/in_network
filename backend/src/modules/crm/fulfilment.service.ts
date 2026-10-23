import type { DeliveryPole, MemberDocumentKind, PlanBillingCycle, Prisma, ServiceOrderStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { markCommissionsEligible } from './commissions.service';
import { logActivity } from './leads.service';
import { leadScopeWhere, type StaffScope } from './scope';
import { STAFF_SELECT, listStaffByRole, notifyUsers, staffName } from './staff';

// Services vendus — phases 4 à 7 du processus v1.3. Au paiement, chaque ligne
// de facture devient un service du panier du membre (ServiceOrder), réparti
// entre les trois pôles de livraison avec sa checklist :
//   À lancer → Activation en cours → En attente de validation (livrable prêt)
//   ⇄ Ajustement demandé → Livré / Actif (validé par le membre ou son référent).
// La période (début, échéance) et le renouvellement sont portés par le
// service ; « À renouveler », « Expiré » et « Renouvelé » se déduisent des
// dates (memberServiceStatus).

export const POLE_LABEL: Record<DeliveryPole, string> = {
  SPACES: 'Espaces et domiciliation',
  COMPANY_CREATION: 'Création d’entreprise',
  IN_GROUP: 'Solutions IN Group',
};

export const ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  TO_START: 'À lancer',
  IN_PROGRESS: 'Activation en cours',
  AWAITING_VALIDATION: 'En attente de validation',
  ADJUSTMENT_REQUESTED: 'Ajustement demandé',
  DONE: 'Livré / Actif',
  CANCELLED: 'Annulé',
};

// --- Statut vu par le membre ------------------------------------------------------

export type MemberServiceStatus = 'ACTIVATING' | 'AWAITING_VALIDATION' | 'ADJUSTMENT_REQUESTED' | 'ACTIVE' | 'TO_RENEW' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';

const DAY = 24 * 3600 * 1000;

/** Statut du panier : calculé, jamais stocké (il dépend de la date du jour). */
export function memberServiceStatus(
  order: { status: ServiceOrderStatus; expiresAt: Date | null; expiredAt?: Date | null; renewedBy?: { id: string } | null },
  renewWindowDays: number,
  now = new Date(),
): MemberServiceStatus {
  switch (order.status) {
    case 'CANCELLED':
      return 'CANCELLED';
    case 'TO_START':
    case 'IN_PROGRESS':
      return 'ACTIVATING';
    case 'AWAITING_VALIDATION':
      return 'AWAITING_VALIDATION';
    case 'ADJUSTMENT_REQUESTED':
      return 'ADJUSTMENT_REQUESTED';
    case 'DONE':
      if (order.renewedBy) return 'RENEWED';
      if (order.expiredAt || (order.expiresAt && order.expiresAt < now)) return 'EXPIRED';
      if (order.expiresAt && order.expiresAt.getTime() - now.getTime() <= renewWindowDays * DAY) return 'TO_RENEW';
      return 'ACTIVE';
  }
}

// --- Checklists -----------------------------------------------------------------

// Checklists par service du catalogue (slug) ; à défaut, la checklist du pôle.
// Ce sont des points de contrôle internes, modifiables commande par commande.
const CHECKLISTS: Record<string, string[]> = {
  'formation-creation-entreprise': [
    "Fixer la date de l'atelier avec le client",
    'Envoyer la convocation',
    "Tenir l'atelier",
    'Remettre le support et clôturer',
  ],
};
// Les 9 étapes de la création juridique d'entreprise, dans l'ordre de la frise
// de l'offre commerciale. La formule choisie en couvre les premières :
// Essentiel = étapes 1 à 4, Avancé = 1 à 7, Complet = 1 à 9.
const CREATION_STEPS = [
  'Réserver le nom commercial au CNRC',
  'Enregistrer les statuts chez le notaire',
  'Signer le bail de location notarié',
  "Déclarer l'existence aux impôts",
  'Ouvrir le compte bancaire',
  'Obtenir l’immatriculation fiscale (NIF)',
  'Obtenir le registre de commerce',
  'Affilier le client à la CASNOS',
  'Obtenir l’immatriculation statistique (NIS)',
];
const CREATION_TIER_STEPS: Record<string, number> = { essentiel: 4, avancé: 7, avance: 7, complet: 9 };

function creationChecklist(tierLabel: string | null | undefined): string[] {
  const key = (tierLabel ?? '').toLowerCase();
  const tier = Object.keys(CREATION_TIER_STEPS).find((name) => key.includes(name));
  return CREATION_STEPS.slice(0, tier ? CREATION_TIER_STEPS[tier] : CREATION_STEPS.length);
}

const POLE_CHECKLIST: Record<DeliveryPole, string[]> = {
  SPACES: ['Remettre les accès (badge, poste ou bureau)', 'Mettre en place le courrier / la domiciliation', 'Remettre l’attestation au membre (48 h)'],
  COMPANY_CREATION: ['Prendre contact avec le client', 'Constituer le dossier', 'Réaliser les démarches auprès des organismes', 'Remettre les documents officiels'],
  IN_GROUP: ['Transmettre la demande à la filiale', 'Mettre en relation le membre', 'Confirmer le démarrage de la prestation'],
};
const PLAN_CHECKLIST = ['Faire signer le contrat', 'Remettre les accès au client', 'Accueillir le client dans l’espace'];

const ORDER_INCLUDE = {
  tasks: { orderBy: { position: 'asc' } },
  invoice: { select: { id: true, number: true, proformaNumber: true, customerName: true, customerCompany: true, total: true } },
  lead: { select: { id: true, reference: true, title: true, kind: true } },
  assignedTo: { select: STAFF_SELECT },
  validatedBy: { select: STAFF_SELECT },
  user: { select: { id: true, email: true, referentId: true, profile: { select: { firstName: true, lastName: true } } } },
  subscription: { select: { id: true, status: true, startDate: true, endDate: true } },
  renewedFrom: { select: { id: true, title: true, expiresAt: true } },
  renewedBy: { select: { id: true } },
  documents: { select: { id: true, kind: true, title: true, fileName: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ServiceOrderInclude;

function addMonths(start: Date, months: number) {
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end;
}

function addPeriod(start: Date, cycle: PlanBillingCycle, count: number) {
  const end = new Date(start);
  if (cycle === 'MONTHLY') end.setMonth(end.getMonth() + count);
  else if (cycle === 'ANNUAL') end.setFullYear(end.getFullYear() + count);
  else end.setDate(end.getDate() + count);
  return end;
}

/** Qui livre : l'Office Manager (espaces), le support administratif (création), le référent (IN Group). */
async function poleAssignee(pole: DeliveryPole, fallback: string | null, referentId: string | null) {
  if (pole === 'COMPANY_CREATION') {
    const support = await listStaffByRole('ADMIN_SUPPORT');
    if (support.length) return support[0].id;
  }
  if (pole === 'IN_GROUP') return referentId ?? fallback;
  return fallback ?? referentId;
}

// --- Lancement au paiement --------------------------------------------------------

/** Idempotent : une ligne de facture n'engendre qu'un seul service. */
export async function launchServicesForInvoice(invoiceId: string, actorId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { orderBy: { position: 'asc' } },
      serviceOrders: { select: { invoiceLineId: true } },
      lead: { select: { id: true, userId: true, assignedToId: true, user: { select: { referentId: true } } } },
    },
  });
  if (!invoice) throw ApiError.notFound('Facture introuvable');

  const alreadyLaunched = new Set(invoice.serviceOrders.map((o) => o.invoiceLineId));
  const lines = invoice.lines.filter((line) => !alreadyLaunched.has(line.id));
  if (lines.length === 0) return [];

  const serviceIds = lines.map((l) => l.serviceId).filter((id): id is string => Boolean(id));
  const planIds = lines.map((l) => l.planId).filter((id): id is string => Boolean(id));
  const renewedIds = lines.map((l) => l.renewsOrderId).filter((id): id is string => Boolean(id));
  const [services, plans, renewedOrders] = await Promise.all([
    serviceIds.length ? prisma.serviceCatalogItem.findMany({ where: { id: { in: serviceIds } }, select: { id: true, slug: true, pole: true, subsidiary: true, durationMonths: true } }) : [],
    planIds.length ? prisma.membershipPlan.findMany({ where: { id: { in: planIds } } }) : [],
    renewedIds.length ? prisma.serviceOrder.findMany({ where: { id: { in: renewedIds } }, include: { renewedBy: { select: { id: true } } } }) : [],
  ]);

  const memberId = invoice.lead?.userId ?? null;
  const referentId = invoice.lead?.user?.referentId ?? null;
  const owner = invoice.lead?.assignedToId ?? actorId;
  const now = new Date();
  const created: string[] = [];

  for (const line of lines) {
    const plan = line.planId ? plans.find((p) => p.id === line.planId) : undefined;
    const service = line.serviceId ? services.find((s) => s.id === line.serviceId) : undefined;
    const pole: DeliveryPole = plan || line.spaceId ? 'SPACES' : service?.pole ?? 'SPACES';
    const amount = Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100;
    const title = line.description.length > 180 ? `${line.description.slice(0, 177)}...` : line.description;
    const renewed = line.renewsOrderId ? renewedOrders.find((o) => o.id === line.renewsOrderId && !o.renewedBy) : undefined;

    // Renouvellement : le service prolonge le précédent, sans nouvelle livraison.
    if (renewed) {
      const startsAt = renewed.expiresAt && renewed.expiresAt > now ? renewed.expiresAt : now;
      const months = service?.durationMonths ?? (renewed.startsAt && renewed.expiresAt ? Math.max(1, Math.round((renewed.expiresAt.getTime() - renewed.startsAt.getTime()) / (30.44 * DAY))) : null);
      let subscriptionId: string | undefined;
      let expiresAt = months ? addMonths(startsAt, months) : null;
      if (plan && memberId) {
        expiresAt = addPeriod(startsAt, plan.billingCycle, Math.max(1, Math.round(Number(line.quantity))));
        const subscription = await prisma.subscription.create({ data: { userId: memberId, planId: plan.id, status: 'ACTIVE', startDate: startsAt, endDate: expiresAt } });
        subscriptionId = subscription.id;
      }
      const order = await prisma.serviceOrder.create({
        data: {
          invoiceId: invoice.id,
          invoiceLineId: line.id,
          leadId: invoice.leadId,
          userId: memberId,
          title,
          pole,
          subsidiary: service?.subsidiary,
          amount,
          status: 'DONE',
          startedAt: now,
          completedAt: now,
          startsAt,
          expiresAt,
          renewedFromId: renewed.id,
          assignedToId: renewed.assignedToId ?? owner,
          subscriptionId,
          tasks: { create: [{ title: 'Renouvellement enregistré au paiement', position: 0, isDone: true, doneAt: now }] },
        },
      });
      created.push(order.id);
      if (memberId) await notifyUsers([memberId], 'service_renewed', 'Service renouvelé', `${title} est renouvelé${expiresAt ? ` jusqu’au ${expiresAt.toLocaleDateString('fr-FR')}` : ''}.`, '/dashboard/services');
      continue;
    }

    let taskTitles = plan
      ? [...PLAN_CHECKLIST]
      : service?.slug === 'creation-entreprise'
        ? creationChecklist(line.tierLabel)
        : (service?.slug && CHECKLISTS[service.slug]) || POLE_CHECKLIST[pole];
    let subscriptionId: string | undefined;
    let startsAt: Date | null = null;
    let expiresAt: Date | null = null;
    let activated = false;

    if (plan && memberId) {
      startsAt = now;
      expiresAt = addPeriod(now, plan.billingCycle, Math.max(1, Math.round(Number(line.quantity))));
      const subscription = await prisma.subscription.create({ data: { userId: memberId, planId: plan.id, status: 'ACTIVE', startDate: startsAt, endDate: expiresAt } });
      subscriptionId = subscription.id;
      activated = true;
    } else if (plan) {
      taskTitles = ['Créer ou rattacher le compte membre du client', 'Activer son abonnement', ...PLAN_CHECKLIST];
    }

    const order = await prisma.serviceOrder.create({
      data: {
        invoiceId: invoice.id,
        invoiceLineId: line.id,
        leadId: invoice.leadId,
        userId: memberId,
        title,
        pole,
        subsidiary: service?.subsidiary,
        amount,
        assignedToId: await poleAssignee(pole, owner, referentId),
        subscriptionId,
        startsAt,
        expiresAt,
        tasks: { create: taskTitles.map((taskTitle, position) => ({ title: taskTitle, position })) },
      },
    });
    created.push(order.id);
    if (activated) {
      await prisma.serviceOrderTask.create({
        data: { orderId: order.id, position: -1, title: 'Abonnement activé automatiquement', isDone: true, doneAt: now },
      });
    }
    if (order.assignedToId && order.assignedToId !== actorId) {
      await notifyUsers([order.assignedToId], 'service_to_deliver', `Service à livrer · ${POLE_LABEL[pole]}`, title, `/admin/lancements?order=${order.id}`);
    }
  }

  if (invoice.leadId) {
    await logActivity(invoice.leadId, {
      content: `${created.length} service${created.length > 1 ? 's' : ''} ajouté${created.length > 1 ? 's' : ''} au panier du membre (facture ${invoice.number}).`,
      authorId: actorId,
    });
  }
  if (memberId && lines.some((l) => !l.renewsOrderId)) {
    await notifyUsers([memberId], 'service_launched', 'Vos services sont en cours d’activation', 'Paiement reçu : suivez la mise en place de chaque service depuis « Mes services ».', '/dashboard/services');
  }
  return prisma.serviceOrder.findMany({ where: { id: { in: created } }, include: ORDER_INCLUDE });
}

// --- Consultation (équipe) -------------------------------------------------------------

/** Le support administratif ne voit que son pôle ; l'Office Manager et la Direction tout ; les commerciaux leurs dossiers. */
export function orderScopeWhere(scope: StaffScope | undefined): Prisma.ServiceOrderWhereInput {
  if (!scope || scope.allLeads || scope.officeManager) return {};
  if (scope.role === 'ADMIN_SUPPORT') return { pole: 'COMPANY_CREATION' };
  const scoped = leadScopeWhere(scope);
  return { OR: [{ assignedToId: scope.userId }, ...(scoped ? [{ lead: scoped }] : [])] };
}

export async function listOrders(
  filter: { status?: ServiceOrderStatus; assignedToId?: string; pole?: DeliveryPole; userId?: string; expiring?: boolean },
  scope?: StaffScope,
) {
  const now = new Date();
  return prisma.serviceOrder.findMany({
    where: {
      AND: [
        orderScopeWhere(scope),
        filter.expiring ? { status: 'DONE', renewedBy: null, expiresAt: { not: null, lte: new Date(now.getTime() + 60 * DAY) } } : {},
      ],
      status: filter.status,
      assignedToId: filter.assignedToId,
      pole: filter.pole,
      userId: filter.userId,
    },
    include: {
      tasks: { select: { isDone: true } },
      invoice: { select: { number: true, proformaNumber: true, customerName: true, customerCompany: true } },
      lead: { select: { id: true, reference: true } },
      assignedTo: { select: STAFF_SELECT },
      user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      renewedBy: { select: { id: true } },
    },
    orderBy: filter.expiring ? { expiresAt: 'asc' } : { createdAt: 'desc' },
    take: 500,
  });
}

export async function getOrder(id: string) {
  const order = await prisma.serviceOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw ApiError.notFound('Service introuvable');
  return order;
}

export async function updateOrder(id: string, patch: { assignedToId?: string | null; dueAt?: Date | null; notes?: string | null; startsAt?: Date | null; expiresAt?: Date | null }) {
  await getOrder(id);
  const { startsAt, expiresAt, ...rest } = patch;
  return prisma.serviceOrder.update({
    where: { id },
    data: {
      ...rest,
      ...(startsAt !== undefined ? { startsAt } : {}),
      // Une nouvelle échéance réarme les alertes.
      ...(expiresAt !== undefined ? { expiresAt, alert60At: null, alert30At: null, alert7At: null, expiredAt: null } : {}),
    },
    include: ORDER_INCLUDE,
  });
}

// --- Avancement : activation → livrable prêt → validation -------------------------------

async function notifyOrder(order: Awaited<ReturnType<typeof getOrder>>, recipients: (string | null | undefined)[], type: string, title: string, body: string, href: string) {
  await notifyUsers(recipients.filter((id): id is string => Boolean(id)), type, title, body, href);
  void order;
}

/** Démarre la livraison (À lancer → Activation en cours). */
export async function startOrder(id: string, actorId: string) {
  const order = await getOrder(id);
  if (order.status !== 'TO_START' && order.status !== 'ADJUSTMENT_REQUESTED') throw ApiError.conflict('Ce service est déjà en cours ou livré.');
  await prisma.serviceOrder.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: order.startedAt ?? new Date() } });
  if (order.leadId) await logActivity(order.leadId, { content: `${order.title} : activation en cours.`, authorId: actorId });
  if (order.userId) await notifyUsers([order.userId], 'service_status', 'Service en cours d’activation', order.title, '/dashboard/services');
  return getOrder(id);
}

/**
 * Livrable prêt : le pôle prévient le référent (validation client) et
 * l'Office Manager (suivi) ; le membre valide depuis son espace.
 */
export async function markOrderReady(id: string, actorId: string) {
  const order = await getOrder(id);
  if (order.status === 'DONE' || order.status === 'CANCELLED') throw ApiError.conflict('Ce service est déjà clos.');
  if (order.status === 'AWAITING_VALIDATION') return order;
  await prisma.serviceOrder.update({ where: { id }, data: { status: 'AWAITING_VALIDATION', readyAt: new Date(), startedAt: order.startedAt ?? new Date() } });
  if (order.leadId) await logActivity(order.leadId, { content: `${order.title} : livrable prêt, en attente de la validation du membre.`, authorId: actorId });
  const oms = await listStaffByRole('OFFICE_MANAGER');
  await notifyOrder(order, [order.user?.referentId, ...oms.map((u) => u.id)].filter((u) => u !== actorId), 'service_ready', 'Livrable prêt : validation du membre', order.title, `/admin/lancements?order=${id}`);
  if (order.userId) await notifyUsers([order.userId], 'service_ready', 'Votre service est prêt', `${order.title} : vérifiez-le et validez la mise en service.`, '/dashboard/services');
  return getOrder(id);
}

/** Service validé (par le membre, ou par son référent pour lui) : Livré / Actif. */
export async function validateOrder(id: string, actor: { id: string; isMember: boolean }) {
  const order = await getOrder(id);
  if (order.status === 'DONE') return order;
  if (order.status === 'CANCELLED') throw ApiError.conflict('Ce service est annulé.');
  if (actor.isMember && order.status !== 'AWAITING_VALIDATION') throw ApiError.conflict('Ce service n’est pas encore prêt à être validé.');

  const now = new Date();
  const service = order.invoiceLineId
    ? await prisma.invoiceLine.findUnique({ where: { id: order.invoiceLineId }, select: { serviceId: true } })
    : null;
  const catalog = service?.serviceId ? await prisma.serviceCatalogItem.findUnique({ where: { id: service.serviceId }, select: { durationMonths: true } }) : null;
  const startsAt = order.startsAt ?? now;
  const expiresAt = order.expiresAt ?? (catalog?.durationMonths ? addMonths(startsAt, catalog.durationMonths) : null);

  await prisma.serviceOrder.update({
    where: { id },
    data: { status: 'DONE', completedAt: now, validatedById: actor.id, startsAt, expiresAt, adjustmentNote: null },
  });
  await markCommissionsEligible(id);
  const by = actor.isMember ? 'le membre' : staffName((await prisma.user.findUnique({ where: { id: actor.id }, select: STAFF_SELECT })) ?? { displayName: null, email: 'l’équipe' });
  if (order.leadId) await logActivity(order.leadId, { content: `${order.title} : mise en service validée par ${by} — Livré / Actif.`, authorId: actor.isMember ? null : actor.id });
  const recipients = actor.isMember ? [order.assignedToId, order.user?.referentId] : [order.userId];
  await notifyUsers(
    recipients.filter((u): u is string => Boolean(u) && u !== actor.id),
    'service_validated',
    actor.isMember ? 'Service validé par le membre' : 'Service actif',
    `${order.title}${expiresAt ? ` — échéance le ${expiresAt.toLocaleDateString('fr-FR')}` : ''}`,
    actor.isMember ? `/admin/lancements?order=${id}` : '/dashboard/services',
  );
  return getOrder(id);
}

/** Le membre (ou son référent) demande une correction : le pôle reprend la livraison. */
export async function requestAdjustment(id: string, note: string, actor: { id: string; isMember: boolean }) {
  const order = await getOrder(id);
  if (order.status !== 'AWAITING_VALIDATION') throw ApiError.conflict('Un ajustement se demande sur un livrable en attente de validation.');
  await prisma.serviceOrder.update({ where: { id }, data: { status: 'ADJUSTMENT_REQUESTED', adjustmentNote: note.trim() } });
  if (order.leadId) await logActivity(order.leadId, { content: `${order.title} : ajustement demandé${actor.isMember ? ' par le membre' : ''} — ${note.trim()}`, authorId: actor.isMember ? null : actor.id });
  await notifyUsers(
    [order.assignedToId, order.user?.referentId].filter((u): u is string => Boolean(u) && u !== actor.id),
    'service_adjustment',
    'Ajustement demandé',
    `${order.title} : ${note.trim()}`,
    `/admin/lancements?order=${id}`,
  );
  return getOrder(id);
}

export async function cancelOrder(id: string, reason: string, actorId: string) {
  const order = await getOrder(id);
  if (order.status === 'DONE') throw ApiError.conflict('Un service livré ne s’annule pas.');
  await prisma.serviceOrder.update({ where: { id }, data: { status: 'CANCELLED', notes: [order.notes, `Annulé : ${reason}`].filter(Boolean).join('\n') } });
  if (order.leadId) await logActivity(order.leadId, { content: `${order.title} annulé (${reason}).`, authorId: actorId });
  return getOrder(id);
}

// --- Checklist -------------------------------------------------------------------

export async function setTaskDone(orderId: string, taskId: string, isDone: boolean) {
  const task = await prisma.serviceOrderTask.findFirst({ where: { id: taskId, orderId } });
  if (!task) throw ApiError.notFound('Tâche introuvable');
  await prisma.serviceOrderTask.update({ where: { id: taskId }, data: { isDone, doneAt: isDone ? new Date() : null } });
  // Première case cochée : la livraison démarre.
  const order = await prisma.serviceOrder.findUnique({ where: { id: orderId }, select: { status: true, startedAt: true } });
  if (isDone && order?.status === 'TO_START') {
    await prisma.serviceOrder.update({ where: { id: orderId }, data: { status: 'IN_PROGRESS', startedAt: order.startedAt ?? new Date() } });
  }
  return getOrder(orderId);
}

export async function addTask(orderId: string, title: string) {
  const order = await getOrder(orderId);
  await prisma.serviceOrderTask.create({ data: { orderId, title, position: order.tasks.length } });
  return getOrder(orderId);
}

export async function deleteTask(orderId: string, taskId: string) {
  await prisma.serviceOrderTask.deleteMany({ where: { id: taskId, orderId } });
  return getOrder(orderId);
}

// --- Documents remis au membre ------------------------------------------------------------

export const DOCUMENT_KIND_LABEL: Record<MemberDocumentKind, string> = {
  CONTRACT: 'Contrat signé',
  DOMICILIATION_CERTIFICATE: 'Attestation de domiciliation',
  OFFICIAL_DOCUMENT: 'Document officiel',
  RECEIPT: 'Reçu',
  OTHER: 'Document',
};

export async function addMemberDocument(
  input: { userId: string; orderId?: string | null; kind: MemberDocumentKind; title?: string | null },
  file: { filename: string; originalname: string; mimetype: string; size: number },
  actorId: string,
) {
  const member = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true } });
  if (!member || member.role !== 'MEMBER') throw ApiError.notFound('Membre introuvable');
  const order = input.orderId ? await prisma.serviceOrder.findFirst({ where: { id: input.orderId, userId: input.userId }, select: { id: true, title: true, leadId: true } }) : null;
  if (input.orderId && !order) throw ApiError.notFound('Service introuvable');
  const document = await prisma.memberDocument.create({
    data: {
      userId: input.userId,
      orderId: order?.id ?? null,
      kind: input.kind,
      title: (input.title?.trim() || DOCUMENT_KIND_LABEL[input.kind]).slice(0, 190),
      filePath: file.filename,
      fileName: file.originalname.slice(0, 190),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: actorId,
    },
  });
  if (order?.leadId) await logActivity(order.leadId, { content: `${document.title} remis au membre (${order.title}).`, authorId: actorId });
  await notifyUsers([input.userId], 'document_added', 'Nouveau document', `${document.title} est disponible dans votre historique.`, '/dashboard/historique');
  return document;
}

export async function listMemberDocuments(userId: string) {
  return prisma.memberDocument.findMany({
    where: { userId },
    include: { order: { select: { id: true, title: true } }, uploadedBy: { select: STAFF_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}
