import { describe, expect, it } from "vitest";
import { PARTIS_GROUPES, positionDuGroupe } from "./groupes";

describe("positionDuGroupe", () => {
  it("pour / contre selon 70 % des suffrages exprimés", () => {
    expect(positionDuGroupe({ POUR: 80, CONTRE: 5, ABSTENTION: 10 })).toBe("pour");
    expect(positionDuGroupe({ POUR: 3, CONTRE: 60, ABSTENTION: 0 })).toBe("contre");
  });
  it("partagé sous 70 % de cohésion, insuffisant sous 5 votants", () => {
    expect(positionDuGroupe({ POUR: 30, CONTRE: 20, ABSTENTION: 0 })).toBe("partage");
    expect(positionDuGroupe({ POUR: 4, CONTRE: 0, ABSTENTION: 50 })).toBe("insuffisant");
  });
  it("les abstentions ne comptent pas dans la cohésion", () => {
    expect(positionDuGroupe({ POUR: 10, CONTRE: 0, ABSTENTION: 90 })).toBe("pour");
  });
});

describe("PARTIS_GROUPES", () => {
  it("un groupe et un candidat une seule fois chacun", () => {
    expect(new Set(PARTIS_GROUPES.map((p) => p.groupe)).size).toBe(PARTIS_GROUPES.length);
    expect(new Set(PARTIS_GROUPES.map((p) => p.candidat)).size).toBe(PARTIS_GROUPES.length);
  });
});
