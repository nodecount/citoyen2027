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
