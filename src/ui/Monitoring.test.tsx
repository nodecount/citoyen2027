import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase, listerBases } from "../data/bases";
import Monitoring from "./Monitoring";

describe("Monitoring : candidats sans mesure dans la source", () => {
  it.each(listerBases().map((b) => b.id))("base « %s » : dit les candidats que la source ne couvre pas, s'il y en a", (id) => {
    const base = chargerBase(id);
    const noms = candidatsDeBase(base).enCoursAnalyse.map((m) => m.nom);
    const html = renderToStaticMarkup(<Monitoring base={base} />);
    if (noms.length === 0) expect(html).not.toContain("Sans mesure dans cette source");
    else expect(html).toContain(`Sans mesure dans cette source pour le moment : ${noms.join(", ")}.`);
  });
});
