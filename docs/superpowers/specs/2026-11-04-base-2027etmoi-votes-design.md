# Base de connaissances « 2027etmoi » : les votes des candidats au Parlement

Document de conception du 2026-11-04. État : **à valider par le porteur du projet** (rien n'est construit).

## Pourquoi
Les mesures d'une base décrivent ce qu'un candidat *promet*. Le porteur du projet veut aussi pouvoir lire ce qu'un candidat a
*voté* quand il a siégé : un vote est un acte, pas une promesse sur papier. Le jeu de données `2027etmoi` (data.gouv.fr, Licence
Ouverte 2.0) donne, pour chaque candidat, ses votes nominatifs, sourcés, avec la même sélection de scrutins pour tous.

L'idée directrice est de **dupliquer ce qui marche pour iFRAP** : une nouvelle base, qui produit exactement le même JSON final
(propositions par candidat, avec cibles, sens des effets, étiquettes de convictions). Le moteur, le formulaire, l'interface et
le score ne changent pas. Le visiteur change de source dans la modale existante et le résultat du moteur change avec elle.

## Deux jeux de données, deux rôles
1. **`candidats.json` : commun à toutes les bases.** Il relie chaque candidat à son parti, son bloc, son statut. Déjà branché
   (`data/bords-politiques.json`, `scripts/bords_politiques.py`, page « À propos »). Il couvre plus de candidats que les bases ;
   ce n'est pas un problème. Étape à ajouter : le parti affiché de toutes les bases vient de ce jeu (aujourd'hui, `meta.json` le
   tient d'iFRAP : Lisnard « LR » au lieu de « Nouvelle Énergie », Roussel « non renseigné »).
2. **`votes.json` : alimente la nouvelle base.** 188 scrutins (AN 120, Sénat 35, Parlement européen 33), 59 candidats, un vote
   par candidat : `pour`, `contre`, `abstention`, `absent`, `non_votant`. Le vote est **celui du candidat lui-même**, pas celui
   de son groupe.

## Changer de source doit toujours fonctionner (exigence du 2026-11-06)
Le visiteur doit pouvoir passer d'une base à l'autre (iFRAP, programmes officiels, votes de 2027etmoi, etc.) et tout doit
continuer à fonctionner : mêmes écrans, mêmes calculs, aucune donnée propre à une base codée dans l'interface. Conséquences :
- Ajouter `2027etmoi` à `bases.json` doit suffire à la rendre sélectionnable ; les tests qui parcourent les bases (thèmes,
  questionnaire, propositions référençant un thème de LEUR base) la couvrent d'office.
- Le lien candidat → parti → bord est **un référentiel unique, valable pour toutes les bases**, donc il doit être fiable pour
  tous les candidats de toutes les bases.
- **Règle de choix du référentiel (porteur du projet)** : si le jeu `candidats.json` de 2027etmoi est fiable pour toutes les
  sources, on le garde ; sinon on revient à Wikipédia. **Constat du 2026-11-06 : retenu.** Les 14 candidats présents dans les
  dossiers de `data/bases/*/programmes` (iFRAP, officielle, votes) sont tous dans le jeu, chacun avec un statut, une source et une
  date ; `scripts/bords_politiques.py` s'arrête avec un message si un candidat manque. Si une future base apporte un candidat
  absent du jeu, la règle s'applique de nouveau (le script Wikipédia reste dans l'historique git, commit `7035472`).
- Réserve connue : les blocs de 2027etmoi sont plus gros que ceux de Wikipédia (pas d'« extrême gauche », de « centre gauche » ni
  de « centre droit »), et « autre » n'affiche aucun bord.

## Ce qui est décidé (par le porteur du projet)
- Nouvelle base `2027etmoi`, sur le modèle d'`agregateurs`.
- Périmètre de départ : **Assemblée nationale et Sénat**. Le Parlement européen est laissé de côté (accès automatique refusé par
  son site, textes très techniques).
- **Un vote = un point pour ou contre le candidat**, selon la situation du visiteur (questions de situation) **et** ses
  convictions (on peut être concerné par une loi et s'y opposer par principe).
- Un vote « pour » une loi qui rapproche un salarié de la retraite est favorable à ce salarié ; un vote « pour » une loi qui
  repousse son départ lui est défavorable. Même principe que le moteur des mesures.
- **Le « contre » (précisé le 2026-11-06)** : le point se lit du côté du citoyen. Un candidat qui a voté **contre** une loi qui
  dégrade la situation du visiteur lui est **favorable** sur ce point ; **pour** une loi qui la dégrade, défavorable ; et
  inversement pour une loi qui l'améliore. Le but est de faire ressortir les candidats qui favoriseraient le plus la situation
  du visiteur pendant le mandat, d'abord au regard de ses questions de situation, puis de ses convictions. Techniquement : la loi
  est décrite une fois, et le code inverse le sens de l'effet pour un vote « contre ». L'hypothèse (« refuser un effet n'est pas
  proposer l'effet inverse ») est affichée sur chaque mesure concernée.

## Comment ça marche
1. **Récolte** (`npm run scrape:2027etmoi`, sans modèle, rejouable, aucun coût). Télécharge `votes.json`, garde les scrutins AN
   et Sénat, écarte les scrutins sans effet sur un citoyen (motions de censure, propositions de résolution). Même règle pour tous.
2. **Contenu de la loi.** Le titre du scrutin ne dit pas ce que la loi change (« Sur l'ensemble du projet de loi d'urgence… »).
   Chemin : page du scrutin → dossier législatif → texte adopté. L'Assemblée est déjà gérée par `src/votes/texte.ts` ; le Sénat
   est à écrire. Un scrutin dont le texte n'est pas retrouvé garde sa mesure **sans effet** (« mieux vaut pas d'indicateur
   qu'un mauvais »).
3. **Une proposition par candidat et par scrutin** (pour ou contre ; abstention, absence et non-votant sont ignorés : ce ne sont
   pas des positions). Texte attribué et daté : « X a voté pour … le jj mois aaaa », avec le lien du scrutin officiel et celui du
   texte. Un vote n'est jamais présenté comme un engagement pour 2027.
4. **Effets décrits par le modèle** (`claude -p`, abonnement), avec les mêmes garde-fous qu'aujourd'hui : extrait retrouvé mot
   pour mot, seconde lecture, une mesure refusée perd tous ses effets. Le sens vient de la table de polarité du moteur, jamais du
   modèle. *Mise à jour du 2026-11-06 :* la première version passe chaque proposition par le structurer comme dans `agregateurs` ;
   décrire une seule fois un texte voté par plusieurs candidats (gain de coût) est décidé après le bilan chiffré du pilote.
   Le thème de chaque scrutin est choisi parmi ceux de la base par le modèle sur le titre, validé par le code, et gardé dans un
   fichier rejouable (mon choix : le fichier ne donne pas de thème).
5. **Même enchaînement qu'`agregateurs`** : `scrape:2027etmoi` → `scrape:structurer` → `scrape:couverture` → `scrape:positions`
   (en dernier) → simulation d'électorats types.
6. **Thèmes, formulaire, étiquettes** propres à la base (règle « un formulaire par base ») : thèmes tirés des lois réellement
   votées, questions justifiées par les mesures de CETTE base seulement.
7. **Citation** : source primaire (Assemblée nationale, Sénat) pour chaque vote ; licence de `2027etmoi` créditée dans « À propos ».

## Ce qui est mon choix (à confirmer ou corriger)
- **Convictions** : un « pour » reprend la position portée par le texte, un « contre » la position opposée. Même méthode
  d'étiquetage automatique que les autres bases, donc même limite (pas de relecture humaine complète).
- **Parti commun** : le parti affiché sous le nom d'un candidat vient de `candidats.json` dans toutes les bases (étape finale,
  corrige Lisnard et Roussel dans la base iFRAP).
- **Niveau du vote** : tous les scrutins du fichier (la plupart portent sur l'ensemble d'un texte), sans découpage par article.
  Le découpage par article (essayé sur la base `votes`) multiplie les jointures et le coût.
- **Pilote d'abord** (candidats choisis par le porteur du projet : Mélenchon, Le Pen, Lisnard), puis bilan chiffré avant le
  passage à tous. Dans le fichier, Mélenchon a 15 votes « pour » ou « contre » retenus (AN 10, Sénat 5), Le Pen 43 (AN seulement),
  **Lisnard aucun, faute de mandat parlementaire**. Lisnard sert donc de **cas témoin** : il ne doit apparaître dans aucun thème de
  cette base. Ma proposition, à confirmer : ajouter Retailleau (sénateur) pour tester le Sénat plus largement.
- **Thèmes** : partir des 11 thèmes de la base `votes` (retraites, santé et fin de vie, sécurité et justice…), ajustés aux lois
  réellement retenues.

## Hors périmètre
Parlement européen ; législatures antérieures à celles du fichier ; pondération des votes (un vote vaut un point, comme une
mesure) ; chiffrage en euros ; portraits des candidats absents de `static/candidats/` ; relecture humaine des étiquettes.

## À éviter à tout prix (échec même si ça tourne)
- Présenter un vote comme un engagement de 2027, ou le vote d'un groupe comme celui du candidat.
- Un classement de candidats par nombre de votes ou une règle de sélection différente d'un candidat à l'autre.
- Un badge fondé sur un titre de loi seulement.
- Copier du texte de comparateurs partisans ou non autorisés.

## Risques connus
- **Peu de votes touchent une situation personnelle.** Sur la base `votes` existante, 3 à 5 % des mesures visent un public que le
  formulaire sait décrire, quel que soit le niveau (loi, article, amendement). Le bilan du pilote le mesure, avec ce même indicateur.
- Les candidats sans mandat (la majorité) n'ont aucun vote : ils n'apparaissent pas.
- Le fichier annonce dans `a_verifier` un périmètre (XIIe à XVIe législatures) que ses identifiants contredisent (`an-17-…`) :
  à vérifier avant d'écrire « XVIIe législature » quelque part.
- Le champ `questions` des scrutins (« q08 »…) n'est pas défini dans les fichiers ; il n'est pas utilisé.

## Laissé à la personne qui construit
Format du cache, lecture des pages du Sénat, règle exacte d'écartement des résolutions, nom des thèmes, noms des scripts
(à calquer sur `scrape:ifrap`), tests, mise à jour de `CLAUDE.md` et de la page « À propos ».

## Lien avec l'existant
La base `votes` (votes de groupes, lot test de 15 lois, `desactivee`) et `docs/recherche-recolte-des-votes.md` restent tels
quels ; leur code (`src/votes/texte.ts`, `src/scraping/ecriture.ts`) est réutilisé.
