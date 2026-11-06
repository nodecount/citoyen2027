# Bilan du pilote : base « 2027etmoi » (votes des candidats)

Pilote du 2026-11-06. Candidats : Mélenchon, Le Pen, Retailleau (demandé en plus) et Lisnard (cas témoin, sans mandat).
Plan : `docs/superpowers/plans/2026-11-06-base-2027etmoi.md`. Conception : `docs/superpowers/specs/2026-11-04-base-2027etmoi-votes-design.md`.

## Mise à jour du 2026-11-06 (après correction d'un défaut, voie B)
Le premier pilote contenait un **défaut de ma part** : pour les 30 mesures issues du Sénat, le « texte de la loi » analysé était le **menu du site** (« Aller au contenu, La galaxie Sénat… ») et les lettres accentuées avaient disparu (entités `&eacute;` remplacées par une espace). Les chiffres du premier tableau ci-dessous étaient donc faussés pour tout le Sénat, et l'explication que j'avais donnée du zéro de Retailleau (texte trop court) était fausse. Corrigé et testé (`corpsDuTexteSenat`, `htmlEnTexte`), puis pilote refait deux fois :

| Mesure sur 75 | Premier pilote (menu du Sénat) | Sénat corrigé, 2 500 caractères | Sénat corrigé, **8 000 caractères** |
|---|---|---|---|
| avec un effet décrit | 5 (6,7 %) | 6 (8,0 %) | **13 (17,3 %)** |
| dont public décrit par le formulaire | 2 (2,7 %) | 3 (4,0 %) | **5 (6,7 %)** |
| avec une position de conviction | 15 (20 %) | 30 (40 %) | **33 (44 %)** |
| Retailleau, avec effet | 0 | 2 | **8** |
| coût de référence (structuration + positions) | 1,95 $ | 1,33 $ | 2,87 $ |

Un premier vote « contre » avec effet apparaît (Mélenchon, loi sur l'immigration de 2007 : le texte baisse l'accès de certains étrangers à des services, lu pour un vote contre comme une hausse). Le sens inversé est conforme à la règle décidée.

### Troisième passage : chaque loi lue en entier, une seule fois (2026-11-07)
`npm run scrape:structurer-textes` : la loi est découpée en passages de 12 000 caractères (plafond 400 000), décrite une fois, puis ses effets sont donnés à tous ses votants (pour comme contre). Mesure sur 75 :

| Mesure | 8 000 caractères | **Loi entière, mutualisée** |
|---|---|---|
| avec un effet décrit | 13 (17,3 %) | **38 (50,7 %)** |
| dont effet « pour tout le monde » | 0 | 2 |
| avec une position de conviction | 33 (44 %) | **43 (57 %)** |
| Retailleau, avec effet | 8 | **19** |
| coût de référence de la structuration | 2,9 $ (par candidat) | 16,6 $ (53 lois, une fois) |

Le coût de la lecture est désormais **par loi**, plus par votant : étendre à 28 candidats ajoute surtout des lois nouvelles (124 scrutins en tout). Limites : ces effets ne sont pas relus par un humain ; une loi entière mélange souvent du favorable et du défavorable (mesures « mixtes »), et le public décrit par le formulaire reste à mesurer (chantier du formulaire).

Une loi fait en moyenne 127 000 caractères : 8 000 n'en couvrent qu'environ 6 %. Le gain de 6 % à 17 % montre que lire davantage aide, mais on est loin de lire la loi entière.

## Ce qui marche
- **Récolte** : 124 scrutins retenus sur 188 pour toute la base (Assemblée nationale et Sénat, hors motions de censure et résolutions) ; pour le pilote, 67 scrutins classés dans un thème (14 écartés, « aucun thème »).
- **Texte de loi retrouvé pour 53 scrutins sur 67 (79 %)**, soit 59 propositions sur 75.
- **75 propositions** : Le Pen 37 (25 pour, 12 contre), Retailleau 28 (24 pour, 4 contre), Mélenchon 10 (1 pour, 9 contre).
- **Cas témoin réussi** : Lisnard n'a aucun dossier dans la base (aucun mandat, aucun vote).
- **Aucune mesure sans texte n'a reçu d'effet** : le garde-fou « extrait retrouvé mot pour mot » suffit, un titre de loi seul ne donne pas de badge.
- **Basculer entre sources fonctionne** : la base se charge et s'assemble comme les autres (suite complète : 1159 tests verts), et le parti affiché est désormais le même dans toutes les bases.

## Ce qui ne marche pas assez
| Mesure | Résultat |
|---|---|
| Mesures avec un effet décrit | **5 sur 75 (6,7 %)** : Le Pen 4, Mélenchon 1, Retailleau 0 |
| dont public décrit par le formulaire | **2 sur 75 (2,7 %)** (les autres visent un public « autre ») |
| dont effet « pour tout le monde » | 0 |
| Mesures avec une position de conviction | 15 sur 75 (20 %), toutes de Le Pen |
| Réponses du formulaire jamais visées | 88 sans mesure défavorable, 89 sans mesure favorable |

C'est le même goulot que celui mesuré le 18 octobre sur la base `votes` (3 à 5 %). Changer de source (votes nominatifs au lieu de votes de groupes) n'a pas levé le problème : la plupart des lois votées ne visent pas un public que le formulaire sait décrire.

## Points à connaître
1. **Le sens « contre » n'a pas pu être contrôlé sur des données réelles.** Les 5 mesures avec effet sont toutes des votes « pour ». L'inversion est testée (6 tests du moteur, dont un qui échoue quand on la désactive), pas encore vue sur un vrai vote contre.
2. **13 scrutins de l'Assemblée n'ont pas de lien vers leur dossier législatif** sur leur page officielle (dont la loi Climat de 2021), et 1 dossier du Sénat n'a pas de texte adopté. Piste : les dossiers législatifs en données ouvertes (utilisés par `src/votes/run-votes.ts`).
3. **Le texte analysé est le début de la loi** (8 000 caractères au plus depuis la mise à jour). *(Le zéro de Retailleau du premier pilote venait du menu du Sénat pris pour le texte, voir la mise à jour en tête.)*
4. **La simulation d'électorats ne sert à rien ici** : `src/simulation/run-electorats.ts` donne des lignes identiques pour iFRAP, votes et 2027etmoi. Problème du script, antérieur à ce travail. Fichier généré non commité.
5. **Questionnaire et schéma** de la base sont une copie de ceux de la base `votes`, non ajustés.

## Coût
Structuration : 1,24 $ de référence (29 appels). Étiquetage des convictions : 0,71 $ (7 appels). Abonnement, rien de facturé. Extrapolation à 804 votes (28 candidats) : environ 20 $ de référence, et un travail de classement des 124 scrutins en plus.

## Décision à prendre
Étendre à tous les candidats donnerait environ 800 mesures dont, au rythme du pilote, une trentaine avec un effet. Trois voies :
- **A. Étendre tel quel** : couverture large des candidats qui ont siégé, très peu d'effets, résultat proche de « effet non déterminable » presque partout.
- **B. Améliorer d'abord** : lire plus que le début de la loi, retrouver les 14 textes manquants, mutualiser la description d'un même texte entre candidats, ajuster le formulaire aux publics réellement visés. Puis un second pilote.
- **C. S'arrêter là** : garder la base désactivée comme résultat de recherche.

Ma recommandation : **B**, en commençant par la lecture de plus de texte (point 3), qui est la seule explication plausible du 0 de Retailleau.
