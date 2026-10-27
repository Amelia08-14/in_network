# IN NETWORK — Plan de corrections du site (audit + catalogue)

> Fichier de pilotage pour Claude Code. Site en production : https://in-network.dz/ (API : https://api.in-network.dz/).
> Établi le 27/10/2026 en comparant le site en ligne avec l'audit (`AUDIT SITE IN NETWORK.pdf`) et le catalogue client (`CATALOGUE IN NETWORK.pdf`).

## Instructions pour Claude Code

1. **Commence par explorer le dépôt** (stack, structure des pages, origine des contenus : en dur dans le code, fichiers de données, CMS ou base via l'API). Ne suppose aucune technologie. Résume ce que tu as trouvé avant de modifier quoi que ce soit.
2. Si un contenu (prix, service, témoignage, événement, fiche membre) vient de la **base de données / back-office** et pas du code, ne le modifie pas en base : signale-le et indique où l'éditer.
3. Traite les tâches **dans l'ordre des étapes**, une tâche à la fois. Après chaque tâche terminée, coche-la dans ce fichier (`- [x]`) et ajoute en dessous une ligne `→ fait : <fichier(s) modifié(s)>`.
4. **Ne touche jamais aux tâches marquées `🔒 BLOQUÉ`** : elles attendent une réponse du client. Tu peux seulement préparer le code (ex. composant prêt à recevoir le contenu) si la tâche le précise.
5. Les textes à intégrer sont en **Annexe** (copiés du catalogue). Reprends-les tels quels, en corrigeant seulement l'orthographe et la typographie (espaces insécables, apostrophes). **Ne publie jamais** les notes internes du catalogue (voir tâche 2.8).
6. Vouvoiement partout. Unité monétaire : voir tâche 1.11 (une seule notation sur tout le site).
7. Ne change pas l'identité graphique existante ; reprends les composants déjà présents (cartes, badges, boutons « Ajouter au devis »).
8. Un commit par tâche (ou groupe de tâches liées), message en français : `fix(services): ...`, `feat(temoignages): ...`.
9. À la fin de chaque étape, liste ce qui reste à vérifier manuellement (navigateur, mobile).

Légende des sources : **[Audit]** recommandation de l'audit · **[Catalogue]** contenu du catalogue client · **[Constat]** relevé en parcourant le site en ligne.

---

## Déjà fait sur le site (ne pas refaire)

Accroche + boutons de l'accueil, section « Le parti pris », « Trois leviers, un seul endroit », « Comment ça marche » (boutons Créer mon compte / Connectez-vous), galerie des espaces légendée, vitrine annuaire, séparation événements à venir / passés + lien galerie, CTA final « Votre prochaine opportunité commence ici », refonte Services & tarifs, noms des bureaux privés (Alpha/Bêta/Gamma/Delta, Lamda/Julia, Rouge/Vert/Orange, Roof), FAQ, page À propos (vision, mission, Maison IN Groupe), page Contact (champ Sujet, bouton « Envoyer mon message »), structure des mentions légales, mention « Les montants affichés sont indicatifs… » dans le récapitulatif du devis. Contenus catalogue déjà en ligne : 5 offres, abonnement annuel Access/Premium/Elite, 9 étapes de création, 6 étapes IN CUBATOR, lieux événementiels.

---

## Étape 1 — Corrections immédiates (aucune validation client nécessaire)

- [x] **1.1 [Audit] Bouton WhatsApp** — lien actuel `https://wa.me/213560067486?text=...`. Vérifier qu'il s'ouvre correctement (mobile = app, desktop = WhatsApp Web), `target="_blank"` + `rel="noopener noreferrer"`, `aria-label` présent. Test réel à faire manuellement : le noter dans le rapport.
  → fait : frontend/src/components/layout/WhatsAppButton.tsx (`rel="noopener noreferrer"`, `aria-label` précisé, `title`). Lien `wa.me` conservé (app sur mobile, WhatsApp Web sur ordinateur) — test réel sur téléphone à faire manuellement.
- [x] **1.2 [Audit] Témoignages — doublons** (accueil, section « Ils témoignent »). 6 vidéos affichées pour 3 témoignages : les mêmes textes apparaissent signés « Membre IN NETWORK » puis « Mohamed Toufik », « Anis », « Fares ». Sources vidéo en double : `uploads/sites/testimonial-0|1|2.mp4` et `uploads/testimonials/<uuid>.mp4`. Garder une seule entrée par témoignage (privilégier celle avec le prénom) et identifier d'où vient la duplication (deux sources fusionnées ?).
  → fait : frontend/src/lib/testimonials.ts (nouveau), frontend/src/app/(public)/page.tsx, backend/prisma/seed.ts. Origine : le seed a recréé le 06/09/2026 trois témoignages « Membre IN NETWORK » (uploads/sites/testimonial-N.mp4) alors que les mêmes vidéos (fichiers identiques) étaient déjà publiées depuis l'admin avec le prénom. Le site garde désormais la version signée ; le seed ne recrée plus le doublon. **En base** : dépublier les 3 entrées « Membre IN NETWORK » dans Admin › Témoignages.
- [x] **1.3 [Audit] Témoignages — vidéos et vignettes** : chaque vidéo doit se lancer ; vignettes de même ratio et même rendu (poster image défini) ; ouverture facile (clic sur toute la vignette).
  → fait : frontend/src/components/features/TestimonialReels.tsx (vignettes 9:16 identiques, poster = `thumbnailUrl` ou première image via `#t=0.1`, bouton lecture visible, toute la vignette cliquable, `aria-label`, fermeture Échap). Les 6 fichiers vidéo répondent (HTTP 200, `video/mp4`, `Accept-Ranges`).
- [x] **1.4 [Constat] Témoignages — textes tronqués** : les citations sont coupées en pleine phrase (« …l'expérience », « …l' »). Afficher une phrase complète (troncature au mot/à la phrase avec « … », ou texte complet).
  → fait : frontend/src/lib/testimonials.ts (`completeQuote` : on garde les phrases complètes, émojis retirés, sinon coupe au mot + « … »).
- [x] **1.5 [Catalogue] Capacité de la salle de conférence** : la page `/services` (section Salles) indique **30 personnes**, la page `/services/evenementiel` et le catalogue indiquent **20 personnes**. Mettre 20.
  → fait : backend/prisma/catalogue.ts (capacité 20, description alignée sur le catalogue). Appliqué en base par `npm run catalogue:sync`.
- [x] **1.6 [Catalogue] Formation à la création d'entreprise** : actuellement classée « ADMINISTRATION ». La déplacer dans la catégorie « CRÉATION D'ENTREPRISE » et présenter les deux options ensemble, comme dans le catalogue : **Option 1 — Je comprends et je fais** (atelier, 10 000) / **Option 2 — Je délègue** (Essentiel / Avancé / Complet).
  → fait : backend/prisma/catalogue.ts (formation → CREATION_ENTREPRISE), frontend/src/lib/services-order.ts (`SERVICE_OPTION`, option 1 avant option 2), frontend/src/components/features/ServiceCard.tsx (mention « Option 1 — Je comprends et je fais » / « Option 2 — Je délègue »).
- [x] **1.7 [Catalogue] Catégories de services** alignées sur le catalogue (filtres de `/services` + badges des cartes) :
  - Secrétariat
  - Création d'entreprise (formation + création déléguée)
  - Administration = Ressources humaines + Expertise juridique (supprimer la catégorie « Juridique » séparée)
  - Finance = Comptabilité + Commissariat aux comptes (renommer « Comptabilité »)
  - Communication = les 6 services IN COM
  - Incubation = IN CUBATOR
  - (Les libellés de marque « IN ADMINISTRATION » / « IN FINANCE » restent en attente : voir 3.9.)
  → fait : backend/prisma/catalogue.ts (Expertise juridique → ADMINISTRATION), frontend/src/lib/services-order.ts (`displayCategory` : un service encore JURIDIQUE en base est rangé dans Administration), frontend/src/components/features/ServicesFilterGrid.tsx (onglets Secrétariat · Création d'entreprise · Administration · Finance · Communication · Incubation), ServiceCard.tsx (badge « Finance »).
- [x] **1.8 [Constat] FAQ n°1** (`/services`, « Quelles formules propose IN NETWORK ? ») : supprimer la phrase « Chaque formule peut être souscrite au mois ou sur engagement annuel. » Elle est fausse (abonnement annuel, Starter limité à 2 mois, domiciliation en contrat annuel).
  → fait : frontend/src/app/(public)/services/page.tsx (FAQ n°1).
- [x] **1.9 [Constat] Abonnement ELITE** : 189 000 / 12 = **15 750 DA / mois**, pas 15 700 (erreur reprise du catalogue). Corriger « soit 15 700 DA / mois » → « soit 15 750 DA / mois ».
  → fait : backend/prisma/catalogue.ts (« Soit 15 750 DA / mois »).
- [x] **1.10 [Constat] Balises `<title>`** :
  - `/a-propos` affiche « À propos — IN NETWORK — IN NETWORK » (suffixe ajouté deux fois) → « À propos — IN NETWORK ».
  - Toutes les pages `/services/<slug>` ont le titre de l'accueil → `<Nom du service> — IN NETWORK` + meta description propre à chaque service.
  - Vérifier les autres pages dynamiques (`/evenements/<slug>`, fiches annuaire) pour le même problème.
  → fait : a-propos/page.tsx (titre « À propos »), services/[slug]/page.tsx, evenements/[slug]/page.tsx, experts/[slug]/page.tsx (`generateMetadata` : titre + description propres), annuaire/layout.tsx et annuaire/[id]/layout.tsx (pages client : titre propre, non indexées), frontend/src/lib/seo.ts (nouveau).
- [x] **1.11 [Constat] Unité monétaire** : le site mélange « DA », « DZD », « DZD HT ». Choisir **une** notation (proposition : `DA` partout, avec `HT`/`TTC` quand c'est pertinent) et l'appliquer via une fonction/composant de formatage unique si possible.
  → fait : frontend/src/lib/money.ts (nouveau : `CURRENCY = 'DA'`, `formatDa`, `formatNumber`), lib/quote.ts, services/page.tsx, services/[slug]/page.tsx, experts/[slug]/page.tsx, ServiceCard.tsx, QuoteCart.tsx, ServiceRequestPanel.tsx, dashboard/catalogue, admin/statistiques. Notation retenue : « DA », « DA HT » sur les formules au mois. La devise technique `DZD` reste en base.
- [x] **1.12 [Constat] E-mail** : le pied de page affiche `Contact@in-network.dz` (lien `mailto:Contact@...`). Mettre `contact@in-network.dz` partout.
  → fait : frontend/src/components/layout/Footer.tsx, backend/src/config/env.ts, backend/.env.example. **À vérifier sur le VPS** : la variable `COMPANY_EMAIL` du `.env` de production (en-tête des PDF / e-mails).
- [x] **1.13 [Constat] Cartes Pack 03, 04, 05** (accueil et `/services`) : le texte s'arrête à « auquel s'ajoutent : » sans la liste. Afficher la liste (Pack 03 : Comptabilité, Secrétariat · Pack 04 : Marketing · Pack 05 : Ressources humaines, Formation).
  → fait : frontend/src/components/features/ServiceCard.tsx (`serviceSummary` : quand la phrase d'accroche finit par « : », la liste suit — « Le Pack 03, auquel s'ajoutent : Comptabilité, Secrétariat »). Sur `/services`, la section « Depuis l'étranger » affichait déjà la liste ; l'accueil n'affiche plus les packs (cf. 5.4).

---

## Étape 2 — Enrichir les pages avec les textes du catalogue

Objectif de l'audit : « valoriser les bénéfices clients plutôt que d'énumérer les prestations ». Les pages `/services/<slug>` sont aujourd'hui des listes courtes. Utiliser les textes de l'**Annexe**. Structure suggérée pour chaque page détail : accroche (H1/sous-titre) → introduction → prestations (titre en gras + description) → « L'objectif » → bloc CTA (Ajouter au devis / Nous contacter) → tarification.

- [x] **2.1 Secrétariat** (`/services/service-secretariat`) : une carte par formule avec son accroche et ses textes (WORK « L'essentiel au quotidien », NET « Plus de fluidité pour votre activité », NETWORK « Un service complet et personnalisé ») + **tableau comparatif** des prestations (Annexe A).
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Une carte par formule WORK / NET / NETWORK (accroche, textes, prestations, prix et « Ajouter au devis » par formule) + tableau comparatif avec la ligne « Prix / mois ».
- [x] **2.2 Création d'entreprise** (`/services/creation-entreprise` et `/services/formation-creation-entreprise`) : remplacer la liste des 9 étapes par une **frise numérotée** avec les titres orientés bénéfice (« Donnez une identité à votre entreprise », etc.) + phrase de conclusion (Annexe B). Mettre en évidence quelles étapes couvre chaque formule (1–4, 1–7, 1–9).
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Frise numérotée des 9 étapes (titres orientés bénéfice + phrase de conclusion en CTA) sur les deux fiches ; sur la création déléguée, chaque étape indique les formules qui l'incluent (Essentiel 1–4, Avancé 1–7, Complet 1–9, lu dans les libellés de prix). Bloc « Option 1 / Option 2 » sur les deux fiches.
- [x] **2.3 Ressources humaines** et **Expertise juridique** : textes IN ADMINISTRATION (Annexe C).
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Famille affichée « Administration » (libellé « IN ADMINISTRATION » en attente, tâche 3.9) ; astérisques parasites du catalogue retirés.
- [x] **2.4 Comptabilité** et **Commissariat aux comptes** : textes IN FINANCE (Annexe D).
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Famille affichée « Finance » (libellé « IN FINANCE » en attente, 3.9) : « Avec IN FINANCE, bénéficiez… » devient « Bénéficiez… ».
- [x] **2.5 Les 6 services Communication** (stratégie, identité visuelle, digital & print, événementiel, relations publiques, IN DEV) : textes IN COM (Annexe E), avec la conclusion « IN COM — De la stratégie à l'impact… ».
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Les 6 fiches IN COM (dont les lieux événementiels sur la fiche Événementiel), introduction IN COM en tête de la section « Les autres services IN COM », conclusion + signature « IN COM — De la stratégie à l'impact… » dans le CTA.
- [x] **2.6 IN CUBATOR** (`/services/in-cubator`) : texte d'introduction + 6 étapes détaillées + « Votre ambition mérite un accélérateur » (Annexe F).
  → fait : frontend/src/lib/service-content.ts (nouveau, textes du catalogue), frontend/src/app/(public)/services/[slug]/page.tsx (fiche refaite : accroche → introduction → prestations → objectif → CTA → tarification, + autres services de la famille). Introduction (4 paragraphes), frise des 6 étapes, « Votre ambition mérite un accélérateur » en CTA.
- [x] **2.7 Salles de réunion** (`/services#salles`) : ajouter le bloc « Les équipements qui font la différence » (3 items) et le CTA « Votre prochaine rencontre mérite le bon cadre » (Annexe G).
  → fait : frontend/src/app/(public)/services/page.tsx (bloc « Les équipements qui font la différence » marqué « En extra », 3 items, et bandeau CTA « Votre prochaine rencontre mérite le bon cadre » avec « Réserver une salle » / « Visiter l'espace »).
- [x] **2.8 Garde-fou** : vérifier par une recherche dans le code et les données qu'**aucune note interne du catalogue** n'est publiée : « tiers d'ancrage », « priorité commerciale », « cash-flow », « Plan Commercial Confidentiel », « Profil cible », « équivalent mensuel identique au tarif classique », « vente unique qui vaut 12 mois ».
  → fait : recherche dans frontend/src, backend/src, backend/prisma, docs, et sur les pages en ligne (accueil, /services, /a-propos, /contact) + API /api/services et /api/plans : aucune des expressions listées n'est publiée (seul « confidentiel » apparaît, au sens courant). À noter : la phrase « Tarif mensuel classique : environ 8 000 DA / mois » (option domiciliation) est toujours en ligne — elle relève de la tâche 3.1, bloquée.

---

## Étape 3 — 🔒 En attente du client (ne rien modifier sans réponse)

Quand une réponse arrive, elle sera ajoutée sous la tâche (`→ réponse : ...`) ; la tâche devient alors exécutable.

**Tarifs et offres (incohérences présentes dans le catalogue lui-même)**
- [ ] **3.1 🔒 [Catalogue] Option domiciliation (abonnement annuel)** : « Tarif mensuel classique : environ 8 000 DA / mois » est faux (carte domiciliation 10 900 DZD HT/mois ≈ 12 970 TTC ; l'économie de 55 000 DA se calcule sur le contrat annuel à 155 652 TTC). Proposition : remplacer par « Contrat annuel classique : 155 652 DA TTC ».
- [ ] **3.2 🔒 [Catalogue] Pack 01 diaspora (185 652 DZD)** = domiciliation 155 652 + 30 000, alors que l'atelier de création est à 10 000. Quel prix est juste ?
- [ ] **3.3 🔒 [Catalogue] Packs diaspora HT ou TTC ?** (le catalogue signale lui-même l'information manquante). Une fois connu, l'afficher sur les 5 packs.
- [ ] **3.4 🔒 [Catalogue] Bureau jusqu'à 4 personnes (Lamda/Julia)** : « 2 bureaux + meuble de rangement », identique au bureau 2 personnes. À confirmer.
  → à noter pour la réponse : les visuels fournis le 27/10 montrent 4 postes dans les bureaux Lamda et Julia (et non 2 bureaux).
- [ ] **3.5 🔒 [Catalogue + Audit] Open space Roof (25 900) vs RDC (22 900)** : le catalogue donne le même texte aux deux ; sur le site, RDC liste 7 prestations et Roof 3. Qu'est-ce qui justifie l'écart et que comprend le Roof ? (même principe que la remarque de l'audit sur les bureaux A/B). *Possible dès maintenant : préparer la carte Roof pour qu'elle affiche les mêmes prestations de base que RDC + ses spécificités.*
  → non préparé volontairement : afficher sur la carte Roof les prestations du RDC reviendrait à annoncer un contenu non confirmé. La carte affiche désormais le visuel de l'open space Roof (frontend/public/espaces/cowork_roof). Dès la réponse, compléter la liste dans backend/prisma/catalogue.ts (formule « Bureau open space Roof ») puis `npm run catalogue:sync`.
- [ ] **3.6 🔒 [Catalogue] Carte Domiciliation** : « Accès à l'espace 24h/24, 7j/7 sur tous les sites » — quels sites (Hydra est « site pilote ») ? Et cohérence avec « Accès aux espaces sur rendez-vous ».
- [ ] **3.7 🔒 [Constat] Salles** : Salle LMIG et tarifs « Membre » absents du catalogue → à valider. Salle de formation : tarif membre = tarif externe, alors que la section annonce des « tarifs préférentiels pour les membres ».
- [ ] **3.8 🔒 [Constat] Casier (3 900 DZD HT)** : une seule prestation listée. Compléter si le client précise ce qui est inclus.

**Positionnement et marques**
- [ ] **3.9 🔒 [Catalogue] IN FINANCE / IN ADMINISTRATION / IN COM** : marques de services d'IN NETWORK ou filiales ? La page À propos dit que chaque prestation est « facturée par la filiale compétente », mais IN FINANCE et IN ADMINISTRATION ne figurent pas dans La Maison IN Groupe. Selon la réponse : afficher ou non ces libellés sur `/services`.
- [ ] **3.10 🔒 [Catalogue] « Rooftop IN ART »** (catalogue, page Événementiel) vs **« IN ARTS »** (À propos, Maison IN Groupe) : quel nom ?
- [ ] **3.11 🔒 [Audit ↔ Catalogue] 3 piliers vs 5 leviers** : l'audit (en ligne) présente 3 piliers (lieu, réseau, services) ; le catalogue présente 5 leviers (Travailler, Structurer, Accompagner, Accélérer, Connecter) et l'accroche « Ce n'est plus un coworking. C'est un networking. ». Proposition : garder les 3 piliers sur l'accueil, utiliser les 5 leviers pour structurer la navigation de `/services`.
- [ ] **3.12 🔒 [Audit] Chiffres « +250 entreprises » / « +20 startups »** (accueil + À propos) : confirmer qu'ils sont justifiables.
- [ ] **3.13 🔒 [Audit] Ambition géographique** (À propos) : « Une vision nationale dès le départ » vs « écosystème de référence en Afrique du Nord et au-delà ». Garder la version validée.

**Contenus manquants**
- [ ] **3.14 🔒 [Catalogue + Audit] Adresse postale exacte** (catalogue : « À CONFIRMER, à placer sous la carte »). À afficher sur `/contact` sous la carte + pied de page + lien itinéraire. Ajouter aussi les données structurées `LocalBusiness` (JSON-LD) une fois l'adresse connue.
- [ ] **3.15 🔒 [Audit] Mentions légales** (`/mentions-legales`) : remplacer tous les « en cours de mise à jour » (forme juridique, RC, NIF, directeur de la publication, hébergeur : nom, adresse, site).
- [ ] **3.16 🔒 [Audit] Politique de confidentialité** : page inexistante. *Possible dès maintenant : créer la route `/confidentialite` avec la structure (données collectées, finalités, durée, droits loi 18-07, contact) et les liens depuis le pied de page et les mentions légales ; contenu final à valider.*
  → préparé : frontend/src/app/(public)/confidentialite/page.tsx (données réellement collectées d'après le code, finalités, cookies et stockage du navigateur, destinataires, droits loi 18-07, contact ; durées de conservation et hébergeur « en cours de mise à jour », bandeau « Document en cours de validation »), liens depuis le pied de page (Footer.tsx) et les mentions légales. Contenu final à valider.
- [ ] **3.17 🔒 [Audit] Événements à venir** : l'accueil doit montrer **3 événements à venir** (date complète, thème, lieu, bouton d'inscription) ; aujourd'hui : « Les prochaines dates arrivent bientôt ». Vérifier que le composant gère bien 1 à 3 événements quand ils seront saisis.
  → vérifié / préparé : frontend/src/components/features/EventCard.tsx (date complète avec jour et heure, désormais à l'heure d'Alger quel que soit le fuseau du serveur ; thème, lieu, bouton « S'inscrire »), frontend/src/app/(public)/page.tsx (3 prochains événements max., grille adaptée à 1, 2 ou 3 cartes). Il suffit de saisir les événements dans Admin › Événements.
- [ ] **3.18 🔒 [Constat] Événement « Octobre rose — Sumūd »** daté du 27 février 2026 : date à vérifier.
- [ ] **3.19 🔒 [Audit + Constat] Témoignages** : légende prénom + activité + contexte (avec accord des personnes) ; remplacer les textes actuels, écrits du point de vue de la marque (« le soin que nous apportons à notre espace »), par de vraies citations tirées des vidéos. *Possible dès maintenant : ajouter les champs `activite` / `contexte` au modèle et au composant.*
  → préparé : backend/prisma/schema.prisma + migration 20261027120000_temoignage_contexte (champ `authorContext` ; l'activité existait déjà : `authorRole`), backend/src/modules/admin/admin.schema.ts, frontend/src/app/(admin)/admin/temoignages/page.tsx (champs « Activité » et « Contexte »), TestimonialReels.tsx et accueil (légende prénom · activité · contexte).
- [ ] **3.20 🔒 [Audit] Maison IN Groupe** (À propos) : logos officiels des 10 filiales (aujourd'hui icônes génériques), un lien par filiale et le bouton « Découvrir toutes les filiales → » de la maquette. *Possible dès maintenant : prévoir les champs `logo` et `url` par filiale.*
  → préparé : frontend/src/app/(public)/a-propos/page.tsx (champs `logo` et `url` par filiale dans GROUP_BRANDS : le logo remplace l'icône, la carte devient un lien ; bouton « Découvrir toutes les filiales → » affiché dès que `GROUP_SITE_URL` est renseigné).
- [ ] **3.21 🔒 [Constat] Envoi du devis** : il faut être connecté pour envoyer une demande. Voulu ? Sinon, permettre l'envoi avec nom / e-mail / téléphone sans compte.

---

## Étape 4 — Annuaire [Constat, hors audit et catalogue]

- [x] **4.1** Fiches mises en avant sur l'accueil : n'afficher que des fiches complètes (nom, activité, ville, au moins un secteur). Exclure les fiches vides (ex. sans activité).
  → fait : backend/src/modules/profiles/profiles.service.ts (`getCommunityShowcase` : seules les fiches avec activité, ville et au moins un domaine d'activité sont mises en avant ; les chiffres restent calculés sur tous les profils validés).
- [x] **4.2** Normaliser l'affichage : majuscule en début de ville et de poste (« alger » → « Alger »), sans modifier les données saisies si ce n'est pas souhaité (formatage à l'affichage).
  → fait : frontend/src/lib/display.ts (nouveau : `formatCity`, `formatJobTitle`), appliqué sur l'accueil, MemberCard.tsx et annuaire/[id]/page.tsx. Formatage à l'affichage, données saisies inchangées.
- [x] **4.3** Secteurs : 57 membres déclarent 45 secteurs différents (saisie libre, doublons du type « Services aux entreprises » / « Services aux entreprises (B2B) »). Remplacer la saisie libre par une **liste fermée** dans l'inscription et le profil, et prévoir une migration des valeurs existantes (proposer la table de correspondance avant de l'appliquer).
  → fait (liste fermée) / proposé (migration) : backend/src/modules/profiles/profiles.service.ts (`assertClosedSectors` : nouveau libellé hors référentiel refusé, anciens libellés du profil tolérés), frontend/src/components/features/TagPicker.tsx (option `closed`), dashboard/profil/page.tsx, RegisterForm.tsx. Table de correspondance des 39 saisies libres relevées en production : docs/annuaire-secteurs-correspondance.md + script backend/prisma/migrate-sectors.ts (`npm run sectors:migrate`, simulation par défaut) — **non appliqué, à valider**.
- [x] **4.4** Rendre obligatoires « poste » et « activité » à l'inscription.
  → fait : backend/src/modules/auth/auth.schema.ts, auth.service.ts, companies/companies.schema.ts, companies.service.ts (poste et domaine d'activité obligatoires, domaine vérifié contre le référentiel et rattaché au profil), frontend/src/components/features/RegisterForm.tsx et store/auth.ts (champs « Poste » et « Domaine d'activité », liste groupée par famille).

---

## Étape 5 — Recette finale

- [x] **5.1** Relire tous les prix en comparant cartes, FAQ, packs, pages détail et catalogue corrigé (idéalement : une source unique de données pour les prix).
  → fait : source unique = backend/prisma/catalogue.ts (cartes, packs, fiches détail lisent la base alimentée par ce fichier) ; seuls montants écrits en dur : FAQ de /services (domiciliation 155 652 TTC, bureaux 45 000 / 65 000 / 105 000 / 205 000) — conformes. Base en ligne comparée au catalogue : identique, sauf les corrections de cette session (ELITE 15 750, salle de conférence 20 pers., catégories) qui s'appliqueront avec `npm run catalogue:sync`. Reste l'incohérence du Pack 01 (tâche 3.2).
- [ ] **5.2** Parcours complet sur mobile : accueil → inscription → ajout au devis → envoi du devis → formulaire de contact → lecture des vidéos.
  → partiel : rendu mobile vérifié (captures à 500 px : accueil, fiche création d'entreprise, inscription — pas de débordement, frise et boutons lisibles). **Reste à faire à la main sur un vrai téléphone** : inscription complète (nouveaux champs Poste / Domaine d'activité), ajout au devis → envoi, formulaire de contact, lecture des vidéos de témoignages, bouton WhatsApp.
- [x] **5.3** Vérifier titres et meta descriptions de toutes les pages ; liens cassés ; images sans `alt`.
  → fait : parcours automatique de 40 pages publiques (titres, descriptions, liens internes, `alt`) : aucun lien cassé, aucune image sans `alt`. Descriptions ajoutées : evenements, evenements/galerie, experts, partenaires, cgu, devis, register ; titres propres via layout : login, forgot-password, reset-password, verify-email. Vouvoiement : 25 textes au « tu » corrigés (connexion, mot de passe, inscription aux événements, messages d'erreur de l'API, e-mails). **Constat en base** : les 21 événements passés affichent publiquement « Date, lieu et description complète à confirmer depuis le dashboard admin » et des dates fictives (tous les 3 jours depuis le 01/01/2026) — à compléter dans Admin › Événements (contenu en base, non modifié).
- [x] **5.4 (suggestion)** L'accueil affiche les 22 services en entier (doublon de `/services`). Réduire à 4–6 cartes phares + bouton « Voir tous les services ».
  → fait : frontend/src/app/(public)/page.tsx — 6 cartes phares (une par famille : Secrétariat, Création d'entreprise, Ressources humaines, Comptabilité, Stratégie de communication, IN CUBATOR) + bouton « Voir les N services ».

---

# Annexe — Textes du catalogue à intégrer

> Copiés du catalogue client (orthographe d'origine conservée, à corriger à l'intégration). Prix déjà en ligne non répétés.

## Annexe A — Secrétariat

| Prestation | WORK | NET | NETWORK |
|---|:-:|:-:|:-:|
| Réception des courriers | ✔ | ✔ | ✔ |
| Accueil des visiteurs | ✔ | ✔ | ✔ |
| Gestion complète de vos courriers |  | ✔ | ✔ |
| Gestion des rendez-vous |  | ✔ | ✔ |
| Réception et gestion des appels téléphoniques |  |  | ✔ |
| Service téléphonique de recouvrement |  |  | ✔ |
| Organisation des déplacements |  |  | ✔ |
| Prix / mois | 4 000 | 7 000 | 25 000 |

SERVICE SECRÉTARIAT IN NETWORK

Un soutien au quotidien pour vous faire avancer.
Gagnez du temps, concentrez-vous sur votre activité et offrez à vos clients une expérience
professionnelle à la hauteur de vos ambitions.

Avec les services de secrétariat IN NETWORK, bénéficiez d’un accompagnement adapté à vos
besoins : de la réception de vos courriers à la gestion de vos tâches administratives, profitez
d’un service pensé pour simplifier votre quotidien et renforcer votre image professionnelle.

WORK — L’essentiel au quotidien

4 000 DZD / mois

Un accueil professionnel pour une organisation simple et efficace.

Bénéficiez des services essentiels pour soigner votre image et faciliter vos échanges
professionnels.

- Réception des courriers

- Accueil des visiteurs

Une solution simple et efficace pour votre quotidien.

NET — Plus de fluidité pour votre activité

7 000 DZD / mois

Plus de temps pour vos projets, moins de tâches administratives.

Optimisez votre organisation grâce à une gestion élargie de votre secrétariat. Vous bénéficiez
d’un accompagnement qui facilite le suivi de vos courriers et la coordination de vos
rendez-vous.

- Réception des courriers

- Accueil des visiteurs

- Gestion complète de vos courriers

- Gestion des rendez-vous
Gagnez en efficacité et concentrez-vous sur ce qui compte vraiment : votre activité.

NETWORK — Un service complet et personnalisé

25 000 DZD / mois

Un véritable relais au quotidien pour vous permettre de vous concentrer sur l’essentiel.

Confiez davantage de tâches administratives à IN NETWORK et bénéficiez d’un
accompagnement étendu pour faciliter votre organisation, fluidifier vos échanges et mieux gérer
vos priorités.

- Réception des courriers

- Accueil des visiteurs

- Gestion complète de vos courriers

- Gestion des rendez-vous

- Réception et gestion des appels téléphoniques

- Service téléphonique de recouvrement

- Organisation des déplacements

Déléguez vos contraintes administratives et consacrez votre énergie au développement de
votre entreprise.

Votre activité mérite un soutien à la hauteur de vos ambitions.

Que vous recherchiez les services essentiels ou une assistance administrative plus complète,
IN NETWORK vous propose une formule adaptée à vos besoins.

Choisissez votre formule et faites de votre temps votre meilleur atout.
Contactez notre équipe pour découvrir le service qui correspond à votre activité.

## Annexe B — Création d'entreprise : frise des 9 étapes

Votre entreprise en Algérie, étape par étape

De la première démarche à l’immatriculation officielle, avancez avec une vision claire de votre
parcours de création.

01

Donnez une identité à votre entreprise

Réservation de votre dénomination commerciale auprès du CNRC.

02

Officialisez les fondations de votre projet

Rédaction et établissement des statuts de votre société chez le notaire.

03

Donnez une adresse officielle à votre activité

Établissement du bail de location conformément aux formalités applicables.

04

Déclarez votre activité auprès de l’administration fiscale

Réalisation des formalités de déclaration d’existence auprès des services des impôts.

05

Préparez vos opérations financières

Ouverture d’un compte bancaire professionnel selon les exigences applicables à votre société.

06

Obtenez votre identification fiscale

Attribution du numéro d’identification fiscale (NIF).
07

Officialisez votre existence commerciale

Immatriculation au registre du commerce auprès du CNRC.

08

Mettez votre situation sociale en conformité

Affiliation à la CASNOS, selon le statut et les obligations applicables.

09

Finalisez votre identification statistique

Obtention du numéro d’identification statistique (NIS), selon les formalités applicables.
Ne laissez pas la complexité des démarches freiner votre ambition. IN NETWORK vous
accompagne dans la structuration de votre projet et vous aide à identifier les formalités
nécessaires à votre création d’entreprise en Algérie.

## Annexe C — IN ADMINISTRATION (RH + juridique)

IN ADMINISTRATION

Les bonnes expertises pour structurer et faire grandir votre entreprise.

Parce que développer une entreprise ne se résume pas à trouver des clients, IN NETWORK
vous donne accès à des expertises essentielles pour organiser votre activité, accompagner vos
équipes et encadrer vos démarches juridiques.

Ressources humaines, gestion de la paie et accompagnement juridique :** bénéficiez de
solutions adaptées à vos besoins pour gagner en sérénité, professionnaliser votre organisation
et vous concentrer sur votre développement.

### 01. Ressources humaines & Gestion sociale

Les bonnes personnes. Une gestion maîtrisée. Une équipe qui avance.

Du recrutement à la gestion administrative du personnel, bénéficiez d’un accompagnement
adapté à chaque étape de la vie de votre entreprise.

- Recrutement & sélection des talents : organisation du processus de recrutement, gestion
des candidatures et identification des profils correspondant à vos besoins.

- Contrats de travail & administration du personnel : préparation et élaboration des contrats
adaptés à votre organisation.

- Paie & déclarations sociales: accompagnement dans la gestion de la paie et le traitement
des déclarations sociales.

L’objectif : vous aider à structurer vos ressources humaines et à consacrer davantage de temps
à votre cœur de métier.

Tarification : sur devis personnalisé.

### 02. Expertise juridique & Protection de vos intérêts

Sécurisez vos démarches. Valorisez vos actifs. Avancez avec confiance.
À chaque étape de votre développement, vos contrats et vos actifs immatériels méritent une
attention particulière. Accédez à un accompagnement adapté à vos besoins juridiques et à vos
projets.

- Contrats & conventions : rédaction et revue de vos documents contractuels afin de mieux
encadrer vos relations professionnelles.

- Marques & brevets: accompagnement dans les démarches de dépôt et de protection de votre
propriété intellectuelle, en fonction de votre projet.

L’objectif : mieux encadrer vos engagements, protéger la valeur de votre entreprise et soutenir
votre développement.

Tarification : sur devis personnalisé.

Votre entreprise évolue. Votre accompagnement aussi.

Vous recrutez, structurez votre équipe, externalisez la gestion de votre paie ou souhaitez
protéger votre marque ?

Parlons de vos besoins et construisons une solution adaptée à votre entreprise.

Demandez votre devis personnalisé.

## Annexe D — IN FINANCE (comptabilité + commissariat aux comptes)

IN FINANCE

Maîtrisez vos chiffres. Sécurisez vos décisions. Préparez votre croissance.

La santé financière de votre entreprise est un levier essentiel de développement. Avec IN
FINANCE, bénéficiez d’un accompagnement adapté à vos obligations comptables et fiscales, et
accédez aux expertises nécessaires pour renforcer la fiabilité de vos informations financières.

De la tenue comptable à la préparation de vos comptes annuels, en passant par les
déclarations fiscales et sociales, nous vous aidons à structurer votre gestion et à avancer avec
une vision plus claire de votre activité.

### 01. Comptabilité & Gestion financière

Des comptes maîtrisés. Une gestion structurée. Des décisions éclairées.

Gardez le contrôle de vos obligations comptables et gagnez en visibilité sur la situation
financière de votre entreprise grâce à un accompagnement adapté à vos besoins.

- Tenue de comptabilité générale : assurez un suivi structuré de vos opérations comptables.

- Bilan annuel & comptes sociaux : préparez les documents nécessaires à la présentation de
votre situation financière.

- Déclarations fiscales et sociales : bénéficiez d’un accompagnement dans la préparation et
le suivi de vos obligations déclaratives.

- Gestion de la paie et des salariés : structurez le traitement de la paie et les opérations
administratives associées.

Notre objectif : vous aider à mieux piloter votre activité, à organiser vos obligations et à disposer
d’informations financières fiables pour prendre vos décisions.

Tarification : sur devis personnalisé.

### 02. Commissaire aux comptes & Audit légal

La transparence comme exigence. La fiabilité comme engagement.
Renforcez la confiance de vos partenaires grâce à un contrôle indépendant de vos comptes et à
une vérification menée dans le cadre des missions légalement applicables.

- Certification des comptes annuels : intervention dans le cadre d’une mission de certification
confiée à un professionnel habilité.

- Contrôle de conformité légale et réglementaire: vérification des éléments relevant du
périmètre de la mission.

- Identification des anomalies et irrégularités: examen des éléments comptables afin de
relever les points nécessitant une attention particulière.

- Examen des opérations sensibles : analyse des opérations entrant dans le champ de la
mission.

- Fiabilité et transparence financières : contribution à la confiance des associés, partenaires
et autres parties prenantes.

Notre objectif : contribuer à la fiabilité de l’information financière et à la transparence de votre
organisation.

Tarification : sur devis personnalisé.

Votre entreprise mérite une gestion financière à la hauteur de ses ambitions.

Que vous souhaitiez structurer votre comptabilité, organiser vos obligations déclaratives ou faire
certifier vos comptes, identifions ensemble l’accompagnement adapté à votre situation.

Parlons de vos besoins et demandez votre devis personnalisé.

## Annexe E — IN COM (6 services de communication)

IN COM

Votre marque mérite d’être vue. Votre ambition mérite de rayonner.

De la stratégie à l’impact, donnons à votre communication le pouvoir de faire la différence.

Une marque forte ne se contente pas d’exister : elle se distingue, attire l’attention et crée des
opportunités.

IN COM accompagne les entreprises, les entrepreneurs, les institutions et les porteurs de
projets dans la construction de leur image, le développement de leur visibilité et la valorisation
de leurs activités.

Stratégie de communication, identité de marque, marketing digital, événementiel, relations
médias et solutions web : nous mobilisons les expertises adaptées à vos objectifs pour
concevoir une communication cohérente, créative et performante.
Notre ambition : faire de votre communication un véritable moteur de visibilité, d’attractivité et de
croissance.

Nos prestations sont proposées sur devis, en fonction de vos besoins, de vos objectifs et de
l’ampleur de votre projet.

### 01. Stratégie de communication

Une vision claire. Un positionnement qui marque les esprits.

Avant de communiquer, il faut savoir ce que l’on veut incarner, à qui l’on s’adresse et comment
se démarquer.

IN COM vous aide à définir une stratégie cohérente avec votre marché, votre identité et vos
ambitions, pour faire les bons choix et donner une direction claire à votre communication.

- Analyse du marché et de votre environnement concurrentiel: identifiez les tendances, les
attentes de vos publics et les opportunités à saisir.

- Positionnement stratégique et conseil de marque : affirmez votre différence et clarifiez votre
proposition de valeur.

- Élaboration de plans de communication : structurez vos actions, vos messages et vos canaux
de diffusion.

- Stratégies multilingues: adaptez votre communication à vos différents publics et développez
votre présence sur de nouveaux marchés.

L’objectif : communiquer avec intention, cohérence et impact.

### 02. Identité visuelle et branding

Une identité reconnaissable. Une marque inoubliable.

Votre image est souvent le premier contact avec vos futurs clients. Elle doit refléter votre valeur,
inspirer confiance et vous distinguer immédiatement.

IN COM façonne des identités visuelles cohérentes et mémorables, pensées pour traduire votre
personnalité et renforcer votre positionnement.

- Création de logos : donnez à votre marque une signature visuelle distinctive.

- Conception de chartes graphiques : harmonisez vos couleurs, vos typographies et vos
supports pour construire une image cohérente.
- Refonte d’identité et repositionnement de marque: modernisez votre image et faites-la évoluer
avec vos ambitions.

- Déclinaison de votre univers visuel: assurez une présence homogène sur vos supports de
communication.

L’objectif : construire une image forte, professionnelle et immédiatement identifiable.

### 03. Communication digitale et print

Gagnez en visibilité. Faites de votre présence un avantage.

Être présent ne suffit plus. Il faut capter l’attention, susciter l’intérêt et donner envie de passer à
l’action.

IN COM conçoit des dispositifs de communication adaptés à vos audiences et à vos objectifs,
pour renforcer votre présence en ligne comme sur vos supports physiques.

- Gestion des réseaux sociaux : développez votre communauté, affirmez votre expertise et
entretenez une présence régulière.

- Création de contenus : valorisez votre savoir-faire à travers des textes, des visuels et des
formats adaptés à vos publics.

- Référencement naturel (SEO): améliorez la visibilité de votre site dans les moteurs de
recherche.

- Publicité digitale (SEA): développez des campagnes ciblées pour accroître votre visibilité et
générer des contacts qualifiés.

- Campagnes publicitaires multicanales : coordonnez vos prises de parole pour renforcer leur
portée.

- Conception de supports print et publicitaires: brochures, affiches, flyers, plaquettes
commerciales et supports de présentation.

L’objectif : faire de chaque prise de parole une occasion de renforcer votre marque et de
développer votre activité.

### 04. Événementiel et expériences de marque

Créez des rencontres. Faites vivre votre marque. Marquez les esprits.

Un événement réussi ne se résume pas à une date et à un lieu. C’est une expérience qui
rassemble, transmet un message et laisse une impression durable.
IN COM vous accompagne dans la conception et l’organisation d’événements professionnels,
culturels et promotionnels, de la réflexion initiale à la mise en œuvre opérationnelle, selon les
prestations retenues.

- Événements corporate: rencontres professionnelles, conférences, séminaires et événements
d’entreprise.

- Événements culturels et promotionnels : lancements, présentations de marque, rencontres
thématiques et animations.

- Conception et coordination événementielle: valorisation du concept, organisation logistique et
accompagnement de votre projet.

- Recherche de lieux adaptés: accédez à des espaces sélectionnés selon le format et les
besoins de votre événement.

### Des lieux pour donner vie à vos événements

Terrasse IN NETWORK — jusqu’à 50 personnes

Un cadre extérieur convivial pour vos rencontres professionnelles, cocktails, événements de
networking et formats intimistes.

Salle de conférence et petite terrasse — LA MAISON IN GROUPE — jusqu’à 20 personnes

Un environnement adapté aux réunions, conférences en petit comité, ateliers et présentations
professionnelles.

Rooftop IN ART — jusqu’à 50 personnes

Un lieu distinctif pour accueillir vos événements, créer des rencontres et proposer une
expérience qui sort du cadre habituel.

L’objectif : transformer vos événements en véritables expériences de marque et en occasions
de créer du lien.

### 05. Relations publiques et médias

Développez votre influence. Faites entendre votre voix.

Votre réputation est un actif stratégique. Une prise de parole bien construite peut renforcer votre
crédibilité, valoriser votre expertise et accroître votre visibilité auprès des publics qui comptent.

IN COM vous accompagne dans la préparation et la diffusion de vos messages, ainsi que dans
la valorisation de vos actualités et de vos initiatives.
- Relations médias : préparation des prises de contact et accompagnement de vos démarches
auprès des médias.

- Rédaction de communiqués de presse: transformez vos actualités en messages clairs et
pertinents.

- Préparation de conférences et prises de parole: structurez vos interventions et renforcez
l’impact de vos messages.

- Valorisation de votre expertise: mettez en avant vos projets, vos réalisations et vos temps
forts.

L’objectif : renforcer votre crédibilité, développer votre notoriété et installer durablement votre
marque dans son environnement.

### 06. IN DEV — Développement web et applications

Du digital à votre avantage.

Votre présence digitale doit être à la hauteur de vos ambitions. IN DEV accompagne vos projets
numériques pour concevoir des outils adaptés à votre activité, à vos utilisateurs et à vos
objectifs de développement.

- Création de sites web : développez une vitrine professionnelle, un site institutionnel ou une
plateforme adaptée à vos besoins.

- Conception d’applications mobiles : imaginez des expériences numériques pensées pour vos
utilisateurs.

- Intégration de solutions de paiement locales: facilitez les transactions en ligne en fonction des
solutions disponibles et des exigences applicables.

Développement de solutions numériques sur mesure: structurez vos besoins et identifiez les
fonctionnalités adaptées à votre projet.

L’objectif : faire du digital un outil concret au service de votre visibilité, de votre relation client et
de votre développement.

Votre ambition mérite une communication à sa hauteur.

Que vous lanciez une marque, développiez votre activité, organisiez un événement ou
souhaitiez accélérer votre transformation digitale, IN COM vous aide à identifier les leviers les
plus pertinents pour votre projet.
Un besoin précis ou une ambition plus globale ? Construisons ensemble une solution adaptée à
vos objectifs.

IN COM — De la stratégie à l’impact, votre marque prend une nouvelle dimension.

Prestations sur devis, selon le périmètre, les objectifs et les modalités du projet.

## Annexe F — IN CUBATOR

IN CUBATOR

De l’idée à la croissance, donnez une nouvelle dimension à votre projet.

Vous avez une ambition. Nous vous donnons les moyens de la concrétiser.

IN CUBATOR accompagne les entrepreneurs, les startups et les PME innovantes à chaque
étape de leur développement. Grâce à un accompagnement personnalisé, à l’expertise de
professionnels et à des ateliers orientés résultats, transformez votre potentiel en opportunités
concrètes.

Notre ambition : accélérer votre développement, sécuriser vos décisions et vous aider à passer
à l’échelle.

Une attention particulière est portée aux startups deeptech et aux PME du numérique, pour
lesquelles l’innovation doit devenir un véritable levier de croissance.

Votre parcours d’accélération en 6 étapes

01. Clarifiez votre vision

Diagnostic stratégique, structuration du projet et définition de vos priorités pour bâtir des
fondations solides.

02. Accélérez votre développement

Un accompagnement sur mesure et des conseils ciblés pour transformer vos ambitions en plan
d’action.

03. Testez. Validez. Ajustez.

Confrontez votre solution au marché, recueillez les retours du terrain et affinez votre proposition
de valeur.

04. Activez votre réseau

Accédez à un écosystème d’experts, de partenaires stratégiques et d’investisseurs potentiels
pour multiplier les opportunités.

05. Développez vos compétences
Participez à des formations et des ateliers pratiques pour renforcer votre expertise et gagner en
autonomie.

06. Concrétisez votre lancement

Préparez votre mise sur le marché, décrochez vos premiers clients et posez les bases d’une
croissance durable.

Votre ambition mérite un accélérateur.

Avec IN CUBATOR, ne vous contentez pas de développer une idée. Donnez-lui les moyens de
devenir un projet viable, visible et créateur de valeur.

## Annexe G — Salles : équipements et CTA

Bonus : Des espaces modulables sont aussi disponibles pour vos événements.
Connexion ultra-rapide et projecteur 8K à disposition.
Bénéficiez d’un environnement professionnel équipé pour accompagner vos intervenants, mobiliser vos
participants et valoriser la qualité de vos contenus.
( EN EXTRA )
Les équipements qui font la différence
Une connexion ultra-rapide

Pour vos visioconférences, démonstrations en direct et échanges sans interruption liée
à la connexion.

Un projecteur 8K à disposition

Valorisez vos présentations et vos contenus visuels avec un équipement adapté à vos
interventions.

Des espaces modulables pour vos événements

Selon la configuration et les disponibilités, découvrez des espaces adaptés à vos
conférences, rencontres professionnelles et événements d’entreprise.

Votre prochaine rencontre mérite le bon cadre.

Réunir, convaincre, transmettre ou fédérer : choisissez l’espace IN NETWORK adapté à
votre objectif et offrez à vos participants une expérience professionnelle de qualité.
