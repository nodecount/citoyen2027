import { describe, expect, it } from "vitest";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { classement, combiner, ecartesParIntegrite, meilleurs, noteSur100, sansDonnees, selonPrisme, soldesConvictions, soldesSituation, type CardPourSolde, type Solde } from "./candidatIdeal";
import type { NiveauProjection } from "./projection";

const ligne = (slug: string, niveau: NiveauProjection | null, propositions: Proposition[] = []) => ({ meta: { slug }, projection: niveau === null ? null : { niveau }, propositions });
const card = (lignes: ReturnType<typeof ligne>[], absents: string[] = []): CardPourSolde => ({ theme: { id: "logement" }, lignes, absents: absents.map((slug) => ({ slug })) });
const solde = (slug: string, ameliorants: number, degradants: number, analyses = ameliorants + degradants): Solde => ({ slug, ameliorants, degradants, analyses, solde: ameliorants - degradants, totalMesures: 0, pour: [], contre: [] });

describe("soldesSituation", () => {
  const mesure = (id: string): Proposition => ({ id, candidat: "x", theme: "t", titre: `Mesure ${id}`, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01" });
  // Une ligne dont les effets retenus sont des mesures, chacune avec sa polarité (favorable ou défavorable).
  const avecMesures = (slug: string, niveau: NiveauProjection | null, effets: Array<[string, "favorable" | "defavorable"]> = []) => ({
    meta: { slug },
    projection: niveau === null ? null : { niveau, effetsRetenus: effets.map(([propositionId, polarite]) => ({ propositionId, polarite })) },
    propositions: effets.map(([id]) => mesure(id)),
  });
  it("score = mesures favorables moins mesures défavorables ; non concerné, sans indicateur et mixte sans mesure retenue comptent zéro", () => {
    const cards = [
      card([avecMesures("a", "ameliorant", [["1", "favorable"]]), avecMesures("b", "degradant", [["2", "defavorable"]])]),
      card([avecMesures("a", "ameliorant", [["3", "favorable"], ["4", "favorable"]]), avecMesures("b", "mixte", [["5", "favorable"], ["6", "defavorable"]])]),
      card([avecMesures("a", "degradant", [["7", "defavorable"]]), avecMesures("b", "non_concerne")]),
      card([avecMesures("a", null), avecMesures("b", "ameliorant", [["8", "favorable"]]), avecMesures("c", "mixte")]),
    ];
    const par = Object.fromEntries(soldesSituation(cards).map((s) => [s.slug, s]));
    expect(par.a).toMatchObject({ ameliorants: 3, degradants: 1, solde: 2, analyses: 3 });
    expect(par.b).toMatchObject({ ameliorants: 2, degradants: 2, solde: 0, analyses: 4 });
    expect(par.c).toMatchObject({ ameliorants: 0, degradants: 0, solde: 0, analyses: 1 });
  });
  it("aucune pondération : chaque mesure pèse pareil, un thème à beaucoup de mesures pèse plus qu'un thème à une seule", () => {
    const cards = [
      card([avecMesures("a", "ameliorant", [["1", "favorable"]])]),
      card([avecMesures("a", "degradant", [["2", "defavorable"], ["3", "defavorable"], ["4", "defavorable"]])]),
    ];
    expect(soldesSituation(cards)[0]).toMatchObject({ ameliorants: 1, degradants: 3, solde: -2 });
  });
  it("garde les titres des mesures des thèmes comptés ; un thème mixte figure des deux côtés, avec ses mesures de chaque sens", () => {
    const p = (id: string): Proposition => ({ id, candidat: "x", theme: "t", titre: `Titre ${id}`, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01" });
    const avecEffets = (niveau: NiveauProjection, ids: string[]) => ({ meta: { slug: "a" }, projection: { niveau, effetsRetenus: ids.map((propositionId) => ({ propositionId, polarite: niveau === "degradant" || propositionId === "2" && niveau === "mixte" ? ("defavorable" as const) : ("favorable" as const) })) }, propositions: [p("1"), p("2"), p("3")] });
    const s = soldesSituation([card([avecEffets("ameliorant", ["1"])]), card([avecEffets("degradant", ["2", "3"])]), card([avecEffets("mixte", ["1", "2"])])])[0];
    // Un bloc par thème compté, chacun avec les titres de ses mesures.
    expect(s.pour).toEqual([
      { theme: "logement", groupes: ["Titre 1"], mesures: ["Titre 1"] },
      { theme: "logement", groupes: ["Titre 1"], mesures: ["Titre 1"] },
    ]);
    expect(s.contre).toEqual([
      { theme: "logement", groupes: ["Titre 2", "Titre 3"], mesures: ["Titre 2", "Titre 3"] },
      { theme: "logement", groupes: ["Titre 2"], mesures: ["Titre 2"] },
    ]);
    // Le score compte des mesures, chacune une fois par thème : « Titre 1 » (favorable, deux fois) = 1 ; « Titre 2 » et « Titre 3 » = 2.
    expect(s).toMatchObject({ ameliorants: 1, degradants: 2, solde: -1, analyses: 3 });
  });
  it("nomme les points par les groupes du résumé (mots clés), une fois chacun, jamais par le contenu des mesures", () => {
    const p = (id: string): Proposition => ({ id, candidat: "x", theme: "t", titre: `Titre ${id}`, resume_factuel: "Contenu long", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01" });
    const resume = { segments: [{ texte: "Interdire des armes policières", mesures: ["1", "2"] }, { texte: ", ", mesures: [] }, { texte: "renforcer la formation", mesures: ["3"] }] };
    const ligneResume = { meta: { slug: "a" }, projection: { niveau: "ameliorant" as const, effetsRetenus: [{ propositionId: "1" }, { propositionId: "2" }, { propositionId: "4" }] }, propositions: [p("1"), p("2"), p("3"), p("4")], resume };
    const s = soldesSituation([card([ligneResume])])[0];
    // 1 et 2 : même groupe, nommé une fois ; 4 : absente du résumé, garde son titre ; 3 : pas retenue, absente.
    // Les mesures elles-mêmes restent disponibles (bouton « Voir les mesures »), chacune une fois, dans l'ordre du programme.
    expect(s.pour).toEqual([{ theme: "logement", groupes: ["Interdire des armes policières", "Titre 4"], mesures: ["Titre 1", "Titre 2", "Titre 4"] }]);
  });
  it("un candidat présent seulement dans les absents est listé, à zéro analyse", () => {
    const s = soldesSituation([card([ligne("a", "ameliorant")], ["z"])]);
    expect(s.find((x) => x.slug === "z")).toMatchObject({ solde: 0, analyses: 0 });
  });
});

describe("selonPrisme", () => {
  const s: Solde = {
    ...solde("a", 3, 1),
    pour: [{ theme: "t1", groupes: ["G1"], mesures: ["M1", "M2", "M3"] }, { theme: "t2", groupes: ["G2"], mesures: ["M4"] }],
    contre: [{ theme: "t1", groupes: ["G3"], mesures: ["M5"] }],
  };
  it("mesures : une fois chacune par thème ; groupes : idem ; thèmes : un point par bloc", () => {
    expect(selonPrisme(s, "mesures")).toMatchObject({ ameliorants: 4, degradants: 1, solde: 3 });
    expect(selonPrisme(s, "groupes")).toMatchObject({ ameliorants: 2, degradants: 1, solde: 1 });
    expect(selonPrisme(s, "themes")).toMatchObject({ ameliorants: 2, degradants: 1, solde: 1 });
  });
});

describe("soldesConvictions", () => {
  const prop = (positions: NonNullable<Proposition["positions"]>): Proposition => ({ id: "p", candidat: "x", theme: "t", titre: "t", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01", positions });
  const tag = (sujet: string, position: string) => ({ sujet, position, source_url: "https://exemple.fr", extrait: "extrait suffisamment long" });

  it("compte un constat par sujet choisi et par thème", () => {
    const cards = [card([ligne("a", null, [prop([tag("ia", "plus_ia")])])]), card([ligne("a", null, [prop([tag("ia", "encadrer_ia")])])])];
    const s = soldesConvictions(cards, { ia: "plus_ia", europe: "plus_europe" })[0];
    // IA : +1 puis -1 ; Europe : aucune mesure étiquetée, donc non analysé
    expect(s).toMatchObject({ ameliorants: 1, degradants: 1, solde: 0, analyses: 2 });
  });
  it("range les mesures dans le sens de la position choisie en « pour », les autres en « contre », avec sujet · thème", () => {
    const cards = [card([ligne("a", null, [{ ...prop([tag("ia", "plus_ia")]), id: "p1", titre: "Plus d'IA" }])]), card([ligne("a", null, [{ ...prop([tag("ia", "encadrer_ia")]), id: "p2", titre: "Encadrer l'IA" }])])];
    const s = soldesConvictions(cards, { ia: "plus_ia" })[0];
    expect(s.pour).toEqual([{ theme: "logement", groupes: ["Plus d'IA"], mesures: ["Plus d'IA"] }]);
    expect(s.contre).toEqual([{ theme: "logement", groupes: ["Encadrer l'IA"], mesures: ["Encadrer l'IA"] }]);
  });
  it("sans position choisie (« pas d'avis » partout) : tous à zéro analyse", () => {
    expect(soldesConvictions([card([ligne("a", null, [prop([tag("ia", "plus_ia")])])])], {}).every((x) => x.analyses === 0)).toBe(true);
  });
});
describe("meilleurs", () => {
  it("désigne le plus fort solde", () => {
    const m = meilleurs([solde("a", 2, 0), solde("b", 1, 0), solde("c", 0, 1)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
    expect(m.solde).toBe(2);
    expect(m.departageable).toBe(true);
  });
  it("égalité : tous les ex æquo, jamais départagés par l'ordre", () => {
    const m = meilleurs([solde("z", 1, 0), solde("a", 1, 0), solde("m", 0, 1)])!;
    expect(m.gagnants.map((x) => x.slug).sort()).toEqual(["a", "z"]);
    expect(m.departageable).toBe(true);
  });
  it("tous à égalité : ne permet pas de départager", () => {
    const m = meilleurs([solde("a", 1, 1), solde("b", 1, 1), solde("c", 2, 2)])!;
    expect(m.departageable).toBe(false);
  });
  it("tous les éligibles à égalité mais à un solde non nul : les ex æquo sont désignés, pas de message d'impuissance", () => {
    const m = meilleurs([solde("le-pen", 1, 0), solde("retailleau", 1, 0), solde("vide", 0, 0, 0)])!;
    expect(m.departageable).toBe(true);
    expect(m.gagnants.map((x) => x.slug).sort()).toEqual(["le-pen", "retailleau"]);
  });
  it("un seul candidat éligible : désigné", () => {
    const m = meilleurs([solde("a", 0, 2), solde("b", 0, 0, 0)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
    expect(m.departageable).toBe(true);
  });
  it("le moins mauvais est désigné quand tout est négatif", () => {
    expect(meilleurs([solde("a", 0, 3), solde("b", 0, 1)])!.gagnants[0].slug).toBe("b");
  });
  it("un candidat sans aucun indicateur ne gagne jamais par absence de données", () => {
    const m = meilleurs([solde("a", 0, 2), solde("vide", 0, 0, 0)])!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["a"]);
  });
  it("personne d'éligible : aucun gagnant, non départageable, pas d'erreur", () => {
    const m = meilleurs([solde("a", 0, 0, 0), solde("b", 0, 0, 0)])!;
    expect(m).toMatchObject({ gagnants: [], departageable: false });
  });
  it("tousEcartes : des candidats avec données existent mais tous sont écartés (et pas « aucune donnée »)", () => {
    expect(meilleurs([solde("a", 3, 0), solde("b", 1, 0)], new Set(["a", "b"]))).toMatchObject({ gagnants: [], tousEcartes: true, ecartes: 2 });
    // un candidat sans donnée n'est pas éligible : écarter le seul éligible suffit
    expect(meilleurs([solde("a", 3, 0), solde("vide", 0, 0, 0)], new Set(["a"]))!.tousEcartes).toBe(true);
  });
  it("tousEcartes est faux quand il reste un éligible, ou quand personne n'avait de données", () => {
    expect(meilleurs([solde("a", 3, 0), solde("b", 1, 0)], new Set(["a"]))!.tousEcartes).toBe(false);
    expect(meilleurs([solde("a", 0, 0, 0)])!.tousEcartes).toBe(false);
    expect(meilleurs([solde("a", 3, 0)])!.tousEcartes).toBe(false);
  });
  it("sansDonnees : rien à désigner ni à expliquer (aucun gagnant et personne d'écarté)", () => {
    expect(sansDonnees(meilleurs([solde("a", 0, 0, 0)])!)).toBe(true);
    expect(sansDonnees(meilleurs([solde("a", 3, 0)], new Set(["a"]))!)).toBe(false); // écarté : à expliquer
    expect(sansDonnees(meilleurs([solde("a", 3, 0)])!)).toBe(false);
  });
  it("liste vide : null", () => {
    expect(meilleurs([])).toBeNull();
  });
  it("les écartés sont retirés et comptés", () => {
    const m = meilleurs([solde("a", 3, 0), solde("b", 1, 0)], new Set(["a"]))!;
    expect(m.gagnants.map((x) => x.slug)).toEqual(["b"]);
    expect(m.ecartes).toBe(1);
  });
});

describe("combiner", () => {
  it("additionne les scores, les couvertures et les mesures de chaque candidat, sans pondération", () => {
    const sit = [{ ...solde("a", 2, 0), pour: [{ theme: "t1", groupes: ["g1"], mesures: ["m1"] }] }, solde("b", 1, 1)];
    const conv = [{ ...solde("a", 1, 2), contre: [{ theme: "t2", groupes: ["g2"], mesures: ["m2"] }] }, solde("b", 3, 0)];
    const [a, b] = combiner(sit, conv);
    expect(a).toMatchObject({ slug: "a", ameliorants: 3, degradants: 2, analyses: 5, solde: 1 });
    expect(a.pour).toHaveLength(1);
    expect(a.contre).toHaveLength(1);
    expect(b).toMatchObject({ slug: "b", solde: 3, analyses: 5 });
  });
  it("un candidat absent des convictions garde son score de situation", () => {
    expect(combiner([solde("a", 2, 0)], [])[0].solde).toBe(2);
  });
  it("le meilleur cumulé n'est pas forcément le meilleur d'un critère", () => {
    const sit = [solde("a", 3, 0), solde("b", 2, 0)];
    const conv = [solde("a", 0, 2), solde("b", 1, 0)];
    expect(meilleurs(combiner(sit, conv))!.gagnants.map((x) => x.slug)).toEqual(["b"]);
  });
});

describe("classement : score noté sur 100", () => {
  const avec = (slug: string, ameliorants: number, degradants: number, totalMesures: number): Solde => ({ ...solde(slug, ameliorants, degradants), totalMesures });
  it("100 = le nombre de mesures du candidat qui en a le plus ; le score est rapporté à ce nombre", () => {
    const c = classement([avec("gros", 40, 0, 200), avec("petit", 10, 0, 20), avec("moyen", 25, 5, 100)]);
    expect(Object.fromEntries(c.map((x) => [x.solde.slug, x.note]))).toEqual({ gros: 20, moyen: 10, petit: 5 });
  });
  it("jamais négatif ni au-dessus de 100 ; un score nul ou négatif vaut 0, et la référence ne dépend pas des candidats écartés", () => {
    const c = classement([avec("a", 0, 5, 50), avec("b", 3, 0, 10), avec("ecarte", 0, 0, 1000)], new Set(["ecarte"]));
    expect(Object.fromEntries(c.map((x) => [x.solde.slug, x.note]))).toEqual({ a: 0, b: 0 });
    expect(noteSur100(500, 100)).toBe(100);
    expect(noteSur100(-3, 100)).toBe(0);
    expect(noteSur100(5, 0)).toBe(100);
  });
  it("le classement suit le score brut, pas la note arrondie", () => {
    const c = classement([avec("a", 3, 0, 1000), avec("b", 2, 0, 1000)]);
    expect(c.map((x) => [x.solde.slug, x.rang, x.note])).toEqual([["a", 1, 0], ["b", 2, 0]]);
  });
});

describe("totalMesures", () => {
  it("compte les mesures distinctes du candidat dans les thèmes étudiés, une fois par thème", () => {
    const p = (id: string, titre: string): Proposition => ({ id, candidat: "x", theme: "t", titre, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01" });
    const l = (props: Proposition[]) => ({ meta: { slug: "a" }, projection: null, propositions: props });
    const cards = [card([l([p("1", "Un"), p("2", "Deux")])]), { ...card([l([p("1", "Un"), p("3", "Trois")])]), theme: { id: "sante" } }];
    // « Un » existe dans deux thèmes : compté deux fois ; « Deux » et « Trois » une fois chacun.
    expect(soldesSituation(cards)[0].totalMesures).toBe(4);
  });
});

describe("classement", () => {
  it("du meilleur au moins bon, au plus `taille` places ; rang 1, 2, 3…", () => {
    const c = classement([solde("a", 1, 0), solde("b", 3, 0), solde("c", 2, 0), solde("d", 0, 1)], new Set(), 3);
    expect(c.map((x) => [x.solde.slug, x.rang])).toEqual([["b", 1], ["c", 2], ["a", 3]]);
  });
  it("le top compte des PLACES : les ex æquo partagent la même place (sans trou ensuite) et sont tous gardés", () => {
    const c = classement([solde("a", 3, 0), solde("b", 1, 0), solde("c", 1, 0), solde("d", 1, 0), solde("e", 0, 1)], new Set(), 2);
    expect(c.map((x) => [x.solde.slug, x.rang])).toEqual([["a", 1], ["b", 2], ["c", 2], ["d", 2]]);
    const d = classement([solde("a", 3, 0), solde("b", 3, 0), solde("c", 2, 0), solde("d", 1, 0), solde("e", 0, 1)], new Set(), 3);
    expect(d.map((x) => [x.solde.slug, x.rang])).toEqual([["a", 1], ["b", 1], ["c", 2], ["d", 3]]);
  });
  it("trois places par défaut", () => {
    const c = classement([solde("a", 5, 0), solde("b", 4, 0), solde("c", 3, 0), solde("d", 2, 0), solde("e", 1, 0)]);
    expect(c.map((x) => x.solde.slug)).toEqual(["a", "b", "c"]);
  });
  it("ni les écartés, ni les candidats sans indicateur", () => {
    const c = classement([solde("a", 3, 0), solde("b", 2, 0), solde("vide", 0, 0, 0)], new Set(["a"]));
    expect(c.map((x) => x.solde.slug)).toEqual(["b"]);
  });
  it("cohérent avec `meilleurs` : le rang 1 est exactement l'ensemble des gagnants", () => {
    const soldes = [solde("a", 2, 0), solde("b", 2, 0), solde("c", 1, 0)];
    expect(classement(soldes).filter((x) => x.rang === 1).map((x) => x.solde.slug).sort()).toEqual(meilleurs(soldes)!.gagnants.map((x) => x.slug).sort());
  });
  it("aucun éligible : liste vide", () => {
    expect(classement([solde("a", 0, 0, 0)])).toEqual([]);
  });
});

describe("ecartesParIntegrite", () => {
  const src = { type: "primaire" as const, nom: "n", annee: 2026, url: "https://x.fr" };
  it("écarte les condamnations définitives recensées, pas les non vérifiés ni les « aucune recensée »", () => {
    const integrites: Record<string, ConstatIntegrite> = {
      a: { etat: "recensee", verifieLe: "2026-09-30", condamnations: [] },
      b: { etat: "non_verifie" },
      c: { etat: "aucune_recensee", verifieLe: "2026-09-30", sources: [src] },
    };
    expect([...ecartesParIntegrite(integrites)]).toEqual(["a"]);
  });
  it("sans faits d'intégrité (null) : personne n'est écarté", () => {
    expect(ecartesParIntegrite(null).size).toBe(0);
  });
});
