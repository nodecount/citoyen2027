# Recherche : trois façons de récolter les votes à l'Assemblée

Document de recherche, ouvert le 2026-10-18, recentré le même jour. Le choix final revient au porteur du projet (chercheur) ;
ce document compare, il ne tranche pas.

**Sujet.** Une seule question : *comment récupérer, de la façon la plus fidèle, le vote de chaque groupe parlementaire sur
chaque scrutin ?* Les autres sources du projet (programmes, iFRAP) ne sont pas comparées ici : c'était un autre sujet. Une
première version de ce document les mettait en vis-à-vis des votes (commit `f36aa15`) ; c'était une erreur de cadrage.

## But et hypothèse (posés par le porteur du projet)
Représenter les candidats à l'élection 2027 par leurs **votes en assemblée**, pour les mettre en vis-à-vis de la situation
personnelle et des valeurs d'un citoyen. L'hypothèse selon laquelle le citoyen préfère le prisme des actes à celui des
programmes est celle du porteur du projet ; elle relève de son arbitrage et n'est pas évaluée ici.

## Procédure
Si plusieurs moyens mènent au même but, on les compare : (1) un échantillon représentatif de chaque moyen ; (2) l'extraction
menée jusqu'au bout ; (3) comparaison du coût, de la fidélité, des problèmes rencontrés, de la couverture ; (4) le choix est
humain.

## Échantillon commun
Les 242 scrutins publics sur des articles de 15 lois de la XVIIe législature (lot test du 2026-10-18, `src/votes/lois.ts`),
pour les 8 groupes rattachés à un candidat (RN, EPR, HOR, DR, ECOS, LFI-NFP, SOC, GDR) : 1 936 couples scrutin × groupe.
Pour tous les moyens, la suite est identique : règle de position du groupe (POUR si au moins 70 % des suffrages exprimés
pour ou contre et au moins 5 exprimés), texte de l'article pris dans le texte adopté publié par l'Assemblée (217 articles
retrouvés sur 242), une mesure par parti dont le groupe vote POUR. Aucun appel à un modèle n'intervient dans la récolte.

## Les trois moyens

| | **A. NosParlementaires** | **B. Assemblée nationale (fichier officiel)** | **C. Datan (pages web)** |
|---|---|---|---|
| Nature | Retraitement associatif des données officielles | Source primaire (open data de l'Assemblée) | Site associatif, indicateurs dérivés |
| Ce qu'on récupère | Une ligne par député et par scrutin (`pour`, `contre`...), puis on compte par groupe | Un décompte (pour, contre, abstentions, non-votants) **par groupe**, plus une étiquette « position majoritaire » | Un tableau par scrutin : position et décompte de chaque groupe, participation, cohésion |
| Groupe du député | **Groupe actuel** (`deputes.csv`), pas celui du jour du vote | **Groupe au jour du vote** | Groupe au jour du vote |
| Licence | Licence Ouverte 2.0, vérifiée | « Licence ouverte » (annoncée sur la page) | Pages « tous droits réservés », base protégée (loi du 1er juillet 1998) ; seuls 4 jeux de statistiques sont ouverts sur data.gouv, aucun ne contient de votes |
| Législatures | XVIIe seulement (fichier obtenu) | XVIe (10 Mo) et XVIIe | XVIe et XVIIe (une page XVIe vérifiée) |
| Téléchargement | 3 fichiers, 8,8 Mo | 1 archive, 27,6 Mo (8 877 fichiers JSON, 9 s) | 1 page par scrutin, ~143 Ko chacune : environ 35 Mo et 6 min pour 242 pages en espaçant les requêtes |
| Mise en œuvre | ~25 lignes (`src/votes/run-votes.ts`) | ~25 lignes ; les groupes sont des codes (`PO845407`) : il faut une table de noms (celle de Datan sur data.gouv, licence ouverte) | Lecture du HTML, plus fragile ; 3 groupes sur 96 absents de la page quand personne n'a voté |

## Résultats sur l'échantillon commun

Référence de fidélité : B, car c'est la source primaire et le groupe y est celui du jour du vote.

| Critère | A. NosParlementaires | B. Assemblée | C. Datan (12 pages lues sur 242) |
|---|---|---|---|
| Positions identiques à B (1 936 couples) | 1 915 (98,9 %), 21 différentes | référence | 93 sur 93 lues (décomptes identiques à B) |
| Effectifs de groupe différents de B | 292 couples (le groupe actuel remplace celui du jour) | référence | 0 sur 93 |
| Mesures obtenues (articles dont le texte est retrouvé) | 823 | 813 | non produit (non reproductible à grande échelle, voir licence) |
| Écart de mesures avec B | 15 en trop, 5 en moins (20 erreurs, 2,5 %) | référence | n.d. |
| Où sont les écarts | Horizons (15 en trop, 2 en moins) et LR (3 en moins) : les groupes dont la composition a bougé | | |
| Coût en jetons de la récolte | 0 | 0 | 0 |
| Coût de la structuration derrière (référence mesurée : 5,91 $ pour 823 mesures) | 5,91 $ | environ 5,84 $ (extrapolé) | n.d. |

### Le détail des écarts A / B
- Ex. `V1145`, Droite républicaine : A compte 4 « pour » (insuffisant), B 5 « pour » (mesure retenue) ; A a perdu un député
  qui était dans le groupe au jour du vote.
- Ex. `V7080` et sept scrutins voisins, Horizons : A compte 5 « pour », B 4 (insuffisant) : A inclut un député arrivé dans le
  groupe après le vote.
- Quand un groupe est absent chez A (personne), B donne un groupe à zéro : même résultat (« insuffisant »), non compté comme écart.

### Variante B′ : l'étiquette « position majoritaire » de l'Assemblée
Le fichier officiel donne aussi, pour chaque groupe, une étiquette toute faite (« pour », « contre », « abstention »).
Elle remplacerait la règle 70 % / 5 votants, sans aucun calcul.
- Elle est **incohérente avec les décomptes du même fichier** dans 93 cas sur 2 518 (3,7 %), dont 50 pour EPR. Exemple :
  `V1053`, EPR, 36 pour et 4 contre, étiquette « contre ».
- Utilisée seule, elle donnerait 1 273 couples « pour » sur 1 936, contre 878 avec la règle : +45 %, surtout des groupes de
  1 à 4 votants. À ce rythme, la structuration coûterait environ 8,5 $ (extrapolation, non mesurée).

### Problèmes rencontrés
- **A.** La promesse de la page (scrutins depuis 2012, groupe à la date du vote) n'est pas tenue pour les fichiers obtenus :
  XVIIe seule, groupe actuel. Les députés partis ressortent « sans groupe » (12 à 18 par scrutin). Pas de texte d'article.
- **B.** Aucun nom de groupe dans le fichier (codes `PO…`) ; étiquette majoritaire parfois fausse ; la page de description des
  données est incohérente (XVe annoncée, dépôt 17). Pas de texte d'article non plus : il vient des dossiers législatifs.
- **C.** Pas de téléchargement : lecture de pages ; conditions de réutilisation non ouvertes ; chaque page pèse 143 Ko.
  Je n'ai lu que 12 pages (aucune copie conservée dans le dépôt) pour tester la fidélité, et rien n'a été ingéré.
- **Communs aux trois.** Le texte de l'article est à chercher ailleurs (25 articles sur 242 introuvables : articles « bis »,
  « ter », lois renumérotées). Un groupe n'est pas un parti ; GDR n'a que 2 mesures ; quatre candidats (Zemmour, Dupont-Aignan,
  Ruffin, Lisnard) n'ont aucun groupe.

**Premier constat (comparaison des trois moyens de récolte) : validé par le porteur du projet le 2026-10-18.**

## Faisabilité d'intégration dans l'outil (calculée le 2026-10-18)

Question : que devient, une fois dans le moteur et l'interface, ce que chaque méthode récolte ? Mesures sur le même lot de 15 lois.
A = base `votes` actuelle (mesurée). B = même chaîne alimentée par le fichier officiel : les 15 mesures en trop de A retirées
(une seule avait un effet), les 5 manquantes ajoutées sans effet (non structurées). C produirait le même contenu que B sur
l'échantillon lu, mais n'est pas réutilisable (voir licence) : pas d'indicateurs propres.

| Indicateur | A. NosParlementaires | B. Assemblée | C. Datan |
|---|---|---|---|
| Mesures produites | 823 | 813 | non applicable (licence) |
| Candidats couverts (sur les 13 de la base `agregateurs`) | 8, dont Roussel avec 2 mesures | 8, idem | |
| Candidats ayant au moins une mesure à effet | 7 sur 8 | 7 sur 8 | |
| Mesures à effet décrit | 92 (11,2 %) | 91 (11,2 %) | |
| Mesures dont un effet vise un public que le formulaire sait décrire | 34 (4,1 %) | 33 (4,1 %) | |
| Effets « pour tout le monde » (comptent pour chaque profil) | 10 mesures | 9 mesures | |
| Questions du formulaire touchées par au moins une mesure | 5 sur 26 | 5 sur 26 | |
| Réponses du formulaire touchées | 6 sur 86 | 6 sur 86 | |
| Thèmes de la base atteints / avec un effet | 8 / 5 | 9 / 5 | |
| Convictions (étiquettes) | 0 électorat sur 11 a un résultat | idem | |
| Candidat désigné par la situation, 11 électorats types | le même pour les 11 (Glucksmann, +7 à +4 d'avance sur le 2e) | non rejoué : 1 seul effet retiré | |
| Mesures sans effet faute de relecture acceptée | 20 | 25 (20 + 5 nouvelles) | |
| Articles dont le texte est retrouvé | 217 sur 242 (89,7 %) | idem | idem |
| Coût de structuration (référence mesurée pour A) | 5,91 $ | environ 5,84 $ + les 5 nouvelles | |
| Réutilisation permise sans demander | oui | oui | non |
| Couverture du mandat (XVIe + XVIIe) | non (XVIIe seule) | oui, mais XVIe non récoltée à ce jour | |
| Modification du code pour passer de A à B | | environ 25 lignes (compter par groupe depuis le fichier, table de noms de groupes) | |
| Tests et typage | 1 042 tests, `tsc` sans erreur | non rejoué | |

### Lecture
- **Techniquement, l'intégration est faite** : la base `votes` est chargée, testée, jouable. Rien à changer dans le moteur.
- **Le blocage n'est pas la méthode de récolte, c'est ce que la récolte alimente.** Les trois méthodes donnent le même
  contenu à 2,5 % près. Les indicateurs qui mesurent l'utilité pour le citoyen sont faibles pour A et B : 21 questions sur 26
  ne sont touchées par aucune mesure (80 réponses sur 86 aussi), aucun électorat n'a de résultat « convictions », et le même
  candidat arrive premier pour les 11 électorats parce que les 10 mesures « pour tout le monde » dominent.
- **Les écarts entre A et B sont trop petits pour changer ces indicateurs** (1 effet retiré, 5 mesures nouvelles non
  structurées).
- Ce qui bouge ces indicateurs est ailleurs que dans la récolte : formulaire propre à la base (le formulaire actuel est celui
  d'`agregateurs`), étiquettes de convictions (`scrape:positions` non lancé), unité de mesure (articles clés).

## Constat de recherche n° 1 (2026-10-18) : la méthode de récolte pèse peu

Les trois méthodes récoltent les mêmes votes à 2,5 % près ; l'Assemblée est la plus propre (référence), NosParlementaires se
trompe sur les députés qui ont changé de groupe, Datan est exact mais non réutilisable. Le blocage n'est pas là, il est en aval :
un vote dit « ce groupe a soutenu cet article », et la plupart des articles parlent de procédures, d'infractions ou de dispositifs
techniques, pas de personnes concrètes. Sur l'échantillon, 4 mesures sur 100 seulement touchent un public que le formulaire sait
décrire, et le même candidat arrive premier pour les 11 profils de citoyens. La question de recherche devient : **à quel niveau
du processus législatif faut-il prendre le vote pour qu'il serve au citoyen ?** Limite : un seul lot de 15 lois, un seul réglage
de transformation.

## Deuxième comparaison : le niveau du vote (loi entière, article, amendement)

Un vote peut porter sur trois « objets » du même texte. Même lot (15 lois), mêmes 8 groupes, récolte par le fichier officiel (B),
même règle de position de groupe, même structuration des effets par le modèle. Chaque niveau a été mené jusqu'à des effets
décrits : ensemble et article sur la totalité du lot ; amendement sur un échantillon de 200 mesures (25 par groupe, réparties
dans le temps) parce que le niveau compte plus de 5 000 mesures (coût trop élevé pour un essai).

| | Vote sur l'ensemble de la loi | Vote sur un article | Vote sur un amendement |
|---|---|---|---|
| Scrutins du lot | 29 | 310 (242 retenus par le code actuel) | 3 254 |
| Mesures « pour » obtenues | 114 | 823 (878 avant recherche du texte) | environ 5 560 (7 140 × 78 % d'appariement) |
| Texte analysé par le modèle | début de la loi (2 500 caractères sur 127 000 en moyenne) | l'article voté (1 786 caractères en moyenne) | dispositif + exposé des motifs de l'auteur (1 649 caractères) |
| Nature du texte | juridique, tronqué | juridique, sans explication | **juridique + explication en langage courant (exposé sommaire, présent dans 99 % des cas)** |
| Ce que le vote engage | la loi entière, mélange de dispositions | un article | une modification proposée (adoptée ou rejetée) |
| Candidats avec au moins une mesure à effet | 6 sur 8 | 7 sur 8 | 8 sur 8 |
| Mesures à effet décrit | 30 sur 114 (26 %) | 92 sur 823 (11 %) | 28 sur 200 (14 %) |
| Mesures exploitables (le public visé est décrit par le formulaire) | 5 (4,4 %) | 24 (2,9 %) | 9 (4,5 %) |
| Questions du formulaire touchées | 3 (sur 114 mesures) | 5 (sur 823) | 7 (sur 200) |
| Petit groupe (GDR) | 3 mesures | 2 mesures | 75 mesures disponibles |

Écart de lecture : les trois échantillons n'ont pas la même taille, les « questions touchées » ne sont comparables qu'à taille égale.

### Indicateur de complexité d'intégration
Définition (de lecture simple, à repondérer si besoin) : **nombre d'étapes de jointure entre le vote et le texte analysé + taux
d'échec de l'appariement en dizaines de % + volume de données à manipuler (0 sous 100 Mo, 1 de 100 Mo à 1 Go, 2 au-delà)**.

| Niveau | Jointures | Échec d'appariement | Volume | **Indice** | Détail |
|---|---|---|---|---|---|
| Loi entière | 2 (scrutin → dossier → texte adopté) | 0 % (29 sur 29) | 0 (texte seul : 38 Mo de scrutins et dossiers) | **2,0** | Réutilise le code existant. Le texte est trop long (127 000 caractères en moyenne) : il faut le tronquer (c'est ce qui a été mesuré ici) ou le découper, ce qui revient au niveau article. |
| Article | 3 (scrutin → dossier → texte → article) | 30 % (93 sur 310 : 68 titres non reconnus, par exemple « (examen prioritaire) », et 25 articles introuvables) | 0 | **6,0** | Découpage du texte par numéro d'article ; numérotation instable (articles « bis », lois renumérotées). Les 68 titres non reconnus sont un défaut de notre code, corrigeable. |
| Amendement | 4 (scrutin → dossier → fichier des amendements → numéro → texte) | 22 % (719 sur 3 254) | 1 (archive de 344 Mo, 919 Mo décompressée, 140 811 fichiers dont 28 214 pour nos lois) | **7,2** | Le numéro d'amendement n'est pas unique (32 % des cas : même numéro en commission et en séance) ; levé par la date, qui laisse 22 % sans appariement, dont deux lois dont le dossier est de la XVIe. |

### Indicateur de coût
Coût de référence de la structuration par le modèle (tarif public, non facturé : l'usage compte dans l'abonnement). Indicateur
retenu : **coût par mesure exploitable**, car c'est ce que le moteur peut utiliser.

| Niveau | Mesures | Coût mesuré | Coût par mesure à effet | **Coût par mesure exploitable** | Coût du niveau complet |
|---|---|---|---|---|---|
| Loi entière | 114 | 1,72 $ (60 appels) | 0,057 $ | **0,34 $** | 1,72 $ (complet) |
| Article | 823 | 5,91 $ (108 appels) | 0,064 $ | **0,25 $** | 5,91 $ (complet) |
| Amendement | 200 (échantillon) | 2,62 $ (63 appels) | 0,094 $ | **0,29 $** | environ 38 à 73 $ extrapolé pour 5 560 mesures (selon le regroupement des appels) |

Calibrage (régression sur les 69 groupes d'articles, R² = 0,91) : **0,025 $ par appel + 0,0022 $ par millier de caractères**.
Les coûts « complet » des amendements en sont tirés, non mesurés. Gain possible hors indicateur : le texte étant le même pour tous
les groupes, on pourrait décrire chaque texte une seule fois et rattacher l'effet à chaque groupe qui a voté pour : 114 → 29 textes
(÷ 3,9), 823 → 217 (÷ 3,8), 5 560 → 2 535 (÷ 2,2). Le code actuel structure une mesure par groupe et paie donc ce travail
plusieurs fois.

### Constat de recherche n° 2
- Aucun niveau ne règle seul le problème : la part de mesures dont le public est décrit par le formulaire reste entre 3 et 5 %
  aux trois niveaux. Le formulaire (copié d'iFRAP) est le goulot commun.
- Les trois niveaux diffèrent surtout par ce qu'ils disent et par leur complexité : la loi entière est simple à relier mais le texte
  analysé n'est que le début de la loi (donc 26 % d'effets décrits, peu fiables) ; l'article coûte le moins par mesure exploitable
  mais le texte est juridique ; l'amendement est le seul niveau qui porte une explication en langage courant, couvre les huit
  candidats (y compris le petit groupe GDR), mais il est le plus complexe à relier (indice 7,2) et le plus cher (environ 40 à 70 $).
- Un amendement voté « pour » dit ce que le groupe veut, pas ce qui a été adopté : le statut (adopté, rejeté) est dans les données et
  n'est pas encore utilisé.
- Limites : amendements mesurés sur 200 mesures, dont 28 à effet : l'écart avec l'article (14 % contre 11 %) n'est pas
  statistiquement établi. Le lot est le même pour les trois niveaux, mais les échantillons ne le sont pas.

### Pistes non appliquées (notées le 2026-10-18)
- **Décrire chaque texte une seule fois**, puis rattacher l'effet à chaque groupe qui a voté pour : le code actuel refait l'analyse
  pour chaque groupe (÷ 3,8 des appels pour l'article, ÷ 3,9 pour la loi entière, ÷ 2,2 pour l'amendement).
- **Utiliser le statut de l'amendement** (adopté ou rejeté), présent dans les données et ignoré pour l'instant.
- **Corriger la reconnaissance des titres d'articles** : 68 scrutins d'articles (titres avec « (examen prioritaire) » et variantes)
  échappent à `articleDuScrutin` ; la base `votes` actuelle en est légèrement appauvrie.

### Suite prévue
Arbitrage à faire par le porteur du projet, plus tard : choisir le niveau (et la méthode de récolte) **le plus efficace et le moins
coûteux**, à partir des deux indicateurs ci-dessus (complexité d'intégration, coût par mesure exploitable). Rien n'est décidé ; aucun
changement n'a été fait dans la base `votes`, qui reste construite par la méthode A au niveau article.

## Grille pour la décision (à compléter par le chercheur)

| Critère | A | B | C |
|---|---|---|---|
| Fidélité au vote réel | bonne, erreurs sur les groupes qui ont bougé | référence | identique à B sur l'échantillon |
| Couvre le mandat entier (XVIe + XVIIe) | non, en l'état | oui | oui |
| Réutilisable sans demander | oui | oui | non |
| Effort de mise en œuvre | faible | faible (une table de noms de groupes en plus) | moyen à élevé |
| Dépendance à un intermédiaire | oui (retraitement) | non | oui |
| Fiabilité de la source | **à déterminer par le chercheur** | idem | idem |

## Limites
Un seul lot de 15 lois, choisi pour varier les thèmes ; Datan lu sur 12 pages seulement ; la XVIe législature n'est pas
récoltée (B et C la proposent, A non) ; les seuils de position de groupe (70 %, 5 votants) ne sont pas testés ; les 21
écarts A / B sont décrits, pas tous vérifiés un à un à la main contre les comptes rendus de séance.

## Annexe : constats de l'ingestion de NosParlementaires (2026-10-18)
- Le rattachement groupe → parti est approché (RN = Le Pen ; EPR = Attal ; HOR = Philippe ; DR = Retailleau ; ECOS =
  Tondelier ; LFI-NFP = Mélenchon ; SOC = Glucksmann, réserve ; GDR = Roussel, réserve).
- Décisions du porteur : rattachement par parti, unité = articles clés, lot test de 10 à 15 lois, XVIIe seule dans un premier
  temps.
- Lot test (15 lois) : retraites, LFSS 2026, narcotrafic, nationalité à Mayotte, mineurs délinquants, simplification de la vie
  économique, aide à mourir, fraudes sociales, programmation militaire, justice criminelle, loi agricole, logement des agents
  publics, réseaux sociaux des mineurs, énergie-climat, ordre public.

## Reproduire
Scripts d'analyse (hors dépôt, dossier temporaire de session) : décomptes A, décomptes B (table de groupes), comparaison, lecture
de 12 pages C. La base `votes` actuelle (`npm run scrape:votes`) est construite avec la méthode A.
