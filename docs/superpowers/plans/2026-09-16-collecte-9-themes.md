# Collecte des 9 thèmes restants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Peupler les 9 thèmes actuellement `"provisoire"` (santé, sécurité, immigration, éducation, environnement, logement, travail, aides de l'État, libertés fondamentales) avec des propositions réelles sourcées pour Marine Le Pen, Jean-Luc Mélenchon et Édouard Philippe, avec le même niveau de rigueur que la collecte fiscalité/pouvoir d'achat déjà réalisée.

**Architecture:** Pas de changement d'architecture — uniquement des données (`data/programmes/*/propositions.json`) et deux fichiers de test déjà en place. Le moteur et l'UI itèrent déjà dynamiquement sur `themes.json` et n'ont besoin d'aucune modification.

**Tech Stack:** Recherche web (WebSearch/WebFetch) + Vitest pour la validation structurelle, comme pour la collecte précédente.

**Spec:** `docs/superpowers/specs/2026-09-16-revision-themes-design.md`

## Global Constraints

- Sourcing : toute proposition au statut `"complet"` doit avoir au moins 2 sources, dont au moins 1 de type `"primaire"` (source officielle du candidat/parti, déclaration officielle, texte légal/officiel — jamais un site tiers non officiel, un agrégateur ou un comparateur multi-candidats).
- Sources partisanes/militantes autorisées en secondaire, mais leur orientation doit être disclosée dans le `label` (voir `docs/methodologie.md`, convention déjà appliquée à Mélenchon/Philippe dans la collecte précédente).
- Convention `resume_factuel` / `hypotheses_calcul` : `resume_factuel` décrit ce que propose le candidat et ce que les sources laissent flou ; `hypotheses_calcul` porte le chiffrage, sa contestation éventuelle, et les réserves de faisabilité/légalité (voir `docs/methodologie.md`).
- `statut` qualifie la complétude de la RECHERCHE sur la fiche, pas la précision du programme du candidat (voir doc-comment sur `StatutProposition` dans `src/types.ts` et `docs/methodologie.md`).
- Avant d'écrire `chiffrage_disponible: false`, re-vérifier chaque source déjà citée pour cette proposition — ne jamais l'affirmer sans avoir réellement cherché (leçon de la collecte précédente, cf. Task 4 de `docs/superpowers/plans/2026-09-14-schema-et-donnees-prototype.md`).
- Avant de qualifier une source de `"primaire"`, vérifier son statut officiel réel (mentions légales / à propos) — ne jamais supposer qu'un site est officiel sans vérification (leçon de la Task 5 du même plan, où un site tiers non officiel avait été mal classé).
- Si une proposition regroupe plusieurs mesures distinctes, ne jamais faire porter un verdict « non concerné » sur l'ensemble de la proposition à partir d'un seul volet testé (leçon du plan précédent, `docs/superpowers/plans/2026-09-15-moteur-ui.md`, finding final #3) — non applicable directement à ce plan (pas de nouvelle règle d'éligibilité prévue ici), mais à garder en tête si une proposition composite est rédigée de façon ambiguë.
- Candidats : Marine Le Pen (`le-pen`), Jean-Luc Mélenchon (`melenchon`), Édouard Philippe (`philippe`) — même roster, même rigueur pour chacun.
- Ne jamais utiliser un comparateur multi-candidats (type iFRAP) ou un simulateur produit par un parti comme source de vérité — uniquement comme point de départ pour identifier quoi rechercher, jamais comme citation.
- Au moins 2 propositions au statut `"complet"` par thème par candidat.
- Thèmes de ce plan et leurs ids : `sante`, `securite`, `immigration`, `education`, `environnement`, `logement`, `travail`, `aides-etat`, `libertes-fondamentales` (les libellés/descriptions complets sont dans `data/themes.json`).

---

## Ordre d'exécution

3 groupes de 3 thèmes, chaque groupe = 3 tâches candidat (indépendantes entre elles, fichiers séparés) + 1 tâche de clôture (met à jour `themes.json` et `candidats.test.ts`, doit s'exécuter après les 3 tâches candidat du groupe).

**Groupe A — Santé, Sécurité, Immigration :** Task 1 (Le Pen) → Task 2 (Mélenchon) → Task 3 (Philippe) → Task 4 (clôture)
**Groupe B — Éducation, Environnement, Logement :** Task 5 (Le Pen) → Task 6 (Mélenchon) → Task 7 (Philippe) → Task 8 (clôture)
**Groupe C — Travail, Aides de l'État, Libertés fondamentales :** Task 9 (Le Pen) → Task 10 (Mélenchon) → Task 11 (Philippe) → Task 12 (clôture)

Un groupe ne doit démarrer qu'après la clôture du groupe précédent (pas de dépendance technique stricte, mais garde l'exécution simple à suivre).

---

## Gabarit commun aux 9 tâches candidat (Tasks 1-3, 5-7, 9-11)

Chaque tâche candidat suit exactement le même gabarit que les Tasks 4-6 de `docs/superpowers/plans/2026-09-14-schema-et-donnees-prototype.md` (déjà exécutées avec succès, avec revue par vérification live des sources) :

**Files:** Modify `data/programmes/<slug>/propositions.json` (et `data/programmes/<slug>/meta.json` uniquement si une nouvelle source officielle générale doit y être ajoutée).

**Steps:**
1. Rechercher, pour chacun des 3 thèmes du groupe, le programme officiel (ou à défaut les dernières déclarations officielles) du candidat, plus au moins une source secondaire par proposition retenue.
2. Ajouter au moins 2 propositions `"complet"` par thème (6 minimum au total pour la tâche), id préfixé `<slug>-<abrev-theme>-NNN` (abréviations : `sante`, `secu`, `immi`, `educ`, `envi`, `logt`, `trav`, `aides`, `lib`), `candidat: "<slug>"`, conformes au type `Proposition`.
3. Lancer `npx vitest run src/data/candidats.test.ts -t "<slug>"` et confirmer que les nouvelles propositions passent les vérifications structurelles applicables (sources, statut, non-vide). **Note attendue** : le test « aucune proposition complète en dehors des thèmes peuplés du plan » échouera pour les nouveaux thèmes tant que la tâche de clôture du groupe n'a pas mis à jour `THEMES_PEUPLES` — c'est un état intermédiaire attendu, pas un bug (même logique que la Task 3 du plan précédent), documenté explicitement dans le rapport.
4. Commit.
5. Self-review, incluant la ré-vérification de chaque source citée (voir Global Constraints).
6. Rapport détaillé (recherche, propositions ajoutées, sources, résultat de test avec l'échec attendu explicitement noté, incertitudes pour validation utilisateur).

**Ne pas** modifier `data/themes.json` ni `src/data/candidats.test.ts` dans une tâche candidat — c'est le rôle exclusif de la tâche de clôture du groupe.

---

### Task 1: Données réelles — Marine Le Pen (Santé, Sécurité, Immigration)

Suit le gabarit ci-dessus. Thèmes : `sante`, `securite`, `immigration`. Préfixes d'id : `le-pen-sante-NNN`, `le-pen-secu-NNN`, `le-pen-immi-NNN`.

### Task 2: Données réelles — Jean-Luc Mélenchon (Santé, Sécurité, Immigration)

Suit le gabarit ci-dessus. Thèmes : `sante`, `securite`, `immigration`. Préfixes d'id : `melenchon-sante-NNN`, `melenchon-secu-NNN`, `melenchon-immi-NNN`.

### Task 3: Données réelles — Édouard Philippe (Santé, Sécurité, Immigration)

Suit le gabarit ci-dessus. Thèmes : `sante`, `securite`, `immigration`. Préfixes d'id : `philippe-sante-NNN`, `philippe-secu-NNN`, `philippe-immi-NNN`.

---

### Task 4: Clôture du Groupe A (Santé, Sécurité, Immigration)

**Files:**
- Modify: `data/themes.json`
- Modify: `src/data/candidats.test.ts`

**Interfaces:**
- Consumes: propositions ajoutées par Tasks 1-3 (candidat `le-pen`/`melenchon`/`philippe`, thèmes `sante`/`securite`/`immigration`).
- Produces: `THEMES_PEUPLES` étendu, consommé par les tests des groupes suivants et par la Task 12 finale.

- [ ] **Step 1: Mettre à jour `data/themes.json`**

Passer `"statut"` de `"provisoire"` à `"populated"` pour les entrées `sante`, `securite`, `immigration`.

- [ ] **Step 2: Mettre à jour `THEMES_PEUPLES` dans `src/data/candidats.test.ts`**

```ts
const THEMES_PEUPLES = ["fiscalite", "pouvoir-achat", "sante", "securite", "immigration"];
```

- [ ] **Step 3: Lancer la suite complète**

Run: `npm run test`
Expected: PASS pour l'ensemble de la suite (y compris les propositions des Tasks 1-3, désormais couvertes par `THEMES_PEUPLES`).

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 5: Commit**

```bash
git add data/themes.json src/data/candidats.test.ts
git commit -m "data: close theme group A (sante, securite, immigration) as populated"
```

---

## Gabarit commun aux 3 tâches candidat du Groupe B (Tasks 5-7)

Même gabarit que Tasks 1-3, thèmes : `education`, `environnement`, `logement`. Préfixes d'id : `educ`, `envi`, `logt`.

### Task 5: Données réelles — Marine Le Pen (Éducation, Environnement, Logement)

Id préfixes : `le-pen-educ-NNN`, `le-pen-envi-NNN`, `le-pen-logt-NNN`.

### Task 6: Données réelles — Jean-Luc Mélenchon (Éducation, Environnement, Logement)

Id préfixes : `melenchon-educ-NNN`, `melenchon-envi-NNN`, `melenchon-logt-NNN`.

### Task 7: Données réelles — Édouard Philippe (Éducation, Environnement, Logement)

Id préfixes : `philippe-educ-NNN`, `philippe-envi-NNN`, `philippe-logt-NNN`.

---

### Task 8: Clôture du Groupe B (Éducation, Environnement, Logement)

**Files:**
- Modify: `data/themes.json`
- Modify: `src/data/candidats.test.ts`

- [ ] **Step 1: Mettre à jour `data/themes.json`**

Passer `"statut"` de `"provisoire"` à `"populated"` pour `education`, `environnement`, `logement`.

- [ ] **Step 2: Mettre à jour `THEMES_PEUPLES`**

```ts
const THEMES_PEUPLES = [
  "fiscalite",
  "pouvoir-achat",
  "sante",
  "securite",
  "immigration",
  "education",
  "environnement",
  "logement",
];
```

- [ ] **Step 3: Lancer la suite complète**

Run: `npm run test`
Expected: PASS pour l'ensemble de la suite.

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 5: Commit**

```bash
git add data/themes.json src/data/candidats.test.ts
git commit -m "data: close theme group B (education, environnement, logement) as populated"
```

---

## Gabarit commun aux 3 tâches candidat du Groupe C (Tasks 9-11)

Même gabarit que Tasks 1-3, thèmes : `travail`, `aides-etat`, `libertes-fondamentales`. Préfixes d'id : `trav`, `aides`, `lib`.

### Task 9: Données réelles — Marine Le Pen (Travail, Aides de l'État, Libertés fondamentales)

Id préfixes : `le-pen-trav-NNN`, `le-pen-aides-NNN`, `le-pen-lib-NNN`.

### Task 10: Données réelles — Jean-Luc Mélenchon (Travail, Aides de l'État, Libertés fondamentales)

Id préfixes : `melenchon-trav-NNN`, `melenchon-aides-NNN`, `melenchon-lib-NNN`.

### Task 11: Données réelles — Édouard Philippe (Travail, Aides de l'État, Libertés fondamentales)

Id préfixes : `philippe-trav-NNN`, `philippe-aides-NNN`, `philippe-lib-NNN`.

---

### Task 12: Clôture du Groupe C + vérification finale du plan

**Files:**
- Modify: `data/themes.json`
- Modify: `src/data/candidats.test.ts`

- [ ] **Step 1: Mettre à jour `data/themes.json`**

Passer `"statut"` de `"provisoire"` à `"populated"` pour `travail`, `aides-etat`, `libertes-fondamentales`. Les 11 thèmes doivent maintenant tous être `"populated"`.

- [ ] **Step 2: Mettre à jour `THEMES_PEUPLES` (liste finale, les 11 thèmes)**

```ts
const THEMES_PEUPLES = [
  "fiscalite",
  "pouvoir-achat",
  "sante",
  "securite",
  "immigration",
  "education",
  "environnement",
  "logement",
  "travail",
  "aides-etat",
  "libertes-fondamentales",
];
```

- [ ] **Step 3: Lancer la suite complète**

Run: `npm run test`
Expected: PASS pour l'ensemble de la suite.

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 5: Vérifier qu'il ne reste aucun thème `"provisoire"`**

Vérifier manuellement `data/themes.json` : les 11 entrées doivent avoir `"statut": "populated"`.

- [ ] **Step 6: Vérifier que chaque candidat a bien au moins 2 propositions complètes sur chacun des 11 thèmes**

C'est déjà couvert par le test Vitest `it.each(THEMES_PEUPLES)("a au moins une proposition complete sur le thème %s", ...)` dans `src/data/candidats.test.ts`, donc le Step 3 suffit — pas de vérification manuelle supplémentaire nécessaire.

- [ ] **Step 7: Commit**

```bash
git add data/themes.json src/data/candidats.test.ts
git commit -m "data: close theme group C (travail, aides-etat, libertes-fondamentales) — all 11 themes populated"
```

- [ ] **Step 8: Récapitulatif pour validation utilisateur**

Produire un récapitulatif de toutes les propositions ajoutées dans ce plan (9 thèmes × 3 candidats), avec leurs sources, à présenter à l'utilisateur — ces données ne sont considérées définitives qu'après sa validation, conformément à la méthodologie du projet.
