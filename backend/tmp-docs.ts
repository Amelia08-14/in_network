import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { env } from './src/config/env';
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.databaseUrl) });
async function cleanup() {
  await prisma.lead.deleteMany({ where: { reference: { startsWith: 'VIS-' } } });
  const ids = (await prisma.user.findMany({ where: { email: { startsWith: 'vis-', endsWith: '@test.local' } }, select: { id: true } })).map((u) => u.id);
  await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { body: { contains: 'VIS' } }] } });
  await prisma.paymentProof.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const year = new Date().getFullYear();
  const [leads, quotes, invoices] = await Promise.all([prisma.lead.findMany({ select: { reference: true } }), prisma.quote.findMany({ select: { number: true } }), prisma.invoice.findMany({ select: { number: true } })]);
  const mx = (a: (string | null)[]) => a.reduce((m, v) => Math.max(m, Number(/-(\d+)$/.exec(v ?? '')?.[1] ?? 0)), 0);
  for (const [k, v] of [[`LD-${year}`, mx(leads.map((l) => l.reference))], [`DV-${year}`, mx(quotes.map((q) => q.number))], [`FA-${year}`, mx(invoices.map((i) => i.number))]] as const)
    await prisma.documentSequence.updateMany({ where: { key: k }, data: { value: v } });
}
(async () => {
  await cleanup();
  if (process.argv.includes('--cleanup')) return;
  const hash = await bcrypt.hash('VisualTest!2026', 4);
  const mk = (email: string, role: any, name: string, permissions?: object) => prisma.user.create({ data: { email, role, passwordHash: hash, emailVerified: new Date(), displayName: name, permissions } });
  await mk('vis-super@test.local', 'SUPER_ADMIN', 'Amelia Directrice');
  const mgr = await mk('vis-mgr@test.local', 'SALES_MANAGER', 'Karima Responsable', { crm: 'write', quotes: 'write', invoices: 'read', fulfilment: 'read' });
  const ag = await mk('vis-ag@test.local', 'SALES_AGENT', 'Samir Commercial', { crm: 'write', quotes: 'write', invoices: 'write', fulfilment: 'read' });
  await mk('vis-ag2@test.local', 'SALES_AGENT', 'Lina Commerciale', { crm: 'write', quotes: 'write' });
  await mk('vis-om@test.local', 'OFFICE_MANAGER', 'Yasmine Office', { crm: 'write', members: 'write', validations: 'write', bookings: 'write', events: 'write', contact: 'write', payments: 'read', galerie: 'write' });
  const site = await prisma.site.findFirst();
  const member = await prisma.user.create({ data: { email: 'vis-m2@test.local', role: 'MEMBER', passwordHash: hash, emailVerified: new Date(), phone: '+213555123456', profile: { create: { firstName: 'Nadia', lastName: 'Hamidi', companyName: 'Atlas Digital', jobTitle: 'Gérante', siteId: site!.id, isPublic: false } } } });
  let n = 0;
  const lead = (title: string, stage: any, extra: object = {}) => prisma.lead.create({ data: { reference: `VIS-${String(++n).padStart(4, '0')}`, title, contactName: 'Contact ' + n, companyName: 'Société ' + n, stage, source: 'WEBSITE_QUOTE', email: `c${n}@exemple.dz`, ...extra } });
  await lead('Inscription — Nadia Hamidi', 'NEW', { source: 'REGISTRATION', userId: member.id, contactName: 'Nadia Hamidi', companyName: 'Atlas Digital', notes: 'Compte entreprise : 3 poste(s) demandé(s).' });
  await lead('Création SARL + domiciliation', 'NEW', { expectedAmount: 255652, contactName: 'Yacine Benali', companyName: 'Benali Conseil' });
  await lead('Offre ACCELERATOR — startup', 'QUALIFIED', { priority: 'HOT', expectedAmount: 300000 });
  await lead('Domiciliation PRO', 'ASSIGNED', { assignedToId: ag.id, priority: 'WARM', expectedAmount: 160000, contactName: 'Amel Dib', companyName: 'Dib Export' });
  await lead('Secrétariat NET', 'CONTACTED', { assignedToId: ag.id, priority: 'COLD', expectedAmount: 7000 });
  await prisma.notification.create({ data: { userId: mgr.id, type: 'lead_new', title: 'Nouvelle inscription à qualifier', body: 'VIS-0001 — Nadia Hamidi (Atlas Digital) vient de créer un compte, à valider.', href: '/admin/crm/entrants' } });
  await prisma.notification.create({ data: { userId: mgr.id, type: 'lead_new', title: 'Nouveau lead à qualifier', body: 'VIS-0002 — Création SARL + domiciliation (Yacine Benali) vient d’arriver depuis le site.', href: '/admin/crm/entrants' } });
  console.log('ok');
})().finally(() => prisma.$disconnect());
