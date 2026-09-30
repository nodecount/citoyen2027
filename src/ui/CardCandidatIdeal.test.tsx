import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardCandidatIdeal, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({ lettre, identite: { slug, nom, parti: "Parti-test" }, ameliorants: 3, degradants: 1, analyses: 7 });
const resultat = (titre: string, gagnants: GagnantAffiche[], extra: Partial<ResultatAffiche> = {}): ResultatAffiche => ({ titre, unite: "thèmes", gagnants, solde: 2, departageable: true, ecartes: 0, ...extra });
const SITUATION = resultat("Selon votre situation", [gagnant("C", "Nom-Reel-Situation", "slug-reel-a")]);
const CONVICTIONS = resultat("Selon vos convictions", [gagnant("F", "Nom-Reel-Convictions", "slug-reel-b")], { unite: "constats" });

const rendre = (p: Partial<Parameters<typeof CardCandidatIdeal>[0]> = {}) =>
  renderToStaticMarkup(<CardCandidatIdeal situation={SITUATION} convictions={CONVICTIONS} questionsRestantes={3} revele={false} onReveler={() => {}} onRecommencer={() => {}} {...p} />);

describe("CardCandidatIdeal floutée", () => {
  it("ne met NI le nom, NI le slug, NI la photo réels dans la page, même si la donnée est fournie", () => {
    const html = rendre();
    for (const secret of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "slug-reel-a", "slug-reel-b", "Parti-test", "/candidats/"]) expect(html, secret).not.toContain(secret);
  });
  it("le contenu flouté est masqué aux lecteurs d'écran et annonce une identité masquée", () => {
    const html = rendre();
    expect(html).toContain("carte-ideal--floue");
    expect(html).toMatch(/class="ideal-flou"[^>]*aria-hidden="true"/);
    expect(html).toContain("Identité masquée");
  });
  it("bandeau : texte verbatim et bouton de révélation", () => {
    const html = rendre();
    expect(html).toContain("Cette card contient le meilleur programme selon votre situation et le meilleur programme selon vos convictions.");
    expect(html).toContain("Votre résultat peut être affiné si vous répondez aux 3 questions propres aux thèmes, directement dans ceux-ci.");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    expect(html).not.toContain("Recommencer la simulation");
  });
  it("sans résultat convictions : le bandeau ne parle que de la situation", () => {
    const html = rendre({ convictions: null });
    expect(html).toContain("le meilleur programme selon votre situation.");
    expect(html).not.toContain("selon vos convictions");
  });
  it("aucune question restante : la phrase sur l'affinage disparaît ; une seule : singulier", () => {
    expect(rendre({ questionsRestantes: 0 })).not.toContain("affiné");
    expect(rendre({ questionsRestantes: 1 })).toContain("à la question propre aux thèmes");
  });
  it("aucun résultat du tout : rien", () => {
    expect(rendre({ situation: null, convictions: null })).toBe("");
  });
});

describe("CardCandidatIdeal, clavier et lecteurs d'écran", () => {
  it("le résultat est annoncé (zone aria-live) et le titre peut recevoir le focus après la révélation", () => {
    for (const revele of [false, true]) {
      const html = rendre({ revele });
      expect(html).toContain('aria-live="polite"');
      expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Votre candidat idéal<\/h2>/);
    }
  });
});

describe("CardCandidatIdeal révélée", () => {
  it("montre noms, partis, lettres et le solde avec sa couverture ; plus de flou ; bouton Recommencer", () => {
    const html = rendre({ revele: true });
    for (const t of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Parti-test", "Candidat C", "Candidat F", "améliorants : 3", "dégradants : 1", "sur 7 thèmes analysés", "sur 7 constats analysés"]) expect(html, t).toContain(t);
    expect(html).not.toContain("carte-ideal--floue");
    expect(html).toContain("Recommencer la simulation");
    expect(html).not.toContain("Révéler mon programme");
  });
  it("égalité : le nombre d'ex æquo et tous les noms", () => {
    const html = rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb")]) });
    expect(html).toContain("2 candidats à égalité");
    expect(html).toContain("Nom-A");
    expect(html).toContain("Nom-B");
  });
  it("non départageable : message, et aucune liste de noms", () => {
    const html = rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa")], { departageable: false }) });
    expect(html).toContain("Les données ne permettent pas de départager les candidats.");
    expect(html).not.toContain("Nom-A");
  });
  it("candidats écartés par l'intégrité : le dit, au pluriel si besoin", () => {
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 1 }) })).toContain("1 candidat écarté : condamnation définitive recensée");
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 2 }) })).toContain("2 candidats écartés");
  });
  it("affiche la règle du solde : sans pondération, et dit qu'il compense un thème par un autre", () => {
    const html = rendre({ revele: true });
    expect(html).toContain("Aucune pondération");
    expect(html).toContain("compense un thème par un autre");
    expect(html).not.toContain("les égalités sont toutes montrées"); // faux quand tous les candidats sont à égalité
  });
  it("ne montre pas le parti « non renseigné par la source »", () => {
    const g: GagnantAffiche = { ...gagnant("A", "Nom-A", "sa"), identite: { slug: "sa", nom: "Nom-A", parti: "non renseigné par la source" } };
    expect(rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [g]) })).not.toContain("non renseigné");
  });
});
