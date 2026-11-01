import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChampProfil } from "../types";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { PropositionsBase } from "./PropositionsContexte";
import { ChampQuestion, SectionQuestions } from "./Questions";

const ENUM: ChampProfil = { id: "logement", label: "Statut de votre résidence principale", type: "enum", options: ["locataire", "proprietaire"], libelles: { locataire: "Locataire", proprietaire: "Propriétaire" }, finalite: "Locataires et propriétaires ne sont pas concernés pareil." };
const MULTI: ChampProfil = { id: "aides", label: "Aides perçues", type: "multi", options: ["rsa", "apl"], libelles: { rsa: "RSA", apl: "Aide au logement" } };
const NOMBRE: ChampProfil = { id: "nombre_enfants", label: "Enfants", type: "number" };
const SENSIBLE: ChampProfil = { id: "nationalite", label: "Votre nationalité", type: "enum", options: ["francaise", "hors_ue"], libelles: { francaise: "Française", hors_ue: "Hors UE" }, sensible: true, finalite: "Certaines mesures dépendent de la nationalité." };
const CONDITIONNELLE: ChampProfil = { id: "logement_social", label: "Logement social ?", type: "enum", options: ["oui", "non"], afficher_si: { champ: "logement", valeurs: ["locataire"] } };

const champ = (c: ChampProfil, profil = {}) => renderToStaticMarkup(<ChampQuestion champ={c} profil={profil} onReponse={() => {}} idPrefixe="t" />);
const section = (questions: ChampProfil[], profil = {}) => renderToStaticMarkup(<SectionQuestions questions={questions} profil={profil} onReponse={() => {}} idPrefixe="t" />);

describe("ChampQuestion", () => {
  it("propose « Je préfère ne pas répondre », sélectionné, et des libellés lisibles", () => {
    const html = champ(ENUM);
    expect(html).toMatch(/<option value="" selected="">Je préfère ne pas répondre<\/option>/);
    expect(html).toContain("Locataire");
    expect(html).not.toContain(">locataire<");
    expect(html).not.toContain("required");
  });

  it("sélectionne la réponse déjà donnée", () => {
    expect(champ(ENUM, { logement: "proprietaire" })).toMatch(/<option value="proprietaire" selected/);
  });

  it("explique pourquoi la question est posée, et relie l'explication au champ", () => {
    const html = champ(ENUM);
    expect(html).toContain("Pourquoi cette question ?");
    expect(html).toContain("Locataires et propriétaires ne sont pas concernés pareil.");
    expect(html).toContain('aria-describedby="t-logement-finalite"');
  });

  it("affiche une question à choix multiples en cases à cocher, sans rien de coché au départ", () => {
    const html = champ(MULTI);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('class="select-multiple-bouton select-multiple-bouton--vide"'); // liste déroulante : « Je préfère ne pas répondre » au départ
    expect(html).toContain('aria-expanded="false"'); // fermée : les cases sont dans la page mais masquées
    expect(html).toContain("Aides perçues");
    expect(html).not.toContain("checked");
    expect(champ(MULTI, { aides: ["rsa"] })).toMatch(/checked=""[^>]*\/>RSA/);
  });

  it("affiche un nombre sans valeur par défaut (« 0 enfant » est une réponse, pas un défaut)", () => {
    const html = champ(NOMBRE);
    expect(html).toContain('type="number"');
    expect(html).toContain('value=""');
    expect(champ(NOMBRE, { nombre_enfants: 0 })).toContain('value="0"');
  });
});

describe("SectionQuestions", () => {
  it("n'affiche pas une question conditionnelle tant que sa condition n'est pas remplie", () => {
    expect(section([ENUM, CONDITIONNELLE])).not.toContain("Logement social ?");
    expect(section([ENUM, CONDITIONNELLE], { logement: "proprietaire" })).not.toContain("Logement social ?");
    expect(section([ENUM, CONDITIONNELLE], { logement: "locataire" })).toContain("Logement social ?");
  });

  it("pose les questions sensibles au même niveau que les autres, sans case d'accord ni bloc à part", () => {
    const html = section([ENUM, SENSIBLE]);
    expect(html).not.toContain("J&#x27;accepte");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("sensibles");
    expect(html).toContain("Votre nationalité");
    expect(html).toContain("Certaines mesures dépendent de la nationalité."); // la finalité reste affichée
    expect(html).toMatch(/<option value="" selected="">Je préfère ne pas répondre<\/option>/); // rien de présélectionné
  });

  it("n'affiche pas de bloc sensible quand la section n'en contient pas", () => {
    expect(section([ENUM])).not.toContain("plus sensibles");
  });
});

describe("PageQuestionsGenerales", () => {
  const rendre = (profil = {}) =>
    renderToStaticMarkup(<PageQuestionsGenerales champs={[ENUM, NOMBRE]} questions={[ENUM, NOMBRE]} profilInitial={profil} onValider={() => {}} onAnnuler={() => {}} />);

  it("annonce que tout est facultatif, que rien n'est envoyé, et que valider fait apparaître les indicateurs", () => {
    const html = rendre();
    expect(html).toContain("facultatives");
    expect(html).toContain("jamais envoyées");
    expect(html).toContain("jamais comptée");
    expect(html).toContain("les indicateurs apparaissent autour des");
    expect(html).toContain("Enregistrer et voir les indicateurs");
    expect(html).toContain("Retour aux thèmes");
  });

  it("affiche la progression des réponses", () => {
    expect(rendre()).toContain("0 réponse sur 2 questions");
    expect(rendre({ logement: "locataire" })).toContain("1 réponse sur 2 questions");
  });

  it("formulaire intégré : un panneau au-dessus des questions avec le %, « N questions répondues sur M » et l'interrupteur des manquantes", () => {
    const html = renderToStaticMarkup(
      <PageQuestionsGenerales champs={[ENUM, NOMBRE]} questions={[ENUM, NOMBRE]} profilInitial={{ logement: "locataire" }} onValider={() => {}} onAnnuler={() => {}} integre pasAPasInitial={false} />,
    );
    expect(html).toContain("Complétion des réponses :");
    expect(html.indexOf("Complétion des réponses :")).toBeLessThan(html.indexOf('role="progressbar"'));
    expect(html).toContain("50 %");
    expect(html).toContain("1 question répondue sur 2");
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="50"/);
    expect(html).toMatch(/role="switch" checked=""/);
    expect(html).toContain("Mettre en valeur les réponses manquantes");
    expect(html).not.toContain("bouton-manquantes");
    expect(html).not.toContain("<h2>Ma situation</h2>");
    // Une div à part, AVANT la div des questions (et non dedans).
    expect(html.indexOf("panneau-progression")).toBeLessThan(html.indexOf("<form"));
    expect(html.indexOf("<form")).toBeLessThan(html.indexOf("</form>"));
    expect(html.slice(html.indexOf("<form"))).not.toContain("panneau-progression");
    // L'indicateur d'enregistrement est hors des divs, une seule fois, sous le formulaire.
    expect(html.match(/class="rangee-enregistrement"/g)).toHaveLength(1);
    expect(html.indexOf("rangee-enregistrement")).toBeGreaterThan(html.indexOf("</form>"));
  });

  it("formulaire intégré, une question à la fois : la progression reste en haut, sans l'interrupteur des manquantes", () => {
    const html = renderToStaticMarkup(
      <PageQuestionsGenerales champs={[ENUM, NOMBRE]} questions={[ENUM, NOMBRE]} profilInitial={{}} onValider={() => {}} onAnnuler={() => {}} integre />,
    );
    expect(html).toContain("Question 1 sur 2");
    expect(html).toContain("panneau-progression");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Mettre en valeur les réponses manquantes\n");
    expect(html).not.toMatch(/<label class="interrupteur">/);
  });

  it("ne rend aucune question obligatoire", () => {
    expect(rendre()).not.toContain("required");
  });
});

describe("compteur de mesures sous la réponse", () => {
  const mesure = {
    id: "m1",
    candidat: "x",
    theme: "logement",
    titre: "Mesure",
    resume_factuel: "",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet" as const,
    date_derniere_verification: "2026-10-05",
    effets: [{ cibles: [{ champ: "logement", valeurs: ["locataire"] }], dimension: "revenu_disponible" as const, sens: "hausse" as const, source_url: "u", extrait: "extrait de test suffisamment long" }],
  };
  const avecMesures = (profil: object) =>
    renderToStaticMarkup(
      <PropositionsBase.Provider value={[mesure, { ...mesure, id: "m2" }]}>
        <ChampQuestion champ={ENUM} profil={profil} onReponse={() => {}} idPrefixe="t" />
      </PropositionsBase.Provider>,
    );

  it("n'affiche rien tant que la question n'a pas de réponse", () => {
    expect(avecMesures({})).not.toContain("question-impact");
  });
  it("une fois répondue : le nombre de mesures concernées, sous la réponse", () => {
    const html = avecMesures({ logement: "locataire" });
    expect(html).toContain("2 mesures des programmes concernent cette réponse.");
    expect(html.indexOf("</select>")).toBeLessThan(html.indexOf("question-impact"));
  });
  it("dit clairement quand aucune mesure ne concerne la réponse", () => {
    expect(avecMesures({ logement: "proprietaire" })).toContain("Aucune mesure des programmes ne concerne cette réponse.");
  });
  it("sans fournisseur de mesures (hors page du simulateur) : pas de compteur", () => {
    expect(champ(ENUM, { logement: "locataire" })).not.toContain("question-impact");
  });
});