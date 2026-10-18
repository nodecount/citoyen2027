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
