# Progression — base de connaissances `officielle`

**Statut : EN PAUSE depuis le 2026-10-01** (passage à une troisième base de connaissances). Reprise possible
telle quelle : les commandes sont rejouables, rien n'est perdu (extractions en cache dans `cache/sources/`,
journal par candidat dans `data/bases/officielle/programmes/<slug>/_journal-recherche.json`).

Aucune donnée n'a été relue ni validée par le porteur du projet.

## Où on en est (mesuré le 2026-10-01)

| Candidat | Mesures | dont avec effets | Thèmes | Synthèses | Origine des données |
|---|---|---|---|---|---|
| Le Pen | 56 | 29 | 12 / 12 | 12 / 12 | pipeline corpus, sur abonnement (2026-09-29/30) |
| Retailleau | 60 | 37 | 11 / 12 | 11 | pipeline corpus (API, avant la pause) |
| Attal | 5 | 5 | 1 (fiscalité) | 1 | pipeline corpus (API) |
| Mélenchon | 25 | 25 | 11 | 0 | ancienne collecte, à repasser par le corpus |
| Philippe | 24 | 24 | 11 | 0 | ancienne collecte, à repasser par le corpus |
| 12 autres candidats des niveaux 1-2 | — | — | — | — | aucun document déclaré |

Le Pen est le seul candidat passé par la chaîne complète actuelle (double relecture, effets séparés, synthèses
relues). Retailleau et Attal datent d'avant : leurs mesures n'ont pas été relues avec les règles actuelles.

## Ce qui a été construit (séance du 2026-09-29 au 2026-10-01)

- **Moteur « abonnement »** : `npm run ingestion -- --candidats=<slug> --moteur=cli --max-appels=N`
  (`src/ingestion/client-cli.ts`, s'appuie sur `src/scraping/claude-cli.ts`). Plafond en nombre d'appels au lieu
  d'euros ; retire `ANTHROPIC_API_KEY` de l'environnement (sinon la commande consomme le crédit API) ;
  enveloppe les schémas tableau dans un objet ; retire les balises parasites en fin de chaîne.
  Fonctionne aussi pour `--synthese-seule`.
- **Relecture des mesures** (`verification-extraction.ts`, `prompts/verification-extraction.md`) :
  - deux lectures indépendantes, une mesure n'est acceptée que si toutes disent PASS (`NOMBRE_LECTURES`) ;
  - le relecteur reçoit les libellés exacts de tous les critères du profil (dont `enfants_a_charge`) et la liste
    des documents du corpus ;
  - **deux verdicts** : sur la mesure et sur ses effets. Si seuls les effets sont refusés, la mesure est gardée
    **sans effet** (donc sans badge) ; la fiche complète et la raison restent dans `_a-verifier.json`
    (« Effets écartés … ») ;
  - règle « critère voisin = FAIL » : un critère plus large que le public réel est refusé, le public passe en `autre`.
- **Synthèses** : consigne durcie (public nommé seulement si la mesure le nomme, reste au plus près des mots du
  résumé) ; rejet des balises parasites ; **retry** après refus du relecteur, avec son motif (`MANCHES_SYNTHESE`).
- **Nouvelle question du formulaire** `usage_autoroute` (« Utilisez-vous l'autoroute ? », conditionnelle au
  véhicule) : la mesure « péages −15 % » cible `vehicule` ET `usage_autoroute = oui` ; sans réponse elle donne
  « mixte à préciser », avec réponse un indicateur déterminé (testé dans `projection.test.ts`). 23 questions.
- **Règles d'éligibilité de Le Pen retirées** de `src/engine/regles.ts` : elles étaient attachées à des
  identifiants qui ne désignent plus les mêmes mesures.
- Tests : `le-pen` sort des tests de l'ancienne collecte (`src/data/candidats.test.ts`) et a les siens ; ~850 tests.

## Décisions du porteur du projet

- Une mesure qui touche deux thèmes **reste dans les deux** (pas de dédoublonnage). La consigne d'extraction est
  alignée, mais **pas rejouée sur Le Pen** : ses doublons actuels viennent de l'ancienne consigne (certaines mesures
  n'apparaissent que dans un seul thème selon l'ordre de traitement).
- Péages : l'effet passe par véhicule + usage de l'autoroute (voir ci-dessus).

## Pour reprendre

```bash
# Plan sans appel (lit et met en cache les documents)
npm run ingestion -- --candidats=<slug> --dry-run --moteur=cli
# Extraction + relecture + synthèse, sur l'abonnement, par passes
npm run ingestion -- --candidats=<slug> --moteur=cli --max-appels=20
# Refaire relecture et synthèse sans ré-extraire
npm run ingestion -- --candidats=<slug> --retraiter --moteur=cli --max-appels=30
# Seulement les synthèses (--force pour refaire celles qui existent)
npm run ingestion -- --candidats=<slug> --themes=<t1,t2> --synthese-seule --force --moteur=cli
```

Un run interrompu (quota, plafond d'appels) reprend en relançant la même commande. Ordre de grandeur pour un
candidat à 12 thèmes : 20 à 25 appels d'extraction, 45 à 50 avec la double relecture et les synthèses.

## Reste à faire

1. **Candidats suivants** (niveaux 1-2 de `docs/etude-sources-officielles-2026-09-25.md`). Blocage : aucun n'a de
   champ `documents` dans `meta.json` (adresse exacte, nom, **année réelle** de chaque document). L'étude nomme les
   documents sans adresse : il faut les retrouver, vérifier par `--dry-run` qu'ils se lisent et dater chacun dans son
   texte. Ne jamais déclarer une année par supposition.
   Ordre proposé : Lisnard, Glucksmann (PDF « Acte un »), Mélenchon (à refaire), Philippot, Dupont-Aignan ; puis
   Philippe (à refaire), Asselineau, Arthaud, Roussel, Tondelier, Kazib, Mikolajczak, Batho, Guedj.
2. **Questions à trancher** (étude, « À arbitrer ») : Glucksmann avant ou après la primaire du PS (9-10 octobre) ;
   pages rendues par JavaScript (livre de Mélenchon, cahiers de Ruffin) ; PDF en image (OCR) ; affichage des
   candidats sans programme.
3. **Le Pen, finitions** :
   - 6 mesures refusées en entier (motifs fondés, voir `_a-verifier.json`) ;
   - 14 mesures gardées sans effet, dont plusieurs pour un public que le formulaire ne sait pas exprimer
     (résidents d'EHPAD, jeunes familles…) : candidates à de nouvelles questions, comme les péages ;
   - relecture non parfaitement stable d'un passage à l'autre (mitigée par la double lecture, pas supprimée) ;
   - longueur des synthèses : la consigne dit « jamais plus de 1 000 caractères », le contrôle du code tolère
     1 200 (`TEXTE_MAX` dans `synthese.ts`) — à aligner ;
   - refaire l'extraction pour que les mesures à deux thèmes figurent dans les deux.
4. **Relecture humaine** de tout le contenu (exactitude, neutralité, cohérence entre candidats).

## État du dépôt au moment de la pause

- **Rien n'est commité** pour ce travail (une trentaine de fichiers modifiés ou nouveaux, dont
  `src/ingestion/client-cli.ts`, `data/bases/officielle/programmes/le-pen/*`, `data/profils-schema.json`).
- Dossier temporaire `.avant-retraitement/` à la racine (copies de contrôle de `le-pen`) : à supprimer.
- `src/engine/candidatIdeal.test.ts` (travail « candidat idéal », hors de cette base) échouait au chargement
  faute de module `./candidatIdeal` lors de la dernière exécution complète des tests.

## Pièges connus

- Un run avec `ANTHROPIC_API_KEY` dans l'environnement consomme le crédit API même avec `claude -p` : le moteur
  `cli` la retire, ne pas lancer `claude -p` à la main avec la clé chargée.
- Les heredocs du shell Bash de l'outil sont instables sur cette machine : préférer PowerShell et l'édition de fichiers.
- Un message « Panne du compte API » à l'arrêt signifie aussi « plafond d'appels atteint » : relancer la même commande.
