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

// `mode` absent : le mode par défaut de la page (« simulateur », donc à l'aveugle). Les tests qui vérifient des noms, des
// photos ou l'ordre alphabétique demandent « exploration », seul mode où les identités sont visibles.
function rendre(baseId: string, profil: ProfilPartiel, generalSoumis: boolean, mode?: "simulateur" | "exploration"): string {
  return renderToStaticMarkup(
    <PageThemes base={chargerBase(baseId)} profil={profil} generalSoumis={generalSoumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} etapeInitiale="themes" />,
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
    expect(rendu).not.toMatch(/mettez en valeur|profiterai/i); // aucune formulation qui trie les candidats
    expect(rendu).toContain("Étapes du simulateur"); // le parcours est proposé, sans rien imposer
    expect(rendu).not.toContain("Pour affiner"); // les questions par thème viennent après
  });

  it("n'affiche pas de paragraphe sur la provenance des données (elle est dans le menu et sur la page À propos)", () => {
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).not.toContain('class="avertissement"');
  });

  it("base « agregateurs » : thèmes du comparateur, portraits avec photo, aucun thème de l'autre base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false, "exploration");
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
    const rendu = rendre(id, AUCUNE_REPONSE, false, "exploration");
    if (manquants.length > 0) {
      expect(rendu).toContain("Résumé pas encore disponible");
      expect(rendu).toContain(manquants[0].nom);
      expect(rendu).toContain(manquants[0].themeLibelle.replace(/&/g, "&amp;"));
    } else {
      expect(rendu).not.toContain("Résumé pas encore disponible");
    }
  });

  it("l'ordre des portraits reste alphabétique dans une carte, quelle que soit la base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false, "exploration");
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
  });

  it("après validation avec au moins une réponse : couleurs autour des portraits, réponses générales affichées, légende permanente", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, true);
    expect(rendu).toContain("Comment lire les indicateurs");
    expect(rendu).not.toContain('<details class="legende"'); // la légende n'est plus un spoiler : toujours affichée
    expect(rendu).toContain("Étapes du simulateur"); // le parcours est proposé ; le rappel des réponses est à l'étape du résultat
    expect(rendu).toContain("<form");
    expect(portraits(rendu)).toMatch(/data-niveau="[a-z_]+"/);
    expect(rendu).toMatch(/[▲◆○▼]/); // le mot et le symbole restent affichés, dans la légende permanente
  });

  it("après validation d'un formulaire resté vide : toujours aucun indicateur, et on invite à répondre", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, true);
    expect(portraits(rendu)).not.toContain("data-niveau");
  });

  it("ouvre alors les questions propres à chaque thème, sur les thèmes qui en ont", () => {
    const rendu = rendre("officielle", UNE_REPONSE, true);
    expect(rendu).toContain("Pour affiner : ");
    const base = chargerBase("officielle");
    // Aucune section vide : chaque section affichée contient au moins une question.
    const sections = rendu.match(/<section class="questions-theme"[\s\S]*?<\/section>/g) ?? [];
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.length).toBeLessThanOrEqual(base.questionnaire.parTheme.length);
    for (const section of sections) expect(section).toContain("Pour affiner : ");
  });

  it("garde les mêmes portraits qu'au départ : répondre n'ajoute ni ne retire aucun candidat (seul le rangement en zones change)", () => {
    // Par défaut, les « non concernés » et « sans indicateur » sont masqués : on ne peut qu'en retrouver moins, jamais de nouveaux.
    // Le simulateur est à l'aveugle : après la réponse, les portraits sont des lettres (jamais des noms) ; au départ, en
    // exploration, ce sont les noms.
    const apres = noms(rendre("agregateurs", UNE_REPONSE, true));
    const avant = noms(rendre("agregateurs", AUCUNE_REPONSE, false, "exploration"));
    expect(apres.length).toBeLessThanOrEqual(avant.length);
    for (const libelle of apres) expect(libelle).toMatch(/^Candidat [A-Z0-9]+$/);
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

describe("simulateur à l'aveugle par défaut", () => {
  const base = chargerBase("agregateurs");
  const noms = candidatsDeBase(base).avecDonnees.map((c) => c.meta.nom);
  const page = (mode: "simulateur" | "exploration") =>
    renderToStaticMarkup(<PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} etapeInitiale="themes" />);

  it("simulateur : aucun nom réel, aucune photo réelle, des lettres à la place", () => {
    const html = page("simulateur");
    for (const nom of noms) expect(html, nom).not.toContain(nom);
    expect(html).not.toContain('src="/candidats/');
    expect(html).toMatch(/Candidat [A-Z]/); // lettres tirées au hasard : jamais une lettre précise
  });
  it("simulateur : plus d'interrupteur « Afficher les candidats » ni de « Qui était qui ? »", () => {
    const html = page("simulateur");
    expect(html).not.toContain("Afficher les candidats");
    expect(html).not.toContain("Qui était qui");
  });
  it("exploration : les identités sont visibles (noms réels, photos), aucune lettre « Candidat A »", () => {
    const html = page("exploration");
    expect(html).toContain('src="/candidats/le-pen.');
    expect(html).toContain(noms[0]);
    expect(html).not.toContain("Candidat A");
  });
});

describe("card candidat idéal sur la page du simulateur", () => {
  const base = chargerBase("agregateurs");
  const noms = candidatsDeBase(base).avecDonnees.map((c) => c.meta.nom);
  const page = (extra: Partial<Parameters<typeof PageThemes>[0]> = {}) =>
    renderToStaticMarkup(
      <PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial="simulateur" {...extra} />,
    );

  it("floutée par défaut : la card est là, le bouton aussi, et aucun nom réel n'est dans la page", () => {
    const html = page();
    expect(html).toContain("carte-ideal--floue");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    for (const nom of noms) expect(html, nom).not.toContain(nom);
  });
  it("le résultat n'affiche plus les cards de thèmes (elles ont leur propre étape) et l'étape des thèmes n'affiche pas la card", () => {
    const resultat = page();
    expect(resultat).toContain("carte-ideal");
    expect(resultat).not.toContain('class="grille-themes"');
    const themes = page({ etapeInitiale: "themes" });
    expect(themes).toContain('class="grille-themes"');
    expect(themes).not.toContain("carte-ideal");
    expect(themes).toContain("masquons");
  });
  it("sans réponse (pas d'indicateur) : pas de card", () => {
    expect(page({ profil: {}, generalSoumis: false })).not.toContain("carte-ideal");
  });
  it("révélée : le bouton Recommencer remplace celui de révélation, et le formulaire reste disponible (le modifier réinitialise le résultat)", () => {
    const html = page({ releveInitial: true });
    expect(html).toContain("Recommencer la simulation");
    expect(html).not.toContain("Révéler mon programme");
    expect(html).toContain("Mes réponses");
    expect(html).not.toContain("carte-ideal--floue");
  });
  it("révélée : les cards de thèmes restent masquées (lettres, pas de photo)", () => {
    const html = page({ releveInitial: true, etapeInitiale: "themes" });
    // La card idéale montre la vraie photo du gagnant ; les cards de thèmes, elles, restent masquées.
    const themes = html.slice(html.indexOf('class="grille-themes"'));
    expect(themes).toMatch(/Candidat [A-Z]/); // lettres tirées au hasard : jamais une lettre précise
    expect(themes).not.toContain('src="/candidats/');
  });
  it("floutée : le rappel des réponses (situation et convictions) est sous la card, avec le bouton pour recommencer", () => {
    const html = page();
    expect(html).toContain("Mes réponses");
    expect(html).toContain("Recommencer pour corriger ou compléter");
    expect(html.indexOf("carte-ideal")).toBeLessThan(html.indexOf("Mes réponses"));
  });
  it("le résultat commence par le rappel de ce sur quoi repose le calcul, avec les compteurs de réponses et de convictions", () => {
    const html = page({ convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } });
    expect(html).toContain("Nous calculons ce résultat à partir de vos réponses");
    expect(html).toMatch(/1 question répondue sur \d+/);
    expect(html).toContain("1 conviction complétée sur 8");
    expect(html.indexOf("bandeau-pertinence")).toBeLessThan(html.indexOf("carte-ideal"));
  });
  it("sans réponse : le parcours commence par la situation, sans thèmes ni résultat", () => {
    const html = page({ profil: {}, generalSoumis: false });
    expect(html).toContain("Voir les mesures adaptées à ma situation");
    expect(html).not.toContain('class="grille-themes"');
    expect(html).not.toContain("Mes réponses");
  });
  it("étape convictions : les thèmes et le résultat ne sont pas encore affichés", () => {
    const html = page({ etapeInitiale: "convictions" });
    expect(html).toContain("Voir mon candidat idéal");
    expect(html).not.toContain('class="grille-themes"');
    expect(html).not.toContain("carte-ideal");
  });
  it("exploration : aucune card idéale", () => {
    expect(page({ modeInitial: "exploration" })).not.toContain("carte-ideal");
  });
  it("résultat convictions seulement si une position est choisie ET que des mesures sont étiquetées dessus", () => {
    expect(page()).toContain("Pas encore de résultat");
    expect(page()).not.toContain("selon votre situation et selon vos convictions");
    // Aucune mesure n'est encore étiquetée : promettre un « meilleur programme selon vos convictions » serait faux, on l'omet.
    const avecPosition = page({ convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } });
    // Selon les données étiquetées à cet instant, le résultat existe ou la card dit pourquoi il n'existe pas : jamais de silence.
    expect(avecPosition).toMatch(/selon votre situation et selon vos convictions|pas encore été étudiées sur les sujets/);
  });
});

describe("bascule entre exploration des mesures et simulateur", () => {
  const rendreEnMode = (mode: "simulateur" | "exploration", profil: ProfilPartiel, soumis: boolean) =>
    renderToStaticMarkup(
      <PageThemes base={chargerBase("agregateurs")} profil={profil} generalSoumis={soumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} etapeInitiale="themes" />,
    );

  it("propose les deux modes, avec le mode courant indiqué", () => {
    const rendu = rendreEnMode("exploration", AUCUNE_REPONSE, false);
    expect(rendu).toContain("Explorer les mesures");
    expect(rendu).toContain("Simuler pour moi");
    expect(rendu).toMatch(/aria-pressed="true"[^>]*>(<svg[\s\S]*?<\/svg>)?<span class="bascule-libelle">Explorer les mesures/);
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

  it("le flux de bulles de paroles existe dans les deux modes ; en simulateur, il porte la couleur de l'indicateur", () => {
    expect(rendreEnMode("exploration", AUCUNE_REPONSE, false)).toContain("flux-candidats");
    expect(rendreEnMode("exploration", AUCUNE_REPONSE, false)).not.toMatch(/class="flux-item[^"]*" data-niveau/);
    const simulateur = rendreEnMode("simulateur", UNE_REPONSE, true);
    expect(simulateur).toContain("flux-candidats");
    expect(simulateur).toMatch(/class="flux-item[^"]*" data-niveau="(ameliorant|mixte|degradant)"/);
  });

  it("légende : « non concerné » et « pas d'indicateur » ne font qu'une catégorie, la dernière, qui porte l'interrupteur de masquage", () => {
    const rendu = rendreEnMode("simulateur", UNE_REPONSE, true);
    expect(rendu).not.toContain("Pas d&#x27;indicateur</span>");
    const legende = rendu.slice(rendu.indexOf('class="echelle"'), rendu.indexOf('class="grille-themes"'));
    const reperes = [...legende.matchAll(/data-niveau="([a-z_]+)"/g)].map((m) => m[1]);
    // Trois repères sur la règle, puis « non concerné » hors règle, dernier, avec l'interrupteur.
    expect(reperes).toEqual(["ameliorant", "mixte", "degradant", "non_concerne"]);
    const derniere = legende.slice(legende.indexOf('class="echelle-hors"'));
    expect(derniere).toContain('role="switch"');
    expect(derniere).toContain("Masquer les candidats dont les mesures ne changent rien à ma situation");
  });
});

describe("bloc « Mes convictions » sur la page du simulateur", () => {
  it("affiché en mode simulateur, absent en mode exploration même avec des convictions enregistrées", () => {
    const base = chargerBase("agregateurs");
    const page = (mode: "simulateur" | "exploration") =>
      renderToStaticMarkup(
        <PageThemes base={base} profil={{}} generalSoumis={false} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} modeInitial={mode} etapeInitiale="themes" convictionsInitiales={{ positions: { ia: "plus_ia" }, exemplarite: true }} />,
      );
    expect(page("simulateur")).toContain("Mes convictions");
    expect(page("exploration")).not.toContain("Mes convictions");
  });
});
