import { Prisma } from '../src/generated/prisma/client';

// Catalogue commercial IN NETWORK : espaces (salles de réunion), formules
// d'abonnement, catalogue de services et modèles de devis. Source unique,
// utilisée par le seed (prisma/seed.ts) ET par `npm run catalogue:sync`, qui
// aligne un environnement existant (ex. le VPS) sans rejouer le reste du seed
// (experts, événements, médias…).
//
// Tout est en upsert — rien n'est supprimé, seulement désactivé — donc la
// fonction est rejouable sans risque sur une base contenant déjà des
// réservations, abonnements, devis ou demandes.

export interface CatalogueSyncOptions {
  siteId: string;
  /** Masque les services absents du catalogue (sync d'un environnement existant). */
  deactivateOthers?: boolean;
}

export async function syncCatalogue(prisma: Prisma.TransactionClient, { siteId, deactivateOthers = false }: CatalogueSyncOptions) {
  // --- Tarifs réels (grille "N°02 - service et tarifs IN NETWORK") ---
  // Upsert par (siteId, name) plutôt que deleteMany+create : un deleteMany
  // brutal a cassé la contrainte FK en prod le 2026-08-27 (P2003) — de vraies
  // réservations référençaient déjà les anciens espaces placeholder. On met
  // à jour en place les espaces réels et on désactive (isActive: false, pas
  // de suppression) tout ce qui n'est plus dans la grille actuelle, pour ne
  // jamais toucher une ligne potentiellement référencée par une Booking.
  // Salle 2 (14 places, visioconférence) : grille demi-journée/journée
  // uniquement, pas de tarif horaire — d'où les null.
  const meetingRooms = [
    {
      name: 'Salle de réunion 1',
      capacity: 6,
      hourlyRateMember: 1000,
      halfDayRateMember: 3000,
      dailyRateMember: 5000,
      hourlyRateExternal: 2500,
      halfDayRateExternal: 6000,
      dailyRateExternal: 10000,
    },
    {
      name: 'Salle de réunion 2',
      capacity: 14,
      hourlyRateMember: null,
      halfDayRateMember: 15000,
      dailyRateMember: 30000,
      hourlyRateExternal: null,
      halfDayRateExternal: 25000,
      dailyRateExternal: 45000,
    },
  ];
  for (const room of meetingRooms) {
    const data = {
      siteId,
      type: 'MEETING_ROOM' as const,
      isActive: true,
      ...room,
    };
    const existingSpace = await prisma.spaceResource.findFirst({ where: { siteId, name: room.name } });
    if (existingSpace) {
      await prisma.spaceResource.update({ where: { id: existingSpace.id }, data });
    } else {
      await prisma.spaceResource.create({ data });
    }
  }
  await prisma.spaceResource.updateMany({
    where: { siteId, name: { notIn: meetingRooms.map((r) => r.name) } },
    data: { isActive: false },
  });

  // Même principe pour les formules : upsert par name + désactivation des
  // anciennes plutôt que deleteMany({}) (même risque de FK avec Subscription).
  const plans = [
    {
      name: 'Domiciliation',
      billingCycle: 'MONTHLY' as const,
      price: 10900,
      includedMeetingHours: 0,
      features: [
        'Boîte aux lettres professionnelle',
        'Contrat notarié + bail de location',
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
    const existingPlan = await prisma.membershipPlan.findFirst({ where: { name: plan.name } });
    if (existingPlan) {
      await prisma.membershipPlan.update({ where: { id: existingPlan.id }, data: { ...plan, isActive: true } });
    } else {
      await prisma.membershipPlan.create({ data: { ...plan, isActive: true } });
    }
  }
  await prisma.membershipPlan.updateMany({
    where: { name: { notIn: plans.map((p) => p.name) } },
    data: { isActive: false },
  });

  // --- Catalogue de services (Catalogue IN NETWORK V3 + grille « N°02 - service
  // et tarifs ») ---
  // Prix fixes : secrétariat (WORK/NET/NETWORK), formation à la création
  // d'entreprise (10 000 DA, service administratif) et création juridique
  // complète (100 000 DA). Tout le reste du catalogue est « sur devis » : pas de
  // prix, l'admin chiffre la demande depuis le panier (cf. /devis). Upsert par
  // slug ; on ne supprime jamais un service (des lignes de devis le
  // référencent) — les anciens placeholders sont retirés plus haut.
  await prisma.serviceCatalogItem.deleteMany({
    where: { slug: { in: ['domiciliation-entreprise', 'comptabilite-mensuelle', 'accompagnement-juridique'] } },
  });

  interface CatalogSeed {
    slug: string;
    title: string;
    category: 'SECRETARIAT' | 'ADMINISTRATION' | 'JURIDIQUE' | 'CREATION_ENTREPRISE' | 'COMPTABILITE' | 'MARKETING';
    description: string;
    // Absent = sur devis.
    tiers?: Array<{ label: string; price: number }>;
  }
  const bullets = (intro: string, lines: string[]) => [intro, ...lines.map((line) => `• ${line}`)].join('\n');

  const catalog: CatalogSeed[] = [
    {
      slug: 'service-secretariat',
      title: 'Service secrétariat',
      category: 'SECRETARIAT',
      description: bullets('Un secrétariat à distance ou sur place, au choix selon la formule WORK, NET ou NETWORK.', [
        'Réception, tri et notification du courrier',
        'Accueil professionnel des visiteurs',
        'Gestion complète de vos courriers (numérisation, communication)',
        'Gestion et confirmation des rendez-vous',
        'Réception et gestion des appels téléphoniques',
        'Service téléphonique de recouvrement (relance)',
        "Organisation des déplacements (billets, hôtel, restaurants, location de voiture)",
      ]),
      tiers: [
        { label: 'WORK', price: 4000 },
        { label: 'NET', price: 7000 },
        { label: 'NETWORK', price: 25000 },
      ],
    },
    {
      slug: 'formation-creation-entreprise',
      title: "Formation à la création juridique d'entreprise",
      category: 'ADMINISTRATION',
      description:
        "Un atelier pratique pour comprendre, étape par étape, la création juridique de votre entreprise et faire vous-même les démarches en toute sérénité.",
      tiers: [{ label: 'Atelier pratique', price: 10000 }],
    },
    {
      slug: 'ressources-humaines',
      title: 'Ressources humaines',
      category: 'ADMINISTRATION',
      description: bullets('Déléguez la gestion administrative de vos équipes.', [
        'Recrutement et gestion des candidatures',
        'Élaboration des contrats de travail',
        'Gestion de la paie et des déclarations sociales',
      ]),
    },
    {
      slug: 'juridique',
      title: 'Juridique',
      category: 'JURIDIQUE',
      description: bullets('Sécurisez vos engagements et protégez votre activité.', [
        'Rédaction et revue de contrats et de conventions',
        'Accompagnement dans le dépôt de marques et brevets',
      ]),
    },
    {
      slug: 'creation-entreprise',
      title: "Création juridique d'entreprise",
      category: 'CREATION_ENTREPRISE',
      description: bullets("Une prise en charge complète de la création de votre entreprise, en 9 étapes :", [
        'Réservation du nom commercial au CNRC',
        'Signature du bail de location notarié',
        'Enregistrement des statuts chez le notaire',
        'Obtention du registre de commerce',
        "Déclaration d'existence aux impôts",
        'Immatriculation fiscale (NIF)',
        'Immatriculation statistique (NIS)',
        'Affiliation à la CASNOS',
        "Ouverture d'un compte bancaire",
      ]),
      tiers: [{ label: 'Prise en charge complète', price: 100000 }],
    },
    {
      slug: 'comptabilite',
      title: 'Comptabilité',
      category: 'COMPTABILITE',
      description: bullets('Une comptabilité tenue dans les règles, sans y passer vos soirées.', [
        'Tenue de comptabilité générale',
        'Élaboration du bilan annuel',
        'Déclarations fiscales et sociales',
        'Gestion de la paie et des salariés',
        'Préparation des comptes sociaux',
      ]),
    },
    {
      slug: 'commissariat-aux-comptes',
      title: 'Commissariat aux comptes',
      category: 'COMPTABILITE',
      description: bullets('Un regard indépendant sur la fiabilité de vos comptes.', [
        'Certification des comptes annuels',
        'Contrôle de conformité légale et réglementaire',
        "Détection d'anomalies et d'irrégularités",
        'Sécurisation des opérations sensibles',
        'Garantie de transparence et de fiabilité financière',
      ]),
    },
    {
      slug: 'strategie-communication',
      title: 'Stratégie de communication',
      category: 'MARKETING',
      description: bullets('Posez les bases d’une communication cohérente sur votre marché.', [
        'Analyse de marché local',
        'Conseil en positionnement',
        'Plans de communication multilingues',
      ]),
    },
    {
      slug: 'identite-visuelle-branding',
      title: 'Identité visuelle et branding',
      category: 'MARKETING',
      description: bullets('Une image de marque reconnaissable et professionnelle.', [
        'Création de logos',
        'Chartes graphiques',
        "Refonte d'image de marque",
      ]),
    },
    {
      slug: 'communication-digitale-print',
      title: 'Communication digitale et print',
      category: 'MARKETING',
      description: bullets('Des contenus et des supports pour être visible en ligne comme sur le papier.', [
        'Gestion des réseaux sociaux',
        'Création de contenu, SEO/SEA',
        'Campagnes publicitaires en ligne',
        'Conception de supports publicitaires',
      ]),
    },
    {
      slug: 'evenementiel',
      title: 'Événementiel',
      category: 'MARKETING',
      description: bullets('Organisation d’événements clés en main.', [
        'Événements corporatifs, culturels et promotionnels',
      ]),
    },
    {
      slug: 'relations-publiques-medias',
      title: 'Relations publiques et médias',
      category: 'MARKETING',
      description: bullets('Faites parler de vous, au bon endroit.', [
        'Gestion des relations médias',
        'Communiqués de presse',
        'Conférences',
      ]),
    },
    {
      slug: 'developpement-web-applications',
      title: 'Développement web et applications',
      category: 'MARKETING',
      description: bullets('Votre présence digitale, du site vitrine à l’application mobile.', [
        'Création de sites web',
        'Applications mobiles',
        'Intégration de paiements locaux',
      ]),
    },
  ];

  for (const item of catalog) {
    const data = {
      title: item.title,
      category: item.category,
      description: item.description,
      priceFrom: item.tiers ? Math.min(...item.tiers.map((tier) => tier.price)) : null,
      pricingTiers: item.tiers ?? Prisma.DbNull,
      isActive: true,
    };
    await prisma.serviceCatalogItem.upsert({
      where: { slug: item.slug },
      update: data,
      create: { slug: item.slug, ...data },
    });
  }

  if (deactivateOthers) {
    // Aligne un environnement existant sur ce catalogue : les services qui n'y
    // figurent pas sont masqués (isActive: false), jamais supprimés — des
    // devis ou des demandes peuvent encore les référencer.
    await prisma.serviceCatalogItem.updateMany({
      where: { slug: { notIn: catalog.map((item) => item.slug) } },
      data: { isActive: false },
    });
  }

  // --- Modèles de devis (automatisation commerciale) : un devis pré-rempli en
  // un clic depuis la fiche lead. Prix = grille réelle « N°02 - service et tarifs ».
  const quoteTemplates = [
    {
      name: "Création juridique d'entreprise",
      description: 'Prise en charge complète, 9 étapes',
      lines: [{ description: "Création juridique d'entreprise — prise en charge complète", unitPrice: 100000, serviceSlug: 'creation-entreprise', tierLabel: 'Prise en charge complète' }],
    },
    {
      name: "Formation à la création d'entreprise",
      description: 'Atelier pratique',
      lines: [{ description: "Formation à la création juridique d'entreprise — atelier pratique", unitPrice: 10000, serviceSlug: 'formation-creation-entreprise', tierLabel: 'Atelier pratique' }],
    },
    {
      name: 'Secrétariat — formule NET',
      description: 'Service secrétariat, formule NET',
      lines: [{ description: 'Service secrétariat — formule NET', unitPrice: 7000, serviceSlug: 'service-secretariat', tierLabel: 'NET' }],
    },
  ];
  for (const template of quoteTemplates) {
    await prisma.quoteTemplate.upsert({
      where: { name: template.name },
      update: { description: template.description, lines: template.lines },
      create: { ...template, validityDays: 15 },
    });
  }
}
