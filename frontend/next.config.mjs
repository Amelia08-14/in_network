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
  images: {
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
