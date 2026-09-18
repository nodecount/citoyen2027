# Page de monitoring du pipeline d'ingestion — Plan d'implémentation

> **Pour les exécutants agentiques :** SOUS-SKILL REQUIS : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour implémenter ce plan tâche par tâche.

**Objectif :** Ajouter une page `/monitoring` au site, affichant en lecture seule la couverture
du pipeline d'ingestion (propositions par thème et par candidat, statuts, dates de dernière
vérification, contenu en attente de relecture), avec un bouton de relance (insert/update) et un
champ clé API actifs uniquement quand un petit serveur local tourne sur la machine de
l'utilisateur.

**Architecture :** La grille de couverture est calculée côté client via `import.meta.glob` (pas
d'imports statiques codés en dur par candidat) à partir des fichiers déjà présents dans
`data/programmes/` — sûr à déployer publiquement puisque `_a-verifier.json`, gitignoré, est
simplement absent d'un build de production construit depuis un checkout Git propre. Le bouton de
relance appelle un serveur `node:http` séparé (`src/ingestion/serveur-local.ts`), jamais déployé,
détecté au chargement de la page via un health-check.

**Tech Stack :** React/TypeScript (existant), `import.meta.glob` (Vite, déjà disponible),
`node:http` (aucune nouvelle dépendance).

**Spec :** `docs/superpowers/specs/2026-09-18-page-monitoring-ingestion-design.md`

## Global Constraints

- `src/ui/` ne doit jamais importer en **valeur** un module de `src/ingestion/` qui dépend de
  `node:fs`/`node:path`/etc. (`env.ts`, `depot.ts`, `domaines.ts`, `checks.ts`, `generate.ts`,
  `verify.ts`, `run.ts`) — ça casserait le bundle statique déployé. Seuls les imports de **type**
  (`import type { ... } from "../ingestion/..."`) sont autorisés ; TypeScript les efface
  entièrement à la compilation (le projet a déjà `isolatedModules: true`), donc aucun code Node
  ne finit dans le bundle navigateur.
- La clé API ne doit jamais être loguée, ni côté serveur local, ni persistée (pas de
  `localStorage`, pas de cookie) côté frontend.
- Pas de test automatisé de composant React pour `Monitoring.tsx` — convention déjà établie et
  réaffirmée pour ce projet (voir les autres écrans `src/ui/*.tsx`, aucun n'a de test dédié).
  Toute la logique testable doit être extraite dans des fonctions pures, séparées du JSX.
- Noms de fonctions, fichiers et champs en français, cohérent avec le reste du code.
- Le serveur local (`serveur-local.ts`) réutilise `executerCombinaison`/`executerRefresh`/
  `chargerMeta`/`chargerPropositions`/`combinaisonDejaCouverte` déjà existants et déjà testés —
  ne jamais dupliquer leur logique.

---

### Task 1 : `creerClient` accepte une clé API explicite

**Files:**
- Modify: `src/ingestion/generate.ts`
- Modify: `src/ingestion/generate.test.ts`

**Interfaces:**
- Produces: `creerClient(cleApi?: string): Anthropic` — rétrocompatible (appel sans argument
  inchangé, lit `.env` comme avant). Utilisé par `serveur-local.ts` (Task 3).

- [ ] **Step 1 : Écrire le test (échoue)**

Ajouter à `src/ingestion/generate.test.ts`, dans les imports en tête de fichier, `creerClient` à
la liste existante importée de `"./generate"`, et ajouter :

```ts
import Anthropic from "@anthropic-ai/sdk";
```

Puis ajouter ce bloc de test (nouveau `describe`, à la suite des blocs existants) :

```ts
describe("creerClient", () => {
  it("construit un client avec une clé fournie explicitement, sans dépendre de la variable d'environnement", () => {
    const cleOriginale = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => creerClient("cle-de-test")).not.toThrow();
      expect(creerClient("cle-de-test")).toBeInstanceOf(Anthropic);
    } finally {
      if (cleOriginale !== undefined) process.env.ANTHROPIC_API_KEY = cleOriginale;
    }
  });
});
```

Run: `npx vitest run src/ingestion/generate.test.ts`
Expected: FAIL — avec `ANTHROPIC_API_KEY` effacée, `creerClient("cle-de-test")` retombe sur
`new Anthropic()` (l'argument est encore ignoré) et lève une erreur de clé manquante.

- [ ] **Step 2 : Implémenter**

Dans `src/ingestion/generate.ts`, remplacer :

```ts
export function creerClient(): Anthropic {
  return new Anthropic();
}
```

par :

```ts
export function creerClient(cleApi?: string): Anthropic {
  return cleApi ? new Anthropic({ apiKey: cleApi }) : new Anthropic();
}
```

- [ ] **Step 3 : Vérifier et committer**

Run: `npx vitest run src/ingestion/generate.test.ts`
Expected: PASS (tous les tests du fichier, décompte-les toi-même)

Run: `npx tsc --noEmit` (pas `tsc -b`)
Expected: aucune erreur

```bash
git add src/ingestion/generate.ts src/ingestion/generate.test.ts
git commit -m "feat(ingestion): creerClient accepte une clé API explicite"
```

---

### Task 2 : Calcul pur de la couverture (candidat × thème)

**Files:**
- Create: `src/ui/monitoring/couverture.ts`
- Test: `src/ui/monitoring/couverture.test.ts`

**Interfaces:**
- Consumes: `CandidatMeta`, `Proposition`, `StatutProposition`, `Theme` de `src/types.ts` ;
  `type EntreeAVerifier` de `src/ingestion/depot.ts` (import de **type** uniquement).
- Produces: `extraireSlug(cheminModule: string): string`, `type CouvertureTheme`,
  `type CouvertureCandidat`, `calculerCouverture(themes, metasParSlug, propositionsParSlug,
  aVerifierParSlug): CouvertureCandidat[]`. Utilisés par `src/ui/monitoring/glob.ts` et
  `src/ui/Monitoring.tsx` (Task 4).

- [ ] **Step 1 : Écrire les tests (échouent)**

Créer `src/ui/monitoring/couverture.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { calculerCouverture, extraireSlug } from "./couverture";
import type { CandidatMeta, Proposition, Theme } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";

const THEMES: Theme[] = [
  { id: "fiscalite", libelle: "Fiscalité", description: "", statut: "populated" },
  { id: "sante", libelle: "Santé", description: "", statut: "populated" },
];

function proposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    id: "test-001",
    candidat: "test",
    theme: "fiscalite",
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-18",
    ...overrides,
  };
}

describe("extraireSlug", () => {
  it("extrait le slug du chemin d'un module glob", () => {
    expect(extraireSlug("/data/programmes/le-pen/meta.json")).toBe("le-pen");
  });

  it("retourne le chemin tel quel si le motif ne correspond pas", () => {
    expect(extraireSlug("chemin-invalide.json")).toBe("chemin-invalide.json");
  });
});

describe("calculerCouverture", () => {
  const META: CandidatMeta = {
    slug: "test",
    nom: "Candidat Test",
    parti: "Parti Test",
    sources_officielles: [],
    date_derniere_maj: "2026-09-01",
  };

  it("compte les propositions par thème et par statut", () => {
    const resultat = calculerCouverture(
      THEMES,
      { test: META },
      { test: [proposition({ statut: "complet" }), proposition({ statut: "partiel", id: "test-002" })] },
      {},
    );
    const candidat = resultat.find((c) => c.slug === "test")!;
    const themeFiscalite = candidat.parTheme.find((t) => t.themeId === "fiscalite")!;
    expect(themeFiscalite.parStatut).toEqual({ complet: 1, partiel: 1, provisoire: 0 });
    const themeSante = candidat.parTheme.find((t) => t.themeId === "sante")!;
    expect(themeSante.parStatut).toEqual({ complet: 0, partiel: 0, provisoire: 0 });
  });

  it("retient la date de vérification la plus récente par thème", () => {
    const resultat = calculerCouverture(
      THEMES,
      { test: META },
      {
        test: [
          proposition({ date_derniere_verification: "2026-09-10", id: "test-001" }),
          proposition({ date_derniere_verification: "2026-09-18", id: "test-002" }),
        ],
      },
      {},
    );
    const candidat = resultat.find((c) => c.slug === "test")!;
    expect(candidat.parTheme.find((t) => t.themeId === "fiscalite")!.dateVerificationRecente).toBe("2026-09-18");
  });

  it("retourne null pour dateVerificationRecente si aucune proposition sur ce thème", () => {
    const resultat = calculerCouverture(THEMES, { test: META }, { test: [] }, {});
    const candidat = resultat.find((c) => c.slug === "test")!;
    expect(candidat.parTheme.find((t) => t.themeId === "sante")!.dateVerificationRecente).toBeNull();
  });

  it("inclut le contenu en attente de relecture par candidat", () => {
    const entree: EntreeAVerifier = {
      theme: "fiscalite",
      proposition: {
        titre: "Titre rejeté",
        resume_factuel: "x",
        sources: [],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
      },
      raison: "test",
    };
    const resultat = calculerCouverture(THEMES, { test: META }, {}, { test: [entree] });
    expect(resultat.find((c) => c.slug === "test")!.enAttente).toEqual([entree]);
  });

  it("gère un candidat sans propositions.json ni _a-verifier.json (seulement meta.json)", () => {
    const resultat = calculerCouverture(THEMES, { test: META }, {}, {});
    expect(resultat).toHaveLength(1);
    expect(resultat[0].enAttente).toEqual([]);
  });

  it("trie les candidats par slug", () => {
    const resultat = calculerCouverture(
      THEMES,
      { zebre: { ...META, slug: "zebre" }, alpha: { ...META, slug: "alpha" } },
      {},
      {},
    );
    expect(resultat.map((c) => c.slug)).toEqual(["alpha", "zebre"]);
  });
});
```

Run: `npx vitest run src/ui/monitoring/couverture.test.ts`
Expected: FAIL — `Cannot find module './couverture'`

- [ ] **Step 2 : Implémenter**

Créer `src/ui/monitoring/couverture.ts` :

```ts
import type { CandidatMeta, Proposition, StatutProposition, Theme } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";

export function extraireSlug(cheminModule: string): string {
  const correspondance = cheminModule.match(/data\/programmes\/([^/]+)\//);
  return correspondance ? correspondance[1] : cheminModule;
}

export interface CouvertureTheme {
  themeId: string;
  libelle: string;
  parStatut: Record<StatutProposition, number>;
  dateVerificationRecente: string | null;
}

export interface CouvertureCandidat {
  slug: string;
  nom: string;
  dateDerniereMaj: string;
  parTheme: CouvertureTheme[];
  enAttente: EntreeAVerifier[];
}

export function calculerCouverture(
  themes: Theme[],
  metasParSlug: Record<string, CandidatMeta>,
  propositionsParSlug: Record<string, Proposition[]>,
  aVerifierParSlug: Record<string, EntreeAVerifier[]>,
): CouvertureCandidat[] {
  return Object.entries(metasParSlug)
    .map(([slug, meta]) => {
      const propositions = propositionsParSlug[slug] ?? [];
      const parTheme: CouvertureTheme[] = themes.map((theme) => {
        const propositionsDuTheme = propositions.filter((p) => p.theme === theme.id);
        const parStatut: Record<StatutProposition, number> = { complet: 0, partiel: 0, provisoire: 0 };
        let dateVerificationRecente: string | null = null;
        for (const p of propositionsDuTheme) {
          parStatut[p.statut] += 1;
          if (dateVerificationRecente === null || p.date_derniere_verification > dateVerificationRecente) {
            dateVerificationRecente = p.date_derniere_verification;
          }
        }
        return { themeId: theme.id, libelle: theme.libelle, parStatut, dateVerificationRecente };
      });
      return {
        slug,
        nom: meta.nom,
        dateDerniereMaj: meta.date_derniere_maj,
        parTheme,
        enAttente: aVerifierParSlug[slug] ?? [],
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
```

- [ ] **Step 3 : Vérifier et committer**

Run: `npx vitest run src/ui/monitoring/couverture.test.ts`
Expected: PASS (7 tests)

Run: `npx tsc --noEmit`
Expected: aucune erreur (vérifie en particulier que l'import de type `EntreeAVerifier` depuis
`../../ingestion/depot` ne provoque aucune erreur de résolution de module)

```bash
git add src/ui/monitoring/couverture.ts src/ui/monitoring/couverture.test.ts
git commit -m "feat(monitoring): calcul pur de la couverture candidat x thème"
```

---

### Task 3 : Serveur local de relance

**Files:**
- Create: `src/ingestion/serveur-local.ts`
- Test: `src/ingestion/serveur-local.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `creerClient` (Task 1), `executerCombinaison`, `executerRefresh`,
  `ClientAnthropicMinimal`, `CombinaisonACouvrir`, `OptionsExecution` (déjà existants dans
  `src/ingestion/run.ts` et `src/ingestion/generate.ts`), `chargerMeta`, `chargerPropositions`,
  `combinaisonDejaCouverte` (`src/ingestion/depot.ts`), `FetchImpl` (`src/ingestion/checks.ts`).
- Produces: `type RequeteRelance = { slug: string; themes: string[]; mode: "insert" | "update";
  cleApi: string }`, `type ResultatRelance = { ok: boolean; resultats: Array<{ theme: string;
  statut: "traite" | "saute" | "erreur"; fusionnees?: number; enAttente?: number; divergence?:
  boolean; message?: string }> }`, `gererRelance(requete, options?): Promise<ResultatRelance>`,
  `creerServeur(): http.Server`. `gererRelance` est consommé par les tests de cette tâche ;
  `creerServeur` est lancé par le script npm `monitoring-server`, jamais importé ailleurs.

- [ ] **Step 1 : Écrire les tests de `gererRelance` (échouent)**

Créer `src/ingestion/serveur-local.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gererRelance } from "./serveur-local";
import { chargerPropositions } from "./depot";
import type { CandidatMeta } from "../types";
import type { ClientAnthropicMinimal } from "./generate";

const META: CandidatMeta = {
  slug: "candidat-x",
  nom: "Candidat X",
  parti: "Parti X",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function preparerRacine(): string {
  const racine = mkdtempSync(resolve(tmpdir(), "monitoring-serveur-test-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
  return racine;
}

function clientFactice(reponseGeneration: unknown, reponseVerification: unknown): ClientAnthropicMinimal {
  return {
    messages: {
      create: vi
        .fn()
        .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(reponseGeneration) }] })
        .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(reponseVerification) }] }),
    },
  };
}

describe("gererRelance", () => {
  it("mode insert : génère et fusionne une combinaison non couverte", async () => {
    const racine = preparerRacine();
    try {
      const proposition = {
        titre: "Titre",
        resume_factuel: "Résumé",
        sources: [
          { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
          { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
        ],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
      };
      const client = clientFactice([proposition], [{ titre: "Titre", verdict: "PASS" }]);
      const fetchFactice = async () => new Response("contenu de la page");

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "insert", cleApi: "cle-test" },
        { racine, fetchImpl: fetchFactice, fabriquerClient: () => client },
      );

      expect(resultat.ok).toBe(true);
      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "traite", fusionnees: 1, enAttente: 0 }]);
      expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("mode insert : saute une combinaison déjà couverte", async () => {
    const racine = preparerRacine();
    try {
      const propositionExistante = {
        id: "candidat-x-fisc-001",
        candidat: "candidat-x",
        theme: "fiscalite",
        titre: "Déjà là",
        resume_factuel: "x",
        sources: [],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
      };
      writeFileSync(resolve(racine, "candidat-x/propositions.json"), JSON.stringify([propositionExistante]));
      const create = vi.fn();

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "insert", cleApi: "cle-test" },
        { racine, fabriquerClient: () => ({ messages: { create } }) },
      );

      expect(create).not.toHaveBeenCalled();
      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "saute" }]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("isole les erreurs par thème sans interrompre les thèmes suivants", async () => {
    const racine = preparerRacine();
    try {
      const create = vi.fn().mockRejectedValue(new Error("panne réseau"));
      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite", "sante"], mode: "insert", cleApi: "cle-test" },
        { racine, fabriquerClient: () => ({ messages: { create } }) },
      );
      expect(resultat.ok).toBe(false);
      expect(resultat.resultats).toEqual([
        { theme: "fiscalite", statut: "erreur", message: "panne réseau" },
        { theme: "sante", statut: "erreur", message: "panne réseau" },
      ]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("mode update : appelle executerRefresh et ne modifie jamais propositions.json directement", async () => {
    const racine = preparerRacine();
    try {
      const propositionExistante = {
        id: "candidat-x-fisc-001",
        candidat: "candidat-x",
        theme: "fiscalite",
        titre: "Titre",
        resume_factuel: "Résumé",
        sources: [
          { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
          { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
        ],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-01",
      };
      writeFileSync(resolve(racine, "candidat-x/propositions.json"), JSON.stringify([propositionExistante]));
      // executerRefresh n'appelle que genererPropositions (une seule passe, pas de vérification
      // sémantique — limite connue et assumée du pipeline, voir la spec d'ingestion), donc un
      // seul appel au client est réellement consommé ici ; le second argument de clientFactice
      // ne sert qu'à respecter sa signature et n'est jamais lu.
      const client = clientFactice([{ ...propositionExistante, date_derniere_verification: "2026-09-18" }], []);

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "update", cleApi: "cle-test" },
        { racine, fabriquerClient: () => client },
      );

      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "traite", divergence: false }]);
      expect(chargerPropositions("candidat-x", racine)).toEqual([propositionExistante]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run src/ingestion/serveur-local.test.ts`
Expected: FAIL — `Cannot find module './serveur-local'`

- [ ] **Step 2 : Implémenter la logique de relance**

Créer `src/ingestion/serveur-local.ts` (partie logique — la partie serveur HTTP arrive au Step 4) :

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import type { CandidatMeta } from "../types";
import { creerClient, type ClientAnthropicMinimal } from "./generate";
import { executerCombinaison, executerRefresh } from "./run";
import { chargerMeta, chargerPropositions, combinaisonDejaCouverte } from "./depot";
import type { FetchImpl } from "./checks";
import themesData from "../../data/themes.json";

const themes = themesData as Array<{ id: string; libelle: string }>;
const PORT = 5175;

export interface RequeteRelance {
  slug: string;
  themes: string[];
  mode: "insert" | "update";
  cleApi: string;
}

export interface ResultatCombinaisonRelance {
  theme: string;
  statut: "traite" | "saute" | "erreur";
  fusionnees?: number;
  enAttente?: number;
  divergence?: boolean;
  message?: string;
}

export interface ResultatRelance {
  ok: boolean;
  resultats: ResultatCombinaisonRelance[];
}

export interface OptionsServeur {
  racine?: string;
  fetchImpl?: FetchImpl;
  fabriquerClient?: (cleApi: string) => ClientAnthropicMinimal;
}

export async function gererRelance(requete: RequeteRelance, options: OptionsServeur = {}): Promise<ResultatRelance> {
  const fabriquerClient =
    options.fabriquerClient ?? ((cleApi: string) => creerClient(cleApi) as unknown as ClientAnthropicMinimal);
  const client = fabriquerClient(requete.cleApi);
  const meta: CandidatMeta = chargerMeta(requete.slug, options.racine);
  const themesACouvrir = themes.filter((t) => requete.themes.includes(t.id));
  const resultats: ResultatCombinaisonRelance[] = [];

  for (const theme of themesACouvrir) {
    try {
      if (requete.mode === "insert") {
        const propositionsExistantes = chargerPropositions(requete.slug, options.racine);
        if (combinaisonDejaCouverte(propositionsExistantes, theme.id)) {
          resultats.push({ theme: theme.id, statut: "saute" });
          continue;
        }
        const { fusionnees, enAttente } = await executerCombinaison(
          client,
          meta,
          { slug: requete.slug, themeId: theme.id, themeLibelle: theme.libelle },
          propositionsExistantes,
          { racine: options.racine, fetchImpl: options.fetchImpl },
        );
        resultats.push({ theme: theme.id, statut: "traite", fusionnees: fusionnees.length, enAttente: enAttente.length });
      } else {
        const { divergence } = await executerRefresh(client, meta, theme.id, theme.libelle, {
          racine: options.racine,
          fetchImpl: options.fetchImpl,
        });
        resultats.push({ theme: theme.id, statut: "traite", divergence });
      }
    } catch (erreur) {
      resultats.push({
        theme: theme.id,
        statut: "erreur",
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }

  return { ok: resultats.every((r) => r.statut !== "erreur"), resultats };
}
```

Run: `npx vitest run src/ingestion/serveur-local.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 3 : Ajouter le serveur HTTP**

Ajouter à la fin de `src/ingestion/serveur-local.ts` :

```ts
function lireCorpsJSON(requete: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let donnees = "";
    requete.on("data", (morceau) => {
      donnees += morceau;
    });
    requete.on("end", () => {
      try {
        resolve(donnees ? JSON.parse(donnees) : {});
      } catch (erreur) {
        reject(erreur);
      }
    });
    requete.on("error", reject);
  });
}

function envoyerJSON(reponse: ServerResponse, statut: number, corps: unknown): void {
  reponse.writeHead(statut, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  reponse.end(JSON.stringify(corps));
}

const EN_TETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function creerServeur() {
  return createServer(async (requete, reponse) => {
    if (requete.method === "OPTIONS") {
      reponse.writeHead(204, EN_TETES_CORS);
      reponse.end();
      return;
    }
    if (requete.method === "GET" && requete.url === "/api/sante") {
      envoyerJSON(reponse, 200, { statut: "ok" });
      return;
    }
    if (requete.method === "POST" && requete.url === "/api/relancer") {
      try {
        const corps = (await lireCorpsJSON(requete)) as RequeteRelance;
        const resultat = await gererRelance(corps);
        envoyerJSON(reponse, 200, resultat);
      } catch (erreur) {
        envoyerJSON(reponse, 500, {
          ok: false,
          message: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
      return;
    }
    envoyerJSON(reponse, 404, { message: "Route inconnue" });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = PORT;
  creerServeur().listen(port, () => {
    console.log(`Serveur de monitoring local sur http://localhost:${port}`);
  });
}
```

(`creerServeur`'s handler doit inclure les en-têtes CORS `EN_TETES_CORS` aussi sur les réponses
`envoyerJSON` — étends `envoyerJSON` pour fusionner `EN_TETES_CORS` dans ses en-têtes plutôt que
de dupliquer `"Access-Control-Allow-Origin": "*"` séparément.)

- [ ] **Step 4 : Ajouter le script npm**

Modifier `package.json`, section `scripts`, ajouter :

```json
    "monitoring-server": "tsx src/ingestion/serveur-local.ts",
```

(à la suite de `"ingestion": "tsx src/ingestion/run.ts"`)

- [ ] **Step 5 : Vérifier et committer**

Run: `npx vitest run src/ingestion/serveur-local.test.ts`
Expected: PASS (4 tests, inchangé — le serveur HTTP lui-même n'est pas testé unitairement, voir
Global Constraints)

Run: `npm test` (suite complète) et `npx tsc --noEmit`
Expected: tout passe, aucune erreur de typage

```bash
git add src/ingestion/serveur-local.ts src/ingestion/serveur-local.test.ts package.json
git commit -m "feat(monitoring): serveur local de relance (insert/update)"
```

---

### Task 4 : Page `Monitoring.tsx` et routage

**Files:**
- Create: `src/ui/monitoring/glob.ts`
- Create: `src/ui/Monitoring.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `extraireSlug`, `calculerCouverture`, `type CouvertureCandidat` (Task 2) ;
  `type RequeteRelance`, `type ResultatRelance` (Task 3, importés en **type** uniquement — le
  frontend ne fait jamais un import valeur de `serveur-local.ts`, seulement un `fetch()` HTTP
  vers lui) ; `Theme` de `src/types.ts` ; `data/themes.json`, `data/programmes/*/{meta,
  propositions,_a-verifier}.json` (via `import.meta.glob`).
- Produces: composant par défaut `Monitoring` (`src/ui/Monitoring.tsx`), routage `/monitoring`
  dans `App.tsx`.

Cette tâche n'a pas de test automatisé (composant React, voir Global Constraints) — vérification
manuelle au navigateur à la fin.

- [ ] **Step 1 : Câblage `import.meta.glob`**

Créer `src/ui/monitoring/glob.ts` :

```ts
import type { CandidatMeta, Proposition } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";
import { extraireSlug } from "./couverture";

const metaModules = import.meta.glob("../../../data/programmes/*/meta.json", { eager: true }) as Record<
  string,
  { default: CandidatMeta }
>;
const propositionsModules = import.meta.glob("../../../data/programmes/*/propositions.json", {
  eager: true,
}) as Record<string, { default: Proposition[] }>;
const aVerifierModules = import.meta.glob("../../../data/programmes/*/_a-verifier.json", {
  eager: true,
}) as Record<string, { default: EntreeAVerifier[] }>;

function construireRecord<T>(modules: Record<string, { default: T }>): Record<string, T> {
  const resultat: Record<string, T> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    resultat[extraireSlug(chemin)] = module.default;
  }
  return resultat;
}

export function construireDonneesCouverture(): {
  metas: Record<string, CandidatMeta>;
  propositions: Record<string, Proposition[]>;
  aVerifier: Record<string, EntreeAVerifier[]>;
} {
  return {
    metas: construireRecord(metaModules),
    propositions: construireRecord(propositionsModules),
    aVerifier: construireRecord(aVerifierModules),
  };
}
```

- [ ] **Step 2 : Créer le composant `Monitoring`**

Créer `src/ui/Monitoring.tsx` :

```tsx
import { useEffect, useState } from "react";
import themesData from "../../data/themes.json";
import type { Theme } from "../types";
import { calculerCouverture, type CouvertureCandidat } from "./monitoring/couverture";
import { construireDonneesCouverture } from "./monitoring/glob";
import type { RequeteRelance, ResultatRelance } from "../ingestion/serveur-local";

const URL_SERVEUR_LOCAL = "http://localhost:5175";
const themes = themesData as Theme[];

type ModeRelance = "insert" | "update";

export default function Monitoring() {
  const { metas, propositions, aVerifier } = construireDonneesCouverture();
  const couverture: CouvertureCandidat[] = calculerCouverture(themes, metas, propositions, aVerifier);

  const [serveurDisponible, setServeurDisponible] = useState(false);
  useEffect(() => {
    let annule = false;
    fetch(`${URL_SERVEUR_LOCAL}/api/sante`)
      .then((reponse) => {
        if (!annule) setServeurDisponible(reponse.ok);
      })
      .catch(() => {
        if (!annule) setServeurDisponible(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  const [slugSelectionne, setSlugSelectionne] = useState<string>(couverture[0]?.slug ?? "");
  const [themesSelectionnes, setThemesSelectionnes] = useState<string[]>([]);
  const [mode, setMode] = useState<ModeRelance>("insert");
  const [cleApi, setCleApi] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<ResultatRelance["resultats"] | null>(null);
  const [erreurRelance, setErreurRelance] = useState<string | null>(null);

  function basculerTheme(themeId: string): void {
    setThemesSelectionnes((precedent) =>
      precedent.includes(themeId) ? precedent.filter((t) => t !== themeId) : [...precedent, themeId],
    );
  }

  async function lancerRelance(): Promise<void> {
    setEnCours(true);
    setErreurRelance(null);
    setResultats(null);
    const requete: RequeteRelance = { slug: slugSelectionne, themes: themesSelectionnes, mode, cleApi };
    try {
      const reponse = await fetch(`${URL_SERVEUR_LOCAL}/api/relancer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requete),
      });
      const corps = (await reponse.json()) as ResultatRelance & { message?: string };
      if (!reponse.ok) {
        setErreurRelance(corps.message ?? "Erreur inconnue du serveur local");
      } else {
        setResultats(corps.resultats);
      }
    } catch {
      setErreurRelance("Impossible de joindre le serveur local (localhost:5175). Vérifie qu'il est lancé.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="monitoring">
      <h1>Monitoring du pipeline d'ingestion</h1>

      {couverture.length === 0 && <p>Aucune donnée de candidat trouvée dans data/programmes/.</p>}

      {couverture.map((candidat) => (
        <div className="monitoring-candidat" key={candidat.slug}>
          <h2>
            {candidat.nom} <span className="monitoring-date">— meta.json mis à jour le {candidat.dateDerniereMaj}</span>
          </h2>
          <table className="monitoring-grille">
            <thead>
              <tr>
                <th>Thème</th>
                <th>Complet</th>
                <th>Partiel</th>
                <th>Provisoire</th>
                <th>Dernière vérification</th>
              </tr>
            </thead>
            <tbody>
              {candidat.parTheme.map((theme) => (
                <tr key={theme.themeId}>
                  <td>{theme.libelle}</td>
                  <td>{theme.parStatut.complet}</td>
                  <td>{theme.parStatut.partiel}</td>
                  <td>{theme.parStatut.provisoire}</td>
                  <td>{theme.dateVerificationRecente ?? "aucune donnée"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {candidat.enAttente.length > 0 && (
            <div className="monitoring-en-attente">
              <p className="monitoring-badge">Non relu, non vérifié — {candidat.enAttente.length} en attente</p>
              <ul>
                {candidat.enAttente.map((entree, index) => (
                  <li key={index}>
                    <strong>{entree.theme}</strong> — {entree.proposition.titre} : {entree.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      <div className="monitoring-relance">
        <h2>Relancer le pipeline</h2>
        {!serveurDisponible && (
          <p className="monitoring-badge">Disponible en local uniquement — serveur non détecté sur localhost:5175.</p>
        )}
        {serveurDisponible && (
          <>
            <label>
              Candidat
              <select value={slugSelectionne} onChange={(e) => setSlugSelectionne(e.target.value)}>
                {couverture.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Thèmes</legend>
              {themes.map((theme) => (
                <label key={theme.id}>
                  <input
                    type="checkbox"
                    checked={themesSelectionnes.includes(theme.id)}
                    onChange={() => basculerTheme(theme.id)}
                  />
                  {theme.libelle}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Mode</legend>
              <label>
                <input type="radio" name="mode" checked={mode === "insert"} onChange={() => setMode("insert")} />
                Insert (génère les combinaisons manquantes, saute celles déjà couvertes)
              </label>
              <label>
                <input type="radio" name="mode" checked={mode === "update"} onChange={() => setMode("update")} />
                Update (revérifie les combinaisons déjà couvertes, écrit les divergences dans _a-verifier.json)
              </label>
            </fieldset>
            <label>
              Clé API Claude (reste sur ta machine, jamais envoyée ailleurs qu'au serveur local)
              <input type="password" value={cleApi} onChange={(e) => setCleApi(e.target.value)} />
            </label>
            <button type="button" disabled={enCours || themesSelectionnes.length === 0 || !cleApi} onClick={lancerRelance}>
              {enCours ? "En cours..." : "Relancer"}
            </button>
            {erreurRelance && <p className="monitoring-erreur">{erreurRelance}</p>}
            {resultats && (
              <ul>
                {resultats.map((r) => (
                  <li key={r.theme}>
                    {r.theme} — {r.statut}
                    {r.message ? ` : ${r.message}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3 : Router `/monitoring`**

Modifier `src/App.tsx` : ajouter l'import `import Monitoring from "./ui/Monitoring";` en tête, et
ajouter, comme première instruction du corps de `App()` (avant le `if (ecran === "accueil")`) :

```tsx
  if (window.location.pathname === "/monitoring") {
    return <Monitoring />;
  }
```

- [ ] **Step 4 : Styles**

Ajouter à `src/index.css`, à la suite des styles existants :

```css
.monitoring {
  max-width: 960px;
}

.monitoring-candidat {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #8888;
  border-radius: 0.5rem;
}

.monitoring-date {
  font-size: 0.8rem;
  font-weight: normal;
  opacity: 0.75;
}

.monitoring-grille {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.monitoring-grille th,
.monitoring-grille td {
  text-align: left;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #8884;
}

.monitoring-en-attente {
  margin-top: 1rem;
  padding: 0.75rem;
  border: 1px solid #b45309;
  border-radius: 0.25rem;
}

.monitoring-badge {
  font-weight: 600;
  color: #b45309;
  margin: 0 0 0.5rem;
}

.monitoring-relance {
  margin-top: 2rem;
  padding: 1rem;
  border: 1px solid #8888;
  border-radius: 0.5rem;
}

.monitoring-relance fieldset {
  margin: 0.75rem 0;
}

.monitoring-erreur {
  color: #b91c1c;
  font-weight: 600;
}
```

- [ ] **Step 5 : Vérification manuelle au navigateur**

Run: `npm test` (suite complète) et `npx tsc --noEmit`
Expected: tout passe, aucune erreur de typage (en particulier, vérifie que l'import de type
`RequeteRelance`/`ResultatRelance` depuis `../ingestion/serveur-local` dans `Monitoring.tsx`
compile sans tirer de code `node:http` dans le bundle Vite — lance `npm run build` pour confirmer
que le build statique réussit).

Lancer `npm run dev`, ouvrir `http://localhost:5173/monitoring` dans le navigateur :
- Vérifier que la grille de couverture s'affiche pour les candidats existants (le-pen, melenchon,
  philippe avec leurs propositions ; attal, glucksmann, retailleau, ruffin, faure avec des lignes
  à "aucune donnée" partout puisqu'ils n'ont pas encore de `propositions.json`).
- Vérifier que le message "disponible en local uniquement" s'affiche (le serveur local n'est pas
  encore lancé à ce stade).
- Lancer `npm run monitoring-server` dans un second terminal, recharger la page : vérifier que le
  formulaire de relance apparaît (candidat, thèmes, mode, clé API, bouton).
- Optionnel (dépense réelle si une vraie clé API est utilisée) : tester une relance sur un seul
  thème d'un candidat existant en mode update, vérifier que la réponse s'affiche et que
  `propositions.json` n'est jamais modifié en cas de non-divergence.

```bash
git add src/ui/monitoring/glob.ts src/ui/Monitoring.tsx src/App.tsx src/index.css
git commit -m "feat(monitoring): page /monitoring avec grille de couverture et relance"
```
