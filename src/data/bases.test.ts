import { describe, expect, it } from "vitest";
import {
  baseParDefaut,
  candidatsDeBase,
  chargerBase,
  extraireBase,
  extraireBaseEtSlug,
  listerBases,
  regrouperParBaseEtSlug,
  resoudreBase,
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

  it("s'assemble en candidats sans erreur", () => {
    const { avecDonnees, enCoursAnalyse } = candidatsDeBase(base);
    expect(avecDonnees.length + enCoursAnalyse.length).toBe(Object.keys(base.metas).length);
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
