import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { corpsDuTexteSenat, dateDuTexte, documentsAdoptesAN, lienDossierAN, lienDossierSenat, textesAdoptesSenat, trouverTexteAN, trouverTexteSenat } from "./textes-lois";
import type { ScrutinSource } from "./votes2027etmoi";

const fixture = (nom: string) => readFileSync(resolve(process.cwd(), "src/scraping/fixtures", nom), "utf-8");
const BASE = "https://www.assemblee-nationale.fr";

const scrutin: ScrutinSource = {
  id: "an-15-351",
  chambre: "AN",
  date: "2017-12-19T00:00:00+01:00",
  titre: "L'ensemble du projet de loi relatif à l'orientation et à la réussite des étudiants (première lecture).",
  type: "solennel",
  resultat: "adopté",
  url: `${BASE}/dyn/15/scrutins/351`,
  votes: {},
};

// Page d'un second texte (lecture définitive, 15 février 2018) : seule la date et un article suffisent au test.
const SECOND_TEXTE = "<html><body><p>TEXTE ADOPTÉ n° 87</p><p>15 février 2018</p><p>Article 1er</p><p>Le premier cycle est ouvert à tous les titulaires du baccalauréat.</p></body></html>";

function telechargeur(pages: Record<string, string>) {
  return async (url: string): Promise<string> => {
    const page = pages[url];
    if (page === undefined) throw new Error(`404 ${url}`);
    return page;
  };
}

const PAGES = {
  [scrutin.url]: fixture("scrutin-an-351.html"),
  [`${BASE}/dyn/15/dossiers/orientation_reussite_etudiants`]: fixture("dossier-an-orientation.html"),
  [`${BASE}/dyn/opendata/PRJLANR5L15BTA0061.html`]: fixture("texte-an-PRJLANR5L15BTA0061.html"),
  [`${BASE}/dyn/opendata/PRJLANR5L15BTA0087.html`]: SECOND_TEXTE,
};

describe("lienDossierAN", () => {
  it("lit le dossier législatif sur la page d'un scrutin de l'Assemblée", () => {
    expect(lienDossierAN(fixture("scrutin-an-351.html"), BASE)).toBe(`${BASE}/dyn/15/dossiers/orientation_reussite_etudiants`);
  });

  it("renvoie null quand la page ne mène à aucun dossier", () => {
    expect(lienDossierAN("<html><body>Rien ici</body></html>", BASE)).toBeNull();
  });
});

describe("documentsAdoptesAN", () => {
  it("liste, dans l'ordre et sans doublon, les textes adoptés en séance du dossier", () => {
    expect(documentsAdoptesAN(fixture("dossier-an-orientation.html"))).toEqual(["PRJLANR5L15BTA0061", "PRJLANR5L15BTA0087"]);
  });

  it("n'y mêle ni le projet déposé ni le texte de commission", () => {
    const ids = documentsAdoptesAN(fixture("dossier-an-orientation.html"));
    expect(ids.some((id) => id.includes("B0391") || id.includes("BTC"))).toBe(false);
  });
});

describe("dateDuTexte", () => {
  it("lit la date d'adoption en tête du texte", () => {
    expect(dateDuTexte(fixture("texte-an-PRJLANR5L15BTA0061.html"))).toBe("2017-12-19");
    expect(dateDuTexte(SECOND_TEXTE)).toBe("2018-02-15");
  });

  it("renvoie null sans date lisible", () => {
    expect(dateDuTexte("<p>Article 1er</p>")).toBeNull();
  });
});

describe("trouverTexteAN", () => {
  it("prend le premier texte adopté à la date du scrutin ou après", async () => {
    const t = await trouverTexteAN(scrutin, telechargeur(PAGES));
    expect(t).not.toBeNull();
    expect(t!.texte).toContain("Article 1");
    expect(t!.libelle).toBe("T.A. n° 61");
    expect(t!.url).toBe(`${BASE}/dyn/15/textes/l15t0061_texte-adopte-seance`);
  });

  it("prend le texte suivant quand le scrutin est postérieur au premier", async () => {
    const t = await trouverTexteAN({ ...scrutin, date: "2018-01-10T00:00:00+01:00" }, telechargeur(PAGES));
    expect(t!.libelle).toBe("T.A. n° 87");
    expect(t!.texte).toContain("baccalauréat");
  });

  it("renvoie null, sans lever, quand une page est introuvable ou qu'il n'y a pas de dossier", async () => {
    expect(await trouverTexteAN(scrutin, telechargeur({}))).toBeNull();
    expect(await trouverTexteAN(scrutin, telechargeur({ [scrutin.url]: "<html></html>" }))).toBeNull();
    expect(await trouverTexteAN(scrutin, telechargeur({ ...PAGES, [`${BASE}/dyn/opendata/PRJLANR5L15BTA0061.html`]: "<html>", [`${BASE}/dyn/opendata/PRJLANR5L15BTA0087.html`]: "<html>" }))).toBeNull();
  });
});

// ─── Sénat ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SENAT = "https://www.senat.fr";
const scrutinSenat: ScrutinSource = {
  id: "senat-2025-340",
  chambre: "SENAT",
  date: "2026-07-21",
  titre: "Sur l'ensemble du projet de loi d'urgence pour la protection et la souveraineté agricoles",
  type: "ensemble",
  resultat: "adopté",
  url: `${SENAT}/scrutin-public/2025/scr2025-340.html`,
  votes: {},
};
const TEXTE_152 = "<html><body><p>Article 1er</p><p>Texte modifié par le Sénat le 2 juillet 2026.</p></body></html>";
const PAGES_SENAT = {
  [scrutinSenat.url]: fixture("scrutin-senat-340.html"),
  [`${SENAT}/dossier-legislatif/pjl25-689.html`]: fixture("dossier-senat-pjl25-689.html"),
  [`${SENAT}/leg/tas25-152.html`]: TEXTE_152,
  [`${SENAT}/leg/tas25-166.html`]: fixture("texte-senat-tas25-166.html"),
};

describe("lienDossierSenat", () => {
  it("lit le dossier législatif sur la page d'un scrutin du Sénat", () => {
    expect(lienDossierSenat(fixture("scrutin-senat-340.html"), SENAT)).toBe(`${SENAT}/dossier-legislatif/pjl25-689.html`);
  });

  it("renvoie null quand la page ne mène à aucun dossier", () => {
    expect(lienDossierSenat("<html><body>Rien ici</body></html>", SENAT)).toBeNull();
  });
});

describe("textesAdoptesSenat", () => {
  it("liste, dans l'ordre, les textes adoptés du dossier avec leur numéro et leur date", () => {
    expect(textesAdoptesSenat(fixture("dossier-senat-pjl25-689.html"))).toEqual([
      { chemin: "/leg/tas25-152.html", numero: "152", date: "2026-07-02" },
      { chemin: "/leg/tas25-166.html", numero: "166", date: "2026-07-21" },
    ]);
  });
});

describe("trouverTexteSenat", () => {
  it("prend le texte adopté à la date du scrutin, pas le précédent", async () => {
    const t = await trouverTexteSenat(scrutinSenat, telechargeur(PAGES_SENAT));
    expect(t).not.toBeNull();
    expect(t!.libelle).toBe("Texte n° 166");
    expect(t!.url).toBe(`${SENAT}/leg/tas25-166.html`);
    expect(t!.texte).toContain("Article 1");
  });

  it("prend le premier texte quand le scrutin lui est antérieur ou contemporain", async () => {
    const t = await trouverTexteSenat({ ...scrutinSenat, date: "2026-07-01" }, telechargeur(PAGES_SENAT));
    expect(t!.libelle).toBe("Texte n° 152");
  });

  it("renvoie null, sans lever, sur une page introuvable ou sans lien de dossier", async () => {
    expect(await trouverTexteSenat(scrutinSenat, telechargeur({}))).toBeNull();
    expect(await trouverTexteSenat(scrutinSenat, telechargeur({ [scrutinSenat.url]: "<html></html>" }))).toBeNull();
  });
});

describe("corpsDuTexteSenat", () => {
  // Structure réelle d'une page /leg/tas… du Sénat : menu du site, volet « Autres formats », puis l'en-tête de la loi et ses articles.
  const page = [
    "Aller au contenu", "Aller à la navigation", "La galaxie Sénat", "Réseaux sociaux", "Autres formats", "En savoir plus sur le texte", "Le dossier législatif",
    "N° 166", "SÉNAT", "SESSION EXTRAORDINAIRE DE 2025-2026", "21 juillet 2026", "PROJET DE LOI", "d'urgence pour la protection et la souveraineté agricoles", "(Texte définitif)",
    "Le Sénat a adopté, dans les conditions prévues à l'article 45 de la Constitution, le projet de loi dont la teneur suit :",
    "Voir les numéros :", "Article 1er", "Le code rural est ainsi modifié.",
  ].join("\n");

  it("commence au titre de la loi : ni menu du site ni volet « autres formats »", () => {
    const corps = corpsDuTexteSenat(page);
    expect(corps.startsWith("PROJET DE LOI")).toBe(true);
    expect(corps).not.toContain("Aller au contenu");
    expect(corps).toContain("Le code rural est ainsi modifié.");
  });

  it("à défaut de formule d'adoption, commence au premier article", () => {
    expect(corpsDuTexteSenat("Menu\nAutre menu\nArticle 1er\nTexte de l'article.").startsWith("Article 1er")).toBe(true);
  });

  it("rend le texte entier quand rien ne permet de repérer le début de la loi", () => {
    expect(corpsDuTexteSenat("Un texte sans repère.")).toBe("Un texte sans repère.");
  });

  it("trouverTexteSenat n'emporte pas le menu du site", async () => {
    const html = `<html><body>${page.split("\n").map((l) => `<p>${l}</p>`).join("")}</body></html>`;
    const t = await trouverTexteSenat(scrutinSenat, telechargeur({ ...PAGES_SENAT, [`${SENAT}/leg/tas25-166.html`]: html }));
    expect(t!.texte.startsWith("PROJET DE LOI")).toBe(true);
  });
});
