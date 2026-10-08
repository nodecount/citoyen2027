import { describe, expect, it } from "vitest";
import basesJson from "../data/bases/bases.json";
import { champsCibles, validerEffet, type Effet } from "./effets";
import { champsDeBase, champsToutesBases, valeursParChamp } from "./schemaBase";

const pertinences = import.meta.glob("../data/bases/*/questionnaire.json", { eager: true }) as Record<string, { default: { pertinence: Record<string, string[]> } }>;
const idsBases = (basesJson as Array<{ id: string }>).map((b) => b.id);

function pertinenceDe(base: string): string[] {
  const entree = Object.entries(pertinences).find(([chemin]) => chemin.includes(`/bases/${base}/`));
  return Object.keys(entree![1].default.pertinence);
}

const effet = (champ: string, valeur: string): Effet => ({
  cibles: [{ champ, valeurs: [valeur] }],
  dimension: "revenu_disponible",
  sens: "hausse",
  source_url: "https://exemple.fr/a",
  extrait: "Extrait de source suffisamment long.",
});

describe("un formulaire par base (décision du 2026-10-04)", () => {
  it("chaque base déclarée a son formulaire", () => {
    for (const id of idsBases) expect(champsDeBase(id).length, id).toBeGreaterThan(0);
  });

  it("une question existe dans une base si et seulement si le questionnaire de CETTE base la range dans des thèmes", () => {
    for (const id of idsBases) {
      expect(champsDeBase(id).map((c) => c.id).sort(), id).toEqual(pertinenceDe(id).sort());
    }
  });

  it("une question conditionnelle a son parent dans la même base", () => {
    for (const id of idsBases) {
      const ids = new Set(champsDeBase(id).map((c) => c.id).concat("enfants_a_charge"));
      for (const q of champsDeBase(id)) if (q.afficher_si) expect(ids.has(q.afficher_si.champ), `${id} : ${q.id}`).toBe(true);
    }
  });

  it("les questions et options tirées des mesures d'une seule source ne sont posées que dans sa base", () => {
    const officielle = champsDeBase("officielle");
    const agregateurs = champsDeBase("agregateurs");
    const ids = (c: typeof officielle) => c.map((q) => q.id);
    expect(ids(officielle)).toContain("parent_isole");
    expect(ids(agregateurs)).not.toContain("parent_isole");
    expect(ids(agregateurs)).toContain("montant_pension");
    expect(ids(officielle)).not.toContain("montant_pension");
    expect(officielle.find((q) => q.id === "situation_familiale")!.options).toContain("veuf_veuve");
    expect(agregateurs.find((q) => q.id === "situation_familiale")!.options).not.toContain("veuf_veuve");
    expect(agregateurs.find((q) => q.id === "aides_percues")!.options).toContain("aspa");
    expect(officielle.find((q) => q.id === "aides_percues")!.options).not.toContain("aspa");
  });

  it("les critères ciblables suivent la base : un effet ne peut viser que ce que sa base sait demander", () => {
    expect(champsCibles("officielle")).toContain("parent_isole");
    expect(champsCibles("agregateurs")).not.toContain("parent_isole");
    expect(validerEffet(effet("parent_isole", "oui"), ["https://exemple.fr/a"], "officielle")).toBe(true);
    expect(validerEffet(effet("parent_isole", "oui"), ["https://exemple.fr/a"], "agregateurs")).toBe(false);
    expect(validerEffet(effet("situation_familiale", "veuf_veuve"), ["https://exemple.fr/a"], "agregateurs")).toBe(false);
    expect(validerEffet(effet("situation_familiale", "veuf_veuve"), ["https://exemple.fr/a"], "officielle")).toBe(true);
  });

  it("l'union (réponses gardées dans le navigateur) réunit les options des bases, sans rien ajouter à une base", () => {
    const situation = champsToutesBases().find((q) => q.id === "situation_familiale")!;
    expect(situation.options).toContain("veuf_veuve");
    expect(valeursParChamp("agregateurs").situation_familiale).not.toContain("veuf_veuve");
  });

  it("une base inconnue est refusée plutôt que devinée", () => {
    expect(() => champsDeBase("inconnue")).toThrow();
  });
});
