import { describe, expect, it } from "vitest";
import type { Proposition } from "../types";
import type { CandidatCharge } from "./chargerCandidats";
import {
  baseParDefaut,
  candidatsDeBase,
  chargerBase,
  derniereMiseAJour,
  extraireBase,
  extraireBaseEtSlug,
  listerBases,
  regrouperParBaseEtSlug,
  resoudreBase,
  resumesManquants,
  type BaseCharge,
  type InfoBase,
} from "./bases";

const BASES: InfoBase[] = [
  { id: "a", libelle: "A", description: "", avertissement: "" },
  { id: "b", libelle: "B", description: "", avertissement: "", defaut: true },
];

describe("chemins des modules", () => {
  it("extrait la base et le candidat du chemin d'un fichier de données", () => {
    expect(extraireBaseEtSlug("../../data/bases/officielle/programmes/le-pen/meta.json")).toEqual({ base: "officielle", slug: "le-pen" });
    expect(extraireBase("../../data/bases/agregateurs/themes.json")).toBe("agregateurs");
  });

  it("renvoie null quand le chemin n'est pas celui d'une base", () => {
    expect(extraireBaseEtSlug("chemin-invalide.json")).toBeNull();
    expect(extraireBase("data/programmes/le-pen/meta.json")).toBeNull();
  });

  it("ne regroupe que les fichiers de la base demandée, sans mélanger deux bases", () => {
    const modules = {
      "../../data/bases/a/programmes/x/meta.json": { default: "a-x" },
      "../../data/bases/b/programmes/x/meta.json": { default: "b-x" },
      "../../data/bases/b/programmes/y/meta.json": { default: "b-y" },
    };
    expect(regrouperParBaseEtSlug(modules, "a")).toEqual({ x: "a-x" });
    expect(regrouperParBaseEtSlug(modules, "b")).toEqual({ x: "b-x", y: "b-y" });
  });
});

describe("choix de la base", () => {
  it("prend la base demandée si elle existe", () => {
    expect(resoudreBase("a", BASES).id).toBe("a");
  });

  it("retombe sur la base par défaut quand la demande est inconnue, absente ou vide", () => {
    expect(resoudreBase("inconnue", BASES).id).toBe("b");
    expect(resoudreBase(null, BASES).id).toBe("b");
    expect(resoudreBase(undefined, BASES).id).toBe("b");
    expect(resoudreBase("", BASES).id).toBe("b");
  });

  it("prend la première base si aucune n'est marquée par défaut", () => {
    expect(baseParDefaut([{ ...BASES[0] }, { ...BASES[1], defaut: false }]).id).toBe("a");
  });
});

// Les bases doivent avoir la même structure : c'est ce qui permet au moteur et à l'interface d'être communs.
describe.each(listerBases())("base « $id »", (info) => {
  const base = chargerBase(info.id);

  it("est déclarée avec un libellé, une description et un avertissement", () => {
    for (const champ of [info.libelle, info.description, info.avertissement]) {
      expect(typeof champ).toBe("string");
      expect(champ.length).toBeGreaterThan(0);
    }
  });

  it("a un référentiel de thèmes valide, sans identifiant en double", () => {
    expect(base.themes.length).toBeGreaterThan(0);
    for (const theme of base.themes) {
      expect(theme.id.length).toBeGreaterThan(0);
      expect(theme.libelle.length).toBeGreaterThan(0);
      expect(theme.question_citoyen.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(["populated", "provisoire"]).toContain(theme.statut);
    }
    expect(new Set(base.themes.map((t) => t.id)).size).toBe(base.themes.length);
  });

  it("ne contient que des propositions rattachées à un thème de SA base et à SON candidat", () => {
    const ids = new Set(base.themes.map((t) => t.id));
    for (const [slug, propositions] of Object.entries(base.propositions)) {
      for (const p of propositions) {
        expect(ids.has(p.theme), `${slug} : thème « ${p.theme} » absent de la base ${info.id}`).toBe(true);
        expect(p.candidat).toBe(slug);
      }
    }
  });

  it("a des identifiants de propositions uniques dans la base", () => {
    const tous = Object.values(base.propositions).flat().map((p) => p.id);
    expect(new Set(tous).size).toBe(tous.length);
  });

  it("ne référence dans les synthèses que des thèmes de la base", () => {
    const ids = new Set(base.themes.map((t) => t.id));
    for (const syntheses of Object.values(base.syntheses)) for (const s of syntheses) expect(ids.has(s.theme)).toBe(true);
  });

  it("ne référence dans les remarques qu'un thème de la base et des mesures du candidat concerné", () => {
    const idsThemes = new Set(base.themes.map((t) => t.id));
    for (const [slug, remarques] of Object.entries(base.remarques)) {
      const idsMesures = new Set(base.propositions[slug]?.map((p) => p.id) ?? []);
      for (const r of remarques) {
        expect(idsThemes.has(r.theme), `${slug} : thème « ${r.theme} » absent de la base ${info.id}`).toBe(true);
        for (const id of r.mesures) expect(idsMesures.has(id), `${slug} : mesure « ${id} » absente de ses propositions`).toBe(true);
      }
    }
  });

  it("s'assemble en candidats sans erreur", () => {
    const { avecDonnees, enCoursAnalyse } = candidatsDeBase(base);
    expect(avecDonnees.length + enCoursAnalyse.length).toBe(Object.keys(base.metas).length);
  });
});

function baseAvecMetas(dates: string[]): BaseCharge {
  const metas = Object.fromEntries(dates.map((d, i) => [`c${i}`, { slug: `c${i}`, nom: `C${i}`, parti: "P", sources_officielles: [], date_derniere_maj: d }]));
  return { info: BASES[0], themes: [], champs: [], questionnaire: { generales: [], parTheme: [] }, metas, propositions: {}, syntheses: {}, resumes: {}, remarques: {}, resumesRefuses: {}, aVerifier: {} };
}

describe("resumesManquants", () => {
  const THEMES = [
    { id: "fiscalite", libelle: "Mes impôts et taxes", question_citoyen: "Q ?", description: "d", statut: "populated" as const },
    { id: "retraites", libelle: "Ma retraite", question_citoyen: "Q ?", description: "d", statut: "populated" as const },
  ];
  const mesure = (theme: string, id: string): Proposition => ({
    id,
    candidat: "a",
    theme,
    titre: "T",
    resume_factuel: "R",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-28",
  });
  const resume = (theme: string) => ({ theme, segments: [], propositions: [], empreinte: "e", date: "2026-09-28", modele: "m" });
  function base(resumesRefuses: BaseCharge["resumesRefuses"] = {}): BaseCharge {
    return { ...baseAvecMetas([]), themes: THEMES, resumesRefuses };
  }
  function candidat(propositions: ReturnType<typeof mesure>[], resumes: ReturnType<typeof resume>[] = []): CandidatCharge {
    return { meta: { slug: "a", nom: "Nom A", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-28" }, propositions, syntheses: [], resumes };
  }

  it("liste un thème avec des mesures mais sans résumé, raison null si jamais tenté", () => {
    const manquants = resumesManquants(base(), [candidat([mesure("fiscalite", "a-1")])]);
    expect(manquants).toEqual([{ nom: "Nom A", themeLibelle: "Mes impôts et taxes", nombreMesures: 1, raison: null }]);
  });

  it("reprend la raison du dernier refus enregistré, quand la génération a déjà été tentée", () => {
    const manquants = resumesManquants(base({ a: [{ theme: "fiscalite", raison: "texte trop long", empreinte: "e", date: "2026-09-28" }] }), [
      candidat([mesure("fiscalite", "a-1")]),
    ]);
    expect(manquants[0].raison).toBe("texte trop long");
  });

  it("n'inclut pas un thème qui a déjà un résumé", () => {
    const manquants = resumesManquants(base(), [candidat([mesure("fiscalite", "a-1")], [resume("fiscalite")])]);
    expect(manquants).toEqual([]);
  });

  it("n'inclut pas un thème sans aucune mesure affichable pour ce candidat", () => {
    const manquants = resumesManquants(base(), [candidat([{ ...mesure("fiscalite", "a-1"), statut: "provisoire" }])]);
    expect(manquants).toEqual([]);
  });

  it("liste chaque thème concerné, pour plusieurs candidats", () => {
    const manquants = resumesManquants(base(), [
      candidat([mesure("fiscalite", "a-1"), mesure("retraites", "a-2")]),
      { ...candidat([mesure("fiscalite", "b-1")]), meta: { slug: "b", nom: "Nom B", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-28" } },
    ]);
    expect(manquants.map((m) => `${m.nom} × ${m.themeLibelle}`)).toEqual(["Nom A × Mes impôts et taxes", "Nom A × Ma retraite", "Nom B × Mes impôts et taxes"]);
  });
});

describe("derniereMiseAJour", () => {
  it("prend la plus récente des dates de mise à jour des candidats de la base", () => {
    expect(derniereMiseAJour(baseAvecMetas(["2026-09-18", "2026-09-27", "2026-01-05"]))).toBe("2026-09-27");
  });

  it("renvoie null pour une base sans candidat, jamais une date inventée", () => {
    expect(derniereMiseAJour(baseAvecMetas([]))).toBeNull();
  });

  it("reflète les vraies données de chaque base (jamais dans le futur, jamais absente)", () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    for (const info of listerBases()) {
      const maj = derniereMiseAJour(chargerBase(info.id));
      expect(maj, info.id).not.toBeNull();
      expect(maj! <= aujourdhui, `${info.id} : ${maj}`).toBe(true);
    }
  });
});

describe("registre des bases", () => {
  it("désigne exactement une base par défaut", () => {
    expect(listerBases().filter((b) => b.defaut)).toHaveLength(1);
  });

  it("a des identifiants uniques", () => {
    const ids = listerBases().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
