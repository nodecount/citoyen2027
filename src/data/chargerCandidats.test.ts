import { describe, it, expect } from "vitest";
import { assemblerCandidats } from "./chargerCandidats";
import type { CandidatMeta, Proposition } from "../types";

function meta(slug: string, nom: string): CandidatMeta {
  return { slug, nom, parti: "X", sources_officielles: [], date_derniere_maj: "2026-09-18" };
}

function prop(id: string, statut: Proposition["statut"]): Proposition {
  return {
    id,
    candidat: "x",
    theme: "fiscalite",
    titre: id,
    resume_factuel: "",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut,
    date_derniere_verification: "2026-09-18",
  };
}

describe("assemblerCandidats", () => {
  it("trie les candidats par ordre alphabétique de slug, quel que soit l'ordre d'entrée", () => {
    const { avecDonnees } = assemblerCandidats(
      { melenchon: meta("melenchon", "M"), attal: meta("attal", "A"), "le-pen": meta("le-pen", "L") },
      {
        melenchon: [prop("m1", "complet")],
        attal: [prop("a1", "complet")],
        "le-pen": [prop("l1", "partiel")],
      }
    );
    expect(avecDonnees.map((c) => c.meta.slug)).toEqual(["attal", "le-pen", "melenchon"]);
  });

  it("place à part un candidat sans propositions.json, sans l'omettre silencieusement", () => {
    const { avecDonnees, enCoursAnalyse } = assemblerCandidats(
      { attal: meta("attal", "A"), philippe: meta("philippe", "P") },
      { philippe: [prop("p1", "complet")] }
    );
    expect(avecDonnees.map((c) => c.meta.slug)).toEqual(["philippe"]);
    expect(enCoursAnalyse.map((m) => m.slug)).toEqual(["attal"]);
  });

  it("traite un candidat dont toutes les propositions sont provisoires comme en cours d'analyse", () => {
    const { avecDonnees, enCoursAnalyse } = assemblerCandidats(
      { attal: meta("attal", "A") },
      { attal: [prop("a1", "provisoire")] }
    );
    expect(avecDonnees).toEqual([]);
    expect(enCoursAnalyse.map((m) => m.slug)).toEqual(["attal"]);
  });

  it("ignore un propositions.json sans meta.json correspondant", () => {
    const { avecDonnees, enCoursAnalyse } = assemblerCandidats({}, { orphelin: [prop("o1", "complet")] });
    expect(avecDonnees).toEqual([]);
    expect(enCoursAnalyse).toEqual([]);
  });
});
