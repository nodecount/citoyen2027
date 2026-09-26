import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { SortieCli } from "./claude-cli";
import {
  appliquerVerdicts,
  construireRequete,
  construireRequeteVerification,
  controlerReponse,
  decouperEnGroupes,
  empreinteGroupe,
  structurerGroupe,
  type EntreeStructuration,
} from "./structuration";

const URL = "https://www.ifrap.org/comparateurs/presidentielles-2027";
const TEXTE_AIDE = "Verser une aide de 100 € par mois aux locataires de moins de 30 ans.";
const TEXTE_ETAT = "Réduire le nombre de ministères pour simplifier l'organisation de l'État.";

const ENTREES: EntreeStructuration[] = [
  { id: "x-1", texte: TEXTE_AIDE, url: URL },
  { id: "x-2", texte: TEXTE_ETAT, url: URL },
];

const EFFET_AIDE = {
  cibles: [{ champ: "logement", valeurs: ["locataire"] }, { champ: "tranche_age", valeurs: ["moins_30"] }],
  dimension: "revenu_disponible",
  sens: "hausse",
  extrait: "une aide de 100 € par mois aux locataires de moins de 30 ans",
};

function sortie(structure: unknown, cout = 0.02): SortieCli {
  return { structure, coutReferenceUsd: cout, dureeMs: 10, jetonsEntree: 100, jetonsSortie: 50, brut: "" };
}

describe("découpage et empreintes", () => {
  it("découpe en groupes de taille bornée, sans perdre ni réordonner", () => {
    expect(decouperEnGroupes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(decouperEnGroupes([], 2)).toEqual([]);
  });

  it("l'empreinte d'un groupe change avec le texte d'une proposition, pas avec un simple rechargement", () => {
    expect(empreinteGroupe(ENTREES)).toBe(empreinteGroupe(ENTREES.map((e) => ({ ...e }))));
    expect(empreinteGroupe(ENTREES)).not.toBe(empreinteGroupe([{ ...ENTREES[0], texte: `${TEXTE_AIDE} !` }, ENTREES[1]]));
    expect(empreinteGroupe(ENTREES)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("construireRequete", () => {
  it("nomme le candidat et le thème, injecte les champs du profil et liste les propositions avec leur identifiant", () => {
    const { systeme, prompt } = construireRequete("Marine Le Pen", "Finances publiques", ENTREES);
    expect(systeme).toContain("Marine Le Pen");
    expect(systeme).toContain("Finances publiques");
    expect(systeme).toContain("`tranche_revenus`");
    expect(systeme).not.toContain("{{");
    expect(prompt).toContain('"id": "x-1"');
    expect(prompt).toContain(TEXTE_AIDE);
  });

  it("ne soumet à la relecture que les propositions qui ont des effets", () => {
    const effets = new Map<string, Effet[]>([
      ["x-1", [{ ...(EFFET_AIDE as object), source_url: URL } as Effet]],
      ["x-2", []],
    ]);
    const { prompt } = construireRequeteVerification("X", "T", ENTREES, effets);
    expect(prompt).toContain("x-1");
    expect(prompt).not.toContain("x-2");
  });
});

describe("controlerReponse", () => {
  it("accepte un effet dont l'extrait est retrouvé mot pour mot dans le texte de la proposition", () => {
    const r = controlerReponse({ resultats: [{ id: "x-1", effets: [EFFET_AIDE] }, { id: "x-2", effets: [] }] }, ENTREES);
    expect(r.get("x-1")).toMatchObject({ statut: "structuree" });
    expect((r.get("x-1") as { effets: Effet[] }).effets[0]).toMatchObject({ dimension: "revenu_disponible", sens: "hausse", source_url: URL });
    expect(r.get("x-2")).toEqual({ statut: "structuree", effets: [] });
  });

  it("rejette toute la proposition quand un extrait n'est pas dans SON texte (même s'il est dans celui d'une autre)", () => {
    const r = controlerReponse({ resultats: [{ id: "x-1", effets: [{ ...EFFET_AIDE, extrait: "réduire le nombre de ministères pour simplifier" }] }, { id: "x-2", effets: [] }] }, ENTREES);
    expect(r.get("x-1")).toMatchObject({ statut: "rejetee" });
    expect((r.get("x-1") as { raison: string }).raison).toContain("n'est pas retrouvé");
  });

  it("rejette une proposition dont un effet est invalide, sans garder l'autre effet (image trompeuse)", () => {
    const invalide = { ...EFFET_AIDE, cibles: [{ champ: "logement", valeurs: ["astronaute"] }] };
    const r = controlerReponse({ resultats: [{ id: "x-1", effets: [EFFET_AIDE, invalide] }, { id: "x-2", effets: [] }] }, ENTREES);
    expect(r.get("x-1")).toMatchObject({ statut: "rejetee" });
  });

  it("rejette une proposition sans réponse et ignore les identifiants inventés", () => {
    const r = controlerReponse({ resultats: [{ id: "x-1", effets: [] }, { id: "inventé", effets: [EFFET_AIDE] }] }, ENTREES);
    expect(r.has("inventé")).toBe(false);
    expect(r.get("x-2")).toMatchObject({ statut: "rejetee", raison: expect.stringContaining("aucune réponse") });
  });

  it("rejette une réponse en double pour une même proposition", () => {
    const r = controlerReponse({ resultats: [{ id: "x-1", effets: [] }, { id: "x-1", effets: [EFFET_AIDE] }, { id: "x-2", effets: [] }] }, ENTREES);
    expect(r.get("x-1")).toMatchObject({ statut: "rejetee" });
  });

  it("échoue sur une réponse qui n'a pas la forme attendue", () => {
    expect(() => controlerReponse({ autre: 1 }, ENTREES)).toThrow("resultats");
  });
});

describe("appliquerVerdicts", () => {
  const structuree = new Map([
    ["x-1", { statut: "structuree" as const, effets: [{ ...(EFFET_AIDE as object), source_url: URL } as Effet] }],
    ["x-2", { statut: "structuree" as const, effets: [] }],
  ]);

  it("garde une proposition relue PASS, et ne relit pas celles sans effet", () => {
    const r = appliquerVerdicts(structuree, { verdicts: [{ id: "x-1", verdict: "PASS" }] });
    expect(r.get("x-1")).toMatchObject({ statut: "structuree" });
    expect(r.get("x-2")).toEqual({ statut: "structuree", effets: [] });
  });

  it("rejette une proposition FAIL avec la raison du relecteur", () => {
    const r = appliquerVerdicts(structuree, { verdicts: [{ id: "x-1", verdict: "FAIL", raison: "périmètre élargi" }] });
    expect(r.get("x-1")).toEqual({ statut: "rejetee", raison: "relecture : périmètre élargi" });
  });

  it("traite l'absence de verdict comme un échec, jamais comme un PASS", () => {
    const r = appliquerVerdicts(structuree, { verdicts: [] });
    expect(r.get("x-1")).toMatchObject({ statut: "rejetee", raison: expect.stringContaining("aucun verdict") });
  });
});

describe("structurerGroupe", () => {
  it("fait deux appels (structuration puis relecture) quand des effets sont proposés", async () => {
    const appeler = async (_p: string, _s: string, schema: object) =>
      "resultats" in (schema as { properties: object }).properties
        ? sortie({ resultats: [{ id: "x-1", effets: [EFFET_AIDE] }, { id: "x-2", effets: [] }] }, 0.03)
        : sortie({ verdicts: [{ id: "x-1", verdict: "PASS" }] }, 0.01);
    const rapport = await structurerGroupe("X", "T", ENTREES, { appeler });
    expect(rapport.appels).toBe(2);
    expect(rapport.coutReferenceUsd).toBeCloseTo(0.04);
    expect(rapport.resultats.get("x-1")).toMatchObject({ statut: "structuree" });
  });

  it("ne relit pas quand aucun effet n'est proposé (un seul appel)", async () => {
    let n = 0;
    const appeler = async () => {
      n += 1;
      return sortie({ resultats: [{ id: "x-1", effets: [] }, { id: "x-2", effets: [] }] });
    };
    const rapport = await structurerGroupe("X", "T", ENTREES, { appeler });
    expect(n).toBe(1);
    expect(rapport.appels).toBe(1);
  });

  it("ne soumet pas au modèle une proposition trop courte pour porter un extrait : elle n'a pas d'effet", async () => {
    let prompts = "";
    const appeler = async (p: string) => {
      prompts += p;
      return sortie({ resultats: [{ id: "x-2", effets: [] }] });
    };
    const rapport = await structurerGroupe("X", "T", [{ id: "x-0", texte: "Court.", url: URL }, ENTREES[1]], { appeler });
    expect(prompts).not.toContain("x-0");
    expect(rapport.resultats.get("x-0")).toEqual({ statut: "structuree", effets: [] });
  });
});
