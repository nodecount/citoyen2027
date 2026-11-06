import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import bordsPolitiques from "../../data/bords-politiques.json";
import type { CandidatMeta } from "../types";
import { chargerBase, listerBases } from "./bases";
import { appliquerPartiCommun, partiCommun } from "./partiCommun";

function meta(slug: string, parti: string): CandidatMeta {
  return { slug, nom: slug, parti, sources_officielles: [], date_derniere_maj: "2026-11-06" };
}

describe("partiCommun", () => {
  it("donne le parti du référentiel commun, quel que soit le comparateur d'origine", () => {
    expect(partiCommun("lisnard")).toBe("Nouvelle Énergie");
    expect(partiCommun("roussel")).toBe("Parti communiste français");
    expect(partiCommun("tondelier")).toBe("Les Écologistes");
  });

  it("renvoie null pour un candidat que le référentiel ne connaît pas", () => {
    expect(partiCommun("inconnu")).toBeNull();
  });
});

describe("appliquerPartiCommun", () => {
  it("remplace le parti de la source quand le référentiel le connaît, et ne touche à rien d'autre", () => {
    const [avant] = [meta("lisnard", "LR")];
    const apres = appliquerPartiCommun({ lisnard: avant }).lisnard;
    expect(apres.parti).toBe("Nouvelle Énergie");
    expect(apres).toEqual({ ...avant, parti: "Nouvelle Énergie" });
  });

  it("garde le parti de la source pour un candidat absent du référentiel", () => {
    expect(appliquerPartiCommun({ inconnu: meta("inconnu", "Un parti") }).inconnu.parti).toBe("Un parti");
  });

  it("ne modifie pas l'objet reçu", () => {
    const entree = { lisnard: meta("lisnard", "LR") };
    appliquerPartiCommun(entree);
    expect(entree.lisnard.parti).toBe("LR");
  });
});

describe("parti vu par l'application", () => {
  it("est le même dans toutes les bases où le candidat figure", () => {
    expect(chargerBase("agregateurs").metas.lisnard.parti).toBe("Nouvelle Énergie");
    expect(chargerBase("agregateurs").metas.roussel.parti).toBe("Parti communiste français");
    for (const info of listerBases()) {
      const partis = Object.entries(chargerBase(info.id).metas).map(([slug, m]) => [slug, m.parti] as const);
      for (const [slug, parti] of partis) if (partiCommun(slug)) expect(parti, `${info.id}/${slug}`).toBe(partiCommun(slug));
    }
  });
});

describe("référentiel commun des candidats (critère de fiabilité décidé le 2026-11-06)", () => {
  it("connaît chaque candidat de chaque base : sinon le script bords_politiques.py est à relancer, ou le référentiel à changer", () => {
    const racine = resolve(process.cwd(), "data/bases");
    const details = (bordsPolitiques as { details: Record<string, unknown> }).details;
    const manquants: string[] = [];
    for (const base of readdirSync(racine, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const programmes = resolve(racine, base.name, "programmes");
      if (!existsSync(programmes)) continue;
      for (const candidat of readdirSync(programmes, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        if (!(candidat.name in details)) manquants.push(`${base.name}/${candidat.name}`);
      }
    }
    expect(manquants).toEqual([]);
  });
});
