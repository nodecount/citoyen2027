import { describe, expect, it } from "vitest";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { ecartesParIntegrite, meilleurs, sansDonnees, soldesConvictions, soldesSituation, type CardPourSolde, type Solde } from "./candidatIdeal";
import type { NiveauProjection } from "./projection";

const ligne = (slug: string, niveau: NiveauProjection | null, propositions: Proposition[] = []) => ({ meta: { slug }, projection: niveau === null ? null : { niveau }, propositions });
const card = (lignes: ReturnType<typeof ligne>[], absents: string[] = []): CardPourSolde => ({ theme: { id: "logement" }, lignes, absents: absents.map((slug) => ({ slug })) });
const solde = (slug: string, ameliorants: number, degradants: number, analyses = ameliorants + degradants): Solde => ({ slug, ameliorants, degradants, analyses, solde: ameliorants - degradants, pour: [], contre: [] });

describe("soldesSituation", () => {
  it("améliorants moins dégradants ; mixte, non concerné et sans indicateur comptent zéro", () => {
    const cards = [
      card([ligne("a", "ameliorant"), ligne("b", "degradant")]),
      card([ligne("a", "ameliorant"), ligne("b", "mixte")]),
      card([ligne("a", "degradant"), ligne("b", "non_concerne")]),
      card([ligne("a", null), ligne("b", "ameliorant")]),
    ];
    const par = Object.fromEntries(soldesSituation(cards).map((s) => [s.slug, s]));
    expect(par.a).toMatchObject({ ameliorants: 2, degradants: 1, solde: 1, analyses: 3 });
    expect(par.b).toMatchObject({ ameliorants: 1, degradants: 1, solde: 0, analyses: 4 });
  });
  it("aucune pondération : chaque thème pèse pareil", () => {
    const cards = [card([ligne("a", "ameliorant")]), card([ligne("a", "degradant")]), card([ligne("a", "degradant")])];
    expect(soldesSituation(cards)[0].solde).toBe(-1);
  });
  it("garde les titres des mesures des thèmes comptés ; un thème mixte n'en apporte aucune", () => {
    const p = (id: string): Proposition => ({ id, candidat: "x", theme: "t", titre: `Titre ${id}`, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-10-01" });
    const avecEffets = (niveau: NiveauProjection, ids: string[]) => ({ meta: { slug: "a" }, projection: { niveau, effetsRetenus: ids.map((propositionId) => ({ propositionId })) }, propositions: [p("1"), p("2"), p("3")] });
    const s = soldesSituation([card([avecEffets("ameliorant", ["1"])]), card([avecEffets("degradant", ["2", "3"])]), card([avecEffets("mixte", ["1", "2"])])])[0];
    // Un point par thème compté : autant de blocs que le score en compte, chacun avec les titres de ses mesures.
    expect(s.pour).toEqual([{ theme: "logement", groupes: ["Titre 1"], mesures: ["Titre 1"] }]);
    expect(s.contre).toEqual([{ theme: "logement", groupes: ["Titre 2", "Titre 3"], mesures: ["Titre 2", "Titre 3"] }]);
    expect([s.pour.length, s.contre.length]).toEqual([s.ameliorants, s.degradants]);
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
