'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/admin-api';
import { discountLabel, docTotals, money, netLine, type DocDiscountInput } from '@/lib/crm';
import type { DocLine } from '@/types/crm';
import type { MembershipPlan, ServiceCatalogItem, SpaceResource } from '@/types';

// Catalogue proposé dans les devis et proformas (services, formules, espaces).
interface Catalogue {
  services: ServiceCatalogItem[];
  plans: MembershipPlan[];
  spaces: SpaceResource[];
}

function useCatalogue(enabled: boolean) {
  return useQuery({
    queryKey: ['doc-catalogue'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Catalogue> => {
      const [services, plans, spaces] = await Promise.all([
        api.get<{ data: ServiceCatalogItem[] }>('/api/services').then((r) => r.data),
        api.get<{ data: MembershipPlan[] }>('/api/plans').then((r) => r.data),
        api.get<{ data: SpaceResource[] }>('/api/spaces').then((r) => r.data),
      ]);
      return { services, plans, spaces };
    },
  });
}

const SPACE_RATES: { key: keyof SpaceResource; label: string }[] = [
  { key: 'monthlyRate', label: 'mois' },
  { key: 'hourlyRateMember', label: 'heure (membre)' },
  { key: 'halfDayRateMember', label: 'demi-journée (membre)' },
  { key: 'dailyRateMember', label: 'journée (membre)' },
  { key: 'hourlyRateExternal', label: 'heure (externe)' },
  { key: 'halfDayRateExternal', label: 'demi-journée (externe)' },
  { key: 'dailyRateExternal', label: 'journée (externe)' },
];
const spaceRates = (space: SpaceResource) =>
  SPACE_RATES.filter((r) => space[r.key] !== null && space[r.key] !== undefined).map((r) => ({ label: r.label, price: Number(space[r.key]) }));

/** Prix fixé par le catalogue pour cette ligne de service (null : sur devis, à chiffrer). */
function servicePrice(line: DocLine, catalogue: Catalogue | undefined): number | null {
  const service = catalogue?.services.find((s) => s.id === line.serviceId);
  if (!service) return null;
  const tiers = service.pricingTiers ?? [];
  if (line.tierLabel) return tiers.find((t) => t.label === line.tierLabel)?.price ?? null;
  if (tiers.length) return 0;
  return service.priceFrom !== null ? Number(service.priceFrom) : null;
}

/** Ajoute une ligne du catalogue : le libellé et le prix viennent du catalogue. */
function CataloguePicker({ catalogue, onPick }: { catalogue: Catalogue | undefined; onPick: (line: DocLine) => void }) {
  const pick = (value: string) => {
    if (!catalogue || !value) return;
    const [kind, id] = value.split(':');
    if (kind === 'service') {
      const service = catalogue.services.find((s) => s.id === id);
      if (!service) return;
      const tier = (service.pricingTiers ?? [])[0];
      onPick({
        description: tier ? `${service.title} — ${tier.label}` : service.title,
        quantity: 1,
        unitPrice: tier ? tier.price : service.priceFrom !== null ? Number(service.priceFrom) : 0,
        serviceId: service.id,
        tierLabel: tier?.label ?? null,
      });
    } else if (kind === 'plan') {
      const plan = catalogue.plans.find((p) => p.id === id);
      if (plan) onPick({ description: plan.name, quantity: 1, unitPrice: Number(plan.price), planId: plan.id });
    } else {
      const space = catalogue.spaces.find((s) => s.id === id);
      if (!space) return;
      const rate = spaceRates(space)[0];
      onPick({ description: rate ? `${space.name} — ${rate.label}` : space.name, quantity: 1, unitPrice: rate?.price ?? 0, spaceId: space.id });
    }
  };
  return (
    <Select aria-label="Ajouter une ligne du catalogue" className="h-9 w-72" value="" onChange={(e) => pick(e.target.value)} disabled={!catalogue}>
      <option value="">{catalogue ? '+ Ajouter depuis le catalogue…' : 'Chargement du catalogue…'}</option>
      {catalogue && (
        <>
          <optgroup label="Services">
            {catalogue.services.map((s) => (
              <option key={s.id} value={`service:${s.id}`}>
                {s.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Formules et abonnements">
            {catalogue.plans.map((p) => (
              <option key={p.id} value={`plan:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Salles et bureaux">
            {catalogue.spaces.map((sp) => (
              <option key={sp.id} value={`space:${sp.id}`}>
                {sp.name}
              </option>
            ))}
          </optgroup>
        </>
      )}
    </Select>
  );
}

/** Formule d'un service à paliers, ou tarif d'un espace : choix limité au catalogue. */
function CatalogueVariant({ line, catalogue, onChange }: { line: DocLine; catalogue: Catalogue | undefined; onChange: (patch: Partial<DocLine>) => void }) {
  if (!catalogue) return null;
  if (line.serviceId) {
    const service = catalogue.services.find((s) => s.id === line.serviceId);
    const tiers = service?.pricingTiers ?? [];
    if (!service || tiers.length === 0) return null;
    return (
      <Select
        aria-label="Formule"
        className="mt-1.5 h-8 text-xs"
        value={line.tierLabel ?? ''}
        onChange={(e) => {
          const tier = tiers.find((t) => t.label === e.target.value);
          onChange(tier ? { tierLabel: tier.label, unitPrice: tier.price, description: `${service.title} — ${tier.label}` } : { tierLabel: null, unitPrice: 0, description: service.title });
        }}
      >
        <option value="">Choisir la formule…</option>
        {tiers.map((t) => (
          <option key={t.label} value={t.label}>
            {t.label} — {money(t.price)}
          </option>
        ))}
      </Select>
    );
  }
  if (line.spaceId) {
    const space = catalogue.spaces.find((s) => s.id === line.spaceId);
    if (!space) return null;
    const rates = spaceRates(space);
    const current = rates.find((r) => Math.abs(r.price - Number(line.unitPrice)) < 0.005 && line.description.endsWith(r.label));
    return (
      <Select
        aria-label="Tarif"
        className="mt-1.5 h-8 text-xs"
        value={current?.label ?? ''}
        onChange={(e) => {
          const rate = rates.find((r) => r.label === e.target.value);
          if (rate) onChange({ unitPrice: rate.price, description: `${space.name} — ${rate.label}` });
        }}
      >
        <option value="">Choisir le tarif…</option>
        {rates.map((r) => (
          <option key={r.label} value={r.label}>
            {r.label} — {money(r.price)}
          </option>
        ))}
      </Select>
    );
  }
  return null;
}

// Tableau de lignes partagé par les devis, les factures et les modèles :
// désignation, quantité, prix unitaire HT — avec totaux HT / TVA / TTC calculés
// à l'écran (le serveur les recalcule à l'enregistrement). Devis et factures
// passent `discount` : remise en % sur chaque ligne et remise sur le total.
// `catalogue` propose d'ajouter une ligne du catalogue ; `locked` (comptes hors
// Direction) n'autorise que celles-ci : libellé et prix du catalogue, seul le
// montant d'un service « sur devis » se saisit (le serveur applique la règle).
export function LineItemsEditor({
  lines,
  onChange,
  vatRate,
  readOnly = false,
  discount,
  onDiscountChange,
  catalogue: withCatalogue = false,
  locked = false,
}: {
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  vatRate: number;
  readOnly?: boolean;
  discount?: DocDiscountInput;
  onDiscountChange?: (discount: DocDiscountInput) => void;
  catalogue?: boolean;
  locked?: boolean;
}) {
  const { data: catalogue } = useCatalogue((withCatalogue || locked) && !readOnly);
  // Prix verrouillé : formules, espaces et services à prix fixe (pas les « sur devis »).
  const priceLocked = (line: DocLine) => locked && Boolean(line.planId || line.spaceId || !line.serviceId || servicePrice(line, catalogue) !== null);
  const update = (index: number, patch: Partial<DocLine>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const withDiscounts = discount !== undefined;
  // En lecture seule, la colonne n'apparaît que si une ligne porte une remise.
  const showLineDiscount = withDiscounts && (!readOnly || lines.some((l) => Number(l.discountRate) > 0));
  const totals = docTotals(lines, vatRate, discount);
  const columns = 4 + (showLineDiscount ? 1 : 0) + (readOnly ? 0 : 1);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-ink-900/8">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-ink-900/3 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2.5">Désignation</th>
              <th className="w-24 px-3 py-2.5">Qté</th>
              <th className="w-36 px-3 py-2.5">Prix unit. HT</th>
              {showLineDiscount && <th className="w-24 px-3 py-2.5">Remise %</th>}
              <th className="w-36 px-3 py-2.5 text-right">Total HT</th>
              {!readOnly && <th className="w-10 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/8">
            {lines.length === 0 && (
              <tr>
                <td colSpan={columns} className="px-3 py-6 text-center text-ink-500">
                  Aucune ligne pour l’instant.
                </td>
              </tr>
            )}
            {lines.map((line, index) => (
              <tr key={line.id ?? index}>
                <td className="px-3 py-2">
                  {readOnly ? (
                    line.description
                  ) : locked ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-ink-900">
                        <Lock className="h-3 w-3 shrink-0 text-ink-400" aria-label="Libellé du catalogue" />
                        {line.description}
                      </span>
                      <CatalogueVariant line={line} catalogue={catalogue} onChange={(patch) => update(index, patch)} />
                    </>
                  ) : (
                    <>
                      <Input aria-label={`Désignation ligne ${index + 1}`} className="h-9" value={line.description} onChange={(e) => update(index, { description: e.target.value })} />
                      <CatalogueVariant line={line} catalogue={catalogue} onChange={(patch) => update(index, patch)} />
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    String(line.quantity)
                  ) : (
                    <Input aria-label={`Quantité ligne ${index + 1}`} className="h-9" type="number" min="0" step="any" value={line.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly || priceLocked(line) ? (
                    money(line.unitPrice)
                  ) : (
                    <Input aria-label={`Prix unitaire ligne ${index + 1}`} className="h-9" type="number" min="0" step="any" value={line.unitPrice} onChange={(e) => update(index, { unitPrice: e.target.value })} />
                  )}
                </td>
                {showLineDiscount && (
                  <td className="px-3 py-2">
                    {readOnly ? (
                      Number(line.discountRate) > 0 ? `-${Number(line.discountRate)} %` : '—'
                    ) : (
                      <Input aria-label={`Remise en % ligne ${index + 1}`} className="h-9" type="number" min="0" max="100" step="any" placeholder="0" value={Number(line.discountRate) ? line.discountRate : ''} onChange={(e) => update(index, { discountRate: e.target.value })} />
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-right font-medium tabular-nums text-ink-900">{money(netLine(line))}</td>
                {!readOnly && (
                  <td className="px-2 py-2">
                    <button type="button" aria-label={`Supprimer la ligne ${index + 1}`} onClick={() => onChange(lines.filter((_, i) => i !== index))} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-orange/10 hover:text-brand-orange">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {(withCatalogue || locked) && <CataloguePicker catalogue={catalogue} onPick={(line) => onChange([...lines, line])} />}
              {!locked && (
                <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { description: '', quantity: 1, unitPrice: 0 }])}>
                  <Plus className="h-4 w-4" /> {withCatalogue ? 'Ligne libre' : 'Ajouter une ligne'}
                </Button>
              )}
            </div>
          )}
          {locked && !readOnly && (
            <p className="max-w-md text-xs text-ink-500">Libellés et prix viennent du catalogue, modifié par la Direction. Vous chiffrez les services « sur devis » et pouvez accorder une remise.</p>
          )}
          {withDiscounts && !readOnly && onDiscountChange && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-600">Remise sur le total</span>
              <Select
                aria-label="Type de remise sur le total"
                className="h-9 w-32"
                value={discount.type ?? ''}
                onChange={(e) => onDiscountChange({ type: (e.target.value || null) as DocDiscountInput['type'], value: e.target.value ? discount.value : 0 })}
              >
                <option value="">Aucune</option>
                <option value="PERCENT">En %</option>
                <option value="AMOUNT">En DA (HT)</option>
              </Select>
              {discount.type && (
                <Input
                  aria-label={discount.type === 'PERCENT' ? 'Remise sur le total en %' : 'Remise sur le total en DA'}
                  className="h-9 w-32"
                  type="number"
                  min="0"
                  max={discount.type === 'PERCENT' ? 100 : undefined}
                  step="any"
                  value={discount.value}
                  onChange={(e) => onDiscountChange({ type: discount.type, value: e.target.value })}
                />
              )}
            </div>
          )}
        </div>
        <dl className="min-w-56 space-y-1 text-sm">
          {totals.globalDiscount > 0 && discount ? (
            <>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-500">Total HT</dt>
                <dd className="tabular-nums">{money(totals.linesNet)}</dd>
              </div>
              <div className="flex justify-between gap-6 text-brand-orange">
                <dt>{discountLabel(discount)}</dt>
                <dd className="tabular-nums">-{money(totals.globalDiscount)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-500">Total HT net</dt>
                <dd className="tabular-nums">{money(totals.subtotal)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-6">
              <dt className="text-ink-500">Total HT</dt>
              <dd className="tabular-nums">{money(totals.subtotal)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-ink-500">TVA ({vatRate} %)</dt>
            <dd className="tabular-nums">{money(totals.vat)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-ink-900/10 pt-1.5 font-heading text-base font-bold text-ink-900">
            <dt>Total TTC</dt>
            <dd className="tabular-nums">{money(totals.total)}</dd>
          </div>
          {withDiscounts && totals.discountAmount > 0 && (
            <p className="pt-1 text-right text-xs text-ink-500">
              Remise accordée : {money(totals.discountAmount)} HT, soit {Math.round((totals.discountAmount / totals.gross) * 1000) / 10} % du prix catalogue
            </p>
          )}
        </dl>
      </div>
    </div>
  );
}
