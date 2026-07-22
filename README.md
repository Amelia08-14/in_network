# IN NETWORK — Plateforme digitale (MVP V1)

Monorepo à deux applications, conformément au CDC Technique (§2 Vue d'ensemble) adapté à ton
environnement de dev/déploiement :

```
in_network/
├── backend/    Node.js + Express + TypeScript + Prisma + MySQL (API REST)
└── frontend/   Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn-style UI
```

## Écarts assumés par rapport au CDC technique original

Le CDC (`in-network-cdc-technique-mvp.pdf`) prévoyait un monolithe Next.js (API Routes intégrées)
+ PostgreSQL + NextAuth + Vercel. Pour coller à ta demande (backend Node séparé, MySQL, XAMPP en
local, VPS en prod), ce projet s'écarte sur trois points — le reste (modèle de données, RBAC,
moteur de matching, plan de phases) suit fidèlement le CDC :

| Sujet | CDC original | Ce projet | Pourquoi |
|---|---|---|---|
| Backend | API Routes Next.js | Node.js/Express séparé | Backend indépendant testable via XAMPP/VS Code |
| Base de données | PostgreSQL | MySQL (Prisma provider `mysql`) | XAMPP fournit MySQL |
| Auth | NextAuth v5 | JWT maison (access + refresh) | NextAuth suppose un monolithe Next.js |
| Hébergement | Vercel + Neon/Supabase | VPS (Nginx + PM2) | Déploiement VPS demandé |

Le schéma de données, le RBAC (SUPER_ADMIN/ADMIN/MEMBER), le moteur de matching par règles (§8 du
CDC) et le découpage des modules restent identiques à la spécification.

## Ce qui est livré dans ce scaffold

Fondations complètes et fonctionnelles (Phase 0 + Phase 1 du plan de développement §13 du CDC), plus
une bonne partie des phases suivantes déjà câblées :

- Design system Tailwind (palette, typographie Roboto Slab + pile système Helvetica, tokens) — cf. CDC §3
- Schéma Prisma complet (tous les modèles du CDC §4, adaptés MySQL)
- Auth JWT (inscription, connexion, vérification email, mot de passe oublié, RBAC)
- Annuaire des membres avec visibilité public/membre différenciée (CDC §6.2)
- Moteur de mise en relation V1 par règles + job planifié (CDC §8)
- Réservation d'espaces avec anti-chevauchement transactionnel (CDC §6.2)
- Abonnements, paiements (webhook + confirmation manuelle virement), services entrepreneuriaux,
  événements, backoffice admin
- Pages publiques (accueil, tarifs, annuaire, experts, services, événements, à propos, contact,
  légal), wizard d'inscription, dashboard membre, backoffice admin

**Reste à faire** (voir CDC §13, phases 3 à 8) : intégration réelle d'une passerelle de paiement
carte (Chargily Pay proposé, à confirmer), fournisseur SMS (non déterminé), génération de factures
PDF, tests E2E Playwright, contenu légal définitif, grille tarifaire réelle.

---

## 1. Setup local avec XAMPP + VS Code

### Prérequis

- [XAMPP](https://www.apachefriends.org/) avec le module **MySQL** démarré (via le panneau de
  contrôle XAMPP — Apache n'est pas nécessaire, seul MySQL est utilisé)
- Node.js ≥ 18 (idéalement 20+)
- VS Code

### 1.1 Créer la base de données

Ouvre phpMyAdmin (`http://localhost/phpmyadmin`, démarré par XAMPP) et crée une base nommée
`in_network` (utf8mb4_unicode_ci), ou en ligne de commande :

```bash
mysql -u root -h 127.0.0.1 -e "CREATE DATABASE in_network CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 1.2 Backend

```bash
cd backend
cp .env.example .env
```

Par défaut `.env` pointe déjà sur `mysql://root:@localhost:3306/in_network` (utilisateur `root` sans
mot de passe, configuration XAMPP par défaut). Adapte si ton XAMPP a un mot de passe root ou un port
différent.

```bash
npm install
npm run prisma:migrate      # crée les tables (première fois : nomme la migration, ex. "init")
npm run prisma:seed         # données de démarrage (site Hydra, formules, tags, compte admin)
npm run dev                 # démarre l'API sur http://localhost:4000
```

Compte admin créé par le seed : `admin@innetwork.dz` / `ChangeMe123!` — **à changer immédiatement**.

Vérifie que l'API répond : `curl http://localhost:4000/health`.

### 1.3 Frontend

Dans un second terminal :

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000 par défaut
npm install
npm run dev                        # démarre le site sur http://localhost:3000
```

Ouvre `http://localhost:3000`. Le site fonctionne même si le backend est temporairement injoignable
(les pages catalogue retombent sur un état vide plutôt que de planter).

### 1.4 Modifier le schéma de données

Après toute modification de `backend/prisma/schema.prisma` :

```bash
npm run prisma:migrate    # crée une nouvelle migration + régénère le client Prisma
```

`npm run prisma:studio` ouvre une interface graphique pour explorer/éditer les données.

---

## 2. Déploiement VPS

### 2.1 Prérequis sur le VPS

- Node.js ≥ 20, MySQL 8 (ou MariaDB 10.6+), Nginx, [PM2](https://pm2.keymetrics.io/) (`npm i -g pm2`)
- Un nom de domaine pointé vers le VPS (ex. `innetwork.dz` pour le frontend, `api.innetwork.dz` pour
  le backend — recommandé pour que les cookies d'auth restent same-site)

### 2.2 Base de données

```sql
CREATE DATABASE in_network CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'in_network_user'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON in_network.* TO 'in_network_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.3 Backend

```bash
cd backend
npm ci
cp .env.example .env    # renseigner DATABASE_URL, JWT_*, CORS_ORIGIN=https://innetwork.dz, etc.
npm run build
npm run prisma:migrate:deploy
npm run prisma:seed     # une seule fois, à la première mise en production
```

`ecosystem.config.js` (déjà fourni dans `backend/`) :

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 2.4 Frontend

```bash
cd frontend
npm ci
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=https://api.innetwork.dz
npm run build
pm2 start ecosystem.config.js
pm2 save
```

`next.config.mjs` utilise `output: 'standalone'` : le build produit un serveur Node autonome dans
`.next/standalone`, ce que `ecosystem.config.js` référence directement.

### 2.5 Nginx (reverse proxy + HTTPS)

Voir `deploy/nginx.innetwork.conf` fourni dans ce repo — deux server blocks (frontend sur le domaine
principal, backend sur le sous-domaine `api.`). Puis :

```bash
sudo cp deploy/nginx.innetwork.conf /etc/nginx/sites-available/innetwork
sudo ln -s /etc/nginx/sites-available/innetwork /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d innetwork.dz -d api.innetwork.dz
```

### 2.6 Job de matching planifié

Le job de matching (CDC §8.3) tourne déjà via `node-cron` **dans le process backend lui-même**
(voir `backend/src/server.ts`, exécution chaque nuit à 2h) — aucune configuration cron système
supplémentaire n'est nécessaire tant que PM2 garde le process backend vivant.

---

## 3. Dépendances ouvertes (cf. CDC §1.4 / §16.1)

À confirmer avant mise en production — le code est déjà architecturé pour les recevoir sans refonte :

- Passerelle de paiement carte définitive (Chargily Pay proposé — `backend/src/lib/payments/gateway.ts`)
- Fournisseur SMS (`backend/src/lib/sms.ts` — interface posée, aucun fournisseur branché)
- Fournisseur email définitif (Resend proposé — `backend/src/lib/email.ts`, fallback console.log en dev)
- Grille tarifaire réelle des formules (actuellement des placeholders dans `backend/prisma/seed.ts`)
- Catalogue et prix réels des services entrepreneuriaux
- Adresse, horaires et contacts officiels du lieu Hydra
- Contenu légal définitif (mentions légales, CGU)
