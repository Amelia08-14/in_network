import nextConfig from 'eslint-config-next';

// Migration Next.js 16 (§0 brief) : `next lint` est retiré, remplacé par un
// lint direct via la CLI ESLint sur une config flat (format requis par
// ESLint 9+). Rien n'existait avant (pas de .eslintrc, pas de dépendance
// eslint installée) — première mise en place, minimale, alignée sur la
// config par défaut Next.js plutôt que d'inventer des règles personnalisées.
// L'export par défaut d'eslint-config-next EST déjà un tableau flat natif
// (pas besoin de FlatCompat, qui casse ici : bug de référence circulaire
// connu quand on fait passer eslint-plugin-react par le pont legacy).
export default [
  ...nextConfig,
  { ignores: ['.next/**', 'node_modules/**', 'dist/**'] },
];
