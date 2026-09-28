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
const noms = (rendu: string): string[] => [...portraits(rendu).matchAll(/class="portrait[^"]*"[^>]*title="([^"]+)"/g)].map((m) => m[1]);

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
    expect(rendu).not.toContain("Préciser ma situation pour ce thème"); // les questions par thème viennent après
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
    expect(rendu).toContain("Préciser ma situation pour ce thème");
    const base = chargerBase("officielle");
    expect((rendu.match(/class="questions-theme"/g) ?? []).length).toBe(base.questionnaire.parTheme.length);
  });

  it("garde les mêmes portraits qu'au départ : répondre n'ajoute ni ne retire aucun candidat", () => {
    expect(noms(rendre("agregateurs", UNE_REPONSE, true))).toEqual(noms(rendre("agregateurs", AUCUNE_REPONSE, false)));
  });

});
