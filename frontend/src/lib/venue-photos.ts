// Photos d'IN NETWORK Hydra utilisées par les pages vitrines (optimisées dans
// public/espaces). Photos du lieu fournies le 27/10 puis le 04/11/2026 ; la
// galerie complète reste gérée depuis l'admin (Galerie du lieu).
//
// `position` : point de cadrage quand la photo est recadrée (photos en portrait,
// enseigne en haut de la porte…), en classe Tailwind object-*.
export type VenuePhoto = { src: string; alt: string; position?: string };

export const VENUE_PHOTOS = {
  terrasse: { src: '/espaces/terrasse-jardin-soir.webp', alt: 'La terrasse-jardin d’IN NETWORK Hydra en soirée : salons extérieurs sous la pergola' },
  cafe: { src: '/espaces/cafe-terrasse.webp', alt: 'Le coin café et sa terrasse en bois, tables et chaises pour une pause' },
  openSpace: { src: '/espaces/open-space-ops.webp', alt: 'Postes de travail en open space, prises intégrées et plantes, devant les bureaux vitrés' },
  openSpaceVue: { src: '/espaces/open-space-chaleureux.webp', alt: 'L’open space : longues tables de travail en bois, éclairage chaleureux et verdure' },
  postes: { src: '/espaces/open-space-postes-chaleureux.webp', alt: 'Des postes en open space le long d’un mur végétalisé' },
  salleReunion: { src: '/espaces/salle-reunion-8.webp', alt: 'La salle de réunion de 6 à 8 personnes, table et fauteuils, mur d’inspiration' },
  grandeSalle: { src: '/espaces/grande-salle-18.webp', alt: 'La grande salle de réunion : longue table et fauteuils en cuir, vidéoprojecteur' },
  salleProjection: { src: '/espaces/salle-formation-projection.webp', alt: 'La salle de formation, présentation projetée et tableau blanc' },
  casiers: { src: '/espaces/casiers-chene.webp', alt: 'Les casiers individuels en chêne, fermés à clé' },
  detente: { src: '/espaces/espace-detente-violet.webp', alt: 'L’espace détente : fauteuils violets, échiquier et éclairage tamisé' },
} as const satisfies Record<string, VenuePhoto>;

// Bureaux nommés (public/espaces/cowork_espace). Seules de vraies photos : les
// visuels générés (bureaux Julia, Rouge, Vert, Orange, terrasse du Roof) ont
// été retirés à la demande de la cliente (05/11/2026) ; un bureau sans photo
// affiche « photos à venir ». Une photo = un bureau précis : on l'associe par
// le nom du bureau en base (« Bureau Alpha »…), jamais à un autre. Les entrées
// photographiées portent l'enseigne en haut : cadrage sur le haut de l'image.
export const OFFICE_PHOTOS: Record<string, VenuePhoto> = {
  'Bureau Alpha': { src: '/espaces/cowork_espace/alpha-entree.webp', alt: 'L’entrée vitrée du Bureau Alpha', position: 'object-top' },
  'Bureau Bêta': { src: '/espaces/cowork_espace/beta-entree.webp', alt: 'L’entrée vitrée du Bureau Bêta', position: 'object-top' },
  'Bureau Gamma': { src: '/espaces/cowork_espace/gamma-entree.webp', alt: 'L’entrée vitrée du Bureau Gamma', position: 'object-top' },
  'Bureau Delta': { src: '/espaces/cowork_espace/delta-entree.webp', alt: 'L’entrée vitrée du Bureau Delta', position: 'object-top' },
  'Bureau Lamda': { src: '/espaces/cowork_espace/lamda-entree.webp', alt: 'L’entrée vitrée du Bureau Lamda', position: 'object-top' },
};

// Intérieur type de chaque taille de bureau (photo du 04/11/2026), montré en
// premier sur la carte de la taille correspondante.
export const OFFICE_INTERIORS: Record<number, VenuePhoto> = {
  2: { src: '/espaces/cowork_espace/bureau-2-personnes.webp', alt: 'L’intérieur d’un bureau privé pour 2 personnes : bureaux en bois, rangements et plantes' },
  4: { src: '/espaces/cowork_espace/bureau-4-personnes.webp', alt: 'L’intérieur d’un bureau privé pour 4 personnes : postes le long des murs, étagères et plantes' },
};

export const ROOF_PHOTOS = {
  openSpace: { src: '/espaces/cowork_roof/in-network-roof.webp', alt: 'L’espace IN Network Roof : postes de travail en bois, verdure et bureaux vitrés' },
} as const satisfies Record<string, VenuePhoto>;
