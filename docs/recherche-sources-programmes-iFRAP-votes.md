# Recherche : trois moyens de représenter les candidats 2027 (programmes, iFRAP, votes à l'Assemblée)

Document de recherche, ouvert le 2026-10-18. Le choix final revient au porteur du projet (chercheur) ; ce document
compare, il ne tranche pas.

## But

Dans le cadre de la comparaison des représentants politiques et de leur mise en vis-à-vis de la situation personnelle
d'un citoyen et de ses valeurs, représenter les candidats à l'élection 2027 **par leurs votes en assemblée**.
**Hypothèse de recherche** : le prisme des actes (votes) est peut-être plus plaisant pour le citoyen que le prisme des
programmes (promesses). Ce n'est pas établi : c'est ce que la comparaison doit éclairer.

## Procédure (rappel du porteur du projet, 2026-10-18)

Quand plusieurs moyens permettent d'atteindre le même but, on les compare :

1. un **échantillon représentatif** de chaque moyen ;
2. l'extraction est menée **jusqu'au bout** (jusqu'à des mesures et des effets utilisables par le moteur), pas à moitié ;
3. on **compare les résultats** : coût (tokens, temps), fidélité, problèmes rencontrés, couverture ;
4. le **choix final revient à un humain** (comité ou chercheur), jamais à l'assistant.

## Les trois moyens

| Moyen | Base | Ce que représente un candidat | Statut |
|---|---|---|---|
| Programmes officiels | `officielle` | Ce qu'il promet (documents primaires) | Existant, en pause |
| Comparateur iFRAP | `agregateurs` | Ce qu'il promet (résumé par un tiers) | Existant |
| Votes à l'Assemblée | à créer | Ce que son parti a voté (actes, passé) | En cours (voir ci-dessous) |

## Échantillon commun

À fixer avant l'extraction pour que les trois moyens soient comparables : mêmes candidats, mêmes thèmes. (À renseigner
au fil de l'eau.)

## Votes à l'Assemblée : journal

### 2026-10-18 : sources trouvées
Voir `docs/etude-sources-votes-assemblee-2026-10-18.md` (sources, licences, tableau de complexité estimée).

### 2026-10-18 : constats de l'ingestion de NosParlementaires
- Le fichier `scrutins_an.json` ne contient que la **XVIIe législature** (8 877 scrutins, tous après juillet 2024), alors
  que la page annonce « depuis 2012 ». La XVIe (juin 2022 - juin 2024) manque : elle est disponible à l'Assemblée
  (archive officielle, 10 Mo), pas chez eux.
- Les fichiers de votes n'ont que `scrutin_id, deputy_slug, position`. Le **groupe n'est pas celui du jour du vote**
  (la page le promettait) : `deputes.csv` ne donne que le groupe actuel ; les députés partis ressortent « sans groupe »
  (12 à 18 par scrutin).
- Un scrutin n'a que `id, date, title, dossier_ref, pour, contre, abstention, nonvotant` : **aucun texte** d'article ou
  d'amendement. Le moteur, lui, exige un extrait retrouvé mot pour mot.
- Un groupe n'est pas un parti (règle retenue par le porteur : rattachement **par parti**). Correspondance approchée :
  RN = Le Pen ; EPR = Renaissance (Attal) ; HOR = Horizons (Philippe) ; DR = LR (Retailleau) ; ECOS = écologistes
  (Tondelier) ; SOC = PS ; LFI-NFP, GDR, UDDPLR, DEM, LIOT regroupent des profils plus larges. À valider.
- Décision du porteur : unité de mesure = **les articles clés** (pas le vote final seul, pas les amendements), lot test de
  10 à 15 lois, XVIIe seule dans un premier temps.
- Lot test retenu (15 votes finaux) : retraites (annulation des réformes), LFSS 2026, narcotrafic, nationalité à Mayotte,
  mineurs délinquants et leurs parents, simplification de la vie économique, aide à mourir, fraudes sociales,
  programmation militaire, justice criminelle, loi agricole, logement des agents publics, réseaux sociaux des mineurs,
  énergie-climat, ordre public. Décompte par groupe : `cache/scrape/nosparlementaires/lot-test.json` (hors dépôt).

### 2026-10-18 : extraction menée jusqu'au bout (lot test)
Chaîne : `npm run scrape:votes` (code : `src/votes/`) puis `npm run scrape:structurer -- --base=votes`.
1. Scrutins et votes par député (NosParlementaires) + dossiers législatifs de l'Assemblée (JSON) → liste des 15 lois.
2. **Article clé = article ayant eu un scrutin public** : 242 scrutins d'article. Le texte de chaque article est pris dans
   le texte adopté publié par l'Assemblée (`dyn/opendata/<texte>.html`), à l'issue de la lecture où l'article a été voté :
   **217 retrouvés, 25 introuvables** (surtout les articles « bis / ter / quinquies » et la loi énergie-climat dont la
   numérotation change entre lectures).
3. Position d'un groupe : POUR si au moins 70 % des suffrages exprimés pour ou contre, avec au moins 5 votants exprimés ;
   sinon « partagé » ou « insuffisant ». Une mesure par parti dont le groupe vote POUR (un vote CONTRE ne produit pas de
   mesure : refuser n'est pas proposer autre chose). 823 mesures sur 8 partis.
4. Structuration des effets par le même pipeline que `agregateurs` (modèle via `claude -p`, formulaire copié de
   `agregateurs`) : 69 groupes, 108 appels.

## Résultats (échantillon commun : les 8 candidats rattachables à un groupe)
Candidats : Le Pen, Attal, Philippe, Retailleau, Tondelier, Mélenchon, Glucksmann, Roussel. Chiffres calculés sur les
fichiers de données au 2026-10-18.

| Critère | Programmes (`officielle`) | iFRAP (`agregateurs`) | Votes (`votes`) |
|---|---|---|---|
| Candidats couverts parmi les 8 | 5 (Tondelier, Glucksmann, Roussel absents) | 8 (Roussel : 6 mesures) | 8 (Roussel : 2 mesures) |
| Mesures brutes | 590 | 1 152 | 823 |
| Mesures avec effet utilisable | 227 (38 %) | 348 (30 %) | **92 (11 %)** |
| Part des mesures à effet dont la cible est « autre » (public que le formulaire ne sait pas décrire, donc exclu du badge) | 23 % | 29 % | **71 %** |
| Mesures rejetées à la relecture | non relevé | 79 (7 %) | 20 (2 %) |
| Coût de référence de la structuration (abonnement, tarif public) | non relevé (autre pipeline) | 5,09 $ (140 appels) | 5,91 $ (108 appels) |
| Coût par mesure à effet | non relevé | environ 0,015 $ | environ 0,064 $ (**4 à 5 fois plus**) |
| Convictions étiquetées | oui (incomplet) | oui (505 mesures) | non fait |
| Thèmes | 12, ceux du programme | 10, ceux de la source | 11 (un par domaine de loi), 8 atteints |
| Source | primaire | secondaire | primaire (texte, scrutin) + secondaire (décompte) |
| Date des mesures | 2021-2026, datées | 2026 (année de consultation) | 2024-2026, datées au jour |

### Problèmes rencontrés (votes)
- **Un vote n'est pas une mesure.** Un groupe peut voter POUR un article qu'il a amendé ou dont il récuse la moitié. Un article
  de loi est du texte juridique (« il est ajouté un article L. 121-1 »), sans exposé des effets : le modèle ne peut conclure
  que sur une minorité d'articles.
- **Les effets décrivent des publics que le formulaire ne sait pas décrire** (« personne ayant commis une fraude aux
  prestations », « organisateurs d'un rassemblement non déclaré », « victime d'une infraction commise par son conjoint ») : 71 %
  des mesures à effet sont exclues du badge. Un formulaire propre à cette base serait à concevoir (aujourd'hui : copie de celui
  d'`agregateurs`).
- **Le classement obtenu n'est pas discriminant.** Dans la simulation des 11 électorats types, Glucksmann arrive premier avec le
  même score (+7) pour les 11 profils : les rares effets « pour tout le monde » dominent. Le résultat de cette base est
  donc, en l'état, peu informatif sur la situation du citoyen.
- **Groupe ≠ parti, et groupe actuel ≠ groupe au jour du vote** (voir plus haut). Quatre candidats (Zemmour, Dupont-Aignan,
  Ruffin, Lisnard) n'ont aucun groupe correspondant : aucune mesure.
- **Petits groupes** : GDR (Roussel) a 154 articles « insuffisant » sur 160, faute de votants exprimés en séance.
- **Un seul vote par article**, souvent tactique ; les votes CONTRE (nombreux : 57 pour le RN, 102 pour LFI) ne sont pas
  représentés : on ne montre que ce que le parti a soutenu, ce qui biaise la représentation vers le « pour ».
- Convictions : aucune étiquette posée sur cette base.

## Grille de lecture pour la décision (à compléter par le chercheur)

| Critère | Programmes | iFRAP | Votes |
|---|---|---|---|
| Fidélité à ce que le candidat s'engage à faire en 2027 | haute | moyenne | **faible** (passé, parti, texte entier) |
| Fidélité à ce que le parti a réellement fait | nulle | nulle | haute (fait public, daté) |
| Utilisable par le moteur tel quel | oui | oui | partiellement (11 % des mesures, 71 % de cibles inexploitables) |
| Coût de traitement | élevé (documents longs) | faible | moyen à élevé (4 à 5 fois iFRAP par mesure utile) |
| Couverture des candidats | partielle | large | limitée aux partis ayant un groupe |
| Lisibilité pour le citoyen (hypothèse « actes ») | **à tester auprès de citoyens** | idem | idem |

Limites de cette comparaison : un seul lot de 15 lois ; paramètres de la position de groupe (70 %, 5 votants) non testés ;
échantillon non tiré au hasard (choisi pour la variété des thèmes) ; la lisibilité pour le citoyen, au cœur de l'hypothèse,
n'est pas mesurée ici (elle demande un test auprès de visiteurs).
