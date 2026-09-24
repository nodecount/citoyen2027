import { describe, expect, it } from "vitest";
import {
  DOMAINES_INSTITUTIONNELS,
  domainesAutorises,
  domainesAvecInstitutions,
  estSourceInstitutionnelle,
} from "./domaines";
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

describe("domaines institutionnels", () => {
  it("liste blanche : Assemblée nationale, Sénat, Légifrance", () => {
    expect([...DOMAINES_INSTITUTIONNELS].sort()).toEqual(
      ["assemblee-nationale.fr", "legifrance.gouv.fr", "senat.fr"].sort(),
    );
  });

  it("domainesAvecInstitutions = domaines officiels du candidat + institutionnels, sans doublon", () => {
    const domaines = domainesAvecInstitutions(metaAvec(["https://exemple-officiel.fr/a", "https://senat.fr/x"]));
    expect(domaines).toContain("exemple-officiel.fr");
    for (const d of DOMAINES_INSTITUTIONNELS) expect(domaines).toContain(d);
    expect(new Set(domaines).size).toBe(domaines.length);
  });

  it("domainesAutorises reste limité au domaine officiel : les institutions ne sont pas des sources du candidat", () => {
    expect(domainesAutorises(metaAvec(["https://exemple-officiel.fr/a"]))).toEqual(["exemple-officiel.fr"]);
  });

  it("estSourceInstitutionnelle reconnaît les sous-domaines et refuse les faux amis", () => {
    expect(estSourceInstitutionnelle("https://www.assemblee-nationale.fr/dyn/15/amendements/4709/CION_FIN/CF119")).toBe(true);
    expect(estSourceInstitutionnelle("https://www.legifrance.gouv.fr/codes/article_lc/X")).toBe(true);
    expect(estSourceInstitutionnelle("https://assemblee-nationale.fr.evil.example/x")).toBe(false);
    expect(estSourceInstitutionnelle("https://exemple-officiel.fr/programme")).toBe(false);
    expect(estSourceInstitutionnelle("pas-une-url")).toBe(false);
  });
});
