import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

// Cascade: une fois le paiement confirmé (webhook carte ou confirmation
// manuelle admin pour un virement, cf. CDC §1.4), on active la ressource liée.
export async function markPaymentCompleted(paymentId: string, providerRef?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw ApiError.notFound('Paiement introuvable');
  if (payment.status === 'COMPLETED') return payment;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'COMPLETED', paidAt: new Date(), providerRef },
    });

    if (payment.subscriptionId) {
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'ACTIVE' },
      });
    }
    if (payment.bookingId) {
      await tx.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } });
    }
    if (payment.serviceRequestId) {
      await tx.serviceRequest.update({
        where: { id: payment.serviceRequestId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: 'payment_completed',
        title: 'Paiement confirmé',
        body: `Ton paiement de ${payment.amount} ${payment.currency} a été confirmé.`,
      },
    });

    return updated;
  });
}

export async function markPaymentFailed(paymentId: string) {
  return prisma.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
}
