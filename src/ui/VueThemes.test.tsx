import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Effet } from "../effets";
import { aDesInformations, type ProfilPartiel } from "../profil";
import type { Proposition, SyntheseTheme, Theme } from "../types";
import { construireCards } from "./cards";
import { VueThemes } from "./VueThemes";

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

function candidat(slug: string, propositions: Proposition[], syntheses: SyntheseTheme[] = [], nom = `Nom ${slug}`): CandidatCharge {
  return { meta: { slug, nom, parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-24" }, propositions, syntheses };
}

// Seulement la liste des portraits : la légende, elle, décrit les niveaux et contient leurs classes.
const portraits = (rendu: string): string => (rendu.match(/<ul class="portraits"[\s\S]*?<\/ul>/g) ?? []).join("");

function html(candidats: CandidatCharge[], profil: ProfilPartiel = {}, ouvert?: { theme: string; candidat: string }): string {
  const personnalise = aDesInformations(profil);
  return renderToStaticMarkup(
    <VueThemes cards={construireCards(THEMES, candidats, personnalise ? profil : null)} profil={profil} personnalise={personnalise} ouvertInitial={ouvert} />,
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

  it("montre les candidats en portraits cliquables : pastille à initiales et nom, dans un bouton", () => {
    expect(rendu).toMatch(/<button[^>]*class="portrait"[^>]*aria-expanded="false"/);
    expect(rendu).toContain(">GA<");
    expect(rendu).toContain(">MLP<");
    expect(rendu).toContain("Gabriel Attal");
  });

  it("n'affiche AUCUN indicateur, ni légende, ni « pas de projection » : les effets ne sont pas appliqués", () => {
    expect(rendu).not.toContain("niveau--");
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).not.toContain("Pas de projection");
    expect(rendu).not.toContain("Pas d&#x27;indicateur");
  });

  it("n'ouvre aucun détail avant le clic sur un portrait", () => {
    expect(rendu).not.toContain('role="region"');
    expect(rendu).not.toContain("Mesures analysées");
  });

  it("range les portraits par ordre alphabétique de slug, quel que soit l'effet de leurs mesures", () => {
    const r = html([candidat("z", [prop("z", [HAUSSE])]), candidat("b", [prop("b", [BAISSE])])]);
    expect(r.indexOf("Nom b")).toBeLessThan(r.indexOf("Nom z"));
  });

  it("propose des repères cliquables vers chaque thème", () => {
    expect(rendu).toContain('href="#theme-fiscalite"');
    expect(rendu).toContain('href="#theme-retraites"');
  });

  it("nomme les candidats sans mesure sur le thème plutôt que de les omettre", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])]), candidat("b", [prop("b", [HAUSSE], "retraites")])]);
    expect(r).toContain("Aucune mesure analysée sur ce thème : Nom b.");
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
    expect(r).toContain("Mesures analysées (1)");
    expect(r).not.toContain("Pour votre profil");
    expect(r).not.toContain("Pourquoi cet indicateur");
  });

  it("dit clairement quand aucun résumé n'existe, au lieu de laisser un vide", () => {
    const r = html([candidat("a", [mesure])], {}, ouvert);
    expect(r).toContain("Aucun résumé n&#x27;est disponible");
  });

  it("ne répète pas le titre d'une mesure quand son texte est identique, et indique la rubrique de la source", () => {
    const identique: Proposition = { ...prop("a", undefined), titre: "Supprimer la taxe X.", resume_factuel: "Supprimer la taxe X.", sous_theme: "Fiscalité" };
    const r = html([candidat("a", [identique])], {}, ouvert);
    expect(r.match(/Supprimer la taxe X\./g)).toHaveLength(1);
    expect(r).toContain("rubrique « Fiscalité » de la source");
  });

  it("affiche l'explication d'une mesure quand elle apporte plus que le titre", () => {
    expect(html([candidat("a", [prop("a", undefined)])], {}, ouvert)).toContain("Résumé factuel.");
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

  it("apparaît dès une seule réponse, et le badge est dans le bouton du portrait", () => {
    const r = html([candidat("a", [prop("a", [HAUSSE])])], { tranche_age: "30_49" });
    expect(portraits(r)).toContain("niveau--ameliorant");
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

  it("invite à préciser un champ manquant plutôt que de conclure", () => {
    const cible = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["locataire"] }] };
    const r = html([candidat("a", [prop("a", [cible])])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a" });
    expect(r).toContain("Statut de logement");
    expect(portraits(r)).not.toContain("niveau"); // pas de badge sur le portrait tant que le logement est inconnu
  });

  it("ne dit jamais « cette mesure ne s'applique pas à votre profil » sur la foi d'un profil incomplet", () => {
    const r = html([candidat("a", [prop("a", undefined)])], { tranche_age: "30_49" }, { theme: "fiscalite", candidat: "a" });
    expect(r).not.toContain("ne s&#x27;applique pas à votre profil");
  });
});
