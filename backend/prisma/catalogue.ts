import { Prisma } from '../src/generated/prisma/client';

// Catalogue commercial IN NETWORK : espaces (salles de réunion), formules
// d'abonnement, catalogue de services et modèles de devis. Source unique,
// utilisée par le seed (prisma/seed.ts) ET par `npm run catalogue:sync`, qui
// aligne un environnement existant (ex. le VPS) sans rejouer le reste du seed
// (experts, événements, médias…).
//
// Sources : « N°02 - service et tarifs », « Catalogue des services & solutions
// professionnelles » et « Offre de service commerciale » (dossier features/,
// 19/10/2026). Les montants sont ceux des documents du client : jamais arrondis
// ni déduits.
//
// Tout est en upsert — rien n'est supprimé, seulement désactivé — donc la
// fonction est rejouable sans risque sur une base contenant déjà des
// réservations, abonnements, devis ou demandes.

export interface CatalogueSyncOptions {
  siteId: string;
  /** Masque les services absents du catalogue (sync d'un environnement existant). */
  deactivateOthers?: boolean;
}

// Pôle de livraison par défaut d'un service (processus v1.3).
function poleFor(category: string): { pole: 'SPACES' | 'COMPANY_CREATION' | 'IN_GROUP'; subsidiary?: string } {
  if (['CREATION_ENTREPRISE', 'ADMINISTRATION', 'COMPTABILITE', 'JURIDIQUE', 'SECRETARIAT', 'INCUBATION'].includes(category)) return { pole: 'COMPANY_CREATION' };
  if (category === 'MARKETING') return { pole: 'IN_GROUP', subsidiary: 'IN COM' };
  return { pole: 'SPACES' };
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
        'Adresse professionnelle à Hydra, Alger',
        'Boîte aux lettres professionnelle : réception et gestion du courrier',
        'Attestation de domiciliation',
        'Contrat notarié + bail de location',
        'Positionnement géographique et communautaire à Hydra',
        "Accès au réseau et à l'annuaire des membres",
        "Accès à l'espace 24h/24, 7j/7 sur tous les sites",
        'Accès aux espaces sur rendez-vous',
        'Activable en 48 h',
        "Contrat annuel : 155 652 DA TTC par an",
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
    // Abonnement annuel (offre 6) : une carte de membre qui donne accès à
    // l'ensemble de l'écosystème. includedMeetingHours = heures de salle de
    // réunion PAR MOIS (les formules mensuelles ci-dessus : par semaine).
    {
      name: 'Abonnement annuel ACCESS',
      billingCycle: 'ANNUAL' as const,
      price: 90000,
      includedMeetingHours: 2,
      features: [
        '60 heures de coworking par mois',
        '2 heures de salle de réunion par mois',
        'Accès aux événements et workshops mensuels',
        'Accès WiFi haut débit',
        'Accès au réseau de membres IN NETWORK',
        'Domiciliation disponible en option payante séparée',
        'Soit 7 500 DA / mois',
      ],
    },
    {
      name: 'Abonnement annuel PREMIUM',
      billingCycle: 'ANNUAL' as const,
      price: 120000,
      includedMeetingHours: 4,
      features: [
        '100 heures de coworking par mois',
        '4 heures de salle de réunion par mois',
        'Accès prioritaire aux événements et masterclasses',
        'Accès WiFi haut débit',
        'Accès au réseau de membres IN NETWORK',
        "Profil membre dans l'annuaire communautaire IN NETWORK",
        'Domiciliation disponible en option payante séparée',
        'Soit 10 000 DA / mois',
      ],
    },
    {
      name: 'Abonnement annuel ELITE',
      billingCycle: 'ANNUAL' as const,
      price: 189000,
      includedMeetingHours: 8,
      features: [
        'Accès coworking illimité',
        '8 heures de salle de réunion par mois',
        'Accès prioritaire à tous les événements avec placement réservé',
        "Profil membre mis en avant dans l'annuaire communautaire",
        "Accompagnement trimestriel avec l'équipe IN NETWORK (synergies réseau)",
        'Domiciliation disponible en option payante séparée',
        'Soit 15 700 DA / mois',
      ],
    },
    {
      name: 'Option domiciliation (add-on annuel)',
      billingCycle: 'ANNUAL' as const,
      price: 100000,
      includedMeetingHours: 0,
      features: [
        'Domiciliation juridique & fiscale, en complément d’un abonnement annuel',
        'Tarif mensuel classique : environ 8 000 DA / mois',
        'Tarif add-on annuel : 100 000 DA / an, soit 55 000 DA économisés',
      ],
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
    category: 'SECRETARIAT' | 'ADMINISTRATION' | 'JURIDIQUE' | 'CREATION_ENTREPRISE' | 'COMPTABILITE' | 'MARKETING' | 'OFFRE' | 'DIASPORA' | 'INCUBATION';
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
      description: bullets("Je délègue : IN NETWORK prend en charge la création de votre entreprise, en 9 étapes. Trois formules selon les étapes confiées :", [
        '1. Réservation du nom commercial au CNRC',
        '2. Enregistrement des statuts chez le notaire',
        '3. Signature du bail de location notarié',
        "4. Déclaration d'existence aux impôts",
        "5. Ouverture d'un compte bancaire",
        '6. Immatriculation fiscale (NIF)',
        '7. Obtention du registre de commerce',
        '8. Affiliation à la CASNOS',
        '9. Immatriculation statistique (NIS)',
      ]),
      tiers: [
        { label: 'Essentiel — étapes 1 à 4', price: 50000 },
        { label: 'Avancé — étapes 1 à 7', price: 75000 },
        { label: 'Complet — étapes 1 à 9', price: 100000 },
      ],
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
        'Location d’espace : terrasse IN NETWORK (jusqu’à 50 personnes)',
        'Salle de conférence + petite terrasse LMIG (jusqu’à 20 personnes)',
        'Rooftop IN ART (jusqu’à 50 personnes)',
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
    {
      slug: 'in-cubator',
      title: 'IN-CUBATOR — Incubation et accélération',
      category: 'INCUBATION',
      description: bullets(
        'Nos experts vous accompagnent avec un suivi personnalisé, des conseils ciblés et des ateliers concrets pour accélérer votre croissance. Une attention particulière est portée aux PME digitales et aux startups deeptech. Le processus, en 6 étapes :',
        [
          '1. Diagnostic et structuration du projet : faire le point sur votre idée et poser des bases solides',
          '2. Accompagnement personnalisé et accélération : un suivi sur mesure et des conseils ciblés',
          '3. Phase de test et validation terrain : confronter votre offre à la réalité du marché',
          '4. Mise en réseau et visibilité : vous connecter aux experts, partenaires et investisseurs',
          '5. Formations et ateliers pratiques : monter en compétences par la pratique',
          '6. Lancement et mise en marché : passer de l’idée au premier client',
        ],
      ),
    },

    // --- Offres regroupées par besoin (« Offre de service commerciale ») ---
    {
      slug: 'offre-starter',
      title: 'Offre STARTER — Coworking flexible',
      category: 'OFFRE',
      description: bullets('Un espace professionnel, une adresse crédible, une connexion et une communauté — sans engagement long.', [
        'Pour : freelances, télétravailleurs, indépendants débutants',
        'Offre valable 2 mois',
        '« Travaillez comme un professionnel dès demain, sans les contraintes d’un bureau fixe. »',
      ]),
      tiers: [
        { label: 'À la semaine', price: 5000 },
        { label: 'Au mois', price: 10000 },
      ],
    },
    {
      slug: 'offre-builder',
      title: 'Offre BUILDER — Entrepreneur en structuration',
      category: 'OFFRE',
      description: bullets('Un guichet unique : espace de travail + adresse juridique.', [
        'Pour : porteurs de projet, créateurs d’entreprise, consultants',
        'Une année de domiciliation',
        '3 mois de coworking inclus, puis -15 % sur les mois suivants',
        '1 h de conseil avec un expert pour votre projet',
        '« Lancez votre activité sans perdre de temps sur l’administratif — on s’occupe de tout. »',
      ]),
      tiers: [{ label: 'Offre complète', price: 200000 }],
    },
    {
      slug: 'offre-accelerator',
      title: 'Offre ACCELERATOR — Startup en développement',
      category: 'OFFRE',
      description: bullets(
        'Un environnement complet : espace dédié, accompagnement stratégique, accès aux experts du groupe et au réseau partenaires.',
        [
          'Pour : startups early stage, PME digitales — accessible sous label uniquement',
          'Bureau en open space, accès à l’espace pour 2 personnes 24h/24, 7j/7',
          '1 h de consulting IN-CUBATOR incluse, puis -20 % sur l’accompagnement',
          'Accès au réseau et à l’annuaire',
          '« Votre première vraie structure. »',
        ],
      ),
      tiers: [{ label: 'Par mois', price: 25000 }],
    },
    {
      slug: 'offre-domiciliation-pro',
      title: 'Offre DOMICILIATION PRO — Adresse juridique et fiscale',
      category: 'OFFRE',
      description: bullets('Une adresse professionnelle à Hydra, réception du courrier, attestation de domiciliation — activable en 48 h.', [
        'Pour : indépendants, e-commerçants, consultants à distance, diaspora',
        'Formation à la création d’entreprise incluse',
        '2 jours de bureau en open space inclus, dont 1 h de salle de réunion',
        'Accès à l’espace 24h/24, 7j/7',
        '« Une adresse à Hydra pour moins de 400 DA par jour — votre crédibilité à moindre coût. »',
      ]),
      tiers: [{ label: 'Par an', price: 160000 }],
    },
    {
      slug: 'offre-evenement-com',
      title: 'Offre ÉVÉNEMENT & COM — Lancement d’entreprise avec domiciliation',
      category: 'OFFRE',
      description: bullets('Une salle d’événement clé en main dans un cadre entrepreneurial premium — avec matériel, accueil et support.', [
        'Pour : entreprises, e-commerçants, consultants à distance, diaspora',
        'Domiciliation pendant 1 an incluse',
        'Demi-journée d’espace événementiel pour le lancement de votre entreprise (terrasse IN NETWORK), collation non incluse',
        'Couverture digitale de l’événement (pack COM 1) incluse',
        '-30 % sur les services événementiels',
      ]),
      tiers: [{ label: 'Offre complète', price: 250000 }],
    },

    // --- Entreprendre depuis l'étranger (packs diaspora) ---
    {
      slug: 'pack-diaspora-01',
      title: 'Pack 01 — Domiciliation + atelier de création',
      category: 'DIASPORA',
      description: bullets('Pour entreprendre en Algérie depuis l’étranger : une présence légale à Hydra et la maîtrise des étapes de création.', [
        'Domiciliation annuelle (contrat de location d’une année)',
        'Workshop création juridique d’entreprise : atelier pratique pour comprendre les étapes de création',
      ]),
      tiers: [{ label: 'Pack 01', price: 185652 }],
    },
    {
      slug: 'pack-diaspora-02',
      title: 'Pack 02 — Domiciliation + création complète',
      category: 'DIASPORA',
      description: bullets('Pour entreprendre en Algérie depuis l’étranger : IN NETWORK crée votre entreprise pour vous, sous procuration consulaire.', [
        'Domiciliation annuelle',
        'Création juridique d’entreprise (prise en charge complète)',
      ]),
      tiers: [{ label: 'Pack 02', price: 255652 }],
    },
    {
      slug: 'pack-diaspora-03',
      title: 'Pack 03 — Pack 02 + comptabilité + secrétariat',
      category: 'DIASPORA',
      description: bullets('Le Pack 02, auquel s’ajoutent :', ['Comptabilité', 'Secrétariat']),
    },
    {
      slug: 'pack-diaspora-04',
      title: 'Pack 04 — Pack 03 + marketing',
      category: 'DIASPORA',
      description: bullets('Le Pack 03, auquel s’ajoute :', ['Marketing']),
    },
    {
      slug: 'pack-diaspora-05',
      title: 'Pack 05 — Pack 04 + RH et formation',
      category: 'DIASPORA',
      description: bullets('Le Pack 04, auquel s’ajoutent :', ['Ressources humaines', 'Formation']),
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
      // Pôle de livraison posé à la création seulement (modifiable ensuite dans
      // le catalogue) — même règle que la migration du processus v1.3.
      create: { slug: item.slug, ...data, ...poleFor(item.category) },
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
      lines: [{ description: "Création juridique d'entreprise — formule Complet (étapes 1 à 9)", unitPrice: 100000, serviceSlug: 'creation-entreprise', tierLabel: 'Complet — étapes 1 à 9' }],
    },
    {
      name: "Création juridique d'entreprise — Essentiel",
      description: 'Étapes 1 à 4',
      lines: [{ description: "Création juridique d'entreprise — formule Essentiel (étapes 1 à 4)", unitPrice: 50000, serviceSlug: 'creation-entreprise', tierLabel: 'Essentiel — étapes 1 à 4' }],
    },
    {
      name: "Création juridique d'entreprise — Avancé",
      description: 'Étapes 1 à 7',
      lines: [{ description: "Création juridique d'entreprise — formule Avancé (étapes 1 à 7)", unitPrice: 75000, serviceSlug: 'creation-entreprise', tierLabel: 'Avancé — étapes 1 à 7' }],
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
