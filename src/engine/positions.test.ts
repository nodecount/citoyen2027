import { describe, expect, it } from "vitest";
import type { Proposition } from "../types";
import { projeterPosition } from "./positions";

const etiquette = (sujet: string, position: string) => ({ sujet, position, source_url: "https://exemple.fr/a", extrait: "extrait suffisamment long" });
const prop = (positions: Proposition["positions"], statut: Proposition["statut"] = "complet"): Proposition => ({ id: "p", candidat: "x", theme: "t", titre: "titre-mesure", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut, date_derniere_verification: "2026-10-01", positions });

describe("projeterPosition", () => {
  it("une mesure qui défend la position choisie : proche de la position", () => {
    const c = projeterPosition("ecologie", "garder_nucleaire", [prop([etiquette("ecologie", "garder_nucleaire")])]);
    expect(c.niveau).toBe("ameliorant");
    expect(c.retenues).toHaveLength(1);
    expect(c.retenues[0].conforme).toBe(true);
  });
  it("une mesure qui défend une autre position du même sujet : opposé", () => {
    expect(projeterPosition("ecologie", "garder_nucleaire", [prop([etiquette("ecologie", "sortir_nucleaire")])]).niveau).toBe("degradant");
  });
  it("les deux à la fois : mixte", () => {
    const c = projeterPosition("ia", "plus_ia", [prop([etiquette("ia", "plus_ia")]), prop([etiquette("ia", "encadrer_ia")])]);
    expect(c.niveau).toBe("mixte");
  });
  it("aucune mesure étiquetée sur le sujet : pas d'indicateur (ni pour, ni contre)", () => {
    expect(projeterPosition("ia", "plus_ia", [prop([etiquette("europe", "plus_europe")]), prop(undefined), prop([])]).niveau).toBeNull();
  });
  it("une mesure provisoire n'est pas comptée", () => {
    expect(projeterPosition("ia", "plus_ia", [prop([etiquette("ia", "plus_ia")], "provisoire")]).niveau).toBeNull();
  });
  it("position ou sujet inconnus : pas d'indicateur, jamais d'erreur", () => {
    expect(projeterPosition("ia", "inconnue", [prop([etiquette("ia", "plus_ia")])]).niveau).toBeNull();
    expect(projeterPosition("inconnu", "plus_ia", [prop([etiquette("ia", "plus_ia")])]).niveau).toBeNull();
  });
});
