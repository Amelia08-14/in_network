# Annuaire — correspondance des domaines d'activité (proposition)

Tâche 4.3 du plan de corrections (27/10/2026). **Rien n'est appliqué** tant que cette table n'est pas validée.

## Constat

Relevé en production le 27/10/2026 (`GET /api/tags?category=SECTOR&all=1`) : 188 domaines d'activité, dont **39 saisies libres** de membres (hors référentiel), avec des doublons du type « Services aux entreprises » / « Services aux entreprises (B2B) », « Média » / « Médias », des fautes (« Commecial », « TRANING ») et des saisies de test.

Depuis cette correction, la liste est **fermée** : à l'inscription et dans le profil, on ne peut choisir qu'un libellé du référentiel (`backend/prisma/taxonomy.ts`). Les anciennes saisies libres restent sur les profils concernés jusqu'à la migration ci-dessous.

## Table proposée

Confiance : ✅ évident · ⚠️ à confirmer (plusieurs choix possibles, ou demander au membre).

| Saisie libre actuelle | Libellé proposé (référentiel) | Confiance |
|---|---|:-:|
| Accompagnement Stratégique & Financier | Conseil & stratégie | ⚠️ (ou « Conseil en gestion ») |
| Agro | Agroalimentaire | ⚠️ (ou « Agriculture ») |
| Audiovisuel | Audiovisuel & cinéma | ✅ |
| Beauté | Beauté & esthétique | ✅ |
| Bien-être | Bien-être & spa | ✅ |
| Commecial | Commerce de détail | ⚠️ (ou « Commerce de gros », « Vente directe ») |
| Conseil et accompagnement des entreprises | Conseil & stratégie | ✅ |
| Cosmétiques | Cosmétique & hygiène | ✅ |
| Création numérique | Design & création | ⚠️ |
| développement économique | Conseil & stratégie | ⚠️ (ou « Institutions de financement ») |
| économie bleue | Pêche & aquaculture | ⚠️ (ou « Environnement & développement durable ») |
| économie sociale et solidaire | Économie sociale & solidaire | ✅ |
| embeeded systems development | Objets connectés (secteur) | ✅ |
| Foires & Événementiels | Événementiel | ✅ |
| Formation | Formation & développement des compétences | ✅ |
| HBVVJVHIBKHB | *(retirée : saisie sans sens)* | ✅ |
| incubation de startups | Incubateurs & accélérateurs | ✅ |
| industrie | Industrie manufacturière | ⚠️ |
| Industrie pharmaceutique | Pharmaceutique & parapharmacie | ✅ |
| Informatique | Services numériques (ESN) | ⚠️ (ou « Tech ») |
| Innovation | Startups & innovation | ✅ |
| IT | Services numériques (ESN) | ⚠️ (ou « Tech ») |
| Marketing et Publicité | Marketing & publicité | ✅ |
| Média | Médias & presse | ✅ |
| Médias | Médias & presse | ✅ |
| Projets Immobiliers | Promotion & développement immobilier | ✅ |
| Prospection commerciale et acquisition de clients | Marketing & publicité | ⚠️ (ou « Centres d'appels & externalisation ») |
| Services aux entreprises | Conseil & stratégie | ⚠️ (intitulé trop large : demander au membre) |
| Services aux entreprises (B2B) | Conseil & stratégie | ⚠️ (idem) |
| Services Digitaux et Publicitaires | Marketing & publicité | ✅ |
| Software engineering | Édition de logiciels & SaaS | ✅ |
| technique | Autre secteur | ⚠️ (demander au membre) |
| technologie | Tech | ✅ |
| test | *(retirée : saisie de test)* | ✅ |
| test sec 1 | *(retirée : saisie de test)* | ✅ |
| test sec 2 | *(retirée : saisie de test)* | ✅ |
| tous les domaines | Autre secteur | ⚠️ |
| TRANING | Formation & développement des compétences | ✅ |
| xxxxxxxxxxx | *(retirée : saisie de test)* | ✅ |

## Application (après validation)

1. Corriger la table dans `backend/prisma/migrate-sectors.ts` (`SECTOR_MAPPING`) selon les réponses.
2. Sur le serveur : `npm run sectors:migrate` (simulation, affiche le nombre de profils concernés par ligne), puis `npm run sectors:migrate -- --apply`.
3. Invalider le cache de l'accueil : `POST /api/revalidate?tag=profiles`.
