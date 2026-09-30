import { describe, expect, it } from "vitest";
import { apresChangementDeMode, cleIdentites, etatPourBase, recommencer, type EtatIdeal } from "./etatIdeal";

const REVELE: EtatIdeal = { revele: true, graine: 42 };

describe("recommencer", () => {
  it("refloute la card et tire de nouvelles lettres", () => {
    const tirages = new Set(Array.from({ length: 20 }, () => recommencer().graine));
    expect(recommencer().revele).toBe(false);
    expect(tirages.size).toBeGreaterThan(1);
  });
});

describe("changement de mode (simulateur, exploration, simulateur)", () => {
  it("quitter le simulateur puis y revenir ne garde JAMAIS la card révélée", () => {
    const enExploration = apresChangementDeMode(REVELE, "simulateur", "exploration");
    expect(enExploration.revele).toBe(false);
    const deRetour = apresChangementDeMode({ ...enExploration, revele: true }, "exploration", "simulateur");
    expect(deRetour.revele).toBe(false);
    expect(deRetour.graine).not.toBe(REVELE.graine); // de nouvelles lettres
  });
  it("rester dans le même mode ne change rien (clic sur le bouton déjà actif)", () => {
    expect(apresChangementDeMode(REVELE, "simulateur", "simulateur")).toBe(REVELE);
  });
});

describe("changement de base de connaissances", () => {
  it("même base : l'état est conservé", () => {
    expect(etatPourBase(REVELE, "officielle", "officielle")).toBe(REVELE);
  });
  it("autre base pendant l'état révélé : card refloutée, nouvelles lettres (le gagnant de l'autre base n'est pas révélé d'office)", () => {
    const apres = etatPourBase(REVELE, "officielle", "agregateurs");
    expect(apres.revele).toBe(false);
    expect(apres.graine).not.toBe(REVELE.graine);
  });
});

describe("cleIdentites : clé qui referme les détails ouverts quand les lettres changent de sens", () => {
  it("à l'aveugle, une nouvelle graine donne une autre clé : un candidat ouvert (Candidat C) est refermé", () => {
    expect(cleIdentites(true, 1)).not.toBe(cleIdentites(true, 2));
  });
  it("même graine : même clé, rien n'est refermé sans raison", () => {
    expect(cleIdentites(true, 1)).toBe(cleIdentites(true, 1));
  });
  it("identités visibles (exploration) : clé stable, la graine n'a pas d'effet", () => {
    expect(cleIdentites(false, 1)).toBe(cleIdentites(false, 2));
  });
  it("passer de l'aveugle aux identités visibles change la clé", () => {
    expect(cleIdentites(true, 1)).not.toBe(cleIdentites(false, 1));
  });
});
