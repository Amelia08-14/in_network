import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/apiResponse';
import type { DocLineInput } from './quotes.service';
import type { StaffScope } from './scope';

// Lignes de devis et de proformas verrouillées sur le catalogue (demande client
// 25/10/2026) : seule la Direction crée des lignes libres ou change le libellé
// et le prix d'un service. Pour les autres comptes (Office Manager, équipe
// commerciale…), chaque ligne vient du catalogue — service, formule ou espace —
// avec son libellé et son prix ; seul le montant d'un service « sur devis »
// (sans prix au catalogue) est saisi. Quantités et remises restent libres
// (les remises suivent leur propre circuit de validation).

interface PricingTier {
  label: string;
  price: number;
}
const tiersOf = (value: unknown): PricingTier[] => (Array.isArray(value) ? (value as PricingTier[]) : []);
const same = (a: number, b: unknown) => b !== null && b !== undefined && Math.abs(a - Number(b)) < 0.005;

/** Libellé d'une ligne de service, tel que le panier du site le compose. */
export const serviceLineLabel = (title: string, tierLabel?: string | null) => (tierLabel ? `${title} — ${tierLabel}` : title);

export async function lockLinesToCatalogue(lines: DocLineInput[], scope: StaffScope | undefined): Promise<DocLineInput[]> {
  if (!scope || scope.direction) return lines;

  const ids = (key: 'serviceId' | 'planId' | 'spaceId') => lines.map((l) => l[key]).filter((id): id is string => Boolean(id));
  const [services, plans, spaces] = await Promise.all([
    prisma.serviceCatalogItem.findMany({ where: { id: { in: ids('serviceId') } }, select: { id: true, title: true, priceFrom: true, pricingTiers: true } }),
    prisma.membershipPlan.findMany({ where: { id: { in: ids('planId') } }, select: { id: true, name: true, price: true } }),
    prisma.spaceResource.findMany({ where: { id: { in: ids('spaceId') } } }),
  ]);

  return lines.map((line) => {
    if (line.serviceId) {
      const service = services.find((s) => s.id === line.serviceId);
      if (!service) throw ApiError.badRequest(`« ${line.description} » n’est plus au catalogue.`);
      const tiers = tiersOf(service.pricingTiers);
      if (line.tierLabel && !tiers.some((t) => t.label === line.tierLabel)) {
        throw ApiError.badRequest(`Formule inconnue pour « ${service.title} ».`);
      }
      // Service à formules reçu du panier sans formule : la ligne attend son
      // choix (prix à 0, l'envoi est bloqué tant qu'elle n'est pas chiffrée).
      if (!line.tierLabel && tiers.length) {
        if (line.unitPrice !== 0) throw ApiError.badRequest(`Choisissez la formule de « ${service.title} ».`);
        return { ...line, description: service.title };
      }
      const catalogPrice = line.tierLabel ? tiers.find((t) => t.label === line.tierLabel)?.price : service.priceFrom;
      const priced = catalogPrice !== null && catalogPrice !== undefined;
      return {
        ...line,
        description: serviceLineLabel(service.title, line.tierLabel),
        // Service sur devis : le montant est chiffré par l'intervenant.
        unitPrice: priced ? Number(catalogPrice) : line.unitPrice,
      };
    }
    if (line.planId) {
      const plan = plans.find((p) => p.id === line.planId);
      if (!plan) throw ApiError.badRequest(`« ${line.description} » n’est plus au catalogue.`);
      return { ...line, description: plan.name, unitPrice: Number(plan.price) };
    }
    if (line.spaceId) {
      const space = spaces.find((s) => s.id === line.spaceId);
      if (!space) throw ApiError.badRequest(`« ${line.description} » n’est plus au catalogue.`);
      const rates = [space.monthlyRate, space.hourlyRateMember, space.halfDayRateMember, space.dailyRateMember, space.hourlyRateExternal, space.halfDayRateExternal, space.dailyRateExternal];
      // Prix à 0 : salle demandée depuis le panier, tarif encore à choisir.
      if (line.unitPrice !== 0 && !rates.some((rate) => same(line.unitPrice, rate))) {
        throw ApiError.forbidden(`Le tarif de « ${space.name} » est celui du catalogue : seule la Direction peut le modifier.`);
      }
      // Le libellé précise la durée (« Salle Network — journée ») : on garde ce
      // complément, jamais un autre nom d'espace.
      return { ...line, description: line.description.startsWith(space.name) ? line.description : space.name };
    }
    throw ApiError.forbidden(`« ${line.description} » n’est pas au catalogue : seule la Direction peut ajouter une ligne libre.`);
  });
}
