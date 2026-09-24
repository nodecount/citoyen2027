# Fil rouge : cards par thème, candidats rangés par thème, projection personnelle — Design

Date : 2026-09-24
Statut : proposé (le fil rouge lui-même est acté dans `CLAUDE.md` ; ce document décrit l'écart avec
l'existant et le plan pour le combler)

## Cahier des charges (acté par le porteur du projet)

Par thème : (1) une card lisible par un citoyen ; (2) les candidats rangés dans les thèmes qui
concernent leur programme, chacun avec un texte de synthèse ; (3) un indicateur de projection
améliorant / neutre / dégradant pour la situation du citoyen si la volonté du candidat sur ce thème
s'appliquait.

## Verdict sur la liste des thèmes

**Affirmée, reformulée, pas restructurée.** Les 14 thèmes (11 collectés, 3 provisoires) recoupent
les enquêtes consultées (Ipsos bva-CESI avril 2026, n = 10 962 ; Ifop ; ÉlyséeScope ; Jeunesse 2027).
Aucun thème n'est superflu ; aucun sujet majeur mesuré n'est sans thème (inégalités → « Les aides et
la solidarité », discriminations → « Libertés, égalité et démocratie », nucléaire → « Écologie et
énergie »). Ce qui changeait : la formulation (libellés « Mon/Ma… », champ `question_citoyen`) et le
périmètre de trois descriptions. Les identifiants sont conservés, donc aucune des 71 propositions
existantes n'est à migrer.

Nouveau champ `projetable` : `false` pour « La dette et l'argent public » et « L'Europe, la défense
et la place de la France » — l'effet sur un citoyen donné est indirect. Ces thèmes gardent leurs
candidats et leur synthèse ; l'indicateur y est « non évaluable » par construction.

À surveiller : « Immigration et intégration » dépend de la nationalité / du statut administratif,
absent du profil actuel (`data/profils-schema.json`). Sans ce champ, l'indicateur y sera le plus
souvent « non évaluable ». Ajouter le champ est une décision de minimisation des données à prendre
explicitement (CLAUDE.md : « rester au minimum nécessaire »).

Sujets possibles mais non ajoutés (données insuffisantes ou couverts ailleurs) : numérique / IA /
écrans (22 % « déterminant » sur les écrans chez Ipsos, 72 % d'inquiétude sur la dépendance
numérique chez Jean-Jaurès), économie / attractivité / industrie (50 % chez Ipsos, couvert
partiellement par « Mon travail » et « La dette »).

## Verdict sur le prompt d'ingestion

**Infirmé pour le cahier des charges complet.** Le prompt actuel produit, par candidat × thème, des
fiches de mesures sourcées (`titre`, `resume_factuel`, `sources`, `hypotheses_calcul`…). C'est la
bonne base pour le niveau 2 (détail sourcé), mais il ne permet ni la synthèse (niveau 2, texte) ni la
projection (niveau 3) :

| Besoin | Ce qui manque aujourd'hui |
|---|---|
| Synthèse par candidat × thème | Aucun champ ni étape. Le texte doit dériver des mesures **vérifiées**, jamais d'une génération libre. |
| Projection améliorant/neutre/dégradant | Le schéma ne dit ni **qui est concerné** ni **dans quel sens** la mesure joue. Le moteur ne peut donc pas calculer un sens, seulement « concerné / qualitatif ». |
| Traçabilité de la projection | Aucune citation reliant le sens de l'effet à un passage de la source. |

### Extension proposée

1. **Champs structurés par mesure** (remplis par la passe de génération, contrôlés par la passe de
   vérification) :
   - `cibles` : critères sur les champs du profil, valeurs prises dans `profils-schema.json`
     (ex : `{ "statut_professionnel": ["salarie"], "tranche_revenus": ["moins_1200", "1200_2000"] }`),
     ou `"tous"`. Un critère absent du profil ⇒ « non évaluable », pas de supposition.
   - `effets` : liste de `{ dimension, sens, fondement }` où `dimension` ∈ {revenu disponible, coût
     de la vie, emploi, protection sociale, accès aux services, droits et libertés, sécurité
     personnelle, patrimoine}, `sens` ∈ {hausse, baisse, indéterminé} (variation de la grandeur, pas
     jugement), et `fondement` cite le passage de la source. Le modèle **ne dit jamais « bon » ou
     « mauvais »**.
2. **Polarité dans le code, pas dans le modèle** : une table documentée (`src/engine/`) dit, pour
   chaque dimension, quel sens améliore la situation matérielle du citoyen (ex : revenu disponible ↑
   = améliorant ; coût de la vie ↑ = dégradant). C'est ce qui garde le jugement hors du modèle.
3. **Étape de synthèse** (troisième appel, par candidat × thème, après vérification) : rédige le
   texte à partir des seules mesures PASS, cite leurs ids, interdit tout vocabulaire évaluatif ; la
   passe de vérification relit le texte contre les mesures. Fichier `synthese.json` par candidat.
4. **Règle d'agrégation de l'indicateur** (moteur, déterministe) : on retient les effets dont les
   `cibles` recoupent le profil et dont le sens est déterminé. Tous favorables → *améliorant* ; tous
   défavorables → *dégradant* ; aucun effet applicable → *non concerné* ; effets non déterminables →
   *non évaluable*. Effets contraires sur le même profil → proposé : **« mixte »** avec le détail
   affiché, plutôt que de le ramener à « neutre » (à valider : « neutre » ne devrait signifier que
   « aucun effet attendu » ou « effets qui se compensent, chiffrés »).
5. Le prompt reçoit déjà le périmètre et la date du jour (commit `8c5dddc`) ; il recevra en plus la
   table des champs de profil autorisés pour `cibles`.

### Données existantes

Les 71 propositions (Le Pen, Mélenchon, Philippe) n'ont ni `cibles` ni `effets`. Rétro-remplissage
proposé par une passe d'enrichissement à partir des fiches déjà sourcées (pas de nouvelle recherche
web), puis vérification, puis relecture humaine. Les propositions sur les retraites, rangées sous
Travail / Pouvoir d'achat / Aides de l'État, sont à reclasser vers le thème `retraites`.

## Interface

Une card par thème (libellé + `question_citoyen`), triée dans l'ordre du référentiel. Dans chaque
card : les candidats concernés par ordre alphabétique, chacun avec sa synthèse et son badge
(améliorant / neutre / dégradant / mixte / non concerné / non évaluable) et un accès au détail
sourcé. Jamais de tri par badge, jamais de total inter-thèmes.

## Ordre de réalisation proposé

1. Schéma + types `cibles` / `effets` (optionnels au départ pour ne pas casser l'existant).
2. Moteur : table de polarité + règle d'agrégation, testés unitairement.
3. Prompt de génération + vérification étendus ; étape de synthèse ; tests.
4. Test réel Attal × fiscalité une fois les crédits API disponibles.
5. UI en cards.
6. Rétro-remplissage des 71 propositions.
