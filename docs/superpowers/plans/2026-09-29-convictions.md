# Axe « Convictions » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter au simulateur un axe « Mes convictions », séparé des badges « Ma situation » et sans score : (A) valeurs sociales rattachées aux effets structurés des mesures, (B) intégrité en faits sourcés (condamnations définitives).

**Architecture:** Catalogue de groupes sociaux (`src/convictions.ts`) + règle explicite `projeterConviction` réutilisant la table de polarité ; faits d'intégrité dans `data/integrite/<slug>.json`, validés strictement (`src/data/integrite.ts`) ; choix du visiteur gardés dans `localStorage` (`convictions-visiteur`) ; affichage dans un bloc « Mes convictions » et un panneau du détail candidat, seulement en mode simulateur ; intégrité masquée en mode aveugle.

**Tech Stack:** React 18 / Vite / TypeScript, vitest (`npx vitest run`), rendu de test par `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-09-29-convictions-design.md`

## Global Constraints

- Axe séparé : **aucun score global, aucun classement, aucune moyenne entre axes** ; ordre d'affichage inchangé (alphabétique, mélangé en mode aveugle).
- Le sens favorable/défavorable vient **uniquement** de `src/engine/polarite.ts`.
- **Absence de donnée ≠ absence de condamnation** : sans fichier ou sans sources valides, l'état est « non vérifié ».
- **Condamnations définitives seulement** ; chacune avec ≥ 2 sources dont ≥ 1 `primaire` ; attribuées et datées ; aucun qualificatif.
- Aucun fait sur aucun candidat n'est saisi par ce plan : `data/integrite/` reste **vide** (sans fichier).
- Facultatif, réponses gardées dans le navigateur uniquement, effaçables ; police 14 px minimum ; la couleur ne porte jamais seule l'information (mot + symbole).
- Mode aveugle : aucune donnée d'intégrité rendue.
- Mode « Explorer les mesures » : aucune conviction affichée.
- Le code suit le style existant : identifiants et commentaires en français, guillemets doubles, points-virgules.
- Messages de commit sans apostrophe (la commande bash du dépôt les gère mal), terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Un fichier d'intégrité avec `condamnations_definitives: []` mais sans `sources_consultees` ne doit jamais afficher « aucune condamnation recensée » (Task 2).
- Un fichier dont le `slug` interne diffère du nom de fichier est rejeté, pas deviné (Task 2).
- Convictions corrompues ou périmées dans `localStorage` (JSON invalide, identifiant de groupe disparu) : ignorées sans erreur (Task 3).
- Groupes choisis mais candidat sans aucun effet structuré sur le thème : « pas d'indicateur », jamais « non concerné » (Task 1).
- Mode aveugle + « sans condamnation » activé : aucun fait d'intégrité (ni nom de juridiction, ni URL) dans le rendu (Task 4).
- Mode exploration avec convictions enregistrées : rien n'est affiché (Task 4).

## File Structure

| Fichier | Rôle |
|---|---|
| `src/convictions.ts` (créer) | Catalogue des groupes sociaux (id, libellé, critère de profil) |
| `src/engine/convictions.ts` (créer) | `projeterConviction` : constat « valeurs sociales » par thème |
| `src/data/integrite.ts` (créer) | Types, validation stricte, constat, chargement des faits d'intégrité |
| `src/ui/memoireConvictions.ts` (créer) | Lecture/écriture/assainissement des choix du visiteur |
| `src/ui/Convictions.tsx` (créer) | Bloc « Mes convictions » et panneau du détail candidat |
| `src/ui/PageThemes.tsx`, `VueThemes.tsx` (modifier) | Câblage : état, bloc, transmission au détail |
| `src/index.css` (modifier) | Styles du bloc et du panneau |
| `docs/methodologie.md`, `CLAUDE.md` (modifier) | Règles de l'axe |

---

### Task 1: Groupes sociaux et moteur « valeurs sociales »

**Files:**
- Create: `src/convictions.ts`
- Create: `src/engine/convictions.ts`
- Test: `src/engine/convictions.test.ts`

**Interfaces:**
- Consumes: `CritereCible`, `Effet` (`src/effets.ts`), `polarite` (`src/engine/polarite.ts`), `EffetRetenu`, `NiveauProjection` (`src/engine/projection.ts`), `Proposition` (`src/types.ts`), `VALEURS_PAR_CHAMP` (`src/effets.ts`).
- Produces: `interface GroupeSocial { id: string; libelle: string; critere: CritereCible }`, `GROUPES_SOCIAUX: GroupeSocial[]`, `interface ConstatSocial { niveau: NiveauProjection | null; effetsRetenus: EffetRetenu[] }`, `projeterConviction(groupes: GroupeSocial[], propositions: Proposition[]): ConstatSocial`.

Règle (documentée dans le code) : un effet « vise » un groupe si ses cibles sont vides (tout le monde), ou s'il a au moins un critère sur le champ du groupe et que **tous** ses critères sur ce champ recoupent les valeurs du groupe. Les critères sur d'autres champs ne bloquent pas (portée partielle assumée). Niveaux : favorable seul → `ameliorant` ; défavorable seul → `degradant` ; les deux → `mixte` ; effets présents mais aucun ne vise le groupe → `non_concerne` ; aucun effet structuré, ou seulement des sens indéterminés, ou aucun groupe choisi → `null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/convictions.test.ts
import { describe, expect, it } from "vitest";
import { GROUPES_SOCIAUX } from "../convictions";
import { VALEURS_PAR_CHAMP, type Effet } from "../effets";
import type { Proposition } from "../types";
import { projeterConviction } from "./convictions";

const groupe = (id: string) => GROUPES_SOCIAUX.find((g) => g.id === id)!;
const effet = (cibles: Effet["cibles"], dimension: Effet["dimension"], sens: Effet["sens"]): Effet => ({
  cibles,
  dimension,
  sens,
  source_url: "https://exemple.fr/a",
  extrait: "extrait de test suffisamment long",
});
function prop(id: string, effets: Effet[], statut: Proposition["statut"] = "complet"): Proposition {
  return { id, candidat: "x", theme: "fiscalite", titre: id, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut, date_derniere_verification: "2026-09-29", effets };
}
const MODESTES = [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }];

describe("catalogue des groupes sociaux", () => {
  it("chaque critère est valide pour le formulaire (champ et valeurs existants)", () => {
    for (const g of GROUPES_SOCIAUX) {
      const autorisees = VALEURS_PAR_CHAMP[g.critere.champ];
      expect(autorisees, g.id).toBeDefined();
      for (const v of g.critere.valeurs) expect(autorisees).toContain(v);
    }
  });
  it("les identifiants sont uniques", () => {
    expect(new Set(GROUPES_SOCIAUX.map((g) => g.id)).size).toBe(GROUPES_SOCIAUX.length);
  });
});

describe("projeterConviction", () => {
  const faibles = [groupe("faibles_revenus")];

  it("sans groupe choisi : pas d'indicateur", () => {
    expect(projeterConviction([], [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]).niveau).toBeNull();
  });
  it("mesure qui augmente le revenu des plus modestes : améliorant", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]);
    expect(c.niveau).toBe("ameliorant");
    expect(c.effetsRetenus).toHaveLength(1);
  });
  it("mesure pour tout le monde (cibles vides) : compte", () => {
    expect(projeterConviction(faibles, [prop("a", [effet([], "cout_de_la_vie", "baisse")])]).niveau).toBe("ameliorant");
  });
  it("mesure qui dégrade la situation du groupe : dégradant", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "protection_sociale", "baisse")])]).niveau).toBe("degradant");
  });
  it("favorable ET défavorable : mixte", () => {
    const c = projeterConviction(faibles, [
      prop("a", [effet(MODESTES, "revenu_disponible", "hausse")]),
      prop("b", [effet(MODESTES, "protection_sociale", "baisse")]),
    ]);
    expect(c.niveau).toBe("mixte");
  });
  it("critère sur un autre champ : n'est pas compté pour le groupe", () => {
    const retraites = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
    expect(projeterConviction(faibles, [prop("a", [effet(retraites, "revenu_disponible", "hausse")])]).niveau).toBe("non_concerne");
  });
  it("critère contradictoire sur le champ du groupe : n'est pas compté", () => {
    const riches = [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }];
    expect(projeterConviction(faibles, [prop("a", [effet(riches, "revenu_disponible", "hausse")])]).niveau).toBe("non_concerne");
  });
  it("effet à sens indéterminé seulement : pas d'indicateur", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "indetermine")])]).niveau).toBeNull();
  });
  it("candidat sans aucun effet structuré : pas d'indicateur, jamais « non concerné »", () => {
    expect(projeterConviction(faibles, [prop("a", [])]).niveau).toBeNull();
    expect(projeterConviction(faibles, [{ ...prop("b", []), effets: undefined }]).niveau).toBeNull();
  });
  it("fiche provisoire ignorée", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")], "provisoire")]).niveau).toBeNull();
  });
  it("plusieurs groupes : l'union de leurs effets", () => {
    const groupes = [groupe("faibles_revenus"), groupe("retraites")];
    const retraites = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
    expect(projeterConviction(groupes, [prop("a", [effet(retraites, "revenu_disponible", "hausse")])]).niveau).toBe("ameliorant");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/convictions.test.ts`
Expected: FAIL (modules `../convictions` et `./convictions` introuvables).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/convictions.ts
import type { CritereCible } from "./effets";

// Valeurs sociales : « je veux un candidat dont les mesures améliorent la situation de… ». Chaque groupe s'appuie sur un
// critère réel du formulaire (mêmes champs et options que les cibles des mesures, voir data/profils-schema.json) : c'est
// ce qui permet d'apparier les groupes aux effets déjà structurés, sans nouveau modèle.
export interface GroupeSocial {
  id: string;
  libelle: string;
  critere: CritereCible;
}

export const GROUPES_SOCIAUX: GroupeSocial[] = [
  { id: "faibles_revenus", libelle: "Les personnes à faibles revenus", critere: { champ: "tranche_revenus", valeurs: ["moins_1200", "1200_2000"] } },
  { id: "sans_emploi", libelle: "Les personnes sans emploi", critere: { champ: "statut_professionnel", valeurs: ["sans_emploi"] } },
  { id: "jeunes", libelle: "Les jeunes de moins de 30 ans", critere: { champ: "tranche_age", valeurs: ["moins_30"] } },
  { id: "retraites", libelle: "Les retraités", critere: { champ: "statut_professionnel", valeurs: ["retraite"] } },
  { id: "handicap", libelle: "Les personnes en situation de handicap", critere: { champ: "handicap", valeurs: ["oui"] } },
  { id: "territoires_fragiles", libelle: "Les habitants des quartiers prioritaires, des zones rurales et de l'outre-mer", critere: { champ: "territoire", valeurs: ["quartier_prioritaire", "rural", "outre_mer"] } },
];
```

```ts
// src/engine/convictions.ts
import type { GroupeSocial } from "../convictions";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import { polarite } from "./polarite";
import type { EffetRetenu, NiveauProjection } from "./projection";

// Constat « valeurs sociales » d'un candidat sur un thème : ce que ses mesures font aux GROUPES que le visiteur a choisis
// (pas à lui). Mêmes niveaux, même table de polarité que l'indicateur « Ma situation » ; jamais fusionné avec lui.
export interface ConstatSocial {
  niveau: NiveauProjection | null;
  effetsRetenus: EffetRetenu[];
}

// Un effet « vise » un groupe si ses cibles sont vides (tout le monde), ou s'il a au moins un critère sur le champ du
// groupe et que TOUS ses critères sur ce champ recoupent les valeurs du groupe. Les critères sur d'autres champs ne
// bloquent pas : la mesure atteint alors une partie du groupe (portée partielle assumée). Jamais d'élargissement du
// périmètre par approximation : un effet qui ne dit rien du champ du groupe (ou vise « autre ») n'est pas compté.
function viseLeGroupe(effet: Effet, groupe: GroupeSocial): boolean {
  if (effet.cibles.length === 0) return true;
  const surLeChamp = effet.cibles.filter((c) => c.champ === groupe.critere.champ);
  if (surLeChamp.length === 0) return false;
  return surLeChamp.every((c) => c.valeurs.some((v) => groupe.critere.valeurs.includes(v)));
}

export function projeterConviction(groupes: GroupeSocial[], propositions: Proposition[]): ConstatSocial {
  const effetsRetenus: EffetRetenu[] = [];
  if (groupes.length === 0) return { niveau: null, effetsRetenus };
  let nombreEffets = 0;
  let favorables = 0;
  let defavorables = 0;
  let indetermines = 0;
  for (const proposition of propositions) {
    if (proposition.statut === "provisoire") continue;
    for (const effet of proposition.effets ?? []) {
      nombreEffets += 1;
      if (!groupes.some((g) => viseLeGroupe(effet, g))) continue;
      const sens = polarite(effet.dimension, effet.sens);
      if (sens === null) {
        indetermines += 1;
        continue;
      }
      effetsRetenus.push({ propositionId: proposition.id, effet, polarite: sens });
      if (sens === "favorable") favorables += 1;
      else defavorables += 1;
    }
  }
  const niveau: NiveauProjection | null =
    nombreEffets === 0 ? null : favorables > 0 && defavorables > 0 ? "mixte" : favorables > 0 ? "ameliorant" : defavorables > 0 ? "degradant" : indetermines > 0 ? null : "non_concerne";
  return { niveau, effetsRetenus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/convictions.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/convictions.ts src/engine/convictions.ts src/engine/convictions.test.ts
git commit -m "Convictions : groupes sociaux et constat par theme" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Faits d'intégrité (types, validation, constat, chargement)

**Files:**
- Create: `src/data/integrite.ts`
- Create: `data/integrite/.gitkeep`
- Test: `src/data/integrite.test.ts`

**Interfaces:**
- Consumes: rien des tâches précédentes.
- Produces: `interface SourceIntegrite { type: "primaire" | "secondaire"; nom: string; annee: number; url: string }`, `interface Condamnation { nature: string; juridiction: string; date_decision: string; peine: string; sources: SourceIntegrite[] }`, `interface Integrite { slug: string; verifie_le: string; sources_consultees: SourceIntegrite[]; condamnations_definitives: Condamnation[] }`, `type ConstatIntegrite = { etat: "non_verifie" } | { etat: "aucune_recensee"; verifieLe: string; sources: SourceIntegrite[] } | { etat: "recensee"; verifieLe: string; condamnations: Condamnation[] }`, `NON_VERIFIE: ConstatIntegrite`, `validerIntegrite(brut: unknown): string[]` (liste d'erreurs, vide si valide), `constatIntegrite(integrite: Integrite | undefined): ConstatIntegrite`, `chargerIntegrites(modules?: Record<string, { default: unknown }>): Record<string, Integrite>`, `INTEGRITES: Record<string, Integrite>`.

Affinement de la spec : chaque condamnation porte `sources` (≥ 2, dont ≥ 1 primaire), conformément à la règle de sourçage écrite dans la spec.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/integrite.test.ts
import { describe, expect, it } from "vitest";
import { chargerIntegrites, constatIntegrite, INTEGRITES, validerIntegrite, type Integrite } from "./integrite";

const src = (type: "primaire" | "secondaire" = "primaire") => ({ type, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/x" });
const condamnation = () => ({ nature: "nature", juridiction: "Cour de cassation", date_decision: "2025-06-10", peine: "peine", sources: [src("primaire"), src("secondaire")] });
const valide = (): Integrite => ({ slug: "x", verifie_le: "2026-09-29", sources_consultees: [src()], condamnations_definitives: [] });

describe("validerIntegrite", () => {
  it("accepte un fichier complet, avec ou sans condamnation", () => {
    expect(validerIntegrite(valide())).toEqual([]);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [condamnation()] })).toEqual([]);
  });
  it("refuse un fichier sans source consultée : rien ne prouve la vérification", () => {
    expect(validerIntegrite({ ...valide(), sources_consultees: [] }).length).toBeGreaterThan(0);
  });
  it("refuse une date de vérification absente ou mal formée", () => {
    expect(validerIntegrite({ ...valide(), verifie_le: "" }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), verifie_le: "29/09/2026" }).length).toBeGreaterThan(0);
  });
  it("refuse une condamnation sans source, avec une seule source, ou sans source primaire", () => {
    const sans = { ...condamnation(), sources: [] };
    const une = { ...condamnation(), sources: [src("primaire")] };
    const aucunePrimaire = { ...condamnation(), sources: [src("secondaire"), src("secondaire")] };
    for (const c of [sans, une, aucunePrimaire]) {
      expect(validerIntegrite({ ...valide(), condamnations_definitives: [c] }).length).toBeGreaterThan(0);
    }
  });
  it("refuse une source sans URL http(s), sans nom ou sans année", () => {
    for (const mauvaise of [{ ...src(), url: "legifrance" }, { ...src(), nom: "" }, { ...src(), annee: "2026" }]) {
      expect(validerIntegrite({ ...valide(), sources_consultees: [mauvaise] }).length).toBeGreaterThan(0);
    }
  });
  it("refuse une condamnation sans date de décision ou sans nature", () => {
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), date_decision: "" }] }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), nature: "" }] }).length).toBeGreaterThan(0);
  });
  it("refuse tout ce qui n'est pas un objet", () => {
    for (const brut of [null, "x", 3, []]) expect(validerIntegrite(brut).length).toBeGreaterThan(0);
  });
});

describe("constatIntegrite", () => {
  it("sans fichier : non vérifié, jamais « aucune condamnation »", () => {
    expect(constatIntegrite(undefined)).toEqual({ etat: "non_verifie" });
  });
  it("fichier vide de condamnations mais sans sources : non vérifié", () => {
    expect(constatIntegrite({ ...valide(), sources_consultees: [] }).etat).toBe("non_verifie");
  });
  it("aucune condamnation avec sources et date : aucune recensée, datée", () => {
    expect(constatIntegrite(valide())).toMatchObject({ etat: "aucune_recensee", verifieLe: "2026-09-29" });
  });
  it("condamnation définitive : recensée, avec ses détails", () => {
    const c = constatIntegrite({ ...valide(), condamnations_definitives: [condamnation()] });
    expect(c).toMatchObject({ etat: "recensee", verifieLe: "2026-09-29" });
    if (c.etat === "recensee") expect(c.condamnations).toHaveLength(1);
  });
});

describe("chargerIntegrites", () => {
  it("garde les fichiers valides dont le slug est le nom du fichier", () => {
    const charges = chargerIntegrites({ "../../data/integrite/x.json": { default: valide() } });
    expect(Object.keys(charges)).toEqual(["x"]);
  });
  it("écarte un fichier invalide ou dont le slug diffère du nom du fichier", () => {
    const charges = chargerIntegrites({
      "../../data/integrite/y.json": { default: valide() }, // slug interne « x » ≠ « y »
      "../../data/integrite/x.json": { default: { ...valide(), sources_consultees: [] } },
    });
    expect(charges).toEqual({});
  });
});

describe("données réelles", () => {
  it("tous les fichiers de data/integrite sont valides (le dossier peut être vide)", () => {
    for (const [slug, integrite] of Object.entries(INTEGRITES)) {
      expect(validerIntegrite(integrite), slug).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/integrite.test.ts`
Expected: FAIL (module `./integrite` introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/integrite.ts
// Faits d'intégrité, par candidat : condamnations DÉFINITIVES seulement, attribuées, datées et sourcées (deux sources dont
// une primaire). Règle centrale : l'absence de donnée n'est JAMAIS une absence de condamnation — sans fichier valide,
// l'état est « non vérifié ». Voir docs/superpowers/specs/2026-09-29-convictions-design.md.

export interface SourceIntegrite {
  type: "primaire" | "secondaire";
  nom: string;
  annee: number;
  url: string;
}

export interface Condamnation {
  nature: string;
  juridiction: string;
  date_decision: string;
  peine: string;
  sources: SourceIntegrite[];
}

export interface Integrite {
  slug: string;
  verifie_le: string;
  sources_consultees: SourceIntegrite[];
  condamnations_definitives: Condamnation[];
}

export type ConstatIntegrite =
  | { etat: "non_verifie" }
  | { etat: "aucune_recensee"; verifieLe: string; sources: SourceIntegrite[] }
  | { etat: "recensee"; verifieLe: string; condamnations: Condamnation[] };

export const NON_VERIFIE: ConstatIntegrite = { etat: "non_verifie" };

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const texte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const objet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function erreursSource(source: unknown, chemin: string): string[] {
  if (!objet(source)) return [`${chemin} : source manquante`];
  const erreurs: string[] = [];
  if (source.type !== "primaire" && source.type !== "secondaire") erreurs.push(`${chemin}.type doit valoir primaire ou secondaire`);
  if (!texte(source.nom)) erreurs.push(`${chemin}.nom manquant`);
  if (!Number.isInteger(source.annee)) erreurs.push(`${chemin}.annee doit etre un entier`);
  if (!texte(source.url) || !/^https?:\/\//.test(source.url)) erreurs.push(`${chemin}.url doit commencer par http(s)://`);
  return erreurs;
}

function erreursCondamnation(c: unknown, chemin: string): string[] {
  if (!objet(c)) return [`${chemin} : condamnation manquante`];
  const erreurs: string[] = [];
  for (const champ of ["nature", "juridiction", "peine"] as const) if (!texte(c[champ])) erreurs.push(`${chemin}.${champ} manquant`);
  if (!texte(c.date_decision) || !DATE_ISO.test(c.date_decision)) erreurs.push(`${chemin}.date_decision doit etre AAAA-MM-JJ`);
  if (!Array.isArray(c.sources) || c.sources.length < 2) {
    erreurs.push(`${chemin}.sources : au moins deux sources sont requises`);
  } else {
    c.sources.forEach((s, i) => erreurs.push(...erreursSource(s, `${chemin}.sources[${i}]`)));
    if (!c.sources.some((s) => objet(s) && s.type === "primaire")) erreurs.push(`${chemin}.sources : au moins une source primaire est requise`);
  }
  return erreurs;
}

// Liste d'erreurs lisibles ; vide si le fichier est valide.
export function validerIntegrite(brut: unknown): string[] {
  if (!objet(brut)) return ["le fichier doit etre un objet"];
  const erreurs: string[] = [];
  if (!texte(brut.slug)) erreurs.push("slug manquant");
  if (!texte(brut.verifie_le) || !DATE_ISO.test(brut.verifie_le)) erreurs.push("verifie_le doit etre AAAA-MM-JJ");
  if (!Array.isArray(brut.sources_consultees) || brut.sources_consultees.length === 0) {
    erreurs.push("sources_consultees : au moins une source est requise");
  } else {
    brut.sources_consultees.forEach((s, i) => erreurs.push(...erreursSource(s, `sources_consultees[${i}]`)));
  }
  if (!Array.isArray(brut.condamnations_definitives)) {
    erreurs.push("condamnations_definitives doit etre une liste");
  } else {
    brut.condamnations_definitives.forEach((c, i) => erreurs.push(...erreursCondamnation(c, `condamnations_definitives[${i}]`)));
  }
  return erreurs;
}

export function constatIntegrite(integrite: Integrite | undefined): ConstatIntegrite {
  if (!integrite || validerIntegrite(integrite).length > 0) return NON_VERIFIE;
  if (integrite.condamnations_definitives.length > 0) {
    return { etat: "recensee", verifieLe: integrite.verifie_le, condamnations: integrite.condamnations_definitives };
  }
  return { etat: "aucune_recensee", verifieLe: integrite.verifie_le, sources: integrite.sources_consultees };
}

// Un fichier n'est retenu que s'il est valide ET si son slug est celui de son nom de fichier (jamais deviné).
export function chargerIntegrites(modules: Record<string, { default: unknown }>): Record<string, Integrite> {
  const charges: Record<string, Integrite> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    const slug = chemin.split("/").pop()?.replace(/\.json$/, "");
    const brut = module.default;
    if (!slug || validerIntegrite(brut).length > 0) continue;
    if ((brut as Integrite).slug !== slug) continue;
    charges[slug] = brut as Integrite;
  }
  return charges;
}

const modulesIntegrite = import.meta.glob("../../data/integrite/*.json", { eager: true }) as Record<string, { default: unknown }>;
export const INTEGRITES: Record<string, Integrite> = chargerIntegrites(modulesIntegrite);
```

Créer aussi le dossier vide versionné : `data/integrite/.gitkeep` (fichier vide).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/integrite.test.ts`
Expected: PASS. Puis `npx tsc --noEmit -p .` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/data/integrite.ts src/data/integrite.test.ts data/integrite/.gitkeep
git commit -m "Convictions : faits d integrite sources, valides strictement" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mémoire des convictions du visiteur

**Files:**
- Create: `src/ui/memoireConvictions.ts`
- Test: `src/ui/memoireConvictions.test.ts`

**Interfaces:**
- Consumes: `GROUPES_SOCIAUX` (Task 1).
- Produces: `interface Convictions { groupes: string[]; exemplarite: boolean }`, `CONVICTIONS_VIDES: Convictions`, `assainirConvictions(brut: unknown): Convictions`, `lireConvictions(): Convictions`, `memoriserConvictions(c: Convictions): void`, `aDesConvictions(c: Convictions): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/memoireConvictions.test.ts
import { describe, expect, it } from "vitest";
import { aDesConvictions, assainirConvictions, CONVICTIONS_VIDES, lireConvictions } from "./memoireConvictions";

describe("assainirConvictions", () => {
  it("garde les groupes connus et l'exemplarité", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "retraites"], exemplarite: true })).toEqual({ groupes: ["jeunes", "retraites"], exemplarite: true });
  });
  it("écarte un groupe disparu du catalogue, sans erreur", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "inconnu"], exemplarite: false }).groupes).toEqual(["jeunes"]);
  });
  it("écarte les doublons et les types inattendus", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "jeunes", 3, null], exemplarite: "oui" })).toEqual({ groupes: ["jeunes"], exemplarite: false });
  });
  it.each([null, undefined, "x", 4, [], { groupes: "jeunes" }])("valeur corrompue %j : convictions vides", (brut) => {
    expect(assainirConvictions(brut)).toEqual(CONVICTIONS_VIDES);
  });
});

describe("lireConvictions / aDesConvictions", () => {
  it("sans stockage disponible (rendu serveur) : convictions vides", () => {
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
  it("aDesConvictions est faux pour le vide, vrai dès un choix", () => {
    expect(aDesConvictions(CONVICTIONS_VIDES)).toBe(false);
    expect(aDesConvictions({ groupes: [], exemplarite: true })).toBe(true);
    expect(aDesConvictions({ groupes: ["jeunes"], exemplarite: false })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/memoireConvictions.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/memoireConvictions.ts
import { GROUPES_SOCIAUX } from "../convictions";

// Convictions du visiteur : gardées dans SON navigateur (localStorage), jamais transmises, effaçables — mêmes garde-fous
// que les réponses (voir memoireReponses.ts). Stockage absent ou refusé : jamais bloquant.
export interface Convictions {
  // Identifiants de GROUPES_SOCIAUX : « je veux un candidat dont les mesures améliorent la situation de… ».
  groupes: string[];
  // « Je tiens à un candidat sans condamnation définitive » : affiche les faits d'intégrité sourcés.
  exemplarite: boolean;
}

export const CONVICTIONS_VIDES: Convictions = { groupes: [], exemplarite: false };
const CLE_CONVICTIONS = "convictions-visiteur";

export function aDesConvictions(c: Convictions): boolean {
  return c.groupes.length > 0 || c.exemplarite;
}

// Ne garde que ce qui est valide pour le catalogue actuel : un groupe disparu est écarté, jamais deviné.
export function assainirConvictions(brut: unknown): Convictions {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return CONVICTIONS_VIDES;
  const stocke = brut as Record<string, unknown>;
  const connus = new Set(GROUPES_SOCIAUX.map((g) => g.id));
  const groupes = Array.isArray(stocke.groupes) ? [...new Set(stocke.groupes.filter((g): g is string => typeof g === "string" && connus.has(g)))] : [];
  return { groupes, exemplarite: stocke.exemplarite === true };
}

export function lireConvictions(): Convictions {
  try {
    const texte = window.localStorage.getItem(CLE_CONVICTIONS);
    return texte ? assainirConvictions(JSON.parse(texte)) : CONVICTIONS_VIDES;
  } catch {
    return CONVICTIONS_VIDES;
  }
}

export function memoriserConvictions(convictions: Convictions): void {
  try {
    if (aDesConvictions(convictions)) window.localStorage.setItem(CLE_CONVICTIONS, JSON.stringify(convictions));
    else window.localStorage.removeItem(CLE_CONVICTIONS);
  } catch {
    // sans conséquence : les convictions restent en mémoire pour cette session
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/memoireConvictions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/memoireConvictions.ts src/ui/memoireConvictions.test.ts
git commit -m "Convictions : memoire dans le navigateur du visiteur" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Interface — bloc « Mes convictions » et panneau du détail candidat

**Files:**
- Create: `src/ui/Convictions.tsx`
- Modify: `src/ui/VueThemes.tsx` (props de `VueThemes`, `CarteTheme`, `DetailCandidat`)
- Modify: `src/ui/PageThemes.tsx`
- Modify: `src/index.css`
- Test: `src/ui/Convictions.test.tsx`, `src/ui/PageThemes.test.tsx` (ajout)

**Interfaces:**
- Consumes: `GROUPES_SOCIAUX`, `GroupeSocial` (Task 1) ; `projeterConviction` (Task 1) ; `ConstatIntegrite`, `NON_VERIFIE`, `constatIntegrite`, `INTEGRITES` (Task 2) ; `Convictions`, `CONVICTIONS_VIDES`, `aDesConvictions`, `lireConvictions`, `memoriserConvictions` (Task 3) ; `NIVEAUX` (`src/ui/projection.ts`, `{ libelle, symbole, sens }` par niveau) ; `Proposition`.
- Produces: `BlocConvictions(props: { convictions: Convictions; onChange: (c: Convictions) => void; aveugle: boolean })`, `PanneauConvictions(props: { propositions: Proposition[]; convictions: Convictions; integrite: ConstatIntegrite | null })` ; nouvelles props optionnelles `convictions?: Convictions` et `integrites?: Record<string, ConstatIntegrite> | null` sur `VueThemes` (transmises jusqu'à `DetailCandidat`) ; props de `PageThemes` : `convictionsInitiales?: Convictions`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/ui/Convictions.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { BlocConvictions, PanneauConvictions } from "./Convictions";
import { CONVICTIONS_VIDES } from "./memoireConvictions";

const effet: Effet = { cibles: [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }], dimension: "revenu_disponible", sens: "hausse", source_url: "https://exemple.fr/a", extrait: "extrait de test suffisamment long" };
const prop = (effets: Effet[]): Proposition => ({ id: "a", candidat: "x", theme: "fiscalite", titre: "t", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-29", effets });
const src = { type: "primaire" as const, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/decision-x" };
const RECENSEE: ConstatIntegrite = { etat: "recensee", verifieLe: "2026-09-29", condamnations: [{ nature: "nature-x", juridiction: "juridiction-x", date_decision: "2025-06-10", peine: "peine-x", sources: [src, { ...src, type: "secondaire", url: "https://presse.fr/y" }] }] };
const AUCUNE: ConstatIntegrite = { etat: "aucune_recensee", verifieLe: "2026-09-29", sources: [src] };

const rendre = (c: Parameters<typeof PanneauConvictions>[0]) => renderToStaticMarkup(<PanneauConvictions {...c} />);

describe("BlocConvictions", () => {
  it("propose les groupes en cases à cocher et l'exemplarité en interrupteur, facultatifs", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} aveugle={false} />);
    expect(html).toContain("Mes convictions");
    expect(html).toContain("Les personnes à faibles revenus");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("sans condamnation définitive");
    expect(html).toContain("gardées dans votre navigateur");
  });
  it("coche ce que le visiteur a choisi", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["jeunes"], exemplarite: false }} onChange={() => {}} aveugle={false} />);
    expect(html).toMatch(/checked[^>]*>[\s\S]*Les jeunes de moins de 30 ans/);
  });
  it("mode aveugle : dit que l'intégrité est masquée", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: [], exemplarite: true }} onChange={() => {}} aveugle={true} />);
    expect(html).toContain("masqué");
  });
});

describe("PanneauConvictions", () => {
  it("sans conviction : rien", () => {
    expect(rendre({ propositions: [prop([effet])], convictions: CONVICTIONS_VIDES, integrite: null })).toBe("");
  });
  it("valeurs sociales : mot + symbole du niveau, sans score", () => {
    const html = rendre({ propositions: [prop([effet])], convictions: { groupes: ["faibles_revenus"], exemplarite: false }, integrite: null });
    expect(html).toContain("Améliorant");
    expect(html).not.toMatch(/score|note|classement/i);
  });
  it("candidat sans effet structuré : pas d'indicateur, jamais « non concerné »", () => {
    const html = rendre({ propositions: [prop([])], convictions: { groupes: ["faibles_revenus"], exemplarite: false }, integrite: null });
    expect(html).toContain("Pas d'indicateur");
    expect(html).not.toContain("Non concerné");
  });
  it("intégrité recensée : nature, juridiction, date et liens vers les sources", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: RECENSEE });
    for (const t of ["nature-x", "juridiction-x", "2025-06-10", "https://www.legifrance.gouv.fr/decision-x", "https://presse.fr/y"]) expect(html).toContain(t);
  });
  it("aucune condamnation recensée : datée et attribuée aux sources consultées", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: AUCUNE });
    expect(html).toContain("2026-09-29");
    expect(html).toContain("d'après les sources consultées");
  });
  it("non vérifié : ne dit jamais « aucune condamnation »", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: { etat: "non_verifie" } });
    expect(html).toContain("non vérifiée");
    expect(html).not.toMatch(/aucune condamnation/i);
  });
  it("intégrité masquée (integrite null, mode aveugle) : aucun fait rendu", () => {
    const html = rendre({ propositions: [prop([effet])], convictions: { groupes: ["faibles_revenus"], exemplarite: true }, integrite: null });
    expect(html).not.toContain("condamnation");
  });
});
```

Ajouter à la fin de `src/ui/PageThemes.test.tsx` :

```tsx
describe("bloc « Mes convictions » sur la page du simulateur", () => {
  it("affiché en mode simulateur, absent en mode exploration même avec des convictions enregistrées", () => {
    const base = chargerBase("agregateurs");
    const page = (mode: "simulateur" | "exploration") =>
      renderToStaticMarkup(
        <PageThemes base={base} profil={{}} generalSoumis={false} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} convictionsInitiales={{ groupes: ["jeunes"], exemplarite: true }} />,
      );
    expect(page("simulateur")).toContain("Mes convictions");
    expect(page("exploration")).not.toContain("Mes convictions");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/Convictions.test.tsx src/ui/PageThemes.test.tsx`
Expected: FAIL (module `./Convictions` introuvable ; prop `convictionsInitiales` inconnue).

- [ ] **Step 3: Write minimal implementation**

`src/ui/Convictions.tsx` :

```tsx
import { GROUPES_SOCIAUX } from "../convictions";
import type { ConstatIntegrite } from "../data/integrite";
import { projeterConviction } from "../engine/convictions";
import type { Proposition } from "../types";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
import { NIVEAUX } from "./projection";

// Bloc de questions « Mes convictions » : facultatif, séparé de « Ma situation » (aucun score, aucun classement).
export function BlocConvictions({ convictions, onChange, aveugle }: { convictions: Convictions; onChange: (c: Convictions) => void; aveugle: boolean }) {
  const basculer = (id: string, coche: boolean) =>
    onChange({ ...convictions, groupes: coche ? [...convictions.groupes, id] : convictions.groupes.filter((g) => g !== id) });
  return (
    <section className="convictions" aria-label="Mes convictions">
      <h2>Mes convictions</h2>
      <p className="hint">
        Facultatif. Ces choix s'affichent à part, dans le détail de chaque candidat : ils ne changent pas les indicateurs « Ma situation ». Elles sont gardées dans votre navigateur tant que vous ne les effacez pas.
      </p>
      <fieldset>
        <legend>Je veux un candidat dont les mesures améliorent la situation de :</legend>
        {GROUPES_SOCIAUX.map((g) => (
          <label key={g.id} className="case">
            <input type="checkbox" checked={convictions.groupes.includes(g.id)} onChange={(e) => basculer(g.id, e.target.checked)} />
            {g.libelle}
          </label>
        ))}
      </fieldset>
      <label className="interrupteur">
        <input type="checkbox" role="switch" checked={convictions.exemplarite} onChange={(e) => onChange({ ...convictions, exemplarite: e.target.checked })} />
        <span className="interrupteur-piste" aria-hidden="true" />
        Je tiens à un candidat sans condamnation définitive
      </label>
      {aveugle && convictions.exemplarite && <p className="hint">Les faits d'intégrité sont masqués tant que les candidats sont masqués.</p>}
      {aDesConvictions(convictions) && (
        <button type="button" className="secondaire" onClick={() => onChange(CONVICTIONS_VIDES)}>
          Effacer mes convictions
        </button>
      )}
    </section>
  );
}

function ConstatIntegriteTexte({ integrite }: { integrite: ConstatIntegrite }) {
  if (integrite.etat === "non_verifie") {
    return (
      <p>
        <span aria-hidden="true">? </span>
        <strong>Intégrité non vérifiée</strong> : aucune donnée sourcée pour ce candidat.
      </p>
    );
  }
  if (integrite.etat === "aucune_recensee") {
    return (
      <p>
        <span aria-hidden="true">○ </span>
        <strong>Aucune condamnation définitive recensée</strong>, d'après les sources consultées le {integrite.verifieLe} :{" "}
        {integrite.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noopener noreferrer">{`${s.nom} · ${s.annee}`}</a>
          </span>
        ))}
        .
      </p>
    );
  }
  return (
    <div>
      <p>
        <span aria-hidden="true">● </span>
        <strong>Condamnation définitive recensée</strong> (sources consultées le {integrite.verifieLe})
      </p>
      <ul>
        {integrite.condamnations.map((c) => (
          <li key={`${c.date_decision}-${c.nature}`}>
            {c.nature}, {c.juridiction}, décision du {c.date_decision} ({c.peine}).{" "}
            {c.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{`${s.nom} · ${s.annee}`}</a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Panneau du détail d'un candidat : deux constats séparés, sans score. `integrite` est null quand les faits d'intégrité
// ne doivent pas s'afficher (option désactivée, ou mode aveugle : un casier identifie le candidat).
export function PanneauConvictions({ propositions, convictions, integrite }: { propositions: Proposition[]; convictions: Convictions; integrite: ConstatIntegrite | null }) {
  const groupes = GROUPES_SOCIAUX.filter((g) => convictions.groupes.includes(g.id));
  const social = groupes.length > 0 ? projeterConviction(groupes, propositions) : null;
  if (!social && !integrite) return null;
  return (
    <section className="panneau-convictions" aria-label="Convictions">
      {social && (
        <p>
          <strong>Valeurs sociales :</strong>{" "}
          {social.niveau ? (
            <>
              <span aria-hidden="true">{NIVEAUX[social.niveau].symbole}</span> {NIVEAUX[social.niveau].libelle} pour les groupes que vous avez choisis.
            </>
          ) : (
            "Pas d'indicateur : les mesures de ce thème ne permettent pas de conclure pour ces groupes."
          )}
        </p>
      )}
      {integrite && <ConstatIntegriteTexte integrite={integrite} />}
    </section>
  );
}
```

`src/ui/VueThemes.tsx` — trois modifications :

1. Imports : ajouter
```tsx
import { NON_VERIFIE, type ConstatIntegrite } from "../data/integrite";
import { PanneauConvictions } from "./Convictions";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
```
2. `DetailCandidat` : ajouter à sa signature les props `convictions?: Convictions; integrite?: ConstatIntegrite | null`, et insérer, juste avant le bloc `{projection && (niveau ? (`, ce rendu :
```tsx
      {convictions && aDesConvictions(convictions) && (
        <PanneauConvictions propositions={propositions} convictions={convictions} integrite={convictions.exemplarite ? (integrite ?? null) : null} />
      )}
```
3. `CarteTheme` et `VueThemes` : ajouter les props `convictions?: Convictions` et `integrites?: Record<string, ConstatIntegrite> | null` ; dans `VueThemes` les passer à chaque `<CarteTheme … convictions={convictions} integrites={integrites} />` ; dans `CarteTheme`, au rendu de `<DetailCandidat …>` ajouter
```tsx
convictions={convictions}
integrite={integrites ? (integrites[ligneOuverte.meta.slug] ?? NON_VERIFIE) : null}
```
(Les valeurs par défaut `convictions = CONVICTIONS_VIDES`, `integrites = null` dans la déstructuration de `VueThemes`.)

`src/ui/PageThemes.tsx` :

- Imports :
```tsx
import { constatIntegrite, INTEGRITES } from "../data/integrite";
import { BlocConvictions } from "./Convictions";
import { CONVICTIONS_VIDES, lireConvictions, memoriserConvictions, type Convictions } from "./memoireConvictions";
```
- Prop `convictionsInitiales?: Convictions;` ajoutée à `PageThemesProps` et à la déstructuration.
- Après l'état `aveugle` :
```tsx
  // Convictions : bloc et panneau seulement en mode « Simuler pour moi » (elles rattachent les mesures au visiteur).
  const [convictions, setConvictions] = useState<Convictions>(() => convictionsInitiales ?? lireConvictions());
  useEffect(() => memoriserConvictions(convictions), [convictions]);
  // Faits d'intégrité : seulement si le visiteur y tient, en simulateur, et jamais à l'aveugle (un casier identifie).
  const integrites =
    simulateur && convictions.exemplarite && !aveugle
      ? Object.fromEntries(candidats.map((c) => [c.meta.slug, constatIntegrite(INTEGRITES[c.meta.slug])]))
      : null;
```
- Avant `<VueThemes`, ajouter : `{simulateur && <BlocConvictions convictions={convictions} onChange={setConvictions} aveugle={aveugle} />}`
- Dans `<VueThemes …>` ajouter `convictions={simulateur ? convictions : CONVICTIONS_VIDES}` et `integrites={integrites}`.

Attention : `simulateur` est défini avant `candidats`? Vérifier l'ordre des déclarations (`simulateur` ligne 35, `candidats` ligne 39, l'état `aveugle` après `cardsNommees`) : placer ce bloc après la déclaration de `aveugle`.

`src/index.css` (fin de fichier) :

```css
.convictions {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--bordure, #ccd);
  border-radius: 0.75rem;
}
.convictions fieldset {
  border: 0;
  margin: 0.75rem 0;
  padding: 0;
}
.convictions .case {
  display: block;
  margin: 0.25rem 0;
}
.panneau-convictions {
  margin: 0.75rem 0;
  padding: 0.5rem 0.75rem;
  border-left: 4px solid #1f3f9e;
  background: #f4f6fc;
}
```
(Bleu = couleur d'action ; jamais de rouge/vert ici, réservés aux effets.)

- [ ] **Step 4: Run tests and typecheck**

Run: `npx tsc --noEmit -p . ; npx vitest run src/ui`
Expected: PASS (aucun test UI existant cassé).

- [ ] **Step 5: Commit**

```bash
git add src/ui/Convictions.tsx src/ui/Convictions.test.tsx src/ui/VueThemes.tsx src/ui/PageThemes.tsx src/ui/PageThemes.test.tsx src/index.css
git commit -m "Convictions : bloc Mes convictions et panneau du detail candidat" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Règles écrites (méthodologie, CLAUDE.md) et vérification finale

**Files:**
- Modify: `docs/methodologie.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: la trace écrite des règles de l'axe.

- [ ] **Step 1: Ajouter à la fin de `docs/methodologie.md`**

```markdown

## Axe « Convictions » (2026-09-29)

Axe séparé de l'indicateur « Ma situation » : aucun score, aucun classement, aucune moyenne entre axes.

- **Valeurs sociales** : le visiteur choisit des groupes (catalogue `src/convictions.ts`) ; le constat par thème
  (`src/engine/convictions.ts`) applique la même table de polarité que l'indicateur principal. Un effet compte pour un
  groupe s'il vise tout le monde, ou s'il a un critère sur le champ du groupe qui le recoupe entièrement ; jamais
  d'élargissement par approximation. Sans effet structuré : « pas d'indicateur ».
- **Intégrité** : `data/integrite/<slug>.json`. Condamnations **définitives** seulement (ni mise en examen, ni enquête, ni
  première instance en appel). Chaque condamnation : nature, juridiction, date de décision, peine, et **au moins deux
  sources dont une primaire**. « Aucune condamnation recensée » n'est affiché que si `verifie_le` et
  `sources_consultees` sont renseignés, et se dit toujours « d'après les sources consultées le <date> ». **Sans fichier
  valide : « non vérifié »**, jamais « aucune condamnation ».
- Mêmes règles pour tous les candidats. Aucune donnée n'est saisie sans source relue par le porteur du projet. Les
  condamnations effacées (amnistie, réhabilitation) sont à traiter selon un avis juridique avant publication.
- Mode aveugle : les faits d'intégrité ne s'affichent pas (un casier identifie le candidat).
```

- [ ] **Step 2: Ajouter dans `CLAUDE.md`**, juste avant le paragraphe « **Tiroir de portraits en mode simulateur… »

```markdown
**Axe « Convictions » (décision du 2026-09-29, spec `docs/superpowers/specs/2026-09-29-convictions-design.md`).** Bloc « Mes convictions » en mode simulateur seulement, séparé de « Ma situation », **sans score ni classement**. Valeurs sociales (groupes choisis, mêmes effets et même polarité) et intégrité en faits sourcés (`data/integrite/`, condamnations définitives, deux sources dont une primaire ; sans fichier valide : « non vérifié », jamais « aucune condamnation »). Faits masqués en mode aveugle. Aucune donnée d'intégrité n'est encore saisie.
```

- [ ] **Step 3: Vérification finale**

Run: `npx tsc --noEmit -p . ; npx vitest run`
Expected: tout passe, à l'exception éventuelle de `src/data/candidats.test.ts` (« ids uniques ») dont l'échec précède ce travail (données `le-pen` modifiées hors de ce plan) : le signaler sans le corriger.

- [ ] **Step 4: Commit**

```bash
git add docs/methodologie.md CLAUDE.md
git commit -m "Convictions : regles ecrites (methodologie et CLAUDE.md)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Couverture de la spec** : axe séparé sans score (Global Constraints, Tasks 1 et 4) ; deux familles (Tasks 1 et 2) ; états d'intégrité et règle « absence ≠ aucune condamnation » (Task 2) ; règles de sourçage (validation Task 2) ; mode aveugle (Task 4, `integrites` null à l'aveugle) ; exploration sans convictions (Task 4) ; mémoire navigateur effaçable (Tasks 3 et 4) ; docs (Task 5). Points ouverts de la spec : placement = bloc dans le simulateur (choisi) ; effacements légaux / collecte des faits = hors code, notés en méthodologie ; liste des groupes = catalogue Task 1 validé contre les options du formulaire.
- **Écart assumé** : `sources` (liste) par condamnation, au lieu du `source` unique de l'esquisse JSON de la spec, pour appliquer sa règle « deux sources dont une primaire ».
- **Cohérence des types** : `GroupeSocial.critere` (Task 1) utilisé en Tasks 1 et 4 ; `ConstatIntegrite` / `NON_VERIFIE` (Task 2) utilisés en Task 4 ; `Convictions` (Task 3) utilisé en Task 4.
- **Non couvert volontairement** : saisie de faits sur des candidats, collecte automatisée, mises en examen.
