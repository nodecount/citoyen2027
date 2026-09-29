import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { BlocConvictions, PanneauConvictions } from "./Convictions";
import { CONVICTIONS_VIDES } from "./memoireConvictions";

const MODESTES = [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }];
const RETRAITES = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
const effet = (cibles: Effet["cibles"] = MODESTES): Effet => ({ cibles, dimension: "revenu_disponible", sens: "hausse", source_url: "https://exemple.fr/a", extrait: "extrait-de-test suffisamment long" });
const prop = (effets: Effet[]): Proposition => ({ id: "a", candidat: "x", theme: "fiscalite", titre: "titre-mesure", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-29", effets });
const src = { type: "primaire" as const, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/decision-x" };
const RECENSEE: ConstatIntegrite = { etat: "recensee", verifieLe: "2026-09-29", condamnations: [{ nature: "nature-x", juridiction: "juridiction-x", date_decision: "2025-06-10", peine: "peine-x", sources: [src, { ...src, type: "secondaire", url: "https://presse.fr/y" }] }] };
const AUCUNE: ConstatIntegrite = { etat: "aucune_recensee", verifieLe: "2026-09-29", sources: [src] };
const FAIBLES = "tranche_revenus:moins_1200";

const rendre = (c: Parameters<typeof PanneauConvictions>[0]) => renderToStaticMarkup(<PanneauConvictions {...c} />);

describe("BlocConvictions", () => {
  it("propose les groupes par rubrique en cases à cocher et l'exemplarité en interrupteur, facultatifs", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} aveugle={false} />);
    expect(html).toContain("Mes convictions");
    for (const t of ["Situation professionnelle", "Indépendant(e)", "Retraité(e)", "Propriétaire", "Familles avec enfants à charge", "Moins de 1 200 €", "Plus de 5 000 €"]) expect(html).toContain(t);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("sans condamnation définitive");
    expect(html).toContain("gardés dans votre navigateur");
  });
  it("coche exactement ce que le visiteur a choisi", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["tranche_age:moins_30"], exemplarite: false }} onChange={() => {}} aveugle={false} />);
    const cochees = html.match(/<input[^>]*type="checkbox"[^>]*checked=""[^>]*>/g) ?? [];
    expect(cochees).toHaveLength(1);
    expect(html).toMatch(/checked=""[^>]*\/?>Moins de 30 ans/);
  });
  it("mode aveugle : dit que l'intégrité est masquée", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: [], exemplarite: true }} onChange={() => {}} aveugle={true} />);
    expect(html).toContain("masqués");
  });
});

describe("PanneauConvictions", () => {
  it("sans conviction : rien", () => {
    expect(rendre({ propositions: [prop([effet()])], convictions: CONVICTIONS_VIDES, integrite: null })).toBe("");
  });
  it("valeurs sociales : mot + symbole du niveau, sans score", () => {
    const html = rendre({ propositions: [prop([effet()])], convictions: { groupes: [FAIBLES], exemplarite: false }, integrite: null });
    expect(html).toContain("Améliorant");
    expect(html).toContain("▲");
    expect(html).not.toMatch(/score|note|classement/i);
  });
  it("un constat par groupe choisi : une mesure pour les seuls retraités n'améliore pas les faibles revenus", () => {
    const html = rendre({
      propositions: [prop([effet(RETRAITES)])],
      convictions: { groupes: ["statut_professionnel:retraite", FAIBLES], exemplarite: false },
      integrite: null,
    });
    const items = html.split("<li").filter((i) => i.includes("Retraité(e)") || i.includes("Moins de 1 200"));
    const retraites = items.find((i) => i.includes("Retraité(e)"))!;
    const faibles = items.find((i) => i.includes("Moins de 1 200"))!;
    expect(retraites).toContain("Améliorant");
    expect(faibles).toContain("pas d&#x27;indicateur");
    expect(faibles).not.toContain("Améliorant");
  });
  it("explique le constat : mesure, effet et extrait de source", () => {
    const html = rendre({ propositions: [prop([effet()])], convictions: { groupes: [FAIBLES], exemplarite: false }, integrite: null });
    expect(html).toContain("Pourquoi");
    expect(html).toContain("titre-mesure");
    expect(html).toContain("extrait-de-test suffisamment long");
  });
  it("signale les mesures au public non précisé, non comptées", () => {
    const html = rendre({ propositions: [prop([effet(), effet([{ champ: "autre", valeurs: ["mères isolées"] }])])], convictions: { groupes: [FAIBLES], exemplarite: false }, integrite: null });
    expect(html).toContain("1 mesure");
    expect(html).toContain("non comptée");
  });
  it("candidat sans effet structuré : pas d'indicateur, jamais « non concerné »", () => {
    const html = rendre({ propositions: [prop([])], convictions: { groupes: [FAIBLES], exemplarite: false }, integrite: null });
    expect(html).toContain("pas d&#x27;indicateur");
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
    const html = rendre({ propositions: [prop([effet()])], convictions: { groupes: [FAIBLES], exemplarite: true }, integrite: null });
    expect(html).not.toContain("condamnation");
  });
});
