import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import { sujetsDisponibles } from "../engine/positions";
import { compterAvancement } from "./compteurs";
import { CONVICTIONS_VIDES } from "./memoireConvictions";

describe("compterAvancement", () => {
  const base = chargerBase("agregateurs");

  it("compte les questions visibles et celles qui ont une réponse", () => {
    const vide = compterAvancement(base.questionnaire, {}, CONVICTIONS_VIDES, null);
    expect(vide.repondues).toBe(0);
    expect(vide.questions).toBeGreaterThan(0);
    expect(compterAvancement(base.questionnaire, { tranche_age: "30_49" }, CONVICTIONS_VIDES, null).repondues).toBe(1);
  });

  it("compte les convictions renseignées parmi les sujets proposés", () => {
    const avec = compterAvancement(base.questionnaire, {}, { positions: { ia: "plus_ia" }, exemplarite: false }, null);
    expect(avec.convictions).toBe(1);
    expect(avec.sujets).toBe(sujetsDisponibles(null).length);
  });
});
