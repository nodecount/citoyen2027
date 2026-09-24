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
  fixer qui est visé ou dans quel sens l'effet joue, on n'affiche pas de badge : le prompt
  d'ingestion doit être cadré pour produire une réponse ciblée ou rien, jamais une réponse
  approximative.
- Le formulaire citoyen sera affiné **après** les premiers résultats d'ingestion, pour orienter les
  questions posées à partir des critères (cibles) réellement présents dans les programmes.
- **Données sensibles : sur consentement explicite du citoyen, seulement si nécessaires à
  l'indicateur.** C'est le citoyen qui décide de les donner (champ facultatif, finalité expliquée
  au moment de la question) ; elles servent le calcul dans son navigateur et ne sont ni transmises
  ni conservées. Une question non répondue n'équivaut **pas** à « non » : les effets qui en
  dépendent n'ont alors pas de badge, avec l'invitation à renseigner le champ pour affiner.

**Principe fondateur — INDÉPENDANCE ET NEUTRALITÉ :** C'est la contrainte la plus importante du projet. L'outil ne doit être affilié à aucun parti, ni directement ni indirectement. Concrètement, cela implique :
- Ne jamais utiliser un simulateur ou un jeu de données produit par un parti ou une organisation partisane (ex : les simulateurs internes que certains candidats ou partis publient sur leur propre programme) comme source de vérité, même comme point de départ technique.
- Pour chaque proposition intégrée, toujours viser au moins deux sources, dont une source primaire (le programme officiel du candidat/parti, un texte de loi, une déclaration officielle), inspirées de la rigueur méthodologique observée chez des initiatives comme Komune Media.
- Présenter les propositions de façon factuelle et juxtaposée, sans commentaire de valeur ni classement moral. L'indicateur de projection par thème (voir « Fil rouge produit ») est autorisé parce qu'il est défini par des règles explicites et appliqué identiquement à tous ; en revanche, aucun score global ni classement de candidats, et aucun indicateur implicite ou non documenté.
- Documenter systématiquement les hypothèses de calcul quand une proposition est vague ou incomplète (ex : "aucun chiffrage précis publié, estimation basée sur X").
- Traiter tous les candidats déclarés avec le même niveau d'exigence et de détail, même si leurs programmes ne sont pas tous publiés au même degré de précision.

## Ce qui existe déjà sur le marché (contexte de veille, ne pas dupliquer bêtement)

- **Komune Media** (komunemedia.fr) — comparateur sourcé, exigence de sources primaires, approche éditoriale indépendante. Bonne référence méthodologique.
- **Pourquituvotes.fr** — comparateur thématique de programmes (actuellement centré municipales 2026), pas de simulateur d'impact personnel.
- **ÉlyséeScope** (elyseescope.com) — agrégation de sondages + comparaison position par position, classement alphabétique pour neutralité.
- **Ça change quoi** (cachangequoi.fr) — simulateur d'impact personnel, mais **produit par LFI** → à étudier uniquement pour la mécanique UX, jamais comme source de données ou de calcul.
- **Simulateur Lisnard 2027** — même remarque, outil de campagne d'un candidat, à ne pas utiliser comme référence de calcul.
- **Fondapol "Qui en 2027 ?"** — simulateur de scénarios électoraux (sondages), pas d'impact personnel.
- **Candidator, MonVote2027, Prési2027, politiquement.org** — quiz de matching candidat/convictions, pas des simulateurs d'impact.

**Constat :** aucun outil identifié à ce jour ne combine (a) profil personnel détaillé, (b) plusieurs candidats en parallèle, (c) impact chiffré par catégorie de vie, (d) indépendance vis-à-vis des partis. C'est le créneau du projet.

## Architecture cible (à discuter/ajuster avec l'utilisateur avant de coder)

Proposition de structure, à valider :

```
/data
  /programmes
    <candidat_slug>/
      meta.json          # nom, parti, sources officielles, date de dernière maj
      propositions.json  # liste de propositions structurées par thème
  /themes.json            # référentiel des catégories (fiscalité, travail, logement, santé, droits...)
  /profils-schema.json    # schéma des champs de profil utilisateur

/src
  /engine        # moteur de calcul : profil + proposition -> impact estimé
  /ui            # interface (formulaire profil + affichage résultats)
  /ingestion     # scripts d'extraction/mise à jour des programmes depuis sources officielles

/docs
  methodologie.md   # règles de sourçage, règles de neutralité, processus de mise à jour
```

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

Le schéma de données, le moteur de calcul (`src/engine/`) et l'interface (`src/ui/`, React/Vite/TypeScript) sont construits et fonctionnels. `data/themes.json` compte 12 thèmes, tous projetables sur la situation d'un citoyen (les sujets à effet indirect — dette, diplomatie/défense/Europe — ont été volontairement écartés) : 11 peuplés de données réelles et sourcées pour les trois candidats (Le Pen, Mélenchon, Philippe), soit 71 propositions au total, et « retraites » encore « provisoire » — voir `docs/methodologie.md` pour les règles de sourçage appliquées et l'exception documentée sur deux thèmes du dossier Philippe. Ces données n'ont toutefois pas encore été relues ni validées par le porteur du projet. Prochaines étapes probables :
- **Combler l'écart avec le fil rouge produit** : le modèle de données actuel (propositions avec `resume_factuel`) ne porte encore ni la synthèse par candidat × thème, ni les données structurées (cibles et sens de l'effet) dont l'indicateur améliorant/neutre/dégradant a besoin ; le moteur ne produit qu'un impact « concerné / qualitatif ». Le prompt d'ingestion et l'UI (cards par thème) sont à étendre en conséquence — voir `docs/superpowers/specs/2026-09-24-fil-rouge-themes-projection-design.md`.
- Faire relire et valider le contenu par le porteur du projet (exactitude factuelle, neutralité du ton, cohérence entre candidats)
- Poursuivre l'audit de l'application uniforme de la convention `resume_factuel` / `hypotheses_calcul` (suivi déjà noté dans `docs/methodologie.md`)
- Le pipeline d'ingestion (`src/ingestion/`) est construit : génération + vérification
  adversariale via l'API Claude, restreinte au domaine officiel de chaque candidat (voir
  `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md` et
  `src/ingestion/README.md`). Le lot pilote (Attal, Glucksmann, Retailleau, Ruffin, Faure) reste
  à exécuter et à valider manuellement avant d'étendre aux candidats restants.
- Élargir la couverture (compléter les exceptions documentées si une meilleure source apparaît, ajouter d'autres candidats le cas échéant)
