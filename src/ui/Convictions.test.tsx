import { SUJETS_CONVICTION } from "../positions";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Integrite } from "../data/integrite";
import type { Theme } from "../types";
import { construireCards } from "./cards";
import { BlocConvictions, convictionsVisibles, integritesVisibles, PanneauConvictions } from "./Convictions";
import { CONVICTIONS_VIDES } from "./memoireConvictions";
import { VueThemes } from "./VueThemes";
import { PropositionsBase } from "./PropositionsContexte";
import { construireQuestionnaire } from "../questionnaire";
import { champsDeBase } from "../schemaBase";
const CHAMPS_PROFIL = champsDeBase("officielle");

const prop = (positions: NonNullable<Proposition["positions"]> = [{ sujet: "nucleaire", position: "garder_nucleaire", source_url: "https://exemple.fr/a", extrait: "extrait-de-test suffisamment long" }]): Proposition => ({ id: "a", candidat: "x", theme: "fiscalite", titre: "titre-mesure", resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-29", positions });
const src = { type: "primaire" as const, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/decision-x" };
const RECENSEE: ConstatIntegrite = { etat: "recensee", verifieLe: "2026-09-29", condamnations: [{ nature: "nature-x", juridiction: "juridiction-x", date_decision: "2025-06-10", peine: "peine-x", sources: [src, { ...src, type: "secondaire", url: "https://presse.fr/y" }] }] };
const AUCUNE: ConstatIntegrite = { etat: "aucune_recensee", verifieLe: "2026-09-29", sources: [src] };
const NUCLEAIRE = { nucleaire: "garder_nucleaire" };

const rendre = (c: Parameters<typeof PanneauConvictions>[0]) => renderToStaticMarkup(<PanneauConvictions {...c} />);

describe("BlocConvictions, un sujet à la fois", () => {
  it("par défaut : un seul sujet à l'écran, « Question 1 sur N », sans la grille ni l'interrupteur des manquantes", () => {
    const html = renderToStaticMarkup(<BlocConvictions convictions={CONVICTIONS_VIDES} onChange={() => {}} />);
    expect(html).toMatch(/Question 1 sur \d+/);
    expect(html).not.toContain("<select");
    expect(html).not.toMatch(/<label class="interrupteur">/);
    expect(html).toContain("Voir tous les sujets d&#x27;un coup");
  });
});

describe("BlocConvictions", () => {
  it("propose tous les sujets du catalogue, chacun avec « Pas d'avis » et ses positions, et l'exemplarité en interrupteur", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={CONVICTIONS_VIDES} onChange={() => {}} />);
    expect(html).toContain("Mes convictions");
    for (const t of ["Nucléaire", "Énergies renouvelables et transition écologique", "Sortir du nucléaire", "Garder et développer le nucléaire", "Intelligence artificielle", "Encourager davantage l&#x27;IA", "Encadrer et limiter l&#x27;IA", "Europe", "Immigration", "Fiscalité et dépense publique", "Sécurité et justice", "Travail et retraites", "Libertés et société"]) expect(html, t).toContain(t);
    expect((html.match(/Pas d&#x27;avis<\/option>/g) ?? []).length).toBe(SUJETS_CONVICTION.length);
    expect(html).toContain('role="switch"');
    expect(html).toContain("sans condamnation");
  });
  it("ne cible plus de groupe précis (âge, statut, territoire) : uniquement des sujets", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={CONVICTIONS_VIDES} onChange={() => {}} />);
    for (const t of ["Retraité(e)", "Propriétaire", "Moins de 30 ans", "Situation professionnelle"]) expect(html, t).not.toContain(t);
    expect(html).not.toContain('type="checkbox" checked');
  });
  it("présélectionne exactement ce que le visiteur a choisi et compte les positions", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: { ia: "encadrer_ia" }, exemplarite: false }} onChange={() => {}} />);
    expect(html).toMatch(/<option value="encadrer_ia" selected="">/);
    expect((html.match(/selected=""/g) ?? []).length).toBe(SUJETS_CONVICTION.length); // 1 choix + les sept autres sujets, restés sur « Pas d'avis »
    expect(html).toContain(`1 conviction complétée sur ${SUJETS_CONVICTION.length}`);
  });
  it("le panneau de progression est au-dessus des cartes : % des positions, interrupteur des manquantes (actif au départ), pas de bouton", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: { ia: "encadrer_ia" }, exemplarite: false }} onChange={() => {}} />);
    expect(html).toContain(`${Math.round((1 / SUJETS_CONVICTION.length) * 100)} %`);
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="\d+"/);
    expect(html).toMatch(/<input type="checkbox" role="switch" checked=""[^>]*\/><span class="interrupteur-piste"[^>]*><\/span>Mettre en valeur les réponses manquantes/);
    expect(html).not.toContain("bouton-manquantes");
    // Une div à part, avant la section des cartes (et non dedans).
    expect(html.indexOf("panneau-progression")).toBeLessThan(html.indexOf('<section class="convictions'));
    expect(html.slice(html.indexOf('<section class="convictions'))).not.toContain("panneau-progression");
  });
  it("le bloc ne porte plus le bouton d'effacement (il est en bas de l'écran) ; l'indicateur d'enregistrement est hors des divs, une seule fois, sous les cartes", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: { ia: "plus_ia" }, exemplarite: false }} onChange={() => {}} />);
    expect(html).not.toContain("Effacer mes convictions");
    expect(html).not.toContain("alertdialog");
    expect(html.match(/class="rangee-enregistrement"/g)).toHaveLength(1);
    expect(html.indexOf("rangee-enregistrement")).toBeGreaterThan(html.indexOf("</section>"));
    // Rien de l'indicateur ni de l'effacement dans le panneau.
    const panneau = html.slice(html.indexOf("panneau-progression"), html.indexOf('<section class="convictions'));
    expect(panneau).not.toContain("enregistrement");
    expect(panneau).not.toContain("Effacer");
  });
  it("« sans condamnation » cochée sans position : dit qu'elle ne change rien", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: {}, exemplarite: true }} onChange={() => {}} />);
    expect(html).toContain("ne change rien");
    expect(html).toContain("au moins une position");
  });
  it("« sans condamnation » cochée avec une position : dit ce qu'elle fait (écarter), et que les faits ne s'affichent pas", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: { ia: "plus_ia" }, exemplarite: true }} onChange={() => {}} />);
    expect(html).toContain("écartés du résultat");
    expect(html).not.toContain("ne sont pas affichés");
    expect(html).not.toContain("ne change rien");
  });
  it("option décochée : aucune mention de l'option", () => {
    const html = renderToStaticMarkup(<BlocConvictions pasAPasInitial={false} convictions={{ positions: { ia: "plus_ia" }, exemplarite: false }} onChange={() => {}} />);
    expect(html).not.toContain("ne change rien");
    expect(html).not.toContain("écartés du résultat");
  });
});
describe("PanneauConvictions", () => {
  it("sans conviction : rien", () => {
    expect(rendre({ propositions: [prop()], convictions: CONVICTIONS_VIDES, integrite: null })).toBe("");
  });
  it("convictions : mot + symbole du niveau, sans score", () => {
    const html = rendre({ propositions: [prop()], convictions: { positions: NUCLEAIRE, exemplarite: false }, integrite: null });
    expect(html).toContain("proche de votre position");
    expect(html).toContain("▲");
    expect(html).not.toMatch(/score|note|classement/i);
  });
  it("une mesure pour une autre position du même sujet : opposé à la position choisie", () => {
    const html = rendre({ propositions: [prop([{ sujet: "nucleaire", position: "sortir_nucleaire", source_url: "https://exemple.fr/a", extrait: "extrait-de-test suffisamment long" }])], convictions: { positions: NUCLEAIRE, exemplarite: false }, integrite: null });
    expect(html).toContain("opposé à votre position");
    expect(html).toContain("▼");
  });
  it("un constat par sujet choisi : une mesure sur l'écologie ne dit rien sur l'IA", () => {
    const html = rendre({ propositions: [prop()], convictions: { positions: { ...NUCLEAIRE, ia: "plus_ia" }, exemplarite: false }, integrite: null });
    const items = html.split("<li").filter((i) => i.includes("Nucléaire :") || i.includes("Intelligence artificielle :"));
    const nucleaire = items.find((i) => i.includes("Nucléaire :"))!;
    const ia = items.find((i) => i.includes("Intelligence artificielle :"))!;
    expect(nucleaire).toContain("proche de votre position");
    expect(ia).toContain("pas de mesure sur ce sujet");
    expect(ia).not.toContain("proche de votre position");
  });
  it("explique le constat : mesure, position défendue et extrait de source", () => {
    const html = rendre({ propositions: [prop()], convictions: { positions: NUCLEAIRE, exemplarite: false }, integrite: null });
    expect(html).toContain("Pourquoi");
    expect(html).toContain("titre-mesure");
    expect(html).toContain("Garder et développer le nucléaire");
    expect(html).toContain("extrait-de-test suffisamment long");
  });
  it("candidat sans mesure étiquetée : pas de mesure sur ce sujet, jamais « opposé »", () => {
    const html = rendre({ propositions: [prop([])], convictions: { positions: NUCLEAIRE, exemplarite: false }, integrite: null });
    expect(html).toContain("pas de mesure sur ce sujet");
    expect(html).not.toContain("opposé");
  });  it("intégrité recensée : nature, juridiction, date et liens vers les sources", () => {
    const html = rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: RECENSEE });
    for (const t of ["nature-x", "juridiction-x", "10 juin 2025", "https://www.legifrance.gouv.fr/decision-x", "https://presse.fr/y"]) expect(html).toContain(t);
  });
  it("aucune condamnation recensée : datée et attribuée aux sources consultées", () => {
    const html = rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: AUCUNE });
    expect(html).toContain("29 septembre 2026");
    expect(html).toContain("d&#x27;après les sources consultées");
  });
  it("non vérifié : ne dit jamais « aucune condamnation », et n'accole pas de jugement au nom", () => {
    const html = rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: { etat: "non_verifie" } });
    expect(html).toContain("non vérifiées par cet outil");
    expect(html).not.toMatch(/aucune condamnation/i);
    expect(html).not.toContain("Intégrité");
  });
  it("dates en clair et libellé au pluriel quand il y a plusieurs condamnations", () => {
    const deux: ConstatIntegrite = { ...RECENSEE, condamnations: [RECENSEE.condamnations[0], { ...RECENSEE.condamnations[0], nature: "nature-y" }] } as ConstatIntegrite;
    const html = rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: deux });
    expect(html).toContain("Condamnations recensées");
    expect(html).toContain("10 juin 2025");
    expect(html).not.toContain("2025-06-10");
    expect(html).toContain("29 septembre 2026");
    expect(rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: RECENSEE })).toContain("Condamnation recensée");
  });
  it("aucune condamnation recensée : date en clair aussi", () => {
    expect(rendre({ propositions: [], convictions: { positions: {}, exemplarite: true }, integrite: AUCUNE })).toContain("29 septembre 2026");
  });
  it("intégrité masquée (integrite null, mode aveugle) : aucun fait rendu", () => {
    const html = rendre({ propositions: [prop()], convictions: { positions: NUCLEAIRE, exemplarite: true }, integrite: null });
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
    const enregistrees = { positions: { ia: "plus_ia" }, exemplarite: true };
    expect(convictionsVisibles(false, enregistrees)).toEqual(CONVICTIONS_VIDES);
    expect(convictionsVisibles(true, enregistrees)).toEqual(enregistrees);
  });
});

describe("détail d'un candidat ouvert", () => {
  const THEMES: Theme[] = [{ id: "fiscalite", libelle: "Mes impôts", question_citoyen: "Combien ?", description: "d", statut: "populated" }];
  const candidat: CandidatCharge = {
    meta: { slug: "a", nom: "Nom a", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-29" },
    propositions: [prop()],
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

  it("affiche le panneau : convictions et intégrité, quand les deux sont fournis", () => {
    const html = detail({ positions: NUCLEAIRE, exemplarite: true }, { a: { etat: "non_verifie" } });
    expect(html).toContain('aria-label="Convictions"');
    expect(html).toContain("proche de votre position");
    expect(html).toContain("non vérifiées par cet outil");
  });
  it("integrites null (aveugle, exploration, option désactivée) : aucun fait d'intégrité, même avec l'option cochée", () => {
    const html = detail({ positions: NUCLEAIRE, exemplarite: true }, null);
    expect(html).toContain("proche de votre position");
    expect(html).not.toMatch(/condamnation/i);
  });
  it("convictions vides (exploration) : pas de panneau du tout", () => {
    expect(detail(CONVICTIONS_VIDES, null)).not.toContain('aria-label="Convictions"');
  });
});

describe("compteur de mesures sous la position choisie", () => {
  const etiquette = (sujet: string, position: string) => ({ sujet, position, source_url: "https://exemple.fr/a", extrait: "extrait-de-test suffisamment long" });
  const avec = (positions: Record<string, string>) =>
    renderToStaticMarkup(
      <PropositionsBase.Provider value={[prop([etiquette("immigration", "restriction")]), { ...prop([etiquette("immigration", "restriction")]), id: "b" }]}>
        <BlocConvictions pasAPasInitial={false} convictions={{ positions, exemplarite: false }} onChange={() => {}} />
      </PropositionsBase.Provider>,
    );
  it("rien sous « Pas d'avis »", () => {
    expect(avec({})).not.toContain("question-impact");
  });
  it("sous la position choisie : le nombre de mesures qui la défendent", () => {
    expect(avec({ immigration: "restriction" })).toContain("2 mesures des programmes défendent cette position.");
  });
  it("zéro mesure : le dit clairement", () => {
    expect(avec({ immigration: "ouverture" })).toContain("Aucune mesure des programmes ne défend cette position.");
  });
});