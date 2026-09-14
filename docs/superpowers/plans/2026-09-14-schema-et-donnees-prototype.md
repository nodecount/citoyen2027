# Schéma de données et contenu du prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffolder l'application React/Vite/TypeScript, définir le schéma de données (types, thèmes, profil), et produire des données réelles sourcées et validées structurellement pour Marine Le Pen, Jean-Luc Mélenchon et Édouard Philippe sur les thèmes fiscalité et pouvoir d'achat.

**Architecture:** Application statique unique (pas de backend). Les données vivent dans `/data` en JSON, typées via `/src/types.ts`. Des tests Vitest valident la structure et le sourcing des données (pas encore la logique métier — le moteur de calcul est hors scope de ce plan, voir "Hors scope").

**Tech Stack:** React 18 + TypeScript + Vite, Vitest pour les tests.

**Spec:** `docs/superpowers/specs/2026-09-14-simulateur-prototype-design.md`

## Global Constraints

- Stack : React (Vite) + TypeScript, application 100% statique, aucun backend.
- Neutralité : candidats toujours listés en ordre alphabétique (Le Pen, Mélenchon, Philippe) — jamais par score ou popularité.
- Sourcing : toute proposition au statut `"complet"` doit avoir au moins 2 sources, dont au moins 1 de type `"primaire"`.
- Statut explicite obligatoire (`"complet" | "partiel" | "provisoire"`) sur chaque proposition — jamais de valeur inventée pour combler un trou.
- Candidats de ce prototype : Marine Le Pen (slug `le-pen`), Jean-Luc Mélenchon (slug `melenchon`), Édouard Philippe (slug `philippe`).
- Thèmes déclarés au total (8) : `fiscalite`, `travail`, `liberte`, `aides-etat`, `pouvoir-achat`, `liberte-expression`, `liberte-politique`, `succession`.
- Thèmes peuplés avec des propositions `"complet"` dans ce plan : `fiscalite` et `pouvoir-achat` uniquement (les 6 autres restent avec un tableau `propositions` vide pour l'instant).

---

## Hors scope de ce plan

- Le moteur de calcul (`/src/engine`) et l'UI (`/src/ui`) : ils dépendent des propositions réelles collectées ici (leurs valeurs numériques, leurs conditions) et seront couverts par un plan séparé une fois ce plan exécuté et les données validées par l'utilisateur.
- Les 6 thèmes non peuplés.
- L'ingestion automatisée et le choix d'hébergement (déjà hors scope de la spec).

## Ordre d'exécution

Task 1 → Task 2 → Task 3, puis Tasks 4, 5, 6 (une par candidat, peuvent être faites dans n'importe quel ordre relatif entre elles mais chacune après la Task 3), puis Task 7 en dernier.

---

### Task 1: Scaffold du projet Vite + React + TypeScript + Vitest

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `.gitignore`

**Interfaces:**
- Produces: un projet npm exécutable (`npm run dev`, `npm run build`, `npm run test`) que les tâches suivantes utilisent pour lancer Vitest.

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "simulateur-impact-2027",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Créer `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Créer `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 5: Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simulateur d'impact personnel — Présidentielle 2027</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Créer `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Créer `src/App.tsx`**

```tsx
export default function App() {
  return (
    <main>
      <h1>Simulateur d'impact personnel — Présidentielle 2027</h1>
      <p>Prototype en cours de construction : formulaire et résultats à venir.</p>
    </main>
  );
}
```

- [ ] **Step 8: Créer `.gitignore`**

```
node_modules
dist
```

- [ ] **Step 9: Installer les dépendances et vérifier que le projet build**

Run: `npm install`
Run: `npm run build`
Expected: build réussit sans erreur TypeScript.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx .gitignore
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Types partagés, thèmes et schéma de profil

**Files:**
- Create: `src/types.ts`
- Create: `data/themes.json`
- Create: `data/profils-schema.json`
- Test: `src/data/schema.test.ts`

**Interfaces:**
- Consumes: rien (première définition du schéma).
- Produces: types `Source`, `StatutProposition`, `Proposition`, `Theme`, `CandidatMeta`, `ChampProfil` exportés depuis `src/types.ts`, réutilisés par toutes les tâches suivantes et par le futur plan moteur/UI.

- [ ] **Step 1: Écrire le test de structure (échoue au départ, fichiers de données absents)**

Créer `src/data/schema.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import themes from "../../data/themes.json";
import profilSchema from "../../data/profils-schema.json";

const THEME_IDS = [
  "fiscalite",
  "travail",
  "liberte",
  "aides-etat",
  "pouvoir-achat",
  "liberte-expression",
  "liberte-politique",
  "succession",
];

describe("themes.json", () => {
  it("déclare exactement les 8 thèmes prévus, chacun avec id/libelle/description", () => {
    expect(themes).toHaveLength(8);
    const ids = themes.map((t: any) => t.id).sort();
    expect(ids).toEqual([...THEME_IDS].sort());
    for (const theme of themes as any[]) {
      expect(typeof theme.libelle).toBe("string");
      expect(theme.libelle.length).toBeGreaterThan(0);
      expect(typeof theme.description).toBe("string");
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });
});

describe("profils-schema.json", () => {
  it("liste au moins les champs de profil minimaux prévus", () => {
    const ids = (profilSchema as any[]).map((f) => f.id);
    for (const champAttendu of [
      "statut_professionnel",
      "tranche_revenus",
      "situation_familiale",
      "nombre_enfants",
      "logement",
      "secteur_activite",
      "region",
    ]) {
      expect(ids).toContain(champAttendu);
    }
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm run test`
Expected: FAIL — `data/themes.json` et `data/profils-schema.json` n'existent pas encore (erreur de résolution de module).

- [ ] **Step 3: Créer `src/types.ts`**

```ts
export type StatutProposition = "complet" | "partiel" | "provisoire";

export interface Source {
  type: "primaire" | "secondaire";
  label: string;
  url: string;
}

export interface Proposition {
  id: string;
  candidat: string;
  theme: string;
  titre: string;
  resume_factuel: string;
  sources: Source[];
  chiffrage_disponible: boolean;
  hypotheses_calcul: string;
  statut: StatutProposition;
  date_derniere_verification: string;
}

export interface Theme {
  id: string;
  libelle: string;
  description: string;
}

export interface CandidatMeta {
  slug: string;
  nom: string;
  parti: string;
  sources_officielles: Source[];
  date_derniere_maj: string;
}

export interface ChampProfil {
  id: string;
  label: string;
  type: "enum" | "number" | "text";
  options?: string[];
}
```

- [ ] **Step 4: Créer `data/themes.json`**

```json
[
  { "id": "fiscalite", "libelle": "Fiscalité", "description": "Impôts sur le revenu, la consommation, le patrimoine et les entreprises." },
  { "id": "travail", "libelle": "Travail", "description": "Droit du travail, chômage, retraite, conditions d'emploi." },
  { "id": "liberte", "libelle": "Libertés individuelles", "description": "Libertés civiles et droits fondamentaux au sens large." },
  { "id": "aides-etat", "libelle": "Aides de l'État", "description": "Prestations sociales, allocations, aides ciblées." },
  { "id": "pouvoir-achat", "libelle": "Pouvoir d'achat", "description": "Prix, salaires nets, coût de la vie courante." },
  { "id": "liberte-expression", "libelle": "Liberté d'expression", "description": "Presse, médias, liberté de parole et d'information." },
  { "id": "liberte-politique", "libelle": "Libertés politiques", "description": "Droit de vote, pluralisme, organisation des pouvoirs publics." },
  { "id": "succession", "libelle": "Succession", "description": "Droits de succession et transmission de patrimoine." }
]
```

- [ ] **Step 5: Créer `data/profils-schema.json`**

```json
[
  { "id": "statut_professionnel", "label": "Statut professionnel", "type": "enum", "options": ["salarie", "independant", "fonctionnaire", "retraite", "etudiant", "sans_emploi"] },
  { "id": "tranche_revenus", "label": "Tranche de revenus mensuels nets", "type": "enum", "options": ["moins_1200", "1200_2000", "2000_3000", "3000_5000", "plus_5000"] },
  { "id": "situation_familiale", "label": "Situation familiale", "type": "enum", "options": ["celibataire", "en_couple", "marie_pacse"] },
  { "id": "nombre_enfants", "label": "Nombre d'enfants à charge", "type": "number" },
  { "id": "logement", "label": "Statut de logement", "type": "enum", "options": ["locataire", "proprietaire", "heberge"] },
  { "id": "secteur_activite", "label": "Secteur d'activité", "type": "text" },
  { "id": "region", "label": "Région", "type": "text" }
]
```

- [ ] **Step 6: Relancer les tests, vérifier le succès**

Run: `npm run test`
Expected: PASS pour les deux blocs `describe`.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts data/themes.json data/profils-schema.json src/data/schema.test.ts
git commit -m "feat: define shared types, themes and profile schema"
```

---

### Task 3: Tests de validation structurelle des données candidats + stubs vides

**Files:**
- Create: `src/data/candidats.test.ts`
- Create: `data/programmes/le-pen/meta.json` (stub minimal)
- Create: `data/programmes/le-pen/propositions.json` (`[]`)
- Create: `data/programmes/melenchon/meta.json` (stub minimal)
- Create: `data/programmes/melenchon/propositions.json` (`[]`)
- Create: `data/programmes/philippe/meta.json` (stub minimal)
- Create: `data/programmes/philippe/propositions.json` (`[]`)

**Interfaces:**
- Consumes: `Theme`, `Proposition`, `CandidatMeta` de `src/types.ts` ; `data/themes.json` de la Task 2.
- Produces: suite de tests `candidats.test.ts` que les Tasks 4-6 feront passer au fur et à mesure qu'elles peuplent les données réelles.

- [ ] **Step 1: Créer les stubs vides des 3 candidats**

`data/programmes/le-pen/meta.json` :
```json
{ "slug": "le-pen", "nom": "Marine Le Pen", "parti": "", "sources_officielles": [], "date_derniere_maj": "" }
```
`data/programmes/le-pen/propositions.json` :
```json
[]
```

`data/programmes/melenchon/meta.json` :
```json
{ "slug": "melenchon", "nom": "Jean-Luc Mélenchon", "parti": "", "sources_officielles": [], "date_derniere_maj": "" }
```
`data/programmes/melenchon/propositions.json` :
```json
[]
```

`data/programmes/philippe/meta.json` :
```json
{ "slug": "philippe", "nom": "Édouard Philippe", "parti": "", "sources_officielles": [], "date_derniere_maj": "" }
```
`data/programmes/philippe/propositions.json` :
```json
[]
```

- [ ] **Step 2: Écrire `src/data/candidats.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import themes from "../../data/themes.json";
import lePenMeta from "../../data/programmes/le-pen/meta.json";
import lePenProps from "../../data/programmes/le-pen/propositions.json";
import melenchonMeta from "../../data/programmes/melenchon/meta.json";
import melenchonProps from "../../data/programmes/melenchon/propositions.json";
import philippeMeta from "../../data/programmes/philippe/meta.json";
import philippeProps from "../../data/programmes/philippe/propositions.json";

const THEME_IDS = new Set((themes as any[]).map((t) => t.id));
const STATUTS = new Set(["complet", "partiel", "provisoire"]);
const THEMES_PEUPLES = ["fiscalite", "pouvoir-achat"];

const candidats = [
  { slug: "le-pen", meta: lePenMeta, propositions: lePenProps },
  { slug: "melenchon", meta: melenchonMeta, propositions: melenchonProps },
  { slug: "philippe", meta: philippeMeta, propositions: philippeProps },
];

describe.each(candidats)("candidat $slug", ({ slug, meta, propositions }) => {
  it("a un meta.json complet", () => {
    expect((meta as any).slug).toBe(slug);
    expect((meta as any).nom.length).toBeGreaterThan(0);
    expect((meta as any).parti.length).toBeGreaterThan(0);
    expect((meta as any).sources_officielles.length).toBeGreaterThan(0);
    expect((meta as any).date_derniere_maj.length).toBeGreaterThan(0);
  });

  it("chaque proposition référence un thème connu et un statut valide", () => {
    for (const p of propositions as any[]) {
      expect(THEME_IDS.has(p.theme)).toBe(true);
      expect(STATUTS.has(p.statut)).toBe(true);
      expect(p.candidat).toBe(slug);
    }
  });

  it("chaque proposition au statut complet a au moins 2 sources dont 1 primaire", () => {
    for (const p of (propositions as any[]).filter((p) => p.statut === "complet")) {
      expect(p.sources.length).toBeGreaterThanOrEqual(2);
      expect(p.sources.some((s: any) => s.type === "primaire")).toBe(true);
    }
  });

  it.each(THEMES_PEUPLES)("a au moins une proposition complete sur le thème %s", (themeId) => {
    const propsDuTheme = (propositions as any[]).filter(
      (p) => p.theme === themeId && p.statut === "complet"
    );
    expect(propsDuTheme.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Lancer les tests, vérifier l'échec attendu**

Run: `npm run test`
Expected: les tests "meta.json complet" échouent (champs vides) et les tests "au moins une proposition complete sur fiscalite/pouvoir-achat" échouent (propositions vides), pour les 3 candidats. C'est l'état de départ attendu avant les Tasks 4-6.

- [ ] **Step 4: Commit**

```bash
git add src/data/candidats.test.ts data/programmes
git commit -m "test: add structural validation tests for candidate data (failing, no content yet)"
```

---

### Task 4: Données réelles — Marine Le Pen (fiscalité + pouvoir d'achat)

**Files:**
- Modify: `data/programmes/le-pen/meta.json`
- Modify: `data/programmes/le-pen/propositions.json`

**Interfaces:**
- Consumes: `Source`, `Proposition`, `CandidatMeta` de `src/types.ts` ; contrat de test de la Task 3 (`src/data/candidats.test.ts`, sous-suite `candidat le-pen`).
- Produces: propositions réelles avec l'id `candidat: "le-pen"` que les Tasks du futur plan moteur/UI consommeront.

- [ ] **Step 1: Rechercher les sources**

Chercher le programme officiel du Rassemblement National / de Marine Le Pen pour 2027 sur la fiscalité et le pouvoir d'achat (site officiel, déclarations officielles), plus au moins une source secondaire (presse, fact-check) par proposition retenue. Si aucun programme complet n'est encore publié à la date de recherche, utiliser les dernières déclarations officielles disponibles et le documenter dans `hypotheses_calcul`.

- [ ] **Step 2: Remplir `data/programmes/le-pen/meta.json`**

Remplacer le stub par les vraies valeurs (`parti`, `sources_officielles` avec au moins une entrée `{"type": "primaire", ...}`, `date_derniere_maj` à la date de la recherche), en gardant `slug: "le-pen"` et `nom: "Marine Le Pen"`.

- [ ] **Step 3: Remplir `data/programmes/le-pen/propositions.json`**

Ajouter au moins 2 propositions au statut `"complet"` pour le thème `"fiscalite"` et au moins 2 pour `"pouvoir-achat"`, chacune conforme au type `Proposition` (id préfixé `le-pen-fisc-XXX` / `le-pen-pa-XXX`, `candidat: "le-pen"`, au moins 2 sources dont 1 primaire, `hypotheses_calcul` renseigné même si vide justifié).

- [ ] **Step 4: Lancer les tests scopés à ce candidat**

Run: `npx vitest run src/data/candidats.test.ts -t "le-pen"` (the literal `npm run test -- -t "candidat le-pen"` matches 0 tests — vitest quotes the interpolated `describe.each` slug as `candidat 'le-pen'`, which `-t` can't match against; confirmed during execution)
Expected: PASS pour toute la sous-suite `le-pen`.

- [ ] **Step 5: Commit**

```bash
git add data/programmes/le-pen/meta.json data/programmes/le-pen/propositions.json
git commit -m "data: add sourced fiscalite/pouvoir-achat propositions for Marine Le Pen"
```

---

### Task 5: Données réelles — Jean-Luc Mélenchon (fiscalité + pouvoir d'achat)

**Files:**
- Modify: `data/programmes/melenchon/meta.json`
- Modify: `data/programmes/melenchon/propositions.json`

**Interfaces:**
- Consumes: mêmes types que Task 4 ; contrat de test `candidat melenchon` de la Task 3.
- Produces: propositions réelles avec `candidat: "melenchon"`.

- [ ] **Step 1: Rechercher les sources**

Chercher le programme officiel de La France Insoumise / de Jean-Luc Mélenchon pour 2027 sur la fiscalité et le pouvoir d'achat, plus au moins une source secondaire par proposition retenue.

- [ ] **Step 2: Remplir `data/programmes/melenchon/meta.json`**

Mêmes règles que Task 4 Step 2, avec `slug: "melenchon"`, `nom: "Jean-Luc Mélenchon"`.

- [ ] **Step 3: Remplir `data/programmes/melenchon/propositions.json`**

Au moins 2 propositions `"complet"` par thème (`fiscalite`, `pouvoir-achat`), id préfixé `melenchon-fisc-XXX` / `melenchon-pa-XXX`, `candidat: "melenchon"`.

- [ ] **Step 4: Lancer les tests scopés à ce candidat**

Run: `npx vitest run src/data/candidats.test.ts -t "melenchon"` (see Task 4's note on why the literal `npm run test -- -t "candidat ..."` form doesn't work)
Expected: PASS pour toute la sous-suite `melenchon`.

- [ ] **Step 5: Commit**

```bash
git add data/programmes/melenchon/meta.json data/programmes/melenchon/propositions.json
git commit -m "data: add sourced fiscalite/pouvoir-achat propositions for Jean-Luc Melenchon"
```

---

### Task 6: Données réelles — Édouard Philippe (fiscalité + pouvoir d'achat)

**Files:**
- Modify: `data/programmes/philippe/meta.json`
- Modify: `data/programmes/philippe/propositions.json`

**Interfaces:**
- Consumes: mêmes types que Task 4 ; contrat de test `candidat philippe` de la Task 3.
- Produces: propositions réelles avec `candidat: "philippe"`.

- [ ] **Step 1: Rechercher les sources**

Chercher le programme officiel d'Horizons / d'Édouard Philippe pour 2027 sur la fiscalité et le pouvoir d'achat, plus au moins une source secondaire par proposition retenue.

- [ ] **Step 2: Remplir `data/programmes/philippe/meta.json`**

Mêmes règles que Task 4 Step 2, avec `slug: "philippe"`, `nom: "Édouard Philippe"`.

- [ ] **Step 3: Remplir `data/programmes/philippe/propositions.json`**

Au moins 2 propositions `"complet"` par thème (`fiscalite`, `pouvoir-achat`), id préfixé `philippe-fisc-XXX` / `philippe-pa-XXX`, `candidat: "philippe"`.

- [ ] **Step 4: Lancer les tests scopés à ce candidat**

Run: `npx vitest run src/data/candidats.test.ts -t "philippe"` (see Task 4's note on why the literal `npm run test -- -t "candidat ..."` form doesn't work)
Expected: PASS pour toute la sous-suite `philippe`.

- [ ] **Step 5: Commit**

```bash
git add data/programmes/philippe/meta.json data/programmes/philippe/propositions.json
git commit -m "data: add sourced fiscalite/pouvoir-achat propositions for Edouard Philippe"
```

---

### Task 7: Vérification finale et récapitulatif pour validation utilisateur

**Files:**
- None créé/modifié (vérification uniquement).

**Interfaces:**
- Consumes: l'ensemble des fichiers de données des Tasks 2-6.
- Produces: rien de nouveau — point de contrôle avant de considérer les données "validées" au sens de la spec.

- [ ] **Step 1: Lancer la suite de tests complète**

Run: `npm run test`
Expected: PASS pour tous les tests (`schema.test.ts` et `candidats.test.ts`, les 3 candidats).

- [ ] **Step 2: Lancer le build**

Run: `npm run build`
Expected: succès (les imports JSON sont valides TypeScript).

- [ ] **Step 3: Produire un récapitulatif des propositions ajoutées**

Lister, pour chacun des 3 candidats et des 2 thèmes peuplés, les titres de propositions ajoutées avec leurs sources (primaire + secondaire), à présenter à l'utilisateur pour validation de fond — conformément à la spec, ces données ne sont considérées définitives qu'après cette validation.

- [ ] **Step 4: Commit final si des ajustements ont eu lieu suite à Step 3**

```bash
git add -A
git commit -m "data: finalize sourced propositions after content review"
```

(Ne committer que s'il y a eu des changements suite à la relecture ; sinon, cette étape est un no-op.)
