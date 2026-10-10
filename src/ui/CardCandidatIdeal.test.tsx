import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardCandidatIdeal, Jauge, ModaleAideScore, ModaleDetail, PoursContres, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

const gagnant = (lettre: string, nom: string, slug: string, solde = 2): GagnantAffiche => ({ lettre, identite: { slug, nom, parti: "Parti-test" }, ameliorants: 3, degradants: 1, analyses: 7, solde, pour: [{ theme: "logement", groupes: ["Mesure-pour"], mesures: ["Vraie-mesure-pour"] }], contre: [{ theme: "retraite", groupes: ["Mesure-contre"], mesures: ["Vraie-mesure-contre"] }] });
// Par défaut, le classement reprend les gagnants au rang 1 ; `classement` permet d'en fournir un autre.
const resultat = (titre: string, gagnants: GagnantAffiche[], extra: Partial<ResultatAffiche> = {}): ResultatAffiche => ({
  titre,
  unite: "thèmes",
  gagnants,
  classement: gagnants.map((g) => ({ ...g, rang: 1 })),
  solde: 2,
  departageable: true,
  ecartes: 0,
  tousEcartes: false,
  ...extra,
});
const SITUATION = resultat("Selon votre situation", [gagnant("C", "Nom-Reel-Situation", "slug-reel-a")]);
const CONVICTIONS = resultat("Selon vos convictions", [gagnant("F", "Nom-Reel-Convictions", "slug-reel-b")], { unite: "sujets" });
const COMBINE = resultat("Selon votre situation et vos convictions", [gagnant("C", "Nom-Reel-Centre", "slug-reel-c", 4)]);

const rendre = (p: Partial<Parameters<typeof CardCandidatIdeal>[0]> = {}) => {
  const situation = "situation" in p ? p.situation! : SITUATION;
  return renderToStaticMarkup(<CardCandidatIdeal situation={situation} convictions={CONVICTIONS} combine={p.combine ?? situation ?? COMBINE} questionsRestantes={3} revele={false} onReveler={() => {}} {...p} />);
};

describe("CardCandidatIdeal floutée", () => {
  it("ne met NI le nom, NI le slug, NI la photo réels dans la page, même si la donnée est fournie", () => {
    const html = rendre({ combine: COMBINE });
    for (const secret of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Nom-Reel-Centre", "slug-reel-a", "slug-reel-b", "slug-reel-c", "Parti-test", "/candidats/"]) expect(html, secret).not.toContain(secret);
  });
  it("le contenu flouté est masqué aux lecteurs d'écran", () => {
    const html = rendre();
    expect(html).toContain("carte-ideal--floue");
    expect(html).toMatch(/class="[^"]*ideal-flou[^"]*"[^>]*aria-hidden="true"/);
    expect(html).not.toContain("Identité masquée");
  });
  it("floutée, les lignes du top sont de simples lignes (pas de bouton) avec la lettre anonyme et la jauge", () => {
    const html = rendre();
    expect(html).not.toMatch(/class="ideal-ligne"[^>]*aria-haspopup/);
    expect(html).toContain("Candidat C");
    expect(html).toContain("ideal-jauge");
  });
  it("bandeau : texte verbatim et bouton de révélation", () => {
    const html = rendre();
    expect(html).toContain("Votre candidat idéal selon votre situation et selon vos convictions est prêt.");
    expect(html).toContain("3 questions restent à traiter dans les thèmes : y répondre affine le résultat.");
    expect(html).toContain("Révéler mon programme de candidat idéal pour 2027");
    expect(html).not.toContain("Recommencer la simulation");
  });
  it("sans résultat convictions : le voile ne promet que la situation, et la card dit que les convictions n'ont pas (encore) de résultat", () => {
    const html = rendre({ convictions: null });
    expect(html).toContain("Votre candidat idéal selon votre situation est prêt.");
    expect(html).not.toContain("selon votre situation et selon vos convictions");
    expect(html).toContain("Selon vos convictions");
    expect(html).toContain("Pas encore de résultat");
  });
  it("une seule card : le bouton de révélation est posé sur les résultats, pas dans une seconde card", () => {
    const html = rendre();
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(html.indexOf("ideal-mer")).toBeLessThan(html.indexOf("ideal-voile"));
    expect(html.match(/class="ideal-voile"/g)).toHaveLength(1);
    expect(html).toContain("Selon votre situation");
    expect(html).toContain("Selon vos convictions");
  });
  it("disposition : situation à gauche, le candidat idéal au centre, convictions à droite", () => {
    const html = rendre();
    expect(html.indexOf("ideal-colonne--gauche")).toBeLessThan(html.indexOf("ideal-centre"));
    expect(html.indexOf("ideal-centre")).toBeLessThan(html.indexOf("ideal-colonne--droite"));
    expect(html.indexOf("Selon votre situation<")).toBeLessThan(html.indexOf("Candidat idéal, tous critères confondus"));
    expect(html.indexOf("Candidat idéal, tous critères confondus")).toBeLessThan(html.indexOf("Selon vos convictions<"));
  });
  it("aucune question restante : la phrase sur l'affinage disparaît ; une seule : singulier", () => {
    expect(rendre({ questionsRestantes: 0 })).not.toContain("affine");
    expect(rendre({ questionsRestantes: 1 })).toContain("Une question reste à traiter dans les thèmes");
  });
  it("égalité au centre : la card floutée dit seulement le nombre d'ex æquo, sans nom", () => {
    const egalite = resultat("Selon votre situation et vos convictions", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb"), gagnant("D", "Nom-D", "sd")]);
    const html = rendre({ convictions: null, combine: egalite });
    expect(html).toContain("3 candidats à égalité");
    expect(html).not.toContain("Nom-");
  });
  it("un seul gagnant : pas de mention d'égalité ; non départageable : pas de nombre non plus", () => {
    expect(rendre()).not.toContain("à égalité");
    const nul = resultat("Selon votre situation et vos convictions", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb")], { departageable: false });
    const html = rendre({ convictions: null, combine: nul });
    expect(html).not.toContain("à égalité");
    expect(html).toContain("Égalité parfaite");
  });
  it("aucun résultat du tout : rien", () => {
    expect(rendre({ situation: null, convictions: null, combine: null })).toBe("");
  });
});

describe("CardCandidatIdeal, clavier et lecteurs d'écran", () => {
  it("le résultat est annoncé (zone aria-live) et le titre peut recevoir le focus après la révélation", () => {
    for (const revele of [false, true]) {
      const html = rendre({ revele });
      expect(html).toContain('aria-live="polite"');
      expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>(<svg[\s\S]*?<\/svg>)?Votre candidat idéal<\/h2>/);
    }
  });
});

describe("CardCandidatIdeal révélée", () => {
  it("montre au centre le candidat cumulé, et de part et d'autre les tops : noms, partis, lettre ; plus de flou", () => {
    const html = rendre({ revele: true, combine: COMBINE });
    for (const t of ["Nom-Reel-Situation", "Nom-Reel-Convictions", "Nom-Reel-Centre", "Parti-test"]) expect(html, t).toContain(t);
    expect(html).not.toContain("(Candidat C)");
    expect(html).not.toContain("carte-ideal--floue");
    expect(html).not.toContain("Révéler mon programme");
  });
  it("le candidat du centre n'a pas de jauge : seules les lignes des deux tops en ont", () => {
    const html = rendre({ revele: true });
    const centre = html.slice(html.indexOf("ideal-centre"), html.indexOf("ideal-colonne--droite"));
    expect(centre).not.toContain("ideal-jauge");
  });
  it("chaque ligne du top est un bouton qui ouvre le détail (fenêtre) ; le centre ne l'est pas", () => {
    const html = rendre({ revele: true });
    expect(html.match(/class="ideal-ligne"[^>]*aria-haspopup="dialog"/g)).toHaveLength(2);
  });
  it("le top affiche rang, portrait, nom et jauge ; les ex æquo sont regroupés dans une seule ligne « X candidats »", () => {
    const top = resultat("Selon votre situation", [gagnant("A", "Nom-A", "sa", 3)], {
      classement: [
        { ...gagnant("A", "Nom-A", "sa", 3), rang: 1 },
        { ...gagnant("B", "Nom-B", "sb", 1), rang: 2 },
        { ...gagnant("D", "Nom-D", "sd", 1), rang: 2 },
      ],
    });
    const html = rendre({ revele: true, situation: top, convictions: null });
    // Deux places (1 et 2) : la seconde regroupe B et D dans une seule ligne cliquable, qui dit « 2 candidats » à la place des noms.
    expect(html.match(/class="ideal-ligne-rang">/g)).toHaveLength(2);
    expect(html.match(/class="ideal-ligne-rang">2</g)).toHaveLength(1);
    expect(html.match(/class="ideal-ligne"[^>]*aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(html).toContain("2 candidats<");
    expect(html).not.toContain("à égalité");
    // Une seule jauge par place : 2 jauges en tout, pas 3.
    expect(html.match(/class="ideal-jauge"/g)).toHaveLength(2);
    expect(html).toContain("Nom-A");
    for (const t of ["Nom-B", "Nom-D"]) expect(html, t).not.toContain(t);
  });
  it("égalité au centre : le nombre d'ex æquo et tous les noms ; non départageable : message, aucun nom", () => {
    const html = rendre({ revele: true, convictions: null, combine: resultat("c", [gagnant("A", "Nom-A", "sa"), gagnant("B", "Nom-B", "sb")]) });
    expect(html).toContain("2 candidats à égalité");
    expect(html).toContain("Nom-A");
    expect(html).toContain("Nom-B");
    const nul = rendre({ revele: true, convictions: null, combine: resultat("c", [gagnant("A", "Nom-Centre-A", "sa")], { departageable: false }) });
    expect(nul).toContain("Égalité parfaite");
    expect(nul).not.toContain("Nom-Centre-A");
  });
  it("tous les candidats avec données sont écartés : le dit, au lieu de « données insuffisantes »", () => {
    const ecartes = resultat("Selon vos convictions", [], { departageable: false, ecartes: 3, tousEcartes: true });
    const html = rendre({ revele: true, situation: null, convictions: ecartes, combine: ecartes });
    expect(html).toContain("Tous les candidats étudiés sont écartés");
    expect(html).not.toContain("ne permettent pas de départager");
  });
  it("candidats écartés par l'intégrité : le nombre n'est pas rappelé sous le résultat", () => {
    const html = rendre({ revele: true, convictions: resultat("Selon vos convictions", [gagnant("F", "N", "s")], { ecartes: 4 }) });
    expect(html).not.toContain("écartés (condamnation");
    expect(html).not.toContain("4 candidats écartés");
  });
  it("la règle du score est derrière un bouton d'aide (même floutée), pas écrite sous la card", () => {
    for (const revele of [true, false]) {
      const html = rendre({ revele });
      expect(html).toContain("Comment est calculé le score ?");
      expect(html).not.toContain("role=\"dialog\"");
      expect(html).not.toContain("ne compte plus qu");
    }
  });
  it("pas de pied de card une fois révélée : ni phrase de conclusion ni bouton Recommencer", () => {
    const html = rendre({ revele: true });
    expect(html).not.toContain("Recommencer la simulation");
    expect(html).not.toContain("Voici votre candidat idéal");
  });
  it("ne montre pas le parti « non renseigné par la source »", () => {
    const g: GagnantAffiche = { ...gagnant("A", "Nom-A", "sa"), identite: { slug: "sa", nom: "Nom-A", parti: "non renseigné par la source" } };
    expect(rendre({ revele: true, convictions: null, combine: resultat("c", [g]) })).not.toContain("non renseigné");
  });
});

describe("Aide « Comment est calculé le score ? »", () => {
  const html = renderToStaticMarkup(<ModaleAideScore onFermer={() => {}} />);
  it("fenêtre modale en sections courtes : situation, convictions, classements, jauge, mesures, bon à savoir", () => {
    for (const t of ['role="dialog"', "Selon votre situation", "Selon vos convictions", "Les classements", "La jauge", "Les mesures d&#x27;un candidat", "Bon à savoir", "Fermer l&#x27;aide"]) expect(html, t).toContain(t);
    expect(html.match(/<h3>/g)).toHaveLength(6);
  });
  it("dit la règle : points, cumul au centre, 5 meilleurs, jauge, ex æquo, même règle pour tous", () => {
    for (const t of ["rapporte 1 point", "fait perdre 1 point", "1 point en moins", "additionnés", "3 meilleures places de chaque critère", "8 favorables et 3 défavorables font +5", "tous les candidats concernés sont montrés", "même pour tous", "Les onglets en haut de la fenêtre"]) expect(html, t).toContain(t);
  });
  it("aucun tiret cadratin dans le texte", () => {
    expect(html).not.toContain("—");
  });
});

describe("Top : une ligne par place", () => {
  const g = (lettre: string, nom: string, solde: number, ameliorants: number, degradants: number): GagnantAffiche => ({ ...gagnant(lettre, nom, `s-${lettre}`, solde), ameliorants, degradants });
  const top = (lignes: Array<GagnantAffiche & { rang: number }>) => resultat("Selon votre situation", [lignes[0]], { classement: lignes });
  it("trois places donnent trois lignes, même avec des égalités : les ex æquo restent dans la même ligne, sans nom", () => {
    const t = top([{ ...g("A", "Nom-A", 5, 5, 0), rang: 1 }, { ...g("B", "Nom-B", 4, 4, 0), rang: 2 }, { ...g("D", "Nom-D", 4, 4, 0), rang: 2 }, { ...g("E", "Nom-E", 4, 4, 0), rang: 2 }, { ...g("F", "Nom-F", 3, 3, 0), rang: 3 }]);
    const html = rendre({ revele: true, situation: t, convictions: null });
    expect(html.match(/class="ideal-ligne"[^>]*aria-haspopup/g)).toHaveLength(3);
    expect(html).toContain("3 candidats<");
    expect(html).not.toContain("à égalité");
    expect(html).not.toContain("ideal-puce");
  });
  it("floutée, une ligne à égalité dit « X candidats » avec des portraits anonymes, sans aucun nom", () => {
    const t = top([{ ...g("B", "Nom-B", 4, 4, 0), rang: 1 }, { ...g("D", "Nom-D", 4, 4, 0), rang: 1 }]);
    const html = rendre({ revele: false, situation: t, convictions: null });
    expect(html).toContain("2 candidats<");
    expect(html).not.toContain("Nom-");
  });
  it("égalité de score avec des points différents : une jauge sans barres (le score seul), jamais les barres d'un seul", () => {
    const t = top([{ ...g("A", "Nom-A", 2, 3, 1), rang: 1 }, { ...g("B", "Nom-B", 2, 2, 0), rang: 1 }]);
    const html = rendre({ revele: true, situation: t, convictions: null });
    const place = html.slice(html.indexOf('class="ideal-ligne"'), html.indexOf("ideal-colonne--droite"));
    expect(place).toContain("+2");
    expect(place).not.toContain("ideal-jauge-barre");
  });
  it("égalité avec les mêmes points : les barres sont partagées", () => {
    const t = top([{ ...g("A", "Nom-A", 2, 2, 0), rang: 1 }, { ...g("B", "Nom-B", 2, 2, 0), rang: 1 }]);
    const html = rendre({ revele: true, situation: t, convictions: null });
    expect(html).toContain("ideal-jauge-barre--pos");
  });
});

describe("Jauge", () => {
  it("montre à la fois le vert (favorables, à droite) et le rouge (défavorables, à gauche), et le net écrit est leur différence", () => {
    const html = renderToStaticMarkup(<Jauge ameliorants={8} degradants={3} echelle={16} />);
    expect(html).toMatch(/ideal-jauge-barre--pos[^>]*width:25%/);
    expect(html).toMatch(/ideal-jauge-barre--neg[^>]*width:9\.375%/);
    expect(html).toContain("+5");
    expect(html).not.toContain("8 − 3");
  });
  it("net négatif ou nul : signe écrit, les deux barres restent affichées", () => {
    expect(renderToStaticMarkup(<Jauge ameliorants={1} degradants={3} echelle={6} />)).toContain("−2");
    const nul = renderToStaticMarkup(<Jauge ameliorants={2} degradants={2} echelle={6} />);
    expect(nul).toContain(">0<");
    expect(nul).toMatch(/barre--pos[^>]*width:16\.6/);
    expect(nul).toMatch(/barre--neg[^>]*width:16\.6/);
  });
  it("une barre ne dépasse jamais la moitié de la piste", () => {
    expect(renderToStaticMarkup(<Jauge ameliorants={9} degradants={0} echelle={3} />)).toContain("width:50%");
  });
  it("nom accessible : le score et son calcul, en mots", () => {
    expect(renderToStaticMarkup(<Jauge ameliorants={8} degradants={3} echelle={16} />)).toContain('aria-label="Score +5 : 8 favorables moins 3 défavorables, sur 16 étudiés"');
  });
});

describe("Détail d'une ligne (fenêtre)", () => {
  const ligne = { ...gagnant("C", "Nom-Reel-Situation", "slug-reel-a", 3), rang: 1 };
  it("fenêtre modale : nom, parti, score, rang et mesures ; bouton de fermeture", () => {
    const html = renderToStaticMarkup(<ModaleDetail ligne={ligne} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    for (const t of ["role=\"dialog\"", "aria-modal=\"true\"", "Nom-Reel-Situation", "Parti-test", "Mesure-pour", "Mesure-contre", "Favorables à votre situation", "Défavorables à votre situation", "Fermer le détail"]) expect(html, t).toContain(t);
    // Ni le critère ni le score et le rang : ils sont déjà dans la ligne cliquée.
    expect(html).not.toContain("du classement");
    expect(html).not.toContain("score +3");
  });
  it("onglets en haut : groupes de mesures et mesures, chacun avec son nombre ; groupes sélectionnés au départ ; pas de bouton de bascule ni de « Voir plus »", () => {
    const l = { ...ligne, pour: [{ theme: "logement", groupes: ["G1", "G2"], mesures: ["Mes-un", "Mes-deux", "Mes-trois"] }], contre: [{ theme: "retraite", groupes: ["G3"], mesures: ["Mes-quatre"] }] };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>Groupes de mesures <span class="ideal-onglet-nombre">3</);
    expect(html).toMatch(/aria-selected="false"[^>]*>Mesures <span class="ideal-onglet-nombre">4</);
    expect(html.indexOf("ideal-onglets")).toBeLessThan(html.indexOf("ideal-badges"));
    for (const t of ["G1", "G2", "G3"]) expect(html, t).toContain(t);
    expect(html).not.toContain("Mes-un");
    expect(html).not.toContain("ideal-voir-mesures");
    expect(html).not.toContain("ideal-voir-plus");
  });
  it("au-dessus des onglets : les deux phrases de total (groupes puis mesures), et elles ne sont pas répétées sous les onglets", () => {
    const l = { ...ligne, pour: [{ theme: "logement", groupes: ["G1", "G2"], mesures: ["Mes-un", "Mes-deux", "Mes-trois"] }], contre: [{ theme: "retraite", groupes: ["G3"], mesures: ["Mes-quatre"] }] };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    const groupes = "Au total : 2 groupes de mesures favorables à votre situation, 1 groupe de mesures défavorable à votre situation.";
    const mesures = "Au total : 3 mesures favorables à votre situation, 1 mesure défavorable à votre situation.";
    expect(html).toContain(groupes);
    expect(html).toContain(mesures);
    expect(html.indexOf(groupes)).toBeLessThan(html.indexOf(mesures));
    expect(html.indexOf(mesures)).toBeLessThan(html.indexOf('role="tablist"'));
    expect(html.match(/Au total/g)).toHaveLength(2);
  });
  it("égalité : des onglets, un par candidat de la ligne, avec le premier sélectionné ; pas d'onglets pour un seul candidat", () => {
    const b = { ...gagnant("D", "Nom-Deux", "slug-d", 3), rang: 1 };
    const html = renderToStaticMarkup(<ModaleDetail ligne={ligne} egales={[ligne, b]} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).toContain('aria-label="Candidats à égalité"');
    expect(html).toMatch(/role="tab" class="ideal-egale" aria-selected="true"[^>]*>(<span[\s\S]*?<\/span>)?Nom-Reel-Situation</);
    expect(html).toMatch(/role="tab" class="ideal-egale" aria-selected="false"[^>]*>(<span[\s\S]*?<\/span>)?Nom-Deux</);
    // Le nom n'est pas répété en titre (il est dans l'onglet) ; le parti est un badge dans chaque onglet.
    expect(html).toContain('<h2 id="modale-ideal-titre">Candidats à égalité</h2>');
    expect(html).not.toContain("ideal-modale-titre");
    expect(html.match(/class="detail-parti ideal-egale-parti">Parti-test</g)).toHaveLength(2);
    expect(html.match(/Nom-Reel-Situation/g)).toHaveLength(1);
    // Un seul candidat : le nom reste en titre.
    expect(renderToStaticMarkup(<ModaleDetail ligne={ligne} unite="thèmes" critere="c" onFermer={() => {}} />)).toContain("ideal-modale-titre");
    expect(renderToStaticMarkup(<ModaleDetail ligne={ligne} egales={[ligne]} unite="thèmes" critere="c" onFermer={() => {}} />)).not.toContain("ideal-egale");
    expect(renderToStaticMarkup(<ModaleDetail ligne={ligne} unite="thèmes" critere="c" onFermer={() => {}} />)).not.toContain("ideal-egale");
  });
  it("tout est montré dans la fenêtre, même au-delà de trois badges", () => {
    const l = { ...ligne, pour: [{ theme: "logement", groupes: ["G1", "G2", "G3", "G4", "G5"], mesures: [] }], contre: [] };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="c" onFermer={() => {}} />);
    expect(html.match(/class="ideal-badge ideal-badge--/g)).toHaveLength(5);
  });
  it("sans identité (floutée) : rien n'est rendu", () => {
    expect(renderToStaticMarkup(<ModaleDetail ligne={{ ...ligne, identite: null }} unite="thèmes" critere="c" onFermer={() => {}} />)).toBe("");
  });
  it("convictions : intitulés « proches / opposées à vos convictions »", () => {
    const html = renderToStaticMarkup(<ModaleDetail ligne={ligne} unite="sujets" critere="Selon vos convictions" onFermer={() => {}} />);
    expect(html).toContain("Proches de vos convictions");
    expect(html).toContain("Opposées à vos convictions");
  });
});

describe("PoursContres", () => {
  const beaucoup = (theme: string, n: number) => [{ theme, groupes: Array.from({ length: n }, (_, i) => `Groupe-${theme}-${i}`), mesures: [] }];
  const point = { theme: "logement", groupes: ["Groupe-A"], mesures: ["Mesure-A1", "Mesure-A2"] };
  it("les badges « pour » précèdent les badges « contre » dans une seule liste, sens dit en mots, sans signe + ou −", () => {
    const html = renderToStaticMarkup(<PoursContres pour={gagnant("C", "N", "s").pour} contre={gagnant("C", "N", "s").contre} unite="thèmes" />);
    expect(html.match(/class="ideal-badges"/g)).toHaveLength(1);
    expect(html.indexOf("ideal-badge--pour")).toBeLessThan(html.indexOf("ideal-badge--contre"));
    expect(html).not.toContain("ideal-badge-signe");
  });
  it("devant chaque mesure : l'icône du thème, jamais son titre", () => {
    const html = renderToStaticMarkup(<PoursContres pour={gagnant("C", "N", "s").pour} contre={gagnant("C", "N", "s").contre} unite="thèmes" />);
    expect(html).toContain("ideal-raison-icone");
    expect(html).not.toContain("Mon logement");
    expect(html).not.toContain("Ma retraite");
  });
  it("au plus 3 badges par colonne, et un seul bouton « Voir plus » pour les deux colonnes", () => {
    const html = renderToStaticMarkup(<PoursContres pour={beaucoup("logement", 5)} contre={beaucoup("retraite", 4)} unite="thèmes" />);
    expect(html.match(/class="ideal-badge ideal-badge--/g)).toHaveLength(6);
    expect(html.match(/class="secondaire ideal-voir-plus"/g)).toHaveLength(1);
    // 5 pour et 4 contre, 3 visibles de chaque côté : 2 + 1 badges de plus.
    expect(html).toContain("Voir plus (3 autres)");
    expect(html).not.toContain("Groupe-logement-3");
    expect(html).not.toContain("Groupe-retraite-3");
  });
  it("bouton « Voir les mesures » : bascule des groupes de mesures aux mesures elles-mêmes", () => {
    const html = renderToStaticMarkup(<PoursContres pour={[point]} contre={[]} unite="thèmes" />);
    expect(html).toContain("Voir les mesures");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Groupe-A");
    expect(html).not.toContain("Mesure-A1");
    const parMesure = renderToStaticMarkup(<PoursContres pour={[point]} contre={[]} unite="thèmes" parMesureInitial />);
    expect(parMesure).toContain("Mesure-A1");
    expect(parMesure).toContain("Mesure-A2");
    expect(parMesure).not.toContain("Groupe-A");
    expect(parMesure).toContain("Voir les groupes de mesures");
    expect(parMesure).toContain('aria-pressed="true"');
    // Le total parle alors de mesures.
    expect(renderToStaticMarkup(<PoursContres pour={[point]} contre={[]} unite="thèmes" parMesureInitial deplieInitial />)).toContain("Au total : 2 mesures favorables à votre situation, 0 mesure défavorable à votre situation.");
    // Sous le flou : aucun bouton.
    expect(renderToStaticMarkup(<PoursContres pour={[point]} contre={[]} unite="thèmes" interactif={false} />)).not.toContain("Voir les mesures");
  });
  it("une fois déplié : tous les badges, le total de groupes pour et contre, et « Voir moins »", () => {
    const html = renderToStaticMarkup(<PoursContres pour={beaucoup("logement", 5)} contre={beaucoup("retraite", 1)} unite="thèmes" deplieInitial />);
    expect(html.match(/class="ideal-badge ideal-badge--/g)).toHaveLength(6);
    expect(html).toContain("Au total : 5 groupes de mesures favorables à votre situation, 1 groupe de mesures défavorable à votre situation.");
    expect(html).toContain("Voir moins");
    // Replié, le total n'est pas répété (les listes sont courtes à lire).
    expect(renderToStaticMarkup(<PoursContres pour={beaucoup("logement", 5)} contre={beaucoup("retraite", 1)} unite="thèmes" />)).not.toContain("Au total");
  });
  it("pas de bouton « Voir plus » quand tout tient en 3 badges", () => {
    expect(renderToStaticMarkup(<PoursContres pour={gagnant("C", "N", "s").pour} contre={gagnant("C", "N", "s").contre} unite="thèmes" />)).not.toContain("ideal-voir-plus");
  });
});
