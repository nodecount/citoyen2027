import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { regles } from "../engine/regles";
import themesRaw from "../../data/bases/officielle/themes.json";
import lePenMetaRaw from "../../data/bases/officielle/programmes/le-pen/meta.json";
import lePenPropsRaw from "../../data/bases/officielle/programmes/le-pen/propositions.json";
import melenchonMetaRaw from "../../data/bases/officielle/programmes/melenchon/meta.json";
import melenchonPropsRaw from "../../data/bases/officielle/programmes/melenchon/propositions.json";
import philippeMetaRaw from "../../data/bases/officielle/programmes/philippe/meta.json";
import philippePropsRaw from "../../data/bases/officielle/programmes/philippe/propositions.json";
import attalMeta from "../../data/bases/officielle/programmes/attal/meta.json";
import glucksmannMeta from "../../data/bases/officielle/programmes/glucksmann/meta.json";
import retailleauMeta from "../../data/bases/officielle/programmes/retailleau/meta.json";
import ruffinMeta from "../../data/bases/officielle/programmes/ruffin/meta.json";
import faureMeta from "../../data/bases/officielle/programmes/faure/meta.json";
import type { Theme, CandidatMeta, Proposition } from "../types";

const themes: Theme[] = themesRaw as Theme[];
const lePenMeta: CandidatMeta = lePenMetaRaw as CandidatMeta;
const lePenProps: Proposition[] = lePenPropsRaw as Proposition[];
const melenchonMeta: CandidatMeta = melenchonMetaRaw as CandidatMeta;
const melenchonProps: Proposition[] = melenchonPropsRaw as Proposition[];
const philippeMeta: CandidatMeta = philippeMetaRaw as CandidatMeta;
const philippeProps: Proposition[] = philippePropsRaw as Proposition[];

const THEME_IDS = new Set(themes.map((t) => t.id));
const STATUTS = new Set(["complet", "partiel", "provisoire"]);

describe("ids des propositions", () => {
  it("les ids de propositions, tous candidats confondus, sont uniques", () => {
    const allProps = [...lePenProps, ...melenchonProps, ...philippeProps];
    const ids = allProps.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Données produites par le pipeline corpus (extrait retrouvé mot pour mot dans le document : une source primaire suffit,
// voir SOURCES_MINIMUM ; une mesure sans chiffre a des hypothèses vides ; un thème peut compter moins de 2 mesures).
describe.each([
  { slug: "le-pen", meta: lePenMeta, props: lePenProps },
  { slug: "melenchon", meta: melenchonMeta, props: melenchonProps },
  { slug: "philippe", meta: philippeMeta, props: philippeProps },
])("candidat $slug (pipeline corpus)", ({ slug, meta, props }) => {
  it("a un meta.json complet, avec ses documents datés", () => {
    expect(meta.slug).toBe(slug);
    expect(meta.documents?.length).toBeGreaterThan(0);
    for (const d of meta.documents ?? []) expect(Number.isInteger(d.annee)).toBe(true);
  });

  it("chaque proposition référence un thème connu, un statut valide, et porte au moins une source primaire datée", () => {
    for (const p of props) {
      expect(THEME_IDS.has(p.theme)).toBe(true);
      expect(STATUTS.has(p.statut)).toBe(true);
      expect(p.candidat).toBe(slug);
      expect(p.titre.length).toBeGreaterThan(0);
      expect(p.resume_factuel.length).toBeGreaterThan(0);
      expect(p.sources.some((s) => s.type === "primaire")).toBe(true);
      for (const s of p.sources) expect(Number.isInteger(s.annee)).toBe(true);
    }
  });

  it("aucun texte produit ne contient de balise parasite (résidu de la sortie du modèle)", () => {
    const dossier = resolve(__dirname, `../../data/bases/officielle/programmes/${slug}`);
    for (const fichier of ["propositions.json", "synthese.json"]) {
      expect(readFileSync(resolve(dossier, fichier), "utf-8"), fichier).not.toMatch(/<\/?[a-z_][\w-]*[^>]*>/i);
    }
  });

  it("les ids sont uniques", () => {
    const ids = props.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("meta.json des candidats du lot pilote (ingestion)", () => {
  const metasPilote = [
    { slug: "attal", meta: attalMeta },
    { slug: "glucksmann", meta: glucksmannMeta },
    { slug: "retailleau", meta: retailleauMeta },
    { slug: "ruffin", meta: ruffinMeta },
    { slug: "faure", meta: faureMeta },
  ];

  it.each(metasPilote)("$slug a un slug cohérent et au moins une source primaire", ({ slug, meta }) => {
    expect(meta.slug).toBe(slug);
    expect(meta.sources_officielles.length).toBeGreaterThan(0);
    expect(meta.sources_officielles.some((s) => s.type === "primaire")).toBe(true);
  });
});

describe("regles (src/engine/regles.ts)", () => {
  it("chaque clé de `regles` correspond à un id de proposition réel existant", () => {
    const allProps = [...lePenProps, ...melenchonProps, ...philippeProps];
    const idsConnus = new Set(allProps.map((p) => p.id));
    for (const cle of Object.keys(regles)) {
      expect(idsConnus.has(cle)).toBe(true);
    }
  });
});
