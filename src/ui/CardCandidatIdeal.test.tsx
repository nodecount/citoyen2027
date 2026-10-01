import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardCandidatIdeal, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({ lettre, identite: { slug, nom, parti: "Parti-test" }, ameliorants: 3, degradants: 1, analyses: 7 });
const resultat = (titre: string, gagnants: GagnantAffiche[], extra: Partial<ResultatAffiche> = {}): ResultatAffiche => ({ titre, unite: "thèmes", gagnants, solde: 2, departageable: true, ecartes: 0, tousEcartes: false, ...extra });
const SITUATION = resultat("Selon votre situation", [gagnant("C", "Nom-Reel-Situation", "slug-reel-a")]);
const CONVICTIONS = resultat("Selon vos convictions", [gagnant("F", "Nom-Reel-Convictions", "slug-reel-b")], { unite: "sujets" });

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
    expect(html).toContain("Votre candidat idéal selon votre situation et selon vos convictions est prêt.");
    expect(html).toContain("3 questions restent à traiter dans les thèmes : y répondre affine le résultat.");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    expect(html).not.toContain("Recommencer la simulation");
  });
  it("sans résultat convictions : le voile ne promet que la situation, et la card dit que les convictions n'ont pas (encore) de résultat", () => {
    const html = rendre({ convictions: null });
    expect(html).toContain("Votre candidat idéal selon votre situation est prêt.");
    expect(html).not.toContain("selon votre situation et selon vos convictions");
    expect(html).toContain("Selon vos convictions");
    expect(html).toContain("Pas encore de résultat");
  });
  it("une seule card : le bouton de révélation est posé sur les résultats, pas dans une seconde card", () => {
    const html = rendre();
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(html.indexOf("ideal-colonnes")).toBeLessThan(html.indexOf("ideal-voile"));
    expect(html.match(/class="ideal-voile"/g)).toHaveLength(1);
    expect(html).toContain("Selon votre situation");
    expect(html).toContain("Selon vos convictions");
  });
  it("aucune question restante : la phrase sur l'affinage disparaît ; une seule : singulier", () => {
    expect(rendre({ questionsRestantes: 0 })).not.toContain("affine");
    expect(rendre({ questionsRestantes: 1 })).toContain("Une question reste à traiter dans les thèmes");
  });
  it("égalité : la card floutée dit seulement le nombre d'ex æquo, sans nom", () => {
    const html = rendre({ convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb"), gagnant("D", "Nom-D", "sd")]) });
    expect(html).toContain("3 candidats à égalité");
    for (const secret of ["Nom-A", "Nom-B", "Nom-D", "sa", "sb"]) expect(html).not.toContain(`>${secret}<`);
    expect(html).not.toContain("Nom-");
  });
  it("un seul gagnant : pas de mention d'égalité ; non départageable : pas de nombre non plus", () => {
    expect(rendre()).not.toContain("à égalité");
    const html = rendre({ convictions: null, situation: resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb")], { departageable: false }) });
    expect(html).not.toContain("à égalité");
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
      expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>(<svg[\s\S]*?<\/svg>)?Votre candidat idéal<\/h2>/);
    }
  });
});

describe("CardCandidatIdeal révélée", () => {
  it("montre noms, partis, lettres et le solde avec sa couverture ; plus de flou ; bouton Recommencer", () => {
    const html = rendre({ revele: true });
    for (const t of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Parti-test", "Candidat C", "Candidat F", "3 en votre faveur", "1 en votre défaveur", "sur 7 thèmes étudiés", "sur 7 sujets étudiés"]) expect(html, t).toContain(t);
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
    expect(html).toContain("Égalité parfaite");
    expect(html).not.toContain("Nom-A");
  });
  it("tous les candidats avec données sont écartés : le dit, au lieu de « données insuffisantes »", () => {
    const html = rendre({ revele: true, situation: null, convictions: resultat("Selon vos convictions", [], { departageable: false, ecartes: 3, tousEcartes: true }) });
    expect(html).toContain("Tous les candidats étudiés sont écartés");
    expect(html).not.toContain("ne permettent pas de départager");
  });
  it("candidats écartés par l'intégrité : le dit, au pluriel si besoin", () => {
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 1 }) })).toContain("1 candidat écarté (condamnation définitive connue)");
    expect(rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 2 }) })).toContain("2 candidats écartés");
  });
  it("affiche la règle du score : comment il est calculé, et qu'aucun thème ne pèse plus qu'un autre", () => {
    const html = rendre({ revele: true });
    expect(html).toContain("aucun thème ne compte plus qu&#x27;un autre");
    expect(html).toContain("Comment est calculé le score");
    expect(html).not.toContain("les égalités sont toutes montrées"); // faux quand tous les candidats sont à égalité
  });
  it("ne montre pas le parti « non renseigné par la source »", () => {
    const g: GagnantAffiche = { ...gagnant("A", "Nom-A", "sa"), identite: { slug: "sa", nom: "Nom-A", parti: "non renseigné par la source" } };
    expect(rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [g]) })).not.toContain("non renseigné");
  });
});
