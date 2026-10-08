import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase } from "../data/bases";
import { construireCards } from "../ui/cards";
import { meilleurs, soldesConvictions } from "./candidatIdeal";

// Contrôle sur les VRAIES données étiquetées (base « agregateurs ») : une conviction choisie doit faire remonter des candidats,
// et deux positions opposées d'un même sujet ne doivent pas désigner exactement les mêmes. Garde-fou contre un résultat
// « convictions » toujours vide (données non étiquetées) ou toujours identique (moteur qui ignore la position).
describe("convictions sur les données réelles", () => {
  const base = chargerBase("agregateurs");
  const cards = construireCards(base.themes, candidatsDeBase(base).avecDonnees, null);
  const gagnants = (choix: Record<string, string>) => (meilleurs(soldesConvictions(cards, choix))?.gagnants ?? []).map((g) => g.slug).sort();

  it("des mesures sont étiquetées sur les neuf sujets", () => {
    const sujets = new Set(cards.flatMap((c) => c.lignes.flatMap((l) => l.propositions.flatMap((p) => (p.positions ?? []).map((e) => e.sujet)))));
    expect(sujets.size).toBeGreaterThanOrEqual(6);
    expect(sujets.has("immigration")).toBe(true);
  });
  it("« plus de restriction » sur l'immigration désigne au moins un candidat", () => {
    expect(gagnants({ immigration: "restriction" }).length).toBeGreaterThan(0);
  });
  it("deux positions opposées ne désignent pas les mêmes candidats", () => {
    expect(gagnants({ immigration: "restriction" })).not.toEqual(gagnants({ immigration: "ouverture" }));
  });
});
