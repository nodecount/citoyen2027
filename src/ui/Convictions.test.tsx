import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Integrite } from "../data/integrite";
import type { Theme } from "../types";
import { construireCards } from "./cards";
import { BlocConvictions, convictionsVisibles, integritesVisibles, PanneauConvictions } from "./Convictions";
import { CONVICTIONS_VIDES } from "./memoireConvictions";
import { VueThemes } from "./VueThemes";
import { construireQuestionnaire, CHAMPS_PROFIL } from "../questionnaire";

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
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} />);
    expect(html).toContain("Mes convictions");
    for (const t of ["Situation professionnelle", "Indépendant(e)", "Retraité(e)", "Propriétaire", "Familles avec enfants à charge", "Moins de 1 200 €", "Plus de 5 000 €"]) expect(html).toContain(t);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("sans condamnation définitive");
    expect(html).toContain("gardés dans votre navigateur");
  });
  it("coche exactement ce que le visiteur a choisi", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["tranche_age:moins_30"], exemplarite: false }} onChange={() => {}} />);
    const cochees = html.match(/<input[^>]*type="checkbox"[^>]*checked=""[^>]*>/g) ?? [];
    expect(cochees).toHaveLength(1);
    expect(html).toMatch(/checked=""[^>]*\/?>Moins de 30 ans/);
  });
  it("donne une légende propre à l'axe : mêmes niveaux que « Ma situation » mais pour les groupes choisis, sans symboles qui ne s'affichent jamais", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} />);
    expect(html).toContain("pour les groupes choisis, pas pour vous");
    for (const symbole of ["▲", "◆", "○", "▼"]) expect(html).toContain(symbole);
    // Les faits d'intégrité ne sont jamais affichés (simulateur à l'aveugle) : pas de légende pour leurs symboles.
    for (const symbole of ["■", "□", "Intégrité :"]) expect(html).not.toContain(symbole);
  });
  it("l'effacement est confirmé : la modale est fermée par défaut", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["tranche_age:moins_30"], exemplarite: false }} onChange={() => {}} />);
    expect(html).toContain("Effacer mes convictions");
    expect(html).not.toContain("alertdialog");
  });
  it("« sans condamnation définitive » cochée sans groupe : dit qu'elle ne change rien", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: [], exemplarite: true }} onChange={() => {}} />);
    expect(html).toContain("ne change rien");
    expect(html).toContain("choisi au moins un groupe");
  });
  it("« sans condamnation définitive » cochée avec un groupe : dit ce qu'elle fait (écarter), et que les faits ne s'affichent pas", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["tranche_age:moins_30"], exemplarite: true }} onChange={() => {}} />);
    expect(html).toContain("écartés du résultat");
    expect(html).toContain("ne sont pas affichés");
    expect(html).not.toContain("ne change rien");
    expect(html).not.toContain("masqués tant que"); // ancien texte, faux : le masquage n'a plus rien de temporaire
  });
  it("option décochée : aucune mention de l'option", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={{ groupes: ["tranche_age:moins_30"], exemplarite: false }} onChange={() => {}} />);
    expect(html).not.toContain("ne change rien");
    expect(html).not.toContain("écartés du résultat");
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
    for (const t of ["nature-x", "juridiction-x", "10 juin 2025", "https://www.legifrance.gouv.fr/decision-x", "https://presse.fr/y"]) expect(html).toContain(t);
  });
  it("aucune condamnation recensée : datée et attribuée aux sources consultées", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: AUCUNE });
    expect(html).toContain("29 septembre 2026");
    expect(html).toContain("d&#x27;après les sources consultées");
  });
  it("non vérifié : ne dit jamais « aucune condamnation », et n'accole pas de jugement au nom", () => {
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: { etat: "non_verifie" } });
    expect(html).toContain("non vérifiées par cet outil");
    expect(html).not.toMatch(/aucune condamnation/i);
    expect(html).not.toContain("Intégrité");
  });
  it("dates en clair et libellé au pluriel quand il y a plusieurs condamnations", () => {
    const deux: ConstatIntegrite = { ...RECENSEE, condamnations: [RECENSEE.condamnations[0], { ...RECENSEE.condamnations[0], nature: "nature-y" }] } as ConstatIntegrite;
    const html = rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: deux });
    expect(html).toContain("Condamnations définitives recensées");
    expect(html).toContain("10 juin 2025");
    expect(html).not.toContain("2025-06-10");
    expect(html).toContain("29 septembre 2026");
    expect(rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: RECENSEE })).toContain("Condamnation définitive recensée");
  });
  it("aucune condamnation recensée : date en clair aussi", () => {
    expect(rendre({ propositions: [], convictions: { groupes: [], exemplarite: true }, integrite: AUCUNE })).toContain("29 septembre 2026");
  });
  it("intégrité masquée (integrite null, mode aveugle) : aucun fait rendu", () => {
    const html = rendre({ propositions: [prop([effet()])], convictions: { groupes: [FAIBLES], exemplarite: true }, integrite: null });
    expect(html).not.toContain("condamnation");
  });
});

const INTEGRITE_AUCUNE: Integrite = { slug: "a", verifie_le: "2026-09-29", sources_consultees: [src], condamnations_definitives: [] };

describe("garde-fous d'affichage", () => {
  const base = { simulateur: true, exemplarite: true, aveugle: false, slugs: ["a", "b"], integrites: { a: INTEGRITE_AUCUNE } };

  it("simulateur, option activée, candidats visibles : un constat par candidat, « non vérifié » sans fichier", () => {
    const constats = integritesVisibles(base)!;
    expect(constats.a.etat).toBe("aucune_recensee");
    expect(constats.b.etat).toBe("non_verifie");
  });
  it.each([
    ["mode aveugle", { aveugle: true }],
    ["mode exploration", { simulateur: false }],
    ["option désactivée", { exemplarite: false }],
  ])("%s : aucun fait d'intégrité (null)", (_nom, difference) => {
    expect(integritesVisibles({ ...base, ...difference })).toBeNull();
  });
  it("exploration : les convictions enregistrées ne sont pas transmises", () => {
    const enregistrees = { groupes: ["tranche_age:moins_30"], exemplarite: true };
    expect(convictionsVisibles(false, enregistrees)).toEqual(CONVICTIONS_VIDES);
    expect(convictionsVisibles(true, enregistrees)).toEqual(enregistrees);
  });
});

describe("détail d'un candidat ouvert", () => {
  const THEMES: Theme[] = [{ id: "fiscalite", libelle: "Mes impôts", question_citoyen: "Combien ?", description: "d", statut: "populated" }];
  const candidat: CandidatCharge = {
    meta: { slug: "a", nom: "Nom a", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-29" },
    propositions: [prop([effet()])],
    syntheses: [],
  };
  const QUESTIONNAIRE = construireQuestionnaire(CHAMPS_PROFIL, {}, THEMES);
  const detail = (convictions: Parameters<typeof VueThemes>[0]["convictions"], integrites: Parameters<typeof VueThemes>[0]["integrites"]) =>
    renderToStaticMarkup(
      <VueThemes
        cards={construireCards(THEMES, [candidat], null)}
        profil={{}}
        personnalise={false}
        questionnaire={QUESTIONNAIRE}
        questionsActives={false}
        onReponse={() => {}}
        ouvertInitial={{ theme: "fiscalite", candidat: "a" }}
        convictions={convictions}
        integrites={integrites}
      />,
    );

  it("affiche le panneau : valeurs sociales et intégrité, quand les deux sont fournis", () => {
    const html = detail({ groupes: [FAIBLES], exemplarite: true }, { a: { etat: "non_verifie" } });
    expect(html).toContain('aria-label="Convictions"');
    expect(html).toContain("Améliorant");
    expect(html).toContain("non vérifiées par cet outil");
  });
  it("integrites null (aveugle, exploration, option désactivée) : aucun fait d'intégrité, même avec l'option cochée", () => {
    const html = detail({ groupes: [FAIBLES], exemplarite: true }, null);
    expect(html).toContain("Améliorant");
    expect(html).not.toMatch(/condamnation/i);
  });
  it("convictions vides (exploration) : pas de panneau du tout", () => {
    expect(detail(CONVICTIONS_VIDES, null)).not.toContain('aria-label="Convictions"');
  });
});
