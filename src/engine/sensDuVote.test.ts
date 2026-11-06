import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import { effetsDeLaProposition, positionsDeLaProposition } from "./sensDuVote";

const effetHausse: Effet = { cibles: [{ champ: "statut_professionnel", valeurs: ["salarie"] }], dimension: "revenu_disponible", sens: "hausse", source_url: "https://exemple.fr/a", extrait: "Extrait de source assez long." };

function proposition(surcharge: Partial<Proposition> = {}): Proposition {
  return {
    id: "x-1",
    candidat: "x",
    theme: "t",
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "partiel",
    date_derniere_verification: "2026-11-06",
    ...surcharge,
  };
}

describe("effetsDeLaProposition", () => {
  it("rend les effets tels quels sans vote ou avec un vote pour", () => {
    expect(effetsDeLaProposition(proposition({ effets: [effetHausse] }))).toEqual([effetHausse]);
    expect(effetsDeLaProposition(proposition({ effets: [effetHausse], vote: "pour" }))).toEqual([effetHausse]);
    expect(effetsDeLaProposition(proposition())).toEqual([]);
  });

  it("inverse hausse et baisse pour un vote contre, sans toucher au reste de l'effet", () => {
    const [inverse] = effetsDeLaProposition(proposition({ effets: [effetHausse], vote: "contre" }));
    expect(inverse).toEqual({ ...effetHausse, sens: "baisse" });
    const [retour] = effetsDeLaProposition(proposition({ effets: [{ ...effetHausse, sens: "baisse" }], vote: "contre" }));
    expect(retour.sens).toBe("hausse");
  });

  it("laisse un sens indéterminé indéterminé, même pour un vote contre", () => {
    const [e] = effetsDeLaProposition(proposition({ effets: [{ ...effetHausse, sens: "indetermine" }], vote: "contre" }));
    expect(e.sens).toBe("indetermine");
  });
});

describe("positionsDeLaProposition", () => {
  const etiquette = { sujet: "nucleaire", position: "", source_url: "https://exemple.fr/a", extrait: "Extrait de source assez long." };

  it("rend les positions telles quelles pour un vote pour ou sans vote", async () => {
    const { trouverSujet } = await import("../positions");
    const sujet = trouverSujet("nucleaire")!;
    const p = { ...etiquette, position: sujet.positions[0].id };
    expect(positionsDeLaProposition(proposition({ positions: [p] }))).toEqual([p]);
    expect(positionsDeLaProposition(proposition({ positions: [p], vote: "pour" }))).toEqual([p]);
  });

  it("prend l'autre position du sujet pour un vote contre", async () => {
    const { trouverSujet } = await import("../positions");
    const sujet = trouverSujet("nucleaire")!;
    expect(sujet.positions).toHaveLength(2);
    const p = { ...etiquette, position: sujet.positions[0].id };
    const [inversee] = positionsDeLaProposition(proposition({ positions: [p], vote: "contre" }));
    expect(inversee.position).toBe(sujet.positions[1].id);
    expect(inversee.sujet).toBe("nucleaire");
  });

  it("omet l'étiquette d'un sujet inconnu ou sans deux positions opposées, plutôt que d'en inventer une", () => {
    const inconnu = { ...etiquette, sujet: "sujet-inexistant", position: "a" };
    expect(positionsDeLaProposition(proposition({ positions: [inconnu], vote: "contre" }))).toEqual([]);
    const positionInconnue = { ...etiquette, position: "position-inexistante" };
    expect(positionsDeLaProposition(proposition({ positions: [positionInconnue], vote: "contre" }))).toEqual([]);
  });
});
