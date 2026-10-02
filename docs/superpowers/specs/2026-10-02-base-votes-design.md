# Base « Votes en assemblée » — design

Date : 2026-10-02. Statut : à relire par le porteur du projet.

## Intention (dite par le porteur du projet, 2026-10-01 et 2026-10-02)

Troisième base de connaissances : ce que les candidats ont **réellement voté** à l'Assemblée nationale, rattaché aux
candidats à la présidentielle 2027. Source officielle uniquement.

## Décisions

1. **Source : uniquement l'open data officiel de l'Assemblée nationale** (`data.assemblee-nationale.fr`).
   - Scrutins : `Scrutins.json.zip` (un fichier par scrutin, position nominative de chaque député).
   - Acteurs : `AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip` (identifiants `PAxxxx`, mandats).
   - NosParlementaires, CIVIX, Datan et autres reprises : jamais source ; au plus un contrôle ponctuel, non cité.
2. **Périmètre de la v1** : 17ᵉ législature ; scrutins sur **l'ensemble d'un texte** et **scrutins solennels** (type
   `SPS`). Pas les amendements ni les motions de procédure. L'année et la législature sont portées par chaque vote.
3. **Pas d'indicateur de projection.** Les votes sont des **faits attribués et datés**, jamais présentés comme un
   engagement de 2027. Aucun effet (`effets: []`), donc aucun badge, aucun solde.
4. **Rattachement aux thèmes par règles explicites** (table dans le code, dossier législatif officiel + commission +
   mots du titre), identiques pour tous. Un texte non classé va dans le thème « autres » ; on ne devine pas.
5. **Approche A** : chaque vote devient une entrée au format `propositions.json` existant ; cards, portraits, tableau
   de l'accueil et bascule entre bases sont réutilisés.
6. **Affichage dans le détail d'un candidat × thème** : une synthèse produite par le code, sans modèle
   (« a voté pour X textes, contre Y, s'est abstenu Z sur ce thème »), puis chaque vote : titre du texte, date,
   position, lien vers la page du scrutin sur assemblee-nationale.fr.
7. **Neutralité et couverture inégale.** Un candidat qui n'a pas siégé dans la période couverte (jamais député, ancien
   député d'une autre législature, sénateur) n'apparaît dans aucun thème de cette base ; la mention
   « n'a pas siégé à l'Assemblée durant la 17ᵉ législature » figure en une ligne, sans connotation de valeur. Le
   décompte brut n'est jamais présenté comme une note : un vote « pour » n'est ni bon ni mauvais.

## Données

```
data/bases/votes/
  themes.json                 # thèmes propres à la base (voir ci-dessous)
  questionnaire.json          # vide : pas de questions (aucun indicateur)
  acteurs.json                # slug candidat -> identifiant PAxxxx + source du rattachement
  programmes/<slug>/
    meta.json                 # nom, parti, sources : fichiers officiels, date de collecte
    propositions.json         # un vote = une entrée
    synthese.json             # synthèse chiffrée par thème (produite par le code)
```

Entrée de vote (format `Proposition` existant, plus un champ optionnel) :

```json
{
  "id": "attal-17-vote-5128",
  "candidat": "attal",
  "theme": "sante",
  "titre": "l'ensemble du projet de loi de financement de la sécurité sociale pour 2025",
  "resume_factuel": "Vote du 2024-12-17 : contre.",
  "sources": [{"type": "primaire", "label": "Scrutin n°5128", "url": "https://www.assemblee-nationale.fr/dyn/17/scrutins/5128",
               "nom": "Assemblée nationale", "annee": 2024}],
  "statut": "complet",
  "effets": [],
  "position_vote": "contre",
  "legislature": 17
}
```

`position_vote` ∈ `pour | contre | abstention | non_votant`. Les autres champs de `Proposition` gardent leur valeur
neutre (`chiffrage_disponible: false`, pas de `positions`).

**Thèmes** (propres à la base, adaptés aux textes votés, pas au vocabulaire des programmes) : à fixer au moment du
plan à partir des dossiers législatifs réels des 216+ scrutins ; chaque thème a `libelle` et `question_citoyen` en
langage courant. Un thème « autres » recueille le reste.

**Rattachement candidat → identifiant** : `acteurs.json`, vérifié à la main un par un (le croisement par nom est
bruité : homonymes). Chaque entrée porte l'identifiant, la source (fiche du député sur assemblee-nationale.fr) et la
vérification faite. Premiers rattachements issus du spike : Attal PA722190, Brun (Philippe) PA793624, Faure (Olivier)
PA609332, Guedj PA1567, Hollande PA1654, Le Pen (Marine) PA720614, Maurel PA842271, Ruffin PA722142. **Faure, Bertrand
et Cazeneuve restent à confirmer** (homonymes) avant toute écriture de données.

## Pipeline (`src/votes/`, sur le modèle de `src/scraping/`)

1. **Télécharger** les deux archives (une requête publique chacune, aucun coût, rejouable) vers un cache non versionné.
2. **Charger** les candidats de `acteurs.json` ; erreur si un identifiant est absent du référentiel.
3. **Filtrer** les scrutins : titre « l'ensemble du/de… » ou type `SPS`.
4. **Classer** chaque scrutin dans un thème par règles ; consigner les « autres » dans un rapport.
5. **Extraire** la position de chaque candidat (pour, contre, abstention, non-votant ; absent si pas de ligne).
6. **Écrire** les fichiers de la base ; synthèse chiffrée calculée par le code.
7. **Rapport** : scrutins retenus, candidats couverts, part de « autres ».

Commande : `npm run votes` (rejouable, déterministe : mêmes entrées → mêmes fichiers).

## Interface

- `bases.json` : nouvelle entrée `votes`, libellé « Votes à l'Assemblée », avertissement « Votes issus des données
  officielles de l'Assemblée nationale, 17ᵉ législature ; un vote n'est pas un engagement pour 2027 ».
- Détail d'un candidat : la position (« Pour », « Contre », « Abstention ») s'affiche en mot et symbole, **sans
  couleur verte ni rouge** (ces couleurs signifient améliorant/dégradant ailleurs).
- Base sans indicateur : le mode « Simuler pour moi », la légende, le formulaire, la card « candidat idéal » et le
  masquage « à l'aveugle » ne s'appliquent pas à cette base ; elle s'ouvre en mode « Explorer les mesures » (identités
  visibles) et la bascule de mode est masquée.
- Tableau de l'accueil : nombre de votes par candidat × thème, comme le nombre de mesures ailleurs.
- Ordre alphabétique partout ; dans un thème, les votes de chaque candidat sont triés par date décroissante.

## Garde-fous

- Chaque vote est retrouvable : lien vers le scrutin officiel, date, législature.
- Aucune conclusion tirée d'un vote : pas de « soutient », « s'oppose » dans les synthèses ; seulement les nombres.
- Les votes de groupe ne sont pas attribués à un candidat qui n'a pas voté : seule la ligne nominative compte.
- Les décisions de classement thématique sont versionnées dans le code (table de règles), pas dans un modèle.

## Tests

- Rattachement : identifiant inconnu ou dupliqué → erreur ; chaque candidat de `acteurs.json` existe dans la base.
- Filtre : un scrutin d'amendement est exclu, « l'ensemble d'un texte » est retenu.
- Classement : règles sur des titres réels ; texte non classé → « autres ».
- Positions : pour/contre/abstention/non-votant correctement lus ; candidat absent du scrutin → pas d'entrée.
- Cohérence : chaque proposition référence un thème de SA base (test existant) ; aucun effet ni badge.
- Interface : le mode simulateur et la card idéale ne s'activent pas sur la base `votes`.

## Hors périmètre de la v1

Amendements ; législatures antérieures ; Sénat (Retailleau) ; indicateur de projection ; liaison avec les convictions.
Extensions possibles : autres législatures (même format, un dépôt par législature), Sénat (`data.senat.fr`).

## Questions ouvertes

- Liste finale des thèmes (à déduire des dossiers législatifs réels).
- Confirmer Faure, Bertrand, Cazeneuve ; décider s'il faut les législatures précédentes pour couvrir Mélenchon,
  Roussel, Philippe, Dupont-Aignan, Bertrand, Cazeneuve.
