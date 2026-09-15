# Révision de la taxonomie des thèmes + collecte des thèmes restants — Design

Date : 2026-09-16
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte et objectif

Le prototype couvre à ce jour 8 thèmes déclarés dans `data/themes.json`, dont seuls `fiscalite` et `pouvoir-achat` sont peuplés de propositions réelles (voir `docs/superpowers/specs/2026-09-14-simulateur-prototype-design.md`). Les 6 thèmes restants (`travail`, `liberte`, `aides-etat`, `liberte-expression`, `liberte-politique`, `succession`) avaient été choisis lors de la toute première session de cadrage, sans base factuelle — un premier brainstorm, pas une recherche.

Avant de lancer la collecte de données sur ces thèmes, l'utilisateur a demandé de vérifier leur pertinence par rapport aux vrais sujets sur lesquels les citoyens jugent les candidats en 2026, en s'appuyant sur des faits (sondages, couverture médiatique et politique) plutôt que sur l'intuition de départ.

## Constat factuel (recherche menée le 2026-09-16)

Sources : Ipsos ("Ce qui préoccupe les Français", juillet/août 2026), baromètre IFOP Fiducial (rentrée 2026), CEVIPOF (Sciences Po).

- IFOP (rentrée 2026) : Santé 86 %, prix/inflation 78 %, Éducation 75 %, salaires/pouvoir d'achat 70 %, sécurité/délinquance 69 %, trafics de drogue 63 %, environnement/climat 64 % (+19 points en un an).
- Ipsos BVA (état des lieux présidentielle 2027) : pouvoir d'achat 46 %, sécurité 30 %, services publics 30 %, situation budgétaire 28 %, immigration 27 %, environnement 20 %, crises internationales 9 %.
- Ipsos (juillet/août 2026, cinq préoccupations majeures) : criminalité/violence, inflation, pauvreté/inégalités, impôts, flux migratoires ; changement climatique et système de santé apparaissent aussi selon les vagues.

**Constat** : aucun des thèmes santé, sécurité, immigration, éducation, environnement ou logement n'existait dans la taxonomie de départ, alors que ce sont des priorités citoyennes de premier plan et constantes. À l'inverse, 3 des 6 thèmes non peuplés (`liberte`, `liberte-expression`, `liberte-politique`) couvrent un seul et même grand domaine (libertés civiles et démocratiques) sans qu'aucun n'apparaisse comme une préoccupation citoyenne spontanée dans ces sondages (ce qui ne les rend pas sans intérêt pour juger les candidats sur le plan démocratique, mais justifie un seul thème plutôt que trois). `succession` est un sujet fiscal pointu, pas une préoccupation citoyenne autonome.

Note de neutralité : la source Komune Media (déjà citée dans `CLAUDE.md` comme référence méthodologique) écarte délibérément, pour des raisons éditoriales propres, l'immigration et la sécurité de sa grille de thèmes au motif qu'elles seraient « sur-représentées dans les médias ». Adopter ce choix aurait constitué un biais éditorial equivalent et opposé à celui qu'on cherche à éviter. Ce document s'appuie donc uniquement sur des données d'enquête neutres (ce que les citoyens déclarent eux-mêmes comme préoccupation), pas sur le filtrage éditorial d'un média, aussi indépendant soit-il.

## Décision actée avec l'utilisateur

### Thèmes déjà peuplés (inchangés)
`fiscalite`, `pouvoir-achat`.

### Thèmes conservés tels quels
`travail` (« Droit du travail, chômage, retraite, conditions d'emploi »), `aides-etat` (« Prestations sociales, allocations, aides ciblées »).

### Thème fusionné
`liberte` + `liberte-expression` + `liberte-politique` → un seul thème `libertes-fondamentales` (« Libertés civiles, liberté d'expression et de la presse, droit de vote et pluralisme politique »).

### Thème retiré (redevient une proposition possible, pas un thème)
`succession` — aucune proposition n'existe encore sur ce thème (aucune donnée à migrer), il est simplement supprimé de `themes.json`. Une future proposition sur les droits de succession serait classée sous `fiscalite`.

### Thèmes ajoutés (fondés sur le constat factuel ci-dessus)
- `sante` — « Santé » — « Système de santé, hôpital, accès aux soins, assurance maladie. »
- `securite` — « Sécurité » — « Sécurité intérieure, délinquance, police, justice pénale. »
- `immigration` — « Immigration » — « Politique migratoire, droit d'asile, intégration. »
- `education` — « Éducation » — « École, enseignement supérieur, formation. »
- `environnement` — « Environnement » — « Climat, transition écologique, politique environnementale. »
- `logement` — « Logement » — « Accès au logement, construction, aides au logement, urbanisme. »

### Résultat
11 thèmes au total (contre 8), 9 à peupler (contre 6) : `travail`, `aides-etat`, `libertes-fondamentales`, `sante`, `securite`, `immigration`, `education`, `environnement`, `logement`.

## Impact technique

- `data/themes.json` : passe de 8 à 11 entrées. `statut: "populated"` reste réservé à `fiscalite`/`pouvoir-achat` ; les 9 autres restent `"provisoire"` jusqu'à leur collecte.
- `src/types.ts` : aucun changement de structure (le type `Theme` reste `{ id, libelle, description, statut }`).
- `src/data/schema.test.ts` : la constante `THEME_IDS` (actuellement codée en dur avec les 8 anciens ids) doit être mise à jour avec les 11 nouveaux ids.
- `src/data/candidats.test.ts` : aucun changement structurel nécessaire — `THEME_IDS` y est déjà dérivé dynamiquement de `themes.json`. `THEMES_PEUPLES` reste `["fiscalite", "pouvoir-achat"]` tant que la nouvelle collecte n'est pas terminée.
- Aucune proposition existante ne référence `liberte`, `liberte-expression`, `liberte-politique` ou `succession` (thèmes jamais peuplés) — aucune donnée à migrer, la suppression/fusion est sans risque de perte.
- `src/engine/`, `src/ui/` : aucun changement nécessaire — tout itère dynamiquement sur `themes.json`, rien ne code en dur l'ancienne liste de 8 thèmes.

## Portée de la collecte à venir (sous-projet séparé)

Pour chacun des 9 thèmes ci-dessus, et pour chacun des 3 candidats (Marine Le Pen, Jean-Luc Mélenchon, Édouard Philippe), au moins 2 propositions au statut `"complet"`, avec le même niveau de rigueur de sourçage que la collecte précédente (`docs/methodologie.md` : ≥2 sources dont ≥1 primaire, sources partisanes/militantes labellisées, `hypotheses_calcul` documenté, `resume_factuel` neutre).

Découpage en tâches : 3 groupes de 3 thèmes, par candidat (3 groupes × 3 candidats = 9 tâches, même volume que la collecte précédente relative au nombre de tâches) :
- Groupe A : Santé, Sécurité, Immigration
- Groupe B : Éducation, Environnement, Logement
- Groupe C : Travail, Aides de l'État, Libertés fondamentales

## Hors scope

- Le moteur de calcul et l'UI ne sont pas modifiés dans ce sous-projet (ils itèrent déjà dynamiquement sur les thèmes déclarés) — seule la donnée change. Une future extension pourra ajouter des règles d'éligibilité pour les nouvelles propositions, mais ce n'est pas demandé ici : par défaut, toute nouvelle proposition utilise le comportement universel/qualitatif déjà en place.
- Aucune modification des candidats couverts (toujours Le Pen, Mélenchon, Philippe).

## Prochaine étape

Passage au skill `writing-plans` pour deux plans successifs : (1) petite révision du schéma des thèmes, (2) collecte de données sur les 9 thèmes × 3 candidats.
