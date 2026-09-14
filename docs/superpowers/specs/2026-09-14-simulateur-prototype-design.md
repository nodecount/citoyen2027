# Simulateur d'impact personnel — Prototype initial (design)

Date : 2026-09-14
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte et objectif

Le projet global est décrit dans `CLAUDE.md` : un simulateur web indépendant qui projette, pour un profil citoyen donné, l'impact concret de chaque candidat à la présidentielle 2027, classé par thème.

Le projet est trop large pour un seul cycle spec → plan → implémentation. Ce document couvre le **premier sous-projet** : valider le schéma de données, la stack technique et produire un prototype fonctionnel couvrant un sous-ensemble réel de candidats et de thèmes. Les sous-projets suivants (moteur de calcul étendu à tous les thèmes, ingestion automatisée, UI finale) suivront leur propre cycle une fois ce prototype validé.

## Décisions actées avec l'utilisateur

- **Stack** : React (Vite) + TypeScript, application 100% statique — aucun backend, tout le calcul s'exécute côté client à partir de fichiers JSON de données.
- **Candidats du prototype** : Marine Le Pen, Jean-Luc Mélenchon, Édouard Philippe (les trois figures les plus visibles dans les sondages de premier tour à la date du cadrage, septembre 2026).
- **Thèmes cibles à terme** (8, structurés dès le départ dans le schéma) : fiscalité, travail, liberté, aides de l'État, pouvoir d'achat, liberté d'expression, liberté politique, succession.
- **Thèmes peuplés complètement pour ce prototype** : fiscalité + pouvoir d'achat. Les 6 autres thèmes existent dans le schéma mais restent vides ou au statut `"provisoire"`.
- **Sourcing des données** : recherche web effectuée par Claude, propositions structurées avec sources soumises à l'utilisateur pour validation avant d'être considérées définitives.

## Architecture

Application unique, pas de service séparé :

```
/data
  /programmes/<candidat_slug>/
    meta.json          # nom, parti, sources officielles, date de dernière maj
    propositions.json  # propositions structurées par thème
  themes.json           # les 8 thèmes, avec statut global par thème
  profils-schema.json   # schéma des champs de profil utilisateur

/src
  /engine   # fonctions pures : profil + propositions[] -> impacts estimés
  /ui       # formulaire profil + affichage des résultats

/docs
  methodologie.md   # règles de sourçage, règles de neutralité
  superpowers/specs # specs de conception (ce document)
```

Pas de backend : hébergement statique possible (ex. Vercel, Netlify, GitHub Pages) une fois le prototype validé — le choix d'hébergement n'est pas bloquant pour ce sous-projet et sera tranché plus tard.

## Modèle de données

### Proposition (dans `propositions.json`)

Reprend la structure esquissée dans `CLAUDE.md`, avec l'ajout du champ `statut` :

```json
{
  "id": "fisc-001",
  "candidat": "le-pen",
  "theme": "fiscalite",
  "titre": "...",
  "resume_factuel": "...",
  "sources": [
    {"type": "primaire", "label": "Programme officiel", "url": "..."},
    {"type": "secondaire", "label": "Analyse presse", "url": "..."}
  ],
  "chiffrage_disponible": true,
  "hypotheses_calcul": "...",
  "statut": "complet",
  "date_derniere_verification": "2026-09-14"
}
```

`statut` prend une des trois valeurs : `"complet"`, `"partiel"`, `"provisoire"`. C'est le seul mécanisme qui pilote l'affichage des cas incomplets (voir plus bas) — jamais de valeur de remplissage inventée pour combler un trou.

### Thème (dans `themes.json`)

Les 8 thèmes sont déclarés dès ce prototype, avec un identifiant, un libellé, et une description courte. Aucune notion de poids ou d'ordre de priorité entre thèmes (neutralité).

### Profil utilisateur (`profils-schema.json`)

Champs minimaux repris de `CLAUDE.md` : statut professionnel, tranche de revenus, situation familiale, nombre d'enfants, logement, secteur d'activité, région. Le schéma exact des champs et de leurs valeurs possibles est affiné pendant l'implémentation, au moment d'écrire les premières règles du moteur (un champ n'est ajouté que si une règle en a réellement besoin — YAGNI).

## Moteur de calcul

Fonctions TypeScript pures, une règle explicite par proposition chiffrable :

```ts
function evaluerPropositionFiscXxx(profil: Profil, proposition: Proposition): Impact {
  // règle explicite, lisible, commentée sur le "pourquoi" si non évident
}
```

Chaque `Impact` retourné contient la valeur estimée (quand calculable) et une explication textuelle de la règle appliquée, pour que l'utilisateur comprenne toujours la logique. Pas de modèle générique boîte noire : une proposition non chiffrable (`chiffrage_disponible: false`) ne produit pas de chiffre, seulement une description qualitative.

## UI

Deux écrans :
1. **Formulaire de profil** — champs du `profils-schema.json`.
2. **Résultats** — candidats affichés en ordre alphabétique fixe (jamais par score), thèmes en sections. Pour un couple candidat/thème sans proposition `"complet"`, affichage explicite d'un message du type « programme en cours d'analyse sur ce thème » plutôt que masquer la section — pour ne jamais suggérer implicitement qu'un candidat n'a pas de position sur un sujet.

## Gestion des cas incomplets

Entièrement pilotée par le champ `statut` de chaque proposition et par `chiffrage_disponible`. Aucune estimation ne doit être affichée sans hypothèse de calcul documentée dans `hypotheses_calcul`.

## Tests

- Tests unitaires sur les fonctions du moteur : profil connu + proposition connue → impact attendu (couvrant au moins un cas par thème peuplé et par candidat).
- Revue manuelle de l'UI avec les données réelles des 3 candidats sur les 2 thèmes peuplés, plusieurs profils types.

## Hors scope de ce sous-projet

- Les 6 thèmes non peuplés (structure présente, données réelles à venir dans un sous-projet ultérieur).
- Ingestion automatisée de données (scripts `/src/ingestion` mentionnés dans `CLAUDE.md`) — la collecte pour ce prototype est manuelle/assistée, pas scriptée.
- Choix d'hébergement définitif.
- Ajout d'autres candidats au-delà des 3 retenus.

## Prochaine étape

Passage au skill `writing-plans` pour découper ce design en plan d'implémentation, incluant la tâche de recherche des sources réelles (programmes de Le Pen, Mélenchon, Philippe sur fiscalité et pouvoir d'achat), à soumettre à l'utilisateur pour validation avant intégration définitive.
