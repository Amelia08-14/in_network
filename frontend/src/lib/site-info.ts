// Coordonnées d'IN NETWORK Hydra, source unique (contact, pied de page,
// données structurées). Adresse exacte confirmée par la cliente le 27/10/2026 ;
// coordonnées GPS résolues depuis le lien Maps fourni (brief §2.1).

export const SITE_ADDRESS = {
  street: 'N°08, Parc Paradou',
  postalCode: '16035',
  locality: 'Hydra',
  region: 'Alger',
  country: 'Algérie',
  countryCode: 'DZ',
} as const;

/** « N°08, Parc Paradou, Hydra 16035 » */
export const ADDRESS_LINE = `${SITE_ADDRESS.street}, ${SITE_ADDRESS.locality} ${SITE_ADDRESS.postalCode}`;
/** « Alger, Algérie » */
export const ADDRESS_REGION = `${SITE_ADDRESS.region}, ${SITE_ADDRESS.country}`;

export const GEO = { lat: 36.73847, lng: 3.029172 } as const;
export const MAPS_EMBED_SRC = `https://www.google.com/maps?q=${GEO.lat},${GEO.lng}&hl=fr&z=16&output=embed`;
export const MAPS_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${GEO.lat},${GEO.lng}`;

export const PHONE = { display: '+213 5 60 06 74 86', href: 'tel:+213560067486' } as const;
export const EMAIL = 'contact@in-network.dz';
export const SITE_URL = 'https://in-network.dz';

/** Données structurées LocalBusiness (JSON-LD) — audit, tâche 3.14. */
export const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'IN NETWORK',
  description: 'Espace de coworking, bureaux privés, salles de réunion, domiciliation et services aux entreprises à Hydra, Alger.',
  url: SITE_URL,
  telephone: PHONE.href.replace('tel:', ''),
  email: EMAIL,
  image: `${SITE_URL}/espaces/open-space-lumineux.webp`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE_ADDRESS.street,
    postalCode: SITE_ADDRESS.postalCode,
    addressLocality: SITE_ADDRESS.locality,
    addressRegion: SITE_ADDRESS.region,
    addressCountry: SITE_ADDRESS.countryCode,
  },
  geo: { '@type': 'GeoCoordinates', latitude: GEO.lat, longitude: GEO.lng },
  hasMap: MAPS_DIRECTIONS,
  parentOrganization: { '@type': 'Organization', name: 'La Maison IN Groupe' },
};
