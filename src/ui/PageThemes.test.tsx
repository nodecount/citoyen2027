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
    <PageThemes base={chargerBase(baseId)} profil={profil} generalSoumis={generalSoumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} mode={mode ?? "simulateur"} vueInitiale="themes" />,
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
    expect(rendu).toContain(`src="/candidats/glucksmann.`);
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
    renderToStaticMarkup(<PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} mode={mode} vueInitiale="themes" />);

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

describe("tableau de bord du simulateur (trois blocs)", () => {
  const base = chargerBase("agregateurs");
  const noms = candidatsDeBase(base).avecDonnees.map((c) => c.meta.nom);
  const page = (extra: Partial<Parameters<typeof PageThemes>[0]> = {}) =>
    renderToStaticMarkup(<PageThemes base={base} profil={{ tranche_age: "30_49" }} generalSoumis={true} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} mode="simulateur" {...extra} />);

  it("arrivée : toujours le tableau de bord, non révélé, sans menu d'étapes ni card", () => {
    for (const html of [page(), page({ profil: {}, generalSoumis: false }), page({ convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } })]) {
      expect(html).toContain("Mon candidat idéal");
      expect(html).toContain("deux-zones");
      expect(html).not.toContain("Étapes du simulateur");
      expect(html).not.toContain("carte-ideal");
      expect(html).toContain("XXXXXX YYYYYY");
      for (const nom of noms) expect(html, nom).not.toContain(nom);
    }
  });
  it("sans réponse : « Révéler » est inactif ; avec une réponse il est actif", () => {
    expect(page({ profil: {}, generalSoumis: false })).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
    expect(page()).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
  });
  it("une seule conviction, sans aucune réponse de situation : la suggestion est accessible et dit qu'elle repose sur les convictions", () => {
    const html = page({ profil: {}, generalSoumis: false, convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } });
    expect(html).toContain("Calculé sur vos convictions seules");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
  });
  it("les trois vues de travail s'ouvrent en modale par-dessus le tableau de bord, qui reste affiché", () => {
    for (const vue of ["situation", "themes", "convictions"] as const) {
      const html = page({ vueInitiale: vue, convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } });
      expect(html, vue).toContain("deux-zones"); // pas de changement de page : le tableau de bord reste derrière
      expect(html, vue).toContain("modale--travail");
      expect(html, vue).toContain(">Terminé<");
      expect(html, vue).not.toContain("Retour à mon candidat idéal");
    }
  });
  it("seule la modale demandée est ouverte ; les autres sont masquées mais montées", () => {
    const html = page({ vueInitiale: "situation" });
    expect(html.match(/class="modale-fond" hidden=""/g)?.length).toBe(2); // convictions et mesures adaptées
    expect(page({ vueInitiale: "zones" }).match(/class="modale-fond" hidden=""/g)?.length).toBe(3);
  });
  it("les deux sections secondaires (panneau de progression, légende) partagent la même classe de style, sans icône dans la légende", () => {
    expect(page({ vueInitiale: "situation" })).toContain('class="section-secondaire panneau-progression"');
    const themes = page({ vueInitiale: "themes" });
    const legende = themes.slice(themes.indexOf('class="section-secondaire echelle"'), themes.indexOf('class="echelle-reperes"'));
    expect(legende).toContain("Si ce candidat était élu");
    expect(legende).not.toContain("<svg");
  });
  it("la vue des thèmes montre les cards masquées, le tableau de bord n'en montre pas", () => {
    const themes = page({ vueInitiale: "themes" });
    expect(themes).toContain('class="grille-themes"');
    expect(themes).toContain("masquons");
    expect(page()).not.toContain('class="grille-themes"');
  });
  it("révélé : les noms réels apparaissent au centre et dans les classements, et le bouton propose de revenir aux questions", () => {
    const html = page({ releveInitial: true });
    expect(html).toContain("Revenir aux questions");
    expect(html).not.toContain("XXXXXX YYYYYY");
    expect(html).not.toContain("Commencer");
    expect(noms.some((n) => html.includes(n))).toBe(true);
  });
  it("révélé : les cards de thèmes restent masquées (lettres, pas de photo)", () => {
    const html = page({ releveInitial: true, vueInitiale: "themes" });
    const themes = html.slice(html.indexOf('class="grille-themes"'));
    expect(themes).toMatch(/Candidat [A-Z]/);
    expect(themes).not.toContain('src="/candidats/');
  });
  it("« Effacer » est dans le bloc concerné, seulement s'il y a quelque chose à effacer", () => {
    const avec = page({ convictionsInitiales: { positions: { ia: "plus_ia" }, exemplarite: false } });
    expect(avec).toContain("Effacer mes réponses");
    expect(avec).toContain("Effacer mes convictions");
    expect(avec).toContain("bouton-effacer");
    const sans = page({ profil: {}, generalSoumis: false });
    expect(sans).not.toContain("Effacer mes");
  });
  it("exploration : aucun tableau de bord", () => {
    expect(page({ mode: "exploration" })).not.toContain("Mon candidat idéal");
  });
  it("convictions sans résultat : l'onglet Candidats dit pourquoi une fois révélé", () => {
    expect(page({ releveInitial: true })).toContain("choisissez au moins une position");
  });
});

describe("pages Exploration et Simulateur", () => {
  const rendreEnMode = (mode: "simulateur" | "exploration", profil: ProfilPartiel, soumis: boolean) =>
    renderToStaticMarkup(
      <PageThemes base={chargerBase("agregateurs")} profil={profil} generalSoumis={soumis} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} mode={mode ?? "simulateur"} vueInitiale="themes" />,
    );

  it("n'a plus de bascule : le mode est celui de la page (/exploration ou /simulateur)", () => {
    expect(rendreEnMode("exploration", AUCUNE_REPONSE, false)).not.toContain("bascule-mode");
    expect(rendreEnMode("simulateur", AUCUNE_REPONSE, false)).not.toContain("bascule-mode");
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

  it("l'exploration est la seule vue à thèmes plein écran sur mobile (défilement thème par thème)", () => {
    expect(rendreEnMode("exploration", AUCUNE_REPONSE, false)).toContain('class="themes themes--plein-ecran"');
    expect(rendreEnMode("simulateur", UNE_REPONSE, true)).not.toContain("themes--plein-ecran");
  });

  it("légende : « non concerné » et « pas d'indicateur » ne font qu'une catégorie, la dernière, qui porte l'interrupteur de masquage", () => {
    const rendu = rendreEnMode("simulateur", UNE_REPONSE, true);
    expect(rendu).not.toContain("Pas d&#x27;indicateur</span>");
    const legende = rendu.slice(rendu.indexOf('class="section-secondaire echelle"'), rendu.indexOf('class="grille-themes"'));
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
        <PageThemes base={base} profil={{}} generalSoumis={false} onValider={() => {}} onEffacer={() => {}} onReponse={() => {}} mode={mode} vueInitiale="themes" convictionsInitiales={{ positions: { ia: "plus_ia" }, exemplarite: true }} />,
      );
    expect(page("simulateur")).toContain("Mes convictions");
    expect(page("exploration")).not.toContain("Mes convictions");
  });
});
