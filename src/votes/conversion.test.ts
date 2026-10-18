import { describe, expect, it } from "vitest";
import { convertir, dateEnClair, numeroScrutin, tronquer, type ArticleVote } from "./conversion";

const entree: ArticleVote = {
  loi: { dossier: "DLR5L17N50169", theme: "securite-justice", intitule: "proposition de loi visant à sortir la France du piège du narcotrafic" },
  scrutin: { id: "VTANR5L17V1194", date: "2025-03-30T22:00:00+00:00", pour: 400, contre: 80, abstention: 10 },
  article: "2",
  texteArticle: "I. – Il est créé un parquet national.",
  urlTexte: "https://www.assemblee-nationale.fr/dyn/17/textes/l17t0083_texte-adopte-seance",
  numeroTexte: "T.A. n° 83",
  decomptes: {
    RN: { POUR: 100, CONTRE: 0, ABSTENTION: 3 },
    "LFI-NFP": { POUR: 0, CONTRE: 60, ABSTENTION: 0 },
    EPR: { POUR: 40, CONTRE: 30, ABSTENTION: 0 },
    DEM: { POUR: 30, CONTRE: 0, ABSTENTION: 0 },
  },
};

describe("convertir", () => {
  const { parCandidat, rapport } = convertir([entree], "2026-10-18");
  it("ne crée une mesure que pour un groupe rattaché dont la position est nettement « pour »", () => {
    expect([...parCandidat.keys()]).toEqual(["le-pen"]);
    const p = parCandidat.get("le-pen")![0];
    expect(p.id).toBe("le-pen-securite-justice-v1194");
    expect(p.titre).toContain("Le groupe RN (Rassemblement National) a voté pour l'article 2");
    expect(p.titre).toContain("31 mars 2025");
    expect(p.resume_factuel).toBe(entree.texteArticle);
    expect(p.sources.map((s) => s.type)).toEqual(["primaire", "primaire"]);
    expect(p.hypotheses_calcul).toContain("n'est pas un engagement de programme");
  });
  it("compte les positions et les groupes non rattachés", () => {
    expect(rapport.parGroupe.RN.pour).toBe(1);
    expect(rapport.parGroupe["LFI-NFP"].contre).toBe(1);
    expect(rapport.parGroupe.EPR.partage).toBe(1);
    expect(rapport.groupesNonRattaches).toEqual({ DEM: 1 });
    expect(rapport.mesures).toBe(1);
  });
});

describe("outils", () => {
  it("numeroScrutin, dateEnClair, tronquer", () => {
    expect(numeroScrutin("VTANR5L17V217")).toBe("217");
    expect(dateEnClair("2024-10-30T23:00:00+00:00")).toBe("31 octobre 2024");
    expect(dateEnClair("2025-02-28T23:00:00+00:00")).toBe("1er mars 2025");
    expect(tronquer("court").tronque).toBe(false);
    const long = ("Une phrase assez longue pour remplir. ").repeat(100);
    const t = tronquer(long, 500);
    expect(t.tronque).toBe(true);
    expect(t.texte.length).toBeLessThanOrEqual(500);
  });
});
