// Photos réelles d'IN NETWORK Hydra utilisées par les pages vitrines : nouvelles
// photos fournies le 27/10/2026 (optimisées dans public/espaces) ; petite salle
// de réunion d'origine. La photo de la cuisine a été retirée (qualité
// insuffisante) : à réintroduire avec une nouvelle prise de vue. La galerie complète reste gérée depuis
// l'admin (Galerie du lieu).
export const VENUE_PHOTOS = {
  terrasse: { src: '/espaces/terrasse-pergola.webp', alt: 'La terrasse d’IN NETWORK Hydra : salons extérieurs sous la pergola, avec vue sur la verdure' },
  openSpace: { src: '/espaces/allee-coworking.webp', alt: 'Postes de travail en open space, devant les bureaux privés vitrés' },
  openSpaceVue: { src: '/espaces/open-space-lumineux.webp', alt: 'Vue de l’open space et de ses grandes tables de travail en bois' },
  postes: { src: '/espaces/ilot-postes.webp', alt: 'Un îlot de postes en open space, prises intégrées, devant les bureaux fermés vitrés' },
  bureauPrive: { src: '/espaces/bureau-prive.webp', alt: 'Un bureau privé équipé' },
  salleReunion: { src: '/espaces/salle-reunion.webp', alt: 'Une salle de réunion avec tableau blanc' },
  grandeSalle: { src: '/espaces/grande-salle-18.webp', alt: 'La grande salle de réunion : longue table et fauteuils en cuir, vidéoprojecteur' },
  salleProjection: { src: '/espaces/salle-formation-projection.webp', alt: 'La salle de formation, présentation projetée et tableau blanc' },
  casiers: { src: '/espaces/casiers-chene.webp', alt: 'Les casiers individuels en chêne, fermés à clé' },
  detente: { src: '/espaces/salon-accueil.webp', alt: 'Le salon d’accueil, canapé et fauteuils' },
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
  openSpace: { src: '/espaces/cowork_roof/open-space-roof.webp', alt: 'L’espace IN Network Roof : postes de travail et grande table de réunion' },
  terrasse: { src: '/espaces/cowork_roof/terrasse-rooftop.webp', alt: 'La terrasse rooftop d’IN Network Roof, avec ses salons et tables extérieures' },
} as const;
