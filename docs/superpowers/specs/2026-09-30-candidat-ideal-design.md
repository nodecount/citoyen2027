# « Candidat idéal » — simulateur à l'aveugle par défaut — design

Date : 2026-09-30. Statut : à relire par le porteur du projet.

## Intention (dite par le porteur du projet, 2026-09-30)

En mode simulateur, les candidats sont **masqués par défaut, sans interrupteur** : on reste à l'aveugle. En haut des
cards thématiques, une **card floutée** préaffiche l'identité du candidat qui ressort, collée à un **bandeau bleu** (style
de l'accueil). Un bouton **« Révéler mon programme de candidat idéal pour 2027 »** défloute la card : vrai nom, vrai
portrait à la place du portrait impersonnel ; le formulaire disparaît. Un bouton **« Recommencer la simulation »** réapparaît
alors, sans vider les réponses.

## Décisions (2026-09-30)

1. **Le classement est désormais autorisé, dans cette seule card.** CLAUDE.md interdisait tout score global et tout
   classement de candidats ; cette règle est amendée : la seule exception est la card « candidat idéal », pas les cards de
   thèmes, pas le tiroir de portraits.
2. **Règle du « meilleur » : solde.** Pour un candidat, solde = (nombre de thèmes « améliorant ») − (nombre de thèmes
   « dégradant »). « Mixte », « non concerné » et « sans indicateur » comptent zéro. **Aucune pondération entre thèmes.**
   Règle affichée sous la card, identique pour tous.
3. **Toujours désigner un candidat**, même sur des données minces. Une **égalité** n'est jamais tranchée par ordre
   alphabétique (cela avantagerait certains) : tous les ex æquo sont montrés.
4. **Deux résultats séparés** dans la card, car l'axe « Convictions » reste distinct de « Ma situation » : ils peuvent
   désigner des candidats différents, et c'est voulu.

## Comportement

### Masquage par défaut

- Mode « Simuler pour moi » : candidats toujours anonymisés (`src/ui/aveugle.ts`, existant). Suppression de
  l'interrupteur « Afficher les candidats », de sa mémoire (`lireAveugle`/`memoriserAveugle`) et de « Qui était qui ? ».
- Mode « Explorer les mesures » : noms et portraits visibles (on explore des programmes, pas une situation).
- Les cards de thèmes **restent masquées après la révélation** ; seule la card idéale montre l'identité.
- Lettres tirées au sort à chaque entrée en simulateur et à chaque « Recommencer », stables d'un thème à l'autre.

### Card « candidat idéal »

Affichée en haut de la grille de thèmes, **seulement quand des indicateurs existent** (formulaire général validé avec au
moins une réponse). Avant, le bandeau existant « Renseignez des informations » suffit.

Deux blocs, dans le style des `div.detail` des cards thématiques :

| Bloc | Solde calculé sur |
|---|---|
| **Selon votre situation** | indicateurs « Ma situation » de chaque thème |
| **Selon vos convictions** | constats « valeurs sociales » de chaque groupe choisi × chaque thème |

Le bloc convictions n'existe que si le visiteur a choisi au moins un groupe ; sinon il est omis (pas de résultat inventé).

- **État flouté** : nom et portrait remplacés par la lettre du candidat (« Candidat C ») ; le texte est flouté (CSS
  `filter: blur`), avec `aria-hidden` sur le contenu flouté et un libellé accessible « identité masquée » (le flou ne
  doit jamais être la seule protection : le nom réel n'est pas dans le DOM tant que la card n'est pas révélée).
- **Bandeau bleu** (`bandeau-accueil`, variante compacte) accolé : « Cette card contient le meilleur programme selon votre
  situation et le meilleur programme selon vos convictions. Votre résultat peut être affiné si vous répondez aux **X**
  questions propres aux thèmes, directement dans ceux-ci. » `X` = nombre de questions de thème non répondues
  (`questionsDuTheme(...)` non `estRepondue`), tous thèmes confondus. Puis le bouton « Révéler mon programme de candidat
  idéal pour 2027 ».
- **État révélé** : nom, parti, vrai portrait (`Pastille` avec le slug réel), et la lettre (« C = Nom ») pour retrouver le
  candidat dans les cards de thèmes masquées. Pour chaque résultat : le solde et le nombre de thèmes sur lesquels il repose
  (« 3 thèmes améliorants, 1 dégradant, sur 7 analysés »). Le formulaire général et le bloc convictions sont retirés. Un
  bouton « Recommencer la simulation » remet la card floutée, réaffiche le formulaire, **sans effacer** les réponses ni les
  convictions.
- **Égalité** : « N candidats à égalité » avec tous les noms (révélés) ; floutés, la card indique seulement le nombre. Si
  tous les candidats sont à égalité à zéro (aucun indicateur), la card le dit — « les données ne permettent pas de
  départager les candidats » — au lieu de lister tout le monde.
- **Intégrité** : si « sans condamnation définitive » est coché, un candidat dont le constat est « condamnation définitive
  recensée » est **écarté du résultat convictions**, et la card le dit (« N candidat(s) écarté(s) : condamnation
  définitive recensée »). Un candidat « non vérifié » n'est pas écarté. Sans donnée saisie, cette règle ne joue pas.
- **Sous la card** : la règle en une ligne (« Solde = thèmes améliorants moins thèmes dégradants pour vous. Aucune
  pondération. ») et la mention de la couverture des données.

## Garde-fous (à écrire dans CLAUDE.md et `docs/methodologie.md`)

- Le classement n'existe que dans la card « candidat idéal » ; les cards de thèmes et le tiroir n'ont ni score ni ordre par
  indicateur.
- Même règle pour tous les candidats, publique, sans poids de thème.
- Le solde compense un thème par un autre : c'est un choix assumé du porteur du projet, dit sous la card.
- Un solde repose sur peu de données quand peu de thèmes ont un indicateur : la couverture est toujours affichée.
- Mode exploration : aucune card idéale.

## Architecture

- `src/engine/candidatIdeal.ts` (nouveau) : `soldeParCandidat(cards)` (situation) et `soldeConvictions(cards, groupes)`,
  `meilleursCandidats(soldes)` → `{ slugs: string[]; solde: number; ameliorants: number; degradants: number; themesAnalyses: number }`.
  Fonctions pures, sans lecture du DOM.
- `src/ui/CardCandidatIdeal.tsx` (nouveau) : card + bandeau + bouton ; état flouté/révélé.
- `src/ui/PageThemes.tsx` : masquage par défaut, suppression de l'interrupteur, état `revele` (booléen, non mémorisé :
  chaque visite recommence floutée), retrait du formulaire quand révélé, bouton « Recommencer ».
- `src/ui/aveugle.ts` : `anonymiserCards` renvoie déjà la correspondance lettre → nom ; elle sert à la card.
- Nombre de questions restantes : calculé dans `PageThemes` avec `questionsDuTheme` et `estRepondue` (existants).
- `src/index.css` : `.carte-ideal`, flou, variante du bandeau bleu. Contraste et focus conformes (14 px minimum) ;
  `prefers-reduced-motion` respecté pour la transition de défloutage.
- Les indicateurs sont lus sur les **cards non anonymisées** (les données réelles) : l'anonymisation ne change pas le
  calcul, seulement l'affichage.

## Tests

- Solde : (améliorants − dégradants), mixte/non concerné/null = 0, aucune pondération.
- Égalité : tous les ex æquo, jamais départagés par l'ordre ; égalité générale à zéro → message « ne permet pas de départager ».
- Situation et convictions peuvent désigner des candidats différents.
- Bloc convictions omis sans groupe choisi ; écart des « condamnation définitive recensée » quand l'option est cochée ;
  un « non vérifié » n'est pas écarté.
- **Flouté** : aucun nom ni slug réel ni URL de portrait dans le rendu tant que la card n'est pas révélée. **Révélé** : nom
  et portrait réels, formulaire retiré, bouton « Recommencer ».
- Recommencer : les réponses et convictions sont intactes.
- Mode exploration : ni card idéale, ni masquage — les noms et les vrais portraits des candidats sont visibles sur les
  cards de thèmes (test : le rendu contient les noms réels et les photos, et aucune lettre « Candidat A »), y compris
  après être passé par le mode simulateur puis être revenu en exploration.
- Interrupteur et « Qui était qui ? » n'existent plus ; simulateur toujours masqué.
- `X` = questions de thème non répondues.

## Hors périmètre

Pondération des thèmes par le visiteur ; classement complet des candidats ; mémorisation de l'état « révélé » ; révéler
les cards de thèmes ; partage du résultat.

## Points ouverts

1. Le portrait « impersonnel » de la card floutée : lettre dans un cercle (comme aujourd'hui) ou silhouette neutre ?
   Recommandation : lettre, cohérent avec le reste.
2. Le solde compense les thèmes ; si vous préférez plus tard « aucun thème dégradant d'abord », c'est un changement d'une
   fonction (`meilleursCandidats`).
