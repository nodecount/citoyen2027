# Méthodologie — règles de sourçage et de neutralité

Ce document reprend les standards déjà appliqués dans les fiches de `data/bases/officielle/programmes/`,
tels qu'établis en cours de collecte. Il documente une pratique existante ; ce n'est pas
une nouvelle politique.

## Sources primaires vs secondaires

Une source **primaire** est une propriété officielle de campagne du candidat, un document
officiel du parti, ou un document officiel/légal (compte rendu de vote parlementaire, texte
de loi, Légifrance). Ce n'est **jamais** une retranscription tierce, un site de fans, un
agrégateur ou un comparateur, aussi fidèle son contenu soit-il — même s'il reproduit le
programme mot pour mot.

En cas de doute, toujours vérifier la page « À propos » / mentions légales / pied de page
du site en question. C'est exactement cette vérification qui a permis d'identifier que
`laec.fr` (site tiers développé par une équipe indépendante du Discord Insoumis, qui précise
lui-même ne pas engager l'Union populaire) n'est pas une source primaire malgré son contenu
fidèle, et que l'Institut Montaigne, malgré son sérieux, reste un tiers analystique et non
une source officielle du candidat.

## Sources partisanes / militantes

Une source dont l'orientation politique ou militante est connue (média affilié à un parti,
association de plaidoyer, think tank à l'orientation affichée) peut être citée comme source
**secondaire**, mais son orientation doit être systématiquement indiquée dans son champ
`label` — de façon identique pour tous les candidats, sans exception. Exemples déjà en place :
« L'Insoumission (média affilié à La France Insoumise) » pour Mélenchon, « Fondation iFRAP
(think tank généralement associé à une orientation favorable à la baisse de la dépense
publique) » et « Contribuables Associés (association militante anti-fiscalité...) » pour
Philippe.

## `resume_factuel` vs `hypotheses_calcul`

- `resume_factuel` énonce ce que propose le candidat et ce que les sources consultées
  laissent non précisé (mécanisme, montant, calendrier...).
- `hypotheses_calcul` est l'endroit où figurent les chiffrages, la contestation de ces
  chiffrages par d'autres acteurs, et les réserves de faisabilité ou de conformité légale.

**Suivi connu :** un audit complet de l'application uniforme de cette convention sur
l'ensemble des données existantes des trois candidats reste à faire ; il n'a pas encore
été réalisé à ce jour.

## Le champ `statut`

`statut` (`"complet" | "partiel" | "provisoire"`) qualifie l'état de la **fiche elle-même**
— la qualité et l'exhaustivité de la recherche et du sourçage menés — et non l'état du
programme ou de la mesure du candidat. Une fiche peut être `"complet"` même si le programme
sous-jacent reste flou ou non chiffré, dès lors que cette imprécision est honnêtement
documentée et correctement sourcée (par exemple : « le site officiel ne précise pas de
mécanisme », avec la source à l'appui). À l'inverse, `"partiel"` ou `"provisoire"` signalent
un travail de recherche lui-même inachevé (sources manquantes, vérification à compléter),
indépendamment du degré de précision du programme rapporté.

## Exception documentée : thèmes Philippe à un seul « complet »

La règle de qualité habituelle du projet vise au moins deux propositions `"complet"` par
thème et par candidat. Deux thèmes du dossier Édouard Philippe dérogent à cette règle de
façon assumée et documentée plutôt que silencieuse : `aides-etat` et
`libertes-fondamentales` ne comptent chacun qu'une seule proposition `"complet"` (plus une
proposition `"partiel"`). Dans les deux cas, après recherche diligente, aucune seconde
mesure n'a pu être corroborée par une source indépendante du candidat et de son parti — les
seules sources disponibles au-delà du site de campagne étaient le Manifeste d'Horizons
lui-même, c'est-à-dire une source de la même organisation, insuffisante pour satisfaire la
même rigueur de sourçage que les fiches `"complet"` des autres thèmes. C'est une exception
acceptée et documentée (voir `src/data/candidats.test.ts`, `EXCEPTIONS_UN_SEUL_COMPLET`),
non un oubli ; elle reste à revisiter lors d'un futur passage de recherche, si un accès plus
large permet d'identifier une corroboration indépendante ou une seconde mesure réellement
distincte pour ces deux thèmes chez ce candidat.

## Le moteur

Par défaut (`evaluerParDefaut`), le moteur traite toute proposition comme universelle et
qualitative : il relaie le `resume_factuel` tel quel, et, si un chiffrage existe, l'ajoute
avec un avertissement explicite que c'est un chiffrage macro (coût ou gain au niveau
national) et non un montant par ménage — jamais un chiffre inventé et personnalisé.

Une proposition ne reçoit une règle d'éligibilité dédiée (`src/engine/regles.ts`) que si une
condition est réellement déterminable à partir des champs actuels du profil (âge, statut
professionnel, tranche de revenus, tranche de patrimoine...). Toutes les autres propositions
restent sur le comportement par défaut ci-dessus ; ce n'est pas un oubli mais une limite de
granularité du profil, à combler au fur et à mesure.

Quand une règle ne teste qu'une partie d'une proposition composée de plusieurs volets
(exemple : une mesure qui combine un volet fiscal chiffrable et un volet non chiffrable), son
texte « non concerné » doit être scopé à ce volet précis — jamais affirmer que la mesure dans
son ensemble ne s'applique pas au profil, ce qui serait factuellement faux pour les volets non
testés.

## Axe « Convictions » (2026-09-29)

Axe séparé de l'indicateur « Ma situation » : aucun score, aucun classement, aucune moyenne entre axes.

- **Valeurs sociales** : le visiteur choisit des groupes ; le catalogue (`src/convictions.ts`) est **généré depuis le
  schéma du formulaire**, une entrée par option de chaque champ retenu (statut, âge, revenus, logement, territoire, métier,
  enfants, handicap) : jamais de liste choisie à la main, aucun public mis en avant. Le constat par thème
  (`src/engine/convictions.ts`) applique la même table de polarité que l'indicateur principal, **groupe par groupe**
  (jamais une union), avec l'explication des mesures retenues. Un effet est :
  « visé » s'il cible tout le monde, ou si tous ses critères sur le champ du groupe recoupent au moins une valeur du
  groupe (les critères sur d'autres champs ne bloquent pas : portée partielle assumée) ; « exclu » s'il cible le champ
  du groupe sans le recouper ; « incertain » s'il ne dit rien du champ (autre champ, critère « autre »). Les effets
  incertains ne sont pas comptés, sont signalés à part, et ne produisent **jamais** « non concerné » : « non concerné »
  exige que tous les effets soient exclus avec certitude. Sans effet structuré : « pas d'indicateur ».
- **Intégrité** : `data/integrite/<slug>.json`. Condamnations **définitives** seulement (ni mise en examen, ni enquête, ni
  première instance en appel). Chaque condamnation : nature, juridiction, date de décision, peine, et **au moins deux
  sources dont une primaire**. « Aucune condamnation recensée » n'est affiché que si `verifie_le` et
  `sources_consultees` sont renseignés, et se dit toujours « d'après les sources consultées le <date> ». **Sans fichier
  valide : « non vérifié »**, jamais « aucune condamnation ».
- Mêmes règles pour tous les candidats. Aucune donnée n'est saisie sans source relue par le porteur du projet. Les
  condamnations effacées (amnistie, réhabilitation) sont à traiter selon un avis juridique avant publication.
- Mode aveugle : les faits d'intégrité ne s'affichent pas (un casier identifie le candidat). Le simulateur étant toujours à
  l'aveugle, ils ne servent qu'à écarter des candidats du résultat « convictions » de la card « candidat idéal ».

## Card « candidat idéal » (2026-09-30)

Seul endroit du produit où un candidat est désigné, par exception au principe « pas de classement » (voir CLAUDE.md).

- **Règle** (`src/engine/candidatIdeal.ts`) : solde = nombre de thèmes « améliorant » moins nombre de thèmes « dégradant » pour le
  visiteur ; « mixte », « non concerné » et l'absence d'indicateur comptent zéro ; aucune pondération. Pour les convictions, le
  solde porte sur les constats (groupe choisi × thème). Les deux résultats sont séparés et peuvent désigner des candidats différents.
- **Limites dites au visiteur** : le solde compense un thème par un autre (choix assumé) et dépend du nombre d'indicateurs
  disponibles ; la couverture (« sur N thèmes analysés ») est toujours affichée.
- **Égalités** : tous les ex æquo, jamais départagés par l'ordre alphabétique. Un candidat sans aucun indicateur n'est pas
  éligible : sans données, il gagnerait par absence de mesures dégradantes.
- **Intégrité** : un candidat à condamnation définitive **recensée** est écarté du résultat convictions quand le visiteur tient
  à un candidat « sans condamnation définitive » ; le nombre d'écartés est indiqué, pas leur identité tant que la card est
  floutée. Un candidat « non vérifié » n'est pas écarté.
- **Identité** : tant que la card est floutée, ni le nom, ni le slug, ni la photo ne sont dans la page (le flou CSS n'est pas la
  protection).
