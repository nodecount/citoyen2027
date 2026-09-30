import { describe, expect, it } from "vitest";
import { GROUPES_SOCIAUX } from "../convictions";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { ecartesParIntegrite, meilleurs, soldesConvictions, soldesSituation, type CardPourSolde, type Solde } from "./candidatIdeal";
import type { NiveauProjection } from "./projection";

const ligne = (slug: string, niveau: NiveauProjection | null, propositions: Proposition[] = []) => ({ meta: { slug }, projection: niveau === null ? null : { niveau }, propositions });
const card = (lignes: ReturnType<typeof ligne>[], absents: string[] = []): CardPourSolde => ({ lignes, absents: absents.map((slug) => ({ slug })) });
const solde = (slug: string, ameliorants: number, degradants: number, analyses = ameliorants + degradants): Solde => ({ slug, ameliorants, degradants, analyses, solde: ameliorants - degradants });

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
  it("un candidat présent seulement dans les absents est listé, à zéro analyse", () => {
    const s = soldesSituation([card([ligne("a", "ameliorant")], ["z"])]);
    expect(s.find((x) => x.slug === "z")).toMatchObject({ solde: 0, analyses: 0 });
  });
});

describe("soldesConvictions", () => {
  const effet = (cibles: Effet["cibles"], sens: Effet["sens"]): Effet => ({ cibles, dimension: "revenu_disponible", sens, source_url: "https://exemple.fr", extrait: "extrait suffisamment long" });
  const prop = (effets: Effet[]): Proposition => ({ id: "p", candidat: "x", theme: "t", titre: "t", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-30", effets });
  const g = (id: string) => GROUPES_SOCIAUX.find((x) => x.id === id)!;
  const JEUNES = [{ champ: "tranche_age", valeurs: ["moins_30"] }];

  it("compte un constat par groupe et par thème", () => {
    const cards = [card([ligne("a", null, [prop([effet(JEUNES, "hausse")])])]), card([ligne("a", null, [prop([effet(JEUNES, "baisse")])])])];
    const s = soldesConvictions(cards, [g("tranche_age:moins_30"), g("statut_professionnel:retraite")])[0];
    // jeunes : +1 puis -1 ; retraités : incertain (autre champ) donc non analysé
    expect(s).toMatchObject({ ameliorants: 1, degradants: 1, solde: 0, analyses: 2 });
  });
  it("sans groupe : tous à zéro analyse", () => {
    expect(soldesConvictions([card([ligne("a", null, [prop([effet(JEUNES, "hausse")])])])], []).every((x) => x.analyses === 0)).toBe(true);
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
