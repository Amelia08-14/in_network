// Photos réelles d'IN NETWORK Hydra (sélection de la galerie du lieu, optimisée
// dans public/espaces) utilisées par les pages vitrines. La galerie complète
// reste gérée depuis l'admin (Galerie du lieu).
export const VENUE_PHOTOS = {
  terrasse: { src: '/espaces/terrasse.webp', alt: 'La terrasse-jardin d’IN NETWORK Hydra, avec ses salons extérieurs' },
  cuisine: { src: '/espaces/cuisine.webp', alt: 'L’espace cuisine et pause café' },
  openSpace: { src: '/espaces/open-space.webp', alt: 'Postes de travail en open space' },
  openSpaceVue: { src: '/espaces/open-space-vue.webp', alt: 'Vue de l’open space et de ses grandes tables de travail' },
  postes: { src: '/espaces/postes-open-space.webp', alt: 'Postes en open space devant les bureaux fermés vitrés' },
  bureauPrive: { src: '/espaces/bureau-prive.webp', alt: 'Un bureau privé équipé' },
  salleReunion: { src: '/espaces/salle-reunion.webp', alt: 'Une salle de réunion avec tableau blanc' },
  grandeSalle: { src: '/espaces/grande-salle.webp', alt: 'Une grande salle de réunion' },
  salleProjection: { src: '/espaces/salle-projection.webp', alt: 'Une salle équipée d’un écran de projection' },
  casiers: { src: '/espaces/casiers.webp', alt: 'Les casiers individuels fermés à clé' },
  detente: { src: '/espaces/espace-detente.webp', alt: 'Un espace d’accueil et de détente' },
} as const;

export type VenuePhoto = { src: string; alt: string };

// Visuels des bureaux nommés et de l'espace Roof, fournis par la cliente le
// 27/10/2026 (public/espaces/cowork_espace : bureaux du rez-de-chaussée,
// cowork_colors : bureaux de couleur à l'étage, cowork_roof : open space et
// terrasse du Roof). Une photo = un bureau précis : on l'associe par le nom du
// bureau en base (« Bureau Alpha »…), jamais à un autre.
export const OFFICE_PHOTOS: Record<string, VenuePhoto> = {
  'Bureau Alpha': { src: '/espaces/cowork_espace/bureau-alpha.webp', alt: 'Le Bureau Alpha : deux postes, cloison vitrée et meuble de rangement, tons bleu nuit et chêne' },
  'Bureau Bêta': { src: '/espaces/cowork_espace/bureau-beta.webp', alt: 'Le Bureau Bêta : deux postes et un meuble de rangement, tons bleu et sable' },
  'Bureau Gamma': { src: '/espaces/cowork_espace/bureau-gamma.webp', alt: 'Le Bureau Gamma : deux postes côte à côte, tons vert sauge' },
  'Bureau Delta': { src: '/espaces/cowork_espace/bureau-delta.webp', alt: 'Le Bureau Delta : deux postes et un meuble de rangement, mur rouge brique' },
  'Bureau Lamda': { src: '/espaces/cowork_espace/bureau-lamda.webp', alt: 'Le Bureau Lamda : quatre postes autour d’un bureau partagé, tons violet' },
  'Bureau Julia': { src: '/espaces/cowork_espace/bureau-julia.webp', alt: 'Le Bureau Julia : quatre postes le long des murs, tons terracotta et bois' },
  'Bureau Rouge': { src: '/espaces/cowork_colors/bureau-rouge.webp', alt: 'Le Bureau Rouge : postes de travail face à face et balcon ouvert sur la verdure' },
  'Bureau Vert': { src: '/espaces/cowork_colors/bureau-vert.webp', alt: 'Le Bureau Vert : îlots de postes de travail et balcon, tons vert et bois' },
  'Bureau Orange': { src: '/espaces/cowork_colors/bureau-orange.webp', alt: 'Le Bureau Orange : postes alignés le long des murs et balcon, tons orange' },
};

export const ROOF_PHOTOS = {
  openSpace: { src: '/espaces/cowork_roof/open-space-roof.webp', alt: 'L’open space Roof : postes de travail individuels et table de réunion' },
  terrasse: { src: '/espaces/cowork_roof/terrasse-rooftop.webp', alt: 'La terrasse rooftop de l’Espace Roof, avec ses salons et tables extérieures' },
} as const;
