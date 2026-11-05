import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Racine de suivi des fichiers = ce dossier, toujours. Sans cela, Next remonte au
  // premier dossier parent contenant un package-lock.json (cas du VPS, où le dépôt
  // vit dans /var/www/in-network) et imbrique le build dans .next/standalone/frontend/ :
  // PM2 ne trouve plus .next/standalone/server.js (502 Bad Gateway).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Services et tarifs ont fusionné en une seule page (/services) ; l'ancienne
  // URL redirige (liens externes, favoris, référencement).
  async redirects() {
    return [
      { source: '/tarifs', destination: '/services', permanent: true },
      // Le compte entreprise est désormais un choix du formulaire « Devenir membre ».
      { source: '/inscription-entreprise', destination: '/register?type=entreprise', permanent: true },
    ];
  },
  // Cache navigateur des fichiers de public/ (audit de performance du 05/11/2026 :
  // ils étaient revalidés à chaque visite, max-age=0). Un fichier remplacé
  // reçoit un nouveau nom (ex. network-hero-1280.mp4), d'où une durée longue.
  async headers() {
    const longCache = [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }];
    return [
      { source: '/espaces/:path*', headers: longCache },
      { source: '/background/:path*', headers: longCache },
      { source: '/email/:path*', headers: longCache },
      { source: '/:file(network-hero-1280\\.mp4|network-hero-poster\\.webp|logo-in-network-white\\.png|logo-in-network-bleu-nuit\\.png|icon-symbol\\.png|in_icon\\.ico)', headers: longCache },
    ];
  },
  images: {
    // Variantes redimensionnées gardées 30 jours : le serveur (peu puissant) ne
    // les recalcule plus toutes les 4 heures (jusqu'à 14 s pour une photo).
    minimumCacheTTL: 2592000,
    // Next 16 refuse d'optimiser une image dont l'hôte se résout en IP privée
    // (localhost → galerie vide en local). Autorisé en développement seulement ;
    // en production les médias viennent d'un hôte public (https).
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // Dev : l'API sert les médias sur le port 4000. Sans `port` explicite, le
      // motif ne couvre que le port 80 et /_next/image répond 400 (galerie vide).
      { protocol: 'http', hostname: 'localhost', port: '4000' },
      { protocol: 'http', hostname: '127.0.0.1', port: '4000' },
    ],
  },
};

export default nextConfig;
