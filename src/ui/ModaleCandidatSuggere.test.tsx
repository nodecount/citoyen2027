import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { detailCriteres, type DetailCritere, type Solde } from "../engine/candidatIdeal";
import { BlocSuggestion } from "./BlocSuggestion";
import type { LigneClassement, ResultatAffiche } from "./CardCandidatIdeal";
import { ModaleCandidatSuggere } from "./ModaleCandidatSuggere";

const critere = (pourM: string[], contreM: string[], reference: number): DetailCritere => ({
  ameliorants: pourM.length,
  degradants: contreM.length,
  score: pourM.length - contreM.length,
  reference,
  noteBrute: ((pourM.length - contreM.length) / reference) * 100,
  pour: [{ theme: "logement", groupes: ["G"], mesures: pourM }],
  contre: contreM.length ? [{ theme: "retraite", groupes: ["H"], mesures: contreM }] : [],
});

const ligne = (extra: Partial<LigneClassement> = {}): LigneClassement => ({
  lettre: "A",
  identite: { slug: "s", nom: "Nom-Suggere", parti: "Parti-test" },
  ameliorants: 0,
  degradants: 0,
  analyses: 3,
  solde: 65,
  pour: [],
  contre: [],
  rang: 1,
  note: 65,
  criteres: { situation: critere(["Sit-pour-1", "Sit-pour-2"], ["Sit-contre-1"], 4), convictions: critere(["Conv-pour-1"], [], 2) },
  ...extra,
});

describe("ModaleCandidatSuggere", () => {
  it("donne les deux notes, leur moyenne et le calcul de chaque critère pour refaire la moyenne à la main", () => {
    const html = renderToStaticMarkup(<ModaleCandidatSuggere lignes={[ligne()]} onFermer={() => {}} />);
    // situation : (2 − 1) ÷ 4 = 25 ; convictions : 1 ÷ 2 = 50 ; moyenne 37,5
    expect(html).toContain("(25 + 50) ÷ 2 = <strong>37,5</strong>, soit 38 sur 100.");
    expect(html).toContain("Ma situation");
    expect(html).toContain("Mes convictions");
    expect(html).toContain("Score : 2 − 1 = <strong>1</strong>.");
    expect(html).toContain("1 ÷ 4 × 100 = <strong>25</strong>");
    expect(html).toContain("Nom-Suggere");
  });
  it("montre, pour le critère ouvert, les mesures en accord ET en désaccord, une par une", () => {
    const html = renderToStaticMarkup(<ModaleCandidatSuggere lignes={[ligne()]} onFermer={() => {}} />);
    for (const t of ["Sit-pour-1", "Sit-pour-2", "Sit-contre-1", "Favorables à votre situation", "Défavorables à votre situation"]) expect(html, t).toContain(t);
    expect(html).not.toContain("Conv-pour-1"); // dans l'onglet des convictions
  });
  it("un seul critère renseigné : sa note est reprise telle quelle, sans moyenne", () => {
    const html = renderToStaticMarkup(<ModaleCandidatSuggere lignes={[ligne({ criteres: { convictions: critere(["Conv-pour-1"], [], 2) } })]} onFermer={() => {}} />);
    expect(html).toContain("Un seul critère est renseigné");
    expect(html).not.toContain("Moyenne des deux notes");
    expect(html).not.toContain("Ma situation");
  });
  it("égalité : un onglet par candidat ; bouton Fermer en pied ; rien sans identité", () => {
    const b = ligne({ lettre: "B", identite: { slug: "t", nom: "Nom-Deux", parti: "" } });
    const html = renderToStaticMarkup(<ModaleCandidatSuggere lignes={[ligne(), b]} onFermer={() => {}} />);
    expect(html).toContain("Candidats à égalité");
    expect(html).toContain("Nom-Deux");
    expect(html).toContain('class="modale-pied"');
    expect(renderToStaticMarkup(<ModaleCandidatSuggere lignes={[ligne({ identite: null })]} onFermer={() => {}} />)).toBe("");
  });
});

describe("detailCriteres", () => {
  const solde = (slug: string, ameliorants: number, degradants: number): Solde => ({ slug, ameliorants, degradants, analyses: 1, solde: ameliorants - degradants, pour: [], contre: [] });
  it("note chaque critère avec SA référence (le plus de mesures chez un candidat), comme la moyenne du candidat suggéré", () => {
    const sit = [solde("a", 3, 1), solde("b", 8, 0)];
    const conv = [solde("a", 1, 0), solde("b", 0, 0)];
    const d = detailCriteres("a", sit, conv);
    expect(d.situation).toMatchObject({ score: 2, reference: 8, noteBrute: 25 });
    expect(d.convictions).toMatchObject({ score: 1, reference: 1, noteBrute: 100 });
  });
  it("un critère absent n'est pas renvoyé", () => {
    expect(detailCriteres("a", null, [solde("a", 1, 0)]).situation).toBeUndefined();
    expect(detailCriteres("zz", [solde("a", 1, 0)], null).situation).toBeUndefined();
  });
});

describe("BlocSuggestion : bouton du détail", () => {
  const combine = (criteres: LigneClassement["criteres"]): ResultatAffiche => {
    const l = ligne({ criteres });
    return { titre: "t", unite: "thèmes", gagnants: [l], classement: [l], solde: 65, departageable: true, ecartes: 0, tousEcartes: false };
  };
  it("révélé, avec le détail des critères : le bouton est proposé", () => {
    const html = renderToStaticMarkup(<BlocSuggestion etat="revele" pourcent={40} combine={combine(ligne().criteres)} onReveler={() => {}} onRevenir={() => {}} />);
    expect(html).toContain("Voir le détail du calcul");
  });
  it("non révélé : aucun bouton, aucun détail dans la page", () => {
    const html = renderToStaticMarkup(<BlocSuggestion etat="partiel" pourcent={40} combine={combine(ligne().criteres)} onReveler={() => {}} onRevenir={() => {}} />);
    expect(html).not.toContain("Voir le détail du calcul");
    expect(html).not.toContain("Sit-pour-1");
  });
});
