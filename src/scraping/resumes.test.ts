import { describe, expect, it } from "vitest";
import type { Proposition } from "../types";
import type { OutilsAppel } from "./structuration";
import { compterMots, controlerResume, longueurVisee, mesuresCiteesDansLaRaison, motsMaxMotClePour, motsMaxPour, normaliserSegments, resumerTheme, SCHEMA_RESUME, texteComplet } from "./resumes";

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

describe("mesuresCiteesDansLaRaison", () => {
  const refs = new Map([["m1", "id-1"], ["m2", "id-2"], ["m3", "id-3"]]);

  it("résout les références « mN » citées dans une raison en identifiants réels, sans doublon", () => {
    expect(mesuresCiteesDansLaRaison("m2 et encore m2 posent un problème, pas m9", refs)).toEqual(["id-2"]);
  });

  it("renvoie une liste vide quand la raison ne cite aucune référence connue", () => {
    expect(mesuresCiteesDansLaRaison("Le texte juge la mesure.", refs)).toEqual([]);
  });
});

describe("resumerTheme", () => {
  const propositions: Proposition[] = [
    { id: "id-1", candidat: "a", theme: "fiscalite", titre: "Mesure X", resume_factuel: "Mesure X", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-28" },
    { id: "id-2", candidat: "a", theme: "fiscalite", titre: "Mesure Y", resume_factuel: "Mesure Y", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-28" },
  ];
  const reponseCli = (structure: unknown) => ({ structure, coutReferenceUsd: 0.001, dureeMs: 0, jetonsEntree: 0, jetonsSortie: 0, brut: "" });

  // Décision du porteur du projet, 2026-09-28 : un résumé structurellement valide mais rejeté par la relecture (même
  // après tous les essais) est publié quand même, plutôt que de ne rien montrer — jamais le cas pour les effets.
  it("publie le dernier résumé structurellement valide quand la relecture le rejette à chaque essai, avec la raison à part", async () => {
    const outils: OutilsAppel = {
      appeler: async (_prompt, _systeme, schema) =>
        schema === SCHEMA_RESUME
          ? reponseCli({ segments: [{ texte: "Mesure X", mesures: ["m1"] }, { texte: " et ", mesures: [] }, { texte: "mesure Y.", mesures: ["m2"] }] })
          : reponseCli({ verdict: "FAIL", raison: "Le mot clé « mesure Y » (m2) déforme la mesure." }),
    };
    const resultat = await resumerTheme("Candidat A", "Fiscalité", propositions, outils);
    expect(resultat.ok).toBe(true);
    expect(resultat.segments?.map((s) => s.mesures).flat()).toEqual(expect.arrayContaining(["id-1", "id-2"]));
    expect(resultat.remarque?.texte).toContain("déforme la mesure");
    expect(resultat.remarque?.mesures).toEqual(["id-2"]);
  });

  it("ne publie rien quand aucun essai n'obtient même une structure valide (jamais de remarque sans résumé)", async () => {
    const outils: OutilsAppel = { appeler: async () => reponseCli({ segments: [] }) };
    const resultat = await resumerTheme("Candidat A", "Fiscalité", propositions, outils);
    expect(resultat.ok).toBe(false);
    expect(resultat.segments).toBeUndefined();
    expect(resultat.remarque).toBeUndefined();
  });

  it("ne publie pas de remarque quand un essai obtient un PASS complet", async () => {
    const outils: OutilsAppel = {
      appeler: async (_prompt, _systeme, schema) =>
        schema === SCHEMA_RESUME
          ? reponseCli({ segments: [{ texte: "Mesure X", mesures: ["m1"] }, { texte: " et ", mesures: [] }, { texte: "mesure Y.", mesures: ["m2"] }] })
          : reponseCli({ verdict: "PASS" }),
    };
    const resultat = await resumerTheme("Candidat A", "Fiscalité", propositions, outils);
    expect(resultat.ok).toBe(true);
    expect(resultat.remarque).toBeUndefined();
  });
});

// Décision du porteur du projet, 2026-09-28 : rester fidèle à chaque mesure en les regroupant (voir prompts/resume.md)
// peut demander plus de mots quand il y en a beaucoup ; le plafond suit donc le nombre de mesures plutôt qu'un total
// fixe qui pousserait à sacrifier la fidélité d'un mot clé pour tenir dans 60 mots.
describe("motsMaxPour", () => {
  it("vaut un plancher de 50 mots pour peu de mesures", () => {
    expect(motsMaxPour(1)).toBe(50);
    expect(motsMaxPour(25)).toBe(50);
  });

  it("suit le double du nombre de mesures au-delà du plancher", () => {
    expect(motsMaxPour(32)).toBe(64);
    expect(motsMaxPour(50)).toBe(100);
  });
});

describe("motsMaxMotClePour", () => {
  it("vaut un plancher de 8 mots pour un mot clé qui ne couvre qu'une ou deux mesures", () => {
    expect(motsMaxMotClePour(1)).toBe(8);
    expect(motsMaxMotClePour(2)).toBe(8);
  });

  it("suit le triple du nombre de mesures couvertes au-delà du plancher", () => {
    expect(motsMaxMotClePour(4)).toBe(12);
    expect(motsMaxMotClePour(5)).toBe(15);
  });

  it("controlerResume accepte, pour un mot clé qui en regroupe plusieurs, plus que l'ancien plafond fixe de 12 mots", () => {
    const refs = new Map([["m1", "id-1"], ["m2", "id-2"], ["m3", "id-3"], ["m4", "id-4"], ["m5", "id-5"]]);
    const motCle = Array.from({ length: 13 }, (_, j) => `mot${j}`).join(" "); // 13 mots : refusé sous l'ancien plafond fixe (12)
    const resultat = controlerResume({ segments: [{ texte: motCle, mesures: ["m1", "m2", "m3", "m4", "m5"] }] }, refs);
    expect(resultat.ok).toBe(true); // 13 <= motsMaxMotClePour(5) = 15
  });

  it("refuse toujours un mot clé trop long pour le nombre de mesures qu'il couvre réellement", () => {
    const refs = new Map([["m1", "id-1"], ["m2", "id-2"]]);
    const motCle = Array.from({ length: 9 }, (_, j) => `mot${j}`).join(" "); // 9 mots, pour seulement 2 mesures (plafond 8)
    const resultat = controlerResume({ segments: [{ texte: motCle, mesures: ["m1", "m2"] }] }, refs);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.raison).toContain(`mot clé trop long (plus de ${motsMaxMotClePour(2)} mots pour 2 mesure(s) couverte(s))`);
  });
});

describe("longueurVisee — cible le plafond réel au-delà de 5 mesures", () => {
  it("annonce le même plafond que motsMaxPour, jamais un chiffre fixe", () => {
    expect(longueurVisee(32)).toBe(`40 à ${motsMaxPour(32)} mots`);
  });
});

describe("controlerResume — plafond dynamique", () => {
  it("accepte, avec beaucoup de mesures, un texte plus long que l'ancien plafond fixe de 65 mots", () => {
    const n = 34;
    const refs = new Map(Array.from({ length: n }, (_, i) => [`m${i + 1}`, `id-${i + 1}`]));
    const segments: { texte: string; mesures: string[] }[] = [];
    for (let i = 1; i <= n; i += 1) {
      segments.push({ texte: "mot", mesures: [`m${i}`] });
      if (i < n) segments.push({ texte: " et ", mesures: [] });
    }
    const resultat = controlerResume({ segments }, refs);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      const mots = compterMots(texteComplet(resultat.segments));
      expect(mots).toBeGreaterThan(65); // aurait été refusé sous l'ancien plafond fixe
      expect(mots).toBeLessThanOrEqual(motsMaxPour(n));
    }
  });

  it("refuse toujours un texte trop long pour peu de mesures : le plancher de 50 reste un vrai plafond", () => {
    const n = 6;
    const refs = new Map(Array.from({ length: n }, (_, i) => [`m${i + 1}`, `id-${i + 1}`]));
    const motCle = () => Array.from({ length: 8 }, (_, j) => `mot${j}`).join(" "); // au plafond par mot clé (8, pour 1 mesure)
    const segments: { texte: string; mesures: string[] }[] = [];
    for (let i = 1; i <= n; i += 1) {
      segments.push({ texte: motCle(), mesures: [`m${i}`] });
      if (i < n) segments.push({ texte: " et ", mesures: [] });
    }
    const resultat = controlerResume({ segments }, refs);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.raison).toBe(`texte trop long : 53 mots pour ${motsMaxPour(n)} au plus`);
  });
});
