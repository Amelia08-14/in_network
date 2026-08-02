import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<Buffer>;
import { env } from '../src/config/env';

const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
// Photos réelles reçues de la cliente via Drive (bios/tarifs — cf. plan de refonte),
// téléchargées au préalable dans le scratchpad de session.
const REAL_MEDIA_DIR =
  'C:/Users/Aymen/AppData/Local/Temp/claude/E--in-network/e4ffaf5e-562b-4338-80b7-3efe6a842f1a/scratchpad/real-media';

async function saveWebp(sourcePath: string, category: string, filename: string): Promise<string | null> {
  if (!fs.existsSync(sourcePath)) return null;
  const dir = path.join(UPLOADS_DIR, category);
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, `${filename}.webp`);

  let inputBuffer = fs.readFileSync(sourcePath);
  if (sourcePath.toLowerCase().endsWith('.heic')) {
    inputBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.92 });
  }

  await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destPath);

  return `${env.publicApiUrl}/uploads/${category}/${filename}.webp`;
}

async function saveVideo(sourcePath: string, category: string, filename: string): Promise<string | null> {
  if (!fs.existsSync(sourcePath)) return null;
  const dir = path.join(UPLOADS_DIR, category);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(sourcePath) || '.mp4';
  const destPath = path.join(dir, `${filename}${ext}`);
  fs.copyFileSync(sourcePath, destPath);
  return `${env.publicApiUrl}/uploads/${category}/${filename}${ext}`;
}

// Données de démarrage IN NETWORK — tarifs, experts et événement réels transmis
// par la cliente (grille tarifaire, bios experts, photo événement co-organisé
// MENA). Les photos de locaux/équipe et les partenaires n'ont pas encore été
// transmis : ces sections restent vides, à compléter depuis le dashboard admin.
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

  // --- Tarifs réels (grille "N°02 - service et tarifs IN NETWORK") ---
  await prisma.spaceResource.deleteMany({ where: { siteId: site.id } });
  const meetingRooms = [
    { name: 'Salle de réunion 1' },
    { name: 'Salle de réunion 2' },
  ];
  for (const room of meetingRooms) {
    await prisma.spaceResource.create({
      data: {
        siteId: site.id,
        type: 'MEETING_ROOM',
        name: room.name,
        capacity: 6,
        hourlyRateMember: 1000,
        halfDayRateMember: 3000,
        dailyRateMember: 5000,
        hourlyRateExternal: 2500,
        halfDayRateExternal: 6000,
        dailyRateExternal: 10000,
      },
    });
  }

  await prisma.membershipPlan.deleteMany({});
  const plans = [
    {
      name: 'Domiciliation',
      billingCycle: 'MONTHLY' as const,
      price: 10900,
      includedMeetingHours: 0,
      features: [
        'Boîte aux lettres professionnelle',
        'Contrat notarié + bail de location',
        "Accès à l'espace pendant les heures administratives",
      ],
    },
    {
      name: 'Bureau open space',
      billingCycle: 'MONTHLY' as const,
      price: 22900,
      includedMeetingHours: 2,
      features: [
        'Bureau en open space (bureau, chaise, 2 prises individuelles)',
        "Accès à l'espace 24h/24, 7j/7",
        '2h de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Bureau privatif A',
      billingCycle: 'MONTHLY' as const,
      price: 45000,
      includedMeetingHours: 2,
      features: [
        'Bureau fermé clés-en-main (2 bureaux + meuble de rangement)',
        "Accès à l'espace 24h/24, 7j/7",
        '2h de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Bureau privatif B',
      billingCycle: 'MONTHLY' as const,
      price: 65000,
      includedMeetingHours: 2,
      features: [
        'Bureau fermé clés-en-main (2 bureaux + meuble de rangement)',
        "Accès à l'espace 24h/24, 7j/7",
        '2h de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Casier',
      billingCycle: 'MONTHLY' as const,
      price: 3900,
      includedMeetingHours: 0,
      features: ['Espace individuel fermé à clés'],
    },
  ];
  for (const plan of plans) {
    await prisma.membershipPlan.create({ data: plan });
  }

  // --- Services secondaires (secrétariat, création juridique) ---
  await prisma.serviceCatalogItem.deleteMany({
    where: { slug: { in: ['domiciliation-entreprise', 'comptabilite-mensuelle', 'accompagnement-juridique'] } },
  });
  await prisma.serviceCatalogItem.upsert({
    where: { slug: 'service-secretariat' },
    update: {},
    create: {
      title: 'Service secrétariat',
      slug: 'service-secretariat',
      category: 'SECRETARIAT',
      description:
        'Réception, tri et notification du courrier • Accueil professionnel des visiteurs • Numérisation des courriers et communications • Gestion et confirmation des rendez-vous • Réception des appels et messages • Relance téléphonique de recouvrement • Organisation des déplacements (billets, hôtel, restaurants, location de voiture).',
      priceFrom: 4000,
      pricingTiers: [
        { label: 'WORK', price: 4000 },
        { label: 'NET', price: 7000 },
        { label: 'NETWORK', price: 25000 },
      ],
    },
  });
  await prisma.serviceCatalogItem.upsert({
    where: { slug: 'creation-entreprise' },
    update: {
      title: 'Création juridique d\'entreprise',
      description:
        "Accompagnement complet : dénomination, registre du commerce, statuts, BOAL, NIF, NIS, déplacements CNRC/notaire/impôts/ONS, paiement des quittances, cachet, ouverture de compte bancaire, CASNOS.",
      priceFrom: 30000,
      pricingTiers: [
        { label: 'Workshop de création juridique', price: 30000 },
        { label: "Accompagnement complet (RC, statuts, NIF, NIS, CASNOS...)", price: 100000 },
      ],
    },
    create: {
      title: 'Création juridique d\'entreprise',
      slug: 'creation-entreprise',
      category: 'CREATION_ENTREPRISE',
      description:
        "Accompagnement complet : dénomination, registre du commerce, statuts, BOAL, NIF, NIS, déplacements CNRC/notaire/impôts/ONS, paiement des quittances, cachet, ouverture de compte bancaire, CASNOS.",
      priceFrom: 30000,
      pricingTiers: [
        { label: 'Workshop de création juridique', price: 30000 },
        { label: "Accompagnement complet (RC, statuts, NIF, NIS, CASNOS...)", price: 100000 },
      ],
    },
  });

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

  // --- Experts réels ("Texte présentation Experts IN Network") ---
  const yacinePhoto = await saveWebp(path.join(REAL_MEDIA_DIR, 'experts/yacine-sameur.jpg'), 'experts', 'yacine-sameur');
  const sofianePhoto = await saveWebp(path.join(REAL_MEDIA_DIR, 'experts/sofiane-ouaari.jpeg'), 'experts', 'sofiane-ouaari');
  const adibPhoto = await saveWebp(path.join(REAL_MEDIA_DIR, 'experts/adib-benazzi.jpg'), 'experts', 'adib-benazzi');

  const experts = [
    {
      displayName: 'Yacine Sameur',
      expertiseArea: 'Gestion des entreprises et des ressources humaines',
      bio: "Avec plus de 15 ans d'expérience, Yacine Sameur est un expert en gestion des entreprises et ressources humaines. Il aide les organisations à améliorer leurs performances grâce à des stratégies RH innovantes, avec une approche pratique et directement applicable.",
      photoUrl: yacinePhoto,
    },
    {
      displayName: 'Walid Behar',
      expertiseArea: 'Gestion des entreprises, entrepreneuriat et développement personnel',
      bio: "Ancien banquier en M&A à Dubaï et Londres, Walid Behar est un serial entrepreneur dans la Tech et l'IA. Fondateur de GrowthAI, il a été classé par Forbes parmi les 30 jeunes entrepreneurs les plus prometteurs d'Europe en 2020.",
      photoUrl: null,
    },
    {
      displayName: 'Amine Bouhlas',
      expertiseArea: 'Finance, comptabilité et gestion d\'entreprise',
      bio: "Fort de plus de 10 ans d'expérience, Amine Bouhlas est Tech Business Manager, spécialisé en solutions cloud et logicielles. Il aide les entreprises à croître grâce à la technologie et connecte les talents aux opportunités.",
      photoUrl: null,
    },
    {
      displayName: 'Nassim Rahmani',
      expertiseArea: 'Santé, économie circulaire et stratégie',
      bio: "Nassim Rahmani dirige la région Europe d'un grand acteur des médicaments génériques. Avec un MBA en économie circulaire, il intègre durabilité, stratégie commerciale et innovation pour améliorer l'accès aux soins.",
      photoUrl: null,
    },
    {
      displayName: 'Anas Boumadian Zerhouni',
      expertiseArea: 'Banque, enseignement et EdTech',
      bio: "Professionnel polyvalent mêlant expérience bancaire, enseignement et EdTech, Anas Boumadian Zerhouni développe des solutions éducatives innovantes et inclusives au service de l'apprentissage.",
      photoUrl: null,
    },
    {
      displayName: 'Amine Bounoughaz',
      expertiseArea: 'Entrepreneuriat et mentorat startups',
      bio: "Entrepreneur et mentor, co-fondateur de plusieurs startups à impact, ancien consultant McKinsey. Il accompagne des projets innovants avec une vision orientée changement et transformation.",
      photoUrl: null,
    },
    {
      displayName: 'Sofiane Ouaari',
      expertiseArea: 'Machine learning et data science',
      bio: "Doctorant à l'International Max Planck Research School for Intelligent Systems, spécialisé en machine learning préservant la vie privée (ppML), avec plus de 5 ans d'expérience en data science. Propriétaire de la chaîne YouTube \"soufi_AI_geria\".",
      photoUrl: sofianePhoto,
    },
    {
      displayName: 'Farid Arab',
      expertiseArea: 'Tiers-lieux et IA générative',
      bio: "Spécialiste des tiers-lieux et de l'IA générative, fondateur de l'accélérateur Archipel, avec plus de 10 ans d'expérience dans la création de lieux d'innovation. Créateur des plateformes Waia.co et thetop100genai.com.",
      photoUrl: null,
    },
    {
      displayName: 'Adib Benazzi',
      expertiseArea: 'Développement des affaires, stratégie de croissance et M&A',
      bio: "20 ans d'expérience en développement des affaires et fusions-acquisitions. A occupé des postes stratégiques chez SAP, Capgemini et IBM, puis dirigé des entreprises Tech à New York, Zurich et Londres. Ingénieur aérospatial (ESTACA), MBA INSEAD.",
      photoUrl: adibPhoto,
    },
  ];
  await prisma.expertProfile.deleteMany({ where: { userId: null } });
  for (const [index, expert] of experts.entries()) {
    await prisma.expertProfile.create({
      data: {
        displayName: expert.displayName,
        photoUrl: expert.photoUrl,
        bio: expert.bio,
        expertiseArea: expert.expertiseArea,
        servicesOffered: [],
        isVerified: true,
        isPublic: true,
        order: index,
      },
    });
  }

  // --- Événement co-organisé exemple (photo réelle "MENA") ---
  const menaPhoto = await saveWebp(path.join(REAL_MEDIA_DIR, 'events/mena-36.heic'), 'events', 'mena-36');
  const menaEvent = await prisma.event.upsert({
    where: { slug: 'mena-evenement-co-organise' },
    update: {},
    create: {
      siteId: site.id,
      title: 'MENA — Événement co-organisé',
      slug: 'mena-evenement-co-organise',
      description:
        "Détails à confirmer avec le partenaire — à mettre à jour depuis le dashboard admin (titre définitif, date, lieu et description complète de l'événement co-organisé MENA).",
      type: 'NETWORKING',
      origin: 'CO_ORGANIZED',
      status: 'PUBLISHED',
      startAt: new Date('2026-09-15T09:00:00Z'),
      endAt: new Date('2026-09-15T18:00:00Z'),
      capacity: 100,
      coverImage: menaPhoto,
      coOrganizerName: 'MENA (partenaire à confirmer)',
    },
  });
  if (menaPhoto) {
    await prisma.galleryImage.deleteMany({ where: { ownerType: 'EVENT', ownerId: menaEvent.id } });
    await prisma.galleryImage.create({
      data: { ownerType: 'EVENT', ownerId: menaEvent.id, url: menaPhoto, altText: 'Événement MENA', order: 0 },
    });
  }

  // --- Événements déjà réalisés (bibliothèque vidéo client — dossier N°03 Drive) ---
  await prisma.event.upsert({
    where: { slug: 'beach-volley' },
    update: {},
    create: {
      siteId: site.id,
      title: 'Beach Volley IN NETWORK',
      slug: 'beach-volley',
      description:
        "Journée networking sportive organisée en interne par IN NETWORK. Le récap vidéo est en cours de traitement (fichier source trop volumineux pour l'import automatique) — à ajouter depuis le dashboard admin.",
      type: 'NETWORKING',
      origin: 'IN_EVENT',
      status: 'PUBLISHED',
      startAt: new Date('2026-06-20T09:00:00Z'),
      endAt: new Date('2026-06-20T17:00:00Z'),
      capacity: 60,
    },
  });

  const enigmiaVideo = await saveVideo(path.join(REAL_MEDIA_DIR, 'events/enigmia-hackathon.mp4'), 'events', 'enigmia-hackathon');
  await prisma.event.upsert({
    where: { slug: 'enigmia-hackathon' },
    update: {},
    create: {
      siteId: site.id,
      title: 'Enigmia Hackathon',
      slug: 'enigmia-hackathon',
      description:
        "Hackathon externe relayé par IN NETWORK — retrouvez le récap vidéo de l'événement ci-dessous. Détails complets à confirmer et compléter depuis le dashboard admin.",
      type: 'ATELIER',
      origin: 'EXTERNAL',
      status: 'PUBLISHED',
      startAt: new Date('2026-07-05T09:00:00Z'),
      endAt: new Date('2026-07-06T18:00:00Z'),
      capacity: 150,
      videoUrl: enigmiaVideo,
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
