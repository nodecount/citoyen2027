import { describe, expect, it } from "vitest";
import { articleDuScrutin, decouperArticles, htmlEnTexte, numeroArticle } from "./texte";

describe("htmlEnTexte", () => {
  it("retire balises, styles et entités sans toucher au texte", () => {
    const html = `<html><head><style>p{}</style></head><body><p>Article&nbsp;1er</p><p>Il est &laquo; ajouté &raquo; l&#39;article L. 1.</p></body></html>`;
    expect(htmlEnTexte(html)).toBe("Article 1er\nIl est « ajouté » l'article L. 1.");
  });
});

describe("numeroArticle", () => {
  it("normalise premier / 1er / suffixes", () => {
    expect(numeroArticle("1er")).toBe("1");
    expect(numeroArticle("premier")).toBe("1");
    expect(numeroArticle("3 BIS")).toBe("3 bis");
    expect(numeroArticle("12")).toBe("12");
  });
});

describe("decouperArticles", () => {
  const texte = ["TITRE Ier", "Organisation", "Article 1er", "I. – Premier alinéa.", "II. – Second alinéa.", "Article 2", "Texte deux.", "CHAPITRE II", "Autre", "Article 2 bis", "Texte deux bis."].join("\n");
  it("range chaque article sous sa clé et coupe aux intitulés de division", () => {
    const a = decouperArticles(texte);
    expect([...a.keys()]).toEqual(["1", "2", "2 bis"]);
    expect(a.get("1")).toBe("I. – Premier alinéa.\nII. – Second alinéa.");
    expect(a.get("2")).toBe("Texte deux.");
  });
  it("garde la version la plus longue d'une clé répétée", () => {
    const a = decouperArticles(["Article 1er", "court", "Article 1er", "beaucoup plus long"].join("\n"));
    expect(a.get("1")).toBe("beaucoup plus long");
  });
});

describe("articleDuScrutin", () => {
  it("reconnaît les scrutins d'article et eux seuls", () => {
    expect(articleDuScrutin("l'article 2 de la proposition de loi visant à X.")).toBe("2");
    expect(articleDuScrutin("l'article premier de la proposition de loi visant à X.")).toBe("1");
    expect(articleDuScrutin("l'article 3 bis du projet de loi relatif à Y.")).toBe("3 bis");
    expect(articleDuScrutin("l'amendement n° 12 de M. Untel à l'article 2 de la proposition de loi")).toBeNull();
    expect(articleDuScrutin("l'ensemble de la proposition de loi visant à X.")).toBeNull();
  });
});
