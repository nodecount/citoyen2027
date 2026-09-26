import { describe, expect, it } from "vitest";
import { convertirIfrap, lignesDeHtml, nomComplet, slugifier, titreDe, type DonneesIfrap } from "./ifrap";

describe("slugifier", () => {
  it("donne les identifiants des dossiers existants : minuscules, sans accent, tirets", () => {
    expect(slugifier("Mélenchon ")).toBe("melenchon");
    expect(slugifier("Le Pen")).toBe("le-pen");
    expect(slugifier("Dupont-Aignan")).toBe("dupont-aignan");
  });
});

describe("lignesDeHtml", () => {
  it("retire les balises et les espaces insécables, une ligne par paragraphe", () => {
    expect(lignesDeHtml("<p>Baisser les impôts.&nbsp;</p><p>Économies&nbsp;: 3 Md€.</p>")).toEqual(["Baisser les impôts.", "Économies : 3 Md€."]);
  });

  it("garde le contenu des balises de mise en forme et remplace les sauts de ligne par une espace", () => {
    expect(lignesDeHtml("<p>Abaisse<strong>r </strong>de 75 % à 50 %.<br>&nbsp;</p>")).toEqual(["Abaisser de 75 % à 50 %."]);
  });

  it("transforme les listes en lignes à puces", () => {
    expect(lignesDeHtml('<p>Réformer :&nbsp;</p><ul><li data-x="1">supprimer A,&nbsp;</li><li>supprimer B.</li></ul>')).toEqual([
      "Réformer :",
      "• supprimer A,",
      "• supprimer B.",
    ]);
  });

  it("décode les entités courantes, numériques comprises, et laisse les inconnues telles quelles", () => {
    expect(lignesDeHtml("<p>L&#039;État &amp; l&rsquo;Europe &#x20AC; &inconnue;</p>")).toEqual(["L'État & l’Europe € &inconnue;"]);
  });

  it("ne renvoie aucune ligne pour un texte vide", () => {
    expect(lignesDeHtml("<p>&nbsp;</p>")).toEqual([]);
  });
});

describe("titreDe", () => {
  it("garde tel quel un titre court", () => {
    expect(titreDe("Supprimer la taxe X.")).toBe("Supprimer la taxe X.");
  });

  it("coupe un titre trop long à un mot entier et le signale par « … »", () => {
    const long = "mot ".repeat(80).trim();
    const titre = titreDe(long);
    expect(titre.length).toBeLessThanOrEqual(161);
    expect(titre.endsWith("…")).toBe(true);
    expect(titre.slice(0, -1).endsWith("mo")).toBe(false);
  });
});

function candidatSource(id: string, prenom: string, nom: string, parti = "") {
  return { id, first_name: prenom, last_name: nom, political_party: parti };
}

const DONNEES: DonneesIfrap = {
  candidates: [candidatSource("1", "Marine ", "Le Pen ", "RN "), candidatSource("2", "Gabriel", "Attal", ""), candidatSource("3", "Nathalie ", "Arthaud ", "LO")],
  content: [
    {
      id: "636",
      name: "Finances publiques",
      items: [
        {
          id: "637",
          name: "Fiscalité",
          items: [
            { id: "1", content: { proposals: [{ text: "<p>Supprimer la taxe A.&nbsp;</p>", old_text: "" }, { text: "<p>Créer la taxe B.</p><p>Effort&nbsp;: 1 Md€.</p>" }] } },
            { id: "2", content: { proposals: null } },
            { id: "3", content: { proposals: [] } },
          ],
        },
      ],
    },
    {
      id: "700",
      name: "Défense",
      items: [{ id: "701", name: "Défense & armées", items: [{ id: "1", content: { proposals: [{ text: "<p>Réarmer.</p>" }] } }] }],
    },
  ],
};

describe("convertirIfrap", () => {
  const { candidats, rapport } = convertirIfrap(DONNEES, "2026-09-26");
  const lePen = candidats.find((c) => c.meta.slug === "le-pen")!;

  it("crée un candidat par entrée de la source, rangés par slug, avec nom et parti nettoyés", () => {
    expect(candidats.map((c) => c.meta.slug)).toEqual(["arthaud", "attal", "le-pen"]);
    expect(nomComplet(DONNEES.candidates[0])).toBe("Marine Le Pen");
    expect(lePen.meta).toMatchObject({ nom: "Marine Le Pen", parti: "RN", date_derniere_maj: "2026-09-26" });
    expect(candidats.find((c) => c.meta.slug === "attal")!.meta.parti).toBe("non renseigné par la source");
  });

  it("reprend chaque proposition dans le thème de la source, avec son identifiant, sa rubrique et son texte", () => {
    expect(lePen.propositions.map((p) => p.id)).toEqual(["le-pen-finances-publiques-001", "le-pen-finances-publiques-002", "le-pen-defense-001"]);
    const [premiere, deuxieme] = lePen.propositions;
    expect(premiere).toMatchObject({ theme: "finances-publiques", titre: "Supprimer la taxe A.", resume_factuel: "Supprimer la taxe A.", sous_theme: "Fiscalité", candidat: "le-pen" });
    expect(deuxieme.titre).toBe("Créer la taxe B.");
    expect(deuxieme.resume_factuel).toBe("Créer la taxe B. Effort : 1 Md€.");
  });

  it("marque toute proposition comme reprise d'une source secondaire, sans effets ni calcul", () => {
    for (const p of lePen.propositions) {
      expect(p.statut).toBe("partiel");
      expect(p.effets).toBeUndefined();
      expect(p.chiffrage_disponible).toBe(false);
      expect(p.hypotheses_calcul).toContain("sans vérification");
      expect(p.sources).toHaveLength(1);
      expect(p.sources[0]).toMatchObject({ type: "secondaire", nom: "Fondation iFRAP", annee: 2026, url: "https://www.ifrap.org/comparateurs/presidentielles-2027" });
    }
  });

  it("garde les candidats sans proposition (listés, jamais omis) et le dit dans le rapport", () => {
    expect(candidats.find((c) => c.meta.slug === "attal")!.propositions).toEqual([]);
    expect(rapport.sansProposition).toEqual(["Nathalie Arthaud", "Gabriel Attal"]);
    expect(rapport).toMatchObject({ candidats: 3, propositions: 3 });
    expect(rapport.parCandidat.find((c) => c.slug === "le-pen")).toMatchObject({ propositions: 3, themes: 2 });
  });

  it("échoue clairement sur un thème que nos référentiels ne connaissent pas", () => {
    const inconnu: DonneesIfrap = { ...DONNEES, content: [{ id: "9", name: "Espace", items: [] }] };
    expect(() => convertirIfrap(inconnu, "2026-09-26")).toThrow("Thème inconnu");
  });

  it("échoue clairement sur un candidat absent de la liste, plutôt que de perdre ses propositions", () => {
    const orphelin: DonneesIfrap = {
      ...DONNEES,
      content: [{ id: "636", name: "Finances publiques", items: [{ id: "1", name: "X", items: [{ id: "99", content: { proposals: [{ text: "<p>Y</p>" }] } }] }] }],
    };
    expect(() => convertirIfrap(orphelin, "2026-09-26")).toThrow("Candidat inconnu");
  });

  it("échoue si deux candidats donneraient le même dossier", () => {
    const doublon: DonneesIfrap = { ...DONNEES, candidates: [candidatSource("1", "A", "Martin"), candidatSource("2", "B", "Martin")] };
    expect(() => convertirIfrap(doublon, "2026-09-26")).toThrow("même identifiant");
  });
});
