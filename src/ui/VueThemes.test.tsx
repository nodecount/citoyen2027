import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Effet } from "../effets";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireQuestionnaire, CHAMPS_PROFIL, type Questionnaire } from "../questionnaire";
import type { Proposition, SyntheseTheme, Theme } from "../types";
import { construireCards } from "./cards";
import { CitationsResume, VueThemes } from "./VueThemes";

// Seulement la liste des portraits : la légende, elle, décrit les niveaux et contient leurs classes.
const portraits = (rendu: string): string => (rendu.match(/<ul class="portraits"[\s\S]*?<\/ul>/g) ?? []).join("");

const PROFIL: ProfilPartiel = {
  statut_professionnel: "salarie",
  tranche_revenus: "3000_5000",
  situation_familiale: "en_couple",
  nombre_enfants: 1,
  logement: "locataire",
  secteur_activite: "commerce",
  region: "Bretagne",
  tranche_age: "moins_30",
  tranche_patrimoine: "moins_100k",
};

const THEMES: Theme[] = [
  { id: "fiscalite", libelle: "Mes impôts et taxes", question_citoyen: "Combien vais-je payer ?", description: "d", statut: "populated" },
  { id: "retraites", libelle: "Ma retraite", question_citoyen: "À quel âge partir ?", description: "d", statut: "provisoire" },
];

const HAUSSE: Effet = { cibles: [], dimension: "revenu_disponible", sens: "hausse", source_url: "https://a.fr/p", extrait: "une aide mensuelle pour tous" };
const BAISSE: Effet = { ...HAUSSE, sens: "baisse", extrait: "une contribution sur les revenus" };

function prop(candidat: string, effets: Effet[] | undefined, theme = "fiscalite"): Proposition {
  return {
    id: `${candidat}-${theme}-001`,
    candidat,
    theme,
    titre: `Mesure de ${candidat}`,
    resume_factuel: "Résumé factuel.",
    sources: [{ type: "primaire", label: "Ancien libellé", url: `https://${candidat}.fr/p`, nom: `${candidat}.fr`, annee: 2021 }],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-24",
    effets,
  };
}

function candidat(slug: string, propositions: Proposition[], syntheses: SyntheseTheme[] = [], nom = `Nom ${slug}`, remarques: CandidatCharge["remarques"] = []): CandidatCharge {
  return { meta: { slug, nom, parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-24" }, propositions, syntheses, remarques };
}

// Questionnaire de test : « logement » sert aux deux thèmes (général) ; « vehicule » à un seul (thème fiscalité).
const QUESTIONNAIRE: Questionnaire = construireQuestionnaire(
  CHAMPS_PROFIL,
  { logement: ["fiscalite", "retraites"], vehicule: ["fiscalite"], nationalite: ["fiscalite"] },
  THEMES,
);

function html(
  candidats: CandidatCharge[],
  profil: ProfilPartiel = {},
  ouvert?: { theme: string; candidat: string; vue?: "resume" | "polarite" | "detail" },
  questionsActives = false,
): string {
  const personnalise = aDesInformations(profil);
  return renderToStaticMarkup(
    <VueThemes
      cards={construireCards(THEMES, candidats, personnalise ? profil : null)}
      profil={profil}
      personnalise={personnalise}
      questionnaire={QUESTIONNAIRE}
      questionsActives={questionsActives}
      onReponse={() => {}}
      ouvertInitial={ouvert}
    />,
  );
}

describe("page de départ : aucune information sur le visiteur", () => {
  const rendu = html([candidat("a", [prop("a", [HAUSSE])], [], "Gabriel Attal"), candidat("b", [prop("b", [BAISSE])], [], "Marine Le Pen")]);

  it("montre une card par thème, avec son libellé et la question du citoyen", () => {
    expect(rendu).toContain("Mes impôts et taxes");
    expect(rendu).toContain("Combien vais-je payer ?");
    expect(rendu).toContain("Ma retraite");
    expect(rendu).toContain('id="theme-fiscalite"');
  });

  it("montre les candidats en portraits cliquables dans le pied de carte, toujours de même taille, avec leur nombre de mesures", () => {
    expect(rendu).toMatch(/<button[^>]*class="portrait"[^>]*aria-expanded="false"/);
    expect(rendu).not.toContain("carte-pied--grand");
    expect(rendu).toContain('aria-label="Gabriel Attal : 1 mesure sur ce thème"');
    expect(rendu).toMatch(/class="infobulle infobulle--nom"[^>]*>Gabriel Attal</); // vraie infobulle, pas de title natif
    expect(rendu).not.toContain('title="Gabriel Attal"');
    expect(rendu).toContain(">MLP<"); // pas de photo pour ce slug de test : initiales
    expect(rendu).toContain('class="portrait-compte" aria-hidden="true">1<'); // comme un nombre de notifications
    expect(rendu).not.toContain("portrait-nom");
  });

  it("place les portraits en pied de carte, sous le corps qui accueillera le texte du candidat", () => {
    const carte = rendu.slice(rendu.indexOf('id="theme-fiscalite"'));
    expect(carte.indexOf('class="carte-corps"')).toBeLessThan(carte.indexOf('class="carte-pied'));
    expect(carte.indexOf('class="carte-pied')).toBeLessThan(carte.indexOf('class="portraits"'));
  });

  it("met l'icône du thème dans un médaillon, avec le nom du thème en dessous, hors du médaillon", () => {
    const entete = rendu.slice(rendu.indexOf('class="carte-entete"'), rendu.indexOf('class="carte-corps"'));
    expect(entete).toMatch(/class="medaillon"[^>]*>.*<svg[\s\S]*?<\/div><h2/);
    expect(entete).toContain("Mes impôts et taxes</h2>");
  });

  it("n'affiche aucun texte d'invitation tant que des candidats concernés existent (les portraits suffisent)", () => {
    expect(rendu).not.toContain("Cliquez sur un candidat");
    expect(rendu).not.toContain("Aucun candidat ne change votre situation");
  });

  it("n'affiche AUCUN indicateur, ni légende, ni « pas de projection » : les effets ne sont pas appliqués", () => {
    expect(rendu).not.toContain("niveau--");
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).not.toContain("Pas de projection");
    expect(rendu).not.toContain("Pas d&#x27;indicateur");
  });

  it("n'ouvre aucun détail avant le clic sur un portrait", () => {
    expect(rendu).not.toContain('role="region"');
    expect(rendu).not.toContain("Mesures (");
  });

  it("range les portraits par ordre alphabétique de slug, quel que soit l'effet de leurs mesures", () => {
    const r = html([candidat("z", [prop("z", [HAUSSE])]), candidat("b", [prop("b", [BAISSE])])]);
    expect(r.indexOf('infobulle--nom" aria-hidden="true">Nom b<')).toBeLessThan(r.indexOf('infobulle--nom" aria-hidden="true">Nom z<'));
  });

  it("résume en un seul « +X » les candidats sans mesure sur le thème, avec une vraie infobulle (pas de title natif) et sans portrait", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])]), candidat("b", [prop("b", [HAUSSE], "retraites")])]);
    const carte = r.slice(r.indexOf('id="theme-fiscalite"'), r.indexOf('id="theme-retraites"'));
    expect(carte.indexOf('>Nom a<')).toBeLessThan(carte.indexOf("portrait-plus"));
    expect(carte).toContain(">+1<");
    expect(carte).toContain('role="tooltip"');
    expect(carte).toContain("Ces candidats n&#x27;ont aucune mesure sur ce thème."); // pas de « votre situation » : rien n'a été masqué
    expect(carte).not.toContain('title="Ces candidats');
    expect(carte).toContain('aria-label="1 autre candidat"');
    expect(carte).not.toContain("pile-absents");
    expect(carte).not.toContain('>Nom b<'); // pas de portrait ni d'infobulle nominative pour lui
  });
  it("annonce un thème sans aucun programme analysé comme en cours d'analyse", () => {
    expect(rendu).toContain("Ce thème est en cours d&#x27;analyse");
  });
});

describe("le détail s'ouvre depuis le portrait", () => {
  const mesure = prop("a", [BAISSE]);
  const synthese: SyntheseTheme = { theme: "fiscalite", texte: "Le programme prévoit une contribution.", propositions: [mesure.id], date_derniere_verification: "2026-09-24" };
  const ouvert = { theme: "fiscalite", candidat: "a" };

  it("marque le portrait ouvert et affiche le détail de CE candidat seulement", () => {
    const r = html([candidat("a", [mesure], [synthese]), candidat("b", [prop("b", [HAUSSE])])], {}, ouvert);
    expect(r).toMatch(/class="portrait portrait--ouvert"[^>]*aria-expanded="true"/);
    expect(r).toContain('role="region"');
    expect(r).toContain("Détail : Nom a");
    expect(r).not.toContain("Détail : Nom b");
    // Le nom du candidat est en tête du texte révélé.
    expect(r).toContain('<h3 class="detail-titre">Nom a</h3>');
  });

  it("recouvre le texte de la carte (question du thème) par le texte du candidat, avec une croix pour refermer", () => {
    const r = html([candidat("a", [mesure], [synthese])], {}, ouvert);
    const carte = r.slice(r.indexOf('id="theme-fiscalite"'), r.indexOf('id="theme-retraites"'));
    expect(carte).toContain("Mes impôts et taxes</h2>"); // le nom du thème reste
    expect(carte).not.toContain("Combien vais-je payer ?");
    expect(carte).not.toContain("Cliquez sur un candidat");
    expect(carte).toContain('aria-label="Fermer : Nom a"');
  });

  it("affiche la synthèse puis les sources citées « nom · année », cliquables", () => {
    const r = html([candidat("a", [mesure], [synthese])], {}, ouvert);
    expect(r).toContain("Le programme prévoit une contribution.");
    expect(r).toContain(">a.fr · 2021</a>");
    expect(r).toContain('href="https://a.fr/p"');
    expect(r).toContain('rel="noopener noreferrer"');
    expect(r.indexOf("Le programme prévoit une contribution.")).toBeLessThan(r.indexOf("a.fr · 2021"));
  });

  it("sans information sur le visiteur : programme et mesures seulement, rien sur « votre profil »", () => {
    const r = html([candidat("a", [mesure], [synthese])], {}, ouvert);
    expect(r).not.toContain("(ancien)");
    expect(r).toContain('class="portrait-compte" aria-hidden="true">1<');
    expect(r).not.toContain("Pour votre profil");
    expect(r).not.toContain("Pourquoi cet indicateur");
  });

  it("sans résumé : les onglets sont là, ouverts sur Résumé, qui dit qu'il n'y a pas de résumé ; le détail des mesures est à un clic", () => {
    const r = html([candidat("a", [mesure])], {}, ouvert);
    expect(r).toContain("onglets-detail");
    expect(r).toMatch(/<button type="button" aria-pressed="true">Résumé<\/button>/);
    expect(r).toMatch(/aria-pressed="false">Détail de la mesure<\/button>/);
    expect(r).toContain("Pas de résumé pour ce candidat sur ce thème.");
    expect(r).not.toContain('class="liste-mesures"');
    const detail = html([candidat("a", [mesure])], {}, { ...ouvert, vue: "detail" });
    expect(detail).toContain('class="liste-mesures"');
    expect(detail).not.toContain("Pas de résumé pour ce candidat");
  });

  it("avec une synthèse seule : le texte dans l'onglet Résumé, sans le message d'absence", () => {
    const r = html([candidat("a", [mesure], [synthese])], {}, ouvert);
    expect(r).toContain("Le programme prévoit une contribution.");
    expect(r).toContain("onglets-detail");
    expect(r).not.toContain("Pas de résumé pour ce candidat");
    expect(r).not.toContain('class="liste-mesures"');
  });
  it("ne répète pas le titre d'une mesure quand son texte est identique, ni de mention à chaque mesure", () => {
    const identique: Proposition = { ...prop("a", undefined), titre: "Supprimer la taxe X.", resume_factuel: "Supprimer la taxe X.", sous_theme: "Fiscalité", statut: "partiel" };
    const r = html([candidat("a", [identique])], {}, { ...ouvert, vue: "detail" });
    expect(r.match(/Supprimer la taxe X\./g)).toHaveLength(1);
    expect(r).not.toContain("rubrique");
    expect(r).not.toContain("sourcing partiel");
    expect(r).toMatch(/Source :.*<a href="https:\/\/a\.fr\/p"/);
  });

  it("met chaque mesure dans un volet dépliable, replié au départ : le titre en résumé, le détail et la source dedans", () => {
    const r = html([candidat("a", [prop("a", undefined)])], {}, { ...ouvert, vue: "detail" });
    expect(r).toMatch(/<details class="mesure"><summary>Mesure de a<\/summary><div class="mesure-corps">[\s\S]*?Source :/);
    expect(r).not.toContain('<details class="mesure" open');
  });

  it("affiche l'explication d'une mesure quand elle apporte plus que le titre", () => {
    expect(html([candidat("a", [prop("a", undefined)])], {}, { ...ouvert, vue: "detail" })).toContain("Résumé factuel.");
  });
});

describe("après avoir eu des informations sur le visiteur", () => {
  it("équipe chaque portrait de son indicateur, avec le mot ET le symbole, pas seulement une couleur", () => {
    const ameliorant = html([candidat("a", [prop("a", [HAUSSE])])], PROFIL);
    expect(ameliorant).toContain("Améliorant");
    expect(ameliorant).toContain("▲");
    const degradant = html([candidat("a", [prop("a", [BAISSE])])], PROFIL);
    expect(degradant).toContain("Dégradant");
    expect(degradant).toContain("▼");
    expect(html([candidat("a", [prop("a", [HAUSSE, BAISSE])])], PROFIL)).toContain("Mixte");
    const nonConcerne = html([candidat("a", [prop("a", [{ ...HAUSSE, cibles: [{ champ: "tranche_age", valeurs: ["65_plus"] }] }])])], PROFIL);
    expect(nonConcerne).toContain("Non concerné");
  });

  it("apparaît dès une seule réponse, et la couleur est sur le bouton du portrait", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])])], { tranche_age: "30_49" });
    expect(portraits(r)).toContain('data-niveau="ameliorant"');
  });

  it("explique les quatre niveaux dans la légende, sans score global", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])])], PROFIL);
    expect(r).toContain("Comment lire les indicateurs");
    for (const libelle of ["Améliorant", "Mixte", "Non concerné", "Dégradant"]) expect(r).toContain(libelle);
    expect(r).toContain("pas de score global");
  });

  it("explique l'indicateur dans le détail : mesure, effet et extrait de source", () => {
    const r = html([candidat("a", [prop("a", [BAISSE])])], PROFIL, { theme: "fiscalite", candidat: "a" });
    expect(r).toContain("Pour votre profil");
    expect(r).toContain("Pourquoi cet indicateur ?");
    expect(r).toContain("Revenu disponible en baisse");
    expect(r).toContain("une contribution sur les revenus");
  });

  it("sans effets analysés : pas d'indicateur, et l'explication est donnée", () => {
    const r = html([candidat("a", [prop("a", undefined)])], PROFIL, { theme: "fiscalite", candidat: "a" });
    expect(portraits(r)).not.toContain("niveau"); // aucun badge sur le portrait
    expect(r).toContain("pas d&#x27;indicateur pour l&#x27;instant");
    expect(r).toContain("pas encore disponible");
  });

  it("invite à préciser un champ manquant : « mixte » par prudence plutôt que de conclure à la place du visiteur", () => {
    const cible = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["locataire"] }] };
    const r = html([candidat("a", [prop("a", [cible])])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a" });
    expect(r).toContain("Statut de logement");
    expect(portraits(r)).not.toContain('data-niveau="ameliorant"'); // il n'est pas « améliorant » tant que le logement est inconnu
    expect(portraits(r)).toContain('data-niveau="mixte"');
  });

  it("ne dit jamais « cette mesure ne s'applique pas à votre profil » sur la foi d'un profil incomplet", () => {
    const r = html([candidat("a", [prop("a", undefined)])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a" });
    expect(r).not.toContain("ne s&#x27;applique pas à votre profil");
  });

  it("colore le tour du portrait selon le niveau (couleur + mot + symbole)", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])])], PROFIL);
    expect(portraits(r)).toContain('data-niveau="ameliorant"');
    expect(portraits(html([candidat("a", [prop("a", [BAISSE])])], PROFIL))).toContain('data-niveau="degradant"');
  });

  it("dit « à préciser » sous un « mixte » par incertitude, et explique quoi préciser dans le détail", () => {
    const cible = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["locataire"] }] };
    const r = html([candidat("a", [prop("a", [cible])])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a" });
    expect(portraits(r)).toContain("Mixte");
    expect(portraits(r)).toContain("à préciser");
    expect(r).toContain("par prudence");
    expect(r).toContain("Répondez à");
    expect(r).toContain("Statut de logement");
  });

  it("ne dit pas « à préciser » pour un « mixte » réel (favorable ET défavorable)", () => {
    expect(portraits(html([candidat("a", [prop("a", [HAUSSE, BAISSE])])], PROFIL))).not.toContain("à préciser");
  });

  it("répartit les mesures en favorables et défavorables dans l'onglet dédié", () => {
    const favorable = prop("a", [HAUSSE]);
    const defavorable = { ...prop("a", [BAISSE]), id: "a-fiscalite-002", titre: "Mesure défavorable de a" };
    const r = html([candidat("a", [favorable, defavorable])], PROFIL, { theme: "fiscalite", candidat: "a", vue: "polarite" });
    expect(r).toContain("Mesures favorables");
    expect(r).toContain("Mesures défavorables");
    expect(r.indexOf("Mesures favorables")).toBeLessThan(r.indexOf("Mesure de a"));
    expect(r.indexOf("Mesures défavorables")).toBeLessThan(r.indexOf("Mesure défavorable de a"));
    // Répartition dans l'onglet « Favorable / défavorable » : chaque groupe une seule fois.
    expect(r.match(/Mesures favorables/g)).toHaveLength(1);
    expect(r.match(/Mesures défavorables/g)).toHaveLength(1);
  });

  it("ne répartit pas les mesures d'un « mixte à préciser » (le sens des mesures manquantes n'est pas établi)", () => {
    const cible = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["locataire"] }] };
    const r = html([candidat("a", [prop("a", [cible])])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a", vue: "polarite" });
    expect(r).not.toContain("Mesures favorables");
    expect(r).not.toContain("Mesures défavorables");
  });

  it("propose l'onglet « Favorable / défavorable » dès qu'une projection existe, sans répéter la répartition sous « Pour votre profil »", () => {
    const favorable = prop("a", [HAUSSE]);
    const defavorable = { ...prop("a", [BAISSE]), id: "a-fiscalite-002", titre: "Mesure défavorable de a" };
    const synthese: SyntheseTheme = { theme: "fiscalite", texte: "Synthèse du candidat.", propositions: [favorable.id, defavorable.id], date_derniere_verification: "2026-09-24" };
    const r = html([candidat("a", [favorable, defavorable], [synthese])], PROFIL, { theme: "fiscalite", candidat: "a" });
    expect(r).toContain("Synthèse du candidat."); // vue par défaut : le résumé
    expect(r).toContain("Favorable / défavorable"); // l'onglet existe
    expect(r).toContain("Pour votre profil");
    expect(r).not.toContain("Mesures favorables"); // la répartition n'apparaît que dans son onglet
    expect(html([candidat("a", [prop("a", undefined)])], {}, { theme: "fiscalite", candidat: "a" })).not.toContain("Favorable / défavorable"); // sans projection, pas d'onglet
  });});

describe("questions propres à chaque thème", () => {
  const candidats = [candidat("a", [prop("a", [HAUSSE])])];

  it("n'apparaissent pas avant la validation du formulaire général", () => {
    const r = html(candidats, PROFIL, undefined, false);
    expect(r).not.toContain("Pour affiner");
  });

  it("apparaissent après, uniquement sur le thème concerné, chaque question préfixée « Pour affiner : », sans titre ni décompte", () => {
    const r = html(candidats, { tranche_age: "30_49", vehicule: "thermique" }, undefined, true);
    expect(r).toContain("Pour affiner : Quel véhicule utilisez-vous le plus ?");
    expect(r).not.toContain("Préciser ma situation pour ce thème");
    expect(r).not.toMatch(/\(\d+\/\d+ réponse/); // plus de décompte
    const carteRetraites = r.slice(r.indexOf('id="theme-retraites"'));
    expect(carteRetraites).not.toContain("Pour affiner");
  });

  it("posent aussi les questions sensibles, sans mention « questions sensibles, facultatif » ni décompte", () => {
    const seulementSensibles = construireQuestionnaire(CHAMPS_PROFIL, { nationalite: ["fiscalite"] }, THEMES);
    const personnalise = aDesInformations(PROFIL);
    const r = renderToStaticMarkup(
      <VueThemes cards={construireCards(THEMES, candidats, PROFIL)} profil={PROFIL} personnalise={personnalise} questionnaire={seulementSensibles} questionsActives={true} onReponse={() => {}} />,
    );
    expect(r).toContain("Pour affiner : Votre nationalité");
    expect(r).not.toContain("questions sensibles, facultatif");
  });

  it("ne reposent que sur les questions propres au thème : les questions générales n'y sont pas répétées", () => {
    const r = html(candidats, PROFIL, undefined, true);
    expect(r).not.toContain("Statut de logement"); // question générale (deux thèmes) : posée dans le formulaire général
  });

  it("posent les questions sensibles directement, sans case d'accord préalable", () => {
    const seulementSensibles = construireQuestionnaire(CHAMPS_PROFIL, { nationalite: ["fiscalite"] }, THEMES);
    const r = renderToStaticMarkup(
      <VueThemes cards={construireCards(THEMES, candidats, PROFIL)} profil={PROFIL} personnalise={aDesInformations(PROFIL)} questionnaire={seulementSensibles} questionsActives={true} onReponse={() => {}} />,
    );
    expect(r).not.toContain("J&#x27;accepte");
    expect(r).toContain("Votre nationalité");
  });
});

describe("résumé en 40 à 60 mots d'un candidat sur un thème", () => {
  const mesure = prop("a", undefined);
  const resume = {
    theme: "fiscalite",
    segments: [
      { texte: "Il prévoit de ", mesures: [] },
      { texte: "baisser l'impôt", mesures: [mesure.id] },
      { texte: ".", mesures: [] },
    ],
    propositions: [mesure.id],
    empreinte: "e",
    date: "2026-09-27",
    modele: "m",
  };

  it("accentue chaque mot clé avec son numéro, sans la légende dans la même vue (déplacée dans l'onglet Mesures)", () => {
    const rendu = html([{ ...candidat("a", [mesure]), resumes: [resume] }], {}, { theme: "fiscalite", candidat: "a" });
    expect(rendu).toContain('<span class="mot-cle">baisser l&#x27;impôt<sup>1</sup></span>');
    expect(rendu).not.toContain("legende-resume");
    // Deux onglets : Résumé (par défaut) et « Détail de la mesure » (les citations du résumé, avec leur nombre).
    expect(rendu).toMatch(/<button type="button" aria-pressed="true">Résumé<\/button>/);
    expect(rendu).toMatch(/aria-pressed="false">Détail de la mesure<\/button>/);
    expect(rendu).not.toContain("(ancien)");
  });

  it("CitationsResume : un spoiler par renvoi numéroté, avec le libellé du résumé et les mesures citées entre guillemets quand c'en est une", () => {
    const litterale: Proposition = { ...mesure, titre: "Baisser les impôts de production.", titre_litteral: true };
    const r = renderToStaticMarkup(<CitationsResume resume={resume} propositions={[litterale]} />);
    expect(r).toContain("<summary>1. baisser l&#x27;impôt</summary>");
    expect(r).toContain("« Baisser les impôts de production. »");
  });

  it("CitationsResume : ne met PAS entre guillemets un titre reformulé (base « officielle », jamais une vraie citation)", () => {
    const reformule: Proposition = { ...mesure, titre: "Baisser les impôts de production." };
    const r = renderToStaticMarkup(<CitationsResume resume={resume} propositions={[reformule]} />);
    expect(r).toContain("Baisser les impôts de production.");
    expect(r).not.toContain("«");
  });

  it("n'affiche pas un résumé qui ne couvre plus exactement les mesures du thème", () => {
    const autre = { ...mesure, id: "a-fiscalite-002" };
    const rendu = html([{ ...candidat("a", [mesure, autre]), resumes: [resume] }], {}, { theme: "fiscalite", candidat: "a" });
    expect(rendu).not.toContain("mot-cle");
  });

  it("n'affiche jamais la remarque dans la vue Résumé ni dans les citations : jamais mêlée au texte du résumé", () => {
    const remarque = { theme: "fiscalite", texte: "Ce mot clé déforme la mesure.", mesures: [mesure.id], empreinte: "e", date: "2026-09-27" };
    const rendu = html([{ ...candidat("a", [mesure], [], "Nom a", [remarque]), resumes: [resume] }], {}, { theme: "fiscalite", candidat: "a" });
    // Vue par défaut : le résumé.
    expect(rendu).toMatch(/<button type="button" aria-pressed="true">Résumé<\/button>/);
    expect(rendu).not.toContain("Ce mot clé déforme la mesure.");
  });

  it("affiche la remarque dans le détail des mesures, à côté de la mesure qu'elle désigne, pas des autres", () => {
    // Sans résumé ni synthèse : le détail des mesures est ouvert d'emblée par ue: "detail".
    const autre = prop("b", undefined, "fiscalite");
    const remarque = { theme: "fiscalite", texte: "Ce mot clé déforme la mesure.", mesures: [mesure.id], empreinte: "e", date: "2026-09-27" };
    const rendu = html([candidat("a", [mesure, autre], [], "Nom a", [remarque])], {}, { theme: "fiscalite", candidat: "a", vue: "detail" });
    expect(rendu).toContain('class="remarque"');
    expect(rendu).toContain("Ce mot clé déforme la mesure.");
    // Une seule remarque affichée (à côté de « mesure », pas de « autre »).
    expect(rendu.match(/class="remarque"/g)).toHaveLength(1);
  });
});

describe("masquer les candidats non concernés", () => {
  // Effet réservé aux propriétaires : un locataire n'est pas concerné.
  const proprietaires = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] };
  const candidats = [candidat("a", [prop("a", [proprietaires])], [], "Gabriel Attal"), candidat("b", [prop("b", [BAISSE])], [], "Marine Le Pen")];

  it("masque par défaut, dès qu'une information est donnée, les candidats « non concerné », et le dit", () => {
    const r = html(candidats, PROFIL);
    expect(r).toContain('role="switch" checked=""');
    expect(portraits(r)).not.toContain("Gabriel Attal");
    expect(portraits(r)).toContain("Marine Le Pen");
    expect(r).not.toContain("portrait-plus"); // pas de pastille pour les non concernés masqués (aucun candidat sans mesure ici)
  });

  it("ne propose rien tant qu'aucune information n'est donnée", () => {
    const r = html(candidats);
    expect(r).not.toContain('role="switch"');
    expect(portraits(r)).toContain("Gabriel Attal");
  });
});

describe("en-tête de carte", () => {
  const themes: Theme[] = [{ ...THEMES[0], sujets: ["impôt sur le revenu", "TVA"] }];
  const rendu = (ouvert?: { theme: string; candidat: string }) =>
    renderToStaticMarkup(
      <VueThemes
        cards={construireCards(themes, [candidat("a", [prop("a", undefined)])], null)}
        profil={{}}
        personnalise={false}
        questionnaire={QUESTIONNAIRE}
        questionsActives={false}
        onReponse={() => {}}
        ouvertInitial={ouvert}
      />,
    );

  it("liste les sujets abordés sous le nom du thème", () => {
    expect(rendu()).toContain("Sujets abordés : impôt sur le revenu, TVA.");
  });

  it("garde le titre visible à côté du médaillon, et masque les sujets, quand un candidat est ouvert", () => {
    const html = rendu({ theme: "fiscalite", candidat: "a" });
    expect(html).toMatch(/class="carte-entete carte-entete--ouvert"[\s\S]*<h2[^>]*>Mes impôts et taxes<\/h2>/);
    expect(html).not.toContain("Sujets abordés");
  });
});
