import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { BlocConvictions, PanneauConvictions } from "./Convictions";
import { CONVICTIONS_VIDES } from "./memoireConvictions";

const effet: Effet = { cibles: [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }], dimension: "revenu_disponible", sens: "hausse", source_url: "https://exemple.fr/a", extrait: "extrait de test suffisamment long" };
const prop = (effets: Effet[]): Proposition => ({ id: "a", candidat: "x", theme: "fiscalite", titre: "t", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-29", effets });
const src = { type: "primaire" as const, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/decision-x" };
const RECENSEE: ConstatIntegrite = { etat: "recensee", verifieLe: "2026-09-29", condamnations: [{ nature: "nature-x", juridiction: "juridiction-x", date_decision: "2025-06-10", peine: "peine-x", sources: [src, { ...src, type: "secondaire", url: "https://presse.fr/y" }] }] };
const AUCUNE: ConstatIntegrite = { etat: "aucune_recensee", verifieLe: "2026-09-29", sources: [src] };

const rendre = (c: Parameters<typeof PanneauConvictions>[0]) => renderToStaticMarkup(<PanneauConvictions {...c} />);

describe("BlocConvictions", () => {
  it("propose les groupes en cases à cocher et l'exemplarité en interrupteur, facultatifs", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} aveugle={false} />);
    expect(html).toContain("Mes convictions");
    expect(html).toContain("Les personnes à faibles revenus");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("sans condamnation définitive");
    expect(html).toContain("gardées dans votre navigateur");
  });
  it("coche ce que le visiteur a choisi", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["jeunes"], exemplarite: false }} onChange={() => {}} aveugle={false} />);
    expect(html).toMatch(/checked[^>]*>[\s\S]*Les jeunes de moins de 30 ans/);
  });
  it("mode aveugle : dit que l'intégrité est masquée", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: [], exemplarite: true }} onChange={() => {}} aveugle={true} />);
    expect(html).toContain("masqués");
  });
});

describe("PanneauConvictions", () => {
  it("sans conviction : rien", () => {
    expect(rendre({ propositions: [prop([effet])], convictions: CONVICTIONS_VIDES, integrite: null })).toBe("");
  });
  it("valeurs sociales : mot + symbole du niveau, sans score", () => {
    const html = rendre({ propositions: [prop([effet])], convictions: { groupes: ["faibles_revenus"], exemplarite: false }, integrite: null });
    expect(html).toContain("Améliorant");
    expect(html).not.toMatch(/score|note|classement/i);
  });
  it("candidat sans effet structuré : pas d'indicateur, jamais « non concerné »", () => {
    const html = rendre({ propositions: [prop([])], convictions: { groupes: ["faibles_revenus"], exemplarite: false }, integrite: null });
    expect(html).toContain("Pas d&#x27;indicateur");
    expect(html).not.toContain("Non concerné");
  });
  it("intégrité recensée : nature, juridiction, date et liens vers les sources", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: RECENSEE });
    for (const t of ["nature-x", "juridiction-x", "2025-06-10", "https://www.legifrance.gouv.fr/decision-x", "https://presse.fr/y"]) expect(html).toContain(t);
  });
  it("aucune condamnation recensée : datée et attribuée aux sources consultées", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: AUCUNE });
    expect(html).toContain("2026-09-29");
    expect(html).toContain("d&#x27;après les sources consultées");
  });
  it("non vérifié : ne dit jamais « aucune condamnation »", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: { etat: "non_verifie" } });
    expect(html).toContain("non vérifiée");
    expect(html).not.toMatch(/aucune condamnation/i);
  });
  it("intégrité masquée (integrite null, mode aveugle) : aucun fait rendu", () => {
    const html = rendre({ propositions: [prop([effet])], convictions: { groupes: ["faibles_revenus"], exemplarite: true }, integrite: null });
    expect(html).not.toContain("condamnation");
  });
});
