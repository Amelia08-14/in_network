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
  // Salles et bureaux réels (24/10/2026), tarifs et capacités du « Catalogue IN
  // NETWORK » du 25/10/2026. Salle LMIG : grille demi-journée/journée
  // uniquement, pas de tarif horaire — d'où les null. Salle de formation : le
  // catalogue donne un seul tarif (membre = externe).
  // Anciens noms renommés en place (réservations et commandes conservées).
  const spaceRenames: Array<[string, string]> = [
    ['Salle de réunion 1', 'Salle Network'],
    ['Salle de réunion 2', 'Salle LMIG'],
    ['Bureau Y', 'Bureau Lamda'],
    ['Bureau Z', 'Bureau Julia'],
    // L'espace du dernier étage s'appelle « IN Network Roof » (demande cliente 27/10/2026).
    ['Bureau Roof', 'IN Network Roof'],
  ];
  for (const [from, to] of spaceRenames) {
    const old = await prisma.spaceResource.findFirst({ where: { siteId, name: from } });
    const taken = await prisma.spaceResource.findFirst({ where: { siteId, name: to } });
    if (old && !taken) await prisma.spaceResource.update({ where: { id: old.id }, data: { name: to } });
  }

  const noRates = { hourlyRateMember: null, halfDayRateMember: null, dailyRateMember: null, hourlyRateExternal: null, halfDayRateExternal: null, dailyRateExternal: null };
  const office = (name: string, capacity: number, monthlyRate: number, description: string) => ({
    name,
    type: 'PRIVATE_OFFICE' as const,
    capacity,
    capacityMin: null,
    description,
    monthlyRate,
    ...noRates,
  });
  const twoDesks = 'Bureau fermé jusqu’à 2 personnes : deux bureaux et un meuble de rangement.';
  const fourPeople = 'Bureau fermé jusqu’à 4 personnes : deux bureaux et un meuble de rangement.';
  const eightPeople = 'Bureau fermé jusqu’à 8 personnes, avec balcon : quatre bureaux et un meuble de rangement.';
  const spaces = [
    {
      name: 'Salle Network',
      type: 'MEETING_ROOM' as const,
      capacityMin: 6,
      capacity: 8,
      description: 'Salle de réunion de 6 à 8 personnes : vidéoprojecteur, tableau blanc, accès internet.',
      monthlyRate: null,
      hourlyRateMember: 1000,
      halfDayRateMember: 3000,
      dailyRateMember: 5000,
      hourlyRateExternal: 2500,
      halfDayRateExternal: 6000,
      dailyRateExternal: 10000,
    },
    {
      name: 'Salle LMIG',
      type: 'MEETING_ROOM' as const,
      capacityMin: 10,
      capacity: 18,
      description: 'Salle de réunion de 10 à 18 personnes, équipée pour la visioconférence : vidéoprojecteur, tableau blanc, accès internet.',
      monthlyRate: null,
      hourlyRateMember: null,
      halfDayRateMember: 15000,
      dailyRateMember: 30000,
      hourlyRateExternal: null,
      halfDayRateExternal: 25000,
      dailyRateExternal: 45000,
    },
    {
      name: 'Salle de formation',
      type: 'MEETING_ROOM' as const,
      capacityMin: null,
      capacity: 16,
      description: 'Salle de formation et de visioconférence jusqu’à 16 personnes, pour vos formations, workshops, présentations et ateliers collaboratifs.',
      monthlyRate: null,
      hourlyRateMember: null,
      halfDayRateMember: 20000,
      dailyRateMember: 35000,
      hourlyRateExternal: null,
      halfDayRateExternal: 20000,
      dailyRateExternal: 35000,
    },
    {
      name: 'Salle de conférence avec terrasse',
      type: 'MEETING_ROOM' as const,
      capacityMin: null,
      // 20 personnes : catalogue et page Événementiel (l'ancienne valeur 30 était une erreur).
      capacity: 20,
      description: 'Salle de conférence et petite terrasse (La Maison IN Groupe), jusqu’à 20 personnes : réunions, conférences en petit comité, ateliers et présentations professionnelles.',
      ...noRates,
      monthlyRate: null,
    },
    office('Bureau Alpha', 2, 45000, twoDesks),
    office('Bureau Bêta', 2, 45000, twoDesks),
    office('Bureau Gamma', 2, 45000, twoDesks),
    office('Bureau Delta', 2, 45000, twoDesks),
    office('Bureau Lamda', 4, 65000, fourPeople),
    office('Bureau Julia', 4, 65000, fourPeople),
    office('Bureau Rouge', 8, 105000, eightPeople),
    office('Bureau Vert', 8, 105000, eightPeople),
    office('Bureau Orange', 8, 105000, eightPeople),
    office('IN Network Roof', 14, 205000, 'Bureau fermé IN Network Roof, jusqu’à 14 personnes, avec balcon et accès à la terrasse rooftop : six bureaux et un meuble de rangement.'),
  ];
  for (const space of spaces) {
    const data = { siteId, isActive: true, ...space };
    const existingSpace = await prisma.spaceResource.findFirst({ where: { siteId, name: space.name } });
    if (existingSpace) {
      // La salle de conférence garde le tarif saisi dans l'admin, s'il y en a un.
      const keepRates = space.name === 'Salle de conférence avec terrasse';
      await prisma.spaceResource.update({ where: { id: existingSpace.id }, data: keepRates ? { siteId, isActive: true, type: space.type, capacity: space.capacity, description: space.description } : data });
    } else {
      await prisma.spaceResource.create({ data });
    }
  }
  await prisma.spaceResource.updateMany({
    where: { siteId, name: { notIn: spaces.map((r) => r.name) } },
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
      name: 'Bureau open space RDC',
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
      name: 'Bureau open space IN Network Roof',
      billingCycle: 'MONTHLY' as const,
      price: 25900,
      includedMeetingHours: 2,
      // Le catalogue ne détaille pas les prestations de l'open space Roof : seules
      // celles qu'il indique sont reprises (à compléter dans Admin › Tarifs).
      features: [
        'Poste de travail individuel dans l’open space IN Network Roof',
        '1 personne',
        "Accès sécurisé à l'espace 24h/24, 7j/7",
      ],
    },
    // Bureaux privés (catalogue du 25/10/2026) : quatre tailles, chaque bureau
    // porte un nom (Admin › Tarifs, espaces). Demi-journée de salle = 4 h.
    {
      name: 'Bureau privé — 2 personnes',
      billingCycle: 'MONTHLY' as const,
      price: 45000,
      includedMeetingHours: 4,
      features: [
        'Bureau fermé clés-en-main (2 bureaux + meuble de rangement)',
        "Accès à l'espace 24h/24, 7j/7",
        '1 demi-journée de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Bureau privé — 4 personnes',
      billingCycle: 'MONTHLY' as const,
      price: 65000,
      includedMeetingHours: 8,
      features: [
        'Bureau fermé clés-en-main (2 bureaux + meuble de rangement)',
        "Accès à l'espace 24h/24, 7j/7",
        '2 demi-journées de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Bureau privé — 8 personnes',
      billingCycle: 'MONTHLY' as const,
      price: 105000,
      includedMeetingHours: 8,
      features: [
        'Bureau fermé clés-en-main (4 bureaux + meuble de rangement)',
        'Balcon',
        "Accès à l'espace 24h/24, 7j/7",
        '2 demi-journées de salle de réunion par semaine',
        'Internet haut débit',
        'Espace sécurisé sous vidéosurveillance',
        'Impression et photocopie',
        'Accès cuisine et équipements',
      ],
    },
    {
      name: 'Bureau IN Network Roof — 14 personnes',
      billingCycle: 'MONTHLY' as const,
      price: 205000,
      includedMeetingHours: 8,
      features: [
        'Bureau fermé clés-en-main (6 bureaux + meuble de rangement)',
        'Balcon et accès à la terrasse rooftop',
        "Accès à l'espace 24h/24, 7j/7",
        '2 demi-journées de salle de réunion par semaine',
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
        // 189 000 / 12 = 15 750 (le catalogue indiquait 15 700 par erreur).
        'Soit 15 750 DA / mois',
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
  // Open space et bureaux privatifs A / B renommés en place (abonnements et barèmes conservés).
  const planRenames: Array<[string, string]> = [
    ['Bureau open space', 'Bureau open space RDC'],
    ['Bureau privatif A', 'Bureau privé — 2 personnes'],
    ['Bureau privatif B', 'Bureau privé — 4 personnes'],
    ['Bureau open space Roof', 'Bureau open space IN Network Roof'],
    ['Bureau Roof — 14 personnes', 'Bureau IN Network Roof — 14 personnes'],
  ];
  for (const [from, to] of planRenames) {
    const old = await prisma.membershipPlan.findFirst({ where: { name: from } });
    const taken = await prisma.membershipPlan.findFirst({ where: { name: to } });
    if (old && !taken) await prisma.membershipPlan.update({ where: { id: old.id }, data: { name: to } });
  }
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
  // d'entreprise (10 000 DA, option 1 « Je comprends et je fais ») et création juridique
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

  // Textes et prix : « Catalogue IN NETWORK » du 25/10/2026.
  const catalog: CatalogSeed[] = [
    {
      slug: 'service-secretariat',
      title: 'Service secrétariat',
      category: 'SECRETARIAT',
      description: bullets('Un soutien au quotidien pour gagner du temps et offrir à vos clients une expérience professionnelle. Trois formules mensuelles :', [
        'WORK — l’essentiel au quotidien : réception des courriers, accueil des visiteurs',
        'NET — plus de fluidité : WORK + gestion complète de vos courriers et gestion des rendez-vous',
        'NETWORK — un service complet : NET + réception et gestion des appels téléphoniques, service téléphonique de recouvrement, organisation des déplacements',
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
      // Option 1 de la création d'entreprise (catalogue) : présentée avec la création déléguée.
      category: 'CREATION_ENTREPRISE',
      description:
        'Je comprends et je fais : une session pratique pour maîtriser chaque étape de la création de votre entreprise et gagner du temps dans vos démarches.',
      tiers: [{ label: 'Atelier pratique', price: 10000 }],
    },
    {
      slug: 'ressources-humaines',
      title: 'Ressources humaines et gestion sociale',
      category: 'ADMINISTRATION',
      description: bullets('Les bonnes personnes, une gestion maîtrisée, une équipe qui avance — du recrutement à l’administration du personnel.', [
        'Recrutement et sélection des talents : organisation du recrutement, gestion des candidatures, identification des profils',
        'Contrats de travail et administration du personnel',
        'Paie et déclarations sociales',
      ]),
    },
    {
      slug: 'juridique',
      title: 'Expertise juridique',
      // Catalogue : Administration = ressources humaines + expertise juridique.
      category: 'ADMINISTRATION',
      description: bullets('Sécurisez vos démarches, valorisez vos actifs et avancez avec confiance.', [
        'Contrats et conventions : rédaction et revue de vos documents contractuels',
        'Marques et brevets : accompagnement dans le dépôt et la protection de votre propriété intellectuelle',
      ]),
    },
    {
      slug: 'creation-entreprise',
      title: "Création juridique d'entreprise",
      category: 'CREATION_ENTREPRISE',
      description: bullets('Je délègue : IN NETWORK prend en charge la création de votre entreprise, étape par étape. Trois formules selon les étapes confiées :', [
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
      title: 'Comptabilité et gestion financière',
      category: 'COMPTABILITE',
      description: bullets('Des comptes maîtrisés, une gestion structurée, des décisions éclairées.', [
        'Tenue de comptabilité générale',
        'Bilan annuel et comptes sociaux',
        'Déclarations fiscales et sociales',
        'Gestion de la paie et des salariés',
      ]),
    },
    {
      slug: 'commissariat-aux-comptes',
      title: 'Commissariat aux comptes et audit légal',
      category: 'COMPTABILITE',
      description: bullets('La transparence comme exigence, la fiabilité comme engagement : un contrôle indépendant de vos comptes.', [
        'Certification des comptes annuels, par un professionnel habilité',
        'Contrôle de conformité légale et réglementaire',
        'Identification des anomalies et irrégularités',
        'Examen des opérations sensibles',
        'Fiabilité et transparence financières',
      ]),
    },
    {
      slug: 'strategie-communication',
      title: 'Stratégie de communication',
      category: 'MARKETING',
      description: bullets('Une vision claire, un positionnement qui marque les esprits.', [
        'Analyse du marché et de votre environnement concurrentiel',
        'Positionnement stratégique et conseil de marque',
        'Élaboration de plans de communication',
        'Stratégies multilingues',
      ]),
    },
    {
      slug: 'identite-visuelle-branding',
      title: 'Identité visuelle et branding',
      category: 'MARKETING',
      description: bullets('Une identité reconnaissable, une marque inoubliable.', [
        'Création de logos',
        'Conception de chartes graphiques',
        "Refonte d'identité et repositionnement de marque",
        'Déclinaison de votre univers visuel',
      ]),
    },
    {
      slug: 'communication-digitale-print',
      title: 'Communication digitale et print',
      category: 'MARKETING',
      description: bullets('Gagnez en visibilité, en ligne comme sur vos supports physiques.', [
        'Gestion des réseaux sociaux',
        'Création de contenus',
        'Référencement naturel (SEO) et publicité digitale (SEA)',
        'Campagnes publicitaires multicanales',
        'Supports print et publicitaires : brochures, affiches, flyers, plaquettes',
      ]),
    },
    {
      slug: 'evenementiel',
      title: 'Événementiel et expériences de marque',
      category: 'MARKETING',
      description: bullets('Créez des rencontres, faites vivre votre marque — de la conception à la mise en œuvre.', [
        'Événements corporate, culturels et promotionnels',
        'Conception et coordination événementielle',
        'Terrasse IN NETWORK — jusqu’à 50 personnes',
        'Salle de conférence et petite terrasse, La Maison IN Groupe — jusqu’à 20 personnes',
        'Rooftop IN ART — jusqu’à 50 personnes',
      ]),
    },
    {
      slug: 'relations-publiques-medias',
      title: 'Relations publiques et médias',
      category: 'MARKETING',
      description: bullets('Développez votre influence, faites entendre votre voix.', [
        'Relations médias',
        'Rédaction de communiqués de presse',
        'Préparation de conférences et prises de parole',
        'Valorisation de votre expertise',
      ]),
    },
    {
      slug: 'developpement-web-applications',
      title: 'IN DEV — Développement web et applications',
      category: 'MARKETING',
      description: bullets('Du digital à votre avantage.', [
        'Création de sites web',
        'Conception d’applications mobiles',
        'Intégration de solutions de paiement locales',
        'Solutions numériques sur mesure',
      ]),
    },
    {
      slug: 'in-cubator',
      title: 'IN CUBATOR — Incubation et accélération',
      category: 'INCUBATION',
      description: bullets(
        'De l’idée à la croissance : un accompagnement personnalisé, l’expertise de professionnels et des ateliers orientés résultats. Une attention particulière est portée aux startups deeptech et aux PME du numérique. Votre parcours en 6 étapes :',
        [
          '1. Clarifiez votre vision : diagnostic stratégique, structuration du projet, priorités',
          '2. Accélérez votre développement : accompagnement sur mesure et plan d’action',
          '3. Testez, validez, ajustez : confrontez votre solution au marché',
          '4. Activez votre réseau : experts, partenaires stratégiques, investisseurs potentiels',
          '5. Développez vos compétences : formations et ateliers pratiques',
          '6. Concrétisez votre lancement : mise sur le marché et premiers clients',
        ],
      ),
    },

    // --- Offres regroupées par besoin ---
    {
      slug: 'offre-starter',
      title: 'Offre STARTER — Coworking flexible',
      category: 'OFFRE',
      description: bullets('Un espace professionnel, une adresse crédible, une connexion et une communauté — sans engagement, pour nous découvrir.', [
        'Pour : freelances, télétravailleurs, indépendants débutants',
        'Offre valable 2 mois au maximum',
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
        '3 mois de bureau en open space',
        '-15 % sur les services',
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
          'Pour : startups early stage, PME digitales — accessible aux startups labellisées uniquement',
          'Bureau en open space, accès à l’espace pour 2 personnes 24h/24, 7j/7',
          '1 h de consulting avec un expert, et -20 % sur le pack IN CUBATOR',
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
        '2 jours de bureau en open space et 1 h de salle de réunion',
        'Accès à l’espace 24h/24, 7j/7',
        '« Votre crédibilité à moindre coût. »',
      ]),
      tiers: [{ label: 'Par an', price: 160000 }],
    },
    {
      slug: 'offre-evenement-com',
      title: 'Offre ÉVÉNEMENT & COM — Lancement d’entreprise avec domiciliation',
      category: 'OFFRE',
      description: bullets('Lancez votre entreprise avec un événement clé en main dans un cadre entrepreneurial — avec matériel, accueil et support.', [
        'Pour : entreprises, e-commerçants, consultants à distance, diaspora',
        'Domiciliation pendant 1 an incluse',
        'Demi-journée d’espace événementiel pour le lancement de votre entreprise (terrasse IN NETWORK), collation non incluse',
        'Couverture digitale de l’événement (pack COM découverte) incluse',
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
