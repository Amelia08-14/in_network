import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import type { PaymentMethod } from '../../generated/prisma/client';

function computeEndDate(start: Date, cycle: string): Date {
  const end = new Date(start);
  if (cycle === 'DAY_PASS') end.setDate(end.getDate() + 1);
  else if (cycle === 'MONTHLY') end.setMonth(end.getMonth() + 1);
  else if (cycle === 'ANNUAL') end.setFullYear(end.getFullYear() + 1);
  return end;
}

export async function listMySubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    include: { plan: true, payment: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSubscription(userId: string, planId: string, method: PaymentMethod) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw ApiError.notFound('Formule introuvable');

  const startDate = new Date();
  const endDate = computeEndDate(startDate, plan.billingCycle);

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      startDate,
      endDate,
      status: 'PENDING_PAYMENT',
      payment: {
        create: {
          userId,
          relatedType: 'SUBSCRIPTION',
          amount: plan.price,
          currency: plan.currency,
          method,
          // Virement = statut mis à jour manuellement par l'admin (CDC §1.4,
          // fonctionnement identique à IN ACADEMY). Carte = en attente de
          // confirmation par la passerelle (webhook, cf. modules/payments).
          status: 'PENDING',
        },
      },
    },
    include: { plan: true, payment: true },
  });
}

export async function getSubscriptionById(userId: string, id: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true, payment: true },
  });
  if (!subscription || subscription.userId !== userId) throw ApiError.notFound('Abonnement introuvable');
  return subscription;
}
