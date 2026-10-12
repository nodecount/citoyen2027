import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import { compterCouverture, trous } from "./couverture";

const effet = (e: Partial<Effet>): Effet => ({ cibles: [], dimension: "revenu_disponible", sens: "hausse", source_url: "u", extrait: "extrait de test suffisamment long", ...e });
const prop = (id: string, effets: Effet[]): Proposition => ({ id, candidat: "x", theme: "t", titre: id, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-11", effets });

describe("couverture des effets", () => {
  const bilan = compterCouverture(
    [
      // Une hausse du SMIC : favorable au salarié, défavorable à l'employeur (deux effets d'une même mesure).
      prop("smic", [
        effet({ cibles: [{ champ: "statut_professionnel", valeurs: ["salarie"] }] }),
        effet({ cibles: [{ champ: "statut_professionnel", valeurs: ["chef_entreprise"] }], dimension: "cout_du_travail", sens: "hausse" }),
      ]),
      prop("prix", [effet({ dimension: "cout_de_la_vie", sens: "baisse" })]),
      prop("vague", [effet({ cibles: [{ champ: "statut_professionnel", valeurs: ["salarie"] }], sens: "indetermine" })]),
    ],
    "agregateurs",
  );
  const de = (champ: string, valeur: string) => bilan.parReponse.find((c) => c.champ === champ && c.valeur === valeur)!;

  it("compte, par réponse possible, les mesures favorables et défavorables qui la ciblent", () => {
    expect(de("statut_professionnel", "salarie")).toMatchObject({ favorables: 1, defavorables: 0 });
    expect(de("statut_professionnel", "chef_entreprise")).toMatchObject({ favorables: 0, defavorables: 1 });
  });
  it("les effets pour tout le monde sont comptés à part, un sens indéterminé n'est pas compté", () => {
    expect(bilan.pourTous).toEqual({ favorables: 1, defavorables: 0 });
  });
  it("liste les réponses sans mesure défavorable (ou sans favorable) ciblée", () => {
    const t = trous(bilan);
    expect(t.sansDefavorable.some((c) => c.valeur === "salarie")).toBe(true);
    expect(t.sansDefavorable.some((c) => c.valeur === "chef_entreprise")).toBe(false);
    expect(t.sansFavorable.some((c) => c.valeur === "chef_entreprise")).toBe(true);
  });
});
