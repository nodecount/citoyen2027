# Candidat idéal, simulateur à l'aveugle par défaut — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En mode simulateur, masquer les candidats par défaut (sans interrupteur) et afficher en haut des thèmes une card floutée « candidat idéal » (selon la situation, et selon les convictions) qu'un bouton révèle, avec « Recommencer la simulation ».

**Architecture:** Calcul pur des soldes (améliorants − dégradants) dans `src/engine/candidatIdeal.ts`, sur les cards **non anonymisées** ; composant de présentation `CardCandidatIdeal` qui ne reçoit l'identité qu'une fois révélée ; `PageThemes` orchestre (masquage = mode simulateur, état `revele`, retrait du formulaire, recommencer).

**Tech Stack:** React 18 / Vite / TypeScript, vitest (`npx vitest run`), rendu de test par `renderToStaticMarkup` (environnement sans `window`).

**Spec:** `docs/superpowers/specs/2026-09-30-candidat-ideal-design.md`

## Global Constraints

- Le classement n'existe **que** dans la card « candidat idéal » : ni score ni ordre par indicateur dans les cards de thèmes ni dans le tiroir de portraits.
- Solde = (thèmes « améliorant ») − (thèmes « dégradant ») ; « mixte », « non concerné », sans indicateur = 0 ; **aucune pondération** ; même règle pour tous.
- Égalité : **tous les ex æquo**, jamais départagés par l'ordre alphabétique ; égalité générale : « les données ne permettent pas de départager les candidats ».
- Mode « Explorer les mesures » : **identités visibles** (noms, vrais portraits), aucune card idéale. Mode « Simuler pour moi » : toujours masqué, sans interrupteur ; cards de thèmes masquées **même après la révélation**.
- Card floutée : le nom réel, le slug réel et l'URL du portrait ne sont **pas dans le DOM** (le flou CSS n'est jamais la seule protection).
- Deux résultats séparés (situation, convictions) ; celui des convictions n'existe que si un groupe est choisi.
- « Sans condamnation définitive » coché : un candidat « condamnation définitive recensée » est écarté du résultat convictions, et la card le dit ; « non vérifié » n'est pas écarté.
- Formulation du bandeau (verbatim) : « Cette card contient le meilleur programme selon votre situation et le meilleur programme selon vos convictions. Votre résultat peut être affiné si vous répondez aux X questions propres aux thèmes, directement dans ceux-ci. » ; bouton : « Révéler mon programme de candidat idéal pour 2027 » ; puis « Recommencer la simulation ».
- Police 14 px minimum, focus visible, couleur jamais seule, `prefers-reduced-motion` respecté ; bleu = couleur d'action.
- Le code suit le style existant : identifiants et commentaires en français, guillemets doubles, points-virgules.
- Messages de commit sans apostrophe (le bash du dépôt les gère mal), terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Outils : préférer PowerShell et les outils d'édition aux heredocs bash.

## Review Focus

- Un candidat **sans aucun indicateur** (aucune mesure analysée) ne doit jamais « gagner » par absence de données quand les autres ont un solde négatif : il est non éligible (Task 1).
- Card floutée : aucune fuite du nom, du slug ou de la photo réels, même si la donnée est fournie au composant sans avoir été révélée (Task 3).
- Arrivée depuis le tableau de l'accueil (lien qui nomme un candidat) : elle doit ouvrir le mode exploration, pas un simulateur masqué où le candidat est introuvable (Task 2).
- Passage simulateur → exploration → simulateur, et « Recommencer » : nouvelles lettres, card refloutée, réponses et convictions intactes (Task 4).
- Toutes les données à égalité (aucun indicateur) : message « ne permettent pas de départager », pas la liste des 22 candidats (Tasks 1 et 3).
- Bandeau : `X` égal à 0 → la phrase sur les questions disparaît ; `X` égal à 1 → singulier correct (Task 3).

## File Structure

| Fichier | Rôle |
|---|---|
| `src/engine/candidatIdeal.ts` (créer) | Soldes situation / convictions, `meilleurs`, écart par intégrité |
| `src/questionnaire.ts` (modifier) | `questionsRestantes` : questions de thème non répondues |
| `src/ui/aveugle.ts` (modifier) | `Correspondance` porte aussi `slug` et `parti` |
| `src/ui/CardCandidatIdeal.tsx` (créer) | Card + bandeau bleu, états flouté / révélé |
| `src/ui/PageThemes.tsx` (modifier) | Masquage par défaut, card, révélation, recommencer |
| `src/ui/memoireReponses.ts` (modifier) | Retrait de la mémoire de l'interrupteur (devenue inutile) |
| `src/index.css` (modifier) | Styles de la card et du flou |
| `docs/methodologie.md`, `CLAUDE.md` (modifier) | Règles écrites |

---

### Task 1: Soldes et « meilleurs » (moteur pur)

**Files:**
- Create: `src/engine/candidatIdeal.ts`
- Test: `src/engine/candidatIdeal.test.ts`

**Interfaces:**
- Consumes: `projeterConviction`, `GroupeSocial` (`src/engine/convictions.ts`, `src/convictions.ts`) ; `ConstatIntegrite` (`src/data/integrite.ts`) ; `NiveauProjection` (`src/engine/projection.ts`) ; `Proposition` (`src/types.ts`).
- Produces: `LignePourSolde`, `CardPourSolde` (types structurels : `CardTheme` de `src/ui/cards.ts` y est assignable) ; `interface Solde { slug: string; ameliorants: number; degradants: number; analyses: number; solde: number }` ; `soldesSituation(cards: CardPourSolde[]): Solde[]` ; `soldesConvictions(cards: CardPourSolde[], groupes: GroupeSocial[]): Solde[]` ; `interface Meilleurs { solde: number; gagnants: Solde[]; departageable: boolean; ecartes: number }` ; `meilleurs(soldes: Solde[], ecartes?: ReadonlySet<string>): Meilleurs | null` ; `ecartesParIntegrite(integrites: Record<string, ConstatIntegrite> | null): Set<string>`.

Règles : `analyses` = nombre de thèmes (situation) ou de constats groupe × thème (convictions) où le candidat a un niveau non nul ; un candidat à `analyses === 0` **n'est pas éligible** (il gagnerait par absence de données) ; `meilleurs` renvoie `null` seulement si `soldes` est vide, sinon `gagnants: []` quand personne n'est éligible ; `departageable` = au moins un éligible ET (un seul gagnant OU moins de gagnants que d'éligibles).

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/candidatIdeal.test.ts
import { describe, expect, it } from "vitest";
import { GROUPES_SOCIAUX } from "../convictions";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { ecartesParIntegrite, meilleurs, soldesConvictions, soldesSituation, type CardPourSolde, type Solde } from "./candidatIdeal";
import type { NiveauProjection } from "./projection";

const ligne = (slug: string, niveau: NiveauProjection | null, propositions: Proposition[] = []) => ({ meta: { slug }, projection: niveau === null ? null : { niveau }, propositions });
const card = (lignes: ReturnType<typeof ligne>[], absents: string[] = []): CardPourSolde => ({ lignes, absents: absents.map((slug) => ({ slug })) });
const solde = (slug: string, ameliorants: number, degradants: number, analyses = ameliorants + degradants): Solde => ({ slug, ameliorants, degradants, analyses, solde: ameliorants - degradants });

describe("soldesSituation", () => {
  it("améliorants moins dégradants ; mixte, non concerné et sans indicateur comptent zéro", () => {
    const cards = [
      card([ligne("a", "ameliorant"), ligne("b", "degradant")]),
      card([ligne("a", "ameliorant"), ligne("b", "mixte")]),
      card([ligne("a", "degradant"), ligne("b", "non_concerne")]),
      card([ligne("a", null), ligne("b", "ameliorant")]),
    ];
    const par = Object.fromEntries(soldesSituation(cards).map((s) => [s.slug, s]));
    expect(par.a).toMatchObject({ ameliorants: 2, degradants: 1, solde: 1, analyses: 3 });
    expect(par.b).toMatchObject({ ameliorants: 1, degradants: 1, solde: 0, analyses: 4 });
  });
  it("aucune pondération : chaque thème pèse pareil", () => {
    const cards = [card([ligne("a", "ameliorant")]), card([ligne("a", "degradant")]), card([ligne("a", "degradant")])];
    expect(soldesSituation(cards)[0].solde).toBe(-1);
  });
  it("un candidat présent seulement dans les absents est listé, à zéro analyse", () => {
    const s = soldesSituation([card([ligne("a", "ameliorant")], ["z"])]);
    expect(s.find((x) => x.slug === "z")).toMatchObject({ solde: 0, analyses: 0 });
  });
});

describe("soldesConvictions", () => {
  const effet = (cibles: Effet["cibles"], sens: Effet["sens"]): Effet => ({ cibles, dimension: "revenu_disponible", sens, source_url: "https://exemple.fr", extrait: "extrait suffisamment long" });
  const prop = (effets: Effet[]): Proposition => ({ id: "p", candidat: "x", theme: "t", titre: "t", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-30", effets });
  const g = (id: string) => GROUPES_SOCIAUX.find((x) => x.id === id)!;
  const JEUNES = [{ champ: "tranche_age", valeurs: ["moins_30"] }];

  it("compte un constat par groupe et par thème", () => {
    const cards = [card([ligne("a", null, [prop([effet(JEUNES, "hausse")])])]), card([ligne("a", null, [prop([effet(JEUNES, "baisse")])])])];
    const s = soldesConvictions(cards, [g("tranche_age:moins_30"), g("statut_professionnel:retraite")])[0];
    // jeunes : +1 puis -1 ; retraités : incertain (autre champ) donc non analysé
    expect(s).toMatchObject({ ameliorants: 1, degradants: 1, solde: 0, analyses: 2 });
  });
  it("sans groupe : tous à zéro analyse", () => {
    expect(soldesConvictions([card([ligne("a", null, [prop([effet(JEUNES, "hausse")])])])], []).every((x) => x.analyses === 0)).toBe(true);
  });
});

describe("meilleurs", () => {
  it("désigne le plus fort solde", () => {
    const m = meilleurs([solde("a", 2, 0), solde("b", 1, 0), solde("c", 0, 1)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
    expect(m.solde).toBe(2);
    expect(m.departageable).toBe(true);
  });
  it("égalité : tous les ex æquo, jamais départagés par l'ordre", () => {
    const m = meilleurs([solde("z", 1, 0), solde("a", 1, 0), solde("m", 0, 1)])!;
    expect(m.gagnants.map((x) => x.slug).sort()).toEqual(["a", "z"]);
    expect(m.departageable).toBe(true);
  });
  it("tous à égalité : ne permet pas de départager", () => {
    const m = meilleurs([solde("a", 1, 1), solde("b", 1, 1), solde("c", 2, 2)])!;
    expect(m.departageable).toBe(false);
  });
  it("un seul candidat éligible : désigné", () => {
    const m = meilleurs([solde("a", 0, 2), solde("b", 0, 0, 0)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
    expect(m.departageable).toBe(true);
  });
  it("le moins mauvais est désigné quand tout est négatif", () => {
    expect(meilleurs([solde("a", 0, 3), solde("b", 0, 1)])!.gagnants[0].slug).toBe("b");
  });
  it("un candidat sans aucun indicateur ne gagne jamais par absence de données", () => {
    const m = meilleurs([solde("a", 0, 2), solde("vide", 0, 0, 0)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
  });
  it("personne d'éligible : aucun gagnant, non départageable, pas d'erreur", () => {
    const m = meilleurs([solde("a", 0, 0, 0), solde("b", 0, 0, 0)])!;
    expect(m).toMatchObject({ gagnants: [], departageable: false });
  });
  it("liste vide : null", () => {
    expect(meilleurs([])).toBeNull();
  });
  it("les écartés sont retirés et comptés", () => {
    const m = meilleurs([solde("a", 3, 0), solde("b", 1, 0)], new Set(["a"]))!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["b"]);
    expect(m.ecartes).toBe(1);
  });
});

describe("ecartesParIntegrite", () => {
  const src = { type: "primaire" as const, nom: "n", annee: 2026, url: "https://x.fr" };
  it("écarte les condamnations définitives recensées, pas les non vérifiés ni les « aucune recensée »", () => {
    const integrites: Record<string, ConstatIntegrite> = {
      a: { etat: "recensee", verifieLe: "2026-09-30", condamnations: [] },
      b: { etat: "non_verifie" },
      c: { etat: "aucune_recensee", verifieLe: "2026-09-30", sources: [src] },
    };
    expect([...ecartesParIntegrite(integrites)]).toEqual(["a"]);
  });
  it("sans faits d'intégrité (null) : personne n'est écarté", () => {
    expect(ecartesParIntegrite(null).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/candidatIdeal.test.ts`
Expected: FAIL (module `./candidatIdeal` introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/candidatIdeal.ts
import type { GroupeSocial } from "../convictions";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { projeterConviction } from "./convictions";
import type { NiveauProjection } from "./projection";

// « Candidat idéal » : le SEUL endroit du produit où l'on désigne un candidat (exception décidée le 2026-09-30, voir
// CLAUDE.md). Règle publique et identique pour tous : solde = thèmes « améliorant » moins thèmes « dégradant » ; « mixte »,
// « non concerné » et l'absence d'indicateur comptent zéro ; aucune pondération entre thèmes.
export interface LignePourSolde {
  meta: { slug: string };
  projection: { niveau: NiveauProjection | null } | null;
  propositions: Proposition[];
}

// Structure minimale d'une card de thème (`CardTheme` y est assignable) : ce module ne dépend pas de l'interface.
export interface CardPourSolde {
  lignes: LignePourSolde[];
  absents: Array<{ slug: string }>;
}

export interface Solde {
  slug: string;
  ameliorants: number;
  degradants: number;
  // Thèmes (situation) ou constats groupe × thème (convictions) où le candidat a un niveau : la couverture du solde.
  analyses: number;
  solde: number;
}

function soldesVides(cards: CardPourSolde[]): Map<string, Solde> {
  const slugs = new Set<string>();
  for (const card of cards) {
    for (const l of card.lignes) slugs.add(l.meta.slug);
    for (const a of card.absents) slugs.add(a.slug);
  }
  return new Map([...slugs].sort().map((slug) => [slug, { slug, ameliorants: 0, degradants: 0, analyses: 0, solde: 0 }]));
}

function compter(s: Solde, niveau: NiveauProjection | null): void {
  if (niveau === null) return;
  s.analyses += 1;
  if (niveau === "ameliorant") s.ameliorants += 1;
  if (niveau === "degradant") s.degradants += 1;
  s.solde = s.ameliorants - s.degradants;
}

export function soldesSituation(cards: CardPourSolde[]): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) for (const l of card.lignes) compter(soldes.get(l.meta.slug)!, l.projection?.niveau ?? null);
  return [...soldes.values()];
}

// Convictions : un constat par groupe choisi et par thème (jamais une union de groupes, voir engine/convictions.ts).
export function soldesConvictions(cards: CardPourSolde[], groupes: GroupeSocial[]): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) {
    for (const l of card.lignes) {
      for (const g of groupes) compter(soldes.get(l.meta.slug)!, projeterConviction([g], l.propositions).niveau);
    }
  }
  return [...soldes.values()];
}

export interface Meilleurs {
  solde: number;
  gagnants: Solde[];
  // Faux quand tous les candidats éligibles sont à égalité (rien ne permet de les départager) ou quand aucun n'est éligible.
  departageable: boolean;
  ecartes: number;
}

// Un candidat sans aucun indicateur (`analyses === 0`) n'est pas éligible : il gagnerait par simple absence de données.
// Une égalité n'est JAMAIS tranchée par l'ordre alphabétique : tous les ex æquo sont renvoyés.
export function meilleurs(soldes: Solde[], ecartes: ReadonlySet<string> = new Set()): Meilleurs | null {
  if (soldes.length === 0) return null;
  const retenus = soldes.filter((s) => !ecartes.has(s.slug));
  const eligibles = retenus.filter((s) => s.analyses > 0);
  const nombreEcartes = soldes.length - retenus.length;
  if (eligibles.length === 0) return { solde: 0, gagnants: [], departageable: false, ecartes: nombreEcartes };
  const max = Math.max(...eligibles.map((s) => s.solde));
  const gagnants = eligibles.filter((s) => s.solde === max);
  return { solde: max, gagnants, departageable: gagnants.length === 1 || gagnants.length < eligibles.length, ecartes: nombreEcartes };
}

// Faits d'intégrité (voir data/integrite.ts) : seuls les candidats à condamnation définitive RECENSÉE sont écartés ; un
// candidat « non vérifié » n'est pas écarté (l'absence de donnée n'est pas une condamnation).
export function ecartesParIntegrite(integrites: Record<string, ConstatIntegrite> | null): Set<string> {
  const ecartes = new Set<string>();
  for (const [slug, constat] of Object.entries(integrites ?? {})) if (constat.etat === "recensee") ecartes.add(slug);
  return ecartes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/candidatIdeal.test.ts` puis `npx tsc --noEmit -p .`
Expected: PASS, typage propre.

- [ ] **Step 5: Commit**

```bash
git add src/engine/candidatIdeal.ts src/engine/candidatIdeal.test.ts
git commit -m "Candidat ideal : soldes situation et convictions, meilleurs sans depart alphabetique" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Simulateur masqué par défaut, sans interrupteur

**Files:**
- Modify: `src/ui/PageThemes.tsx`
- Modify: `src/ui/memoireReponses.ts` (retrait de `lireAveugle` / `memoriserAveugle` et de `CLE_AVEUGLE`)
- Modify: `src/ui/PageThemes.test.tsx`

**Interfaces:**
- Consumes: `anonymiserCards` (`src/ui/aveugle.ts`, existant, inchangé dans cette tâche).
- Produces: dans `PageThemes`, `aveugle` vaut désormais `simulateur` ; `changerMode(m: ModeAffichage)` ; `nouvelleGraine()` ; l'état `graine`. Les tâches 3 et 4 s'appuient sur ces noms.

Décision d'exécution : `lireMode()` vaut « simulateur » par défaut ; un lien du tableau de l'accueil nomme un candidat, donc l'arrivée avec `ouverture` démarre en **exploration** (sinon le candidat serait introuvable dans un simulateur masqué).

- [ ] **Step 1: Write the failing tests**

Ajouter à la fin de `src/ui/PageThemes.test.tsx` (le fichier importe déjà `renderToStaticMarkup`, `chargerBase`, `candidatsDeBase`, `PageThemes`) :

```tsx
describe("simulateur à l'aveugle par défaut", () => {
  const base = chargerBase("agregateurs");
  const noms = candidatsDeBase(base).avecDonnees.map((c) => c.meta.nom);
  const page = (mode: "simulateur" | "exploration") =>
    renderToStaticMarkup(<PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} />);

  it("simulateur : aucun nom réel, aucune photo réelle, des lettres à la place", () => {
    const html = page("simulateur");
    for (const nom of noms) expect(html, nom).not.toContain(nom);
    expect(html).not.toContain('src="/candidats/');
    expect(html).toContain("Candidat A");
  });
  it("simulateur : plus d'interrupteur « Afficher les candidats » ni de « Qui était qui ? »", () => {
    const html = page("simulateur");
    expect(html).not.toContain("Afficher les candidats");
    expect(html).not.toContain("Qui était qui");
  });
  it("exploration : les identités sont visibles (noms réels, photos), aucune lettre « Candidat A »", () => {
    const html = page("exploration");
    expect(html).toContain('src="/candidats/le-pen.');
    expect(html).toContain(noms[0]);
    expect(html).not.toContain("Candidat A");
  });
});
```

Lignes 55-56, 77-80 et 120-121 du fichier existant testent des noms et des photos ; les modifier à l'étape 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/PageThemes.test.tsx -t "simulateur à l'aveugle par défaut"`
Expected: FAIL (le simulateur montre encore les noms ; l'interrupteur est présent).

- [ ] **Step 3: Write the implementation**

Dans `src/ui/PageThemes.tsx` :

1. Imports : remplacer
```tsx
import { anonymiserCards, type Correspondance } from "./aveugle";
```
par
```tsx
import { anonymiserCards } from "./aveugle";
```
et
```tsx
import { lireAveugle, lireMode, memoriserAveugle, memoriserMode, type ModeAffichage } from "./memoireReponses";
```
par
```tsx
import { lireMode, memoriserMode, type ModeAffichage } from "./memoireReponses";
```

2. Remplacer le bloc d'ouverture du mode (lignes 36-40) par :
```tsx
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert. Ce lien
  // nomme un candidat : on l'ouvre donc en « Explorer les mesures », seul mode où les identités sont visibles.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  // « Explorer les mesures » : les programmes seuls (ni indicateur, ni légende, ni formulaire, ni questions par thème),
  // identités visibles. « Simuler pour moi » : tout ce qui rattache les mesures à la situation du visiteur, à l'aveugle.
  const [mode, setMode] = useState<ModeAffichage>(() => modeInitial ?? (ouverture ? "exploration" : lireMode()));
  useEffect(() => memoriserMode(mode), [mode]);
  const simulateur = mode === "simulateur";
```
et **supprimer** plus bas l'ancienne ligne `const [ouverture] = useState(...)` (garder le `useEffect` de défilement qui suit).

3. Remplacer tout le bloc « Afficher les candidats : non » (de `// « Afficher les candidats : non »…` jusqu'à la fermeture de `basculerAveugle`) par :
```tsx
  // Simulateur À L'AVEUGLE, sans interrupteur (voir aveugle.ts) : les identités n'apparaissent qu'en « Explorer les mesures »
  // ou, plus tard, dans la card « candidat idéal » une fois révélée. Lettres retirées au sort à chaque entrée en simulateur.
  const aveugle = simulateur;
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const nouvelleGraine = () => setGraine(Math.floor(Math.random() * 2 ** 31));
  const changerMode = (suivant: ModeAffichage) => {
    if (suivant === "simulateur" && mode !== "simulateur") nouvelleGraine();
    setMode(suivant);
  };
  const anonymisation = aveugle ? anonymiserCards(cardsNommees, graine) : null;
  const cards = anonymisation?.cards ?? cardsNommees;
```
(le bloc `Convictions` et `integrites` qui suivait reste, mais `const [revelation…]` et `basculerAveugle` disparaissent).

4. Supprimer du JSX le `<label className="interrupteur interrupteur--candidats">…</label>`, le `{aveugle && <p className="hint">…}` et le `{revelation && !aveugle && (…)}`.

5. Dans les boutons de bascule : `onClick={() => setMode("simulateur")}` → `onClick={() => changerMode("simulateur")}` ; de même dans `actionProfil` (`{ type: "simuler", onClick: () => changerMode("simulateur") }`). Le bouton « Explorer » garde `setMode("exploration")`.

6. `ouvertInitial={(!aveugle && ouverture) || undefined}` reste tel quel.

Dans `src/ui/memoireReponses.ts` : supprimer le bloc `CLE_AVEUGLE`, `lireAveugle`, `memoriserAveugle` (ajoutés lors de la première fonctionnalité, désormais sans usage).

Adapter les tests existants de `PageThemes.test.tsx` : le helper `rendre(baseId, profil, generalSoumis)` reçoit un 4ᵉ paramètre `mode` avec pour défaut `generalSoumis ? "simulateur" : "exploration"` et transmet `modeInitial={mode}` ; les tests qui vérifient des **noms, photos ou l'ordre alphabétique** (lignes 55-56 `src="/candidats/le-pen.` et `>PS<`, 77-80 `noms(carte)`, 120-121 comparaison avant/après) doivent passer `"exploration"` explicitement ; les tests d'**indicateurs** restent en « simulateur » et vérifient des lettres (`Candidat A`…) au lieu des noms. Pour la comparaison avant/après (120-121), garder l'intention (« répondre ne réordonne pas les portraits ») en comparant la liste des lettres avec la même `graine` n'est pas possible : la remplacer par « les mêmes candidats, en nombre, sont présents avant et après » (compter les portraits). Consigner chaque adaptation en ruling dans le registre.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit -p . ; npx vitest run src/ui`
Expected: PASS (aucun autre test UI cassé).

- [ ] **Step 5: Commit**

```bash
git add src/ui/PageThemes.tsx src/ui/PageThemes.test.tsx src/ui/memoireReponses.ts
git commit -m "Simulateur a l aveugle par defaut, sans interrupteur ; identites visibles en exploration" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Questions restantes, correspondance complète, composant `CardCandidatIdeal`

**Files:**
- Modify: `src/questionnaire.ts` (ajout de `questionsRestantes`)
- Modify: `src/ui/aveugle.ts` (`Correspondance` gagne `slug` et `parti`)
- Create: `src/ui/CardCandidatIdeal.tsx`
- Test: `src/questionnaire.test.ts`, `src/ui/aveugle.test.ts`, `src/ui/CardCandidatIdeal.test.tsx`

**Interfaces:**
- Consumes: `questionsDuTheme`, `questionsVisibles`, `estRepondue`, `Questionnaire` (`src/questionnaire.ts`) ; `Pastille` (`src/ui/Pastille.tsx`) ; `PREFIXE_ANONYME` (`src/ui/aveugle.ts`).
- Produces: `questionsRestantes(questionnaire: Questionnaire, profil: ProfilPartiel): number` ; `Correspondance = { lettre: string; nom: string; slug: string; parti: string }` ; `interface GagnantAffiche { lettre: string; identite: { slug: string; nom: string; parti: string } | null; ameliorants: number; degradants: number; analyses: number }` ; `interface ResultatAffiche { titre: string; unite: "thèmes" | "constats"; gagnants: GagnantAffiche[]; solde: number; departageable: boolean; ecartes: number }` ; `CardCandidatIdeal(props: { situation: ResultatAffiche | null; convictions: ResultatAffiche | null; questionsRestantes: number; revele: boolean; onReveler: () => void; onRecommencer: () => void })`.

Le composant n'affiche `identite` **que si** `revele` est vrai, même si la donnée lui est fournie.

- [ ] **Step 1: Write the failing tests**

Ajouter à `src/questionnaire.test.ts` (adapter les imports existants : `construireQuestionnaire`, `CHAMPS_PROFIL`, `questionsRestantes`) :

```ts
describe("questionsRestantes", () => {
  const themes = [{ id: "fiscalite", libelle: "F", question_citoyen: "?", description: "d", statut: "populated" as const }];
  const q = construireQuestionnaire(CHAMPS_PROFIL, { vehicule: ["fiscalite"], projet_achat: ["fiscalite"] }, themes);
  it("compte les questions de thème non répondues", () => {
    expect(questionsRestantes(q, {})).toBe(2);
  });
  it("une réponse la retire du compte", () => {
    expect(questionsRestantes(q, { vehicule: "aucun" })).toBe(1);
  });
  it("sans question de thème : zéro", () => {
    expect(questionsRestantes(construireQuestionnaire(CHAMPS_PROFIL, {}, themes), {})).toBe(0);
  });
});
```

Ajouter à `src/ui/aveugle.test.ts`, dans le `describe("simulateur à l'aveugle")` existant :

```ts
  it("la correspondance donne aussi le slug et le parti (pour la card candidat idéal)", () => {
    const base = chargerBase("agregateurs");
    const candidats = candidatsDeBase(base).avecDonnees;
    const { correspondance } = anonymiserCards(construireCards(base.themes, candidats, null), 7);
    const premier = candidats[0].meta;
    expect(correspondance.find((c) => c.slug === premier.slug)).toMatchObject({ nom: premier.nom, parti: premier.parti });
  });
```

Créer `src/ui/CardCandidatIdeal.test.tsx` :

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardCandidatIdeal, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({ lettre, identite: { slug, nom, parti: "Parti-test" }, ameliorants: 3, degradants: 1, analyses: 7 });
const resultat = (titre: string, gagnants: GagnantAffiche[], extra: Partial<ResultatAffiche> = {}): ResultatAffiche => ({ titre, unite: "thèmes", gagnants, solde: 2, departageable: true, ecartes: 0, ...extra });
const SITUATION = resultat("Selon votre situation", [gagnant("C", "Nom-Reel-Situation", "slug-reel-a")]);
const CONVICTIONS = resultat("Selon vos convictions", [gagnant("F", "Nom-Reel-Convictions", "slug-reel-b")], { unite: "constats" });

const rendre = (p: Partial<Parameters<typeof CardCandidatIdeal>[0]> = {}) =>
  renderToStaticMarkup(<CardCandidatIdeal situation={SITUATION} convictions={CONVICTIONS} questionsRestantes={3} revele={false} onReveler={() => {}} onRecommencer={() => {}} {...p} />);

describe("CardCandidatIdeal floutée", () => {
  it("ne met NI le nom, NI le slug, NI la photo réels dans la page, même si la donnée est fournie", () => {
    const html = rendre();
    for (const secret of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "slug-reel-a", "slug-reel-b", "Parti-test", "/candidats/"]) expect(html, secret).not.toContain(secret);
  });
  it("le contenu flouté est masqué aux lecteurs d'écran et annonce une identité masquée", () => {
    const html = rendre();
    expect(html).toContain("carte-ideal--floue");
    expect(html).toMatch(/class="ideal-flou"[^>]*aria-hidden="true"/);
    expect(html).toContain("Identité masquée");
  });
  it("bandeau : texte verbatim et bouton de révélation", () => {
    const html = rendre();
    expect(html).toContain("Cette card contient le meilleur programme selon votre situation et le meilleur programme selon vos convictions.");
    expect(html).toContain("Votre résultat peut être affiné si vous répondez aux 3 questions propres aux thèmes, directement dans ceux-ci.");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    expect(html).not.toContain("Recommencer la simulation");
  });
  it("sans résultat convictions : le bandeau ne parle que de la situation", () => {
    const html = rendre({ convictions: null });
    expect(html).toContain("le meilleur programme selon votre situation.");
    expect(html).not.toContain("selon vos convictions");
  });
  it("aucune question restante : la phrase sur l'affinage disparaît ; une seule : singulier", () => {
    expect(rendre({ questionsRestantes: 0 })).not.toContain("affiné");
    expect(rendre({ questionsRestantes: 1 })).toContain("à la question propre aux thèmes");
  });
  it("aucun résultat du tout : rien", () => {
    expect(rendre({ situation: null, convictions: null })).toBe("");
  });
});

describe("CardCandidatIdeal révélée", () => {
  it("montre noms, partis, lettres et le solde avec sa couverture ; plus de flou ; bouton Recommencer", () => {
    const html = rendre({ revele: true });
    for (const t of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Parti-test", "Candidat C", "Candidat F", "améliorants : 3", "dégradants : 1", "sur 7 thèmes analysés", "sur 7 constats analysés"]) expect(html, t).toContain(t);
    expect(html).not.toContain("carte-ideal--floue");
    expect(html).toContain("Recommencer la simulation");
    expect(html).not.toContain("Révéler mon programme");
  });
  it("égalité : le nombre d'ex æquo et tous les noms", () => {
    const html = rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb")]) });
    expect(html).toContain("2 candidats à égalité");
    expect(html).toContain("Nom-A");
    expect(html).toContain("Nom-B");
  });
  it("non départageable : message, et aucune liste de noms", () => {
    const html = rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa")], { departageable: false }) });
    expect(html).toContain("Les données ne permettent pas de départager les candidats.");
    expect(html).not.toContain("Nom-A");
  });
  it("candidats écartés par l'intégrité : le dit, au pluriel si besoin", () => {
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 1 }) })).toContain("1 candidat écarté : condamnation définitive recensée");
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 2 }) })).toContain("2 candidats écartés");
  });
  it("affiche la règle du solde, sans pondération", () => {
    const html = rendre({ revele: true });
    expect(html).toContain("Aucune pondération");
  });
  it("ne montre pas le parti « non renseigné par la source »", () => {
    const g: GagnantAffiche = { ...gagnant("A", "Nom-A", "sa"), identite: { slug: "sa", nom: "Nom-A", parti: "non renseigné par la source" } };
    expect(rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [g]) })).not.toContain("non renseigné");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/questionnaire.test.ts src/ui/aveugle.test.ts src/ui/CardCandidatIdeal.test.tsx`
Expected: FAIL (`questionsRestantes`, `slug`/`parti`, `./CardCandidatIdeal` absents).

- [ ] **Step 3: Write minimal implementation**

`src/questionnaire.ts` — ajouter après `questionsDuTheme` :

```ts
// Questions propres aux thèmes que le visiteur n'a pas encore répondues (parmi celles visibles), tous thèmes confondus.
export function questionsRestantes(questionnaire: Questionnaire, profil: ProfilPartiel): number {
  const ids = new Set<string>();
  for (const section of questionnaire.parTheme) {
    for (const q of questionsVisibles(section.questions, profil)) if (!estRepondue(q, profil)) ids.add(q.id);
  }
  return ids.size;
}
```

`src/ui/aveugle.ts` — `Correspondance` et sa production :

```ts
export interface Correspondance {
  lettre: string;
  nom: string;
  slug: string;
  parti: string;
}
```
et dans `anonymiserCards`, la ligne finale de `correspondance` devient :
```ts
    correspondance: ordre.map((slug, i) => ({ lettre: lettreDuRang(i), nom: metas.get(slug)!.nom, slug, parti: metas.get(slug)!.parti })),
```

`src/ui/CardCandidatIdeal.tsx` :

```tsx
import { PREFIXE_ANONYME } from "./aveugle";
import { Pastille } from "./Pastille";

// Card « candidat idéal » (décision du 2026-09-30) : seul endroit du produit qui désigne un candidat, par une règle publique
// et identique pour tous (solde = thèmes améliorants moins dégradants, sans pondération). Deux résultats séparés :
// situation et convictions. Floutée tant qu'elle n'est pas révélée : l'identité n'est alors PAS dans la page.
export interface GagnantAffiche {
  lettre: string;
  // Ignorée tant que `revele` est faux, même si elle est fournie : le flou CSS n'est jamais la seule protection.
  identite: { slug: string; nom: string; parti: string } | null;
  ameliorants: number;
  degradants: number;
  analyses: number;
}

export interface ResultatAffiche {
  titre: string;
  unite: "thèmes" | "constats";
  gagnants: GagnantAffiche[];
  solde: number;
  departageable: boolean;
  ecartes: number;
}

interface CardCandidatIdealProps {
  situation: ResultatAffiche | null;
  convictions: ResultatAffiche | null;
  questionsRestantes: number;
  revele: boolean;
  onReveler: () => void;
  onRecommencer: () => void;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function BlocFlou({ resultat }: { resultat: ResultatAffiche }) {
  // Une pastille par ex æquo (au plus trois), ou « ? » quand rien ne départage : aucune identité, seulement des lettres.
  const lettres = resultat.departageable ? resultat.gagnants.slice(0, 3).map((g) => g.lettre) : ["?"];
  return (
    <div className="ideal-bloc">
      <h3>{resultat.titre}</h3>
      <div className="ideal-flou" aria-hidden="true">
        {lettres.map((lettre) => (
          <Pastille key={lettre} slug={`${PREFIXE_ANONYME}${lettre}`} nom={`Candidat ${lettre}`} />
        ))}
        <p className="ideal-nom">Prénom Nom, parti du candidat</p>
      </div>
      <p className="hint">Identité masquée.</p>
    </div>
  );
}

function BlocRevele({ resultat }: { resultat: ResultatAffiche }) {
  const { gagnants, solde, departageable, ecartes, unite } = resultat;
  return (
    <div className="ideal-bloc">
      <h3>{resultat.titre}</h3>
      {departageable ? (
        <>
          {gagnants.length > 1 && (
            <p>
              <strong>{gagnants.length} candidats à égalité</strong>
            </p>
          )}
          <ul className="ideal-gagnants">
            {gagnants.map((g) =>
              g.identite ? (
                <li key={g.lettre}>
                  <Pastille slug={g.identite.slug} nom={g.identite.nom} />
                  <div>
                    <strong>{g.identite.nom}</strong>{" "}
                    <span className="hint">
                      ({/^non renseign/i.test(g.identite.parti) ? "" : `${g.identite.parti}, `}Candidat {g.lettre})
                    </span>
                    <br />
                    Solde {solde > 0 ? `+${solde}` : solde} — améliorants : {g.ameliorants}, dégradants : {g.degradants}, sur {g.analyses} {unite} analysés
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </>
      ) : (
        <p>
          <strong>Les données ne permettent pas de départager les candidats.</strong>
        </p>
      )}
      {ecartes > 0 && (
        <p className="hint">
          {pluriel(ecartes, "candidat")} {ecartes > 1 ? "écartés" : "écarté"} : condamnation définitive recensée.
        </p>
      )}
    </div>
  );
}

export function CardCandidatIdeal({ situation, convictions, questionsRestantes, revele, onReveler, onRecommencer }: CardCandidatIdealProps) {
  const resultats = [situation, convictions].filter((r): r is ResultatAffiche => r !== null);
  if (resultats.length === 0) return null;
  const n = questionsRestantes;
  return (
    <section className={`carte-ideal${revele ? "" : " carte-ideal--floue"}`} aria-label="Candidat idéal">
      <div className="carte-ideal-card">
        <h2>Votre candidat idéal</h2>
        {resultats.map((r) => (revele ? <BlocRevele key={r.titre} resultat={r} /> : <BlocFlou key={r.titre} resultat={r} />))}
        <p className="hint regle-ideal">
          Solde = améliorants moins dégradants. Aucune pondération, même règle pour tous les candidats ; les égalités sont toutes montrées. Il dépend du nombre d'indicateurs disponibles.
        </p>
      </div>
      <div className="bandeau-accueil bandeau-accueil--compact">
        {revele ? (
          <>
            <p className="chapeau">Voici votre candidat idéal pour 2027 d'après vos réponses.</p>
            <button type="button" onClick={onRecommencer}>
              Recommencer la simulation
            </button>
          </>
        ) : (
          <>
            <p className="chapeau">
              Cette card contient le meilleur programme selon votre situation{convictions ? " et le meilleur programme selon vos convictions" : ""}.
              {n > 0 && ` Votre résultat peut être affiné si vous répondez ${n === 1 ? "à la question propre aux thèmes" : `aux ${n} questions propres aux thèmes`}, directement dans ceux-ci.`}
            </p>
            <button type="button" onClick={onReveler}>
              Révéler mon programme de candidat idéal pour 2027
            </button>
          </>
        )}
      </div>
    </section>
  );
}
```

Attention : la première phrase du bandeau doit se terminer par « . » suivi d'une espace avant la phrase d'affinage (le test cherche « selon vos convictions. » puis « Votre résultat… »). Le gabarit ci-dessus produit `…convictions.` + ` Votre résultat…`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit -p . ; npx vitest run src/questionnaire.test.ts src/ui/aveugle.test.ts src/ui/CardCandidatIdeal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/questionnaire.ts src/questionnaire.test.ts src/ui/aveugle.ts src/ui/aveugle.test.ts src/ui/CardCandidatIdeal.tsx src/ui/CardCandidatIdeal.test.tsx
git commit -m "Candidat ideal : composant floute et revele, questions restantes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Câblage dans `PageThemes` et styles

**Files:**
- Modify: `src/ui/PageThemes.tsx`
- Modify: `src/index.css`
- Test: `src/ui/PageThemes.test.tsx`

**Interfaces:**
- Consumes: `soldesSituation`, `soldesConvictions`, `meilleurs`, `ecartesParIntegrite`, `Meilleurs` (Task 1) ; `CardCandidatIdeal`, `ResultatAffiche` (Task 3) ; `questionsRestantes` (Task 3) ; `Correspondance` étendue (Task 3) ; `graine`, `nouvelleGraine`, `aveugle`, `anonymisation` (Task 2) ; `GROUPES_SOCIAUX` ; `integritesVisibles` (`src/ui/Convictions.tsx`).
- Produces: prop de test `releveInitial?: boolean` sur `PageThemes`.

Le calcul se fait sur `cardsNommees` (données réelles) ; l'identité n'est transmise à la card qu'une fois `revele`. Card affichée seulement si `personnalise`.

- [ ] **Step 1: Write the failing tests**

Ajouter à `src/ui/PageThemes.test.tsx` :

```tsx
describe("card candidat idéal sur la page du simulateur", () => {
  const base = chargerBase("agregateurs");
  const noms = candidatsDeBase(base).avecDonnees.map((c) => c.meta.nom);
  const page = (extra: Partial<Parameters<typeof PageThemes>[0]> = {}) =>
    renderToStaticMarkup(
      <PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial="simulateur" {...extra} />,
    );

  it("floutée par défaut : la card est là, le bouton aussi, et aucun nom réel n'est dans la page", () => {
    const html = page();
    expect(html).toContain("carte-ideal--floue");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    for (const nom of noms) expect(html, nom).not.toContain(nom);
  });
  it("placée avant les cards de thèmes", () => {
    const html = page();
    expect(html.indexOf("carte-ideal")).toBeGreaterThan(-1);
    expect(html.indexOf("carte-ideal")).toBeLessThan(html.indexOf('class="grille-themes"'));
  });
  it("sans réponse (pas d'indicateur) : pas de card", () => {
    expect(page({ profil: {}, generalSoumis: false })).not.toContain("carte-ideal");
  });
  it("révélée : le bouton Recommencer remplace celui de révélation, le formulaire et le bloc convictions disparaissent", () => {
    const html = page({ releveInitial: true });
    expect(html).toContain("Recommencer la simulation");
    expect(html).not.toContain("Révéler mon programme");
    expect(html).not.toContain("Mes convictions");
    expect(html).not.toContain("Modifier mes réponses");
    expect(html).not.toContain("carte-ideal--floue");
  });
  it("révélée : les cards de thèmes restent masquées (lettres, pas de photo)", () => {
    const html = page({ releveInitial: true });
    expect(html).toContain("Candidat A");
  });
  it("floutée : le bloc convictions et le récapitulatif de la situation restent visibles", () => {
    const html = page();
    expect(html).toContain("Mes convictions");
    expect(html).toContain("Modifier mes réponses");
  });
  it("exploration : aucune card idéale", () => {
    expect(page({ modeInitial: "exploration" })).not.toContain("carte-ideal");
  });
  it("résultat convictions seulement si un groupe est choisi", () => {
    expect(page()).not.toContain("Selon vos convictions");
    expect(page({ convictionsInitiales: { groupes: ["tranche_age:30_49"], exemplarite: false } })).toContain("Selon vos convictions");
  });
});
```

Corriger aussi, dans le test existant « bloc « Mes convictions » sur la page du simulateur », l'identifiant obsolète `groupes: ["jeunes"]` → `groupes: ["tranche_age:moins_30"]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/PageThemes.test.tsx -t "card candidat idéal"`
Expected: FAIL (aucune card, prop `releveInitial` inconnue).

- [ ] **Step 3: Write the implementation**

`src/ui/PageThemes.tsx` :

1. Imports à ajouter :
```tsx
import { GROUPES_SOCIAUX } from "../convictions";
import { ecartesParIntegrite, meilleurs, soldesConvictions, soldesSituation, type Meilleurs } from "../engine/candidatIdeal";
import { CardCandidatIdeal, type ResultatAffiche } from "./CardCandidatIdeal";
```
et `import { compterReponses } from "../questionnaire";` devient `import { compterReponses, questionsRestantes } from "../questionnaire";`.

2. Prop de test : dans `PageThemesProps` ajouter
```tsx
  // État « révélé » de départ (tests) : chaque visite recommence floutée, il n'est jamais mémorisé.
  releveInitial?: boolean;
```
et la déstructuration : `…, modeInitial, convictionsInitiales, releveInitial }`.

3. Après la déclaration de `integrites` (bloc Convictions), ajouter :
```tsx
  // Card « candidat idéal » (voir CardCandidatIdeal.tsx) : seulement quand des indicateurs existent. Calculée sur les
  // données RÉELLES (cardsNommees) : l'anonymisation ne change que l'affichage, et l'identité n'est transmise à la card
  // qu'une fois révélée.
  const [revele, setRevele] = useState(releveInitial ?? false);
  const correspondance = anonymisation?.correspondance ?? [];
  const versAffiche = (titre: string, unite: ResultatAffiche["unite"], m: Meilleurs | null): ResultatAffiche | null =>
    m && {
      titre,
      unite,
      solde: m.solde,
      departageable: m.departageable,
      ecartes: m.ecartes,
      gagnants: m.gagnants.map((g) => {
        const c = correspondance.find((x) => x.slug === g.slug);
        return {
          lettre: c?.lettre ?? "?",
          identite: revele && c ? { slug: c.slug, nom: c.nom, parti: c.parti } : null,
          ameliorants: g.ameliorants,
          degradants: g.degradants,
          analyses: g.analyses,
        };
      }),
    };
  const groupesChoisis = GROUPES_SOCIAUX.filter((g) => convictions.groupes.includes(g.id));
  // L'écart par intégrité se calcule sur les faits réels (jamais affichés à l'aveugle : seul le nombre d'écartés l'est).
  const ecartes = ecartesParIntegrite(integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle: false, slugs: candidats.map((c) => c.meta.slug) }));
  const situationIdeale = personnalise ? versAffiche("Selon votre situation", "thèmes", meilleurs(soldesSituation(cardsNommees))) : null;
  const convictionsIdeales =
    personnalise && groupesChoisis.length > 0 ? versAffiche("Selon vos convictions", "constats", meilleurs(soldesConvictions(cardsNommees, groupesChoisis), ecartes)) : null;
  const recommencer = () => {
    setRevele(false);
    nouvelleGraine();
  };
  // Une fois le candidat idéal révélé, le formulaire disparaît (réponses et convictions gardées, « Recommencer » le rouvre).
  const formulaireVisible = simulateur && !revele;
```

4. JSX : remplacer les conditions
- `{simulateur && formulaireOuvert && (` → `{formulaireVisible && formulaireOuvert && (`
- `{personnalise && !formulaireOuvert && (` → `{personnalise && formulaireVisible && !formulaireOuvert && (`
- `{simulateur && !personnalise && !formulaireOuvert && (` → `{formulaireVisible && !personnalise && !formulaireOuvert && (`
- `{simulateur && <BlocConvictions … />}` → `{formulaireVisible && <BlocConvictions convictions={convictions} onChange={setConvictions} aveugle={aveugle} />}`
- Dans `onConfirmer` de « Effacer vos réponses ? », ajouter `setRevele(false);` avant `onEffacer();`.
- Juste avant `<VueThemes`, ajouter :
```tsx
      {personnalise && (situationIdeale || convictionsIdeales) && (
        <CardCandidatIdeal
          situation={situationIdeale}
          convictions={convictionsIdeales}
          questionsRestantes={questionsRestantes(base.questionnaire, profil)}
          revele={revele}
          onReveler={() => setRevele(true)}
          onRecommencer={recommencer}
        />
      )}
```

`src/index.css` (fin de fichier) — la card reprend le style des détails de cards (fond blanc, bordure, arrondi) ; le flou est une simple transition désactivée si l'utilisateur demande de limiter les animations :

```css
.carte-ideal {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
  margin: 1rem 0;
}
.carte-ideal-card {
  padding: 1rem;
  background: #fff;
  border: 1px solid #ccd;
  border-radius: 0.75rem;
}
.carte-ideal .bandeau-accueil--compact {
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
}
.ideal-bloc + .ideal-bloc {
  margin-top: 1rem;
}
.ideal-flou {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  filter: blur(7px);
  user-select: none;
  pointer-events: none;
  transition: filter 0.4s ease;
}
.ideal-gagnants {
  list-style: none;
  margin: 0.5rem 0;
  padding: 0;
}
.ideal-gagnants li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0;
}
.regle-ideal {
  margin-top: 1rem;
}
@media (max-width: 800px) {
  .carte-ideal {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ideal-flou {
    transition: none;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit -p . ; npx vitest run`
Expected: PASS sur toute la suite (aucun échec préexistant à signaler).

Vérification visuelle manuelle à consigner (non couverte par les tests) : lancer l'application (`npm run dev`), répondre au formulaire général, vérifier la card floutée + bandeau bleu, la révélation, le retrait du formulaire et « Recommencer la simulation ».

- [ ] **Step 5: Commit**

```bash
git add src/ui/PageThemes.tsx src/ui/PageThemes.test.tsx src/index.css
git commit -m "Candidat ideal : card floutee, revelation, formulaire retire, recommencer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Règles écrites et vérification finale

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/methodologie.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: la trace écrite de l'exception au principe « pas de classement ».

- [ ] **Step 1: Amender `CLAUDE.md`**

a) Dans la liste « Garde-fous de l'indicateur », la ligne « **Pas de score global inter-thèmes, pas de classement de candidats.** L'indicateur reste par thème ; … » reçoit à la suite de sa dernière phrase : ` **Exception décidée le 2026-09-30 : la card « candidat idéal » (voir plus bas), seul endroit où un candidat est désigné.**`

b) Remplacer le paragraphe « **Simulateur « à l'aveugle » (décision du 2026-09-29).** … » par :

```markdown
**Simulateur « à l'aveugle » par défaut (décisions des 2026-09-29 et 2026-09-30).** En mode « Simuler pour moi », les candidats sont **toujours masqués, sans interrupteur** (`src/ui/aveugle.ts`) : « Candidat A, B… » (lettres tirées au hasard à chaque entrée en simulateur et à chaque « Recommencer », identiques d'un thème à l'autre), noms de TOUS les candidats et partis remplacés dans les textes, ni photos ni sources ni adresses. En mode « Explorer les mesures », **les identités sont visibles** (noms et vrais portraits). Simple transformation d'affichage : le moteur ne change pas. Limite assumée : les dérivés du nom et les mesures très reconnaissables restent. Un lien du tableau de l'accueil (qui nomme un candidat) ouvre le mode exploration.

**Card « candidat idéal » (décision du 2026-09-30, spec `docs/superpowers/specs/2026-09-30-candidat-ideal-design.md`).** En simulateur, une fois des indicateurs affichés, une card **floutée** en haut des thèmes, collée à un bandeau bleu, désigne le meilleur programme **selon la situation** et, si des groupes sont choisis, **selon les convictions** (deux résultats séparés). Règle publique, identique pour tous, **sans pondération** : solde = thèmes « améliorant » moins thèmes « dégradant » (mixte, non concerné, sans indicateur = 0). Égalité : tous les ex æquo montrés, jamais départagés par l'ordre alphabétique ; tous à égalité : « les données ne permettent pas de départager ». Un candidat **sans aucun indicateur** n'est pas éligible (il gagnerait par absence de données). « Sans condamnation définitive » coché : les candidats à condamnation définitive recensée sont écartés du résultat convictions, et la card le dit. Tant qu'elle est floutée, l'identité n'est pas dans la page. « Révéler mon programme de candidat idéal pour 2027 » montre nom, parti, portrait réel et lettre, et retire le formulaire ; « Recommencer la simulation » rouvre le formulaire **sans effacer** les réponses. Les cards de thèmes restent masquées. Le classement n'existe que dans cette card ; la règle et la couverture (nombre d'indicateurs) sont affichées.
```

- [ ] **Step 2: Ajouter à la fin de `docs/methodologie.md`**

```markdown

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
```

- [ ] **Step 3: Vérification finale**

Run: `npx tsc --noEmit -p . ; npx vitest run`
Expected: tout passe.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/methodologie.md
git commit -m "Candidat ideal : regles ecrites, exception au principe de non classement" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Couverture de la spec** : masquage par défaut sans interrupteur, exploration visible (Task 2, tests explicites) ; card floutée sans identité dans le DOM, bandeau verbatim, bouton, révélation, retrait du formulaire, recommencer sans effacer (Tasks 3 et 4) ; deux résultats séparés, convictions omises sans groupe (Tasks 1, 3, 4) ; égalités et non-départage (Tasks 1 et 3) ; écart par intégrité (Tasks 1 et 3) ; `X` questions restantes (Task 3) ; règle et couverture affichées (Task 3) ; garde-fous écrits (Task 5). Points ouverts de la spec : portrait = lettre dans un cercle (choisi) ; règle du solde isolée dans `meilleurs` (facile à changer).
- **Écart assumé avec la spec** : un candidat à zéro indicateur n'est pas éligible (Global Constraints, Task 1, Review Focus) — sans cela il gagnerait par absence de données, ce qui contredit « mieux vaut pas d'indicateur qu'un mauvais indicateur ».
- **Écart de périmètre** : `integritesVisibles` (existant) renvoie désormais toujours `null` pour l'affichage dans les cards de thèmes, qui sont toujours masquées en simulateur ; la card idéale l'appelle avec `aveugle: false` pour calculer les écarts. Le panneau d'intégrité des cards de thèmes n'est donc plus visible : conséquence directe de « on reste à l'aveugle ».
- **Cohérence des types** : `Solde`, `Meilleurs` (Task 1) → `versAffiche` (Task 4) ; `ResultatAffiche`/`GagnantAffiche` (Task 3) → Task 4 ; `Correspondance` étendue (Task 3) → Task 4 ; `graine`/`nouvelleGraine`/`changerMode` (Task 2) → Task 4.
- **Non couvert volontairement** : pondération, classement complet, mémorisation de l'état révélé, révélation des cards de thèmes, partage du résultat.
