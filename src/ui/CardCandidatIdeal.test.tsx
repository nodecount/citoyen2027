import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardCandidatIdeal, PoursContres, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({ lettre, identite: { slug, nom, parti: "Parti-test" }, ameliorants: 3, degradants: 1, analyses: 7, pour: [{ theme: "logement", groupes: ["Mesure-pour"] }], contre: [{ theme: "retraite", groupes: ["Mesure-contre"] }] });
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
    expect(html).not.toContain("Identité masquée");
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
    for (const t of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Parti-test", "Candidat C", "Candidat F", "Ce qui joue pour vous"]) expect(html, t).toContain(t);
    expect(html).not.toContain("Score +");
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
  it("candidats écartés par l'intégrité : le nombre n'est pas rappelé sous le résultat", () => {
    const html = rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 4 }) });
    expect(html).not.toContain("écartés (condamnation");
    expect(html).not.toContain("4 candidats écartés");
  });
  it("révélée, les badges « pour » précèdent les badges « contre » dans une seule liste, sens dit en mots, sans signe + ou −", () => {
    const html = rendre({ revele: true, convictions: null });
    expect(html.match(/class="ideal-badges"/g)).toHaveLength(1);
    expect(html.indexOf("ideal-badge--pour")).toBeLessThan(html.indexOf("ideal-badge--contre"));
    expect(html).not.toContain("ideal-badge-signe");
  });
  it("révélée, liste les mesures pour et contre, sens dit en mots pour les lecteurs d'écran", () => {
    const html = rendre({ revele: true });
    for (const t of ["Mesure-pour", "Mesure-contre", "Ce qui joue pour vous", "Ce qui joue contre vous", "Dans le sens de vos convictions", "À l&#x27;opposé de vos convictions"]) expect(html, t).toContain(t);
  });
  it("floutée, montre tout sauf l'identité : score et mesures pour/contre sont dans la page (floutés)", () => {
    const html = rendre({ revele: false });
    for (const t of ["Mesure-pour", "Mesure-contre", "Ce qui joue pour vous"]) expect(html, t).toContain(t);
    expect(html).not.toContain("croisements");
    expect(html).not.toContain("Score +");
  });
  it("au plus 3 badges par colonne, et un seul bouton « Voir plus » par card pour les deux colonnes", () => {
    const beaucoup = (theme: string, n: number) => [{ theme, groupes: Array.from({ length: n }, (_, i) => `Groupe-${theme}-${i}`) }];
    const g = { ...gagnant("C", "Nom-Reel-Situation", "slug-reel-a"), pour: beaucoup("logement", 5), contre: beaucoup("retraite", 4) };
    const html = rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [g]) });
    expect(html.match(/class="ideal-badge ideal-badge--/g)).toHaveLength(6);
    expect(html.match(/Voir plus/g)).toHaveLength(1);
    // 5 pour et 4 contre, 3 visibles de chaque côté : 2 + 1 badges de plus.
    expect(html).toContain("Voir plus (3 autres)");
    expect(html).not.toContain("Groupe-logement-3");
    expect(html).not.toContain("Groupe-retraite-3");
  });
  it("une fois déplié : tous les badges, le total de groupes pour et contre, et « Voir moins »", () => {
    const beaucoup = (theme: string, n: number) => [{ theme, groupes: Array.from({ length: n }, (_, i) => `Groupe-${theme}-${i}`) }];
    const html = renderToStaticMarkup(<PoursContres pour={beaucoup("logement", 5)} contre={beaucoup("retraite", 1)} unite="thèmes" deplieInitial />);
    expect(html.match(/class="ideal-badge ideal-badge--/g)).toHaveLength(6);
    expect(html).toContain("Au total : 5 groupes pour, 1 groupe contre.");
    expect(html).toContain("Voir moins");
    // Replié, le total n'est pas répété (les listes sont courtes à lire).
    expect(renderToStaticMarkup(<PoursContres pour={beaucoup("logement", 5)} contre={beaucoup("retraite", 1)} unite="thèmes" />)).not.toContain("Au total");
  });
  it("pas de bouton quand tout tient en 3 badges, ni quand la card est floutée", () => {
    expect(rendre({ revele: true })).not.toContain("Voir plus");
    const beaucoup = [{ theme: "logement", groupes: ["a", "b", "c", "d", "e"] }];
    const g = { ...gagnant("C", "N", "s"), pour: beaucoup };
    expect(rendre({ revele: false, convictions: null, situation: resultat("Selon votre situation", [g]) })).not.toContain("Voir plus");
  });
  it("devant chaque mesure : l'icône du thème, jamais son titre", () => {
    const html = rendre({ revele: true });
    expect(html).toContain("ideal-raison-icone");
    expect(html).not.toContain("Mon logement");
    expect(html).not.toContain("Ma retraite");
  });
  it("affiche la règle du score : comment il est calculé, et qu'aucun thème ne pèse plus qu'un autre", () => {
    const html = rendre({ revele: true });
    expect(html).toContain("aucun thème ni sujet ne compte plus qu&#x27;un autre");
    expect(html).toContain("Comment est calculé le score");
    expect(html).toContain("Chaque badge des deux listes est un groupe de mesures du candidat");
    expect(html).not.toContain("les égalités sont toutes montrées"); // faux quand tous les candidats sont à égalité
  });
  it("ne montre pas le parti « non renseigné par la source »", () => {
    const g: GagnantAffiche = { ...gagnant("A", "Nom-A", "sa"), identite: { slug: "sa", nom: "Nom-A", parti: "non renseigné par la source" } };
    expect(rendre({ revele: true, convictions: null, situation: resultat("Selon votre situation", [g]) })).not.toContain("non renseigné");
  });
});
