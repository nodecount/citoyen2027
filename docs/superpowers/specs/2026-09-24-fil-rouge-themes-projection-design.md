# Fil rouge : cards par thème, candidats rangés par thème, projection personnelle — Design

Date : 2026-09-24
Statut : acté dans `CLAUDE.md` (fil rouge et quatre niveaux) ; réalisation par étapes avec point
d'étape entre chacune (voir « Ordre de réalisation »)

## Cahier des charges (acté par le porteur du projet)

Par thème : (1) une card lisible par un citoyen ; (2) les candidats rangés dans les thèmes qui
concernent leur programme, chacun avec un texte de synthèse ; (3) un indicateur de projection pour
la situation du citoyen si la volonté du candidat sur ce thème s'appliquait.

Quatre niveaux, pas plus (clarté de lecture, nuance suffisante) : **améliorant**, **mixte**,
**non concerné**, **dégradant** — définitions et exemples dans `CLAUDE.md`. Un candidat dont l'effet
n'est pas déterminable d'après son programme publié apparaît avec sa synthèse et **sans badge**
(absence de projection, pas un cinquième niveau).

## Thèmes

12 thèmes (11 collectés pour Le Pen, Mélenchon, Philippe ; « Ma retraite » provisoire). Recoupent les
enquêtes consultées (Ipsos bva-CESI avril 2026, n = 10 962 ; Ifop ; ÉlyséeScope ; Jeunesse 2027).
Décision du porteur : les sujets **sans effet projetable sur un citoyen donné** — dette et finances
publiques, Europe / défense / place de la France — sont retirés, bien qu'ils figurent dans les
enquêtes (dette : 6ᵉ, 51 % « déterminant » ; place de la France : 9ᵉ, 42 %). À réévaluer si les
citoyens ne retrouvent pas ces sujets. Libellés en langage courant (« Mon/Ma… ») et champ
`question_citoyen`. Identifiants inchangés : aucune des 71 propositions existantes à migrer.

## Verdict sur le prompt d'ingestion

**Infirmé pour le cahier des charges complet.** Il produit des fiches de mesures sourcées, bonne base
du détail, mais :

| Besoin | Ce qui manque |
|---|---|
| Synthèse par candidat × thème | Aucun champ ni étape ; le texte doit dériver des mesures **vérifiées**, jamais d'une génération libre. |
| Projection | Le schéma ne dit ni **qui est concerné** ni **dans quel sens** la mesure joue. |
| Traçabilité de la projection | Aucun extrait de source reliant le sens de l'effet à un passage. |

### Modèle de données ajouté : `effets`

Chaque proposition porte une liste `effets` (vide si aucun effet direct sur un citoyen n'est
déterminable). Un effet :

- `cibles` : liste de critères `{ champ, valeurs }` — **tous** doivent correspondre au profil ; liste
  vide = tout le monde. `champ` ∈ champs du profil énumérables (statut professionnel, tranche de
  revenus, situation familiale, enfants à charge, logement, tranche d'âge, tranche de patrimoine) ou
  `autre`. Le champ `autre` porte une description libre d'un critère que le profil actuel ne capture
  pas (ex : nationalité étrangère) : la donnée est conservée, mais **ne se rapproche jamais d'un
  champ plus large** — le moteur ne peut pas l'apparier et l'effet ne contribue pas à l'indicateur.
- `dimension` : revenu disponible, coût de la vie, emploi, protection sociale, accès aux services,
  droits et libertés, sécurité personnelle, patrimoine.
- `sens` : hausse, baisse ou indéterminé — variation de la grandeur, **jamais** un jugement.
- `source_url` (une des sources de la proposition) et `extrait` (passage de la source) qui fondent
  l'effet.

Effets de premier ordre uniquement. La **polarité** (quel sens améliore la situation matérielle :
revenu ↑ améliore, coût de la vie ↑ dégrade…) est une table documentée dans le code du moteur, pas
dans le modèle d'ingestion.

### Agrégation (moteur, déterministe)

Par candidat × thème et profil : on retient les effets dont **toutes** les `cibles` recoupent le
profil et dont le sens est déterminé. Aucun effet applicable → **non concerné**. Tous favorables →
**améliorant**. Tous défavorables → **dégradant**. Les deux → **mixte**. Uniquement des effets
indéterminés ou non appariables → pas de badge (mention « effet non déterminable… »).

### Synthèse

Troisième appel par candidat × thème, après vérification : texte rédigé à partir des seules mesures
retenues, avec renvoi à leurs ids, sans vocabulaire évaluatif ; relu par la passe de vérification.
Fichier `synthese.json` par candidat.

### Données existantes

Les 71 propositions n'ont pas `effets` (champ optionnel côté stockage). Rétro-remplissage à prévoir à
partir des fiches déjà sourcées, avec vérification puis relecture humaine. Les propositions sur les
retraites, rangées sous Travail / Pouvoir d'achat / Aides de l'État, sont à reclasser vers
`retraites`. Formulaire citoyen : à affiner **après** les premiers résultats d'ingestion.

## Ordre de réalisation (point d'étape entre chaque)

1. **Schéma** : types `Effet`, validation dans le schéma d'ingestion, tests.
2. **Moteur** : table de polarité, règle d'agrégation, quatre niveaux, tests.
3. **Prompt et synthèse** : génération et vérification étendues, étape de synthèse.
4. **Interface** : cards par thème, candidats alphabétiques, synthèse et badge.
