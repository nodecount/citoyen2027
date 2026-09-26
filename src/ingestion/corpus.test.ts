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
    const corpus = construireCorpus([doc("a", "x".repeat(3600)), doc("b", "y".repeat(7200))]);
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
