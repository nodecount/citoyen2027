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
