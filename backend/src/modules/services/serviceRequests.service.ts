import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import type { CartItemInput } from './services.schema';
import { lineLabel, requestLabel, type RequestItemLike } from './requestLabel';

// Demande de devis = panier (demande client 19/09/2026) : une ServiceRequest
// regroupe plusieurs lignes (ServiceRequestItem). Ce module porte la création
// (libellés/prix relus en base, jamais fournis par le client) et la validation
// par l'admin.
//
// Validation d'une demande par l'admin (demande client 07/09/2026). Flux :
// l'admin ajuste d'abord le devis + les détails via PATCH
// /service-requests/:id (aucun email), PUIS valide ici — c'est le seul point
// où un email de confirmation part vers le demandeur. sendEmail() n'est pas
// bloquant : un aléa SMTP ne doit pas faire échouer la validation.

const REQUEST_INCLUDE = {
  user: { select: { id: true, email: true } },
  items: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ServiceRequestInclude;

interface PricingTier {
  label: string;
  price: number;
}

function asTiers(value: unknown): PricingTier[] {
  return Array.isArray(value) ? (value as PricingTier[]) : [];
}

export async function createServiceRequest(userId: string, items: CartItemInput[], notes?: string) {
  // Un même service/palier ajouté deux fois ne fait qu'une ligne.
  const unique = [
    ...new Map(items.map((item) => [`${item.targetType}:${item.targetId}:${item.tierLabel ?? ''}`, item])).values(),
  ];

  const idsOf = (type: CartItemInput['targetType']) => unique.filter((i) => i.targetType === type).map((i) => i.targetId);
  const [services, spaces, plans] = await Promise.all([
    prisma.serviceCatalogItem.findMany({ where: { id: { in: idsOf('SERVICE') }, isActive: true } }),
    prisma.spaceResource.findMany({ where: { id: { in: idsOf('SPACE') }, isActive: true } }),
    prisma.membershipPlan.findMany({ where: { id: { in: idsOf('PLAN') }, isActive: true } }),
  ]);

  const lines: Prisma.ServiceRequestItemCreateWithoutRequestInput[] = unique.map((item) => {
    if (item.targetType === 'SERVICE') {
      const service = services.find((s) => s.id === item.targetId);
      if (!service) throw ApiError.notFound('Un des services de ta demande n’est plus disponible');
      if (!item.tierLabel) {
        return { targetType: 'SERVICE', service: { connect: { id: service.id } }, title: service.title };
      }
      const tier = asTiers(service.pricingTiers).find((t) => t.label === item.tierLabel);
      if (!tier) throw ApiError.notFound(`« ${item.tierLabel} » n’est plus proposé pour ${service.title}`);
      return {
        targetType: 'SERVICE',
        service: { connect: { id: service.id } },
        title: service.title,
        tierLabel: tier.label,
        unitPrice: tier.price,
      };
    }
    if (item.targetType === 'SPACE') {
      const space = spaces.find((s) => s.id === item.targetId);
      if (!space) throw ApiError.notFound('Une des salles de ta demande n’est plus disponible');
      return { targetType: 'SPACE', space: { connect: { id: space.id } }, title: space.name };
    }
    const plan = plans.find((p) => p.id === item.targetId);
    if (!plan) throw ApiError.notFound('Une des formules de ta demande n’est plus disponible');
    return {
      targetType: 'PLAN',
      plan: { connect: { id: plan.id } },
      title: plan.name,
      unitPrice: plan.price,
      priceUnit: plan.billingCycle,
    };
  });

  return prisma.serviceRequest.create({
    data: { userId, notes, items: { create: lines } },
    include: REQUEST_INCLUDE,
  });
}

function formatAmount(amount: unknown, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return `${value.toLocaleString('fr-FR')} ${currency}`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);

function confirmationEmailBody(items: RequestItemLike[], priceLine: string | null, details: string | null) {
  const list = items.map((item) => `<li>${escapeHtml(lineLabel(item))}</li>`).join('');
  return [
    '<p>Bonjour,</p>',
    `<p>Votre demande de devis a été prise en charge par l’équipe IN NETWORK. Elle porte sur :</p>`,
    `<ul>${list}</ul>`,
    priceLine ? `<p><strong>Devis :</strong> ${escapeHtml(priceLine)}</p>` : '',
    details ? `<p><strong>Détails :</strong><br>${escapeHtml(details).replace(/\n/g, '<br>')}</p>` : '',
    '<p>Nous revenons vers vous très rapidement pour la suite.</p>',
    '<p>L’équipe IN NETWORK</p>',
  ]
    .filter(Boolean)
    .join('');
}

export async function confirmServiceRequest(id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: REQUEST_INCLUDE,
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

  const label = requestLabel(request.items);
  const priceLine = request.quotedAmount != null ? formatAmount(request.quotedAmount, request.quotedCurrency) : null;

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: 'IN_PROGRESS', confirmedAt: new Date() },
    include: REQUEST_INCLUDE,
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
    html: confirmationEmailBody(request.items, priceLine, request.adminDetails),
  }).catch((err) => console.error('[service-requests] échec envoi email de confirmation', err));

  return updated;
}
