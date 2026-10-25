import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env';
import { amountInWords, formatAmount, netLineAmount, round2 } from './money';

// Rendu PDF des devis et des factures (polices PDF standard : pas de fichier
// de police à déployer). Mise en page A4 sobre : émetteur / titre, client,
// tableau des lignes, totaux HT / TVA / TTC, montant en lettres, mentions.

export interface PdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
}

export interface PdfDocumentInput {
  /** PROFORMA = facture proforma à régler (processus v1.3) ; INVOICE = facture définitive. */
  kind: 'QUOTE' | 'PROFORMA' | 'INVOICE';
  number: string;
  /** Date d'émission (facture) ou de création (devis). */
  date: Date;
  /** Échéance (facture) ou fin de validité (devis). */
  dueDate?: Date | null;
  customer: {
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    nif?: string | null;
    rc?: string | null;
    ai?: string | null;
  };
  lines: PdfLine[];
  vatRate: number;
  /** Total HT net (remises déduites). */
  subtotal: number;
  /** Libellé de la remise sur le total, s'il y en a une (« Remise (5 %) »). */
  discountLabel?: string;
  vatAmount: number;
  total: number;
  notes?: string | null;
  /** Filigrane : « PAYÉE », « ANNULÉE »… */
  stamp?: string | null;
  paymentInfo?: string | null;
}

// Couleurs de la charte Bleu Nuit (26/10/2026) : bleu nuit #001042, orange #D44835.
const INK = '#001042';
const MUTED = '#5F6886';
const ACCENT = '#D44835';
const LINE = '#E2DCE8';
const LOGO_PATH = path.resolve(__dirname, '../../../assets/logo-in-network.png');
const MARGIN = 48;

const formatDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function renderDocumentPdf(input: PdfDocumentInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: `${input.number}`, Author: env.company.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - MARGIN * 2;
    const isInvoice = input.kind !== 'QUOTE';
    const title = input.kind === 'INVOICE' ? 'FACTURE' : input.kind === 'PROFORMA' ? 'FACTURE PROFORMA' : 'DEVIS';

    // --- En-tête : émetteur (gauche) / titre + numéro (droite)
    // Logo officiel (assets/logo-in-network.png, 1400×759) ; repli sur le nom seul s'il manque.
    let textTop = MARGIN;
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, MARGIN, { width: 112 });
      textTop = MARGIN + 66;
    }
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(env.company.name, MARGIN, textTop, { width: contentWidth * 0.6 });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(env.company.address, { width: contentWidth * 0.6 });
    doc.text(`${env.company.phone}  ·  ${env.company.email}`, { width: contentWidth * 0.6 });
    const legal = [
      env.company.nif && `NIF : ${env.company.nif}`,
      env.company.rc && `RC : ${env.company.rc}`,
      env.company.ai && `AI : ${env.company.ai}`,
      env.company.nis && `NIS : ${env.company.nis}`,
    ].filter(Boolean);
    if (legal.length) doc.text(legal.join('  ·  '), { width: contentWidth * 0.6 });
    // Bas du bloc émetteur (le logo l'allonge) : le client commence sous la colonne la plus haute.
    const issuerBottom = doc.y;

    doc.font('Helvetica-Bold').fontSize(22).fillColor(ACCENT).text(title, MARGIN, MARGIN, { width: contentWidth, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`N° ${input.number}`, { width: contentWidth, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(`${isInvoice ? 'Date d’émission' : 'Date'} : ${formatDate(input.date)}`, { width: contentWidth, align: 'right' });
    if (input.dueDate) {
      doc.text(`${isInvoice ? 'Échéance' : 'Valable jusqu’au'} : ${formatDate(input.dueDate)}`, { width: contentWidth, align: 'right' });
    }

    // --- Client
    let y = Math.max(doc.y, issuerBottom, MARGIN + 80) + 24;
    doc.moveTo(MARGIN, y - 10).lineTo(pageWidth - MARGIN, y - 10).strokeColor(LINE).lineWidth(0.8).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(isInvoice ? 'FACTURÉ À' : 'DESTINATAIRE', MARGIN, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(input.customer.company || input.customer.name, MARGIN, y + 13, { width: contentWidth * 0.6 });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (input.customer.company) doc.text(`À l’attention de ${input.customer.name}`);
    if (input.customer.address) doc.text(input.customer.address);
    const contact = [input.customer.email, input.customer.phone].filter(Boolean).join('  ·  ');
    if (contact) doc.text(contact);
    const customerLegal = [
      input.customer.nif && `NIF : ${input.customer.nif}`,
      input.customer.rc && `RC : ${input.customer.rc}`,
      input.customer.ai && `AI : ${input.customer.ai}`,
    ].filter(Boolean);
    if (customerLegal.length) doc.text(customerLegal.join('  ·  '));

    // --- Tableau des lignes
    y = doc.y + 22;
    // Colonne « Remise » seulement si une ligne en porte une.
    const lineDiscounts = input.lines.some((line) => (line.discountRate ?? 0) > 0);
    const cols = lineDiscounts
      ? { desc: MARGIN, qty: MARGIN + contentWidth * 0.44, unit: MARGIN + contentWidth * 0.53, disc: MARGIN + contentWidth * 0.71, total: MARGIN + contentWidth * 0.82 }
      : { desc: MARGIN, qty: MARGIN + contentWidth * 0.52, unit: MARGIN + contentWidth * 0.62, disc: 0, total: MARGIN + contentWidth * 0.82 };
    const widths = lineDiscounts
      ? { desc: contentWidth * 0.42, qty: contentWidth * 0.07, unit: contentWidth * 0.17, disc: contentWidth * 0.1, total: contentWidth * 0.18 }
      : { desc: contentWidth * 0.5, qty: contentWidth * 0.08, unit: contentWidth * 0.18, disc: 0, total: contentWidth * 0.18 };

    const drawHeader = (top: number) => {
      doc.rect(MARGIN, top, contentWidth, 22).fill(INK);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
      doc.text('DÉSIGNATION', cols.desc + 8, top + 7, { width: widths.desc });
      doc.text('QTÉ', cols.qty, top + 7, { width: widths.qty, align: 'right' });
      doc.text('PRIX UNIT. HT', cols.unit, top + 7, { width: widths.unit, align: 'right' });
      if (lineDiscounts) doc.text('REMISE', cols.disc, top + 7, { width: widths.disc, align: 'right' });
      doc.text('TOTAL HT', cols.total, top + 7, { width: widths.total - 8, align: 'right' });
      return top + 22;
    };

    y = drawHeader(y);
    doc.font('Helvetica').fontSize(9.5);
    input.lines.forEach((line, index) => {
      const descHeight = doc.heightOfString(line.description, { width: widths.desc - 8 });
      const rowHeight = Math.max(descHeight, 12) + 14;
      if (y + rowHeight > doc.page.height - 200) {
        doc.addPage();
        y = drawHeader(MARGIN);
        doc.font('Helvetica').fontSize(9.5);
      }
      if (index % 2 === 1) doc.rect(MARGIN, y, contentWidth, rowHeight).fill('#F6F2F9');
      doc.fillColor(INK);
      doc.text(line.description, cols.desc + 8, y + 7, { width: widths.desc - 8 });
      doc.text(String(line.quantity).replace('.', ','), cols.qty, y + 7, { width: widths.qty, align: 'right' });
      doc.text(formatAmount(line.unitPrice), cols.unit, y + 7, { width: widths.unit, align: 'right' });
      if (lineDiscounts && line.discountRate) doc.text(`-${String(line.discountRate).replace('.', ',')} %`, cols.disc, y + 7, { width: widths.disc, align: 'right' });
      doc.text(formatAmount(netLineAmount(line)), cols.total, y + 7, { width: widths.total - 8, align: 'right' });
      y += rowHeight;
    });
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(LINE).lineWidth(0.8).stroke();

    // --- Totaux
    if (y > doc.page.height - 190) {
      doc.addPage();
      y = MARGIN;
    }
    y += 14;
    const boxX = MARGIN + contentWidth * 0.55;
    const boxW = contentWidth * 0.45;
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(INK);
      doc.text(label, boxX, y, { width: boxW * 0.5 });
      doc.text(value, boxX + boxW * 0.4, y, { width: boxW * 0.6, align: 'right' });
      y += bold ? 20 : 16;
    };
    // Les remises de ligne sont déjà dans chaque « Total HT » ; la remise sur
    // le total s'affiche entre le total des lignes et le HT net.
    const linesNet = round2(input.lines.reduce((sum, line) => sum + netLineAmount(line), 0));
    const globalDiscount = round2(linesNet - input.subtotal);
    if (globalDiscount > 0) {
      row('Total HT', formatAmount(linesNet));
      row(input.discountLabel ?? 'Remise sur le total', `-${formatAmount(globalDiscount)}`);
      row('Total HT net', formatAmount(input.subtotal));
    } else {
      row('Total HT', formatAmount(input.subtotal));
    }
    row(`TVA (${String(input.vatRate).replace('.', ',')} %)`, formatAmount(input.vatAmount));
    doc.moveTo(boxX, y - 2).lineTo(pageWidth - MARGIN, y - 2).strokeColor(INK).lineWidth(1).stroke();
    y += 4;
    row('Total TTC', formatAmount(input.total), true);

    // --- Montant en lettres, paiement, notes
    y += 8;
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED);
    const words = `${isInvoice ? 'Arrêtée la présente facture' : 'Arrêté le présent devis'} à la somme de : ${amountInWords(input.total)} (TTC).`;
    doc.text(words, MARGIN, y, { width: contentWidth });
    y = doc.y + 10;

    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (input.paymentInfo) {
      doc.text(input.paymentInfo, MARGIN, y, { width: contentWidth });
      y = doc.y + 6;
    } else if (isInvoice && env.company.rib) {
      doc.text(`Règlement par virement — ${env.company.rib}`, MARGIN, y, { width: contentWidth });
      y = doc.y + 6;
    }
    if (input.notes) {
      doc.font('Helvetica-Bold').fillColor(INK).text('Notes', MARGIN, y);
      doc.font('Helvetica').fillColor(MUTED).text(input.notes, { width: contentWidth });
    }

    // --- Filigrane
    if (input.stamp) {
      doc.save();
      doc.rotate(-18, { origin: [pageWidth / 2, 330] });
      doc.font('Helvetica-Bold').fontSize(64).fillColor(ACCENT).fillOpacity(0.13);
      doc.text(input.stamp, 0, 300, { width: pageWidth, align: 'center' });
      doc.restore();
    }

    doc.end();
  });
}

/** Libellé de la remise sur le total : « Remise (5 %) » ou « Remise sur le total ». */
export function discountLabel(doc: { discountType: string | null; discountValue: unknown }) {
  return doc.discountType === 'PERCENT' ? `Remise (${String(Number(doc.discountValue)).replace('.', ',')} %)` : 'Remise sur le total';
}
