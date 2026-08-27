# IN NETWORK — Brief de développement (in-network.dz)

> Compilé à partir de deux documents d'audit réels (audit interne "AUDIT SITE IN Network / V-2026" + rapport d'observations IN COM). Aucun contenu inventé — les données manquantes sont signalées explicitement, pas remplacées par des placeholders.
> Usage : coller ce fichier tel quel dans Claude Code, sur le repo `in-network.dz`.

## Contexte technique

Stack de référence LMIG (tous projets) : Next.js 16 (App Router) / React 19 / TypeScript strict / Tailwind CSS v4 / shadcn/ui / Express 5 / Prisma 7 / MySQL / VPS (Nginx + PM2 + Certbot).

État connu : IN NETWORK est live sur in-network.dz, mais son stack est **en retard sur le standard portefeuille LMIG** (constat antérieur à cet audit). C'est pourquoi l'alignement stack est traité en préalable (§0), avant tout chantier fonctionnel.

---

## §0 — P0 : Alignement stack (préalable obligatoire)

1. Inventorier `package.json` (frontend + backend s'il existe) : versions Next.js, React, TypeScript, Tailwind, Prisma, Express.
2. Comparer à la stack de référence ci-dessus. Produire un tableau d'écart (version actuelle → cible) avant de toucher au code.
3. Vérifier `tsconfig.json` → `strict: true` doit être actif.
4. Vérifier si shadcn/ui est en place comme base de composants. Si absent, ne pas tout réécrire d'un coup — l'introduire progressivement au fil des chantiers ci-dessous plutôt qu'en migration big-bang.
5. **Ne pas lancer de migration majeure (Next 16, Tailwind v4) sans validation d'Amelia** si des breaking changes sont détectés. Livrer le tableau d'écart + un plan de migration incrémental (ordre des étapes, risques) et attendre le feu vert.

---

## §1 — P0 : Bugs bloquants (à corriger avant tout le reste)

### 1.1 Inscription bloquée à l'étape 2/3
- Symptôme : le formulaire de création de compte affiche « Une erreur est survenue » sans détail ; le bouton « Créer mon compte » ne répond pas.
- Action : reproduire le parcours, inspecter la requête réseau (payload + réponse API) à l'étape 2, identifier pourquoi la soumission échoue silencieusement.
- Corriger le handler du bouton « Créer mon compte ».
- Remplacer le message générique par des messages contextualisés :
  - champ manquant → préciser lequel
  - email déjà utilisé
  - erreur serveur (5xx)
  - erreur de validation (format)
  - problème de connexion réseau
- **Critère de fin** : un compte peut être créé de bout en bout sans erreur silencieuse, et chaque cas d'erreur ci-dessus affiche un message exploitable par l'utilisateur.

### 1.2 Réinitialisation de mot de passe : aucun email n'arrive
- Symptôme : clic sur « mot de passe oublié » ne déclenche aucun email.
- Action : vérifier l'endpoint backend de reset, la configuration du service d'envoi (SMTP / provider), les logs d'erreur serveur, et si l'email part en spam.
- **Critère de fin** : email de réinitialisation reçu en moins de 2 minutes, lien à usage unique fonctionnel.

### 1.3 Visibilité du mot de passe à la création de compte
- Ajouter un toggle afficher/masquer sur le champ mot de passe (et confirmation si le champ existe).

---

## §2 — P1 : Contenu et données réelles (placeholders à remplacer)

### 2.1 Coordonnées de contact
À utiliser partout où des coordonnées placeholder apparaissent (À propos / Contact / footer) :

| Champ | Valeur |
|---|---|
| Adresse | Lien Maps fourni : https://maps.app.goo.gl/HhqHgKntwi3HBuaR8 — le lien n'a pas pu être résolu en texte d'adresse depuis cet environnement ; confirmer le texte exact avec Amelia avant intégration, ou vérifier s'il figure déjà ailleurs dans le repo |
| Carte Google Maps | Intégrer un iframe Google Maps embed sur la page À propos / Contact, basé sur le lien ci-dessus |
| Téléphone | +213 5 60 06 74 86 |
| Email | Contact@in-network.dz |
| Horaires | 09h00–17h00 (heure administrative) — accès 24/7 pour les coworkers membres |

Ajouter aussi : bouton WhatsApp flottant (voir §4.9), réseaux sociaux, formulaire de contact.

### 2.2 Filiales du groupe LMIG
- Corriger les fautes d'orthographe dans les noms de filiales affichés sur le site.
- Rendre chaque filiale cliquable (lien vers son site/page).
- Pour chaque filiale, prévoir : description, activité, valeur ajoutée, lien site/réseaux sociaux, réalisations/références si disponibles. Filiales du groupe : IN DEV, IN ACADEMY, IN PAY, IN COM, IN IMMO, IN CAPITAL, IN BEAUTY & HEALTH, IN DENTALCARE, IN TRAVEL. **Le contenu détaillé par filiale n'est pas fourni dans l'audit — le demander à Amelia avant rédaction, ne pas inventer.**

### 2.3 Tarifs
- Les tarifs actuellement affichés sont obsolètes.
- Source de vérité indiquée dans l'audit : fichier « N°02 — service et tarifs IN NETWORK » (non joint ici). **Demander ce fichier à Amelia avant d'implémenter — ne pas inventer de prix.**
- Une fois les tarifs obtenus : compléter les prix des salles de réunion, clarifier HT/TTC, préciser ce qui est inclus par formule, ajouter conditions d'utilisation, un CTA par formule, et une FAQ tarifaire dédiée.

### 2.4 Visuels / galeries
- Les photos existent mais ne sont pas organisées par service. Créer une galerie dédiée par offre :
  - Bureaux privatifs
  - Open space
  - Salles de réunion
  - Salles de formation
  - Espaces événementiels
- Source indiquée dans l'audit : dossier « N°01 — Photos & Vidéos » (Google Drive, à obtenir auprès d'Amelia) + nouvelle captation à prévoir pour le dispositif de rencontres parrainées (§4.2).
- Utiliser le logo IN Network (ou logo du groupe LMIG) en image de fond sur l'ensemble du site.

---

## §3 — P1 : Confidentialité et sécurité

### 3.1 Annuaire des membres — accès restreint
- L'annuaire doit devenir **privé**, accessible uniquement aux utilisateurs authentifiés et autorisés — pas en accès public.
- Les coordonnées des experts doivent être masquées aux visiteurs non-membres.
- Ajouter une validation manuelle des profils avant publication.

---

## §4 — P2 : Fonctionnalités et sections

### 4.1 Page d'accueil
- Fond : carte de l'Algérie (idéalement).
- Clarifier immédiatement ce qu'est IN Network ; positionner les 3 piliers : **Coworking / Réseau professionnel / Services aux entreprises**.
- Proposition de valeur claire dès le Hero ; cible précisée (entrepreneurs, freelances, startups, PME, entreprises).
- Localisation mise en avant : Hydra, Alger.
- Accroche à remplacer par : **« Un réseau qui dynamise les relations »** (remplace « un lieu, pas qu'un espace », « plus qu'un simple lieu », « une autre dimension », « une vision »).
- Hero orienté conversion, CTA visibles : « Devenir membre », « Découvrir les espaces », « Réserver une visite ».
- Renforcer la section « Pourquoi IN Network ? » : avantages membres, chiffres clés du réseau, vie réelle du coworking en image.

### 4.2 Nouveau parcours — Étape 3.1 : rencontres parrainées
- Le membre identifie une personne qu'il souhaite rencontrer dans le réseau ; IN Network parraine le rendez-vous (café + espace de rencontre offerts).
- Capter chaque rencontre en photo/vidéo pour alimenter les réseaux sociaux d'IN Network.

### 4.3 Annuaire (networking)
- Recherche avancée + filtres : secteur, métier, compétences, type de profil, localisation.
- Fiche membre : photo, présentation professionnelle, fonction, entreprise, expertise, expérience, LinkedIn, badge « Profil vérifié ».
- CTA « Demander une mise en relation » sur chaque fiche.
- Rappel §3.1 : annuaire privé, profils validés avant publication.

### 4.4 Page Partenaires
- Ne pas afficher une page « arrivent bientôt » sans contenu. Masquer la page tant qu'elle n'est pas suffisamment alimentée, ou créer une section « Ils nous font confiance » avec logos, noms, descriptions.

### 4.5 Coworking
- Présenter séparément : Open Space, Day Pass, Bureaux privés, Salles de réunion.
- Pour chaque espace : capacité, équipements disponibles, horaires, photos réelles, bouton « Réserver une visite ».

### 4.6 Services (domiciliation, création d'entreprise, etc.)
- Détailler par service : prestations incluses, conditions, documents nécessaires, prix « à partir de », délais, formulaire de demande.

### 4.7 Événements
- Séparer « Événements à venir » / « Événements passés ».
- Champs par événement : date, heure, lieu, intervenant, description, prix, nombre de places, bouton « Réserver ma place ».
- Pour les événements passés : photos, vidéos, aftermovies.

### 4.8 Blog « IN Network Insights »
- Créer la section, catégories : Entrepreneuriat, Business, Finance, Juridique, IA, Productivité, Coworking.
- Relier chaque article aux offres commerciales correspondantes.

### 4.9 Conversion
- Un CTA principal par page.
- Bouton WhatsApp flottant sur tout le site.
- Formulaire de prise de rendez-vous + option « Réserver une visite ».
- Formulaires courts ; CTA après chaque section importante.

### 4.10 Textes de présentation des services — copie prête à intégrer telle quelle

- **Domiciliation d'entreprise** — « une adresse qui inspire confiance à vos clients et partenaires dès le premier contact »
- **Bureaux privatifs** — « un espace à votre image, pour recevoir vos clients sans jamais douter de votre sérieux »
- **Open space** — « un environnement qui vous connecte à d'autres entrepreneurs, chaque jour, sans effort »
- **Salles de réunion et de formation** — « un cadre professionnel pour convaincre vos clients et signer plus vite »
- **Networking** — « des occasions provoquées de croiser la bonne personne, au bon moment »
- **Mise en relation entre entrepreneurs** — « un raccourci vers le partenaire, le client ou le fournisseur qu'il vous fallait »
- **Accompagnement des entreprises** — « un allié qui vous fait gagner du temps pour vous concentrer sur votre cœur de métier »
- **Événements professionnels** — « des rendez-vous qui font grandir votre réseau et votre visibilité »

### 4.11 FAQ — contenu prêt à intégrer

**Formules d'abonnement**
Quelles formules propose IN Network ? IN Network propose plusieurs formules adaptées aux besoins de chacun : accès bureau (open space), bureau privatif dédié, et formules de domiciliation ainsi que la création d'entreprise. Chaque formule peut être souscrite au mois ou sur engagement annuel.

**Domiciliation**
Qu'est-ce que la domiciliation chez IN Network ? La domiciliation permet à une entreprise d'établir son siège social à l'adresse d'IN Network, avec réception du courrier.

**Salles de réunion**
Comment réserver une salle de réunion ? Les salles de réunion et de formation sont réservables à l'heure ou à la journée, sur simple demande via le site ou l'équipe sur place, selon les disponibilités.

**Services proposés**
Quels services sont inclus ? IN Network propose des espaces de travail (bureaux privatif, open space), des salles de réunion et de formation, la domiciliation et création d'entreprise, ainsi qu'un accompagnement et une mise en réseau entre entrepreneurs.

**Modalités de réservation**
Comment réserver un espace ? La réservation se fait via le formulaire du site, par WhatsApp ou directement auprès de l'équipe. Une confirmation est envoyée avant la visite ou l'accès à l'espace.

**Horaires d'ouverture**
Quels sont les horaires d'accès ? 09h–17h horaires d'ouverture au public, accès 24/24h pour les membres.

**Conditions d'accès**
Qui peut accéder aux espaces IN Network ? L'accès aux espaces communs est réservé aux membres et à leurs invités. L'annuaire et les coordonnées des experts restent réservés aux utilisateurs disposant des droits d'accès appropriés.

---

## §5 — P2 : SEO

Titres de page actuels trop génériques. Répartir ces titres par page selon le contexte :

- Un réseau qui dynamise les relations
- Ici, chaque rencontre est une opportunité
- Le réseau qui fait avancer votre business
- Plus qu'un espace, un accélérateur de relations
- Votre prochain partenaire est peut-être déjà là
- Un réseau qui travaille pour vous
- L'endroit où les entrepreneurs se rencontrent
- Connectez-vous à ce qui compte

Intégrer des mots-clés stratégiques dans les balises `<title>` : coworking à Alger, domiciliation d'entreprise en Algérie, location de bureaux à Alger, salle de réunion à Alger, espace de coworking IN Network. Vérifier la cohérence titres ↔ méta-descriptions (les méta-descriptions contiennent déjà certains mots-clés, pas les titres actuels).

---

## §6 — P3 : Internationalisation

- Ajouter une version anglaise et une version arabe (site actuellement uniquement en FR).
- Prévoir la structure i18n dès l'implémentation (routing par langue, extraction des chaînes) même si le contenu AR/EN est livré plus tard.

---

## Definition of Done

- [ ] Tous les items P0 corrigés et vérifiés manuellement (inscription bout en bout, reset password reçu)
- [ ] Tableau d'écart stack livré à Amelia avant toute migration lourde (§0)
- [ ] Aucune coordonnée placeholder restante (grep sur les anciens numéros/emails génériques)
- [ ] Annuaire passé en accès privé + validation de profils active
- [ ] Build de production sans erreur (`npm run build`)
- [ ] Smoke test des parcours critiques : inscription, réservation, contact, FAQ
- [ ] Amelia informée des éléments en attente d'assets externes (tarifs, photos, adresse exacte, contenu filiales) — ne rien inventer à leur place

---
*Sources : « AUDIT SITE IN Network / V-2026 » + « Rapport d'observations et recommandations – Site web INetwork » (IN COM). Compilé le 26/08/2026.*
