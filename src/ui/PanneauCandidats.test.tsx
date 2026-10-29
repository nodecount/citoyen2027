import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GagnantAffiche, ResultatAffiche } from "./CardCandidatIdeal";
import { PanneauCandidats } from "./PanneauCandidats";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({
  lettre,
  identite: { slug, nom, parti: "Parti-test" },
  ameliorants: 3,
  degradants: 1,
  analyses: 7,
  solde: 2,
  pour: [{ theme: "logement", groupes: ["Mesure-pour"], mesures: ["Vraie-mesure-pour"] }],
  contre: [],
});
const resultat = (titre: string, gagnants: GagnantAffiche[]): ResultatAffiche => ({
  titre,
  unite: "thèmes",
  gagnants,
  classement: gagnants.map((g, i) => ({ ...g, rang: i + 1, note: 80 - i * 20 })),
  solde: 2,
  departageable: true,
  ecartes: 0,
  tousEcartes: false,
});
const TROIS = resultat("Selon votre situation", [gagnant("A", "Nom-Un", "un"), gagnant("B", "Nom-Deux", "deux"), gagnant("C", "Nom-Trois", "trois")]);

describe("PanneauCandidats", () => {
  it("montre les trois places avec les noms réels et des lignes cliquables vers le détail", () => {
    const html = renderToStaticMarkup(<PanneauCandidats critere="situation" resultat={TROIS} />);
    expect(html.match(/<li>/g)).toHaveLength(3);
    for (const nom of ["Nom-Un", "Nom-Deux", "Nom-Trois"]) expect(html).toContain(nom);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("convictions sans résultat : dit pourquoi, selon qu'une position est choisie ou non", () => {
    expect(renderToStaticMarkup(<PanneauCandidats critere="convictions" resultat={null} positionsChoisies={false} />)).toContain("choisissez au moins une position");
    expect(renderToStaticMarkup(<PanneauCandidats critere="convictions" resultat={null} positionsChoisies={true} />)).toContain("pas encore été étudiées");
  });

  it("situation sans résultat : invite à répondre", () => {
    expect(renderToStaticMarkup(<PanneauCandidats critere="situation" resultat={null} />)).toContain("répondez d&#x27;abord");
  });
});
