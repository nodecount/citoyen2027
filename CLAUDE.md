# CLAUDE.md

Ce fichier donne à Claude Code le contexte nécessaire pour travailler sur ce projet.

## Vue d'ensemble du projet

**Nom (provisoire) :** Simulateur d'impact personnel — Présidentielle 2027

**Objectif :** Un outil web où un citoyen français renseigne quelques informations sur sa situation personnelle (statut, âge, revenus, situation familiale, secteur d'activité, etc.) et obtient une projection factuelle de ce que changerait, concrètement et pour lui, l'élection de chacun des principaux candidats à la présidentielle 2027 — classée par catégories (économie personnelle, droits et libertés, fiscalité, travail, logement, santé, etc.).

## Fil rouge produit (prioritaire — toute décision de conception doit le servir)

Le produit raisonne **par thème**, avec des thèmes qui parlent aux citoyens français, et articule
trois niveaux pour chaque thème :

1. **Une card par thème.** Le citoyen repère ses sujets d'un coup d'œil : libellé en langage courant
   (la question qu'il se pose : « Ma retraite », « Mon logement »…), pas un jargon d'administration.
2. **Les candidats rangés dans les thèmes qui concernent leur programme.** Un candidat n'apparaît
   dans un thème que s'il a des mesures sourcées sur ce thème. Chaque candidat y est accompagné
   d'un **texte de synthèse** expliquant en quoi son programme touche ce thème, pour orienter le
   citoyen vers les thèmes qu'il veut approfondir (puis vers le détail sourcé des mesures).
3. **Une mise en correspondance avec la situation du citoyen, toujours par thème.** Pour chaque
   candidat × thème, un **indicateur de projection** dit ce que deviendrait la situation du
   citoyen (profil renseigné) dans une France où la volonté du candidat sur ce thème s'appliquerait.
   Volontairement **quatre niveaux seulement**, pour la clarté de lecture tout en gardant assez de
   nuance :
   - **Améliorant** — situation favorable dans le futur pour ce citoyen.
   - **Mixte** — à la fois du favorable et du défavorable pour ce citoyen sur ce thème.
   - **Non concerné** — les mesures du candidat sur ce thème ne visent pas ce profil. Ex : le thème
     « retraite » pour un citoyen de 25 ans ; le thème « logement » quand le candidat annonce un
     traitement spécifique aux propriétaires et que le citoyen n'est pas propriétaire. Depuis le 2026-09-29, « sans indicateur » (effet indéterminable) relève de la même catégorie : la légende les réunit et le masquage les retire ensemble.
   - **Dégradant** — situation qui se compliquerait pour ce citoyen. Ex : plus de taxes pour un
     citoyen dont la tranche de revenus est visée par les intentions d'un candidat sur le pouvoir
     d'achat. Ex : une mesure sourcée d'un candidat qui restreindrait l'accès à des soins pour les
     personnes de nationalité étrangère dégrade la situation d'un citoyen étranger sur le thème
     « santé » — à condition que le périmètre de la mesure recouvre bien le profil du citoyen
     (une mesure qui ne vise que les personnes en situation irrégulière ne s'applique pas à tout
     citoyen étranger : on n'élargit jamais le périmètre par approximation).
   Un candidat sans mesure sourcée sur un thème n'y figure pas. Un candidat dont les mesures sur le
   thème existent mais dont le sens de l'effet n'est pas déterminable d'après son programme publié
   apparaît avec sa synthèse **sans badge** et la mention « effet non déterminable d'après le
   programme publié » : ce n'est pas un cinquième niveau, c'est l'absence honnête de projection.

**Deux pages (décision du 2026-10-09, remplace la bascule « Explorer les mesures » / « Simuler pour moi » du 2026-09-29).** Le menu propose Accueil · **Exploration** (`/exploration`) · **Simulateur** (`/simulateur`) · À propos ; plus de bascule ni de mode mémorisé, c'est la page qui fixe le mode. **Pages de contrôle (décision du 2026-10-09)** : `/monitoring` et `/tests-situations`, visibles et ouvertes **pour chaque base** depuis la modale de choix de la source (chaque source a son propre monitoring et son propre découpage à tester ; elles suivent la base du menu, qui reste affiché). La page de tests passe des électorats types (`src/simulation/electorats.ts`) dans le calcul exact de la page de résultat et permet de saisir un verdict par base × électorat (gardé dans le navigateur) : tout projet doit être testé, et ce contrôle prime sur la règle « le produit ne désigne qu'avec la card ». **Exploration** : les programmes seuls — ni indicateur, ni légende, ni formulaire, ni questions par thème, même si des réponses sont enregistrées ; c'est le seul mode où s'affiche le flux animé de bulles (portraits + une mesure, tirés au hasard). **Simulateur** : tout ce qui rattache les mesures à la situation du visiteur. Les questions propres à un thème ne portent ni titre ni décompte : chacune est simplement préfixée « Pour affiner : ».

**Simulateur « à l'aveugle » par défaut (décisions des 2026-09-29 et 2026-09-30).** En mode « Simuler pour moi », les candidats sont **toujours masqués, sans interrupteur** (`src/ui/aveugle.ts`) : « Candidat A, B… » (lettres tirées au hasard à chaque entrée en simulateur et à chaque « Recommencer », identiques d'un thème à l'autre), noms de TOUS les candidats et partis remplacés dans les textes, ni photos ni sources ni adresses. En mode « Explorer les mesures », **les identités sont visibles** (noms et vrais portraits). Simple transformation d'affichage : le moteur ne change pas. Limite assumée : les dérivés du nom et les mesures très reconnaissables restent. Un lien du tableau de l'accueil (qui nomme un candidat) ouvre le mode exploration.

**Parcours du simulateur en quatre écrans (décision du 2026-10-01).** En « Simuler pour moi » : (1) **Ma situation** (questions générales + par thème sur une seule grille de cartes, enregistrement automatique avec pastille « ✓ Enregistré » à droite de l'en-tête, avant « Effacer ») ; (2) **Mesures adaptées à ma situation** (cards de thèmes avec indicateurs, candidats anonymisés : elles ne dépendent QUE de la situation) ; (3) **Mes convictions** ; (4) **Candidat idéal face à ma situation et mes convictions** (bandeau « calcul fondé sur… X questions répondues sur Y · Z convictions complétées sur N », N = nombre de sujets du catalogue, card, rappel des réponses avec « Non répondu » et bouton « Recommencer pour corriger ou compléter » qui garde les réponses ; plus de cards de thèmes ici). Navigation « précédent / suivant » en haut ET en bas de chaque écran ; indicateur d'étapes à plat (volontairement moins imposant que la bascule Explorer/Simuler). Un visiteur qui revient avec des réponses gardées arrive sur le résultat. **Textes pour le citoyen moyen** : jamais sous 1 rem, pas de jargon (« score », « favorable/défavorable », « résultat » — pas « solde », « constats », « indicateur » au sens technique), et les introductions d'écran (décision du 2026-10-02, révise celle du 2026-10-01) suivent toutes le même gabarit `IntroEtape` : une phrase « **Objectif :** » à l'**infinitif**, puis des phrases claires sur des lignes séparées, au **vouvoiement**, avec sujet, verbe et complément (« Vous indiquez… », « Nous vous conseillons… »). Les quatre étapes du menu cliquable ont une **largeur fixe** (quatre colonnes égales, deux sur écran étroit), sélectionnées ou non. **Deux sections d'ouverture, deux styles (décision du 2026-10-11)** : l'introduction (`IntroEtape`, qui explique) est un bloc clair à liseré bleu à gauche ; le panneau de l'écran, qui se manipule ou se consulte (`PanneauProgression` aux étapes 1 et 3, la légende « Si ce candidat était élu… » à l'étape 2), partage un seul style (`.section-secondaire`, sans icône) : carte claire à fond blanc, contour fin, coins arrondis, ombre douce et filet bleu en haut, même padding, même police. Le bleu foncé en fond a été essayé le 2026-10-11 puis retiré (rendu jugé mauvais). Les cards de thèmes de l'étape 2 ne rappellent pas les convictions (elles ne dépendent QUE de la situation). Le parti affiché vient de la base « officielle » quand le candidat y figure (`partiDeReference`), sinon de la source ; absent s'il est inconnu.

**Card « candidat idéal » — disposition du 2026-10-10 (remplace les deux blocs côte à côte).** Au centre, le candidat qui cumule les deux critères (score de la situation + score des convictions, additionnés sans pondération ; la situation seule quand il n'y a pas de résultat convictions) : portrait, nom, parti. De part et d'autre, comme séparés par lui : à gauche le top 3 « situation », à droite le top 3 « convictions » (`classement()` : 3 places, les ex æquo partagent une même place, regroupés dans la même ligne et tous gardés). Chaque ligne = portrait + nom + barre de score noté sur 100 (voir plus bas), **alignée à gauche dans les deux colonnes** (décision du 2026-10-11, remplace une disposition en miroir autour du candidat central) : le rang, les portraits, le nom (avec son badge de parti) et la barre, qui part de la gauche, sont rangés pareil dans les deux colonnes. Au clic sur une ligne (révélée seulement), une modale montre deux jauges de total (groupes de mesures, puis mesures) au-dessus des onglets « Groupes de mesures N / Mesures M » (`PoursContres`). Floutée, rien d'identifiant n'est dans la page, comme avant. Sur écran étroit, le centre passe en tête et les tops s'empilent.

**Card « candidat idéal » (décision du 2026-09-30, révisée le 2026-10-01).** Une SEULE card (sans liseré tricolore depuis le 2026-10-10), qui montre toujours deux blocs : « Selon votre situation » et « Selon vos convictions » (ce dernier dit pourquoi il n'a pas de résultat : aucune position choisie, ou mesures pas encore étudiées sur ces sujets). Floutée, le bouton « Révéler mon programme de candidat idéal pour 2027 » est posé **par-dessus** les résultats (titres nets, identités floutées, jamais de seconde card). Règle publique, identique pour tous, **sans pondération**, appelée **score**. **Décision du 2026-10-11 (remplace le compte par thèmes) : le score est la simple différence entre le nombre de MESURES favorables et le nombre de mesures défavorables**, sans pourcentage, sans rapport à la taille du programme, sans pondération : un candidat qui propose plus de mesures qui avantagent le citoyen est mieux placé, c'est un parti pris assumé (une mesure compte pour une, quelle que soit son ampleur ; une mesure n'est comptée qu'une fois par thème). Situation : les mesures retenues par l'indicateur du thème (un thème mixte apporte ses favorables d'un côté et ses défavorables de l'autre, un « mixte à préciser », non concerné ou sans indicateur n'apportent rien) ; convictions : les mesures étiquetées qui vont dans le sens de la position choisie (favorables) ou à l'opposé (défavorables). Les groupes de mesures sont une autre lecture du même résultat, affichée à côté dans la modale ; ils ne servent pas au score. **Barre des tops (décision du 2026-10-11) : un score noté sur 100**, 100 étant le nombre de mesures (dans les thèmes étudiés, une fois par thème) du candidat qui en a le plus, tous candidats confondus, écartés compris (`noteSur100`, `Classe.note`, `Solde.totalMesures`) ; jamais négatif (un score nul ou négatif s'affiche 0) ; le classement et les égalités suivent le score brut, pas la note arrondie. Seuls les tops utilisent cette barre (bleu du candidat idéal, `JaugeNote`) ; les modales gardent leurs barres vert/rouge (`Jauge`) en nombres de mesures. Raison du choix : compter les thèmes (une douzaine) donnait des égalités partout et pesait autant un thème peu abordé qu'un thème central ; la part en % a été écartée (elle favorise les petits programmes). La page « Tests de situations » compare toujours les trois comptes (mesures, groupes, thèmes) : c'est un outil de contrôle. L'incomplétude des données n'est pas un défaut du moteur de score, c'est un chantier de collecte à part. Égalité : tous les ex æquo montrés, jamais départagés par l'ordre alphabétique ; égalité parfaite à un score nul : « aucun candidat ne se détache ». Un candidat **sans aucun résultat** n'est pas éligible. « Sans condamnation » coché (décision du 2026-10-05, remplace « sans condamnation définitive ») : les candidats à condamnation connue, y compris non établie comme définitive (recours en cours ou statut non confirmé), sont écartés du résultat convictions (leur nombre seulement). Tant qu'elle est floutée, l'identité n'est pas dans la page (le flou CSS n'est jamais la seule protection). Révélée : nom, parti, portrait réel et lettre ; toute modification des réponses ou convictions la **refloute** (nouvelles lettres).

**Limites et partis pris assumés (décision du 2026-10-11, à dire dans les aides et dans « À propos », chapitre « Limites et partis pris »).** L'outil aide à lire les programmes, il ne dit pas pour qui voter. (1) Le questionnaire pose des tranches (âge, revenus, patrimoine…), jamais la situation au centime : c'est un juste milieu entre la précision et le temps de réponse / l'intrusion dans la vie du citoyen. Conséquence : certains effets ne se mesurent pas précisément, et quand on ne peut pas trancher on le dit (« mixte à préciser », « effet non déterminable ») plutôt que de deviner. (2) Aucun chiffrage en euros : sans chiffres précis dans les programmes, un montant serait inventé ; seuls les effets de premier ordre comptent. (3) Le score compte des mesures, sans pondération : une grande et une petite mesure comptent chacune pour une, et un candidat qui en propose davantage qui avantagent le citoyen est mieux placé. (4) Le candidat idéal est une suggestion : c'est au citoyen de pondérer, en lisant les mesures, ce qui compte le plus pour lui. (5) Les étiquettes de convictions sont posées par une méthode automatique à seconde lecture, sans relecture humaine complète ; le résultat dépend de ce qui est publié et déjà traité. Ces points sont écrits dans l'aide « Comment est calculé le score ? » (section « Bon à savoir ») et dans `src/ui/PageAPropos.tsx` (testé).

**Axe « Convictions » par sujets (décision du 2026-10-01, remplace les « groupes sociaux » du 2026-09-29).** 35 sujets (à l'origine neuf, étendus ensuite ; dernier ajouté le 2026-10-10 : « Entreprises », alléger la fiscalité et les charges / faire davantage contribuer et encadrer ; les ultra-riches, riches, sans-emploi sont déjà couverts par « très hauts patrimoines », « fiscalité » et « aides sociales »), chacun à deux positions opposées, au catalogue fixe `src/positions.ts`. Un sujet n'est proposé au visiteur que si au moins une mesure de la base l'a étiqueté. Les neuf d'origine : (nucléaire, énergies renouvelables et transition écologique — l'ancien sujet « écologie et énergie » a été scindé le 2026-10-04 car ses positions ne s'opposaient pas —, IA, Europe, immigration, fiscalité et dépense publique, sécurité et justice, travail et retraites, libertés et société), chacun avec des positions opposées ; « Pas d'avis » est l'absence de choix, jamais une position. Les mesures sont **étiquetées** par `npm run scrape:positions` (modèle via `claude -p`, abonnement) : champ `positions` de chaque proposition (sujet, position, extrait retrouvé mot pour mot, adresse de source — épurée en mode aveugle), relecture adversariale, une étiquette refusée retire toutes celles de la mesure, journal `_positions.json` rejouable. Une mesure sans étiquette = aucune position (jamais « contre »). L'intégrité (condamnations sourcées, `data/integrite/` : définitive = deux sources dont une primaire ; `statut: "non_definitive"` + texte `recours` = deux sources, sans primaire exigée, décision du 2026-10-05) reste : « non vérifié » sans fichier valide, jamais « aucune condamnation » ; aucune donnée saisie. **Aucune étiquette n'a encore été relue par le porteur du projet.**

**Tiroir de portraits en mode simulateur (décision du 2026-09-29)**, une fois des indicateurs affichés : trois zones, sans fond coloré, de gauche à droite — *améliorant*, *mixte*, *dégradant* (la couleur reste sur le contour des portraits ; le mixte n'a pas de couleur propre : moitié vert, moitié rouge) — alphabétique dans chaque zone. C'est un rangement par catégorie d'effet sur la situation du visiteur, **pas un classement de candidats** : aucun score, aucun ordre entre candidats d'une même zone. Les « non concerné » et « sans indicateur » (une seule catégorie) sont masqués par défaut (interrupteur « Masquer les candidats dont les mesures ne changent rien à ma situation », dernière tuile de la légende, qui est blanche) ; masqués, ils disparaissent sans être comptés (leurs noms restent dans le tableau de l'accueil) ; la pastille « +X » ne regroupe, comme en exploration, que les candidats sans mesure sur le thème ; affichés, tous les non concernés sont en ligne, sur une ligne à part sous les zones, **sans couleur ni indicateur**, comme en exploration. Un candidat ouvert reste affiché même s'il appartient à cette catégorie. Les tiroirs ont la même hauteur en exploration ; en mode simulateur (indicateurs affichés), chaque tiroir est dimensionné à ses seuls candidats.

**Parcours du visiteur (précisé par le porteur du projet le 2026-09-26 ; c'est le principe de départ, pas un
changement) :**
1. **Page de départ = les thèmes.** Le visiteur voit d'abord les cartes de thèmes ; sur chacune, seuls les
   **portraits** des candidats dont les mesures sourcées touchent le thème, **cliquables** (le détail — synthèse, mesures,
   sources — s'ouvre depuis le portrait). Aucun formulaire à remplir avant, aucun indicateur.
2. **Formulaire général d'abord, puis par thème.** Le visiteur répond aux **questions générales** (utiles à au moins deux
   thèmes, posées une seule fois), puis **valide** ce formulaire. **Tant qu'il n'est pas validé — ou s'il est validé sans
   aucune réponse — les effets ne sont pas appliqués** : les portraits restent sans indicateur ni couleur (jamais de « badge
   général » ni de moyenne inventée). Le questionnaire est **segmenté par thème** (pertinence question → thèmes propre à
   chaque base : `data/bases/<id>/questionnaire.json`) ; une question utile à un seul thème est posée dans ce thème.
3. **Après la validation du formulaire général**, une couleur apparaît autour de chaque portrait (améliorant, mixte, non
   concerné, dégradant), toujours doublée du mot et d'un symbole. Le visiteur peut alors **préciser d'autres informations
   thème par thème, à son rythme** ; chaque réponse s'applique tout de suite. Les questions sont toutes facultatives et
   conditionnelles quand il le faut ; c'est parce qu'on ne connaît pas l'individu qu'on l'interroge plus précisément (les
   effets « pour tout le monde », comme un prix ou une prestation courante, restent des effets valides : ils décrivent le
   cas courant).
4. **Quand le moteur n'est pas sûr que le visiteur soit concerné** par une mesure, deux cas bien distincts (décision du
   2026-09-27) : si une **réponse à une question du formulaire lèverait le doute** (champ non répondu), l'indicateur est
   **« mixte »**, marqué « à préciser », avec l'explication et la question qui manque (`Projection.incertain`). Si
   **aucune réponse ne le pourra jamais** (la mesure vise un public que le formulaire ne sait pas décrire, critère `autre`),
   l'effet est **exclu du calcul du badge** plutôt que de le bloquer indéfiniment sur « mixte » sans espoir de résolution ;
   il est compté et signalé à part (`Projection.effetsNonPrisEnCompte`), y compris à côté d'un badge déterminé, pour ne
   jamais laisser croire que l'indicateur tient compte de tout. Un « mixte » réel (mesures favorables ET défavorables)
   reste distinct des deux.
Garde-fous de l'indicateur (ils découlent du principe d'indépendance ci-dessous) :
- Il mesure l'effet sur **la situation matérielle et les droits du citoyen** (revenu, coûts, accès,
  droits), jamais un jugement de valeur sur la politique elle-même. Le « sens » (favorable ou
  défavorable) est fixé par une table de règles dans le code, jamais par le modèle d'ingestion.
- Il est produit par des **règles explicites, documentées et reproductibles** à partir de données
  structurées et sourcées (cibles et sens de l'effet de chaque mesure, avec l'extrait de source qui
  le fonde), pas par un modèle opaque.
- **Pas de score global inter-thèmes, pas de classement de candidats.** L'indicateur reste par
  thème ; l'ordre d'affichage reste alphabétique (y compris dans chaque zone du tiroir en mode simulateur, voir « Tiroir de portraits ») ; la même méthode s'applique à tous les candidats. **Exception décidée le 2026-09-30 : la card « candidat idéal » (voir plus haut), seul endroit où un candidat est désigné.**
- Effets de premier ordre uniquement : ce que la mesure fait directement au citoyen, pas des
  conséquences macroéconomiques spéculées.
- Toute hypothèse est affichée (mesure imprécise, chiffrage absent, effet dépendant de détails non
  publiés) ; à défaut de pouvoir trancher, on ne devine pas.
- **Mieux vaut pas d'indicateur qu'un mauvais indicateur.** Quand le programme est trop vague pour
  fixer dans quel sens l'effet joue, ou qu'aucune mesure n'a d'effet déterminable, on n'affiche pas de badge : le
  prompt d'ingestion doit être cadré pour produire une réponse ciblée ou rien, jamais une réponse approximative.
  (Quand c'est le fait que le visiteur soit concerné qui est incertain, on affiche « mixte à préciser », voir plus haut.)
- Le formulaire est construit **à partir des critères (cibles) réellement présents dans les programmes** (catalogue
  `data/bases/<id>/profils-schema.json`, propre à chaque base, qui alimente aussi les prompts d'ingestion de CETTE base). Pas de texte libre que le moteur ne sait
  pas apparier (région et secteur retirés) : collecter le minimum nécessaire. Réponses multiples possibles.
- **Données sensibles : seulement si nécessaires à l'indicateur, toujours facultatives.** C'est le citoyen qui
  décide de les donner (finalité expliquée sous chaque question, « Je préfère ne pas répondre » comme état de départ) ;
  elles servent le calcul dans son navigateur et ne sont jamais transmises. Décision du 2026-09-29 : **toutes les
  réponses (sensibles comprises) sont gardées dans le navigateur du visiteur** (`localStorage`, clé `reponses-visiteur`,
  `src/ui/memoireReponses.ts`) pour survivre à un rechargement de page ; jamais envoyées à un serveur, effaçables à
  tout moment (« Effacer mes réponses », avec confirmation), et le formulaire le dit (« gardées pour votre prochaine
  visite tant que vous ne les effacez pas »). Au rechargement, seules les réponses encore valides pour le questionnaire
  actuel sont reprises (une option ou un champ disparu est écarté, jamais deviné) ; si le stockage est refusé
  (navigation privée), l'outil marche en mémoire seulement. Même décision : plus de
  case d'accord préalable ni de bloc séparé (deux clics pour une information, mauvaise ergonomie) — les questions
  sensibles sont posées au même niveau que les autres, leur caractère facultatif et leur finalité tenant lieu de
  garde-fou ; l'ancienne règle « case d'accord explicite, décocher efface les réponses » est abandonnée. Une question non répondue n'équivaut **pas** à « non » : les
  effets qui en dépendent rendent l'indicateur « mixte à préciser », avec l'invitation à répondre pour affiner.

**Principe fondateur — INDÉPENDANCE ET NEUTRALITÉ :** C'est la contrainte la plus importante du projet. L'outil ne doit être affilié à aucun parti, ni directement ni indirectement. Concrètement, cela implique :
- Ne jamais utiliser un simulateur ou un jeu de données produit par un parti ou une organisation partisane (ex : les simulateurs internes que certains candidats ou partis publient sur leur propre programme) comme source de vérité, même comme point de départ technique.
- Pour chaque proposition intégrée, toujours viser au moins deux sources, dont une source primaire (le programme officiel du candidat/parti, un texte de loi, une déclaration officielle), inspirées de la rigueur méthodologique observée chez des initiatives comme Komune Media. **Exception depuis le mode « corpus » (2026-09-26)** : une seule source primaire suffit si l'extrait qui la fonde est retrouvé **mot pour mot par le code** dans le texte extrait du document (preuve plus forte que deux sources citées mais non relues) ; la seconde est ajoutée quand elle existe (constante `SOURCES_MINIMUM`).
- Présenter les propositions de façon factuelle et juxtaposée, sans commentaire de valeur ni classement moral. L'indicateur de projection par thème (voir « Fil rouge produit ») est autorisé parce qu'il est défini par des règles explicites et appliqué identiquement à tous ; en revanche, aucun score global ni classement de candidats, et aucun indicateur implicite ou non documenté.
- **Sources institutionnelles autorisées pour préciser une position ancienne.** Dans les médias, les candidats défendent encore aujourd'hui des positions de 2021, 2022, etc. pour l'élection à venir : si rien de plus récent n'existe, on peut s'appuyer sur un document officiel (amendement sur assemblee-nationale.fr, texte sur legifrance.gouv.fr, senat.fr). Garde-fous : (1) la mesure doit rester confirmée comme défendue par au moins une source officielle récente du candidat ou de son parti — le document institutionnel ne sert qu'à en préciser les paramètres (seuils, taux…) ; (2) il est **attribué et daté** exactement (ex : « position du groupe La France insoumise, amendement de 2021 »), jamais présenté comme un engagement de 2027 ; (3) il doit émaner du candidat ou de son groupe, pas d'un autre parlementaire.
- **Positions anciennes du candidat lui-même** (décision du 2026-09-26, étude `docs/etude-sources-officielles-2026-09-25.md`) : si un candidat n'a rien publié de plus récent, ses documents officiels plus anciens (ex : programme 2022) sont utilisés, **datés** (« position de 2022 », année portée par chaque source) et **comptés dans l'indicateur**. Dès qu'une source officielle plus récente existe sur la même mesure, elle prime ; une position ancienne n'est jamais présentée comme un engagement de 2027. Périmètre de la première version : les 17 candidats des niveaux 1 et 2 de l'étude (les 7 sans programme exploitable apparaissent comme « programme pas encore publié » — décision d'affichage encore à prendre).
- **Citation des sources.** Discrètement, **à la fin du texte de synthèse** « pourquoi et en quoi ce programme impacte ce thème », chaque source est citée sous la forme `<nom de la source> · <année>` (point du milieu), **cliquable** vers la source. Le nom court et l'année sont des champs structurés de la source (jamais rédigés à la main dans le texte) ; la liste est produite par l'interface à partir des propositions utilisées.
- Documenter systématiquement les hypothèses de calcul quand une proposition est vague ou incomplète (ex : "aucun chiffrage précis publié, estimation basée sur X").
- Traiter tous les candidats déclarés avec le même niveau d'exigence et de détail, même si leurs programmes ne sont pas tous publiés au même degré de précision.

## Direction artistique et rédactionnelle (décision du porteur du projet, 2026-09-27)

Le site est pensé pour un **citoyen français lambda** qui veut juste se renseigner sur les programmes avant de voter.
- **Accessible** : police **14 px minimum** partout ; contrastes suffisants ; focus visible ; la couleur ne porte
  jamais seule une information (mot + symbole pour les indicateurs) ; animations coupées si l'utilisateur le demande.
- **Police** : Atkinson Hyperlegible (Braille Institute, conçue pour la lisibilité), embarquée localement — rien qui
  ressemble au style des sites IA actuels (ni sans-serif géométrique type Inter, ni serif éditoriale sur fond crème).
- **Style moderne, bleu-blanc-rouge**, thème clair uniquement. Le **bleu** est la couleur d'action (boutons, liens,
  onglet actif, accents) ; le **rouge** reste décoratif (bandeau tricolore, soulignés), jamais sur un bouton ni un
  texte d'information, car dans le contenu le rouge signifie « dégradant ». **Seule exception (décision du 2026-10-11) : les
  boutons destructeurs** (« Effacer mes réponses / mes convictions » et leur confirmation « Oui, tout effacer »), en rouge
  « danger » (`bouton-effacer`, `bouton-danger`), l'intitulé portant le sens. Aucune couleur attribuée à un candidat.
  Pas d'imitation de l'identité visuelle de l'État (pas de Marianne ni de « République française »).
- **Informations importantes accentuées par la couleur** (blocs, badges, soulignés), pas par des paragraphes.
- **Texte limité à ce qu'il doit dire** : phrases courtes, rien qui n'intéresse pas un électeur qui veut savoir qui
  propose quoi. **Aucune répétition** : chaque information a une seule place (la provenance des données = une ligne
  par base ; la source de chaque mesure = un lien cliquable dans la carte ; les crédits photos = en bas de l'accueil).
- **Photos des candidats** : image principale Wikidata de chacun (même règle pour tous), licences libres uniquement,
  créditées, copiées dans `static/candidats/` (`npm run portraits`) ; à défaut, initiales. Aucune requête vers un
  service tiers pendant la visite.
- **Pages** (chacune a son adresse) : `/` accueil (présentation en une phrase, garanties, tableau « qui propose
  quoi » : candidats × thèmes, nombre de mesures) ; `/simulateur` (cartes de thèmes, trois par ligne, hauteur fixe,
  médaillon d'icône, portraits en pied de carte, candidats sans mesure empilés à droite) ; `/ma-situation`
  (questions générales). La base de connaissances se change dans une modale ouverte depuis une icône du menu.

## Ce qui existe déjà sur le marché (contexte de veille, ne pas dupliquer bêtement)

- **Komune Media** (komunemedia.fr) — comparateur sourcé, exigence de sources primaires, approche éditoriale indépendante. Bonne référence méthodologique.
- **Pourquituvotes.fr** — comparateur thématique de programmes (actuellement centré municipales 2026), pas de simulateur d'impact personnel.
- **ÉlyséeScope** (elyseescope.com) — agrégation de sondages + comparaison position par position, classement alphabétique pour neutralité.
- **Ça change quoi** (cachangequoi.fr) — simulateur d'impact personnel, mais **produit par LFI** → à étudier uniquement pour la mécanique UX, jamais comme source de données ou de calcul.
- **Simulateur Lisnard 2027** — même remarque, outil de campagne d'un candidat, à ne pas utiliser comme référence de calcul.
- **Comparateur iFRAP** (ifrap.org/comparateurs/presidentielles-2027) — comparateur de la Fondation iFRAP (fondation reconnue d'utilité publique en 2009, financée par des dons privés, décrite par des tiers comme libérale ; elle affirme son indépendance des partis). 28 candidats, 10 thèmes, mesures listées **sans source par mesure ni date**, couverture très inégale (beaucoup de « proposition non encore connue »), pas de mentions légales ni conditions de réutilisation visibles. **En veille, usage non tranché** : piste envisagée = simple liste de contrôle de complétude (jamais source, jamais citée ni copiée dans le dépôt) ; à décider avant tout usage, et à valider juridiquement pour toute réutilisation de contenu.
- **candidatspresidentielles2027.fr** — projet personnel d'un particulier (« Maxime »), gratuit, sans publicité, financé par dons, code public sur GitHub sans licence de réutilisation visible ; pas de méthodologie ni de politique de correction. Fiches par candidat en résumés paraphrasés, quelques liens vers des documents officiels en bas de page, pas de chiffrage, mises à jour parfois anciennes. **Attention : son niveau de programme (« Complet », « Sommaire »…) mesure la disponibilité de positions, pas la publication d'un programme.** Il a servi à dresser la liste initiale des candidats déclarés : recouper systématiquement statuts et programmes avec d'autres sources et avec les sites officiels. En veille, usage limité à la découverte de documents primaires.
- **Fondapol "Qui en 2027 ?"** — simulateur de scénarios électoraux (sondages), pas d'impact personnel.
- **Candidator, MonVote2027, Prési2027, politiquement.org** — quiz de matching candidat/convictions, pas des simulateurs d'impact.

**Constat :** aucun outil identifié à ce jour ne combine (a) profil personnel détaillé, (b) plusieurs candidats en parallèle, (c) impact chiffré par catégorie de vie, (d) indépendance vis-à-vis des partis. C'est le créneau du projet.

## Architecture

Structure en place (toute évolution significative se discute avec le porteur du projet) :

```
/data
  /bases                  # plusieurs bases de connaissances, de structure identique (voir ci-dessous)
    bases.json            # registre : id, libellé, description, avertissement affiché, base par défaut
    /<base_id>/           # « officielle », « agregateurs »…
      themes.json         # référentiel de thèmes PROPRE à la base
      /programmes/<candidat_slug>/
        meta.json          # nom, parti, sources officielles, date de dernière maj
        propositions.json  # liste de propositions structurées par thème
        synthese.json      # un texte par candidat × thème (facultatif)
  (chaque base a aussi son profils-schema.json : ses questions, voir « Un formulaire par base »)

/src
  /engine        # moteur de calcul : profil + proposition -> impact estimé
  /ui            # interface (formulaire profil + affichage résultats)
  /ingestion     # scripts d'extraction/mise à jour des programmes depuis sources officielles

/docs
  methodologie.md   # règles de sourçage, règles de neutralité, processus de mise à jour
```

### Bases de connaissances (décision du 2026-09-26)

Le moteur, l'interface et le fil rouge sont **communs** ; la provenance des données varie selon la base, et l'on
bascule de l'une à l'autre (sélecteur en haut de page, adresse `?base=<id>`, choix mémorisé dans le navigateur ;
base par défaut = celle de `bases.json` marquée `defaut`). Toutes ont la même structure de fichiers ; **chaque base a ses
propres thèmes** (selon la source branchée, il y en a plus ou moins). Ajouter une base = un dossier
`data/bases/<id>/` + une entrée dans `bases.json`, aucun autre code ; les tests vérifient que chaque proposition
référence un thème de SA base.
- **`officielle`** : documents officiels des candidats, alimentée par le pipeline d'ingestion par API
  (`src/ingestion/`, en pause à la date de la décision : crédit API à recharger). Extraits retrouvés mot pour mot,
  effets structurés, projection par thème.
- **`agregateurs`** : reprise, sans modèle, du texte de comparateurs indépendants (aujourd'hui iFRAP seul ;
  `npm run scrape:ifrap`, `src/scraping/` : une requête publique, aucun coût, rejouable). Sources **secondaires**, sans date
  par mesure (année = année de consultation), thèmes de la source. Le porteur du projet a décidé de leur faire confiance ;
  le contenu reste attribué et lié à sa page d'origine. La règle « une source primaire » de la base officielle ne s'y
  applique pas. **Effets et badges** : décrits ensuite par un modèle appelé via la commande `claude -p` (abonnement, pas
  crédit API ; `npm run scrape:structurer`, rejouable), avec les mêmes règles que la base officielle (cibles, dimension,
  sens ; polarité dans le moteur) : chaque extrait doit être retrouvé mot pour mot dans le texte de la proposition, un
  second appel relit, et une proposition dont un effet est refusé perd TOUS ses effets (pas de badge fondé sur une moitié
  de mesure). Défense et Europe/international : « analysés, sans effet », sans appel. Les badges y sont donc rares.
  - candidatspresidentielles2027.fr est **abandonné** (2026-09-26) : Cloudflare le bloque même dans un vrai navigateur
    (« Sorry, you have been blocked ») ; on ne contourne pas ; ne réessayer qu'avec l'accord de son éditeur ou via un
    dépôt public de ses données. Si plusieurs sources coexistent un jour, leurs propositions sont mises bout à bout
    (chacune gardant sa source) ; le badge MIXTE vient alors des `effets` structurés, jamais du texte.
### Un formulaire par base (décision du 2026-10-04)

Les questions posées au visiteur découlent des mesures de la source : une autre source découpe autrement les publics
visés, donc pose d'autres questions. Chaque base a donc **son** `data/bases/<id>/profils-schema.json` (questions, options)
et son `questionnaire.json` (pertinence par thème) ; une question n'existe dans une base que si celui-ci la range dans des
thèmes (testé). Les critères que les effets peuvent cibler, la consigne donnée au modèle et la validation des effets
suivent le formulaire de la base (`src/schemaBase.ts` ; `BASE_INGESTION = officielle`, `BASE_STRUCTURATION = agregateurs`).
Seules les réponses gardées dans le navigateur utilisent l'union des bases (elles suivent le visiteur quand il change de
base). Ajouter une question ou une option = justifier par les mesures de CETTE base, jamais par une autre. Par exemple
le 2026-10-04 : `officielle` (Le Pen, Retailleau) pose « parent isolé », « ancienneté en France » et l'option « veuf ou
veuve » ; `agregateurs` (iFRAP) pose « montant de la pension », « enfant de moins de 3 ans », « difficulté à trouver un
médecin » et l'option « minimum vieillesse ». « Héritage ou donation » et « trois enfants ou plus » sont justifiés par les
deux. Le catalogue des **convictions** (`src/positions.ts`) reste commun (validé par le porteur du projet, sans lien avec une
source) ; seules les étiquettes sont propres à chaque base.
### Règles ajoutées le 2026-10-10
- **Tranches de revenus** : `officielle` coupe à 4 000 € (3 000-4 000, 4 000-5 000) ; `agregateurs` garde 3 000-5 000.
- **Statut** : option « Chef d'entreprise ou employeur » (`chef_entreprise`) dans les deux bases ; les prompts d'extraction la réservent aux chefs d'entreprise, employeurs, patrons de TPE/PME ; indépendants, artisans, professions libérales restent `independant` ; grandes entreprises et actionnaires seuls = `autre`.
- **Score** : un thème compte au plus une fois par côté ; un effet « pour tout le monde » (cibles vides) compte pour chaque profil ; une mesure multi-thèmes compte dans chacun.
- **Attribution des programmes de parti** (2026-10-06) : une position de parti n'est attribuée qu'avec la mention de son origine, jamais présentée comme celle du candidat seul.
- **Date** : l'année de chaque source est mentionnée automatiquement.
- **Simulation d'électorats types** : `src/simulation/` (`npx vite-node src/simulation/run-electorats.ts` écrit `docs/simulation-electorats.md`, 11 profils dont « Chef d'entreprise »). `src/engine/regles.ts` est vide : le sens des effets est fixé dans le moteur.
- **Limites d'usage** : les gros traitements via l'abonnement se lancent l'un après l'autre ; ils sont reprenables sans `--force`. Changer le schéma exige `--force` (le hachage d'ingestion ne l'inclut pas). Changer le catalogue des convictions relance tous les groupes d'étiquetage, et réextraire efface les étiquettes : étiqueter en dernier.

### Modèle de donnée d'une proposition (exemple de structure à affiner)

```json
{
  "id": "fisc-001",
  "candidat": "...",
  "theme": "fiscalite",
  "titre": "...",
  "resume_factuel": "...",
  "sources": [
    {"type": "primaire", "label": "Programme officiel", "url": "..."},
    {"type": "secondaire", "label": "Analyse presse", "url": "..."}
  ],
  "chiffrage_disponible": true,
  "hypotheses_calcul": "...",
  "date_derniere_verification": "2026-09-14"
}
```

### Modèle de profil utilisateur (exemple, à affiner)

Champs possibles : statut (salarié, indépendant, fonctionnaire, retraité, étudiant, sans emploi...), tranche de revenus, situation familiale, nombre d'enfants, logement (locataire/propriétaire), secteur d'activité, région, nationalité/statut administratif, etc. Rester au minimum nécessaire pour limiter la friction ; les champs sensibles ne sont demandés que s'ils sont nécessaires pour fournir l'indicateur, toujours facultatifs et sur consentement explicite du citoyen (voir « Fil rouge produit »).

## Ce que Claude Code doit garder en tête à chaque session

0. **Servir le fil rouge produit** (cards par thème → candidats rangés par thème avec synthèse → indicateur de projection par thème) : toute évolution des données, du prompt d'ingestion, du moteur ou de l'UI doit rendre cela possible sans le contourner.
1. **Ne jamais introduire de biais implicite** : formulations, ordre d'affichage (alphabétique par défaut, jamais par indicateur ; seule exception, décidée le 2026-09-29 : en mode simulateur le tiroir de portraits range les candidats en zones par catégorie d'indicateur, alphabétique dans chaque zone), poids des thèmes — tout doit rester équilibré entre candidats.
2. **Toute donnée de programme ajoutée doit avoir ses sources citées dans le fichier de données**, jamais codée en dur dans la logique applicative sans traçabilité.
3. **Le moteur de calcul doit être transparent** : privilégier des règles explicites et lisibles (if/formules documentées) plutôt qu'un modèle boîte noire, pour que chaque utilisateur puisse comprendre pourquoi tel impact est projeté.
4. **Pas de scraping de sites non autorisés** : vérifier les conditions d'utilisation avant toute extraction automatisée de données depuis des sites tiers (Komune, Pourquituvotes, etc.). Privilégier les sources officielles (programmes publiés en PDF/HTML par les candidats, Légifrance, data.gouv.fr) ou un partenariat explicite.
5. **Statut des programmes** : certains candidats n'ont pas encore publié de programme complet à cette date — le prévoir dans le modèle de données (champ de statut "provisoire / partiel / complet") plutôt que de combler les trous avec des suppositions.
6. **Stack technique** : fixée — React/Vite/TypeScript, vitest pour les tests (voir « État actuel »). Un changement de stack se discute avec le porteur du projet, ne se décide pas seul.

## État actuel du projet (mis à jour le 2026-10-01)

Le moteur de calcul (`src/engine/`), le formulaire par thème (`src/questionnaire.ts`, `src/ui/Questions*.tsx`,
`data/bases/<id>/profils-schema.json` : 26 questions par base (voir « Un formulaire par base »), générales + par thème, sensibles facultatives posées au même niveau que les autres) et l'interface
(`src/ui/`, portraits cliquables, React/Vite/TypeScript) sont construits et fonctionnels. **Aucune donnée, dans
aucune des deux bases, n'a encore été relue ni validée par le porteur du projet.**

- **`officielle`** (pipeline `src/ingestion/`, **en pause depuis le 2026-10-01** au profit d'une troisième base ;
  progression détaillée et commandes de reprise : `docs/progression-base-officielle.md`). Le pipeline tourne
  maintenant **sur l'abonnement** (`--moteur=cli`, plus besoin du crédit API). `le-pen` (56 propositions, 12 thèmes,
  12 synthèses) est passé par la chaîne complète actuelle (double relecture, verdict séparé sur les effets, synthèses
  relues) ; `retailleau` (60, 11 thèmes) et `attal` (5, fiscalité seule) datent d'avant ces règles. `melenchon` et
  `philippe` ont été repassés par le pipeline corpus le 2026-10-10 (fiscalité, pouvoir d'achat, travail ; Mélenchon par passes thématiques à cause de la limite de 150 000 jetons du corpus ; documents : laec.fr 2021 et meeting 2026 pour lui). Étiquettes de convictions de cette base incomplètes. **Depuis le 2026-10-11, la base `officielle` est mise de côté : on ne travaille que sur `agregateurs`.** Les
  autres candidats des niveaux 1-2 n'ont pas de données : il faut d'abord déclarer leurs `documents` (adresses et
  années réelles) dans `meta.json`.
- **`agregateurs`** (`src/scraping/`) : 22 candidats scrapés depuis iFRAP (`npm run scrape:ifrap`), 1 186
  propositions, 128 avec effets structurés par un modèle appelé via la commande `claude -p` (`npm run
  scrape:structurer`, sur abonnement, pas sur le crédit API).

Prochaines étapes probables :
- Faire relire et valider le contenu par le porteur du projet (exactitude factuelle, neutralité du ton, cohérence entre candidats), sur les deux bases.
- Reprendre l'ingestion `officielle` (sur abonnement) quand la troisième base sera lancée : repasser `melenchon`/`philippe` par le pipeline corpus, puis étendre aux candidats restants (voir `docs/progression-base-officielle.md`).
- Décider du thème « pouvoir d'achat » (retrait ou maintien) — en suspens.
- Si `candidatspresidentielles2027.fr` redevient accessible un jour (accord de son éditeur), l'ajouter à `agregateurs`.
