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

1. **Schéma** : types `Effet`, validation dans le schéma d'ingestion, tests. *(fait, `27d6d9b`)*
2. **Moteur** : table de polarité, règle d'agrégation, quatre niveaux, tests. *(fait, `68c1e13`)*
3. **Prompt et synthèse** : génération et vérification étendues, étape de synthèse.
4. **Interface** : cards par thème, candidats alphabétiques, synthèse et badge.

## Décisions sur le moteur

- **Pas de moteur d'inférence** (Prolog, Datalog, json-rules-engine, Drools) ni de modèle de langage
  au calcul. Fonctions TypeScript pures (`src/engine/projection.ts`, `polarite.ts`) : règles
  explicites et lisibles (CLAUDE.md), ensemble de règles petit et fermé, calcul dans le navigateur
  (le profil sensible ne quitte pas l'appareil), résultat reproductible. Les données (`effets`) ne
  dépendent pas du moteur : le remplacer reviendrait à réécrire une fonction.
- **Question non répondue ≠ « non »** : logique ET à trois valeurs. Un critère faux exclut l'effet
  même si un autre est inconnu ; sinon un effet qui dépend d'un champ non renseigné, ou d'un critère
  `autre`, ou de sens indéterminé, **supprime le badge** (avec sa raison), sauf si l'indicateur est
  déjà « mixte », niveau stable.
- Le formulaire actuel préselectionne la première option de chaque liste : il devra permettre de ne
  pas répondre (à traiter lors de l'affinage du formulaire, après l'ingestion).

## Phase ultérieure : critères numériques et règles chiffrées

À réaliser **après** l'ingestion, en même temps que l'affinage du formulaire.

1. **Critères numériques.** Un critère de cible pourra porter une fourchette (`min`/`max`) sur un
   champ numérique facultatif du profil (ex : revenu mensuel net). Même logique à trois valeurs, mêmes
   quatre niveaux. Prérequis : le programme publie des seuils.
2. **Règles chiffrées.** Pour une mesure dont les paramètres sont publiés complets (ex : un barème de
   l'impôt sur le revenu avec seuils et taux), une fonction pure par mesure calcule le montant avec
   ses hypothèses affichées (quotient familial, abattements, barème en vigueur tiré de sources
   officielles), le signe du montant fixant le niveau. Le mécanisme d'accueil existe (`regles.ts` par
   identifiant de proposition, `Impact.montant_estime`). Un simulateur socio-fiscal open source
   (OpenFisca) est la piste si l'on veut aller plus loin. Sans paramètres complets : on reste au
   niveau qualitatif, jamais de chiffre approximatif.
3. **Données sensibles** (salaire, etc.) : facultatives, sur consentement explicite, calculées dans
   le navigateur (CLAUDE.md).

### Cas d'école : barème de l'impôt sur le revenu de La France insoumise

Vérification faite le 2026-09-24. La fiche `melenchon-fisc-001` cite « davantage de tranches »
(page « partage des richesses » de melenchon2027.fr) sans barème. Un barème à 14 tranches existe
dans un **document officiel** : l'**amendement CF119 au PLF 2022** (n° 4709), déposé le
2 décembre 2021 par Sabine Rubin et 16 cosignataires du groupe La France insoumise, **non soutenu**
le 8 décembre 2021 — 1 % de 0 à 10 292 €, jusqu'à 90 % au-delà de 411 683 € (source :
assemblee-nationale.fr/dyn/15/amendements/4709/CION_FIN/CF119).

Réserves à conserver si on l'intègre :
- C'est une position de 2021 du **groupe parlementaire**, pas un engagement daté de 2027 de la
  candidature ; à attribuer et dater comme tel, sauf source officielle 2027 qui le reprend.
- Ce tableau a d'abord été obtenu en interrogeant un modèle, avec la référence « amendement CF11 au
  PLFR 2021 » — **erreur de référence** (l'amendement CF11 du PLF 2021 porte sur un autre sujet).
  Les chiffres se sont avérés exacts, la référence non : d'où la vérification par source primaire.
- Le barème seul ne donne pas le sens de l'effet par revenu : il faut le comparer au barème en
  vigueur, avec le modèle de calcul du point 2.

### Décision : sources institutionnelles autorisées (2026-09-24)

Les candidats défendent dans les médias des positions de 2021-2022 pour l'élection à venir. Le
pipeline autorise donc, en plus du domaine officiel du candidat, une liste blanche de domaines
institutionnels : `assemblee-nationale.fr`, `senat.fr`, `legifrance.gouv.fr`. Garde-fous, appliqués
en code (contrôle déterministe) et dans les prompts : au moins une source **officielle du candidat
ou du parti** confirme que la mesure est toujours défendue (le document institutionnel ne fait que
la préciser) ; attribution et année exactes (groupe parlementaire vs candidat) ; document émanant du
candidat ou de son groupe.

### Citation des sources

Fin du texte de synthèse, discrètement : `<nom de la source> · <année>`, cliquable. `nom` et `annee`
sont des champs structurés de chaque source (générés puis vérifiés) ; l'interface construit la liste
à partir des propositions utilisées par la synthèse. Le modèle ne rédige jamais la liste lui-même.
