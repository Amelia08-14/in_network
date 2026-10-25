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

export type VenuePhoto = (typeof VENUE_PHOTOS)[keyof typeof VENUE_PHOTOS];
