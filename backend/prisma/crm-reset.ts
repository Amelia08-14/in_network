import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from '../src/config/env';
import { CHANNEL_LABEL, PIPELINE_LABEL, STAGE_LABEL } from '../src/modules/crm/workflow';

// Remise à zéro du CRM (demande du 24/11/2026) : l'équipe repart sur un CRM
// propre avec le nouveau parcours (tout prospect chez l'Office Manager).
//
//   npm run crm:reset
//
// 1. SAUVEGARDE dans backups/crm-reset-<date>/ :
//      • base-complete.sql   dump MySQL complet (si mysqldump est installé)
//      • crm.json            toutes les lignes des tables du CRM, telles quelles
//      • crm.xlsx            classeur lisible : clients et prospects, membres,
//                            devis, proformas/factures, journal, agenda, reçus,
//                            services lancés, commissions, demandes du site
//    Si la sauvegarde échoue, rien n'est supprimé.
// 2. REMISE À ZÉRO — on garde tout ce qui a été PAYÉ :
//      • factures payées (ou remboursées) avec leurs lignes, les services
//        lancés et les commissions qui en découlent ;
//      • les devis qui ont donné ces factures, et les prospects concernés
//        (passés à « Payé », sans tâche ouverte) ;
//      • les reçus de paiement acceptés de ces factures / devis.
//    Tout le reste du circuit commercial est supprimé : prospects en cours ou
//    perdus, journal, agenda, devis et proformas non payés, reçus en attente,
//    demandes de devis du site et messages de contact, notifications CRM.
//    Comptes (membres, équipe), catalogue, espaces, événements : intacts.
//    La numérotation des devis / factures continue (DocumentSequence intact).

const KEPT_INVOICE = ['PAID', 'REFUNDED'] as const;

const MEMBER_CRM_NOTIFICATIONS = [
  'quote_received',
  'quote_in_review',
  'quote_reminder',
  'quote_expired',
  'quote_returned',
  'proforma_received',
  'payment_proof_accepted',
  'payment_proof_rejected',
  'invoice_overdue',
];

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.databaseUrl) });

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
};
const fmtDate = (value: Date | null | undefined) => (value ? value.toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' }) : '');
const amount = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function mysqldump(file: string) {
  const url = new URL(env.databaseUrl);
  const result = spawnSync(
    'mysqldump',
    [
      `--host=${url.hostname}`,
      `--port=${url.port || '3306'}`,
      `--user=${decodeURIComponent(url.username)}`,
      '--single-transaction',
      '--routines',
      `--result-file=${file}`,
      decodeURIComponent(url.pathname.replace(/^\//, '')),
    ],
    // Mot de passe par variable d'environnement : jamais visible dans la liste des processus.
    { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, encoding: 'utf8' },
  );
  if (result.error) return `non fait (${result.error.message}) — la sauvegarde JSON + Excel reste complète pour le CRM`;
  if (result.status !== 0) return `ÉCHEC (${result.stderr.trim()}) — la sauvegarde JSON + Excel reste complète pour le CRM`;
  return 'ok';
}

async function loadAll() {
  const [leads, activities, appointments, circuitChanges, quotes, invoices, serviceOrders, commissions, proofs, serviceRequests, contactMessages, notifications, members, staff] =
    await Promise.all([
      prisma.lead.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.leadActivity.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.appointment.findMany({ orderBy: { startAt: 'asc' } }),
      prisma.leadCircuitChange.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.quote.findMany({ include: { lines: true }, orderBy: { createdAt: 'asc' } }),
      prisma.invoice.findMany({ include: { lines: true }, orderBy: { createdAt: 'asc' } }),
      prisma.serviceOrder.findMany({ include: { tasks: true }, orderBy: { createdAt: 'asc' } }),
      prisma.commission.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.paymentProof.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.serviceRequest.findMany({ include: { items: true }, orderBy: { createdAt: 'asc' } }),
      prisma.contactMessage.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.notification.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.user.findMany({
        where: { role: 'MEMBER' },
        select: { id: true, displayName: true, email: true, phone: true, isActive: true, createdAt: true, company: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({ where: { role: { not: 'MEMBER' } }, select: { id: true, displayName: true, email: true, role: true } }),
    ]);
  return { leads, activities, appointments, circuitChanges, quotes, invoices, serviceOrders, commissions, proofs, serviceRequests, contactMessages, notifications, members, staff };
}

type Data = Awaited<ReturnType<typeof loadAll>>;

function planReset(data: Data) {
  const keptInvoices = data.invoices.filter((i) => (KEPT_INVOICE as readonly string[]).includes(i.status));
  const keptInvoiceIds = new Set(keptInvoices.map((i) => i.id));
  const keptQuoteIds = new Set(keptInvoices.map((i) => i.quoteId).filter((id): id is string => !!id));
  const keptLeadIds = new Set<string>([
    ...data.leads.filter((l) => l.stage === 'PAID').map((l) => l.id),
    ...keptInvoices.map((i) => i.leadId).filter((id): id is string => !!id),
    ...data.quotes.filter((q) => keptQuoteIds.has(q.id)).map((q) => q.leadId),
  ]);
  const keptProofIds = new Set(
    data.proofs
      .filter((p) => p.status === 'ACCEPTED' && ((p.invoiceId && keptInvoiceIds.has(p.invoiceId)) || (p.quoteId && keptQuoteIds.has(p.quoteId))))
      .map((p) => p.id),
  );
  return { keptInvoiceIds, keptQuoteIds, keptLeadIds, keptProofIds, keptInvoices };
}

async function writeWorkbook(file: string, data: Data, plan: ReturnType<typeof planReset>) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IN NETWORK — sauvegarde CRM';
  wb.created = new Date();

  const staffName = (id: string | null | undefined) => {
    if (!id) return '';
    const u = data.staff.find((s) => s.id === id) ?? data.members.find((m) => m.id === id);
    return u ? u.displayName || u.email : id;
  };
  const leadRef = (id: string | null | undefined) => (id ? data.leads.find((l) => l.id === id)?.reference ?? '' : '');
  const quoteNum = (id: string | null | undefined) => (id ? data.quotes.find((q) => q.id === id)?.number ?? '' : '');
  const invoiceNum = (id: string | null | undefined) => {
    const inv = id ? data.invoices.find((i) => i.id === id) : undefined;
    return inv ? inv.number ?? inv.proformaNumber ?? '' : '';
  };
  const kept = (yes: boolean) => (yes ? 'Conservé (payé)' : 'Supprimé');

  function sheet(name: string, columns: { header: string; key: string; width?: number }[], rows: Record<string, unknown>[]) {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ ...c, width: c.width ?? 18 }));
    ws.addRows(rows);
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001042' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  sheet(
    'Clients et prospects',
    [
      { header: 'Référence', key: 'ref', width: 14 },
      { header: 'Contact', key: 'contact', width: 26 },
      { header: 'Entreprise', key: 'company', width: 24 },
      { header: 'E-mail', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Objet', key: 'title', width: 36 },
      { header: 'Étape', key: 'stage', width: 18 },
      { header: 'Offre', key: 'pipeline', width: 22 },
      { header: 'Canal', key: 'channel', width: 18 },
      { header: 'Suivi par', key: 'owner', width: 22 },
      { header: 'Commercial', key: 'agent', width: 22 },
      { header: 'Montant attendu (DA)', key: 'expected', width: 16 },
      { header: 'Devis', key: 'quotes', width: 24 },
      { header: 'Factures / proformas', key: 'invoices', width: 26 },
      { header: 'Total payé (DA)', key: 'paid', width: 16 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Motif de perte', key: 'lost', width: 26 },
      { header: 'Créé le', key: 'created', width: 18 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.leads.map((l) => {
      const invoices = data.invoices.filter((i) => i.leadId === l.id);
      return {
        ref: l.reference,
        contact: l.contactName,
        company: l.companyName ?? '',
        email: l.email ?? '',
        phone: l.phone ?? '',
        title: l.title,
        stage: STAGE_LABEL[l.stage] ?? l.stage,
        pipeline: l.pipeline ? PIPELINE_LABEL[l.pipeline] : '',
        channel: l.channel ? CHANNEL_LABEL[l.channel] : '',
        owner: staffName(l.assignedToId),
        agent: staffName(l.salesAgentId),
        expected: amount(l.expectedAmount),
        quotes: data.quotes.filter((q) => q.leadId === l.id).map((q) => `${q.number} (${q.status})`).join(', '),
        invoices: invoices.map((i) => `${i.number ?? i.proformaNumber ?? '—'} (${i.status})`).join(', '),
        paid: invoices.filter((i) => i.status === 'PAID').reduce((t, i) => t + Number(i.total), 0) || null,
        notes: l.notes ?? '',
        lost: l.lostReason ?? '',
        created: fmtDate(l.createdAt),
        kept: kept(plan.keptLeadIds.has(l.id)),
      };
    }),
  );

  sheet(
    'Membres',
    [
      { header: 'Nom', key: 'name', width: 26 },
      { header: 'E-mail', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Entreprise', key: 'company', width: 24 },
      { header: 'Actif', key: 'active', width: 8 },
      { header: 'Inscrit le', key: 'created', width: 18 },
      { header: 'Prospect lié', key: 'lead', width: 14 },
    ],
    data.members.map((m) => ({
      name: m.displayName ?? '',
      email: m.email,
      phone: m.phone ?? '',
      company: m.company?.name ?? '',
      active: m.isActive ? 'oui' : 'non',
      created: fmtDate(m.createdAt),
      lead: data.leads.filter((l) => l.userId === m.id).map((l) => l.reference).join(', '),
    })),
  );

  sheet(
    'Devis',
    [
      { header: 'Numéro', key: 'number', width: 16 },
      { header: 'Prospect', key: 'lead', width: 14 },
      { header: 'Client', key: 'client', width: 26 },
      { header: 'Statut', key: 'status', width: 16 },
      { header: 'Sous-total (DA)', key: 'subtotal', width: 16 },
      { header: 'Remise (DA)', key: 'discount', width: 14 },
      { header: 'Total TTC (DA)', key: 'total', width: 16 },
      { header: 'Lignes', key: 'lines', width: 60 },
      { header: 'Envoyé le', key: 'sent', width: 18 },
      { header: 'Accepté le', key: 'accepted', width: 18 },
      { header: 'Créé par', key: 'by', width: 22 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.quotes.map((q) => ({
      number: q.number,
      lead: leadRef(q.leadId),
      client: data.leads.find((l) => l.id === q.leadId)?.contactName ?? '',
      status: q.status,
      subtotal: amount(q.subtotal),
      discount: amount(q.discountAmount),
      total: amount(q.total),
      lines: q.lines.map((li) => `${li.description} × ${Number(li.quantity)} @ ${Number(li.unitPrice)}`).join(' | '),
      sent: fmtDate(q.sentAt),
      accepted: fmtDate(q.acceptedAt),
      by: staffName(q.createdById),
      kept: kept(plan.keptQuoteIds.has(q.id)),
    })),
  );

  sheet(
    'Proformas et factures',
    [
      { header: 'Facture', key: 'number', width: 16 },
      { header: 'Proforma', key: 'proforma', width: 16 },
      { header: 'Prospect', key: 'lead', width: 14 },
      { header: 'Devis', key: 'quote', width: 16 },
      { header: 'Client', key: 'client', width: 26 },
      { header: 'Entreprise', key: 'company', width: 22 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'NIF', key: 'nif', width: 16 },
      { header: 'RC', key: 'rc', width: 16 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'HT (DA)', key: 'subtotal', width: 14 },
      { header: 'TVA (DA)', key: 'vat', width: 12 },
      { header: 'TTC (DA)', key: 'total', width: 14 },
      { header: 'Payée le', key: 'paidAt', width: 18 },
      { header: 'Moyen', key: 'method', width: 14 },
      { header: 'Référence paiement', key: 'ref', width: 18 },
      { header: 'Lignes', key: 'lines', width: 60 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.invoices.map((i) => ({
      number: i.number ?? '',
      proforma: i.proformaNumber ?? '',
      lead: leadRef(i.leadId),
      quote: quoteNum(i.quoteId),
      client: i.customerName,
      company: i.customerCompany ?? '',
      email: i.customerEmail ?? '',
      phone: i.customerPhone ?? '',
      nif: i.customerNif ?? '',
      rc: i.customerRc ?? '',
      status: i.status,
      subtotal: amount(i.subtotal),
      vat: amount(i.vatAmount),
      total: amount(i.total),
      paidAt: fmtDate(i.paidAt),
      method: i.paymentMethod ?? '',
      ref: i.paymentRef ?? '',
      lines: i.lines.map((li) => `${li.description} × ${Number(li.quantity)} @ ${Number(li.unitPrice)}`).join(' | '),
      kept: kept(plan.keptInvoiceIds.has(i.id)),
    })),
  );

  sheet(
    'Journal',
    [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Prospect', key: 'lead', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Auteur', key: 'author', width: 22 },
      { header: 'Contenu', key: 'content', width: 90 },
    ],
    data.activities.map((a) => ({ date: fmtDate(a.createdAt), lead: leadRef(a.leadId), type: a.type, author: staffName(a.authorId), content: a.content })),
  );

  sheet(
    'Agenda',
    [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Prospect', key: 'lead', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Intervenant', key: 'who', width: 22 },
      { header: 'Lieu', key: 'location', width: 20 },
      { header: 'Notes', key: 'notes', width: 70 },
    ],
    data.appointments.map((a) => ({ date: fmtDate(a.startAt), lead: leadRef(a.leadId), type: a.type, status: a.status, who: staffName(a.assigneeId), location: a.location ?? '', notes: a.notes ?? '' })),
  );

  sheet(
    'Reçus de paiement',
    [
      { header: 'Déposé le', key: 'date', width: 18 },
      { header: 'Membre', key: 'member', width: 26 },
      { header: 'Devis', key: 'quote', width: 16 },
      { header: 'Facture', key: 'invoice', width: 16 },
      { header: 'Montant (DA)', key: 'amount', width: 14 },
      { header: 'Référence', key: 'ref', width: 18 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Fichier (private-uploads)', key: 'file', width: 50 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.proofs.map((p) => ({
      date: fmtDate(p.createdAt),
      member: staffName(p.userId),
      quote: quoteNum(p.quoteId),
      invoice: invoiceNum(p.invoiceId),
      amount: amount(p.amount),
      ref: p.reference ?? '',
      status: p.status,
      file: p.filePath,
      kept: kept(plan.keptProofIds.has(p.id)),
    })),
  );

  sheet(
    'Services lancés',
    [
      { header: 'Créé le', key: 'date', width: 18 },
      { header: 'Membre', key: 'member', width: 26 },
      { header: 'Facture', key: 'invoice', width: 16 },
      { header: 'Libellé', key: 'label', width: 40 },
      { header: 'Statut', key: 'status', width: 16 },
      { header: 'Montant (DA)', key: 'amount', width: 14 },
      { header: 'Expire le', key: 'expires', width: 18 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.serviceOrders.map((o) => ({
      date: fmtDate(o.createdAt),
      member: staffName(o.userId),
      invoice: invoiceNum(o.invoiceId),
      label: o.title,
      status: o.status,
      amount: amount(o.amount),
      expires: fmtDate(o.expiresAt),
      kept: kept(plan.keptInvoiceIds.has(o.invoiceId)),
    })),
  );

  sheet(
    'Commissions',
    [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Bénéficiaire', key: 'who', width: 24 },
      { header: 'Facture', key: 'invoice', width: 16 },
      { header: 'Montant (DA)', key: 'amount', width: 14 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Après remise à zéro', key: 'kept', width: 18 },
    ],
    data.commissions.map((c) => ({
      date: fmtDate(c.createdAt),
      who: staffName(c.beneficiaryId),
      invoice: invoiceNum(c.invoiceId),
      amount: amount(c.amount),
      status: c.status,
      kept: kept(plan.keptInvoiceIds.has(c.invoiceId)),
    })),
  );

  sheet(
    'Demandes du site',
    [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Nom', key: 'name', width: 24 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Entreprise', key: 'company', width: 22 },
      { header: 'Statut', key: 'status', width: 14 },
      { header: 'Lignes', key: 'items', width: 50 },
      { header: 'Notes', key: 'notes', width: 50 },
    ],
    data.serviceRequests.map((r) => {
      const member = r.userId ? data.members.find((m) => m.id === r.userId) : undefined;
      return {
        date: fmtDate(r.createdAt),
        name: r.guestName ?? member?.displayName ?? '',
        email: r.guestEmail ?? member?.email ?? '',
        phone: r.guestPhone ?? member?.phone ?? '',
        company: r.guestCompany ?? member?.company?.name ?? '',
        status: r.status,
        items: r.items.map((it) => it.title + (it.tierLabel ? ` (${it.tierLabel})` : '')).join(' | '),
        notes: r.notes ?? '',
      };
    }),
  );

  sheet(
    'Messages de contact',
    [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Nom', key: 'name', width: 24 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Objet', key: 'subject', width: 28 },
      { header: 'Message', key: 'message', width: 80 },
    ],
    data.contactMessages.map((m) => ({ date: fmtDate(m.createdAt), name: m.name, email: m.email, phone: m.phone ?? '', subject: m.subject ?? '', message: m.message })),
  );

  await wb.xlsx.writeFile(file);
}

async function reset(data: Data, plan: ReturnType<typeof planReset>) {
  const keptLeads = [...plan.keptLeadIds];
  const keptQuotes = [...plan.keptQuoteIds];
  const keptInvoices = [...plan.keptInvoiceIds];
  const keptProofs = [...plan.keptProofIds];
  const staffIds = data.staff.map((s) => s.id);
  const memberIds = data.members.map((m) => m.id);

  return prisma.$transaction(
    async (tx) => {
      const counts: Record<string, number> = {};
      // Ordre : les dépendants d'abord (les suppressions en cascade couvrent
      // lignes, tâches, journal, agenda et changements de suivi).
      counts['Commissions'] = (await tx.commission.deleteMany({ where: { invoiceId: { notIn: keptInvoices } } })).count;
      counts['Reçus de paiement'] = (await tx.paymentProof.deleteMany({ where: { id: { notIn: keptProofs } } })).count;
      counts['Services lancés (non payés)'] = (await tx.serviceOrder.deleteMany({ where: { invoiceId: { notIn: keptInvoices } } })).count;
      counts['Proformas / factures non payées'] = (await tx.invoice.deleteMany({ where: { id: { notIn: keptInvoices } } })).count;
      counts['Devis non payés'] = (await tx.quote.deleteMany({ where: { id: { notIn: keptQuotes } } })).count;
      counts['Prospects'] = (await tx.lead.deleteMany({ where: { id: { notIn: keptLeads } } })).count;
      // Prospects conservés : dossier clos « Payé », plus aucune tâche ouverte.
      counts['Tâches ouvertes des clients payés'] = (
        await tx.appointment.deleteMany({ where: { leadId: { in: keptLeads }, status: 'SCHEDULED' } })
      ).count;
      for (const id of keptLeads) {
        const lead = data.leads.find((l) => l.id === id)!;
        const lastPaid = data.invoices
          .filter((i) => i.leadId === id && i.paidAt)
          .map((i) => i.paidAt!.getTime())
          .sort((a, b) => b - a)[0];
        await tx.lead.update({
          where: { id },
          data: {
            stage: 'PAID',
            wonAt: lead.wonAt ?? (lastPaid ? new Date(lastPaid) : new Date()),
            nextActionAt: null,
            lostAt: null,
            lostReason: null,
          },
        });
      }
      counts['Demandes de devis du site'] = (
        await tx.serviceRequest.deleteMany({ where: { OR: [{ lead: null }, { lead: { id: { notIn: keptLeads } } }] } })
      ).count;
      counts['Messages de contact'] = (
        await tx.contactMessage.deleteMany({ where: { OR: [{ lead: null }, { lead: { id: { notIn: keptLeads } } }] } })
      ).count;
      counts['Notifications de l’équipe'] = (await tx.notification.deleteMany({ where: { userId: { in: staffIds } } })).count;
      counts['Notifications CRM des membres'] = (
        await tx.notification.deleteMany({ where: { userId: { in: memberIds }, type: { in: MEMBER_CRM_NOTIFICATIONS } } })
      ).count;
      return counts;
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}

async function main() {
  const dir = path.resolve(__dirname, '..', 'backups', `crm-reset-${stamp()}`);
  mkdirSync(dir, { recursive: true });
  console.log(`\n1/3 Sauvegarde dans ${dir}`);

  const dump = mysqldump(path.join(dir, 'base-complete.sql'));
  console.log(`   • base-complete.sql : ${dump}`);

  const data = await loadAll();
  const plan = planReset(data);
  writeFileSync(path.join(dir, 'crm.json'), JSON.stringify({ exportedAt: new Date(), ...data }, null, 2), 'utf8');
  console.log('   • crm.json : ok');
  await writeWorkbook(path.join(dir, 'crm.xlsx'), data, plan);
  console.log('   • crm.xlsx : ok');

  console.log('\n2/3 Ce qui est conservé (payé) :');
  console.log(`   • ${plan.keptInvoiceIds.size} facture(s) payée(s), ${plan.keptQuoteIds.size} devis, ${plan.keptLeadIds.size} client(s), ${plan.keptProofIds.size} reçu(s)`);

  console.log('\n3/3 Remise à zéro…');
  const counts = await reset(data, plan);
  for (const [label, count] of Object.entries(counts)) console.log(`   • ${label} supprimé(e)s : ${count}`);
  console.log('\nTerminé. Le CRM repart à zéro ; la numérotation des devis et factures continue.\n');
}

main()
  .catch((err) => {
    console.error('\nÉchec — si l’erreur survient pendant la remise à zéro, rien n’a été supprimé (transaction annulée).\n', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
