# Pipeline d'ingestion via l'API Claude — Plan d'implémentation

> **Pour les exécutants agentiques :** SOUS-SKILL REQUIS : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour implémenter ce plan tâche par tâche.

**Objectif :** Construire `src/ingestion/`, un pipeline scriptable, idempotent et rejouable qui
utilise l'API Claude (Opus 5, outils web restreints au domaine officiel de chaque candidat) pour
générer puis vérifier de façon adversariale des propositions conformes au schéma existant, avant
de les fusionner dans `data/programmes/<slug>/propositions.json`.

**Architecture :** Deux passes API indépendantes par combinaison candidat × thème (génération
restreinte au domaine officiel, puis vérification adversariale à contexte neuf), précédées de
contrôles déterministes gratuits (URL vivante, domaine autorisé, chiffres cités présents). Un
orchestrateur (`run.ts`) gère l'idempotence, un mode `--refresh` pour les combinaisons déjà
couvertes, et un échantillonnage périodique de re-vérification.

**Tech Stack :** TypeScript, Node 22 (exécution via `tsx`, sans compilation préalable), Vitest
pour les tests, `@anthropic-ai/sdk` pour les appels API. Aucune nouvelle dépendance de
production — tout reste en devDependencies, ce sous-système ne fait jamais partie du bundle Vite.

**Spec :** `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md`

## Global Constraints

- Ce sous-système est un outil de développement/ops (scripts Node exécutés via `tsx`), jamais
  importé depuis `src/ui` ou `src/engine`. `@anthropic-ai/sdk` et `tsx` vont en
  devDependencies, pas en dependencies.
- `ANTHROPIC_API_KEY` vit uniquement dans `.env` (gitignoré) — jamais codée en dur, jamais
  loguée, jamais incluse dans un message de commit ou un rapport.
- Le type `Proposition` de `src/types.ts` reste la source de vérité unique : ne jamais dupliquer
  indépendamment sa définition ailleurs.
- Toute fonction qui effectue un appel réseau (API Anthropic ou `fetch` direct vers une source)
  doit recevoir le client / l'implémentation de fetch en paramètre (injection de dépendance),
  pour rester testable sans appel réseau réel. Aucun test unitaire de ce plan ne doit effectuer
  un appel réseau réel.
- Une proposition `FAIL` (contrôle déterministe ou vérification sémantique) n'est **jamais**
  fusionnée dans `propositions.json` — toujours écrite dans `_a-verifier.json`.
- Toute écriture dans un `propositions.json` déjà existant est précédée d'une vérification
  d'idempotence (mode normal, on saute) ou d'une comparaison explicite (mode `--refresh`, on
  compare et on écrit la divergence à part) — jamais un écrasement silencieux d'une donnée
  déjà validée.
- Les prompts système (`src/ingestion/prompts/*.md`) doivent respecter la convention
  `resume_factuel`/`hypotheses_calcul`, la neutralité des titres, l'interdiction de narration de
  type changelog, et la règle de renvoi réciproque cross-thème, telles que documentées dans
  `docs/methodologie.md`.
- Noms de fonctions, fichiers et champs en français, cohérent avec le reste du code (`src/engine`,
  `src/data`).

---

### Task 1 : Dépendances, configuration et chargement de l'environnement

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `src/ingestion/env.ts`
- Test: `src/ingestion/env.test.ts`

**Interfaces:**
- Produces: `chargerEnv(cheminFichier?: string): void` — lit un fichier `.env` (par défaut
  `.env` à la racine du dépôt) et peuple `process.env` pour toute clé qui n'y est pas déjà
  définie. Ne lève jamais si le fichier est absent. Utilisée par `generate.ts`/`verify.ts`/
  `run.ts` (Tasks 4, 5, 8) avant toute construction de client Anthropic.

- [ ] **Step 1 : Ajouter les dépendances et le script npm**

Modifier `package.json` :

```json
{
  "name": "simulateur-impact-2027",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "ingestion": "tsx src/ingestion/run.ts"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.126.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "tsx": "^4.23.13",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

Run: `npm install`

- [ ] **Step 2 : Ignorer `.env` et créer le gabarit**

Ajouter à `.gitignore` :

```
node_modules
dist
.superpowers
*.tsbuildinfo
/vite.config.js
/vite.config.d.ts
.env
data/programmes/*/_a-verifier.json
```

Créer `.env.example` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3 : Écrire le test de `chargerEnv` (échoue)**

Créer `src/ingestion/env.test.ts` :

```ts
import { afterEach, describe, expect, it } from "vitest";
import { unlinkSync, writeFileSync } from "node:fs";
import { chargerEnv } from "./env";

const CHEMIN_TEST = "src/ingestion/.env.test-tmp";

describe("chargerEnv", () => {
  afterEach(() => {
    delete process.env.TEST_CLE_ENV;
    delete process.env.TEST_CLE_DEJA_DEFINIE;
    try {
      unlinkSync(CHEMIN_TEST);
    } catch {
      // fichier déjà absent, rien à nettoyer
    }
  });

  it("charge les variables d'un fichier .env dans process.env", () => {
    writeFileSync(CHEMIN_TEST, "TEST_CLE_ENV=valeur-test\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_ENV).toBe("valeur-test");
  });

  it("ne remplace pas une variable déjà définie dans l'environnement", () => {
    process.env.TEST_CLE_DEJA_DEFINIE = "valeur-existante";
    writeFileSync(CHEMIN_TEST, "TEST_CLE_DEJA_DEFINIE=valeur-du-fichier\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_DEJA_DEFINIE).toBe("valeur-existante");
  });

  it("ne fait rien si le fichier n'existe pas", () => {
    expect(() => chargerEnv("chemin/inexistant/.env")).not.toThrow();
  });

  it("ignore les lignes vides et les commentaires", () => {
    writeFileSync(CHEMIN_TEST, "# commentaire\n\nTEST_CLE_ENV=valeur-test\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_ENV).toBe("valeur-test");
  });
});
```

Run: `npx vitest run src/ingestion/env.test.ts`
Expected: FAIL — `Cannot find module './env'`

- [ ] **Step 4 : Implémenter `chargerEnv`**

Créer `src/ingestion/env.ts` :

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function chargerEnv(cheminFichier: string = resolve(process.cwd(), ".env")): void {
  if (!existsSync(cheminFichier)) return;
  const contenu = readFileSync(cheminFichier, "utf-8");
  for (const ligne of contenu.split("\n")) {
    const ligneNettoyee = ligne.trim();
    if (ligneNettoyee === "" || ligneNettoyee.startsWith("#")) continue;
    const indexEgal = ligneNettoyee.indexOf("=");
    if (indexEgal === -1) continue;
    const cle = ligneNettoyee.slice(0, indexEgal).trim();
    const valeur = ligneNettoyee
      .slice(indexEgal + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[cle] === undefined) {
      process.env[cle] = valeur;
    }
  }
}
```

- [ ] **Step 5 : Vérifier et committer**

Run: `npx vitest run src/ingestion/env.test.ts`
Expected: PASS (4 tests)

```bash
git add package.json package-lock.json .gitignore .env.example src/ingestion/env.ts src/ingestion/env.test.ts
git commit -m "feat(ingestion): dépendances, .env et chargement d'environnement"
```

---

### Task 2 : Schéma structured-output et validation (`schema.ts`)

**Files:**
- Create: `src/ingestion/schema.ts`
- Test: `src/ingestion/schema.test.ts`

**Interfaces:**
- Consumes: `Proposition`, `Source`, `StatutProposition` de `src/types.ts`.
- Produces: `SCHEMA_PROPOSITION_GENEREE` (objet JSON Schema), `type PropositionGeneree = Omit<Proposition, "id" | "candidat">`, `validerPropositionGeneree(valeur: unknown): valeur is PropositionGeneree`. Utilisés par `generate.ts` (Task 4), `verify.ts` (Task 5) et `run.ts` (Tasks 6-7).

- [ ] **Step 1 : Écrire les tests (échouent)**

Créer `src/ingestion/schema.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { validerPropositionGeneree } from "./schema";

const PROPOSITION_VALIDE = {
  titre: "Titre neutre de la mesure",
  resume_factuel: "Le candidat propose de...",
  sources: [
    { type: "primaire", label: "Programme officiel", url: "https://exemple-officiel.fr/programme" },
    { type: "primaire", label: "Page mesure dédiée", url: "https://exemple-officiel.fr/mesure" },
  ],
  chiffrage_disponible: true,
  hypotheses_calcul: "Chiffrage basé sur...",
  statut: "complet",
  date_derniere_verification: "2026-09-18",
};

describe("validerPropositionGeneree", () => {
  it("accepte une proposition conforme", () => {
    expect(validerPropositionGeneree(PROPOSITION_VALIDE)).toBe(true);
  });

  it("rejette une proposition avec un champ manquant", () => {
    const { titre: _titre, ...sansTitre } = PROPOSITION_VALIDE;
    expect(validerPropositionGeneree(sansTitre)).toBe(false);
  });

  it("rejette un statut invalide", () => {
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, statut: "en-cours" })).toBe(false);
  });

  it("rejette moins de deux sources", () => {
    expect(
      validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [PROPOSITION_VALIDE.sources[0]] }),
    ).toBe(false);
  });

  it("rejette un type de source invalide", () => {
    expect(
      validerPropositionGeneree({
        ...PROPOSITION_VALIDE,
        sources: [{ type: "tertiaire", label: "x", url: "https://exemple.fr" }, PROPOSITION_VALIDE.sources[1]],
      }),
    ).toBe(false);
  });

  it("rejette une valeur qui n'est pas un objet", () => {
    expect(validerPropositionGeneree("pas un objet")).toBe(false);
    expect(validerPropositionGeneree(null)).toBe(false);
  });
});
```

Run: `npx vitest run src/ingestion/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 2 : Implémenter le schéma et le validateur**

Créer `src/ingestion/schema.ts` :

```ts
import type { Proposition, Source, StatutProposition } from "../types";

export const SCHEMA_PROPOSITION_GENEREE = {
  type: "object",
  properties: {
    titre: { type: "string" },
    resume_factuel: { type: "string" },
    sources: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["primaire", "secondaire"] },
          label: { type: "string" },
          url: { type: "string" },
        },
        required: ["type", "label", "url"],
        additionalProperties: false,
      },
    },
    chiffrage_disponible: { type: "boolean" },
    hypotheses_calcul: { type: "string" },
    statut: { type: "string", enum: ["complet", "partiel", "provisoire"] },
    date_derniere_verification: { type: "string" },
  },
  required: [
    "titre",
    "resume_factuel",
    "sources",
    "chiffrage_disponible",
    "hypotheses_calcul",
    "statut",
    "date_derniere_verification",
  ],
  additionalProperties: false,
} as const;

export type PropositionGeneree = Omit<Proposition, "id" | "candidat">;

const STATUTS_VALIDES: StatutProposition[] = ["complet", "partiel", "provisoire"];
const TYPES_SOURCE_VALIDES: Source["type"][] = ["primaire", "secondaire"];

export function validerPropositionGeneree(valeur: unknown): valeur is PropositionGeneree {
  if (typeof valeur !== "object" || valeur === null) return false;
  const p = valeur as Record<string, unknown>;

  if (typeof p.titre !== "string" || p.titre.length === 0) return false;
  if (typeof p.resume_factuel !== "string" || p.resume_factuel.length === 0) return false;
  if (typeof p.chiffrage_disponible !== "boolean") return false;
  if (typeof p.hypotheses_calcul !== "string") return false;
  if (typeof p.statut !== "string" || !STATUTS_VALIDES.includes(p.statut as StatutProposition)) {
    return false;
  }
  if (typeof p.date_derniere_verification !== "string") return false;
  if (!Array.isArray(p.sources) || p.sources.length < 2) return false;

  for (const source of p.sources) {
    if (typeof source !== "object" || source === null) return false;
    const s = source as Record<string, unknown>;
    if (typeof s.type !== "string" || !TYPES_SOURCE_VALIDES.includes(s.type as Source["type"])) {
      return false;
    }
    if (typeof s.label !== "string" || s.label.length === 0) return false;
    if (typeof s.url !== "string" || s.url.length === 0) return false;
  }

  return true;
}
```

- [ ] **Step 3 : Vérifier et committer**

Run: `npx vitest run src/ingestion/schema.test.ts`
Expected: PASS (6 tests)

```bash
git add src/ingestion/schema.ts src/ingestion/schema.test.ts
git commit -m "feat(ingestion): schéma structured-output et validation des propositions générées"
```

---

### Task 3 : Domaines officiels et contrôles déterministes

**Files:**
- Create: `src/ingestion/domaines.ts`
- Create: `src/ingestion/checks.ts`
- Test: `src/ingestion/domaines.test.ts`
- Test: `src/ingestion/checks.test.ts`

**Interfaces:**
- Consumes: `CandidatMeta` de `src/types.ts` ; `PropositionGeneree` de `schema.ts` (Task 2).
- Produces: `domainesAutorises(meta: CandidatMeta): string[]` ; `verifierUrlDisponible(url: string, fetchImpl?: FetchImpl): Promise<boolean>` ; `verifierDomaineAutorise(url: string, domaines: string[]): boolean` ; `verifierChiffresPresents(hypothesesCalcul: string, texteFetched: string): boolean` ; `type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>`. Utilisés par `generate.ts` (Task 4) et `verify.ts` (Task 5).

- [ ] **Step 1 : Écrire les tests de `domainesAutorises` (échouent)**

Créer `src/ingestion/domaines.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { domainesAutorises } from "./domaines";
import type { CandidatMeta } from "../types";

function metaAvec(urls: string[]): CandidatMeta {
  return {
    slug: "test",
    nom: "Candidat Test",
    parti: "Parti Test",
    date_derniere_maj: "2026-09-18",
    sources_officielles: urls.map((url, i) => ({ type: "primaire", label: `Source ${i}`, url })),
  };
}

describe("domainesAutorises", () => {
  it("extrait le nom d'hôte d'une seule source", () => {
    expect(domainesAutorises(metaAvec(["https://exemple-officiel.fr/programme"]))).toEqual([
      "exemple-officiel.fr",
    ]);
  });

  it("déduplique les domaines identiques", () => {
    const domaines = domainesAutorises(
      metaAvec(["https://exemple-officiel.fr/a", "https://exemple-officiel.fr/b"]),
    );
    expect(domaines).toEqual(["exemple-officiel.fr"]);
  });

  it("liste plusieurs domaines distincts", () => {
    const domaines = domainesAutorises(
      metaAvec(["https://site-campagne.fr/programme", "https://parti-officiel.fr/mesures"]),
    );
    expect(domaines).toEqual(["site-campagne.fr", "parti-officiel.fr"]);
  });

  it("ignore une URL invalide sans lever d'exception", () => {
    expect(() => domainesAutorises(metaAvec(["pas-une-url"]))).not.toThrow();
    expect(domainesAutorises(metaAvec(["pas-une-url"]))).toEqual([]);
  });
});
```

Run: `npx vitest run src/ingestion/domaines.test.ts`
Expected: FAIL — `Cannot find module './domaines'`

- [ ] **Step 2 : Implémenter `domainesAutorises`**

Créer `src/ingestion/domaines.ts` :

```ts
import type { CandidatMeta } from "../types";

export function domainesAutorises(meta: CandidatMeta): string[] {
  const domaines = new Set<string>();
  for (const source of meta.sources_officielles) {
    try {
      domaines.add(new URL(source.url).hostname);
    } catch {
      // URL invalide dans les données existantes : ignorée plutôt que d'interrompre le lot
    }
  }
  return Array.from(domaines);
}
```

Run: `npx vitest run src/ingestion/domaines.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 3 : Écrire les tests des contrôles déterministes (échouent)**

Créer `src/ingestion/checks.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  verifierChiffresPresents,
  verifierDomaineAutorise,
  verifierUrlDisponible,
} from "./checks";

describe("verifierUrlDisponible", () => {
  it("retourne true si la réponse est ok", async () => {
    const fetchFactice = async () => new Response("", { status: 200 });
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(true);
  });

  it("retourne false si la réponse n'est pas ok", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(false);
  });

  it("retourne false si fetch lève une exception", async () => {
    const fetchFactice = async () => {
      throw new Error("réseau indisponible");
    };
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(false);
  });
});

describe("verifierDomaineAutorise", () => {
  it("accepte un domaine dans la liste", () => {
    expect(verifierDomaineAutorise("https://exemple-officiel.fr/x", ["exemple-officiel.fr"])).toBe(true);
  });

  it("rejette un domaine hors liste", () => {
    expect(verifierDomaineAutorise("https://autre-site.fr/x", ["exemple-officiel.fr"])).toBe(false);
  });

  it("rejette une URL malformée", () => {
    expect(verifierDomaineAutorise("pas-une-url", ["exemple-officiel.fr"])).toBe(false);
  });
});

describe("verifierChiffresPresents", () => {
  it("accepte un chiffre présent tel quel", () => {
    expect(verifierChiffresPresents("Coût estimé à 1200 euros", "Le dispositif coûte 1200 euros par an.")).toBe(true);
  });

  it("accepte un chiffre présent avec une séparation différente", () => {
    expect(verifierChiffresPresents("Coût estimé à 1 200 euros", "Le dispositif coûte 1200 euros par an.")).toBe(true);
  });

  it("rejette un chiffre absent du texte", () => {
    expect(verifierChiffresPresents("Coût estimé à 4500 euros", "Le dispositif coûte 1200 euros par an.")).toBe(false);
  });

  it("accepte trivialement s'il n'y a aucun chiffre cité", () => {
    expect(verifierChiffresPresents("Aucun chiffrage précisé par le candidat.", "Texte sans rapport.")).toBe(true);
  });
});
```

Run: `npx vitest run src/ingestion/checks.test.ts`
Expected: FAIL — `Cannot find module './checks'`

- [ ] **Step 4 : Implémenter les contrôles déterministes**

Créer `src/ingestion/checks.ts` :

```ts
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export async function verifierUrlDisponible(url: string, fetchImpl: FetchImpl = fetch): Promise<boolean> {
  try {
    const reponse = await fetchImpl(url, { method: "GET" });
    return reponse.ok;
  } catch {
    return false;
  }
}

export function verifierDomaineAutorise(url: string, domaines: string[]): boolean {
  try {
    return domaines.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function extraireChiffres(texte: string): string[] {
  return texte.match(/\d[\d\s.,]*\d|\d/g) ?? [];
}

function normaliserChiffre(chiffre: string): string {
  return chiffre.replace(/[\s.,]/g, "");
}

export function verifierChiffresPresents(hypothesesCalcul: string, texteFetched: string): boolean {
  const chiffres = extraireChiffres(hypothesesCalcul);
  if (chiffres.length === 0) return true;
  const texteNormalise = normaliserChiffre(texteFetched);
  return chiffres.every((chiffre) => texteNormalise.includes(normaliserChiffre(chiffre)));
}
```

- [ ] **Step 5 : Vérifier et committer**

Run: `npx vitest run src/ingestion/domaines.test.ts src/ingestion/checks.test.ts`
Expected: PASS (14 tests au total)

```bash
git add src/ingestion/domaines.ts src/ingestion/domaines.test.ts src/ingestion/checks.ts src/ingestion/checks.test.ts
git commit -m "feat(ingestion): extraction des domaines officiels et contrôles déterministes"
```

---

### Task 4 : Génération — passe 1 (`generate.ts`)

**Files:**
- Create: `src/ingestion/prompts/generation.md`
- Create: `src/ingestion/generate.ts`
- Test: `src/ingestion/generate.test.ts`

**Interfaces:**
- Consumes: `domainesAutorises` (Task 3), `SCHEMA_PROPOSITION_GENEREE`/`validerPropositionGeneree`/`PropositionGeneree` (Task 2), `CandidatMeta` de `src/types.ts`.
- Produces: `type ClientAnthropicMinimal` (interface minimale du client, pour l'injection de dépendance) ; `type RequeteGeneration` ; `construireRequeteGeneration(meta, themeId, themeLibelle, titresExistants): RequeteGeneration` ; `genererPropositions(client: ClientAnthropicMinimal, meta, themeId, themeLibelle, titresExistants): Promise<PropositionGeneree[]>` ; `creerClient(): Anthropic`. `genererPropositions` et `RequeteGeneration` sont consommés par `run.ts` (Tasks 6-7) ; `verify.ts` (Task 5) réutilise `type RequeteGeneration` et `type ClientAnthropicMinimal`.

**Note pour l'implémenteur :** la forme exacte de `output_config.format` pour les structured
outputs peut différer légèrement de ce qui suit selon la version installée de
`@anthropic-ai/sdk` — consulter la skill `claude-api` (fichier
`typescript/claude-api/tool-use.md`, section structured outputs) si le compilateur signale un
écart de typage, et ajuster en conséquence sans changer les noms de fonctions/exports listés
ci-dessus (dont dépendent les tâches 5, 6 et 7).

- [ ] **Step 1 : Écrire le gabarit de prompt de génération**

Créer `src/ingestion/prompts/generation.md` :

```markdown
Tu es un assistant de recherche pour un simulateur d'impact citoyen strictement neutre et
indépendant de tout parti (voir CLAUDE.md du projet). Ta tâche : rechercher les propositions du
programme officiel de {{CANDIDAT}} pour un thème donné, en te limitant strictement aux domaines
qui te sont autorisés par les outils web (site de campagne officiel du candidat).

Règles impératives (voir docs/methodologie.md du projet) :

- Une source **primaire** est une propriété officielle de campagne du candidat ou de son parti.
  N'utilise que les domaines autorisés — jamais une retranscription tierce, un agrégateur, un
  comparateur, même fidèle.
- Chaque proposition doit citer au moins deux sources distinctes (deux pages différentes du
  domaine officiel suffisent).
- `resume_factuel` énonce ce que propose le candidat et ce que la source laisse non précisé
  (mécanisme, montant, calendrier). N'invente jamais un mécanisme non mentionné.
- `hypotheses_calcul` est réservé aux chiffrages, à leur contestation, aux réserves de
  faisabilité ou de conformité légale — jamais une narration de type changelog ou une phrase
  d'auto-assurance sur la vérification elle-même.
- Le champ `titre` doit être neutre et descriptif, jamais une formulation partisane ou un
  slogan non cité entre guillemets.
- `statut` qualifie la qualité de TA recherche (complet/partiel/provisoire), pas la précision du
  programme du candidat : une fiche honnêtement sourcée sur un programme vague reste "complet".
- Propositions déjà écrites pour ce candidat (tous thèmes confondus), pour éviter un doublon :
{{TITRES_EXISTANTS}}
  Si la mesure que tu identifies recoupe l'une d'entre elles, n'écris pas de fiche indépendante
  — indique-le explicitement dans `resume_factuel` avec un renvoi en langage clair (jamais un
  identifiant interne brut) vers le thème déjà concerné.

Réponds uniquement avec le tableau JSON de propositions demandé, sans texte hors du schéma.
```

- [ ] **Step 2 : Écrire les tests de construction de requête (échouent)**

Créer `src/ingestion/generate.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { construireRequeteGeneration, genererPropositions } from "./generate";
import type { CandidatMeta } from "../types";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [
    { type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" },
  ],
};

describe("construireRequeteGeneration", () => {
  it("restreint les outils web au domaine officiel du candidat", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    for (const outil of requete.tools as Array<{ allowed_domains?: string[] }>) {
      expect(outil.allowed_domains).toEqual(["exemple-officiel.fr"]);
    }
  });

  it("inclut le nom du candidat dans le prompt système", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.system).toContain("Candidat Test");
  });

  it("inclut les titres existants pour éviter les doublons", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", ["Mesure déjà écrite"]);
    expect(requete.system).toContain("Mesure déjà écrite");
  });

  it("utilise le modèle claude-opus-5", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.model).toBe("claude-opus-5");
  });
});

describe("genererPropositions", () => {
  it("filtre les propositions qui ne passent pas la validation de schéma", async () => {
    const propositionValide = {
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
    const propositionInvalide = { titre: "Incomplète" };
    const clientFactice = {
      messages: {
        create: async () => ({
          content: [{ type: "text", text: JSON.stringify([propositionValide, propositionInvalide]) }],
        }),
      },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([propositionValide]);
  });

  it("retourne un tableau vide si la réponse ne contient pas de bloc texte", async () => {
    const clientFactice = { messages: { create: async () => ({ content: [] }) } };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });

  it("retourne un tableau vide si le texte n'est pas un JSON valide", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: "pas du JSON valide {{{" }] }) },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });

  it("retourne un tableau vide si le JSON valide n'est pas un tableau", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify({ pas: "un tableau" }) }] }) },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });
});
```

Run: `npx vitest run src/ingestion/generate.test.ts`
Expected: FAIL — `Cannot find module './generate'`

- [ ] **Step 3 : Implémenter `generate.ts`**

Créer `src/ingestion/generate.ts` :

```ts
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import { domainesAutorises } from "./domaines";
import { SCHEMA_PROPOSITION_GENEREE, validerPropositionGeneree, type PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-opus-5";

export interface RequeteGeneration {
  model: string;
  system: string;
  tools: Array<{ type: string; name: string; allowed_domains: string[] }>;
  output_config: { format: unknown; effort: string };
  messages: Array<{ role: "user"; content: string }>;
}

export interface ClientAnthropicMinimal {
  messages: {
    create(requete: RequeteGeneration): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export function construireRequeteGeneration(
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/generation.md"), "utf-8");
  const domaines = domainesAutorises(meta);
  const listeTitresExistants =
    titresExistants.length > 0
      ? titresExistants.map((titre) => `  - ${titre}`).join("\n")
      : "  (aucune proposition existante pour ce candidat)";

  const system = gabarit
    .replaceAll("{{CANDIDAT}}", meta.nom)
    .replace("{{TITRES_EXISTANTS}}", listeTitresExistants);

  return {
    model: MODELE,
    system,
    tools: [
      { type: "web_search_20260209", name: "web_search", allowed_domains: domaines },
      { type: "web_fetch_20260209", name: "web_fetch", allowed_domains: domaines },
    ],
    output_config: {
      format: { type: "json_schema", schema: { type: "array", items: SCHEMA_PROPOSITION_GENEREE } },
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Recherche les propositions du programme de ${meta.nom} pour le thème "${themeLibelle}" (id interne : ${themeId}), en te limitant strictement aux domaines autorisés : ${domaines.join(", ")}.`,
      },
    ],
  };
}

export async function genererPropositions(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): Promise<PropositionGeneree[]> {
  const requete = construireRequeteGeneration(meta, themeId, themeLibelle, titresExistants);
  const reponse = await client.messages.create(requete);
  const blocTexte = reponse.content.find((bloc) => bloc.type === "text");
  if (!blocTexte?.text) return [];
  let brut: unknown;
  try {
    brut = JSON.parse(blocTexte.text);
  } catch {
    return [];
  }
  if (!Array.isArray(brut)) return [];
  return brut.filter(validerPropositionGeneree);
}

export function creerClient(): Anthropic {
  return new Anthropic();
}
```

- [ ] **Step 4 : Vérifier et committer**

Run: `npx vitest run src/ingestion/generate.test.ts`
Expected: PASS (8 tests)

Run: `npx tsc -b --noEmit 2>&1 | grep ingestion` (ou `npx tsc --noEmit` sur le projet) pour
détecter un éventuel écart de typage avec le SDK installé sur `output_config`/`tools` ; corriger
si besoin en gardant les noms d'exports inchangés.

```bash
git add src/ingestion/prompts/generation.md src/ingestion/generate.ts src/ingestion/generate.test.ts
git commit -m "feat(ingestion): passe 1 - génération restreinte au domaine officiel"
```

---

### Task 5 : Vérification adversariale — passe 2 (`verify.ts`)

**Files:**
- Create: `src/ingestion/prompts/verification.md`
- Create: `src/ingestion/verify.ts`
- Test: `src/ingestion/verify.test.ts`

**Interfaces:**
- Consumes: `domainesAutorises` (Task 3), `verifierUrlDisponible`/`verifierDomaineAutorise`/`verifierChiffresPresents`/`FetchImpl` (Task 3), `PropositionGeneree` (Task 2), `RequeteGeneration`/`ClientAnthropicMinimal` (Task 4), `CandidatMeta` de `src/types.ts`.
- Produces: `type Verdict = { statut: "PASS" } | { statut: "FAIL"; raison: string }` ; `verifierControlesDeterministes(proposition, domaines, fetchImpl?): Promise<Verdict>` ; `verifier(client, meta, propositions, fetchImpl?): Promise<Map<string, Verdict>>` (clé = `titre` de la proposition). `verifier` est consommé par `run.ts` (Tasks 6-7).

- [ ] **Step 1 : Écrire le gabarit de prompt de vérification**

Créer `src/ingestion/prompts/verification.md` :

```markdown
Tu es un relecteur indépendant pour un simulateur d'impact citoyen strictement neutre. Tu reçois
une liste de propositions déjà rédigées concernant {{CANDIDAT}}, dont tu n'as pas vu le
raisonnement de production. Ta seule tâche : pour chacune, re-consulter ses sources citées (outil
web_fetch, restreint aux domaines officiels autorisés) et vérifier que :

1. Chaque affirmation de `resume_factuel` est réellement présente sur la page source (pas de
   mécanisme ou de portée inventés).
2. Chaque chiffre ou affirmation de `hypotheses_calcul` est réellement supporté par la page.
3. Aucune citation n'est déformée ou mal attribuée.
4. `statut` est cohérent avec ce que tu observes.

Ne corrige jamais une proposition toi-même. Réponds uniquement par le tableau JSON demandé, avec
pour chaque proposition son `titre` exact, un `verdict` ("PASS" ou "FAIL"), et si "FAIL" une
`raison` concise et concrète (ex : "le chiffre de 500€ n'apparaît sur aucune des pages citées").
```

- [ ] **Step 2 : Écrire les tests (échouent)**

Créer `src/ingestion/verify.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { verifier, verifierControlesDeterministes } from "./verify";
import type { CandidatMeta } from "../types";
import type { PropositionGeneree } from "./schema";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function proposition(overrides: Partial<PropositionGeneree> = {}): PropositionGeneree {
  return {
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [{ type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" }],
    chiffrage_disponible: true,
    hypotheses_calcul: "Coût de 1000 euros",
    statut: "complet",
    date_derniere_verification: "2026-09-18",
    ...overrides,
  };
}

describe("verifierControlesDeterministes", () => {
  it("échoue si une source est hors domaine autorisé", async () => {
    const p = proposition({ sources: [{ type: "primaire", label: "A", url: "https://autre-site.fr/a" }] });
    const verdict = await verifierControlesDeterministes(p, ["exemple-officiel.fr"]);
    expect(verdict.statut).toBe("FAIL");
  });

  it("échoue si une source est inaccessible", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("FAIL");
  });

  it("échoue si un chiffre cité n'apparaît dans aucune source", async () => {
    const fetchFactice = async () => new Response("Texte sans rapport avec le chiffre cité.");
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("FAIL");
  });

  it("passe si le domaine, la disponibilité et le chiffre sont corrects", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("PASS");
  });
});

describe("verifier", () => {
  it("n'appelle jamais le modèle pour une proposition qui échoue les contrôles déterministes", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    const create = vi.fn();
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(create).not.toHaveBeenCalled();
    expect(resultats.get("Titre")?.statut).toBe("FAIL");
  });

  it("soumet au modèle uniquement les propositions qui passent les contrôles déterministes", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ titre: "Titre", verdict: "PASS" }]) }],
    });
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(create).toHaveBeenCalledOnce();
    expect(resultats.get("Titre")?.statut).toBe("PASS");
  });

  it("ne lève pas d'exception si la réponse du modèle n'est pas un JSON valide", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "pas du JSON {{{" }] });
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(resultats.get("Titre")).toBeUndefined();
  });
});
```

Run: `npx vitest run src/ingestion/verify.test.ts`
Expected: FAIL — `Cannot find module './verify'`

- [ ] **Step 3 : Implémenter `verify.ts`**

Créer `src/ingestion/verify.ts` :

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import type { ClientAnthropicMinimal, RequeteGeneration } from "./generate";
import { domainesAutorises } from "./domaines";
import { verifierChiffresPresents, verifierDomaineAutorise, verifierUrlDisponible, type FetchImpl } from "./checks";
import type { PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-opus-5";

export type Verdict = { statut: "PASS" } | { statut: "FAIL"; raison: string };

async function texteDeUrl(url: string, fetchImpl: FetchImpl): Promise<string> {
  const reponse = await fetchImpl(url);
  return reponse.text();
}

export async function verifierControlesDeterministes(
  proposition: PropositionGeneree,
  domaines: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Verdict> {
  for (const source of proposition.sources) {
    if (!verifierDomaineAutorise(source.url, domaines)) {
      return { statut: "FAIL", raison: `Domaine non autorisé pour la source « ${source.label} »` };
    }
    if (!(await verifierUrlDisponible(source.url, fetchImpl))) {
      return { statut: "FAIL", raison: `URL inaccessible : ${source.url}` };
    }
  }

  const textesSources = await Promise.all(proposition.sources.map((s) => texteDeUrl(s.url, fetchImpl)));
  const texteConcatene = textesSources.join("\n");
  if (!verifierChiffresPresents(proposition.hypotheses_calcul, texteConcatene)) {
    return { statut: "FAIL", raison: "Un chiffre cité dans hypotheses_calcul n'apparaît dans aucune source" };
  }

  return { statut: "PASS" };
}

function construireRequeteVerification(meta: CandidatMeta, propositions: PropositionGeneree[]): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification.md"), "utf-8");
  const domaines = domainesAutorises(meta);
  return {
    model: MODELE,
    system: gabarit.replaceAll("{{CANDIDAT}}", meta.nom),
    tools: [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: domaines }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titre: { type: "string" },
              verdict: { type: "string", enum: ["PASS", "FAIL"] },
              raison: { type: "string" },
            },
            required: ["titre", "verdict"],
            additionalProperties: false,
          },
        },
      },
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Vérifie chacune des propositions suivantes en re-consultant leurs sources citées :\n${JSON.stringify(propositions)}`,
      },
    ],
  };
}

async function verifierSemantiquement(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  propositions: PropositionGeneree[],
): Promise<Map<string, Verdict>> {
  const requete = construireRequeteVerification(meta, propositions);
  const reponse = await client.messages.create(requete);
  const resultats = new Map<string, Verdict>();
  const blocTexte = reponse.content.find((bloc) => bloc.type === "text");
  if (!blocTexte?.text) return resultats;

  let brut: unknown;
  try {
    brut = JSON.parse(blocTexte.text);
  } catch {
    return resultats;
  }
  if (!Array.isArray(brut)) return resultats;
  for (const item of brut as Array<{ titre: string; verdict: "PASS" | "FAIL"; raison?: string }>) {
    resultats.set(
      item.titre,
      item.verdict === "PASS" ? { statut: "PASS" } : { statut: "FAIL", raison: item.raison ?? "non précisé" },
    );
  }
  return resultats;
}

export async function verifier(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  propositions: PropositionGeneree[],
  fetchImpl: FetchImpl = fetch,
): Promise<Map<string, Verdict>> {
  const domaines = domainesAutorises(meta);
  const resultats = new Map<string, Verdict>();
  const aVerifierSemantiquement: PropositionGeneree[] = [];

  for (const proposition of propositions) {
    const verdict = await verifierControlesDeterministes(proposition, domaines, fetchImpl);
    if (verdict.statut === "FAIL") {
      resultats.set(proposition.titre, verdict);
    } else {
      aVerifierSemantiquement.push(proposition);
    }
  }

  if (aVerifierSemantiquement.length > 0) {
    const verdictsSemantiques = await verifierSemantiquement(client, meta, aVerifierSemantiquement);
    for (const [titre, verdict] of verdictsSemantiques) {
      resultats.set(titre, verdict);
    }
  }

  return resultats;
}
```

- [ ] **Step 4 : Vérifier et committer**

Run: `npx vitest run src/ingestion/verify.test.ts`
Expected: PASS (7 tests)

```bash
git add src/ingestion/prompts/verification.md src/ingestion/verify.ts src/ingestion/verify.test.ts
git commit -m "feat(ingestion): passe 2 - vérification adversariale avec contrôles déterministes"
```

---

### Task 6 : Accès aux données et orchestrateur — fusion et idempotence

**Files:**
- Create: `src/ingestion/depot.ts`
- Create: `src/ingestion/run.ts`
- Test: `src/ingestion/depot.test.ts`
- Test: `src/ingestion/run.test.ts`

**Interfaces:**
- Consumes: `genererPropositions`/`ClientAnthropicMinimal`/`creerClient` (Task 4), `verifier`/`Verdict` (Task 5), `PropositionGeneree` (Task 2), `Proposition`/`CandidatMeta` de `src/types.ts`.
- Produces (depot.ts) : `cheminPropositions(slug, racine?)`, `cheminMeta(slug, racine?)`, `cheminAVerifier(slug, racine?)`, `chargerMeta(slug, racine?): CandidatMeta`, `chargerPropositions(slug, racine?): Proposition[]`, `enregistrerPropositions(slug, propositions, racine?): void`, `type EntreeAVerifier = { theme: string; proposition: PropositionGeneree; raison: string }`, `chargerAVerifier(slug, racine?): EntreeAVerifier[]`, `enregistrerAVerifier(slug, entrees, racine?): void`, `combinaisonDejaCouverte(propositions, themeId): boolean`.
- Produces (run.ts, partie 1) : `type CombinaisonACouvrir = { slug: string; themeId: string; themeLibelle: string }`, `genererIdProposition(slug, themeId, index): string`, `executerCombinaison(client, meta, combinaison, propositionsExistantes, options?: { racine?: string }): Promise<{ fusionnees: Proposition[]; enAttente: EntreeAVerifier[] }>`. `executerLot` (l'orchestrateur multi-combinaisons, qui a besoin de charger le vrai `meta.json` de chaque candidat) est ajouté en Task 8, une fois `chargerMeta` disponible dans le fil du CLI — volontairement pas ici, pour ne pas écrire un orchestrateur avec un `CandidatMeta` incomplet puis le remplacer. Ces exports sont étendus (jamais renommés) par les Tasks 7 et 8.

- [ ] **Step 1 : Écrire les tests de `depot.ts` (échouent)**

Créer `src/ingestion/depot.test.ts` :

```ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  chargerAVerifier,
  chargerPropositions,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerPropositions,
} from "./depot";
import type { Proposition } from "../types";

let racine: string;

function proposition(theme: string): Proposition {
  return {
    id: `test-${theme}-001`,
    candidat: "test",
    theme,
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
}

describe("depot", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("chargerPropositions retourne un tableau vide si le fichier n'existe pas", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
  });

  it("enregistrerPropositions puis chargerPropositions retrouve les mêmes données", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const props = [proposition("fiscalite")];
    enregistrerPropositions("candidat-x", props, racine);
    expect(chargerPropositions("candidat-x", racine)).toEqual(props);
  });

  it("combinaisonDejaCouverte détecte un thème déjà présent", () => {
    const props = [proposition("fiscalite")];
    expect(combinaisonDejaCouverte(props, "fiscalite")).toBe(true);
    expect(combinaisonDejaCouverte(props, "sante")).toBe(false);
  });

  it("enregistrerAVerifier puis chargerAVerifier retrouve les mêmes entrées", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const entrees = [{ theme: "fiscalite", proposition: proposition("fiscalite"), raison: "test" }];
    enregistrerAVerifier("candidat-x", entrees, racine);
    expect(chargerAVerifier("candidat-x", racine)).toEqual(entrees);
  });

  it("chargerAVerifier retourne un tableau vide si le fichier n'existe pas", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });
});
```

Run: `npx vitest run src/ingestion/depot.test.ts`
Expected: FAIL — `Cannot find module './depot'`

- [ ] **Step 2 : Implémenter `depot.ts`**

Créer `src/ingestion/depot.ts` :

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CandidatMeta, Proposition } from "../types";
import type { PropositionGeneree } from "./schema";

const RACINE_PAR_DEFAUT = resolve(process.cwd(), "data/programmes");

export function cheminPropositions(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "propositions.json");
}

export function cheminMeta(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "meta.json");
}

export function cheminAVerifier(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "_a-verifier.json");
}

export function chargerMeta(slug: string, racine: string = RACINE_PAR_DEFAUT): CandidatMeta {
  return JSON.parse(readFileSync(cheminMeta(slug, racine), "utf-8")) as CandidatMeta;
}

export function chargerPropositions(slug: string, racine: string = RACINE_PAR_DEFAUT): Proposition[] {
  const chemin = cheminPropositions(slug, racine);
  if (!existsSync(chemin)) return [];
  return JSON.parse(readFileSync(chemin, "utf-8")) as Proposition[];
}

export function enregistrerPropositions(slug: string, propositions: Proposition[], racine: string = RACINE_PAR_DEFAUT): void {
  const chemin = cheminPropositions(slug, racine);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(propositions, null, 2) + "\n");
}

export interface EntreeAVerifier {
  theme: string;
  proposition: PropositionGeneree;
  raison: string;
}

export function chargerAVerifier(slug: string, racine: string = RACINE_PAR_DEFAUT): EntreeAVerifier[] {
  const chemin = cheminAVerifier(slug, racine);
  if (!existsSync(chemin)) return [];
  return JSON.parse(readFileSync(chemin, "utf-8")) as EntreeAVerifier[];
}

export function enregistrerAVerifier(slug: string, entrees: EntreeAVerifier[], racine: string = RACINE_PAR_DEFAUT): void {
  const chemin = cheminAVerifier(slug, racine);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(entrees, null, 2) + "\n");
}

export function combinaisonDejaCouverte(propositions: Proposition[], themeId: string): boolean {
  return propositions.some((p) => p.theme === themeId);
}
```

Run: `npx vitest run src/ingestion/depot.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 3 : Écrire les tests de l'orchestrateur (échouent)**

Créer `src/ingestion/run.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { executerCombinaison, genererIdProposition } from "./run";
import { chargerAVerifier, chargerPropositions } from "./depot";
import type { CandidatMeta } from "../types";

let racine: string;

const META: CandidatMeta = {
  slug: "candidat-x",
  nom: "Candidat X",
  parti: "Parti X",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function preparerRacine(): void {
  racine = mkdtempSync(resolve(tmpdir(), "ingestion-run-test-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
}

describe("genererIdProposition", () => {
  it("produit un identifiant déterministe basé sur le slug, le thème et l'index", () => {
    expect(genererIdProposition("candidat-x", "fiscalite", 1)).toBe("candidat-x-fiscalite-001");
    expect(genererIdProposition("candidat-x", "fiscalite", 12)).toBe("candidat-x-fiscalite-012");
  });
});

describe("executerCombinaison", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("fusionne les propositions PASS et met les FAIL en attente", async () => {
    preparerRacine();
    const propositionGeneree = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b" },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const clientFactice = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] }),
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      [],
      { racine, fetchImpl: fetchFactice },
    );

    const propositionsEnregistrees = chargerPropositions("candidat-x", racine);
    expect(propositionsEnregistrees).toHaveLength(1);
    expect(propositionsEnregistrees[0].id).toBe("candidat-x-fiscalite-001");
    expect(propositionsEnregistrees[0].candidat).toBe("candidat-x");
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });

  it("n'enregistre rien dans propositions.json pour une proposition qui échoue la vérification", async () => {
    preparerRacine();
    const propositionGeneree = {
      titre: "Titre invalide",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://domaine-non-autorise.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const clientFactice = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] }),
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      [],
      { racine, fetchImpl: fetchFactice },
    );

    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    expect(chargerAVerifier("candidat-x", racine)).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/ingestion/run.test.ts`
Expected: FAIL — `Cannot find module './run'`

- [ ] **Step 4 : Implémenter la partie 1 de `run.ts`**

Créer `src/ingestion/run.ts` :

```ts
import type { CandidatMeta, Proposition } from "../types";
import { genererPropositions, type ClientAnthropicMinimal } from "./generate";
import { verifier } from "./verify";
import type { PropositionGeneree } from "./schema";
import type { FetchImpl } from "./checks";
import {
  chargerAVerifier,
  enregistrerAVerifier,
  enregistrerPropositions,
  type EntreeAVerifier,
} from "./depot";

export interface CombinaisonACouvrir {
  slug: string;
  themeId: string;
  themeLibelle: string;
}

export interface OptionsExecution {
  racine?: string;
  fetchImpl?: FetchImpl;
  force?: boolean;
}

export function genererIdProposition(slug: string, themeId: string, index: number): string {
  return `${slug}-${themeId}-${String(index).padStart(3, "0")}`;
}

export interface ResultatCombinaison {
  fusionnees: Proposition[];
  enAttente: EntreeAVerifier[];
}

export async function executerCombinaison(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  combinaison: CombinaisonACouvrir,
  propositionsExistantes: Proposition[],
  options: OptionsExecution = {},
): Promise<ResultatCombinaison> {
  const titresExistants = propositionsExistantes.map((p) => p.titre);
  const generees = await genererPropositions(
    client,
    meta,
    combinaison.themeId,
    combinaison.themeLibelle,
    titresExistants,
  );
  const verdicts = await verifier(client, meta, generees, options.fetchImpl);

  const fusionnees: Proposition[] = [];
  const enAttente: EntreeAVerifier[] = [];
  let indexSuivant = propositionsExistantes.length + 1;

  for (const proposition of generees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({
        ...proposition,
        id: genererIdProposition(meta.slug, combinaison.themeId, indexSuivant),
        candidat: meta.slug,
      });
      indexSuivant += 1;
    } else {
      enAttente.push({
        theme: combinaison.themeId,
        proposition,
        raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu",
      });
    }
  }

  if (fusionnees.length > 0) {
    enregistrerPropositions(meta.slug, [...propositionsExistantes, ...fusionnees], options.racine);
  }
  if (enAttente.length > 0) {
    const existantes = chargerAVerifier(meta.slug, options.racine);
    enregistrerAVerifier(meta.slug, [...existantes, ...enAttente], options.racine);
  }

  return { fusionnees, enAttente };
}
```

Le test de cette étape porte sur `executerCombinaison` et `genererIdProposition` — l'orchestrateur
multi-combinaisons (`executerLot`) arrive en Task 8, une fois `chargerMeta` branché dans le CLI.

- [ ] **Step 5 : Vérifier et committer**

Run: `npx vitest run src/ingestion/depot.test.ts src/ingestion/run.test.ts`
Expected: PASS (7 tests au total)

```bash
git add src/ingestion/depot.ts src/ingestion/depot.test.ts src/ingestion/run.ts src/ingestion/run.test.ts
git commit -m "feat(ingestion): accès aux données, fusion et idempotence de l'orchestrateur"
```

---

### Task 7 : Mode `--refresh` et échantillonnage périodique

**Files:**
- Modify: `src/ingestion/run.ts`
- Modify: `src/ingestion/run.test.ts`

**Interfaces:**
- Consumes : tout ce qui est produit par la Task 6 dans `run.ts` et `depot.ts`.
- Produces : `combinaisonsDiffere(existantes: Proposition[], fraiches: PropositionGeneree[]): boolean` ; `executerRefresh(client, meta, themeId, options?): Promise<{ divergence: boolean }>` ; `tirerEchantillon<T>(elements: T[], proportion: number, alea?: () => number): T[]`. Ces exports s'ajoutent à ceux de la Task 6 sans les renommer.

- [ ] **Step 1 : Écrire les tests (échouent)**

Ajouter à `src/ingestion/run.test.ts` (à la suite du fichier existant) :

```ts
import { combinaisonsDiffere, executerRefresh, tirerEchantillon } from "./run";

describe("combinaisonsDiffere", () => {
  it("retourne false si le contenu comparable est identique", () => {
    const existante = {
      id: "candidat-x-fiscalite-001",
      candidat: "candidat-x",
      theme: "fiscalite",
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const fraiche = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-19",
    };
    expect(combinaisonsDiffere([existante], [fraiche])).toBe(false);
  });

  it("retourne true si resume_factuel diffère", () => {
    const existante = {
      id: "candidat-x-fiscalite-001",
      candidat: "candidat-x",
      theme: "fiscalite",
      titre: "Titre",
      resume_factuel: "Ancien résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const fraiche = { ...existante, resume_factuel: "Nouveau résumé" };
    expect(combinaisonsDiffere([existante], [fraiche])).toBe(true);
  });

  it("retourne true si le nombre de propositions diffère", () => {
    expect(combinaisonsDiffere([], [{ titre: "Nouvelle", resume_factuel: "x", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-18" }])).toBe(true);
  });
});

describe("tirerEchantillon", () => {
  it("tire une proportion approximative des éléments avec un générateur déterministe", () => {
    const elements = Array.from({ length: 100 }, (_, i) => i);
    const echantillon = tirerEchantillon(elements, 0.1, () => 0.05);
    expect(echantillon.length).toBe(10);
  });

  it("retourne un tableau vide pour une liste vide", () => {
    expect(tirerEchantillon([], 0.1)).toEqual([]);
  });
});
```

Run: `npx vitest run src/ingestion/run.test.ts`
Expected: FAIL — `combinaisonsDiffere`/`executerRefresh`/`tirerEchantillon` non exportés

- [ ] **Step 2 : Implémenter le mode `--refresh` et l'échantillonnage**

Ajouter à `src/ingestion/run.ts` :

```ts
export function combinaisonsDiffere(existantes: Proposition[], fraiches: PropositionGeneree[]): boolean {
  if (existantes.length !== fraiches.length) return true;
  const normaliser = (p: { titre: string; resume_factuel: string; hypotheses_calcul: string; sources: { url: string }[] }) =>
    JSON.stringify({
      titre: p.titre,
      resume_factuel: p.resume_factuel,
      hypotheses_calcul: p.hypotheses_calcul,
      sources: p.sources.map((s) => s.url).sort(),
    });
  const existantesTriees = [...existantes].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  const fraichesTriees = [...fraiches].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  return existantesTriees.some((valeur, i) => valeur !== fraichesTriees[i]);
}

export async function executerRefresh(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  options: OptionsExecution = {},
): Promise<{ divergence: boolean }> {
  const existantes = chargerPropositions(meta.slug, options.racine).filter((p) => p.theme === themeId);
  const titresExistants = existantes.map((p) => p.titre);
  const fraiches = await genererPropositions(client, meta, themeId, themeLibelle, titresExistants);

  if (!combinaisonsDiffere(existantes, fraiches)) {
    return { divergence: false };
  }

  const entreesAVerifier = fraiches.map((proposition) => ({
    theme: themeId,
    proposition,
    raison: "refresh : divergence avec l'existant",
  }));
  const dejaEnAttente = chargerAVerifier(meta.slug, options.racine);
  enregistrerAVerifier(meta.slug, [...dejaEnAttente, ...entreesAVerifier], options.racine);
  return { divergence: true };
}

export function tirerEchantillon<T>(elements: T[], proportion: number, alea: () => number = Math.random): T[] {
  if (elements.length === 0) return [];
  const nombreATirer = Math.max(0, Math.round(elements.length * proportion));
  const copie = [...elements];
  const resultat: T[] = [];
  for (let i = 0; i < nombreATirer && copie.length > 0; i += 1) {
    const index = Math.floor(alea() * copie.length);
    resultat.push(copie.splice(index, 1)[0]);
  }
  return resultat;
}
```

- [ ] **Step 3 : Vérifier et committer**

Run: `npx vitest run src/ingestion/run.test.ts`
Expected: PASS (12 tests au total dans ce fichier)

```bash
git add src/ingestion/run.ts src/ingestion/run.test.ts
git commit -m "feat(ingestion): mode --refresh et échantillonnage périodique de re-vérification"
```

---

### Task 8 : CLI, script npm et documentation

**Files:**
- Modify: `src/ingestion/run.ts`
- Create: `src/ingestion/cli.ts`
- Test: `src/ingestion/cli.test.ts`
- Create: `src/ingestion/README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes : `executerLot`, `executerRefresh`, `tirerEchantillon`, `CombinaisonACouvrir` (Tasks 6-7) ; `chargerMeta`, `chargerPropositions` (Task 6) ; `chargerEnv`, `creerClient` (Tasks 1, 4) ; `themes.json` (`data/themes.json`, déjà existant).
- Produces : `type OptionsCLI = { candidats: string[]; themes?: string[]; refresh?: { slug: string; theme?: string }; force?: boolean }` ; `analyserArguments(argv: string[]): OptionsCLI`.

- [ ] **Step 1 : Écrire les tests de l'analyseur d'arguments (échouent)**

Créer `src/ingestion/cli.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { analyserArguments } from "./cli";

describe("analyserArguments", () => {
  it("lit une liste de candidats séparés par des virgules", () => {
    const options = analyserArguments(["--candidats=attal,glucksmann"]);
    expect(options.candidats).toEqual(["attal", "glucksmann"]);
  });

  it("lit une liste de thèmes optionnelle", () => {
    const options = analyserArguments(["--candidats=attal", "--themes=fiscalite,sante"]);
    expect(options.themes).toEqual(["fiscalite", "sante"]);
  });

  it("lit le mode --refresh avec un thème optionnel", () => {
    const options = analyserArguments(["--refresh=attal:fiscalite"]);
    expect(options.refresh).toEqual({ slug: "attal", theme: "fiscalite" });
  });

  it("lit le mode --refresh sans thème (tous les thèmes du candidat)", () => {
    const options = analyserArguments(["--refresh=attal"]);
    expect(options.refresh).toEqual({ slug: "attal", theme: undefined });
  });

  it("lit le drapeau --force", () => {
    const options = analyserArguments(["--candidats=attal", "--force"]);
    expect(options.force).toBe(true);
  });

  it("force est absent par défaut", () => {
    const options = analyserArguments(["--candidats=attal"]);
    expect(options.force).toBeUndefined();
  });
});
```

Run: `npx vitest run src/ingestion/cli.test.ts`
Expected: FAIL — `Cannot find module './cli'`

- [ ] **Step 2 : Implémenter l'analyseur d'arguments**

Créer `src/ingestion/cli.ts` :

```ts
export interface OptionsCLI {
  candidats: string[];
  themes?: string[];
  refresh?: { slug: string; theme?: string };
  force?: boolean;
}

export function analyserArguments(argv: string[]): OptionsCLI {
  const options: OptionsCLI = { candidats: [] };

  for (const argument of argv) {
    if (argument === "--force") {
      options.force = true;
    } else if (argument.startsWith("--candidats=")) {
      options.candidats = argument.slice("--candidats=".length).split(",").filter(Boolean);
    } else if (argument.startsWith("--themes=")) {
      options.themes = argument.slice("--themes=".length).split(",").filter(Boolean);
    } else if (argument.startsWith("--refresh=")) {
      const valeur = argument.slice("--refresh=".length);
      const [slug, theme] = valeur.split(":");
      options.refresh = { slug, theme: theme || undefined };
    }
  }

  return options;
}
```

Run: `npx vitest run src/ingestion/cli.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 3 : Brancher le point d'entrée CLI dans `run.ts`**

Modifier `src/ingestion/run.ts` : ajouter `executerLot`, l'orchestrateur multi-combinaisons qui
charge le vrai `meta.json` de chaque candidat via `chargerMeta` (la Task 6 ne le définit
délibérément pas, faute d'accès à `chargerMeta` dans son fil), et ajouter un point d'entrée
`main()` exécuté seulement quand le fichier est lancé directement.

`executerLot` doit isoler chaque combinaison dans un `try/catch` : une combinaison qui échoue
(réponse API malformée, erreur réseau, etc.) est journalisée et sautée, sans interrompre le
reste du lot — c'est la garantie de résilience du plan (section « Gestion des erreurs » de la
spec : « Erreur d'outil serveur ... sautée, sans interrompre le reste du lot »). Ajouter cette
fonction :

```ts
export async function executerLot(
  client: ClientAnthropicMinimal,
  combinaisons: CombinaisonACouvrir[],
  options: OptionsExecution = {},
): Promise<void> {
  for (const combinaison of combinaisons) {
    const meta = chargerMeta(combinaison.slug, options.racine);
    const propositionsExistantes = chargerPropositions(combinaison.slug, options.racine);
    if (!options.force && combinaisonDejaCouverte(propositionsExistantes, combinaison.themeId)) {
      console.log(`[sauté] ${combinaison.slug} × ${combinaison.themeId} déjà couvert`);
      continue;
    }
    console.log(`[en cours] ${combinaison.slug} × ${combinaison.themeId}`);
    try {
      const { fusionnees, enAttente } = await executerCombinaison(
        client,
        meta,
        combinaison,
        propositionsExistantes,
        options,
      );
      console.log(
        `[terminé] ${combinaison.slug} × ${combinaison.themeId} : ${fusionnees.length} fusionnée(s), ${enAttente.length} en attente`,
      );
    } catch (erreur) {
      console.error(`[erreur] ${combinaison.slug} × ${combinaison.themeId} :`, erreur);
    }
  }
}
```

Ajouter `chargerMeta` à l'import existant de `./depot` en haut du fichier (déjà partiellement
importé Task 6 — compléter la liste : `chargerAVerifier, chargerMeta, chargerPropositions,
combinaisonDejaCouverte, enregistrerAVerifier, enregistrerPropositions`).

Ajouter les imports statiques suivants en haut de `run.ts`, à la suite des imports existants :

```ts
import { chargerEnv } from "./env";
import { analyserArguments } from "./cli";
import themesData from "../../data/themes.json";

const themes = themesData as Array<{ id: string; libelle: string }>;
```

Ajouter en fin de fichier :

```ts
async function main(): Promise<void> {
  chargerEnv();
  const options = analyserArguments(process.argv.slice(2));
  const client = creerClient();

  if (options.refresh) {
    const meta = chargerMeta(options.refresh.slug);
    const themesACouvrir = options.refresh.theme
      ? themes.filter((t) => t.id === options.refresh!.theme)
      : themes;
    for (const theme of themesACouvrir) {
      const { divergence } = await executerRefresh(client, meta, theme.id, theme.libelle);
      console.log(`[refresh] ${meta.slug} × ${theme.id} : ${divergence ? "divergence détectée, voir _a-verifier.json" : "inchangé"}`);
    }
    return;
  }

  const themesACouvrir = options.themes ? themes.filter((t) => options.themes!.includes(t.id)) : themes;
  const combinaisons: CombinaisonACouvrir[] = options.candidats.flatMap((slug) =>
    themesACouvrir.map((theme) => ({ slug, themeId: theme.id, themeLibelle: theme.libelle })),
  );

  await executerLot(client, combinaisons, { force: options.force });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  });
}
```

Run: `npx vitest run src/ingestion/run.test.ts`
Expected: PASS (toujours 12 tests — `main()` n'est pas testé unitairement, seule sa condition
d'exécution en `if` empêche qu'il se déclenche pendant les tests)

- [ ] **Step 4 : Documenter le pipeline**

Créer `src/ingestion/README.md` :

```markdown
# Pipeline d'ingestion

Génère et vérifie des propositions de programme via l'API Claude, restreinte au domaine
officiel de chaque candidat. Voir `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md`
pour le design complet.

## Prérequis

1. Copier `.env.example` en `.env` et renseigner `ANTHROPIC_API_KEY`.
2. Le `meta.json` du candidat doit exister avec au moins une URL dans `sources_officielles`
   (vérifiée manuellement au préalable — jamais laissé à l'API à deviner).

## Utilisation

```bash
# Couvrir un ou plusieurs candidats sur tous les thèmes (combinaisons déjà présentes sautées)
npm run ingestion -- --candidats=attal,glucksmann

# Limiter à certains thèmes
npm run ingestion -- --candidats=attal --themes=fiscalite,sante

# Revérifier une combinaison déjà couverte (jamais d'écrasement silencieux)
npm run ingestion -- --refresh=le-pen:fiscalite

# Forcer la re-génération même si déjà couvert
npm run ingestion -- --candidats=attal --force
```

Les propositions qui échouent la vérification (contrôles déterministes ou passe sémantique)
sont écrites dans `data/programmes/<slug>/_a-verifier.json`, jamais fusionnées automatiquement.
Relire ce fichier manuellement avant toute correction ou nouvel essai.
```

- [ ] **Step 5 : Mettre à jour CLAUDE.md**

Modifier la section « État actuel du projet » de `CLAUDE.md` : remplacer la puce
« Explorer une intégration avec data.gouv.fr et/ou des scripts d'ingestion (`src/ingestion/`,
non encore développés) pour la mise à jour continue des données au fil de la campagne » par :

```markdown
- Le pipeline d'ingestion (`src/ingestion/`) est construit : génération + vérification
  adversariale via l'API Claude, restreinte au domaine officiel de chaque candidat (voir
  `docs/superpowers/specs/2026-09-18-pipeline-ingestion-api-design.md` et
  `src/ingestion/README.md`). Le lot pilote (Attal, Glucksmann, Retailleau, Ruffin, Faure) reste
  à exécuter et à valider manuellement avant d'étendre aux candidats restants.
```

- [ ] **Step 6 : Vérifier l'ensemble et committer**

Run: `npm test`
Expected: PASS (tous les tests du projet, y compris ceux ajoutés depuis la Task 1)

Run: `npx tsc -b --noEmit`
Expected: aucune erreur de typage

```bash
git add src/ingestion/run.ts src/ingestion/cli.ts src/ingestion/cli.test.ts src/ingestion/README.md CLAUDE.md
git commit -m "feat(ingestion): CLI, script npm et documentation du pipeline"
```

---

### Task 9 : Données officielles des 5 candidats du lot pilote

**Files:**
- Create: `data/programmes/attal/meta.json`
- Create: `data/programmes/glucksmann/meta.json`
- Create: `data/programmes/retailleau/meta.json`
- Create: `data/programmes/ruffin/meta.json`
- Create: `data/programmes/faure/meta.json`
- Modify: `src/data/candidats.test.ts`

**Contexte pour l'implémenteur :** ce plan ne fournit pas les URLs officielles à l'avance — les
deviner serait exactement l'erreur que ce projet s'interdit (voir `docs/methodologie.md`,
section sources primaires vs secondaires). Chaque URL doit être trouvée et vérifiée par une
recherche réelle (WebSearch/WebFetch), avec la même rigueur que les 3 candidats existants
(`data/programmes/le-pen/meta.json`, `melenchon/meta.json`, `philippe/meta.json` servent de
modèle de structure et de niveau de détail).

**Interfaces:**
- Consumes: `type CandidatMeta` de `src/types.ts`.
- Produces: cinq fichiers `meta.json` conformes à `CandidatMeta`, consommés par `src/ingestion/depot.ts` (`chargerMeta`) lors de l'exécution réelle du lot pilote (hors périmètre de ce plan, voir note finale).

- [ ] **Step 1 : Rechercher et vérifier le site officiel de chaque candidat**

Pour chacun de Gabriel Attal, Raphaël Glucksmann, Bruno Retailleau, François Ruffin et Olivier
Faure : rechercher son ou ses site(s) de campagne officiel(s) pour la présidentielle 2027 (ou, à
défaut de site dédié, le site officiel de son parti/mouvement s'il y présente son programme).
Vérifier via la page « mentions légales » / « à propos » que c'est bien une propriété officielle
du candidat ou de son parti — jamais un site tiers, même fidèle — exactement la méthode déjà
appliquée pour Le Pen (`mlafrance.fr`, `rassemblementnational.fr`), Mélenchon et Philippe.

- [ ] **Step 2 : Créer les cinq fichiers `meta.json`**

Pour chaque candidat, créer `data/programmes/<slug>/meta.json` sur le modèle exact de
`data/programmes/le-pen/meta.json` :

```json
{
  "slug": "attal",
  "nom": "Gabriel Attal",
  "parti": "Renaissance",
  "sources_officielles": [
    {
      "type": "primaire",
      "label": "<label décrivant précisément la page/le document, avec toute réserve utile>",
      "url": "<URL officielle vérifiée>"
    }
  ],
  "date_derniere_maj": "<date de la vérification, format AAAA-MM-JJ>"
}
```

(`slug` : `attal`, `glucksmann`, `retailleau`, `ruffin`, `faure` — cohérent avec les noms de
dossier ; `nom` et `parti` : valeurs réelles vérifiées lors de la recherche du Step 1.)

- [ ] **Step 3 : Mettre à jour la liste des candidats dans les tests existants**

Ouvrir `src/data/candidats.test.ts` et `src/ui/Resultats.tsx` (et son import miroir) — **ne pas**
ajouter ces 5 candidats à la liste `candidats` de `Resultats.tsx` ni au compte de propositions
codé en dur dans `candidats.test.ts` à ce stade : ces fichiers `meta.json` sont des données
d'entrée pour le pipeline, pas encore accompagnés de `propositions.json` (le pipeline les
produira lors de l'exécution réelle du lot pilote, hors périmètre de ce plan). Ajouter
uniquement, dans `src/data/candidats.test.ts`, un test qui valide la structure des 5 nouveaux
`meta.json` :

```ts
import attalMeta from "../../data/programmes/attal/meta.json";
import glucksmannMeta from "../../data/programmes/glucksmann/meta.json";
import retailleauMeta from "../../data/programmes/retailleau/meta.json";
import ruffinMeta from "../../data/programmes/ruffin/meta.json";
import faureMeta from "../../data/programmes/faure/meta.json";

describe("meta.json des candidats du lot pilote (ingestion)", () => {
  const metasPilote = [
    { slug: "attal", meta: attalMeta },
    { slug: "glucksmann", meta: glucksmannMeta },
    { slug: "retailleau", meta: retailleauMeta },
    { slug: "ruffin", meta: ruffinMeta },
    { slug: "faure", meta: faureMeta },
  ];

  it.each(metasPilote)("$slug a un slug cohérent et au moins une source primaire", ({ slug, meta }) => {
    expect(meta.slug).toBe(slug);
    expect(meta.sources_officielles.length).toBeGreaterThan(0);
    expect(meta.sources_officielles.some((s) => s.type === "primaire")).toBe(true);
  });
});
```

Run: `npm test`
Expected: PASS (tous les tests, y compris les 5 nouveaux `it.each`)

- [ ] **Step 4 : Committer**

```bash
git add data/programmes/attal/meta.json data/programmes/glucksmann/meta.json data/programmes/retailleau/meta.json data/programmes/ruffin/meta.json data/programmes/faure/meta.json src/data/candidats.test.ts
git commit -m "data(ingestion): meta.json vérifiés des 5 candidats du lot pilote"
```

---

## Après ce plan (hors périmètre, action délibérée requise)

L'exécution réelle du lot pilote (`npm run ingestion -- --candidats=attal,glucksmann,retailleau,ruffin,faure`)
dépense de l'argent réel sur une clé API facturée et n'est **pas** une tâche de ce plan — elle
doit être lancée par une décision explicite de l'utilisateur une fois le code relu et mergé, pas
comme une suite automatique de l'implémentation. Une fois lancée : vérifier
`data/programmes/*/_a-verifier.json` pour chaque candidat, relire manuellement un échantillon des
propositions fusionnées avant d'étendre aux 16 candidats restants (voir spec, section « Coût et
déploiement du lot pilote »).
