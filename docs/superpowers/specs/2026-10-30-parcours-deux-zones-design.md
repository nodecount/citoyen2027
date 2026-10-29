# Parcours du simulateur en deux zones — conception (2026-10-30)

Statut : conception validée en chat avec le porteur du projet (maquettes du Visual Companion, option « B »). Rien n'est encore construit.

## Intention

Le parcours actuel du simulateur (`src/ui/PageThemes.tsx`, `src/ui/ParcoursSimulateur.tsx`) enchaîne quatre écrans : Ma situation → Mesures adaptées → Mes convictions → Candidat idéal. Le porteur veut une représentation plus ludique, qui donne envie d'aller jusqu'au bout, et où l'on peut remplir la situation et les convictions **indépendamment, dans n'importe quel ordre**, tout en accédant à la suggestion dès qu'on a un peu répondu.

Réponse retenue : **un seul écran à trois blocs**, la situation à gauche, la suggestion (« Mon candidat idéal ») au centre, les convictions à droite. Il remplace le menu d'étapes et les quatre écrans.

## Objectifs

- Un écran unique à trois blocs ; plus de menu d'étapes ni de navigation précédent/suivant entre écrans.
- Situation et convictions remplissables séparément, sans ordre imposé.
- La suggestion est accessible dès **une** réponse donnée (situation ou convictions).
- Une progression visible et un pourcentage de « précision » de la suggestion, avant révélation.
- Après révélation, le classement actuellement présent autour de la card (tops 3 situation et convictions) reste accessible, dans des onglets.

## Hors périmètre / interdits

- Aucun changement du moteur de score, des règles de départage, du flou (l'identité n'est jamais dans la page tant que la suggestion est floutée, le flou CSS n'est jamais la seule protection), du mode aveugle, de la mémoire des réponses (`localStorage`, `memoireReponses.ts`), ni du questionnaire.
- Pas de nouvelle donnée ni de nouvelle question.
- Le « % de précision » n'est **pas** une probabilité ni un score de candidat : c'est uniquement la part de questions répondues. Il ne doit jamais être présenté comme une fiabilité du résultat (à écrire dans l'aide et à vérifier dans « À propos »).

## Les trois blocs

### Bloc gauche — « Ma situation »
- Deux onglets : **Questions** et **Candidats**.
- Onglet *Questions* : titre, « N questions sur M » (la file entière, générales + thèmes), barre, bouton « Commencer » / « Continuer » qui ouvre le pas à pas existant (`PasAPas`, une question par écran, inchangé), puis, une fois commencé, un lien « → Voir les mesures adaptées ».
- « Voir les mesures adaptées » : l'ancien écran « Mesures adaptées à ma situation » (cards de thèmes avec indicateurs, candidats anonymisés, légende) devient un contenu rattaché à cette zone (ouvert depuis ce lien, pas une étape de menu). Décision du porteur : rattaché à la zone de gauche. Forme exacte (page dans la zone, volet, plein écran avec retour) : au builder.
- Onglet *Candidats* : « Selon ma situation », top 3 de la situation (`classement()`, ex æquo regroupés), chaque ligne = portrait + nom + barre `JaugeNote` sur 100 ; clic sur une ligne → modale existante (jauges + onglets groupes de mesures / mesures, `PoursContres`).

### Bloc droit — « Mes convictions »
- Mêmes deux onglets. *Questions* : « N sujets sur 35 » (N = sujets du catalogue proposés), barre verte, « Commencer / Continuer » vers l'écran de convictions existant, mention « un sujet sans avis = neutre ». *Candidats* : « Selon mes convictions », top 3 convictions, mêmes lignes, même modale. Le décompte des candidats écartés pour condamnation (case « Sans condamnation ») reste affiché comme aujourd'hui.

### Bloc central — « Mon candidat idéal » (fond bleu en permanence)
Toujours dans cet ordre, de haut en bas :
1. Titre fixe « Mon candidat idéal » (jamais modifié).
2. **Anneau de progression** autour d'un disque blanc uni (pas de pointillés). L'anneau se remplit selon (questions de situation répondues + sujets de convictions répondus) / (total des deux) ; les deux catégories sont confondues, sans pondération.
3. Dans le disque : avant révélation, le pourcentage (« 17 % de précision », arrondi du même rapport) ; une fois révélé, **plus de pourcentage** : le portrait réel du candidat (ou ses initiales à défaut), l'anneau reste.
4. Sous le cercle : le nom du candidat. Flouté tant que non révélé, avec un nom fictif « XXXXXX YYYYYY » derrière le flou (jamais le vrai nom dans la page : voir règle ci-dessus). Révélé : nom + parti.
5. Une ligne d'explication de ce sur quoi repose la suggestion : « Calculé sur votre situation seule » / « …sur vos convictions seules » / « …sur votre situation et vos convictions ». (Les mots exacts sont à l'appréciation du builder, avec le vouvoiement du produit.)
6. Le bouton (voir états).

## États du bloc central

| État | Condition | Disque | Nom | Bouton | Onglets « Candidats » |
|---|---|---|---|---|---|
| 1. Vide | 0 réponse (aucun côté) | « 0 % » | flouté | « Révéler », **inactif** (grisé) | verrouillés (cadenas, non cliquables) |
| 2. Partiel | ≥ 1 réponse | « N % » | flouté | « Révéler », actif : bouton plein, fond blanc, texte bleu foncé | verrouillés |
| 3. Révélé | l'utilisateur a confirmé | portrait, sans %. | nom + parti | **fantôme** « Revenir aux questions », sous-texte « Révélé · précision N % » ; fond légèrement plus clair que le bleu, **sans bordure** | **ouverts et sélectionnés automatiquement dans les deux blocs** au moment de la révélation |

Précisions de comportement (décidées) :
- Cliquer « Révéler » ouvre une **modale de confirmation** : titre « Révéler votre candidat idéal ? », rappel de la précision (« N % de précision : X réponses sur Y questions, côté situation seulement / convictions seulement / les deux »), phrase disant que la suggestion changera et sera de nouveau masquée si l'on répond à d'autres questions, boutons « Oui, révéler » et « Continuer à répondre ». (Texte rédigé par l'assistant, à ajuster.)
- Cliquer « Revenir aux questions » (état 3) : les deux blocs repassent sur *Questions*, le cercle réaffiche le pourcentage, le candidat est **de nouveau flouté** (décision explicite : « oui, reflouter »), le bouton redevient « Révéler » (état 2). Les onglets « Candidats » se reverrouillent. Le simple clic suffit, même sans changer de réponse. Conséquence assumée : pour revoir le classement, il faut reconfirmer.
- Toute modification d'une réponse ou d'une conviction **refloute** aussi (comportement actuel de la card), avec **nouvelles lettres** en mode aveugle, et met à jour le pourcentage.
- Dans l'état 3, l'utilisateur peut aussi cliquer directement l'onglet *Questions* d'un bloc : ce bloc affiche ses questions, l'autre reste sur *Candidats* (les deux onglets sont indépendants), sans refloutage tant qu'aucune réponse ne change. (À valider par le builder si cela complique l'état ; c'est l'interprétation de « il suffit de cliquer sur son onglet voisin ».)
- L'onglet *Candidats* d'un bloc n'est ouvert qu'après révélation, même si le bloc a des réponses.
- Sans résultat côté convictions (aucune position choisie, ou mesures non étiquetées), l'onglet *Candidats* correspondant affiche la raison (comme le bloc « Selon vos convictions » actuel) au lieu d'un top.

## Mobile

Sur écran étroit, les trois blocs s'empilent dans cet ordre : **suggestion en haut, puis situation, puis convictions** (décision du porteur). Les onglets restent dans chaque bloc.

## Visite de retour

Un visiteur qui revient avec des réponses gardées arrive sur le nouvel écran, **non révélé** (état 2, jamais directement révélé), avec la progression recalculée. (Remplace « un visiteur qui revient arrive sur le résultat » — décision à acter dans `CLAUDE.md`.)

## Contraintes du projet à respecter

- Textes pour le citoyen moyen : jamais sous 1 rem, pas de jargon (« score », « indicateur »…), vouvoiement, phrases courtes ; introduction au gabarit `IntroEtape` (objectif à l'infinitif) pour l'écran ou les panneaux qui en ont besoin.
- Couleurs : le bleu est la couleur d'action ; rouge réservé aux boutons destructeurs (« Effacer ») ; vert réservé aux effets améliorants et à la zone convictions (sa barre, comme dans les maquettes) — à vérifier contre la règle « aucune couleur attribuée à un candidat » (aucune ici).
- La couleur ne porte jamais seule une information : l'anneau a le pourcentage, les états ont des mots.
- Accessibilité : onglets en `role="tablist"` / `tab` / `tabpanel`, état verrouillé annoncé (`aria-disabled`), anneau avec `role="progressbar"` et valeur, focus visible, flou jamais seul protecteur, animations coupées si demandé.
- Mode aveugle : tout reste anonymisé tant que non révélé ; l'ordre des lettres reste identique d'un thème à l'autre.
- `docs/comparaison-monvote2027-2026-10-27.md` et le pas à pas existant ne sont pas modifiés.

## À mettre à jour dans le projet

- `CLAUDE.md` : le paragraphe « Parcours du simulateur en quatre écrans » et la card « candidat idéal » (disposition) doivent dire que les quatre écrans deviennent un écran à trois blocs, avec la date de la décision ; la mention « visiteur de retour arrive sur le résultat » change.
- Tests : les tests statiques existants du menu d'étapes, de `NavEtape`, de `BandeauPertinence` et de la card doivent être adaptés ou remplacés ; ajouter des tests pour les trois états du bloc central, le verrouillage des onglets, le refloutage au clic sur « Revenir aux questions », la non-présence du vrai nom dans le HTML tant que non révélé, et le calcul du pourcentage.
- « À propos » : une phrase sur le sens du pourcentage de précision (part de questions répondues, pas une fiabilité).

## Appels faits par l'assistant (à relire par le porteur)

- **Effacer** : « Effacer mes réponses » (confirmation conservée) reste en bas de l'onglet *Questions* du bloc gauche, « Effacer mes convictions » en bas de celui du bloc droit, en rouge « danger » comme aujourd'hui. Effacer reflouté la suggestion.
- **Rappel des réponses** (`RecapReponses`, avec « Non répondu ») et **bandeau de pertinence** (`BandeauPertinence`, « calcul fondé sur… ») ne survivent pas comme blocs : la ligne d'explication du bloc central et le décompte des barres les remplacent ; la grille « Voir toutes les questions d'un coup » du pas à pas garde l'accès à toutes les réponses.
- **Dénominateur du pourcentage** : la file des questions visibles du moment (les conditionnelles n'y comptent que si elles sont posées) + les sujets de convictions proposés ; il peut donc varier légèrement d'une réponse à l'autre. Arrondi à l'entier, jamais 100 % tant qu'il reste une question sans réponse.
- **Onglets indépendants à l'état révélé** (voir plus haut) : interprétation de « il suffit de cliquer sur son onglet voisin ».
- **Textes de la modale de confirmation** et de la ligne d'explication.

## Laissé au builder

- Découpage en composants, nom du composant de l'écran, structure CSS (grille 3 colonnes ≈ 1fr / 1.1fr / 1fr).
- Forme de l'ouverture de « Voir les mesures adaptées » et du pas à pas à l'intérieur de la zone gauche (inline, volet, plein écran avec retour).
- Rendu de l'anneau (SVG), dimensions, transitions.
- Où loger l'ancienne `Etapes`, `NavEtape`, `IntroEtape` (supprimer ce qui devient mort).
- Mots exacts des textes, hors ceux fixés ici (« Mon candidat idéal », « Révéler », « Revenir aux questions », « Questions », « Candidats », « Commencer / Continuer »).

## Maquettes de référence

Visual Companion, dossier `.superpowers/brainstorm/` (git-ignoré) : `parcours-a-b-c.html` (3 pistes), `parcours-b-etats.html`, `parcours-b-precision.html`, `parcours-b-v4.html`, `parcours-b-onglets.html`, `parcours-b-revele.html` (dernier état validé).
