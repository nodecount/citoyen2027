# Pipeline d'ingestion via l'API Claude — Design

Date : 2026-09-18
Statut : proposé, en attente de relecture utilisateur

## Contexte et objectif

Le projet couvre à ce jour 3 candidats (Le Pen, Mélenchon, Philippe) sur les 11 thèmes, collectés
« à la main » via des sous-agents Claude Code dispatchés un par un (voir
`docs/superpowers/plans/2026-09-16-collecte-9-themes.md`). L'utilisateur souhaite ajouter les
autres candidats déclarés de la présidentielle 2027, mais l'échelle (21 nouveaux candidats
qualifiants × 11 thèmes) rend le processus manuel disproportionné, et le quota WebSearch de la
session CLI (200 recherches) a déjà été épuisé pendant cette même session.

L'utilisateur a proposé d'utiliser directement l'API Claude, de façon scriptée et templatée par
candidat × thème, rejouable à volonté quand un nouveau candidat se déclare ou qu'un programme
change — ce qui correspond exactement au composant `/src/ingestion` déjà esquissé dans
`CLAUDE.md` (« scripts d'extraction/mise à jour des programmes ») mais jamais construit.

**Tension identifiée et résolue avec l'utilisateur :** interroger l'API Claude en texte libre
pour « donner les infos sur le candidat X et le thème Y » s'appuierait sur la mémoire
d'entraînement du modèle, pas sur une source vérifiable en direct — en contradiction frontale
avec la règle fondatrice du projet (≥2 sources, ≥1 primaire, vérification indépendante). La
session a déjà démontré, à la main, que même avec accès web et relecture humaine, des erreurs
factuelles se produisent (citation mal attribuée, URL morte, chiffre erroné) — un générateur
sans aucune vérification indépendante les reproduirait à plus grande échelle, sans filet.

La solution retenue combine deux idées de l'utilisateur : (1) restreindre les outils web de
l'API au domaine officiel du candidat plutôt que de compter sur une simple instruction de prompt,
et (2) garder une vérification adversariale indépendante, comme le duo implémenteur/relecteur
déjà utilisé toute la session, mais scriptée.

## Constat factuel (recherche menée le 2026-09-17/18)

Source : table complète des 39 candidats sur `candidatspresidentielles2027.fr` (colonnes Statut
et Programme), re-vérifiée en direct pour ce design après une confusion initiale.

**Correction actée :** Jordan Bardella n'apparaît dans aucune des 39 lignes du tableau — ce
n'est **pas** un candidat déclaré, malgré sa première place dans les sondages
(france-vote.fr, 34,0 %). Il est donc exclu de toute considération, sondages compris.

**Filtre retenu** (décidé avec l'utilisateur en deux temps) : Statut = « Déclarée » ET
Programme = « Complet » (exclut Pressentie/Retirée/Hors course, Sommaire, Mono-thématique,
Aucun). Résultat : 24 candidats qualifiants, dont Le Pen, Mélenchon et Philippe déjà couverts →
**21 nouveaux candidats** :

Lisnard, Attal, Guedj, Retailleau, Bertrand, Dupont-Aignan, Philippot, Asselineau, Arthaud,
Batho, Roussel, Tondelier, Bouamrane, Mikolajczak, Glucksmann, Faure, Ruffin, Cazeneuve, Kazib,
Branco, Brun.

**Classement par sondages** (france-vote.fr, moyenne glissante au 10/09/2026, Bardella et les
non-qualifiants Zemmour/de Villepin/Hollande retirés) parmi ces 21 :

1. Gabriel Attal — 11,5 %
2. Raphaël Glucksmann — 11,1 %
3. Bruno Retailleau — 8,4 %
4. François Ruffin — 4,6 %
5. Olivier Faure — 3,6 %
6. Marine Tondelier — 3,5 %
7. David Lisnard — 3,1 %
8. Fabien Roussel — 2,7 %
9. Nicolas Dupont-Aignan — 2,1 %
10. Nathalie Arthaud — 0,9 %
(Guedj, Bertrand, Philippot, Asselineau, Batho, Bouamrane, Mikolajczak, Cazeneuve, Kazib, Branco,
Brun : non chiffrés dans cette moyenne, à traiter après le lot pilote.)

**Décision actée avec l'utilisateur :** montée en charge par lot, en commençant par les 5
candidats les plus visibles dans les sondages parmi les qualifiants : **Attal, Glucksmann,
Retailleau, Ruffin, Faure**. Les 16 restants suivent après validation manuelle du lot pilote.

## Architecture

### Vue d'ensemble

Pour chaque combinaison candidat × thème, deux appels API indépendants, jamais fusionnés en un
seul :

```
generate.ts (Passe 1)              verify.ts (Passe 2)              run.ts (orchestrateur)
─────────────────────              ────────────────────             ──────────────────────
Opus 5 + web_search/web_fetch  →   Opus 5 (contexte neuf) +    →   merge dans
restreints à allowed_domains       web_fetch, re-fetch chaque         data/programmes/<slug>/
= domaines officiels du            source citée, vérifie que          propositions.json
candidat.                          resume_factuel/hypotheses_calcul   (uniquement les PASS),
Sortie : Proposition[] via         sont réellement supportés par      écrit les FAIL dans
structured outputs                 la page. Verdict PASS/FAIL         data/programmes/<slug>/
(output_config.format).            par proposition, avec raison       _a-verifier.json,
                                    si FAIL.                          lance la suite Vitest.
```

La passe 2 ne voit **que** les propositions produites par la passe 1 (titre, resume_factuel,
hypotheses_calcul, sources) — jamais son raisonnement — pour rester un regard indépendant, pas
une auto-relecture.

### Passe 1 — génération, restreinte au domaine officiel

- Outils : `web_search` et `web_fetch` (variantes `_20260209`, filtrage dynamique), avec
  `allowed_domains` fixé aux noms d'hôte extraits des URLs de `sources_officielles` du candidat
  dans son `meta.json` (champ déjà existant, pas de nouveau champ nécessaire — voir Fichiers).
  Cette restriction est appliquée côté serveur : le modèle ne peut physiquement pas aller
  chercher ailleurs, ce qui rend la source primaire garantie plutôt que simplement demandée.
- Sortie contrainte via `output_config.format` au schéma exact du type `Proposition`
  (`src/types.ts`) : `titre`, `resume_factuel`, `sources[]`, `chiffrage_disponible`,
  `hypotheses_calcul`, `statut`, `date_derniere_verification`. `id` et `candidat` sont assignés
  par le script, pas par le modèle (déterministe : `<slug>-<theme-abrégé>-NNN`).
- Prompt système : encode intégralement `docs/methodologie.md` (définitions primaire/secondaire,
  convention resume_factuel/hypotheses_calcul, sémantique de `statut`, neutralité des titres,
  interdiction de la narration de type changelog) + la liste des titres de propositions déjà
  écrites pour ce candidat (toutes thèmes confondus), avec instruction explicite : si une mesure
  identifiée recoupe une mesure déjà écrite sous un autre thème, ne pas la dupliquer
  indépendamment — ajouter un renvoi réciproque en langage clair (jamais un id interne brut) dans
  les deux fiches, exactement la règle déjà appliquée à la main tout au long de cette session.
- Règle des deux sources sous restriction de domaine unique : deux pages primaires distinctes
  du même site officiel (ex. programme PDF + page mesure dédiée) suffisent à satisfaire « ≥2
  sources, ≥1 primaire ». Si une source secondaire apporterait une vraie valeur (contestation
  d'un chiffrage, analyse experte), la passe 1 reste primaire-only ; cet enrichissement reste un
  suivi manuel, comme pour les 71 propositions existantes.
- Effort : `high` (travail de recherche et de jugement, pas mécanique).

### Passe 2 — vérification adversariale

- Contexte neuf (pas de continuité de conversation avec la passe 1) : reçoit uniquement la liste
  de propositions produites, sans le raisonnement qui les a produites.
- Mêmes outils, même restriction `allowed_domains`.
- Pour chaque proposition : re-fetch de chaque URL citée, vérifie (a) que l'URL est accessible,
  (b) que chaque affirmation de `resume_factuel` et `hypotheses_calcul` est effectivement
  présente sur la page (pas de citation ou de chiffre non supporté), (c) que `statut` est
  cohérent avec ce qui a été trouvé.
- Verdict par proposition : `PASS` ou `FAIL` + raison textuelle. Aucune correction automatique —
  une proposition qui échoue part en attente de relecture manuelle, jamais fusionnée ni
  silencieusement écartée.

### Vérifications déterministes (avant la passe 2)

La passe 2 reste un jugement de LLM — elle réduit le risque d'erreur (deux appels indépendants,
cadrages différents) mais ne l'élimine pas : un LLM peut valider à tort une synthèse subtilement
fausse, ou l'inverse. `verify.ts` exécute d'abord, en code pur (sans appel modèle), trois
contrôles déterministes sur chaque proposition avant même de solliciter le jugement sémantique
de la passe 2 :

1. **Disponibilité de l'URL** : chaque `source.url` répond en HTTP 200 (requête simple depuis le
   script). Une URL morte échoue immédiatement, sans appel API.
2. **Correspondance de domaine** : le nom d'hôte de chaque `source.url` figure bien dans
   `allowed_domains` pour ce candidat — défense en profondeur si jamais la restriction d'outil
   de la passe 1 était contournée ou mal appliquée.
3. **Présence littérale des chiffres cités** : tout nombre apparaissant dans `hypotheses_calcul`
   (montant, pourcentage, date) doit se retrouver, tel quel ou en variante proche (espaces,
   séparateurs), dans le texte brut de la page fetchée.

Un échec à l'un de ces trois contrôles vaut `FAIL` immédiat, sans même consommer un appel modèle
pour la passe 2 sémantique. Seules les propositions qui passent les trois contrôles déterministes
sont soumises au jugement sémantique du modèle (affirmations de `resume_factuel`/
`hypotheses_calcul` réellement supportées par la page, cohérence de `statut`). Ces contrôles ne
remplacent pas la passe 2, ils éliminent gratuitement les erreurs les plus grossières et laissent
le jugement du modèle se concentrer sur les cas subtils.

### Fusion et idempotence

- `run.ts` orchestre, pour une liste de candidats × thèmes : passe 1 → passe 2 → fusion des PASS
  dans `propositions.json`, écriture des FAIL dans un fichier d'attente séparé
  `data/programmes/<slug>/_a-verifier.json` (jamais commité tel quel dans les données actives).
- Idempotent : une combinaison candidat × thème déjà présente dans `propositions.json` est
  sautée par défaut (rejouable sans dupliquer), sauf option `--force`.
- Après chaque fusion, `run.ts` lance la suite Vitest existante (`schema.test.ts`,
  `candidats.test.ts`) avant de considérer la combinaison terminée — mêmes garde-fous
  structurels que le processus manuel.

### Mode `--refresh` : maintenir la base à jour, pas seulement la remplir

L'idempotence telle que décrite ci-dessus ne gère que l'**ajout** (nouveau candidat, thème
manquant) : une combinaison déjà présente dans `propositions.json` est sautée, jamais
revérifiée. Ce n'est donc pas suffisant pour une base de connaissance qu'on relance
« régulièrement » au fil de la campagne — un candidat déjà couvert qui met à jour son programme
ne serait jamais détecté.

`run.ts --refresh <slug> [<theme>]` relance passe 1 (+ contrôles déterministes + passe 2) sur une
combinaison **déjà couverte**, sans la sauter. Le résultat frais n'écrase jamais silencieusement
l'existant : il est comparé (titre, resume_factuel, hypotheses_calcul, sources) à ce qui est
stocké, et s'il diffère, la version proposée est écrite dans `_a-verifier.json` avec la mention
`refresh : divergence avec l'existant`, pour arbitrage humain — jamais de remplacement
automatique de données déjà validées.

**Échantillonnage périodique** : au-delà de la relecture manuelle ponctuelle du lot pilote,
chaque relance de `run.ts` sur un lot tire aléatoirement ~10 % des combinaisons déjà `PASS`
(toutes campagnes confondues) et les repasse en `--refresh`, pour détecter une dérive de qualité
dans la durée plutôt que de considérer la confiance acquise une fois pour toutes après le seul
lot pilote.

## Fichiers

- `src/ingestion/generate.ts` — pilote la passe 1 pour une combinaison candidat × thème.
- `src/ingestion/verify.ts` — pilote la passe 2 (contrôles déterministes puis jugement sémantique).
- `src/ingestion/checks.ts` — les trois contrôles déterministes (disponibilité d'URL,
  correspondance de domaine, présence littérale des chiffres cités), en code pur, sans appel
  modèle — réutilisé par `verify.ts` en mode normal et en mode `--refresh`.
- `src/ingestion/run.ts` — orchestrateur (liste de candidats/thèmes, boucle, fusion, idempotence,
  mode `--refresh`, tirage de l'échantillon périodique, journal de progression).
- `src/ingestion/schema.ts` — schéma JSON structured-output, dérivé du type `Proposition` de
  `src/types.ts` (source de vérité unique, pas de duplication de définition).
- `src/ingestion/prompts/generation.md`, `src/ingestion/prompts/verification.md` — textes des
  prompts système, versionnés et relisibles (le libellé y est aussi sensible d'un point de vue
  méthodologique que le code).
- `.env` (gitignoré) — `ANTHROPIC_API_KEY`, lu via le SDK par défaut (voir skill claude-api).
- Pas de nouveau champ dans `CandidatMeta` : les domaines autorisés sont dérivés à l'exécution
  des noms d'hôte des URLs déjà présentes dans `sources_officielles`. Pour chaque nouveau
  candidat, je renseignerai manuellement `meta.json` (au moins une URL officielle vérifiée) avant
  de lancer le pipeline dessus — jamais laissé à l'API de deviner le site officiel.

## Gestion des erreurs

- Erreur d'outil serveur (`web_search_tool_result`/`web_fetch_tool_result` avec `content` objet
  d'erreur, ex. `max_uses_exceeded`) : la combinaison candidat × thème correspondante est marquée
  `ERROR` dans le journal de `run.ts` et sautée, sans interrompre le reste du lot.
  `run.ts` peut être relancé sur les seules combinaisons en erreur.
- Refus du modèle (`stop_reason: "refusal"`) : même traitement, journalisé avec la catégorie de
  refus si disponible.
- Échec de la passe 2 (FAIL) : jamais une erreur de script — c'est le fonctionnement normal du
  garde-fou. Écrit dans `_a-verifier.json`, jamais fusionné.
- Échec Vitest après fusion : `run.ts` s'arrête sur cette combinaison (ne fusionne pas les
  suivantes du même lot sans investigation), remonte l'échec clairement.

## Tests

- Test unitaire du schéma structured-output (`schema.ts`) : un objet conforme au type
  `Proposition` passe la validation, un objet avec un champ manquant ou un `statut` invalide est
  rejeté.
- Test unitaire de la logique de fusion/idempotence de `run.ts` : une combinaison déjà présente
  dans `propositions.json` n'est pas dupliquée lors d'un second passage ; une proposition `FAIL`
  n'apparaît jamais dans `propositions.json`.
- Test unitaire de chacun des trois contrôles déterministes (`checks.ts`) : URL vivante vs. morte
  (mock HTTP), domaine autorisé vs. hors liste, chiffre présent tel quel vs. absent du texte
  fetché — chacun doit produire un `FAIL` immédiat sans appeler le modèle.
- Test unitaire du mode `--refresh` : une divergence entre le résultat frais et l'existant produit
  une entrée dans `_a-verifier.json` sans jamais modifier `propositions.json` ; une absence de
  divergence ne produit aucune écriture.
- Pas de test automatisé sur les appels API eux-mêmes (coût, non-déterminisme) — la validation
  de qualité du lot pilote est manuelle, comme convenu avec l'utilisateur.

## Coût et déploiement du lot pilote

- Lot pilote : 5 candidats (Attal, Glucksmann, Retailleau, Ruffin, Faure) × 11 thèmes = 55
  combinaisons, jusqu'à 110 appels API (passe 1 + passe 2).
- Clé API facturée séparément de l'abonnement Claude Code, fournie par l'utilisateur.
- Estimation de coût : ordre de grandeur, pas un engagement — à vérifier après les premières
  combinaisons plutôt que de laisser tourner tout le lot sans contrôle intermédiaire.
- Après le lot pilote : pause pour relecture manuelle d'un échantillon de sorties (même niveau
  d'exigence que le travail manuel existant) avant d'étendre aux 16 candidats restants, en
  respectant le principe « même rigueur pour tous les candidats » du projet — l'automatisation
  ne doit pas abaisser la barre.
- Au-delà de cette validation ponctuelle du lot pilote, l'échantillonnage périodique décrit dans
  « Mode `--refresh` » (~10 % des fiches `PASS` revérifiées à chaque relance) consomme des appels
  API supplémentaires à chaque exécution — à inclure dans le suivi de coût, pas seulement le
  premier lot.

## Hors périmètre de ce design

- L'enrichissement en sources secondaires (contestation de chiffrage, analyse experte) reste
  manuel, comme pour les données existantes.
- La détection automatique de nouveaux candidats déclarés (scraper
  `candidatspresidentielles2027.fr` en continu) n'est pas construite ici — le déclenchement du
  pipeline reste manuel, sur decision de l'utilisateur.
- La correction automatique des propositions `FAIL` n'est pas construite — elles restent en
  attente de relecture humaine ou d'un futur passage manuel.
