import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GagnantAffiche, ResultatAffiche } from "./CardCandidatIdeal";
import { BlocSuggestion } from "./BlocSuggestion";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({
  lettre,
  identite: { slug, nom, parti: "Parti-test" },
  ameliorants: 3,
  degradants: 1,
  analyses: 7,
  solde: 2,
  pour: [],
  contre: [],
});
const combine = (gagnants: GagnantAffiche[], extra: Partial<ResultatAffiche> = {}): ResultatAffiche => ({
  titre: "Selon votre situation et vos convictions",
  unite: "thèmes",
  gagnants,
  classement: [],
  solde: 2,
  departageable: true,
  ecartes: 0,
  tousEcartes: false,
  ...extra,
});
const UN = combine([gagnant("C", "Nom-Reel-Centre", "slug-reel-c")]);

const rendre = (p: Partial<Parameters<typeof BlocSuggestion>[0]> = {}) =>
  renderToStaticMarkup(<BlocSuggestion etat="partiel" pourcent={17} source="situation" combine={UN} onReveler={() => {}} onRevenir={() => {}} {...p} />);

describe("BlocSuggestion", () => {
  it("vide : titre fixe, nom fictif flouté, 0 %, bouton « Révéler » inactif", () => {
    const html = rendre({ etat: "vide", pourcent: 0, source: null, combine: null });
    expect(html).toContain("Mon candidat idéal");
    expect(html).toContain("XXXXXX YYYYYY");
    expect(html).toContain("0 %");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
    expect(html).toContain("Répondez à une question");
  });

  it("partiel : bouton actif, précision et source annoncées", () => {
    const html = rendre();
    expect(html).toContain("17 %");
    expect(html).toContain("Calculé sur votre situation seule");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
  });

  it("partiel : AUCUNE identité réelle n'est dans la page, même si le résultat en porte", () => {
    const html = rendre();
    for (const secret of ["Nom-Reel-Centre", "slug-reel-c", "Parti-test", "/candidats/"]) expect(html, secret).not.toContain(secret);
  });

  it("partiel avec des ex æquo : seul leur nombre est dit", () => {
    const html = rendre({ combine: combine([gagnant("A", "Nom-Reel-A", "slug-a"), gagnant("B", "Nom-Reel-B", "slug-b")]) });
    expect(html).toContain("2 candidats à égalité");
    expect(html).not.toContain("Nom-Reel-A");
  });

  it("révélé : nom et parti, bouton fantôme « Revenir aux questions » avec la précision, plus de % dans le disque", () => {
    const html = rendre({ etat: "revele", pourcent: 85 });
    expect(html).toContain("Nom-Reel-Centre");
    expect(html).toContain("Revenir aux questions");
    expect(html).toContain("Révélé · précision 85 %");
    expect(html).not.toContain("XXXXXX YYYYYY");
    expect(html.slice(html.indexOf('class="anneau-disque"'), html.indexOf("</div>", html.indexOf('class="anneau-disque"')))).not.toContain("%");
  });

  it("égalité parfaite ou tous écartés : le dit, sans inventer de nom", () => {
    expect(rendre({ combine: combine([], { departageable: false }) })).toContain("aucun candidat ne se détache");
    expect(rendre({ combine: combine([], { tousEcartes: true }) })).toContain("Tous les candidats étudiés sont écartés");
  });
});
