import { describe, expect, it } from "vitest";
import { bordAffichable, partiAffichable } from "./parti";

describe("bordAffichable", () => {
  it("donne le bord d'un candidat dont le parti est affiché", () => {
    expect(bordAffichable("le-pen", "Rassemblement National")).toBe("Extrême droite");
    expect(bordAffichable("tondelier", "Les Écologistes")).toBe("Écologie");
    expect(bordAffichable("dupont-aignan", "Debout la France")).toBe("Souverainiste");
  });

  it("n'affiche rien quand le parti est masqué (mode aveugle) ou inconnu", () => {
    expect(bordAffichable("le-pen", "")).toBeNull();
    expect(bordAffichable("roussel", "non renseigné par la source")).toBeNull();
  });

  it("n'affiche rien pour un candidat sans bord renseigné", () => {
    expect(bordAffichable("inconnu", "Un parti")).toBeNull();
    expect(partiAffichable("Un parti")).toBe("Un parti");
  });
});
