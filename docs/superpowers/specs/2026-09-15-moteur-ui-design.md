# Moteur de calcul et UI — Design

Date : 2026-09-15
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte et objectif

Ce document couvre le **second sous-projet** du simulateur d'impact personnel — Présidentielle 2027. Le premier sous-projet (schéma de données + données réelles, voir `docs/superpowers/specs/2026-09-14-simulateur-prototype-design.md` et son plan) a produit : le scaffolding React/Vite/TypeScript, le schéma de données (`src/types.ts`, `data/themes.json`, `data/profils-schema.json`), et des propositions réelles sourcées pour 3 candidats (Marine Le Pen, Jean-Luc Mélenchon, Édouard Philippe) sur 2 des 8 thèmes déclarés (fiscalité, pouvoir d'achat).

Ce sous-projet ajoute : le moteur de calcul (profil + proposition → impact estimé) et l'interface utilisateur complète (accueil, formulaire de profil, résultats).

## Constat de départ

En reliant les 12 propositions réelles collectées au schéma de profil existant, deux limites sont apparues :
1. La plupart des chiffrages disponibles sont des **coûts macro/nationaux** (ex. « 11,3 Md€/an pour l'État »), pas des impacts par ménage — inventer un montant personnalisé à partir de là serait contraire au principe de neutralité et de rigueur du projet (`CLAUDE.md`).
2. Le schéma de profil actuel ne permet pas de déterminer l'éligibilité à certaines propositions (âge pour l'exonération IR <30 ans de Le Pen, patrimoine pour l'ISF de Mélenchon).

## Décisions actées avec l'utilisateur

- **Stratégie de calcul** : par défaut, une proposition est traitée comme **universelle** (concerne tous les profils), avec un rendu **qualitatif** (texte factuel + chiffrage macro affiché tel quel, jamais attribué faussement au foyer de l'utilisateur). Seules les propositions où l'éligibilité est réellement déterminable à partir du profil ont une règle dédiée qui affine le « concerné / non concerné » et, quand c'est vraiment calculable, un montant personnalisé.
- **Schéma de profil étendu** : ajout de `tranche_age` et `tranche_patrimoine` à `data/profils-schema.json`.
- **UI** : 3 écrans — accueil (récap des 8 thèmes), formulaire de profil, résultats. Fonctionnel et propre, sans travail de direction artistique poussé pour ce prototype.
- **Tests** : tests unitaires sur les fonctions du moteur uniquement ; pas de tests automatisés de composants React pour ce prototype (revue manuelle suffisante, cohérent avec le sous-projet précédent).

## Modèle de profil étendu

Ajouts à `data/profils-schema.json` (même format que les champs existants, `ChampProfil`) :

```json
{ "id": "tranche_age", "label": "Tranche d'âge", "type": "enum", "options": ["moins_30", "30_49", "50_64", "65_plus"] }
```

```json
{ "id": "tranche_patrimoine", "label": "Tranche de patrimoine net", "type": "enum", "options": ["moins_100k", "100k_500k", "500k_1_3m", "plus_1_3m"] }
```

Le seuil `500k_1_3m` / `plus_1_3m` reprend le seuil d'entrée de 1,3 million d'euros utilisé dans le chiffrage de l'ISF (`melenchon-fisc-002`), pour que la tranche soit directement exploitable par la règle d'éligibilité de cette proposition.

`src/types.ts` n'a pas besoin de changer pour ça : `ChampProfil` et le type `Profil` (nouveau, voir plus bas) restent génériques.

## Type `Profil` et type `Impact`

Nouveau dans `src/types.ts` :

```ts
export interface Profil {
  statut_professionnel: string;
  tranche_revenus: string;
  situation_familiale: string;
  nombre_enfants: number;
  logement: string;
  secteur_activite: string;
  region: string;
  tranche_age: string;
  tranche_patrimoine: string;
}

export type NiveauCertitude = "chiffre_personnalise" | "chiffre_macro_seulement" | "qualitatif";

export interface Impact {
  concerne: boolean;
  niveau: NiveauCertitude;
  montant_estime?: number;
  explication: string;
}
```

`montant_estime` n'est présent que si `niveau === "chiffre_personnalise"` — un vrai calcul par ménage, pas une division naïve d'un chiffrage macro.

## Moteur de calcul

Une fonction pure par comportement, pas de moteur de règles générique déclaratif (cohérent avec l'exigence de transparence de `CLAUDE.md`, item 3).

```
/src/engine
  evaluerParDefaut.ts   # universel, qualitatif — le comportement par défaut
  regles.ts              # les ~5 règles d'éligibilité affinée, une fonction par id de proposition concernée
  index.ts                # evaluerProposition(profil, proposition) -> Impact — dispatche vers regles.ts si une règle existe pour cet id, sinon evaluerParDefaut
```

`evaluerParDefaut(profil, proposition) -> Impact` : retourne toujours `concerne: true`, `niveau: "qualitatif"`, et une `explication` construite à partir de `proposition.resume_factuel` et, si `proposition.chiffrage_disponible`, d'une phrase indiquant le chiffrage macro tel quel (ex. « Chiffrage macro (coût pour l'État), non un montant par ménage : … », reprenant `proposition.hypotheses_calcul`) — jamais un montant attribué au foyer.

`regles.ts` couvre, à la date d'écriture du plan, ces propositions (liste à confirmer/ajuster pendant l'implémentation en relisant les données réelles) :
- `le-pen-fisc-002` (exonération IR <30 ans) : `concerne` = `tranche_age === "moins_30"`.
- `le-pen-pa-002` (pensions/ASPA) : `concerne` = `statut_professionnel === "retraite"`.
- `melenchon-fisc-002` (ISF) : `concerne` = `tranche_patrimoine` dans `["500k_1_3m", "plus_1_3m"]` (avec nuance : seul `plus_1_3m` dépasse clairement le seuil, `500k_1_3m` est présenté comme « potentiellement concerné » selon le haut de la tranche).
- `melenchon-pa-001` (SMIC) : `concerne` = `statut_professionnel === "salarie"` ET `tranche_revenus` dans les tranches basses (`moins_1200`, `1200_2000`).
- `philippe-pa-001` (salaire net des actifs) : `concerne` = `statut_professionnel` dans `["salarie", "independant", "fonctionnaire"]`.

Toutes ces fonctions restent `niveau: "qualitatif"` (pas de montant personnalisé inventé) sauf mention contraire décidée pendant l'implémentation si un calcul par ménage s'avère réellement possible et documentable.

`index.ts` exporte `evaluerProposition(profil: Profil, proposition: Proposition): Impact`, utilisé par l'UI pour chaque candidat × thème × proposition `"complet"`.

## UI

Trois écrans, navigation simple (état React local, pas de router nécessaire pour 3 écrans) :

1. **Accueil** — Récapitule les 8 thèmes déclarés (`data/themes.json`), avec leur libellé, description, et statut (« données disponibles » pour fiscalité/pouvoir d'achat, « en cours d'analyse » pour les 6 autres, en utilisant le champ `statut` du thème ajouté au sous-projet précédent). Bouton pour démarrer le formulaire de profil.
2. **Formulaire de profil** — Un champ par entrée de `profils-schema.json` (9 champs après l'extension), validation minimale (tous requis). Bouton pour voir les résultats.
3. **Résultats** — Candidats en ordre alphabétique fixe (Le Pen, Mélenchon, Philippe), thèmes en sections dans l'ordre de `themes.json`. Pour chaque thème :
   - S'il n'y a aucune proposition `"complet"` pour ce candidat sur ce thème (les 6 thèmes non peuplés, dans ce sous-projet), afficher « Programme en cours d'analyse sur ce thème » — jamais masquer la section.
   - Sinon, afficher chaque proposition `"complet"` avec le résultat de `evaluerProposition(profil, proposition)` : le titre, `explication`, et le montant si `niveau === "chiffre_personnalise"`.

CSS simple, pas de bibliothèque de composants, pas de travail de direction artistique pour ce prototype (décision utilisateur).

## Gestion des cas incomplets

Inchangé par rapport au sous-projet précédent : piloté par `statut` (au niveau proposition) et maintenant aussi par le `statut` du thème pour l'écran d'accueil. Aucune valeur inventée.

## Tests

Tests unitaires Vitest sur `src/engine/` : `evaluerParDefaut` (un cas générique, un cas avec chiffrage macro présent) et chaque fonction de `regles.ts` (au moins un profil concerné et un profil non concerné par fonction). Pas de tests de composants React — revue manuelle avec `npm run dev`, plusieurs profils types couvrant les cas d'éligibilité des 5 règles, une fois l'implémentation terminée.

## Hors scope de ce sous-projet

- Les 6 thèmes non peuplés restent non peuplés (aucune nouvelle collecte de données dans ce sous-projet).
- Pas de persistance du profil utilisateur (pas de compte, pas de sauvegarde, pas de partage de résultat).
- Pas de déploiement/hébergement.
- Pas de travail de direction artistique/design visuel poussé (décision utilisateur pour ce prototype).
- Pas de routing/URL dédiée par écran (état local suffit pour 3 écrans linéaires).

## Piste future (non retenue pour ce sous-projet) : arbre de décision par thème

Idée soulevée par l'utilisateur (2026-09-15) : structurer chaque thème comme un arbre de décision, où chaque nœud est une question / un trait de profil, et où l'on ne pose une question que si elle peut réellement changer le résultat pour ce thème (ex. : sur un thème donné, si le profil est mineur ça ne change rien ; si majeur, la question suivante dépend de salarié ou non ; pour "non", ça dépend d'étranger ou non ; etc.). On commencerait par les questions racines communes (essentielles), puis chaque thème naviguerait son propre arbre pour ne demander que ce qui est pertinent.

Deux bénéfices distincts identifiés :
1. **UX** : éviter de poser des questions qui ne changent rien à l'analyse pour un thème donné, donc alléger le formulaire.
2. **Logique de calcul** : l'arbre pourrait directement *être* la logique de détermination du niveau d'impact (chaque feuille = un résultat), plutôt qu'une couche d'optimisation de formulaire au-dessus de fonctions d'éligibilité séparées — potentiellement plus transparent/auditable qu'un ensemble de fonctions ad hoc, ce qui collerait bien au principe « pas de boîte noire » de `CLAUDE.md`.

**Décision** : non retenue pour ce sous-projet. Avec seulement 9 champs de profil et ~5 règles d'éligibilité sur 2 thèmes peuplés, un moteur d'arbre de décision générique (format d'arbre + moteur de traversée + arbre à maintenir par thème) coûte plus cher à construire et maintenir que les fonctions simples déjà prévues, pour un gain marginal à cette échelle. L'idée devient plus intéressante une fois que les 6 thèmes restants seront peuplés et que le profil aura grossi — à reconsidérer à ce moment-là, en remplacement du dossier `src/engine` actuel plutôt qu'en complément.

## Prochaine étape

Passage au skill `writing-plans` pour découper ce design en plan d'implémentation.
