import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Proposition } from "../types";
import type { CardTheme } from "./cards";
import { comptesConvictions, TableauResultat } from "./TableauResultat";

const proposition = (id: string, positions: NonNullable<Proposition["positions"]>): Proposition => ({
  id,
  candidat: "x",
  theme: "t",
  titre: id,
  resume_factuel: "",
  sources: [],
  chiffrage_disponible: false,
  hypotheses_calcul: "",
  statut: "complet",
  date_derniere_verification: "2026-10-06",
  positions,
});
const etiquette = (sujet: string, position: string) => ({ sujet, position, source_url: "https://exemple.fr", extrait: "extrait suffisamment long" });

describe("comptesConvictions", () => {
  it("compte les mesures dans le sens et à l'opposé des positions choisies, une fois chacune par sens", () => {
    const propositions = [proposition("a", [etiquette("ia", "plus_ia")]), proposition("b", [etiquette("ia", "plus_ia")]), proposition("c", [etiquette("ia", "encadrer_ia")]), proposition("d", [])];
    expect(comptesConvictions(propositions, { ia: "plus_ia" })).toEqual({ favorables: 2, defavorables: 1 });
  });
  it("sans position choisie, rien n'est compté", () => {
    expect(comptesConvictions([proposition("a", [etiquette("ia", "plus_ia")])], {})).toEqual({ favorables: 0, defavorables: 0 });
  });
});

describe("TableauResultat", () => {
  const card = {
    theme: { id: "logement", libelle: "Mon logement", question_citoyen: "", description: "", statut: "populated" },
    lignes: [
      {
        meta: { slug: "anonyme-A", nom: "Candidat A", parti: "", sources_officielles: [], date_derniere_maj: "" },
        propositions: [proposition("a", [etiquette("ia", "plus_ia")]), proposition("c", [etiquette("ia", "encadrer_ia")])],
        projection: { effetsRetenus: [{ propositionId: "a", polarite: "favorable" }] },
      },
    ],
    absents: [],
    enCoursAnalyse: false,
  } as unknown as CardTheme;

  it("sans position choisie : le tableau de la situation seul, sans onglets", () => {
    const sans = renderToStaticMarkup(<TableauResultat cards={[card]} />);
    expect(sans.match(/<table/g)).toHaveLength(1);
    expect(sans).not.toContain('role="tablist"');
    expect(sans).toContain("+1");
  });
  it("avec une position : deux onglets (situation, convictions), la situation d'abord, un seul tableau affiché à la fois", () => {
    const avec = renderToStaticMarkup(<TableauResultat cards={[card]} positions={{ ia: "plus_ia" }} />);
    expect(avec).toContain('role="tablist"');
    expect(avec.match(/role="tab"/g)).toHaveLength(2);
    expect(avec).toMatch(/id="onglet-resultat-situation"[^>]*aria-selected="true"/);
    expect(avec).toMatch(/id="onglet-resultat-convictions"[^>]*aria-selected="false"/);
    expect(avec).toContain("Selon ma situation");
    expect(avec).toContain("Selon mes convictions");
    expect(avec).toContain('role="tabpanel"');
    expect(avec.match(/<table/g)).toHaveLength(1);
  });
  it("le bandeau de révélation, quand il est fourni, est dans le bloc des tableaux", () => {
    const html = renderToStaticMarkup(<TableauResultat cards={[card]} bandeau={<p>Bandeau-test</p>} />);
    expect(html).toContain("bandeau-revelation-tableau");
    expect(html).toContain("Bandeau-test");
    expect(renderToStaticMarkup(<TableauResultat cards={[card]} bandeau={null} />)).not.toContain("bandeau-revelation-tableau");
  });
  it("survol identique à l'accueil : le tableau se remet à zéro quand la souris le quitte (même structure de classes)", () => {
    const html = renderToStaticMarkup(<TableauResultat cards={[card]} positions={{ ia: "plus_ia" }} />);
    expect(html).toContain("tableau-couverture tableau-resultat");
    expect(html).toContain("cellule-resultat");
  });
});
