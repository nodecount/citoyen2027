import { describe, expect, it } from "vitest";
import type { TexteDocument } from "./documents";
import { JETONS_CORPUS_MAX, construireCorpus, fenetreAutour, localiserExtrait } from "./corpus";

function doc(id: string, texte: string, surcharge: Partial<TexteDocument> = {}): TexteDocument {
  return { id, url: `https://exemple-officiel.fr/${id}.pdf`, nom: "exemple-officiel.fr", annee: 2026, type: "pdf", texte, ...surcharge };
}

const PDF = doc(
  "livret",
  "[[page 1]]\nPréambule du programme.\n[[page 2]]\nLe candidat propose de supprimer la C3S dès l'entame du quinquennat.\n" +
    "[[page 3]]\nÉpargne : « rendre la fiscalité plus incitative pour les investissements productifs de long terme ».",
);

describe("construireCorpus", () => {
  it("balise chaque document avec son identifiant, son nom, son année et son adresse", () => {
    const corpus = construireCorpus([PDF, doc("page", "Texte de la page", { type: "html" })]);
    expect(corpus.texte).toContain("<<<DOCUMENT livret | exemple-officiel.fr | 2026 | https://exemple-officiel.fr/livret.pdf>>>");
    expect(corpus.texte).toContain("<<<FIN DOCUMENT livret>>>");
    expect(corpus.texte.indexOf("<<<DOCUMENT livret")).toBeLessThan(corpus.texte.indexOf("<<<DOCUMENT page"));
    expect(corpus.parId.get("page")?.texte).toBe("Texte de la page");
  });

  it("estime le volume en jetons, document par document et au total", () => {
    const corpus = construireCorpus([doc("a", "x".repeat(2200)), doc("b", "y".repeat(4400))]);
    expect(corpus.documents.map((d) => d.jetons)).toEqual([1000, 2000]);
    expect(corpus.jetons).toBeGreaterThanOrEqual(3000);
  });

  it("refuse un corpus au-delà de la limite, avec la taille et le conseil de réduire les documents", () => {
    const enorme = doc("gros", "z".repeat(Math.ceil((JETONS_CORPUS_MAX + 1000) * 3.6)));
    expect(() => construireCorpus([enorme])).toThrow(/limite|trop volumineux/i);
  });

  it("refuse deux documents de même identifiant : une citation deviendrait ambiguë", () => {
    expect(() => construireCorpus([doc("a", "un"), doc("a", "deux")])).toThrow("identifiant");
  });
});

describe("localiserExtrait", () => {
  it("retrouve un extrait mot pour mot et indique la page où il se trouve", () => {
    const r = localiserExtrait(PDF, "supprimer la C3S dès l'entame du quinquennat");
    expect(r.trouve).toBe(true);
    expect(r.page).toBe(2);
  });

  it("tolère la casse, les accents, les guillemets et la ponctuation", () => {
    const r = localiserExtrait(PDF, "Rendre la fiscalite plus incitative pour les investissements productifs de long terme");
    expect(r.trouve).toBe(true);
    expect(r.page).toBe(3);
  });

  it("reste strict sur les mots : un mot changé ou ajouté n'est pas l'extrait", () => {
    expect(localiserExtrait(PDF, "supprimer la CVAE dès l'entame du quinquennat").trouve).toBe(false);
    expect(localiserExtrait(PDF, "supprimer définitivement la C3S dès l'entame").trouve).toBe(false);
  });

  it("ne valide pas un extrait trop court : il trouverait toujours une correspondance", () => {
    expect(localiserExtrait(PDF, "la C3S").trouve).toBe(false);
    expect(localiserExtrait(PDF, "   ").trouve).toBe(false);
  });

  it("ne renvoie pas de page pour un document HTML", () => {
    const html = doc("page", "Le programme prévoit une baisse des impôts de production.", { type: "html" });
    const r = localiserExtrait(html, "une baisse des impôts de production");
    expect(r.trouve).toBe(true);
    expect(r.page).toBeUndefined();
  });

  it("donne la position dans le texte d'origine (pas dans le texte normalisé)", () => {
    const r = localiserExtrait(PDF, "SUPPRIMER LA C3S dès l'entame du quinquennat");
    expect(PDF.texte.slice(r.debut, r.fin).toLowerCase()).toContain("supprimer la c3s");
  });
});

describe("fenetreAutour", () => {
  it("renvoie l'extrait entouré de contexte, borné aux limites du document", () => {
    const r = localiserExtrait(PDF, "supprimer la C3S dès l'entame du quinquennat");
    const fenetre = fenetreAutour(PDF, r.debut!, r.fin!, 30);
    expect(fenetre).toContain("supprimer la C3S");
    expect(fenetre.length).toBeLessThanOrEqual("supprimer la C3S dès l'entame du quinquennat".length + 60 + 4);
    expect(fenetreAutour(PDF, 0, 5, 9999)).toBe(PDF.texte);
  });
});

describe("empreinte du corpus", () => {
  it("dépend du contenu de chaque document et de son identifiant, pas de l'ordre de déclaration", () => {
    const a = construireCorpus([doc("a", "Texte A"), doc("b", "Texte B")]);
    const memeOrdreInverse = construireCorpus([doc("b", "Texte B"), doc("a", "Texte A")]);
    const modifie = construireCorpus([doc("a", "Texte A modifié"), doc("b", "Texte B")]);
    expect(a.empreinte).toBe(memeOrdreInverse.empreinte);
    expect(a.empreinte).not.toBe(modifie.empreinte);
    expect(a.empreinte).toMatch(/^[0-9a-f]{16}$/);
  });

  it("expose l'empreinte de chaque document pour dire lequel a changé", () => {
    const corpus = construireCorpus([doc("a", "Texte A"), doc("b", "Texte B")]);
    expect(corpus.documents.map((d) => d.empreinte)).toHaveLength(2);
    expect(corpus.documents[0].empreinte).not.toBe(corpus.documents[1].empreinte);
  });
});

describe("localiserExtrait — citations avec coupes « … »", () => {
  const D = doc(
    "livret",
    "[[page 4]]\nSophie, 42 ans, gagne 2 700 euros bruts par mois. Après une rupture conventionnelle, elle perçoit environ 1 400 euros par mois.\n" +
      "Un long développement sans rapport occupe ici plusieurs lignes du document officiel.\n" +
      "[[page 5]]\nDemain, son indemnisation serait plafonnée et limitée à six mois.",
  );

  it("accepte des morceaux recopiés mot pour mot, dans l'ordre, reliés par des points de suspension", () => {
    const r = localiserExtrait(D, "Sophie, 42 ans, gagne 2 700 euros bruts par mois... Demain, son indemnisation serait plafonnée et limitée à six mois.");
    expect(r.trouve).toBe(true);
    expect(r.page).toBe(4); // page du premier morceau
    expect(D.texte.slice(r.debut, r.fin)).toContain("plafonnée et limitée");
  });

  it("accepte aussi le caractère « … » et des coupes en début ou en fin d'extrait", () => {
    expect(localiserExtrait(D, "… elle perçoit environ 1 400 euros par mois … Demain, son indemnisation serait plafonnée …").trouve).toBe(true);
  });

  it("refuse des morceaux dans le désordre : ce serait reconstituer une phrase que le document ne dit pas", () => {
    expect(localiserExtrait(D, "Demain, son indemnisation serait plafonnée et limitée... Sophie, 42 ans, gagne 2 700 euros bruts").trouve).toBe(false);
  });

  it("refuse si un seul morceau est absent du document", () => {
    expect(localiserExtrait(D, "Sophie, 42 ans, gagne 2 700 euros bruts par mois... Elle percevrait ensuite un revenu universel garanti").trouve).toBe(false);
  });

  it("refuse des morceaux trop éloignés l'un de l'autre : la coupe ne doit pas relier des passages sans rapport", () => {
    const loin = doc("loin", `Premier passage assez long pour être cité. ${"remplissage ".repeat(400)} Second passage assez long pour être cité.`);
    expect(localiserExtrait(loin, "Premier passage assez long pour être cité... Second passage assez long pour être cité.").trouve).toBe(false);
  });

  it("refuse un extrait dont la somme des morceaux est trop courte : il trouverait toujours une correspondance", () => {
    expect(localiserExtrait(D, "Sophie, 42... mois.").trouve).toBe(false); // 8 + 4 caractères normalisés : trop peu
    expect(localiserExtrait(D, "gagne... elle").trouve).toBe(false);
  });
});
