// Anciens domaines d'activité saisis librement par les membres → libellé du
// référentiel (prisma/taxonomy.ts). Table proposée le 27/10/2026
// (docs/annuaire-secteurs-correspondance.md). Elle sert :
// - au matching, qui lit ces saisies comme leur équivalent officiel, sans
//   attendre la migration (sinon « Agro » ne croise jamais « Agroalimentaire ») ;
// - à la migration prisma/migrate-sectors.ts, une fois la table validée.
// `null` = saisie de test ou vide de sens, ignorée.
export const SECTOR_MAPPING: Record<string, string | null> = {
  'Accompagnement Stratégique & Financier': 'Conseil & stratégie',
  Agro: 'Agroalimentaire',
  Audiovisuel: 'Audiovisuel & cinéma',
  Beauté: 'Beauté & esthétique',
  'Bien-être': 'Bien-être & spa',
  Commecial: 'Commerce de détail',
  'Conseil et accompagnement des entreprises': 'Conseil & stratégie',
  Cosmétiques: 'Cosmétique & hygiène',
  'Création numérique': 'Design & création',
  'développement économique': 'Conseil & stratégie',
  'économie bleue': 'Pêche & aquaculture',
  'économie sociale et solidaire': 'Économie sociale & solidaire',
  'embeeded systems development': 'Objets connectés (secteur)',
  'Foires & Événementiels': 'Événementiel',
  Formation: 'Formation & développement des compétences',
  HBVVJVHIBKHB: null,
  'incubation de startups': 'Incubateurs & accélérateurs',
  industrie: 'Industrie manufacturière',
  'Industrie pharmaceutique': 'Pharmaceutique & parapharmacie',
  Informatique: 'Services numériques (ESN)',
  Innovation: 'Startups & innovation',
  IT: 'Services numériques (ESN)',
  'Marketing et Publicité': 'Marketing & publicité',
  Média: 'Médias & presse',
  Médias: 'Médias & presse',
  'Projets Immobiliers': 'Promotion & développement immobilier',
  'Prospection commerciale et acquisition de clients': 'Marketing & publicité',
  'Services aux entreprises': 'Conseil & stratégie',
  'Services aux entreprises (B2B)': 'Conseil & stratégie',
  'Services Digitaux et Publicitaires': 'Marketing & publicité',
  'Software engineering': 'Édition de logiciels & SaaS',
  technique: 'Autre secteur',
  technologie: 'Tech',
  test: null,
  'test sec 1': null,
  'test sec 2': null,
  'tous les domaines': 'Autre secteur',
  TRANING: 'Formation & développement des compétences',
  xxxxxxxxxxx: null,
};

const normalizeLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
const ALIASES = new Map(Object.entries(SECTOR_MAPPING).map(([from, to]) => [normalizeLabel(from), to]));

/** Libellé officiel d'un domaine (ancienne saisie libre traduite) ; null = à ignorer. */
export function canonicalSector(label: string): string | null {
  const alias = ALIASES.get(normalizeLabel(label));
  return alias === undefined ? label : alias;
}
