import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';

// Validation d'une demande de service par l'admin (demande client 07/09/2026).
// Flux : l'admin ajuste d'abord le devis + les détails via PATCH
// /service-requests/:id (aucun email), PUIS valide ici — c'est le seul point
// où un email de confirmation part vers le demandeur. sendEmail() n'est pas
// bloquant : un aléa SMTP ne doit pas faire échouer la validation.

const TARGET_INCLUDE = {
  user: { select: { id: true, email: true } },
  service: { select: { title: true } },
  space: { select: { name: true } },
  plan: { select: { name: true } },
} as const;

function targetLabel(request: {
  service: { title: string } | null;
  space: { name: string } | null;
  plan: { name: string } | null;
}) {
  return request.service?.title ?? request.space?.name ?? request.plan?.name ?? 'votre demande';
}

function formatAmount(amount: unknown, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
}

function confirmationEmailBody(label: string, priceLine: string | null, details: string | null) {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char,
    );
  return [
    '<p>Bonjour,</p>',
    `<p>Votre demande <strong>${escape(label)}</strong> a été prise en charge par l’équipe IN NETWORK.</p>`,
    priceLine ? `<p><strong>Devis :</strong> ${escape(priceLine)}</p>` : '',
    details ? `<p><strong>Détails :</strong><br>${escape(details).replace(/\n/g, '<br>')}</p>` : '',
    '<p>Nous revenons vers vous très rapidement pour la suite.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ]
    .filter(Boolean)
    .join('');
}

export async function confirmServiceRequest(id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: TARGET_INCLUDE,
  });
  if (!request) throw ApiError.notFound('Demande introuvable');
  if (request.confirmedAt) {
    throw ApiError.conflict('Cette demande a déjà été validée et le demandeur a déjà été notifié.');
  }
  if (request.status === 'CANCELLED') {
    throw ApiError.conflict('Cette demande est annulée — elle ne peut pas être validée.');
  }

  const recipientEmail = request.user?.email ?? request.guestEmail;
  if (!recipientEmail) {
    throw ApiError.badRequest(
      'Aucune adresse email n’est rattachée à cette demande — impossible d’envoyer la confirmation.',
    );
  }

  const label = targetLabel(request);
  const priceLine = request.quotedAmount != null ? formatAmount(request.quotedAmount, request.quotedCurrency) : null;

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: 'IN_PROGRESS', confirmedAt: new Date() },
    include: TARGET_INCLUDE,
  });

  if (request.userId) {
    await prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'service_request_confirmed',
        title: 'Demande prise en charge',
        body: priceLine ? `${label} — devis : ${priceLine}.` : `${label} — prise en charge par l’équipe.`,
      },
    });
  }

  sendEmail({
    to: recipientEmail,
    subject: 'IN NETWORK — Votre demande a été prise en charge',
    html: confirmationEmailBody(label, priceLine, request.adminDetails),
  }).catch((err) => console.error('[service-requests] échec envoi email de confirmation', err));

  return updated;
}
