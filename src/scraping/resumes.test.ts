import { describe, expect, it } from "vitest";
import { controlerResume, normaliserSegments, texteComplet } from "./resumes";

describe("normaliserSegments", () => {
  it("sort la ponctuation, les espaces et le « et » initial des mots clés, sans changer le texte", () => {
    const segments = [
      { texte: "Il veut ", mesures: [] },
      { texte: "baisser l'impôt", mesures: ["a"] },
      { texte: ", et faire une année blanche. ", mesures: ["b"] },
    ];
    const normalises = normaliserSegments(segments);
    expect(normalises).toEqual([
      { texte: "Il veut ", mesures: [] },
      { texte: "baisser l'impôt", mesures: ["a"] },
      { texte: ", et ", mesures: [] },
      { texte: "faire une année blanche", mesures: ["b"] },
      { texte: ". ", mesures: [] },
    ]);
    expect(texteComplet(normalises)).toBe(texteComplet(segments));
  });

  it("ne coupe pas un mot qui commence par « et » ou « ou »", () => {
    expect(normaliserSegments([{ texte: "outre-mer", mesures: ["a"] }])).toEqual([{ texte: "outre-mer", mesures: ["a"] }]);
  });
});

describe("controlerResume", () => {
  const refs = new Map([["m1", "id-1"], ["m2", "id-2"]]);

  it("accepte un résumé où chaque mesure est couverte par un seul mot clé, et le normalise", () => {
    const r = controlerResume({ segments: [{ texte: "Faire deux choses.", mesures: ["m1", "m2"] }] }, refs);
    expect(r).toEqual({ ok: true, segments: [{ texte: "Faire deux choses", mesures: ["id-1", "id-2"] }, { texte: ".", mesures: [] }] });
  });

  it("refuse une phrase introductive ou une liaison qui fait phrase (style à l'infinitif)", () => {
    expect(controlerResume({ segments: [{ texte: "Le programme prévoit de ", mesures: [] }, { texte: "faire deux choses", mesures: ["m1", "m2"] }] }, refs).ok).toBe(false);
    const longue = [{ texte: "Faire une chose", mesures: ["m1"] }, { texte: " et il souhaite aussi pouvoir ", mesures: [] }, { texte: "faire l'autre", mesures: ["m2"] }];
    expect(controlerResume({ segments: longue }, refs).ok).toBe(false);
  });

  it("refuse une mesure oubliée, un mot clé trop long ou une référence inconnue", () => {
    expect(controlerResume({ segments: [{ texte: "une chose", mesures: ["m1"] }] }, refs).ok).toBe(false);
    expect(controlerResume({ segments: [{ texte: "un deux trois quatre cinq six sept huit neuf dix onze douze treize", mesures: ["m1", "m2"] }] }, refs).ok).toBe(false);
    expect(controlerResume({ segments: [{ texte: "x", mesures: ["m9"] }] }, refs).ok).toBe(false);
  });
});
