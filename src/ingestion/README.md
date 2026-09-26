# Pipeline d'ingestion

## Mode « corpus » (par défaut) — lire une fois, interroger douze fois

Notre code télécharge les documents officiels déclarés dans `meta.json` (champ `documents` : `id`, `url`,
`nom`, `annee`), en extrait le texte (HTML et PDF, avec repères de page) et le met en cache disque
(`cache/sources/`, ignoré par git). Le modèle reçoit ce texte en un bloc mis en cache de prompt, **sans outil
web**, et est interrogé une fois par thème. Chaque mesure et chaque effet citent un extrait recopié mot pour
mot ; le code le retrouve dans le texte, en déduit la page, et fabrique les sources (nom et année viennent de
`meta.json`). Une relecture ne voit que les passages autour des extraits.

```bash
# Plan et coût estimé, SANS appel payant (lit et met en cache les documents)
npm run ingestion -- --candidats=retailleau --dry-run

# Exécution sous plafond dur (2 € par défaut) ; refuse de partir si le coût attendu dépasse le plafond
npm run ingestion -- --candidats=retailleau --budget=3

# Un seul thème, ou forcer un thème déjà fait ; --actualiser-sources retélécharge les documents
npm run ingestion -- --candidats=retailleau --themes=fiscalite --budget=1 --force
```

Tarifs et change sont des **hypothèses** (`src/ingestion/budget.ts`) à confirmer avec la grille de la console
Anthropic. L'ancien mode où le modèle cherche sur le web reste disponible avec `--mode=recherche-web`
(très coûteux, non recommandé).

## Mode « recherche-web » (ancien)

Génère et vérifie des propositions de programme via l'API Claude, restreinte au domaine
officiel de chaque candidat. Voir `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md`
pour le design complet.

## Prérequis

1. Copier `.env.example` en `.env` et renseigner `ANTHROPIC_API_KEY`.
2. Le `meta.json` du candidat doit exister avec au moins une URL dans `sources_officielles`
   (vérifiée manuellement au préalable — jamais laissé à l'API à deviner).

## Utilisation

```bash
# Couvrir un ou plusieurs candidats sur tous les thèmes (combinaisons déjà présentes sautées)
npm run ingestion -- --candidats=attal,glucksmann

# Limiter à certains thèmes
npm run ingestion -- --candidats=attal --themes=fiscalite,sante

# Revérifier une combinaison déjà couverte (jamais d'écrasement silencieux)
npm run ingestion -- --refresh=le-pen:fiscalite

# Forcer la re-génération même si déjà couvert
npm run ingestion -- --candidats=attal --force
```

Les propositions qui échouent la vérification (contrôles déterministes ou passe sémantique)
sont écrites dans `data/bases/officielle/programmes/<slug>/_a-verifier.json`, jamais fusionnées automatiquement.
Relire ce fichier manuellement avant toute correction ou nouvel essai.

## Ce que produit le pipeline

Pour chaque candidat × thème, en deux étapes :

1. **Propositions** (`propositions.json`) : génération puis vérification indépendante. Chaque
   proposition porte ses `sources` (avec `nom` et `annee`, affichés « nom · année ») et ses `effets`
   (qui est visé, quelle grandeur bouge, dans quel sens, avec l'extrait de source qui le fonde).
   Règle d'or : précision ou rien — `effets: []` plutôt qu'un effet deviné.
2. **Synthèse** (`synthese.json`) : le texte « en quoi ce programme touche ce thème », rédigé à
   partir de toutes les propositions vérifiées du thème (sans accès web), puis relu. Un texte refusé
   va dans `_synthese-a-verifier.json`. Une synthèse déjà à jour (mêmes mesures) n'est pas
   régénérée, sauf avec `--force`.

## Sources autorisées

Domaine officiel du candidat ou du parti (obligatoire), plus `assemblee-nationale.fr`, `senat.fr`
et `legifrance.gouv.fr` pour **préciser** une position ancienne encore défendue. Une proposition
fondée uniquement sur des sources institutionnelles est refusée : au moins une source officielle du
candidat ou du parti doit confirmer que la mesure est toujours défendue.

## Contrôles déterministes (avant tout appel de relecture)

Domaine autorisé, URL accessible, chiffres de `hypotheses_calcul` présents dans les sources,
extrait de chaque effet présent dans la page citée (les pages rendues côté client par JavaScript
peuvent donner de faux échecs : la proposition va alors en `_a-verifier.json`, pas à la poubelle).

Ne pas confondre avec les modèles utilisés : Sonnet 5 pour la génération, la synthèse et les
relectures.
