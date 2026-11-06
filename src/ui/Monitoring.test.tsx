import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase, listerBases } from "../data/bases";
import Monitoring from "./Monitoring";
import { indicateursBase } from "./monitoring/indicateurs";

describe("Monitoring : chiffres d'ensemble", () => {
  it.each(listerBases().map((b) => b.id))("base « %s » : affiche candidats, thèmes et mesures comptés dans les données", (id) => {
    const base = chargerBase(id);
    const k = indicateursBase(base);
    const html = renderToStaticMarkup(<Monitoring base={base} />);
    expect(k.mesures).toBe(Object.values(base.propositions).reduce((n, l) => n + l.length, 0));
    expect(k.themes).toBe(base.themes.length);
    expect(html).toContain(`<strong>${k.mesures}</strong><span>mesures</span>`);
    expect(html).toContain(`<strong>${k.candidatsAvecMesures} / ${k.candidatsTotal}</strong>`);
  });
});

describe("Monitoring : candidats sans mesure dans la source", () => {
  it.each(listerBases().map((b) => b.id))("base « %s » : dit les candidats que la source ne couvre pas, s'il y en a", (id) => {
    const base = chargerBase(id);
    const noms = candidatsDeBase(base).enCoursAnalyse.map((m) => m.nom);
    const html = renderToStaticMarkup(<Monitoring base={base} />);
    if (noms.length === 0) expect(html).not.toContain("Sans mesure dans cette source");
    else expect(html).toContain(`Sans mesure dans cette source pour le moment : ${noms.join(", ")}.`);
  });
});
