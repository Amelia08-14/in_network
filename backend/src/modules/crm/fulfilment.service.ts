import type { PlanBillingCycle, Prisma, ServiceOrderStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import { advanceStageTo, logActivity } from './leads.service';
import { STAFF_SELECT, notifyUsers } from './staff';

// Lancement du service : dès qu'une facture est payée, chaque ligne devient une
// commande de service (ServiceOrder) avec sa checklist. Une ligne « formule
// d'abonnement » active en plus l'abonnement du membre rattaché au lead.

// Checklists par service du catalogue (slug) ; à défaut, la checklist générique.
// Ce sont des points de contrôle internes, modifiables commande par commande.
const CHECKLISTS: Record<string, string[]> = {
  'creation-entreprise': [
    'Réserver le nom commercial au CNRC',
    'Signer le bail de location notarié',
    'Enregistrer les statuts chez le notaire',
    'Obtenir le registre de commerce',
    "Déclarer l'existence aux impôts",
    'Obtenir l’immatriculation fiscale (NIF)',
    'Obtenir l’immatriculation statistique (NIS)',
    'Affilier le client à la CASNOS',
    "Ouvrir le compte bancaire",
  ],
  'formation-creation-entreprise': [
    "Fixer la date de l'atelier avec le client",
    'Envoyer la convocation',
    "Tenir l'atelier",
    'Remettre le support et clôturer',
  ],
};
const GENERIC_CHECKLIST = ['Prendre contact avec le client', 'Réaliser la prestation', 'Faire valider par le client'];
const PLAN_CHECKLIST = ['Faire signer le contrat', 'Remettre les accès au client', 'Accueillir le client dans l’espace'];

const ORDER_INCLUDE = {
  tasks: { orderBy: { position: 'asc' } },
  invoice: { select: { id: true, number: true, customerName: true, customerCompany: true, total: true } },
  lead: { select: { id: true, reference: true, title: true } },
  assignedTo: { select: STAFF_SELECT },
  user: { select: { id: true, email: true } },
  subscription: { select: { id: true, status: true, startDate: true, endDate: true } },
} satisfies Prisma.ServiceOrderInclude;

function addPeriod(start: Date, cycle: PlanBillingCycle, count: number) {
  const end = new Date(start);
  if (cycle === 'MONTHLY') end.setMonth(end.getMonth() + count);
  else if (cycle === 'ANNUAL') end.setFullYear(end.getFullYear() + count);
  else end.setDate(end.getDate() + count);
  return end;
}

/** Idempotent : une ligne de facture n'engendre qu'une seule commande. */
export async function launchServicesForInvoice(invoiceId: string, actorId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { position: 'asc' } }, serviceOrders: { select: { invoiceLineId: true } }, lead: { select: { id: true, userId: true, assignedToId: true } } },
  });
  if (!invoice) throw ApiError.notFound('Facture introuvable');

  const alreadyLaunched = new Set(invoice.serviceOrders.map((o) => o.invoiceLineId));
  const lines = invoice.lines.filter((line) => !alreadyLaunched.has(line.id));
  if (lines.length === 0) return [];

  const serviceIds = lines.map((l) => l.serviceId).filter((id): id is string => Boolean(id));
  const planIds = lines.map((l) => l.planId).filter((id): id is string => Boolean(id));
  const [services, plans] = await Promise.all([
    serviceIds.length ? prisma.serviceCatalogItem.findMany({ where: { id: { in: serviceIds } }, select: { id: true, slug: true } }) : [],
    planIds.length ? prisma.membershipPlan.findMany({ where: { id: { in: planIds } } }) : [],
  ]);

  const memberId = invoice.lead?.userId ?? null;
  const now = new Date();
  const created: string[] = [];

  for (const line of lines) {
    const plan = line.planId ? plans.find((p) => p.id === line.planId) : undefined;
    const slug = line.serviceId ? services.find((s) => s.id === line.serviceId)?.slug : undefined;
    let taskTitles = plan ? [...PLAN_CHECKLIST] : (slug && CHECKLISTS[slug]) || GENERIC_CHECKLIST;
    let subscriptionId: string | undefined;
    let activated = false;

    if (plan && memberId) {
      const subscription = await prisma.subscription.create({
        data: {
          userId: memberId,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: now,
          endDate: addPeriod(now, plan.billingCycle, Math.max(1, Math.round(Number(line.quantity)))),
        },
      });
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
        title: line.description.length > 180 ? `${line.description.slice(0, 177)}...` : line.description,
        assignedToId: invoice.lead?.assignedToId ?? null,
        subscriptionId,
        tasks: { create: taskTitles.map((title, position) => ({ title, position })) },
      },
    });
    created.push(order.id);

    if (activated) {
      await prisma.serviceOrderTask.create({
        data: { orderId: order.id, position: -1, title: 'Abonnement activé automatiquement', isDone: true, doneAt: now },
      });
    }
  }

  if (invoice.leadId) {
    await advanceStageTo(invoice.leadId, 'WON', actorId);
    await logActivity(invoice.leadId, {
      content: `${created.length} service${created.length > 1 ? 's' : ''} à lancer (facture ${invoice.number}).`,
      authorId: actorId,
    });
  }
  if (memberId) {
    await notifyUsers([memberId], 'service_launched', 'Votre service est lancé', 'Nous avons bien reçu votre paiement : notre équipe prend en charge le lancement de votre service.');
  }
  return prisma.serviceOrder.findMany({ where: { id: { in: created } }, include: ORDER_INCLUDE });
}

export async function listOrders(filter: { status?: ServiceOrderStatus; assignedToId?: string }) {
  return prisma.serviceOrder.findMany({
    where: { status: filter.status, assignedToId: filter.assignedToId },
    include: {
      tasks: { select: { isDone: true } },
      invoice: { select: { number: true, customerName: true, customerCompany: true } },
      lead: { select: { id: true, reference: true } },
      assignedTo: { select: STAFF_SELECT },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
}

export async function getOrder(id: string) {
  const order = await prisma.serviceOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw ApiError.notFound('Commande de service introuvable');
  return order;
}

async function markStatus(id: string, status: ServiceOrderStatus) {
  const order = await getOrder(id);
  if (order.status === status) return order;
  const now = new Date();
  await prisma.serviceOrder.update({
    where: { id },
    data: {
      status,
      startedAt: status === 'IN_PROGRESS' ? order.startedAt ?? now : order.startedAt,
      completedAt: status === 'DONE' ? now : null,
    },
  });
  if (status === 'DONE') {
    if (order.userId) {
      await notifyUsers([order.userId], 'service_done', 'Votre service est terminé', `${order.title} : la prestation est terminée.`);
    }
    if (order.leadId) await logActivity(order.leadId, { content: `Service terminé : ${order.title}.` });
  }
  return getOrder(id);
}

export async function updateOrder(
  id: string,
  patch: { status?: ServiceOrderStatus; assignedToId?: string | null; dueAt?: Date | null; notes?: string | null },
) {
  await getOrder(id);
  const { status, ...rest } = patch;
  if (Object.keys(rest).length) await prisma.serviceOrder.update({ where: { id }, data: rest });
  return status ? markStatus(id, status) : getOrder(id);
}

/** Cocher une tâche fait avancer la commande : 1re tâche → en cours, dernière → terminée. */
export async function setTaskDone(orderId: string, taskId: string, isDone: boolean) {
  const task = await prisma.serviceOrderTask.findFirst({ where: { id: taskId, orderId } });
  if (!task) throw ApiError.notFound('Tâche introuvable');
  await prisma.serviceOrderTask.update({ where: { id: taskId }, data: { isDone, doneAt: isDone ? new Date() : null } });

  const tasks = await prisma.serviceOrderTask.findMany({ where: { orderId } });
  const order = await getOrder(orderId);
  if (tasks.length > 0 && tasks.every((t) => t.isDone)) return markStatus(orderId, 'DONE');
  if (order.status === 'DONE') return markStatus(orderId, 'IN_PROGRESS');
  if (isDone && order.status === 'TO_START') return markStatus(orderId, 'IN_PROGRESS');
  return order;
}

export async function addTask(orderId: string, title: string) {
  await getOrder(orderId);
  const last = await prisma.serviceOrderTask.findFirst({ where: { orderId }, orderBy: { position: 'desc' } });
  await prisma.serviceOrderTask.create({ data: { orderId, title, position: (last?.position ?? 0) + 1 } });
  return getOrder(orderId);
}

export async function deleteTask(orderId: string, taskId: string) {
  await prisma.serviceOrderTask.deleteMany({ where: { id: taskId, orderId } });
  return getOrder(orderId);
}
