import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase, resumesManquants } from "../data/bases";
import type { ProfilPartiel } from "../profil";
import PageThemes from "./PageThemes";

// Une valeur valide quel que soit le type de la question (enum, multi, nombre), pour répondre à une question de
// thème prise dynamiquement dans les données réelles.
function uneReponseValide(champ: { type: string; options?: string[] }): string | string[] {
  if (champ.type === "multi") return champ.options ? [champ.options[0]] : [];
  if (champ.type === "number") return "1";
  return champ.options?.[0] ?? "oui";
}

const AUCUNE_REPONSE: ProfilPartiel = {};
const UNE_REPONSE: ProfilPartiel = { tranche_age: "30_49" };

function rendre(baseId: string, profil: ProfilPartiel, generalSoumis: boolean): string {
  return renderToStaticMarkup(
    <PageThemes base={chargerBase(baseId)} profil={profil} generalSoumis={generalSoumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} />,
  );
}

const portraits = (rendu: string): string => (rendu.match(/<ul class="portraits"[\s\S]*?<\/ul>/g) ?? []).join("");
// Le nom n'est plus écrit sous la pastille : il est porté par le bouton (title et nom accessible).
const noms = (rendu: string): string[] => [...portraits(rendu).matchAll(/class="infobulle infobulle--nom"[^>]*>([^<]+)</g)].map((m) => m[1]);

// Rendu de bout en bout avec les VRAIES données de chaque base : le même moteur et la même interface doivent
// fonctionner quelle que soit la base, avec ses propres thèmes.
describe("page des thèmes, sur les données réelles", () => {
  it.each(["officielle", "agregateurs"])("base « %s » : une carte par thème, des portraits cliquables, aucun indicateur avant le formulaire général", (id) => {
    const rendu = rendre(id, AUCUNE_REPONSE, false);
    const base = chargerBase(id);
    for (const theme of base.themes) expect(rendu).toContain(`id="theme-${theme.id}"`);
    expect(rendu).toMatch(/<button[^>]*class="portrait/);
    expect(portraits(rendu)).not.toContain("data-niveau"); // aucune couleur autour des portraits
    expect(portraits(rendu)).not.toContain("niveau--"); // aucun badge
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).toContain("changerait pour votre situation personnelle pendant le mandat");
    expect(rendu).toMatch(/Pour cela,\s*<\/p>\s*<button[^>]*class="bouton-en-ligne"[^>]*>Renseignez des informations<\/button>/);
    expect(rendu).not.toMatch(/mettez en valeur|profiterai/i); // aucune formulation qui trie les candidats
    expect(rendu).not.toContain("<form"); // aucun formulaire imposé avant de voir les programmes
    expect(rendu).not.toContain("Pour affiner"); // les questions par thème viennent après
  });

  it("n'affiche pas de paragraphe sur la provenance des données (elle est dans le menu et sur la page À propos)", () => {
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).not.toContain('class="avertissement"');
  });

  it("base « agregateurs » : thèmes du comparateur, portraits avec photo, aucun thème de l'autre base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false);
    expect(rendu).toContain("Finances publiques");
    expect(rendu).toContain("Retraites &amp; Travail");
    expect(rendu).not.toContain("Mes impôts");
    expect(rendu).toContain('src="/candidats/le-pen.');
    expect(rendu).toContain(">PS<"); // le Parti socialiste n'est pas une personne : initiales, pas de photo
  });

  it("n'écrit pas le nom des candidats sous leur portrait", () => {
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).not.toContain("portrait-nom");
  });

  it.each(["officielle", "agregateurs"])("base « %s » : signale les résumés manquants (mesures présentes, résumé absent), sans jamais les cacher", (id) => {
    const base = chargerBase(id);
    const manquants = resumesManquants(base, candidatsDeBase(base).avecDonnees);
    const rendu = rendre(id, AUCUNE_REPONSE, false);
    if (manquants.length > 0) {
      expect(rendu).toContain("Résumé pas encore disponible");
      expect(rendu).toContain(manquants[0].nom);
      expect(rendu).toContain(manquants[0].themeLibelle.replace(/&/g, "&amp;"));
    } else {
      expect(rendu).not.toContain("Résumé pas encore disponible");
    }
  });

  it("l'ordre des portraits reste alphabétique dans une carte, quelle que soit la base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false);
    const carte = rendu.slice(rendu.indexOf('id="theme-finances-publiques"'), rendu.indexOf('id="theme-interieur-justice"'));
    const liste = noms(carte);
    expect(liste.length).toBeGreaterThan(5);
    expect(liste[0]).toBe("Gabriel Attal");
    expect(liste.indexOf("Nicolas Dupont-Aignan")).toBeLessThan(liste.indexOf("Jean-Luc Mélenchon"));
    expect(liste.indexOf("Jean-Luc Mélenchon")).toBeLessThan(liste.indexOf("Éric Zemmour"));
  });
});

describe("les indicateurs n'apparaissent qu'après la validation du formulaire général", () => {
  it("des réponses en brouillon (formulaire non validé) ne colorent aucun portrait", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, false);
    expect(portraits(rendu)).not.toContain("data-niveau");
    expect(rendu).toContain("Renseignez des informations");
  });

  it("après validation avec au moins une réponse : couleurs autour des portraits, réponses générales affichées, légende permanente", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, true);
    expect(rendu).toContain("Comment lire les indicateurs");
    expect(rendu).not.toContain('<details class="legende"'); // la légende n'est plus un spoiler : toujours affichée
    expect(rendu).toContain("Vos réponses générales");
    expect(rendu).toContain("Modifier mes réponses"); // le formulaire se rouvre à tout moment, avec son bouton d'enregistrement
    expect(rendu).not.toContain("<form"); // mais il ne prend pas la place des thèmes tant qu'on ne le rouvre pas
    expect(portraits(rendu)).toMatch(/data-niveau="[a-z_]+"/);
    expect(rendu).toMatch(/[▲◆○▼]/); // le mot et le symbole restent affichés, dans la légende permanente
  });

  it("après validation d'un formulaire resté vide : toujours aucun indicateur, et on invite à répondre", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, true);
    expect(portraits(rendu)).not.toContain("data-niveau");
    expect(rendu).toContain("Aucune réponse donnée");
  });

  it("ouvre alors les questions propres à chaque thème, sur les thèmes qui en ont", () => {
    const rendu = rendre("officielle", UNE_REPONSE, true);
    expect(rendu).toContain("Pour affiner : ");
    const base = chargerBase("officielle");
    expect((rendu.match(/class="questions-theme"/g) ?? []).length).toBe(base.questionnaire.parTheme.length);
  });

  it("garde les mêmes portraits qu'au départ : répondre n'ajoute ni ne retire aucun candidat (seul le rangement en zones change)", () => {
    // Par défaut, les « non concernés » et « sans indicateur » sont masqués : on ne peut qu'en retrouver moins, jamais de nouveaux.
    const apres = noms(rendre("agregateurs", UNE_REPONSE, true));
    const avant = noms(rendre("agregateurs", AUCUNE_REPONSE, false));
    expect(apres.length).toBeLessThanOrEqual(avant.length);
    for (const nom of apres) expect(avant).toContain(nom);
  });

  it("range le tiroir en trois zones (gauche : améliorent, milieu : mixtes et neutres, droite : dégradent) une fois les indicateurs affichés", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, true);
    expect(rendu).toContain('data-zone="gauche"');
    expect(rendu).toContain('data-zone="milieu"');
    expect(rendu).toContain('data-zone="droite"');
    // Un « améliorant » est dans la zone de gauche, un « dégradant » dans celle de droite.
    const zone = (id: string) => rendu.slice(rendu.indexOf(`data-zone="${id}"`)).split("</ul>")[0];
    expect(zone("gauche")).not.toContain('data-niveau="degradant"');
    expect(zone("droite")).not.toContain('data-niveau="ameliorant"');
    // Sans indicateur (avant l'enregistrement, ou en exploration), un seul tiroir non découpé.
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).not.toContain("data-zone");
  });

});

describe("bascule entre exploration des mesures et simulateur", () => {
  const rendreEnMode = (mode: "simulateur" | "exploration", profil: ProfilPartiel, soumis: boolean) =>
    renderToStaticMarkup(
      <PageThemes base={chargerBase("agregateurs")} profil={profil} generalSoumis={soumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} />,
    );

  it("propose les deux modes, avec le mode courant indiqué", () => {
    const rendu = rendreEnMode("exploration", AUCUNE_REPONSE, false);
    expect(rendu).toContain("Explorer les mesures");
    expect(rendu).toContain("Simuler pour moi");
    expect(rendu).toMatch(/aria-pressed="true"[^>]*>(<svg[\s\S]*?<\/svg>)?Explorer les mesures/);
  });

  it("en exploration : ni indicateur, ni légende, ni formulaire, ni invitation, ni questions par thème — même avec des réponses enregistrées", () => {
    const rendu = rendreEnMode("exploration", UNE_REPONSE, true);
    expect(portraits(rendu)).not.toContain("data-niveau");
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).not.toContain("Renseignez des informations");
    expect(rendu).not.toContain("Modifier mes réponses");
    expect(rendu).not.toContain("Pour affiner");
    expect(rendu).not.toContain("<form");
    expect(rendu).toMatch(/<button[^>]*class="portrait/); // les candidats et leurs mesures restent là
  });

  it("en simulateur : indicateurs, légende et questions par thème comme avant", () => {
    const rendu = rendreEnMode("simulateur", UNE_REPONSE, true);
    expect(rendu).toContain("Comment lire les indicateurs");
    expect(portraits(rendu)).toMatch(/data-niveau="[a-z_]+"/);
  });

  it("le flux de bulles de paroles n'existe qu'en mode exploration", () => {
    expect(rendreEnMode("simulateur", AUCUNE_REPONSE, false)).not.toContain("flux-candidats");
    expect(rendreEnMode("simulateur", UNE_REPONSE, true)).not.toContain("flux-candidats");
    expect(rendreEnMode("exploration", AUCUNE_REPONSE, false)).toContain("flux-candidats");
  });

  it("légende : « non concerné » et « pas d'indicateur » ne font qu'une catégorie, la dernière, qui porte l'interrupteur de masquage", () => {
    const rendu = rendreEnMode("simulateur", UNE_REPONSE, true);
    expect(rendu).not.toContain("Pas d&#x27;indicateur</span>");
    const tuiles = [...rendu.matchAll(/<div data-niveau="([a-z_]+)">/g)].map((m) => m[1]);
    expect(tuiles).toEqual(["ameliorant", "mixte", "degradant", "non_concerne"]);
    const derniere = rendu.slice(rendu.indexOf('data-niveau="non_concerne"'));
    expect(derniere).toContain('role="switch"');
    expect(derniere).toContain("Masquer les candidats dont les mesures ne changent rien à ma situation");
  });
});
