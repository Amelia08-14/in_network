import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Données de démarrage. Les tarifs et le catalogue de services sont des
// placeholders — cf. CDC §1.4, dépendances ouvertes à confirmer avant
// mise en production (grille tarifaire réelle, prix des services).
async function main() {
  const site = await prisma.site.upsert({
    where: { id: 'site-hydra' },
    update: {},
    create: {
      id: 'site-hydra',
      name: 'IN NETWORK Hydra',
      city: 'Alger',
      address: 'Hydra, Alger, Algérie (adresse précise à confirmer)',
      isActive: true,
    },
  });

  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@innetwork.dz' },
    update: {},
    create: {
      email: 'admin@innetwork.dz',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      emailVerified: new Date(),
    },
  });

  const spaces = [
    { name: 'Poste open-space #1', type: 'DESK' as const, capacity: 1, hourlyRate: 200, dailyRate: 1200, monthlyRate: 15000 },
    { name: 'Bureau privé A', type: 'PRIVATE_OFFICE' as const, capacity: 4, hourlyRate: 800, dailyRate: 5000, monthlyRate: 60000 },
    { name: 'Salle de réunion 1', type: 'MEETING_ROOM' as const, capacity: 8, hourlyRate: 1500, dailyRate: null, monthlyRate: null },
  ];
  for (const space of spaces) {
    const existing = await prisma.spaceResource.findFirst({ where: { name: space.name, siteId: site.id } });
    if (!existing) {
      await prisma.spaceResource.create({ data: { ...space, siteId: site.id } });
    }
  }

  const plans = [
    { name: 'Day Pass', billingCycle: 'DAY_PASS' as const, price: 1200, includedMeetingHours: 1, features: ['Accès open-space', '1h de salle de réunion incluse', 'Wifi haut débit'] },
    { name: 'Mensuel Essentiel', billingCycle: 'MONTHLY' as const, price: 15000, includedMeetingHours: 4, features: ['Accès illimité open-space', '4h de salle de réunion/mois', 'Café & thé inclus'] },
    { name: 'Mensuel Bureau Privé', billingCycle: 'MONTHLY' as const, price: 60000, includedMeetingHours: 10, features: ['Bureau privé dédié', '10h de salle de réunion/mois', 'Domiciliation possible'] },
    { name: 'Annuel Essentiel', billingCycle: 'ANNUAL' as const, price: 150000, includedMeetingHours: 60, features: ['Accès illimité open-space', '2 mois offerts vs. mensuel', 'Accès prioritaire événements'] },
  ];
  for (const plan of plans) {
    const existing = await prisma.membershipPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.membershipPlan.create({ data: plan });
    }
  }

  const services = [
    { title: 'Domiciliation d\'entreprise', slug: 'domiciliation-entreprise', category: 'DOMICILIATION' as const, description: 'Adresse commerciale professionnelle à Hydra, Alger, avec gestion du courrier.', priceFrom: 8000 },
    { title: 'Création d\'entreprise (SARL/EURL)', slug: 'creation-entreprise', category: 'CREATION_ENTREPRISE' as const, description: 'Accompagnement complet des démarches de création d\'entreprise.', priceFrom: 25000 },
    { title: 'Tenue comptable mensuelle', slug: 'comptabilite-mensuelle', category: 'COMPTABILITE' as const, description: 'Suivi comptable mensuel par un expert partenaire.', priceFrom: 12000 },
    { title: 'Accompagnement juridique', slug: 'accompagnement-juridique', category: 'JURIDIQUE' as const, description: 'Rédaction de contrats et conseil juridique pour entrepreneurs.', priceFrom: 10000 },
  ];
  for (const service of services) {
    await prisma.serviceCatalogItem.upsert({
      where: { slug: service.slug },
      update: {},
      create: service,
    });
  }

  const skillTags = ['Développement Web', 'Design UI/UX', 'Marketing Digital', 'Comptabilité', 'Droit des affaires', 'Growth Hacking', 'Data Science'];
  const sectorTags = ['Tech', 'E-commerce', 'Agroalimentaire', 'Santé', 'Éducation', 'Finance'];
  for (const label of skillTags) {
    await prisma.tag.upsert({ where: { label }, update: {}, create: { label, category: 'SKILL' } });
  }
  for (const label of sectorTags) {
    await prisma.tag.upsert({ where: { label }, update: {}, create: { label, category: 'SECTOR' } });
  }

  await prisma.testimonial.upsert({
    where: { id: 'testimonial-seed-1' },
    update: {},
    create: {
      id: 'testimonial-seed-1',
      authorName: 'Amel B.',
      authorRole: 'Fondatrice, IN NETWORK',
      content: "IN NETWORK est né d'une conviction simple : la technologie doit suivre le réseau, pas le précéder.",
      isPublished: true,
    },
  });

  console.log('Seed terminé.');
  console.log('Compte admin: admin@innetwork.dz / ChangeMe123! (à changer immédiatement)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
