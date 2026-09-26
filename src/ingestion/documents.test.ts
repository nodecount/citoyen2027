import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chargerDocument, extraireTexteHtml, extraireTextePdf, estimerJetons } from "./documents";

// Vrais petits PDF fournis par le paquet pdf-parse (licence MIT) : un PDF fabriqué à la main déclenchait
// une erreur « bad XRef entry » aléatoire dans cette vieille version de pdf.js.
const ECHANTILLON = resolve(process.cwd(), "node_modules/pdf-parse/test/data/04-valid.pdf");
const pdfReel = () => readFileSync(ECHANTILLON);
describe("extraireTexteHtml", () => {
  it("retire scripts, styles et balises, garde les retours à la ligne entre blocs, décode les entités", () => {
    const html =
      "<html><head><style>p{color:red}</style><script>var x=1;</script></head><body><h1>Titre</h1><p>Un&nbsp;texte l&rsquo;impôt &amp; taxes</p><ul><li>Un</li><li>Deux</li></ul></body></html>";
    const texte = extraireTexteHtml(html);
    expect(texte).not.toMatch(/var x|color:red|<p>/);
    expect(texte).toContain("Titre\n");
    expect(texte).toContain("Un texte l'impôt & taxes");
    expect(texte).toContain("Un\nDeux");
  });
});

describe("extraireTextePdf", () => {
  it("extrait le texte d'un vrai PDF avec un repère par page, pour pouvoir citer « page N »", async () => {
    const { texte, pages, imageSuspecte } = await extraireTextePdf(pdfReel());
    expect(pages).toBe(5);
    expect(texte).toContain("[[page 1]]");
    expect(texte).toContain("[[page 5]]");
    expect(texte).toContain("Turk J Med Sci");
    expect(texte.indexOf("[[page 1]]")).toBeLessThan(texte.indexOf("[[page 2]]"));
    expect(imageSuspecte).toBe(false);
  });

  it("signale un PDF quasi sans texte (image scannée) comme suspect", async () => {
    const analyseurVide = async () => ({ numpages: 4, text: "\n[[page 1]]\nx\n[[page 2]]\ny" });
    expect((await extraireTextePdf(Buffer.from("%PDF-"), analyseurVide)).imageSuspecte).toBe(true);
  });

  it("ne signale pas un PDF qui contient du vrai texte", async () => {
    const texte = "Le programme prévoit une baisse des impôts de production. ".repeat(20);
    const analyseur = async () => ({ numpages: 2, text: `[[page 1]]\n${texte}[[page 2]]\n${texte}` });
    expect((await extraireTextePdf(Buffer.from("%PDF-"), analyseur)).imageSuspecte).toBe(false);
  });
});
describe("estimerJetons", () => {
  it("compte environ un jeton pour 2,2 caractères, valeur mesurée sur de vrais PDF de programme (2,16)", () => {
    expect(estimerJetons("a".repeat(2200))).toBe(1000);
    expect(estimerJetons("")).toBe(0);
  });

  it("ne sous-estime pas le cas mesuré : ~99 800 caractères valaient 46 214 jetons", () => {
    expect(estimerJetons("a".repeat(99_800))).toBeGreaterThanOrEqual(46_214 * 0.95);
  });
});

describe("chargerDocument", () => {
  let cache: string;
  afterEach(() => rmSync(cache, { recursive: true, force: true }));
  const doc = { id: "d1", url: "https://exemple-officiel.fr/programme", nom: "exemple-officiel.fr", annee: 2026 };
  const reponseHtml = () =>
    new Response("<p>Le programme prévoit une mesure.</p>", { status: 200, headers: { "content-type": "text/html" } });

  it("récupère, extrait, puis relit le cache disque sans refaire la requête", async () => {
    cache = mkdtempSync(resolve(tmpdir(), "cache-src-"));
    const fetchImpl = vi.fn(async () => reponseHtml());
    const a = await chargerDocument(doc, { fetchImpl, dossierCache: cache });
    const b = await chargerDocument(doc, { fetchImpl, dossierCache: cache });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.texte).toContain("Le programme prévoit une mesure.");
    expect(b.texte).toBe(a.texte);
    expect(b).toMatchObject({ id: "d1", nom: "exemple-officiel.fr", annee: 2026, type: "html" });
  });

  it("refait la requête quand on demande d'actualiser", async () => {
    cache = mkdtempSync(resolve(tmpdir(), "cache-src-"));
    const fetchImpl = vi.fn(async () => reponseHtml());
    await chargerDocument(doc, { fetchImpl, dossierCache: cache });
    await chargerDocument(doc, { fetchImpl, dossierCache: cache, actualiser: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reconnaît un PDF à ses octets même si le type annoncé est faux", async () => {
    cache = mkdtempSync(resolve(tmpdir(), "cache-src-"));
    const fetchImpl = async () => new Response(new Uint8Array(pdfReel()), { status: 200, headers: { "content-type": "text/html" } });
    const d = await chargerDocument(doc, { fetchImpl, dossierCache: cache });
    expect(d.type).toBe("pdf");
    expect(d.texte).toContain("[[page 1]]");
  });

  it("lève une erreur claire pour une page introuvable ou un document trop lourd", async () => {
    cache = mkdtempSync(resolve(tmpdir(), "cache-src-"));
    await expect(
      chargerDocument(doc, { fetchImpl: async () => new Response("", { status: 404 }), dossierCache: cache }),
    ).rejects.toThrow("404");
    await expect(
      chargerDocument(doc, {
        fetchImpl: async () => new Response("x", { status: 200, headers: { "content-length": String(200e6) } }),
        dossierCache: cache,
      }),
    ).rejects.toThrow("volumineux");
  });

  it("refuse un PDF image : mieux vaut aucun texte qu'un texte vide présenté comme un document", async () => {
    cache = mkdtempSync(resolve(tmpdir(), "cache-src-"));
    const fetchImpl = async () => new Response(new Uint8Array(pdfReel()), { status: 200, headers: { "content-type": "application/pdf" } });
    const extracteurPdf = async () => ({ texte: "x", pages: 3, imageSuspecte: true });
    await expect(chargerDocument(doc, { fetchImpl, dossierCache: cache, extracteurPdf })).rejects.toThrow("OCR");
  });
});
