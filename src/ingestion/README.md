# Pipeline d'ingestion

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
sont écrites dans `data/programmes/<slug>/_a-verifier.json`, jamais fusionnées automatiquement.
Relire ce fichier manuellement avant toute correction ou nouvel essai.
