// Contenu éditorial des pages /services/<slug> (plan de corrections du
// 27/10/2026, étape 2 — textes du catalogue client, annexes A à G).
//
// La base reste la source des titres, catégories et prix (catalogue
// backend/prisma/catalogue.ts) ; ce fichier porte la mise en page des fiches :
// accroche, introduction, prestations, objectif, appel à l'action. Les textes
// sont ceux du catalogue, corrigés seulement pour l'orthographe et la
// typographie (espaces insécables posées à l'affichage par `typo`).
//
// Libellés de marque : « IN ADMINISTRATION » et « IN FINANCE » attendent la
// réponse du client (tâche 3.9) — les familles s'affichent donc « Administration »
// et « Finance » et les phrases qui citaient la marque sont formulées sans elle.
// IN COM (filiale de La Maison IN Groupe) est affiché.

export interface Prestation {
  title: string;
  text?: string;
}

export interface Step {
  title: string;
  text: string;
}

export interface Venue {
  name: string;
  capacity: string;
  text: string;
}

/** Formule du secrétariat, associée au palier de prix de même libellé en base. */
export interface Formula {
  tier: string;
  tagline: string;
  lead: string;
  text: string;
  items: string[];
  closing: string;
}

export interface Closing {
  title: string;
  paragraphs: string[];
  /** Ligne d'appel finale (« Demandez votre devis personnalisé. »). */
  cta?: string;
  /** Signature de la famille (IN COM). */
  signature?: string;
}

export type FamilyKey = 'creation' | 'administration' | 'finance' | 'com';

export interface Family {
  /** Nom affiché de la famille. */
  label: string;
  tagline: string;
  intro: string[];
  closing: Closing;
  /** Mention de tarification commune à la famille. */
  pricingNote?: string;
}

export interface ServiceContent {
  family?: FamilyKey;
  /** Accroche, sous le titre. */
  tagline: string;
  intro: string[];
  prestationsTitle?: string;
  prestations?: Prestation[];
  formulas?: Formula[];
  /** Tableau comparatif des formules (secrétariat) : prestation → formules qui l'incluent. */
  comparison?: { label: string; tiers: string[] }[];
  steps?: { title: string; lead?: string; items: Step[] };
  venues?: { title: string; items: Venue[] };
  objective?: string;
  closing?: Closing;
  pricingNote?: string;
}

/** Espaces insécables du français : avant « : ; ! ? » et à l'intérieur des guillemets. */
export function typo(text: string): string {
  return text
    .replace(/\s+([:;!?»])/g, ' $1')
    .replace(/«\s*/g, '« ')
    .replace(/'/g, '’');
}

// --- Annexe B : les neuf étapes de la création d'entreprise ---
export const CREATION_STEPS: { title: string; lead: string; items: Step[] } = {
  title: 'Votre entreprise en Algérie, étape par étape',
  lead: 'De la première démarche à l’immatriculation officielle, avancez avec une vision claire de votre parcours de création.',
  items: [
    { title: 'Donnez une identité à votre entreprise', text: 'Réservation de votre dénomination commerciale auprès du CNRC.' },
    { title: 'Officialisez les fondations de votre projet', text: 'Rédaction et établissement des statuts de votre société chez le notaire.' },
    { title: 'Donnez une adresse officielle à votre activité', text: 'Établissement du bail de location conformément aux formalités applicables.' },
    { title: 'Déclarez votre activité auprès de l’administration fiscale', text: 'Réalisation des formalités de déclaration d’existence auprès des services des impôts.' },
    { title: 'Préparez vos opérations financières', text: 'Ouverture d’un compte bancaire professionnel selon les exigences applicables à votre société.' },
    { title: 'Obtenez votre identification fiscale', text: 'Attribution du numéro d’identification fiscale (NIF).' },
    { title: 'Officialisez votre existence commerciale', text: 'Immatriculation au registre du commerce auprès du CNRC.' },
    { title: 'Mettez votre situation sociale en conformité', text: 'Affiliation à la CASNOS, selon le statut et les obligations applicables.' },
    { title: 'Finalisez votre identification statistique', text: 'Obtention du numéro d’identification statistique (NIS), selon les formalités applicables.' },
  ],
};

export const FAMILIES: Record<FamilyKey, Family> = {
  creation: {
    label: 'Création d’entreprise',
    tagline: 'Deux façons de créer votre entreprise : comprendre et faire vous-même, ou déléguer.',
    intro: [],
    closing: {
      title: 'Ne laissez pas la complexité des démarches freiner votre ambition.',
      paragraphs: [
        'IN NETWORK vous accompagne dans la structuration de votre projet et vous aide à identifier les formalités nécessaires à votre création d’entreprise en Algérie.',
      ],
    },
  },
  // Annexe C.
  administration: {
    label: 'Administration',
    tagline: 'Les bonnes expertises pour structurer et faire grandir votre entreprise.',
    intro: [
      'Parce que développer une entreprise ne se résume pas à trouver des clients, IN NETWORK vous donne accès à des expertises essentielles pour organiser votre activité, accompagner vos équipes et encadrer vos démarches juridiques.',
      'Ressources humaines, gestion de la paie et accompagnement juridique : bénéficiez de solutions adaptées à vos besoins pour gagner en sérénité, professionnaliser votre organisation et vous concentrer sur votre développement.',
    ],
    closing: {
      title: 'Votre entreprise évolue. Votre accompagnement aussi.',
      paragraphs: [
        'Vous recrutez, structurez votre équipe, externalisez la gestion de votre paie ou souhaitez protéger votre marque ?',
        'Parlons de vos besoins et construisons une solution adaptée à votre entreprise.',
      ],
      cta: 'Demandez votre devis personnalisé.',
    },
    pricingNote: 'Tarification : sur devis personnalisé.',
  },
  // Annexe D.
  finance: {
    label: 'Finance',
    tagline: 'Maîtrisez vos chiffres. Sécurisez vos décisions. Préparez votre croissance.',
    intro: [
      'La santé financière de votre entreprise est un levier essentiel de développement. Bénéficiez d’un accompagnement adapté à vos obligations comptables et fiscales, et accédez aux expertises nécessaires pour renforcer la fiabilité de vos informations financières.',
      'De la tenue comptable à la préparation de vos comptes annuels, en passant par les déclarations fiscales et sociales, nous vous aidons à structurer votre gestion et à avancer avec une vision plus claire de votre activité.',
    ],
    closing: {
      title: 'Votre entreprise mérite une gestion financière à la hauteur de ses ambitions.',
      paragraphs: [
        'Que vous souhaitiez structurer votre comptabilité, organiser vos obligations déclaratives ou faire certifier vos comptes, identifions ensemble l’accompagnement adapté à votre situation.',
      ],
      cta: 'Parlons de vos besoins et demandez votre devis personnalisé.',
    },
    pricingNote: 'Tarification : sur devis personnalisé.',
  },
  // Annexe E.
  com: {
    label: 'IN COM',
    tagline: 'Votre marque mérite d’être vue. Votre ambition mérite de rayonner.',
    intro: [
      'De la stratégie à l’impact, donnons à votre communication le pouvoir de faire la différence.',
      'Une marque forte ne se contente pas d’exister : elle se distingue, attire l’attention et crée des opportunités.',
      'IN COM accompagne les entreprises, les entrepreneurs, les institutions et les porteurs de projets dans la construction de leur image, le développement de leur visibilité et la valorisation de leurs activités.',
      'Stratégie de communication, identité de marque, marketing digital, événementiel, relations médias et solutions web : nous mobilisons les expertises adaptées à vos objectifs pour concevoir une communication cohérente, créative et performante.',
      'Notre ambition : faire de votre communication un véritable moteur de visibilité, d’attractivité et de croissance.',
    ],
    closing: {
      title: 'Votre ambition mérite une communication à sa hauteur.',
      paragraphs: [
        'Que vous lanciez une marque, développiez votre activité, organisiez un événement ou souhaitiez accélérer votre transformation digitale, IN COM vous aide à identifier les leviers les plus pertinents pour votre projet.',
        'Un besoin précis ou une ambition plus globale ? Construisons ensemble une solution adaptée à vos objectifs.',
      ],
      signature: 'IN COM — De la stratégie à l’impact, votre marque prend une nouvelle dimension.',
    },
    pricingNote: 'Prestations sur devis, selon le périmètre, les objectifs et les modalités du projet.',
  },
};

export const SERVICE_CONTENT: Record<string, ServiceContent> = {
  // --- Annexe A ---
  'service-secretariat': {
    tagline: 'Un soutien au quotidien pour vous faire avancer.',
    intro: [
      'Gagnez du temps, concentrez-vous sur votre activité et offrez à vos clients une expérience professionnelle à la hauteur de vos ambitions.',
      'Avec les services de secrétariat IN NETWORK, bénéficiez d’un accompagnement adapté à vos besoins : de la réception de vos courriers à la gestion de vos tâches administratives, profitez d’un service pensé pour simplifier votre quotidien et renforcer votre image professionnelle.',
    ],
    formulas: [
      {
        tier: 'WORK',
        tagline: 'L’essentiel au quotidien',
        lead: 'Un accueil professionnel pour une organisation simple et efficace.',
        text: 'Bénéficiez des services essentiels pour soigner votre image et faciliter vos échanges professionnels.',
        items: ['Réception des courriers', 'Accueil des visiteurs'],
        closing: 'Une solution simple et efficace pour votre quotidien.',
      },
      {
        tier: 'NET',
        tagline: 'Plus de fluidité pour votre activité',
        lead: 'Plus de temps pour vos projets, moins de tâches administratives.',
        text: 'Optimisez votre organisation grâce à une gestion élargie de votre secrétariat. Vous bénéficiez d’un accompagnement qui facilite le suivi de vos courriers et la coordination de vos rendez-vous.',
        items: ['Réception des courriers', 'Accueil des visiteurs', 'Gestion complète de vos courriers', 'Gestion des rendez-vous'],
        closing: 'Gagnez en efficacité et concentrez-vous sur ce qui compte vraiment : votre activité.',
      },
      {
        tier: 'NETWORK',
        tagline: 'Un service complet et personnalisé',
        lead: 'Un véritable relais au quotidien pour vous permettre de vous concentrer sur l’essentiel.',
        text: 'Confiez davantage de tâches administratives à IN NETWORK et bénéficiez d’un accompagnement étendu pour faciliter votre organisation, fluidifier vos échanges et mieux gérer vos priorités.',
        items: [
          'Réception des courriers',
          'Accueil des visiteurs',
          'Gestion complète de vos courriers',
          'Gestion des rendez-vous',
          'Réception et gestion des appels téléphoniques',
          'Service téléphonique de recouvrement',
          'Organisation des déplacements',
        ],
        closing: 'Déléguez vos contraintes administratives et consacrez votre énergie au développement de votre entreprise.',
      },
    ],
    comparison: [
      { label: 'Réception des courriers', tiers: ['WORK', 'NET', 'NETWORK'] },
      { label: 'Accueil des visiteurs', tiers: ['WORK', 'NET', 'NETWORK'] },
      { label: 'Gestion complète de vos courriers', tiers: ['NET', 'NETWORK'] },
      { label: 'Gestion des rendez-vous', tiers: ['NET', 'NETWORK'] },
      { label: 'Réception et gestion des appels téléphoniques', tiers: ['NETWORK'] },
      { label: 'Service téléphonique de recouvrement', tiers: ['NETWORK'] },
      { label: 'Organisation des déplacements', tiers: ['NETWORK'] },
    ],
    closing: {
      title: 'Votre activité mérite un soutien à la hauteur de vos ambitions.',
      paragraphs: [
        'Que vous recherchiez les services essentiels ou une assistance administrative plus complète, IN NETWORK vous propose une formule adaptée à vos besoins.',
        'Choisissez votre formule et faites de votre temps votre meilleur atout. Contactez notre équipe pour découvrir le service qui correspond à votre activité.',
      ],
    },
  },

  // --- Annexe B (option 1 et option 2 de la création d'entreprise) ---
  'formation-creation-entreprise': {
    family: 'creation',
    tagline: 'Je comprends et je fais.',
    intro: [
      'Une session pratique pour maîtriser chaque étape de la création de votre entreprise et gagner du temps dans vos démarches.',
    ],
    steps: CREATION_STEPS,
  },
  'creation-entreprise': {
    family: 'creation',
    tagline: 'Je délègue.',
    intro: [
      'IN NETWORK prend en charge la création de votre entreprise, étape par étape. Trois formules, selon les étapes que vous nous confiez.',
    ],
    steps: CREATION_STEPS,
  },

  // --- Annexe C ---
  'ressources-humaines': {
    family: 'administration',
    tagline: 'Les bonnes personnes. Une gestion maîtrisée. Une équipe qui avance.',
    intro: ['Du recrutement à la gestion administrative du personnel, bénéficiez d’un accompagnement adapté à chaque étape de la vie de votre entreprise.'],
    prestations: [
      { title: 'Recrutement & sélection des talents', text: 'Organisation du processus de recrutement, gestion des candidatures et identification des profils correspondant à vos besoins.' },
      { title: 'Contrats de travail & administration du personnel', text: 'Préparation et élaboration des contrats adaptés à votre organisation.' },
      { title: 'Paie & déclarations sociales', text: 'Accompagnement dans la gestion de la paie et le traitement des déclarations sociales.' },
    ],
    objective: 'Vous aider à structurer vos ressources humaines et à consacrer davantage de temps à votre cœur de métier.',
  },
  juridique: {
    family: 'administration',
    tagline: 'Sécurisez vos démarches. Valorisez vos actifs. Avancez avec confiance.',
    intro: [
      'À chaque étape de votre développement, vos contrats et vos actifs immatériels méritent une attention particulière. Accédez à un accompagnement adapté à vos besoins juridiques et à vos projets.',
    ],
    prestations: [
      { title: 'Contrats & conventions', text: 'Rédaction et revue de vos documents contractuels afin de mieux encadrer vos relations professionnelles.' },
      { title: 'Marques & brevets', text: 'Accompagnement dans les démarches de dépôt et de protection de votre propriété intellectuelle, en fonction de votre projet.' },
    ],
    objective: 'Mieux encadrer vos engagements, protéger la valeur de votre entreprise et soutenir votre développement.',
  },

  // --- Annexe D ---
  comptabilite: {
    family: 'finance',
    tagline: 'Des comptes maîtrisés. Une gestion structurée. Des décisions éclairées.',
    intro: [
      'Gardez le contrôle de vos obligations comptables et gagnez en visibilité sur la situation financière de votre entreprise grâce à un accompagnement adapté à vos besoins.',
    ],
    prestations: [
      { title: 'Tenue de comptabilité générale', text: 'Assurez un suivi structuré de vos opérations comptables.' },
      { title: 'Bilan annuel & comptes sociaux', text: 'Préparez les documents nécessaires à la présentation de votre situation financière.' },
      { title: 'Déclarations fiscales et sociales', text: 'Bénéficiez d’un accompagnement dans la préparation et le suivi de vos obligations déclaratives.' },
      { title: 'Gestion de la paie et des salariés', text: 'Structurez le traitement de la paie et les opérations administratives associées.' },
    ],
    objective: 'Vous aider à mieux piloter votre activité, à organiser vos obligations et à disposer d’informations financières fiables pour prendre vos décisions.',
  },
  'commissariat-aux-comptes': {
    family: 'finance',
    tagline: 'La transparence comme exigence. La fiabilité comme engagement.',
    intro: [
      'Renforcez la confiance de vos partenaires grâce à un contrôle indépendant de vos comptes et à une vérification menée dans le cadre des missions légalement applicables.',
    ],
    prestations: [
      { title: 'Certification des comptes annuels', text: 'Intervention dans le cadre d’une mission de certification confiée à un professionnel habilité.' },
      { title: 'Contrôle de conformité légale et réglementaire', text: 'Vérification des éléments relevant du périmètre de la mission.' },
      { title: 'Identification des anomalies et irrégularités', text: 'Examen des éléments comptables afin de relever les points nécessitant une attention particulière.' },
      { title: 'Examen des opérations sensibles', text: 'Analyse des opérations entrant dans le champ de la mission.' },
      { title: 'Fiabilité et transparence financières', text: 'Contribution à la confiance des associés, partenaires et autres parties prenantes.' },
    ],
    objective: 'Contribuer à la fiabilité de l’information financière et à la transparence de votre organisation.',
  },

  // --- Annexe E ---
  'strategie-communication': {
    family: 'com',
    tagline: 'Une vision claire. Un positionnement qui marque les esprits.',
    intro: [
      'Avant de communiquer, il faut savoir ce que l’on veut incarner, à qui l’on s’adresse et comment se démarquer.',
      'IN COM vous aide à définir une stratégie cohérente avec votre marché, votre identité et vos ambitions, pour faire les bons choix et donner une direction claire à votre communication.',
    ],
    prestations: [
      { title: 'Analyse du marché et de votre environnement concurrentiel', text: 'Identifiez les tendances, les attentes de vos publics et les opportunités à saisir.' },
      { title: 'Positionnement stratégique et conseil de marque', text: 'Affirmez votre différence et clarifiez votre proposition de valeur.' },
      { title: 'Élaboration de plans de communication', text: 'Structurez vos actions, vos messages et vos canaux de diffusion.' },
      { title: 'Stratégies multilingues', text: 'Adaptez votre communication à vos différents publics et développez votre présence sur de nouveaux marchés.' },
    ],
    objective: 'Communiquer avec intention, cohérence et impact.',
  },
  'identite-visuelle-branding': {
    family: 'com',
    tagline: 'Une identité reconnaissable. Une marque inoubliable.',
    intro: [
      'Votre image est souvent le premier contact avec vos futurs clients. Elle doit refléter votre valeur, inspirer confiance et vous distinguer immédiatement.',
      'IN COM façonne des identités visuelles cohérentes et mémorables, pensées pour traduire votre personnalité et renforcer votre positionnement.',
    ],
    prestations: [
      { title: 'Création de logos', text: 'Donnez à votre marque une signature visuelle distinctive.' },
      { title: 'Conception de chartes graphiques', text: 'Harmonisez vos couleurs, vos typographies et vos supports pour construire une image cohérente.' },
      { title: 'Refonte d’identité et repositionnement de marque', text: 'Modernisez votre image et faites-la évoluer avec vos ambitions.' },
      { title: 'Déclinaison de votre univers visuel', text: 'Assurez une présence homogène sur vos supports de communication.' },
    ],
    objective: 'Construire une image forte, professionnelle et immédiatement identifiable.',
  },
  'communication-digitale-print': {
    family: 'com',
    tagline: 'Gagnez en visibilité. Faites de votre présence un avantage.',
    intro: [
      'Être présent ne suffit plus. Il faut capter l’attention, susciter l’intérêt et donner envie de passer à l’action.',
      'IN COM conçoit des dispositifs de communication adaptés à vos audiences et à vos objectifs, pour renforcer votre présence en ligne comme sur vos supports physiques.',
    ],
    prestations: [
      { title: 'Gestion des réseaux sociaux', text: 'Développez votre communauté, affirmez votre expertise et entretenez une présence régulière.' },
      { title: 'Création de contenus', text: 'Valorisez votre savoir-faire à travers des textes, des visuels et des formats adaptés à vos publics.' },
      { title: 'Référencement naturel (SEO)', text: 'Améliorez la visibilité de votre site dans les moteurs de recherche.' },
      { title: 'Publicité digitale (SEA)', text: 'Développez des campagnes ciblées pour accroître votre visibilité et générer des contacts qualifiés.' },
      { title: 'Campagnes publicitaires multicanales', text: 'Coordonnez vos prises de parole pour renforcer leur portée.' },
      { title: 'Conception de supports print et publicitaires', text: 'Brochures, affiches, flyers, plaquettes commerciales et supports de présentation.' },
    ],
    objective: 'Faire de chaque prise de parole une occasion de renforcer votre marque et de développer votre activité.',
  },
  evenementiel: {
    family: 'com',
    tagline: 'Créez des rencontres. Faites vivre votre marque. Marquez les esprits.',
    intro: [
      'Un événement réussi ne se résume pas à une date et à un lieu. C’est une expérience qui rassemble, transmet un message et laisse une impression durable.',
      'IN COM vous accompagne dans la conception et l’organisation d’événements professionnels, culturels et promotionnels, de la réflexion initiale à la mise en œuvre opérationnelle, selon les prestations retenues.',
    ],
    prestations: [
      { title: 'Événements corporate', text: 'Rencontres professionnelles, conférences, séminaires et événements d’entreprise.' },
      { title: 'Événements culturels et promotionnels', text: 'Lancements, présentations de marque, rencontres thématiques et animations.' },
      { title: 'Conception et coordination événementielle', text: 'Valorisation du concept, organisation logistique et accompagnement de votre projet.' },
      { title: 'Recherche de lieux adaptés', text: 'Accédez à des espaces sélectionnés selon le format et les besoins de votre événement.' },
    ],
    venues: {
      title: 'Des lieux pour donner vie à vos événements',
      items: [
        { name: 'Terrasse IN NETWORK', capacity: 'Jusqu’à 50 personnes', text: 'Un cadre extérieur convivial pour vos rencontres professionnelles, cocktails, événements de networking et formats intimistes.' },
        { name: 'Salle de conférence et petite terrasse — La Maison IN Groupe', capacity: 'Jusqu’à 20 personnes', text: 'Un environnement adapté aux réunions, conférences en petit comité, ateliers et présentations professionnelles.' },
        // Nom à confirmer par le client (tâche 3.10 : « IN ART » ou « IN ARTS ») — repris tel que dans le catalogue.
        { name: 'Rooftop IN ART', capacity: 'Jusqu’à 50 personnes', text: 'Un lieu distinctif pour accueillir vos événements, créer des rencontres et proposer une expérience qui sort du cadre habituel.' },
      ],
    },
    objective: 'Transformer vos événements en véritables expériences de marque et en occasions de créer du lien.',
  },
  'relations-publiques-medias': {
    family: 'com',
    tagline: 'Développez votre influence. Faites entendre votre voix.',
    intro: [
      'Votre réputation est un actif stratégique. Une prise de parole bien construite peut renforcer votre crédibilité, valoriser votre expertise et accroître votre visibilité auprès des publics qui comptent.',
      'IN COM vous accompagne dans la préparation et la diffusion de vos messages, ainsi que dans la valorisation de vos actualités et de vos initiatives.',
    ],
    prestations: [
      { title: 'Relations médias', text: 'Préparation des prises de contact et accompagnement de vos démarches auprès des médias.' },
      { title: 'Rédaction de communiqués de presse', text: 'Transformez vos actualités en messages clairs et pertinents.' },
      { title: 'Préparation de conférences et prises de parole', text: 'Structurez vos interventions et renforcez l’impact de vos messages.' },
      { title: 'Valorisation de votre expertise', text: 'Mettez en avant vos projets, vos réalisations et vos temps forts.' },
    ],
    objective: 'Renforcer votre crédibilité, développer votre notoriété et installer durablement votre marque dans son environnement.',
  },
  'developpement-web-applications': {
    family: 'com',
    tagline: 'Du digital à votre avantage.',
    intro: [
      'Votre présence digitale doit être à la hauteur de vos ambitions. IN DEV accompagne vos projets numériques pour concevoir des outils adaptés à votre activité, à vos utilisateurs et à vos objectifs de développement.',
    ],
    prestations: [
      { title: 'Création de sites web', text: 'Développez une vitrine professionnelle, un site institutionnel ou une plateforme adaptée à vos besoins.' },
      { title: 'Conception d’applications mobiles', text: 'Imaginez des expériences numériques pensées pour vos utilisateurs.' },
      { title: 'Intégration de solutions de paiement locales', text: 'Facilitez les transactions en ligne en fonction des solutions disponibles et des exigences applicables.' },
      { title: 'Développement de solutions numériques sur mesure', text: 'Structurez vos besoins et identifiez les fonctionnalités adaptées à votre projet.' },
    ],
    objective: 'Faire du digital un outil concret au service de votre visibilité, de votre relation client et de votre développement.',
  },

  // --- Annexe F ---
  'in-cubator': {
    tagline: 'De l’idée à la croissance, donnez une nouvelle dimension à votre projet.',
    intro: [
      'Vous avez une ambition. Nous vous donnons les moyens de la concrétiser.',
      'IN CUBATOR accompagne les entrepreneurs, les startups et les PME innovantes à chaque étape de leur développement. Grâce à un accompagnement personnalisé, à l’expertise de professionnels et à des ateliers orientés résultats, transformez votre potentiel en opportunités concrètes.',
      'Notre ambition : accélérer votre développement, sécuriser vos décisions et vous aider à passer à l’échelle.',
      'Une attention particulière est portée aux startups deeptech et aux PME du numérique, pour lesquelles l’innovation doit devenir un véritable levier de croissance.',
    ],
    steps: {
      title: 'Votre parcours d’accélération en 6 étapes',
      items: [
        { title: 'Clarifiez votre vision', text: 'Diagnostic stratégique, structuration du projet et définition de vos priorités pour bâtir des fondations solides.' },
        { title: 'Accélérez votre développement', text: 'Un accompagnement sur mesure et des conseils ciblés pour transformer vos ambitions en plan d’action.' },
        { title: 'Testez. Validez. Ajustez.', text: 'Confrontez votre solution au marché, recueillez les retours du terrain et affinez votre proposition de valeur.' },
        { title: 'Activez votre réseau', text: 'Accédez à un écosystème d’experts, de partenaires stratégiques et d’investisseurs potentiels pour multiplier les opportunités.' },
        { title: 'Développez vos compétences', text: 'Participez à des formations et des ateliers pratiques pour renforcer votre expertise et gagner en autonomie.' },
        { title: 'Concrétisez votre lancement', text: 'Préparez votre mise sur le marché, décrochez vos premiers clients et posez les bases d’une croissance durable.' },
      ],
    },
    closing: {
      title: 'Votre ambition mérite un accélérateur.',
      paragraphs: ['Avec IN CUBATOR, ne vous contentez pas de développer une idée. Donnez-lui les moyens de devenir un projet viable, visible et créateur de valeur.'],
    },
  },
};
