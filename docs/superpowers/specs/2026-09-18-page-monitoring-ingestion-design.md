# Page de monitoring du pipeline d'ingestion — Design

Date : 2026-09-18
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte et objectif

Le pipeline d'ingestion (`src/ingestion/`, voir `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md`)
génère et vérifie des propositions par candidat × thème, mais n'offre aujourd'hui aucune vue
d'ensemble : pour savoir ce qui a été couvert, quand, et ce qui attend une relecture, il faut
ouvrir les fichiers JSON un par un. L'utilisateur a demandé une page de monitoring affichant le
contenu récupéré par thème et par candidat, la date de dernière ingestion, et un bouton pour
relancer le pipeline en mode "insert" (génération normale) ou "update" (`--refresh`).

**Tension identifiée et résolue avec l'utilisateur :** le site est aujourd'hui 100 % statique,
sans backend (`CLAUDE.md`), alors qu'un bouton « relancer » doit exécuter un script Node qui
appelle une clé API facturée. Après clarification :
- La page est **déployée publiquement** avec le reste du site.
- Le bouton de relance et le contenu de `_a-verifier.json` (propositions non relues) ne sont
  **actifs qu'en local** — jamais accessibles à un visiteur public. La clé API est un simple
  champ de confort local pour l'utilisateur (pas un système multi-utilisateur).
- La grille de couverture (thème × candidat, statuts, dates) est en lecture seule et sûre à
  déployer publiquement.

## Architecture

### Vue d'ensemble

```
src/ui/Monitoring.tsx (lecture seule, statique)     src/ingestion/serveur-local.ts (local uniquement)
──────────────────────────────────────────────      ──────────────────────────────────────────────────
import.meta.glob sur data/programmes/*/{meta,        GET  /api/sante     → 200 OK (health-check)
propositions,_a-verifier}.json                       POST /api/relancer  → exécute executerLot ou
→ grille candidat × thème, statuts, dates,                                executerRefresh avec la clé
  contenu _a-verifier.json                                                API fournie dans le corps
                                                                          de la requête
Au chargement : fetch health-check vers
http://localhost:<port>/api/sante — si ça répond,
active le bouton "relancer" + le champ clé API ;
sinon, affiche "disponible en local uniquement".
```

### Pourquoi `import.meta.glob` plutôt que des imports statiques par candidat

`Resultats.tsx` importe chaque candidat nommément (liste figée de 3 candidats "validés"), ce qui
est le bon choix pour l'écran citoyen (curation délibérée). La page de monitoring a le besoin
inverse : refléter fidèlement ce qui existe réellement dans `data/programmes/`, y compris les 5
candidats du lot pilote qui n'ont encore qu'un `meta.json` (pas de `propositions.json`). Un
import statique échouerait à la compilation pour un fichier absent ; `import.meta.glob` découvre
au build (ou à chaud en dev) tous les fichiers présents, sans liste codée en dur à maintenir à
chaque nouveau candidat.

Effet secondaire utile, pas un hasard : `data/programmes/*/_a-verifier.json` est gitignoré (voir
Task 1 du plan d'ingestion). Un build de production construit depuis un checkout Git propre ne
contient donc simplement pas ces fichiers — la section « en attente de relecture » de la page
sera naturellement vide pour un visiteur public, sans code de sécurité dédié. En local, les
fichiers existent sur le disque (le gitignore n'empêche que le commit, pas la lecture locale) et
s'affichent normalement. Aucun serveur n'est nécessaire pour cette partie lecture seule.

### Contenu affiché

Pour chaque candidat présent dans `data/programmes/` (déterminé par le glob, pas une liste figée) :

- **Nom, slug, date de dernière mise à jour du `meta.json`** (`date_derniere_maj`).
- **Grille par thème** (les 11 thèmes de `data/themes.json`) : nombre de propositions, répartition
  par `statut` (complet/partiel/provisoire), date de vérification la plus récente du thème
  (max de `date_derniere_verification` parmi les propositions de ce thème). Un thème sans
  proposition pour ce candidat affiche explicitement "aucune donnée", jamais une case vide
  ambiguë.
- **Contenu de `_a-verifier.json`** (si présent) : liste des propositions en attente, avec leur
  thème et la raison du rejet (`raison`) — affiché sous un bandeau explicite "non relu, non
  vérifié" pour ne jamais être confondu avec les données validées de la grille.

### Bouton de relance et champ clé API

- **Détection de disponibilité :** au montage du composant, un `fetch` vers
  `http://localhost:<port>/api/sante` avec un timeout court. Échec ou timeout → mode lecture
  seule, message "disponible en local uniquement" à la place du bouton. Succès → active le champ
  clé API et les contrôles de relance.
- **Champ clé API :** un simple `<input type="password">` en mémoire (état React), jamais
  persisté (ni `localStorage`, ni cookie), jamais envoyé ailleurs qu'au `POST /api/relancer` local.
- **Sélection de la relance :** par candidat, avec une liste de thèmes à cocher (ou "tous"), et un
  choix de mode :
  - **Insert** → équivalent de `npm run ingestion -- --candidats=<slug> --themes=<thèmes>`
    (respecte l'idempotence existante : combinaisons déjà couvertes sautées).
  - **Update** → équivalent de `npm run ingestion -- --refresh=<slug>:<thème>` par thème coché
    (jamais d'écrasement silencieux, comportement déjà garanti par `executerRefresh`).
- **Retour visuel :** après soumission, affichage du résultat renvoyé par le serveur local
  (combinaisons traitées, fusionnées, en attente, erreurs) — pas de streaming en temps réel dans
  cette première version (YAGNI : le volume d'une relance manuelle depuis cette page reste
  limité, un résultat de synthèse après coup suffit).

### `src/ingestion/serveur-local.ts` — serveur local minimal

- `node:http` natif, pas de nouvelle dépendance (Express, etc. seraient disproportionnés pour 2
  routes).
- `GET /api/sante` → `200 OK`, corps `{ "statut": "ok" }`.
- `POST /api/relancer` — corps JSON `{ slug: string, themes: string[], mode: "insert" |
  "update", cleApi: string }`. Construit un client Anthropic avec la clé fournie (jamais celle de
  `.env`, jamais loguée), appelle `executerLot` (mode insert) ou `executerRefresh` par thème
  (mode update) directement en import (pas de spawn de sous-processus — plus simple, même
  process), renvoie un résumé JSON (combinaisons traitées, fusionnées, en attente, erreurs). Doit
  répondre même en cas d'échec partiel (jamais un crash du serveur sur une erreur d'une
  combinaison — réutilise le même principe de résilience try/catch que `executerLot`).
- **Clé API :** `creerClient()` (`src/ingestion/generate.ts`) ne prend aujourd'hui aucun
  paramètre et lit `process.env.ANTHROPIC_API_KEY`. Étendue avec un paramètre optionnel :
  `creerClient(cleApi?: string): Anthropic { return cleApi ? new Anthropic({ apiKey: cleApi }) :
  new Anthropic(); }` — rétrocompatible (le CLI existant continue d'utiliser `.env` sans
  changement), le serveur local passe la clé reçue du frontend.
- **CORS :** en-têtes `Access-Control-Allow-Origin` permissifs (le serveur n'est accessible que
  depuis `localhost` de toute façon, aucune donnée sensible n'y transite au repos) pour permettre
  l'appel depuis `http://localhost:5173` (dev) ou l'origine du site déployé si le navigateur de
  l'utilisateur l'autorise (voir limite ci-dessous).
- **Limite connue, acceptée :** un navigateur peut bloquer, selon sa politique de sécurité
  "réseau privé", l'appel depuis une page HTTPS publique vers `localhost` en HTTP. Le
  comportement de repli (health-check échoue → mode lecture seule) absorbe ce cas sans rien
  casser ; pas de contournement spécifique prévu dans cette première version.

### Script npm

Ajouter à `package.json` : `"monitoring-server": "tsx src/ingestion/serveur-local.ts"`.

## Fichiers

- `src/ui/Monitoring.tsx` — la page (nouvelle).
- Modification de `src/App.tsx` (ou `src/main.tsx`) pour router `/monitoring` vers ce composant,
  sans nouvelle dépendance de routing.
- `src/ingestion/serveur-local.ts` — le serveur local (nouveau).
- `package.json` — nouveau script `monitoring-server`.

## Hors périmètre de ce design

- Authentification réelle ou système multi-utilisateur pour la clé API — explicitement écarté,
  la clé est un confort local pour l'utilisateur seul.
- Streaming en temps réel de la progression d'une relance — résumé après coup suffit pour cette
  version.
- Contournement des restrictions navigateur "réseau privé" — le repli en lecture seule est
  considéré comme un comportement correct, pas un défaut à corriger.
