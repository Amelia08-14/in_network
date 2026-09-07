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
  {
    // Produit francophone : les apostrophes dans la copie sont constantes et
    // l'encodage HTML (`&apos;`) est purement cosmétique (rendu identique) —
    // on garde la règle en avertissement plutôt qu'en erreur bloquante.
    // `set-state-in-effect` (nouvelle règle react-hooks 6) se déclenche aussi
    // sur des patterns légitimes de synchronisation avec une API externe
    // (matchMedia, lecture d'un token d'URL au montage) : avertissement.
    rules: {
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
