'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/crm';
import type { DocLine } from '@/types/crm';

// Tableau de lignes partagé par les devis, les factures et les modèles :
// désignation, quantité, prix unitaire HT — avec totaux HT / TVA / TTC calculés
// à l'écran (le serveur les recalcule à l'enregistrement).
export function LineItemsEditor({
  lines,
  onChange,
  vatRate,
  readOnly = false,
}: {
  lines: DocLine[];
  onChange: (lines: DocLine[]) => void;
  vatRate: number;
  readOnly?: boolean;
}) {
  const update = (index: number, patch: Partial<DocLine>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const subtotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const vat = Math.round(subtotal * vatRate) / 100;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-ink-900/8">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-ink-900/3 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2.5">Désignation</th>
              <th className="w-24 px-3 py-2.5">Qté</th>
              <th className="w-36 px-3 py-2.5">Prix unit. HT</th>
              <th className="w-36 px-3 py-2.5 text-right">Total HT</th>
              {!readOnly && <th className="w-10 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/8">
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
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
                <td className="px-3 py-2 text-right font-medium tabular-nums text-ink-900">{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</td>
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
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { description: '', quantity: 1, unitPrice: 0 }])}>
            <Plus className="h-4 w-4" /> Ajouter une ligne
          </Button>
        ) : (
          <span />
        )}
        <dl className="min-w-56 space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-ink-500">Total HT</dt>
            <dd className="tabular-nums">{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-ink-500">TVA ({vatRate} %)</dt>
            <dd className="tabular-nums">{money(vat)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-ink-900/10 pt-1.5 font-heading text-base font-bold text-ink-900">
            <dt>Total TTC</dt>
            <dd className="tabular-nums">{money(subtotal + vat)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
