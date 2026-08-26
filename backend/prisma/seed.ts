import fs from 'node:fs';
import path from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<Buffer>;
import { env } from '../src/config/env';

// Migration Prisma 7 : driver adapter obligatoire, même logique que src/lib/prisma.ts.
const adapter = new PrismaMariaDb(env.databaseUrl);
const prisma = new PrismaClient({ adapter });

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
// Photos réelles reçues de la cliente via Drive lors d'une phase antérieure
// (bios experts) — téléchargées au préalable dans le scratchpad de session.
const REAL_MEDIA_DIR =
  'C:/Users/Aymen/AppData/Local/Temp/claude/E--in-network/e4ffaf5e-562b-4338-80b7-3efe6a842f1a/scratchpad/real-media';
// Médias réels déposés directement par la cliente dans le repo (galerie du
// lieu + galerie par catégorie d'événement) — source d'ingestion pour cette
// phase, plus besoin de passer par le scratchpad Drive.
const GALERIE_DIR = path.join(process.cwd(), 'prisma', 'seed-media', 'galerie');
const GALERIE_EVENT_DIR = path.join(process.cwd(), 'prisma', 'seed-media', 'galerie_event');
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm']);

function slugifyFile(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// sharp lit nativement les .CR2 (RAW Canon, vérifié : renvoie le pixel data
// plein format) donc aucun traitement spécial requis en plus du cas .heic.
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

// Attache une liste de fichiers réels (photos et/ou vidéos, chemins relatifs
// à GALERIE_EVENT_DIR) à un événement : conversion + upload de chacun, ligne
// GalleryImage par fichier, renvoie la première image comme cover et la
// première vidéo comme "vidéo vedette" (Event.videoUrl). Idempotent : les
// GalleryImage existantes de cet event sont recréées à chaque run.
async function attachEventMedia(
  eventId: string,
  items: Array<{ dir: string; file: string }>,
): Promise<{ cover: string | null; video: string | null }> {
  await prisma.galleryImage.deleteMany({ where: { ownerType: 'EVENT', ownerId: eventId } });
  let cover: string | null = null;
  let video: string | null = null;
  let order = 0;
  for (const item of items) {
    const full = path.join(GALERIE_EVENT_DIR, item.dir, item.file);
    const ext = path.extname(item.file).toLowerCase();
    const isVideo = VIDEO_EXT.has(ext);
    const key = `${eventId}-${slugifyFile(path.basename(item.file, path.extname(item.file))).slice(0, 50)}-${order}`;
    const url = isVideo ? await saveVideo(full, 'events', key) : await saveWebp(full, 'events', key);
    if (!url) continue;
    await prisma.galleryImage.create({
      data: { ownerType: 'EVENT', ownerId: eventId, url, type: isVideo ? 'VIDEO' : 'IMAGE', order },
    });
    if (isVideo && !video) video = url;
    if (!isVideo && !cover) cover = url;
    order += 1;
  }
  return { cover, video };
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

  // --- Événements réels — "Listing des events.xlsx" (21 lignes : titre + type
  // IN/Externe/Co-organisation, aucune date/description/capacité fournie) ---
  // croisées avec les dossiers réels prisma/seed-media/galerie_event/event_{in,ext,co}.
  // Faute de date/description réelles, ces événements sont importés en
  // PENDING_REVIEW (invisibles sur le site public tant qu'un admin ne les
  // publie pas avec les vraies infos) — seuls le titre, l'origine et les
  // médias sont réels, tout le reste est un placeholder explicite à
  // compléter depuis /admin/evenements. Les 3 événements déjà publiés lors
  // d'une phase précédente (Beach Volley, Enigmia, MENA) restent PUBLISHED
  // et sont seulement enrichis avec les médias désormais disponibles.
  interface EventSeed {
    slug: string;
    title: string;
    type: 'CONFERENCE' | 'ATELIER' | 'NETWORKING' | 'MASTERCLASS';
    origin: 'IN_EVENT' | 'EXTERNAL' | 'CO_ORGANIZED';
    status: 'PUBLISHED' | 'PENDING_REVIEW';
    media: Array<{ dir: string; file: string }>;
    coOrganizerName?: string;
  }

  const menaPhotos = fs.existsSync(path.join(GALERIE_EVENT_DIR, 'event_co/MENA'))
    ? fs.readdirSync(path.join(GALERIE_EVENT_DIR, 'event_co/MENA')).map((file) => ({ dir: 'event_co/MENA', file }))
    : [];

  const eventSeeds: EventSeed[] = [
    // Déjà publiés (phase précédente) — on enrichit seulement les médias.
    {
      slug: 'beach-volley',
      title: 'Beach Volley IN NETWORK',
      type: 'NETWORKING',
      origin: 'IN_EVENT',
      status: 'PUBLISHED',
      media: [{ dir: 'event_in', file: 'BEACH VOLLEY.mp4' }],
    },
    {
      slug: 'enigmia-hackathon',
      title: 'Enigmia Hackathon',
      type: 'ATELIER',
      origin: 'EXTERNAL',
      status: 'PUBLISHED',
      media: [{ dir: 'event_ext', file: 'ENIGMIA HACKATHON 01.mp4' }],
    },
    {
      slug: 'mena-evenement-co-organise',
      title: 'MENA Women Business',
      type: 'CONFERENCE',
      origin: 'CO_ORGANIZED',
      status: 'PUBLISHED',
      coOrganizerName: 'MENA (partenaire à confirmer)',
      media: [...menaPhotos, { dir: 'event_co', file: 'MENA BUSINESS CLUB.mp4' }],
    },
    // Nouveaux — importés depuis Listing des events.xlsx, status PENDING_REVIEW.
    { slug: 'ramadan-fireside-chat', title: 'Ramadan fireside chat', type: 'NETWORKING', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'Ramadan fireside chat.mp4' }] },
    { slug: 'women-in-tech', title: 'Women in tech', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'WOMEN IN TECH.mp4' }] },
    { slug: 'personal-branding', title: 'Personal branding', type: 'ATELIER', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'Building and Communicating Your Personal Brand.mp4' }] },
    { slug: 'mental-health', title: 'Mental health', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'Mental Health Journey.mp4' }] },
    { slug: 'side-event-tedx', title: 'Side event Tedx', type: 'CONFERENCE', origin: 'CO_ORGANIZED', status: 'PENDING_REVIEW', coOrganizerName: 'TEDx (partenaire à confirmer)', media: [{ dir: 'event_co', file: 'side event Tedx - LMIG.mp4' }] },
    { slug: 'side-event-iatf-1', title: 'Side event IATF (1)', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'IATF 01.mp4' }] },
    { slug: 'side-event-iatf-2', title: 'Side event IATF (2)', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'IATF 02.mp4' }] },
    // "Side event ASC" apparaît deux fois à l'identique dans le fichier client
    // (lignes 7 et 17) mais une seule vidéo existe ("African Startup
    // Conference.mp4") — les deux événements sont importés tels quels (on ne
    // supprime pas une ligne fournie par la cliente), seul le premier reçoit
    // le média disponible.
    { slug: 'side-event-asc-1', title: 'Side event ASC (1)', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'African Startup Conference.mp4' }] },
    { slug: 'side-event-asc-2', title: 'Side event ASC (2)', type: 'CONFERENCE', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [] },
    { slug: 'first-tuesday-edition-1', title: 'First Tuesday — édition 1', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [{ dir: 'event_ext', file: 'FIRST TUESDAY 01.mp4' }] },
    { slug: 'first-tuesday-edition-2', title: 'First Tuesday — édition 2', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [{ dir: 'event_ext', file: 'FIRST TUESDAY 02.mp4' }] },
    { slug: 'first-tuesday-edition-3', title: 'First Tuesday — édition 3', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [] },
    { slug: 'first-tuesday-edition-4', title: 'First Tuesday — édition 4', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [] },
    { slug: 'moneco', title: 'Moneco', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [] },
    // "Mena Women Business" est elle aussi listée deux fois (lignes 13 et 20)
    // ; l'occurrence 1 est le vrai événement déjà publié ci-dessus, cette
    // seconde entrée est importée sans média (pas de second lot de photos).
    { slug: 'mena-women-business-2', title: 'MENA Women Business (2)', type: 'CONFERENCE', origin: 'CO_ORGANIZED', status: 'PENDING_REVIEW', coOrganizerName: 'MENA (partenaire à confirmer)', media: [] },
    { slug: 'nroho', title: 'Nroho', type: 'NETWORKING', origin: 'EXTERNAL', status: 'PENDING_REVIEW', media: [{ dir: 'event_ext', file: 'Nroho.mp4' }] },
    { slug: 'octobre-rose-sumud', title: 'Octobre rose — Sumūd', type: 'NETWORKING', origin: 'IN_EVENT', status: 'PENDING_REVIEW', media: [{ dir: 'event_in', file: 'Sumūd.mp4' }] },
    // Les 2 clips ci-dessous ne correspondent à aucun titre de la liste
    // client — rattachement best-effort par thématique (économie/IA en
    // Afrique), à vérifier et réassigner depuis le dashboard admin si besoin.
    {
      slug: 'ia-developpement-economique-afrique',
      title: 'IA au service du développement économique en Afrique',
      type: 'CONFERENCE',
      origin: 'IN_EVENT',
      status: 'PENDING_REVIEW',
      media: [
        { dir: 'event_in', file: 'IA au service du développement économique en Afrique.mp4' },
        { dir: 'event_in', file: 'Nous adressons nos sincères remerciements à monsieur @haikeldrine pour son intervention lors de  (1).mp4' },
        { dir: 'event_in', file: 'Nous avons eu l’honneur d’accueillir Monsieur Nacereddine Merzoug, CEO & Founder de MacTabBI, pa.mp4' },
      ],
    },
  ];

  for (const [index, seed] of eventSeeds.entries()) {
    // Placeholder explicite (pas une vraie date) : uniquement pour satisfaire
    // la contrainte NOT NULL du schéma tant que status = PENDING_REVIEW,
    // jamais visible publiquement (cf. events.routes.ts, filtré sur PUBLISHED).
    const placeholderStart = new Date(Date.UTC(2026, 0, 1 + index * 3, 9, 0, 0));
    const placeholderEnd = new Date(Date.UTC(2026, 0, 1 + index * 3, 18, 0, 0));
    const hasMedia = seed.media.length > 0;

    const event = await prisma.event.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        siteId: site.id,
        title: seed.title,
        slug: seed.slug,
        description: hasMedia
          ? 'Événement déjà réalisé — récap média disponible ci-dessous. Date, lieu et description complète à confirmer depuis le dashboard admin.'
          : "Événement déjà réalisé, aucun média disponible pour l'instant. Date, lieu et description à compléter depuis le dashboard admin.",
        type: seed.type,
        origin: seed.origin,
        status: seed.status,
        startAt: placeholderStart,
        endAt: placeholderEnd,
        capacity: 50,
        coOrganizerName: seed.coOrganizerName,
      },
    });

    if (seed.media.length > 0) {
      const { cover, video } = await attachEventMedia(event.id, seed.media);
      await prisma.event.update({
        where: { id: event.id },
        data: { coverImage: cover ?? undefined, videoUrl: video ?? undefined },
      });
    }
  }

  // --- Galerie du site (photos des locaux + vidéos) ---
  const espacesDir = path.join(GALERIE_DIR, 'Photos espaces');
  const videosDir = path.join(GALERIE_DIR, 'Vidéos');
  await prisma.galleryImage.deleteMany({ where: { ownerType: 'SITE', ownerId: site.id } });
  let siteOrder = 0;
  let skippedCr2 = 0;
  for (const dir of [espacesDir, videosDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      // .CR2 (RAW Canon) : sharp lit les métadonnées mais échoue à l'encodage
      // réel sur ce lot ("tiff2vips: Old-style JPEG compression support is
      // not configured", libvips construit sans le codec legacy nécessaire) —
      // ignorés plutôt que de faire planter tout le seed. Les mêmes prises de
      // vue existent déjà en .jpg/.jfif/.PNG dans le même dossier.
      if (ext === '.cr2') {
        skippedCr2 += 1;
        continue;
      }
      const isVideo = VIDEO_EXT.has(ext);
      const key = `site-${slugifyFile(path.basename(file, ext)).slice(0, 50)}-${siteOrder}`;
      const url = isVideo ? await saveVideo(path.join(dir, file), 'sites', key) : await saveWebp(path.join(dir, file), 'sites', key);
      if (!url) continue;
      await prisma.galleryImage.create({
        data: { ownerType: 'SITE', ownerId: site.id, url, type: isVideo ? 'VIDEO' : 'IMAGE', order: siteOrder },
      });
      siteOrder += 1;
    }
  }
  if (skippedCr2 > 0) {
    console.warn(`${skippedCr2} fichier(s) .CR2 ignoré(s) (non convertibles par sharp sur ce lot) — variantes .jpg/.jfif/.PNG déjà importées si présentes.`);
  }

  // --- Témoignages vidéo réels (dossier "Témoignages Clients") ---
  // Le nom du fichier est la légende Instagram d'origine (texte réel de la
  // cliente) — réutilisé comme contenu du témoignage plutôt qu'inventé.
  // Aucun nom de client fourni : attribution générique "Membre IN NETWORK",
  // pas de nom fabriqué.
  const testimonialsDir = path.join(GALERIE_DIR, 'Témoignages Clients');
  await prisma.testimonial.deleteMany({ where: { authorName: 'Membre IN NETWORK' } });
  if (fs.existsSync(testimonialsDir)) {
    for (const [index, file] of fs.readdirSync(testimonialsDir).entries()) {
      const ext = path.extname(file);
      const caption = path.basename(file, ext).replace(/\s+/g, ' ').trim();
      const key = `testimonial-${index}`;
      const videoUrl = await saveVideo(path.join(testimonialsDir, file), 'sites', key);
      if (!videoUrl) continue;
      await prisma.testimonial.create({
        data: {
          authorName: 'Membre IN NETWORK',
          content: caption,
          videoUrl,
          isPublished: true,
        },
      });
    }
  }

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
