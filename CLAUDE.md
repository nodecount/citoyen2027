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
     traitement spécifique aux propriétaires et que le citoyen n'est pas propriétaire.
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
4. **Quand le moteur n'est pas sûr que le visiteur soit concerné** (réponse manquante sur un critère de l'effet, ou public
   que le formulaire ne sait pas encore décrire), l'indicateur est **« mixte »**, marqué « à préciser », avec l'explication et
   la liste des questions qui lèveraient le doute. Ce n'est pas un jugement sur les mesures : c'est l'incertitude affichée.
   Un « mixte » réel (mesures favorables ET défavorables) reste distinct (`Projection.incertain`).
Garde-fous de l'indicateur (ils découlent du principe d'indépendance ci-dessous) :
- Il mesure l'effet sur **la situation matérielle et les droits du citoyen** (revenu, coûts, accès,
  droits), jamais un jugement de valeur sur la politique elle-même. Le « sens » (favorable ou
  défavorable) est fixé par une table de règles dans le code, jamais par le modèle d'ingestion.
- Il est produit par des **règles explicites, documentées et reproductibles** à partir de données
  structurées et sourcées (cibles et sens de l'effet de chaque mesure, avec l'extrait de source qui
  le fonde), pas par un modèle opaque.
- **Pas de score global inter-thèmes, pas de classement de candidats.** L'indicateur reste par
  thème ; l'ordre d'affichage reste alphabétique ; la même méthode s'applique à tous les candidats.
- Effets de premier ordre uniquement : ce que la mesure fait directement au citoyen, pas des
  conséquences macroéconomiques spéculées.
- Toute hypothèse est affichée (mesure imprécise, chiffrage absent, effet dépendant de détails non
  publiés) ; à défaut de pouvoir trancher, on ne devine pas.
- **Mieux vaut pas d'indicateur qu'un mauvais indicateur.** Quand le programme est trop vague pour
  fixer dans quel sens l'effet joue, ou qu'aucune mesure n'a d'effet déterminable, on n'affiche pas de badge : le
  prompt d'ingestion doit être cadré pour produire une réponse ciblée ou rien, jamais une réponse approximative.
  (Quand c'est le fait que le visiteur soit concerné qui est incertain, on affiche « mixte à préciser », voir plus haut.)
- Le formulaire est construit **à partir des critères (cibles) réellement présents dans les programmes** (catalogue
  `data/profils-schema.json`, qui alimente aussi les prompts d'ingestion). Pas de texte libre que le moteur ne sait
  pas apparier (région et secteur retirés) : collecter le minimum nécessaire. Réponses multiples possibles.
- **Données sensibles : sur consentement explicite du citoyen, seulement si nécessaires à
  l'indicateur.** C'est le citoyen qui décide de les donner (champ facultatif, finalité expliquée
  au moment de la question) ; elles servent le calcul dans son navigateur et ne sont ni transmises
  ni conservées. Les questions sensibles ne s'affichent qu'après une case d'accord explicite, chacune explique sa
  finalité, et décocher l'accord efface les réponses. Une question non répondue n'équivaut **pas** à « non » : les
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

## Architecture cible (à discuter/ajuster avec l'utilisateur avant de coder)

Proposition de structure, à valider :

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
  /profils-schema.json    # schéma des champs de profil utilisateur (commun à toutes les bases)

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
1. **Ne jamais introduire de biais implicite** : formulations, ordre d'affichage (alphabétique par défaut, jamais par indicateur), poids des thèmes — tout doit rester équilibré entre candidats.
2. **Toute donnée de programme ajoutée doit avoir ses sources citées dans le fichier de données**, jamais codée en dur dans la logique applicative sans traçabilité.
3. **Le moteur de calcul doit être transparent** : privilégier des règles explicites et lisibles (if/formules documentées) plutôt qu'un modèle boîte noire, pour que chaque utilisateur puisse comprendre pourquoi tel impact est projeté.
4. **Pas de scraping de sites non autorisés** : vérifier les conditions d'utilisation avant toute extraction automatisée de données depuis des sites tiers (Komune, Pourquituvotes, etc.). Privilégier les sources officielles (programmes publiés en PDF/HTML par les candidats, Légifrance, data.gouv.fr) ou un partenariat explicite.
5. **Statut des programmes** : certains candidats n'ont pas encore publié de programme complet à cette date — le prévoir dans le modèle de données (champ de statut "provisoire / partiel / complet") plutôt que de combler les trous avec des suppositions.
6. **Stack technique** : à définir avec l'utilisateur (pas encore fixée à ce stade — ne pas présumer d'un framework sans lui demander).

## État actuel du projet

Le schéma de données, le moteur de calcul (`src/engine/`) et l'interface (`src/ui/`, React/Vite/TypeScript) sont construits et fonctionnels. `data/themes.json` compte 12 thèmes, tous projetables sur la situation d'un citoyen (les sujets à effet indirect — dette, diplomatie/défense/Europe — ont été volontairement écartés) : 11 peuplés de données réelles et sourcées pour les trois candidats (Le Pen, Mélenchon, Philippe), soit 71 propositions au total, et « retraites » encore « provisoire » — voir `docs/methodologie.md` pour les règles de sourçage appliquées et l'exception documentée sur deux thèmes du dossier Philippe. Ces données n'ont toutefois pas encore été relues ni validées par le porteur du projet. **Statut des 71 propositions existantes (décision du 2026-09-24) :** collectées à la main avant le pipeline, avec l'ancienne méthode (sources secondaires acceptées : ~107 sources secondaires, 52 propositions sur 71 sans deux sources officielles, 6 sans aucune). Elles ne passeraient pas les contrôles du nouveau pipeline (sources officielles et institutionnelles uniquement) et n'ont ni `effets` ni sources « nom · année ». **On les garde telles quelles jusqu'au premier résultat du nouveau pipeline sur un candidat, puis on compare et on remplace les trois candidats d'un coup** (ne pas les supprimer avant, le site n'aurait plus de données). Sans `effets`, elles n'ont pas de badge de projection.

Prochaines étapes probables :
- **Combler l'écart avec le fil rouge produit** : le modèle de données actuel (propositions avec `resume_factuel`) ne porte encore ni la synthèse par candidat × thème, ni les données structurées (cibles et sens de l'effet) dont l'indicateur améliorant/neutre/dégradant a besoin ; le moteur ne produit qu'un impact « concerné / qualitatif ». Le prompt d'ingestion et l'UI (cards par thème) sont à étendre en conséquence — voir `docs/superpowers/specs/2026-09-24-fil-rouge-themes-projection-design.md`.
- Faire relire et valider le contenu par le porteur du projet (exactitude factuelle, neutralité du ton, cohérence entre candidats)
- Poursuivre l'audit de l'application uniforme de la convention `resume_factuel` / `hypotheses_calcul` (suivi déjà noté dans `docs/methodologie.md`)
- Le pipeline d'ingestion (`src/ingestion/`) est construit : génération + vérification
  adversariale via l'API Claude, restreinte au domaine officiel de chaque candidat (voir
  `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md` et
  `src/ingestion/README.md`). Le lot pilote (Attal, Glucksmann, Retailleau, Ruffin, Faure) reste
  à exécuter et à valider manuellement avant d'étendre aux candidats restants.
- Élargir la couverture (compléter les exceptions documentées si une meilleure source apparaît, ajouter d'autres candidats le cas échéant)
