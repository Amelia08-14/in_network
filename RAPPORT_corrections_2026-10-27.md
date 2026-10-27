# IN NETWORK — Rapport des corrections du 27/10/2026

Source : `IN_NETWORK_plan_corrections.md` (audit + catalogue). Chaque tâche y est cochée avec la liste des fichiers modifiés.
Fusionné dans `main` le 27/10/2026 (branche de travail `corrections/audit-catalogue-2026-10-27`). **Pas encore déployé sur le serveur.**

## En bref

| Étape | État |
|---|---|
| 1 — Corrections immédiates (13 tâches) | ✅ toutes faites |
| 2 — Pages enrichies avec le catalogue (8 tâches) | ✅ toutes faites |
| 3 — En attente du client (21 tâches) | 🔒 aucune modifiée ; 4 préparations autorisées faites (3.16, 3.17, 3.19, 3.20) |
| 4 — Annuaire (4 tâches) | ✅ faites ; la migration des anciens secteurs est **proposée, non appliquée** |
| 5 — Recette (4 tâches) | ✅ 5.1, 5.3, 5.4 · ⏳ 5.2 : à finir sur un vrai téléphone |
| Images des espaces | ✅ 16 visuels intégrés, chacun associé au bureau qu'il représente |

Vérifications faites : TypeScript (frontend + backend) et ESLint sans erreur, 40 pages publiques parcourues (aucun lien cassé, aucune image sans `alt`), captures desktop et mobile des pages modifiées.

---

## ⚠️ À faire avant ou pendant le déploiement

**Déployer le frontend et le backend ensemble** : l'inscription exige désormais « Poste » et « Domaine d'activité » des deux côtés.

1. Fusionner la branche dans `main`.
2. Backend (VPS) :
   - `npm run deploy` (applique la migration `20261027120000_temoignage_contexte`) ;
   - `npm run catalogue:sync -- --dry-run`, relire le résultat, puis `npm run catalogue:sync`. Cette commande aligne la base sur le catalogue : salle de conférence 20 personnes, ELITE 15 750 DA / mois, formation rangée en « Création d'entreprise », juridique en « Administration ». ⚠️ Elle écrase les modifications faites dans l'admin sur les services du catalogue ;
   - redémarrer l'API (PM2).
3. Frontend : build + redémarrage, puis invalider le cache : `POST /api/revalidate?tag=plans`, `spaces`, `services`, `profiles`, `testimonials`.
4. Vérifier la variable `COMPANY_EMAIL` du `.env` de production : elle doit valoir `contact@in-network.dz` en minuscules (en-tête des PDF et e-mails).

## ⚠️ À corriger dans l'admin (contenu en base, non modifié par moi)

1. **Événements passés — priorité haute.** Les 21 événements passés affichent publiquement une note interne : « Date, lieu et description complète à confirmer depuis le dashboard admin ». Leurs dates sont fictives : un événement tous les 3 jours à partir du 01/01/2026, d'où « Octobre rose » au 27 février (tâche 3.18). Le seed les avait créés « à relire », puis ils ont été publiés sans être complétés. `Listing des events.xlsx` ne contient que les noms et les types. → Admin › Événements : compléter chaque fiche, ou la repasser « à relire ».
2. **Témoignages** : dépublier les 3 entrées « Membre IN NETWORK ». Le site ne les affiche déjà plus, mais elles restent en base. Le seed ne les recréera plus.

---

## Ce qui a été fait

### Étape 1 — Corrections immédiates
- **WhatsApp** : `rel="noopener noreferrer"`, libellé accessible précisé. Le test réel sur téléphone reste à faire.
- **Témoignages** :
  - Doublons : les 6 vidéos étaient en fait 3 fichiers identiques publiés deux fois. Le site garde désormais la version signée du prénom.
  - Citations : coupées à la dernière phrase complète, sans émojis.
  - Vignettes : même format, première image affichée avant lecture, bouton lecture visible, fermeture par Échap.
- **Salle de conférence** : 20 personnes.
- **Catégories** des filtres et badges, dans l'ordre du catalogue : Secrétariat · Création d'entreprise · Administration (RH + juridique) · Finance (comptabilité + commissariat aux comptes) · Communication · Incubation.
- **Création d'entreprise** : la formation et la création déléguée sont présentées ensemble, comme « Option 1 — Je comprends et je fais » et « Option 2 — Je délègue ».
- **FAQ** : suppression de la phrase fausse sur l'engagement mensuel.
- **ELITE** : 15 750 DA / mois.
- **Titres de pages** : « À propos » n'a plus le suffixe en double ; chaque fiche service, événement et expert a son propre titre et sa propre description.
- **Notation monétaire unique** : « DA », ou « DA HT » sur les formules au mois, via une seule fonction de formatage (`lib/money.ts`). Plus aucun « DZD » affiché.
- **E-mail** : `contact@in-network.dz` partout.
- **Packs 03 à 05** : la liste suit désormais « auquel s'ajoutent : ».

### Étape 2 — Fiches détail (`/services/<slug>`)
Nouvelle structure : accroche → introduction → prestations (titre en gras + description) → « L'objectif » → bandeau d'appel à l'action (Ajouter au devis / Nous contacter) → tarification → autres services de la même famille. Les textes des annexes A à G sont repris tels quels, avec l'orthographe et les espaces insécables corrigées.
- **Secrétariat** : une carte par formule (WORK, NET, NETWORK) et un tableau comparatif.
- **Création d'entreprise** : frise des 9 étapes. Sur la création déléguée, chaque étape indique les formules qui l'incluent (Essentiel 1–4, Avancé 1–7, Complet 1–9).
- **Administration, Finance, les 6 services IN COM** (avec les lieux sur la fiche Événementiel) **et IN CUBATOR** (frise des 6 étapes).
- **Salles** : bloc « Les équipements qui font la différence » (marqué « En extra ») et bandeau « Votre prochaine rencontre mérite le bon cadre ».
- **Garde-fou** : aucune note interne du catalogue n'est publiée, ni dans le code, ni dans les données, ni sur le site en ligne.
- Tâche 3.9 bloquée : les libellés « IN ADMINISTRATION » et « IN FINANCE » ne sont pas affichés. Les familles s'appellent « Administration » et « Finance », et « Avec IN FINANCE, bénéficiez… » devient « Bénéficiez… ». Si la réponse est positive, il suffit de modifier `FAMILIES` dans `frontend/src/lib/service-content.ts`.

### Étape 3 — Préparations (rien n'a été tranché à la place du client)
- **3.16** : page `/confidentialite` créée, avec des liens depuis le pied de page et les mentions légales. Elle ne décrit que les données réellement collectées par le site. Les durées de conservation et l'hébergeur sont marqués « en cours de mise à jour », avec un bandeau « Document en cours de validation ».
- **3.17** : la carte événement affiche date, thème, lieu et bouton d'inscription. L'heure est forcée à l'heure d'Alger, et la grille de l'accueil s'adapte à 1, 2 ou 3 événements.
- **3.19** : nouveau champ « Contexte » (migration) dans l'admin des témoignages. Légende affichée : prénom · activité · contexte.
- **3.20** : champs `logo` et `url` prévus pour chaque filiale, ainsi que le bouton « Découvrir toutes les filiales → » (affiché dès que son lien est renseigné).
- **3.5 non préparée volontairement** : afficher sur la carte Roof les prestations du rez-de-chaussée reviendrait à annoncer un contenu non confirmé.

### Étape 4 — Annuaire
- **Vitrine de l'accueil** : seules les fiches complètes apparaissent (activité, ville, au moins un secteur).
- **Ville et poste** : majuscule initiale à l'affichage (« alger » → « Alger », « founder » → « Founder »), sans toucher aux données saisies.
- **Secteurs en liste fermée** à l'inscription et dans le profil, contrôlée aussi côté serveur. Les anciennes saisies libres restent acceptées sur les profils qui les portent, pour ne bloquer personne.
- **Migration des 39 saisies libres** relevées en production : table proposée dans `docs/annuaire-secteurs-correspondance.md` (14 lignes à confirmer, marquées ⚠️). Le script `npm run sectors:migrate` est prêt ; il tourne en simulation par défaut. **À valider avant de lancer `-- --apply`.**
- **Inscription** : « Poste » et « Domaine d'activité » sont obligatoires.

### Étape 5 — Recette
- **Prix** : une seule source, `backend/prisma/catalogue.ts`. Les seuls montants écrits en dur (FAQ) sont conformes. La base en ligne correspond au catalogue, hormis les corrections de ce jour.
- **Accueil** : 6 services phares, un par famille, puis « Voir les N services ».
- **Pages** : titres et descriptions ajoutés partout où ils manquaient (événements, galerie, experts, partenaires, CGU, devis, inscription, connexion…).
- **Vouvoiement** : 25 textes au « tu » corrigés (connexion, mot de passe, inscription aux événements, messages d'erreur de l'API, e-mails).

---

## Images des espaces

Les 16 PNG (≈ 27 Mo) ont été convertis en WebP (≈ 1,6 Mo), avec des noms sans espaces ni accents. Les originaux sont restés sur le disque, sans être versionnés.

| Dossier | Visuel | Emplacement sur le site |
|---|---|---|
| `cowork_espace` | Alpha, Bêta, Gamma, Delta | `/services#bureaux`, carte « Jusqu'à 2 personnes » : une pastille par bureau, la photo affichée correspond au nom choisi |
| `cowork_espace` | Lamda, Julia | carte « Jusqu'à 4 personnes ». Julia : version « quatre postes et quatre chaises », conforme à la capacité ; la version à 2 chaises n'est pas utilisée |
| `cowork_colors` | Rouge, Vert, Orange | carte « Jusqu'à 8 personnes » |
| `cowork_roof` | Intérieur « Espace Roof » | carte « Bureau open space Roof » (`/services#espaces`), à la place de la photo du rez-de-chaussée |
| `cowork_roof` | Terrasse rooftop | carte « Bureau Roof — 14 personnes », légendée « Terrasse rooftop (accès inclus) » : ce bureau n'a pas de visuel propre, et le catalogue lui associe l'accès à la terrasse |

À noter :
- ce sont des visuels générés, pas des photos du lieu ; vérifiez qu'ils vous conviennent pour un usage commercial ;
- les visuels montrent 4 postes dans Lamda et Julia, alors que le catalogue indique « 2 bureaux + meuble de rangement » (tâche 3.4) ;
- si l'intérieur « Espace Roof » représente en fait le bureau privé de 14 personnes plutôt que l'open space, il suffit d'inverser les deux visuels dans `services/page.tsx`.

---

## Questions client toujours ouvertes (étape 3)
Inchangées : 3.1 à 3.15, 3.18 et 3.21 (domiciliation « environ 8 000 DA / mois », prix du Pack 01, HT/TTC des packs, Lamda/Julia, Roof, salles, casier, marques IN FINANCE / IN ADMINISTRATION, IN ART ou IN ARTS, piliers ou leviers, chiffres +250 / +20, ambition géographique, adresse, mentions légales, date d'« Octobre rose », devis sans compte).
S'y ajoutent : la validation de la table des secteurs (4.3), et les dates et lieux réels des 21 événements passés.

## À vérifier à la main après déploiement
- Sur téléphone : inscription complète (nouveaux champs), ajout au devis puis envoi, formulaire de contact, lecture des vidéos de témoignages, bouton WhatsApp (application mobile / WhatsApp Web).
- `/services` : filtres par famille, galeries des bureaux, bloc des salles.
- Quelques fiches détail : secrétariat, création d'entreprise (les deux options), une fiche IN COM, IN CUBATOR.
- Accueil : 3 témoignages au lieu de 6, 6 cartes de services.

---

## Compléments du 27/10/2026 (après relecture)

- **Nouvelles photos du lieu** : 8 vraies photos remplacent les images médiocres (terrasse sous pergola, open space, îlot de postes, allée de coworking, salon d'accueil, casiers, grande salle, salle de formation). Elles sont converties en WebP sous de nouveaux noms, pour que les navigateurs ne gardent pas les anciennes en cache ; les anciens fichiers sont supprimés. La cuisine et la petite salle de réunion gardent leur photo d'origine.
- **Adresse exacte** (tâche 3.14) : « N°08, Parc Paradou, Hydra 16035 », affichée sur la page contact (carte « Notre adresse » et sous la carte, avec lien itinéraire) et dans le pied de page, avec données structurées `LocalBusiness` sur toutes les pages publiques. Le « Siège social » des mentions légales n'est pas modifié, car il peut différer de l'adresse du lieu (tâche 3.15).
- **Filiales** (tâche 3.20) : IN ACADEMY, IN BEAUTY & HEALTH, IN DENTAL CARE et IN DEV deviennent des cartes cliquables (« Visiter le site »). Les 4 liens ont été testés. Restent : les logos officiels et les sites des autres filiales.
- **Suppression de comptes réservée au super administrateur** : le serveur refuse la suppression d'un membre ou d'un utilisateur système à tout autre rôle, et le bouton est masqué pour eux. Les autres rôles peuvent toujours désactiver un compte. La pièce d'identité d'un membre supprimé est effacée avec son compte.
- **Pièce d'identité obligatoire** pour un profil complet :
  - le membre l'envoie depuis « Mon profil » (PDF, JPG, PNG ou WebP, 10 Mo maximum) ;
  - le fichier est privé (`private-uploads/identity`), jamais accessible par un lien public ;
  - l'équipe la consulte depuis la fiche membre de l'admin (droit « Membres »).
  - ⚠️ Effet immédiat : les membres existants qui ne l'ont pas encore envoyée voient leur profil repasser « incomplet ». Les actions qui exigent un profil complet (commandes, réservations, mises en relation) sont donc bloquées tant qu'ils ne l'ont pas envoyée. Prévenez-les au moment du déploiement.
- **Déploiement** : une migration de plus (`20261027130000_piece_identite`), appliquée par `npm run deploy` comme la précédente. Sur le VPS, le dossier `backend/private-uploads/identity` est créé automatiquement au démarrage ; il doit être inclus dans les sauvegardes, comme `private-uploads/proofs`.
