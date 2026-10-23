'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { discountLabel, docTotals, money, netLine, type DocDiscountInput } from '@/lib/crm';
import type { DocLine } from '@/types/crm';

// Tableau de lignes partagé par les devis, les factures et les modèles :
// désignation, quantité, prix unitaire HT — avec totaux HT / TVA / TTC calculés
// à l'écran (le serveur les recalcule à l'enregistrement). Devis et factures
// passent `discount` : remise en % sur chaque ligne et remise sur le total.
export function LineItemsEditor({
  lines,
  onChange,
  vatRate,
  readOnly = false,
  discount,
  onDiscountChange,
}: {
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  vatRate: number;
  readOnly?: boolean;
  discount?: DocDiscountInput;
  onDiscountChange?: (discount: DocDiscountInput) => void;
}) {
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
                  ) : (
                    <Input aria-label={`Désignation ligne ${index + 1}`} className="h-9" value={line.description} onChange={(e) => update(index, { description: e.target.value })} />
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
                  {readOnly ? (
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
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { description: '', quantity: 1, unitPrice: 0 }])}>
              <Plus className="h-4 w-4" /> Ajouter une ligne
            </Button>
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
