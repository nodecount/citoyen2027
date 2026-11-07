import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import type { SortieCli } from "./claude-cli";
import {
  appliquerAuxMesures,
  appliquerEffetsDuTexte,
  decouperEnPassages,
  decrireLesTextes,
  empreinteTexte,
  fusionnerEffets,
  LECTURE_MAX,
  scrutinsDistincts,
  TAILLE_PASSAGE,
  type EffetsDuTexte,
} from "./structuration-textes";

const effet = (extrait: string, sens: Effet["sens"] = "baisse", dimension: Effet["dimension"] = "acces_aux_services"): Effet => ({
  cibles: [{ champ: "nationalite", valeurs: ["hors_ue"] }],
  dimension,
  sens,
  source_url: "https://exemple.fr/scrutin/1",
  extrait,
});

function proposition(slug: string, surcharge: Partial<Proposition> = {}): Proposition {
  return {
    id: `${slug}-immigration-an-1`,
    candidat: slug,
    theme: "immigration",
    titre: `${slug} a voté pour la loi X`,
    resume_factuel: "Début de la loi. Article 1er. Les étrangers perdent l'accès à un service.",
    sources: [{ type: "primaire", label: "scrutin", url: "https://exemple.fr/scrutin/1", nom: "AN (scrutin)", annee: 2024 }],
    chiffrage_disponible: false,
    hypotheses_calcul: "Vote nominatif : pour. Texte tronqué à 8000 caractères.",
    statut: "partiel",
    date_derniere_verification: "2026-11-06",
    sous_theme: "La loi X",
    titre_litteral: false,
    vote: "pour",
    ...surcharge,
  };
}

describe("decouperEnPassages", () => {
  it("rend un texte court en un seul passage", () => {
    expect(decouperEnPassages("Article 1er\nTexte.")).toEqual({ passages: ["Article 1er\nTexte."], tronque: false });
  });

  it("coupe aux fins de ligne, sans perdre ni répéter un caractère", () => {
    const texte = Array.from({ length: 40 }, (_, i) => `Article ${i + 1}. ${"mot ".repeat(60)}`).join("\n");
    const { passages, tronque } = decouperEnPassages(texte, 2000);
    expect(passages.length).toBeGreaterThan(3);
    expect(passages.every((p) => p.length <= 2000)).toBe(true);
    expect(passages.join("\n")).toBe(texte);
    expect(tronque).toBe(false);
  });

  it("coupe de force une ligne plus longue qu'un passage", () => {
    const { passages } = decouperEnPassages("a".repeat(5000), 2000);
    expect(passages.map((p) => p.length)).toEqual([2000, 2000, 1000]);
  });

  it("ne lit pas au-delà du plafond de lecture et le dit", () => {
    const texte = "Article. Texte du jour.\n".repeat(Math.ceil((LECTURE_MAX * 1.5) / 24));
    const { passages, tronque } = decouperEnPassages(texte);
    expect(tronque).toBe(true);
    expect(passages.join("\n").length).toBeLessThanOrEqual(LECTURE_MAX);
    expect(passages.every((p) => p.length <= TAILLE_PASSAGE)).toBe(true);
  });
});

describe("fusionnerEffets", () => {
  it("garde un seul exemplaire d'un même effet décrit dans deux passages", () => {
    const a = effet("premier passage");
    const b = effet("second passage");
    expect(fusionnerEffets([[a], [b]])).toEqual([a]);
  });

  it("garde deux effets qui diffèrent par le sens, la dimension ou la cible", () => {
    const fusion = fusionnerEffets([[effet("x", "baisse")], [effet("y", "hausse")], [effet("z", "baisse", "droits_et_libertes")]]);
    expect(fusion).toHaveLength(3);
  });
});

describe("empreinteTexte", () => {
  it("change avec le texte, pas avec le thème ni le candidat", () => {
    expect(empreinteTexte("loi A")).not.toBe(empreinteTexte("loi B"));
    expect(empreinteTexte("loi A")).toBe(empreinteTexte("loi A"));
  });
});

describe("scrutinsDistincts", () => {
  it("décrit une loi une seule fois, quel que soit le nombre de candidats qui l'ont votée", () => {
    const toutes = [proposition("le-pen"), proposition("melenchon", { vote: "contre" }), proposition("retailleau", { id: "retailleau-sante-an-2", theme: "sante", sources: [{ type: "primaire", label: "s", url: "https://exemple.fr/scrutin/2", nom: "AN", annee: 2024 }] })];
    expect(scrutinsDistincts(toutes)).toEqual([
      { url: "https://exemple.fr/scrutin/1", theme: "immigration" },
      { url: "https://exemple.fr/scrutin/2", theme: "sante" },
    ]);
  });
});

describe("decrireLesTextes", () => {
  const reponse = (structure: unknown): SortieCli => ({ structure, coutReferenceUsd: 0.1, dureeMs: 1, jetonsEntree: 1, jetonsSortie: 1, brut: "" });
  const loi = ["Article 1er", "Les étrangers non européens perdent l'accès à l'aide médicale d'État.", "Article 2", "Les employeurs paient une cotisation supplémentaire."].join("\n");
  const themes = (id: string) => id;

  // Faux modèle : décrit un effet par passage qui contient la phrase demandée, relit en PASS.
  function fauxModele(appels: string[]) {
    return {
      appeler: async (prompt: string, systeme: string): Promise<SortieCli> => {
        appels.push(systeme.includes("relecteur") ? "relecture" : "structuration");
        if (systeme.includes("relecteur")) {
          const ids = [...prompt.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
          return reponse({ verdicts: ids.map((id) => ({ id, verdict: "PASS" })) });
        }
        const ids = [...prompt.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
        return reponse({
          resultats: ids.map((id) => ({
            id,
            effets: prompt.includes("aide médicale d'État") ? [{ cibles: [{ champ: "nationalite", valeurs: ["hors_ue"] }], dimension: "acces_aux_services", sens: "baisse", extrait: "perdent l'accès à l'aide médicale d'État" }] : [],
          })),
        });
      },
    };
  }

  it("lit la loi une fois, quel que soit le nombre de votants, et note passages et coût", async () => {
    const appels: string[] = [];
    const { journal } = await decrireLesTextes([{ url: "u1", theme: "immigration", texte: loi }], {}, themes, fauxModele(appels), {});
    expect(appels.filter((a) => a === "structuration")).toHaveLength(1);
    expect(journal.u1.effets).toHaveLength(1);
    expect(journal.u1.passages).toBe(1);
    expect(journal.u1.empreinte).toBe(empreinteTexte(loi));
  });

  it("ne refait pas un texte déjà décrit et inchangé, mais le refait s'il a changé ou avec --force", async () => {
    const appels: string[] = [];
    const premier = await decrireLesTextes([{ url: "u1", theme: "immigration", texte: loi }], {}, themes, fauxModele(appels), {});
    const avant = appels.length;
    await decrireLesTextes([{ url: "u1", theme: "immigration", texte: loi }], premier.journal, themes, fauxModele(appels), {});
    expect(appels.length).toBe(avant);
    await decrireLesTextes([{ url: "u1", theme: "immigration", texte: loi + "\nArticle 3" }], premier.journal, themes, fauxModele(appels), {});
    expect(appels.length).toBeGreaterThan(avant);
    const apres = appels.length;
    await decrireLesTextes([{ url: "u1", theme: "immigration", texte: loi }], premier.journal, themes, fauxModele(appels), { force: true });
    expect(appels.length).toBeGreaterThan(apres);
  });

  it("lit une loi longue passage par passage et rassemble les effets de tous les passages", async () => {
    const longue = [`Article 1er\n${"Disposition sans portée. ".repeat(1200)}`, "Article 50", "Les étrangers non européens perdent l'accès à l'aide médicale d'État."].join("\n");
    const appels: string[] = [];
    const { journal } = await decrireLesTextes([{ url: "u1", theme: "immigration", texte: longue }], {}, themes, fauxModele(appels), {});
    expect(journal.u1.passages).toBeGreaterThan(1);
    expect(journal.u1.effets).toHaveLength(1);
  });

  it("cible les champs du formulaire de la base 2027etmoi (ici « incapacité permanente », absent des autres bases)", async () => {
    const texte = "Article 1er\nLes assurés reconnus en incapacité permanente voient leur pension relevée.";
    const modele = {
      appeler: async (prompt: string, systeme: string): Promise<SortieCli> => {
        const ids = [...prompt.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
        if (systeme.includes("relecteur")) return reponse({ verdicts: ids.map((id) => ({ id, verdict: "PASS" })) });
        return reponse({ resultats: ids.map((id) => ({ id, effets: [{ cibles: [{ champ: "incapacite_permanente", valeurs: ["oui"] }], dimension: "revenu_disponible", sens: "hausse", extrait: "incapacité permanente voient leur pension relevée" }] })) });
      },
    };
    const { journal } = await decrireLesTextes([{ url: "u9", theme: "retraites", texte }], {}, themes, modele, {});
    expect(journal.u9.effets).toHaveLength(1);
  });

  it("s'arrête au plafond de coût sans perdre ce qui est fait", async () => {
    const textes = ["u1", "u2", "u3"].map((url) => ({ url, theme: "immigration", texte: loi + url }));
    const { journal, arret } = await decrireLesTextes(textes, {}, themes, fauxModele([]), { plafondRefUsd: 0.15, concurrence: 1 });
    expect(arret).toBe("plafond");
    expect(Object.keys(journal).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(journal).length).toBeLessThan(3);
  });
});

describe("appliquerAuxMesures", () => {
  const deuxSources = (surcharge: Partial<Proposition> = {}) =>
    proposition("le-pen", { sources: [{ type: "primaire", label: "s", url: "https://exemple.fr/scrutin/1", nom: "AN", annee: 2024 }, { type: "primaire", label: "t", url: "https://exemple.fr/texte/1", nom: "AN", annee: 2024 }], ...surcharge });
  const decrit: EffetsDuTexte = { empreinte: "abc", passages: 2, tronque: false, effets: [effet("Les étrangers perdent l'accès à un service.")], date: "2026-11-07", cout_reference_usd: 0.1 };

  it("donne à chaque votant d'une loi décrite les effets de cette loi", () => {
    const [pour, contre] = appliquerAuxMesures([deuxSources(), deuxSources({ id: "autre", vote: "contre" })], { "https://exemple.fr/scrutin/1": decrit });
    expect(pour.effets).toEqual(decrit.effets);
    expect(contre.effets).toEqual(decrit.effets);
  });

  it("marque « analysée, sans effet » une mesure sans texte de loi (une seule source), sans appel", () => {
    const [p] = appliquerAuxMesures([proposition("le-pen")], {});
    expect(p.effets).toEqual([]);
  });

  it("laisse intacte une mesure dont la loi a un texte mais n'est pas encore décrite", () => {
    const [p] = appliquerAuxMesures([deuxSources()], {});
    expect(p.effets).toBeUndefined();
  });
});

describe("appliquerEffetsDuTexte", () => {
  const decrit = (surcharge: Partial<EffetsDuTexte> = {}): EffetsDuTexte => ({
    empreinte: "abc",
    passages: 11,
    tronque: false,
    effets: [effet("Les étrangers perdent l'accès à un service.")],
    date: "2026-11-07",
    cout_reference_usd: 0.5,
    ...surcharge,
  });

  it("donne les mêmes effets à un vote pour et à un vote contre : l'inversion reste l'affaire du moteur", () => {
    const pour = appliquerEffetsDuTexte(proposition("le-pen"), decrit());
    const contre = appliquerEffetsDuTexte(proposition("melenchon", { vote: "contre" }), decrit());
    expect(pour.effets).toEqual(contre.effets);
    expect(contre.effets![0].sens).toBe("baisse");
  });

  it("ajoute au texte affiché le passage retenu plus loin dans la loi, pour que l'extrait y soit retrouvé", () => {
    const lointain = effet("Une cotisation supplémentaire est due par les employeurs de plus de dix salariés.");
    const p = appliquerEffetsDuTexte(proposition("le-pen"), decrit({ effets: [lointain] }));
    expect(p.resume_factuel).toContain("Une cotisation supplémentaire est due par les employeurs de plus de dix salariés.");
    expect(p.resume_factuel.startsWith("Début de la loi.")).toBe(true);
  });

  it("n'ajoute pas un extrait déjà présent dans le début du texte", () => {
    const p = appliquerEffetsDuTexte(proposition("le-pen"), decrit({ effets: [effet("Les étrangers perdent l'accès à un service.")] }));
    expect(p.resume_factuel).toBe(proposition("le-pen").resume_factuel);
  });

  it("est idempotent : rejouer ne duplique ni passages ni phrases d'hypothèse", () => {
    const lointain = decrit({ effets: [effet("Une cotisation supplémentaire est due par les employeurs de plus de dix salariés.")] });
    const une = appliquerEffetsDuTexte(proposition("le-pen"), lointain);
    const deux = appliquerEffetsDuTexte(une, lointain);
    expect(deux).toEqual(une);
  });

  it("dit dans l'hypothèse que la loi entière a été lue, en combien de passages, et remplace la mention de troncature", () => {
    const p = appliquerEffetsDuTexte(proposition("le-pen"), decrit());
    expect(p.hypotheses_calcul).toContain("lue en 11 passages");
    expect(p.hypotheses_calcul).not.toContain("tronqué à 8000");
  });

  it("dit quand la loi est trop longue pour avoir été lue en entier", () => {
    const p = appliquerEffetsDuTexte(proposition("le-pen"), decrit({ tronque: true }));
    expect(p.hypotheses_calcul).toMatch(/début de la loi seulement/);
  });

  it("marque « analysée, sans effet » (effets vides) une loi lue qui n'a donné aucun effet", () => {
    expect(appliquerEffetsDuTexte(proposition("le-pen"), decrit({ effets: [] })).effets).toEqual([]);
  });
});
