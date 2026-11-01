import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColonneTop, Jauge, JaugeNote, ModaleAideScore, ModaleDetail, PoursContres, RondScore, type GagnantAffiche, type ResultatAffiche } from "./CardCandidatIdeal";

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

// Les deux tops (situation, convictions) tels que les montrent les onglets « Candidats » ; `revele` faux sert à vérifier l'anonymat.
const rendre = (p: { revele: boolean; situation: ResultatAffiche | null; convictions: ResultatAffiche | null }) =>
  renderToStaticMarkup(
    <>
      {p.situation && <ColonneTop resultat={p.situation} revele={p.revele} onOuvrir={() => {}} />}
      {p.convictions && <ColonneTop resultat={p.convictions} revele={p.revele} onOuvrir={() => {}} />}
    </>,
  );
describe("Aide « Comment est suggéré le candidat ? »", () => {
  const html = renderToStaticMarkup(<ModaleAideScore onFermer={() => {}} />);
  it("fenêtre modale lisible en 30 secondes : candidat suggéré (combinaison) d'abord, score d'un candidat, précision, bon à savoir", () => {
    for (const t of ['role="dialog"', "Le candidat suggéré", "Le score d&#x27;un candidat", "Bon à savoir", "La précision", "Fermer l&#x27;aide"]) expect(html, t).toContain(t);
    // 30 secondes de lecture : une centaine de mots au plus (hors titre et bouton de fermeture).
    const mots = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    expect(mots).toBeLessThanOrEqual(110);
    expect(html.indexOf("Le candidat suggéré")).toBeLessThan(html.indexOf("Le score d&#x27;un candidat"));
    expect(html).toContain("Plus vous répondez aux questions, plus la suggestion est précise.");
    expect(html).not.toContain("pas si le résultat est fiable");
    expect(html.match(/<h3>/g)).toHaveLength(4);
    expect(html).toContain("Comment est suggéré le candidat ?");
  });
  it("dit la règle : points, cumul au centre, 5 meilleurs, jauge, ex æquo, même règle pour tous", () => {
    for (const t of ["rapporte 1 point au candidat", "lui retire 1 point", "additionnés", "3 meilleures places", "La règle est la même pour tous", "page « À propos »"]) expect(html, t).toContain(t);
  });
  it("n'explique plus la barre dans l'aide : l'explication du score est dans la fenêtre de détail", () => {
    expect(html).not.toContain("La barre de score");
    expect(html).not.toContain("La barre part de la gauche");
    expect(html).not.toContain("Les mesures d&#x27;un candidat");
  });
  it("ne dit plus « une fois par thème » ni « tous les candidats concernés sont montrés »", () => {
    expect(html).not.toContain("qu'une fois par thème");
    expect(html).not.toContain("tous les candidats concernés sont montrés");
  });
  it("aucun tiret cadratin dans le texte", () => {
    expect(html).not.toContain("—");
  });
});

describe("Top : une ligne par place", () => {
  const g = (lettre: string, nom: string, solde: number, ameliorants: number, degradants: number): GagnantAffiche => ({ ...gagnant(lettre, nom, `s-${lettre}`, solde), ameliorants, degradants });
  const top = (lignes: Array<GagnantAffiche & { rang: number; note?: number }>) => resultat("Selon votre situation", [lignes[0]], { classement: lignes });
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
  it("la barre du top est notée sur 100 : le chiffre et la largeur suivent la note, sans négatif", () => {
    const t = top([{ ...g("A", "Nom-A", 5, 5, 0), rang: 1, note: 40 }, { ...g("B", "Nom-B", 0, 1, 1), rang: 2, note: 0 }]);
    const html = rendre({ revele: true, situation: t, convictions: null });
    expect(html).toContain('aria-label="Score 40 sur 100"');
    expect(html).toContain('aria-label="Score 0 sur 100"');
    expect(html).toMatch(/ideal-note-barre" style="width:40%"/);
    expect(html).toContain("/100");
    expect(html).not.toContain("ideal-jauge");
  });
  it("dans les deux colonnes, tout est aligné à gauche : une seule disposition, sans variante miroir", () => {
    const gauche = top([{ ...g("A", "Nom-A", 5, 5, 0), rang: 1, note: 40 }]);
    const droite = resultat("Selon vos convictions", [g("F", "Nom-F", 3, 3, 0)], { classement: [{ ...g("F", "Nom-F", 3, 3, 0), rang: 1, note: 20 }], unite: "sujets" });
    const html = rendre({ revele: true, situation: gauche, convictions: droite });
    expect(html).not.toContain("ideal-ligne--");
    expect(html).not.toContain("ideal-note--");
    expect(html.match(/class="ideal-note"/g)).toHaveLength(2);
  });
  it("égalité de score : une seule note pour toute la ligne", () => {
    const t = top([{ ...g("A", "Nom-A", 2, 3, 1), rang: 1, note: 12 }, { ...g("B", "Nom-B", 2, 2, 0), rang: 1, note: 12 }]);
    const html = rendre({ revele: true, situation: t, convictions: null });
    expect(html.match(/class="ideal-note"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Score 12 sur 100"');
  });
});

describe("RondScore dans la fenêtre de détail", () => {
  it("le rond rappelle la note sur 100 : contour rempli à la hauteur de la note, chiffre au centre", () => {
    const html = renderToStaticMarkup(<RondScore note={40} />);
    expect(html).toContain('aria-label="Score 40 sur 100"');
    expect(html).toContain('stroke-dasharray="40 100"');
    expect(html).toContain('pathLength="100"');
    expect(html).toContain(">40<");
  });
  it("bornée de 0 à 100", () => {
    expect(renderToStaticMarkup(<RondScore note={250} />)).toContain('stroke-dasharray="100 100"');
    expect(renderToStaticMarkup(<RondScore note={-3} />)).toContain('stroke-dasharray="0 100"');
  });
  it("la fenêtre de détail affiche le rond du candidat ouvert, dans son en-tête", () => {
    const l = { ...gagnant("C", "Nom-Reel-Situation", "slug-reel-a", 3), rang: 1, note: 37 };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).toContain('aria-label="Score 37 sur 100"');
    expect(html.indexOf("ideal-rond")).toBeLessThan(html.indexOf('aria-label="Fermer le détail"'));
    expect(html.indexOf("ideal-rond")).toBeLessThan(html.indexOf("ideal-totaux"));
  });
  const base = { ...gagnant("C", "Nom-Reel-Situation", "slug-reel-a", 3), rang: 1 };
  const quatre = [{ theme: "logement", groupes: ["G1"], mesures: ["M1", "M2", "M3", "M4"] }];
  it("à droite du rond : « 4/4 des mesures vous avantagent » ; une note sous 100 est expliquée par le candidat qui a le plus de mesures", () => {
    const l = { ...base, pour: quatre, contre: [], note: 50, reference: 8 };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).toMatch(/<strong>4\/4<\/strong>\s*des mesures vous avantagent\./);
    expect(html).toContain("Le 100 correspond à 8 mesures, le maximum chez un candidat : 4 sur 8, soit 50/100.");
    expect(html).not.toContain("Le score va de 0 à 100");
    expect(html.indexOf("des mesures vous avantagent")).toBeLessThan(html.indexOf("ideal-totaux"));
  });
  it("note à 100 : la seconde phrase n'a pas lieu d'être ; sans mesure concernée : une phrase le dit", () => {
    const cent = renderToStaticMarkup(<ModaleDetail ligne={{ ...base, pour: quatre, contre: [], note: 100, reference: 4 }} unite="thèmes" critere="c" onFermer={() => {}} />);
    expect(cent).toContain("4/4");
    expect(cent).not.toContain("Le 100 correspond");
    const aucune = renderToStaticMarkup(<ModaleDetail ligne={{ ...base, pour: [], contre: [], note: 0, reference: 8 }} unite="thèmes" critere="c" onFermer={() => {}} />);
    expect(aucune).toContain("Aucune mesure ne vous concerne chez ce candidat.");
  });
  it("avec des mesures défavorables : le compte part des favorables sur toutes les mesures, la note reste celle du score", () => {
    const l = { ...base, pour: [{ theme: "logement", groupes: ["G1"], mesures: ["M1", "M2"] }], contre: [{ theme: "retraite", groupes: ["G2"], mesures: ["M3"] }], note: 33, reference: 3 };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="c" onFermer={() => {}} />);
    expect(html).toMatch(/<strong>2\/3<\/strong>/);
    expect(html).toContain("Le 100 correspond à 3 mesures, le maximum chez un candidat : 1 sur 3, soit 33/100.");
  });
  it("convictions : « vont dans le sens de vos convictions », pas de votre situation", () => {
    const html = renderToStaticMarkup(<ModaleDetail ligne={{ ...base, pour: quatre, contre: [], note: 100, reference: 4 }} unite="sujets" critere="Selon vos convictions" onFermer={() => {}} />);
    expect(html).toContain("des mesures vont dans le sens de vos convictions");
    expect(html).not.toContain("vous avantagent");
  });
  it("égalité : le rond suit le candidat sélectionné (même score, donc même note)", () => {
    const a = { ...gagnant("C", "Nom-A", "sa", 3), rang: 1, note: 37 };
    const b = { ...gagnant("D", "Nom-B", "sb", 3), rang: 1, note: 37 };
    const html = renderToStaticMarkup(<ModaleDetail ligne={a} egales={[a, b]} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html.match(/class="ideal-rond"/g)).toHaveLength(1);
  });
});

describe("JaugeNote", () => {
  it("est bornée de 0 à 100 et écrit le chiffre", () => {
    expect(renderToStaticMarkup(<JaugeNote note={130} />)).toContain("width:100%");
    expect(renderToStaticMarkup(<JaugeNote note={-5} />)).toContain("width:0%");
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
    expect(renderToStaticMarkup(<Jauge ameliorants={8} degradants={3} echelle={16} />)).toContain('aria-label="Score +5 : 8 favorables moins 3 défavorables"');
  });
});

describe("Détail d'une ligne (fenêtre)", () => {
  const ligne = { ...gagnant("C", "Nom-Reel-Situation", "slug-reel-a", 3), rang: 1 };
  it("fenêtre modale : nom, parti, score, rang et mesures ; bouton de fermeture", () => {
    const html = renderToStaticMarkup(<ModaleDetail ligne={ligne} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    for (const t of ["role=\"dialog\"", "aria-modal=\"true\"", "Nom-Reel-Situation", "Parti-test", "Mesure-pour", "Favorables <", "Défavorables <", "Fermer le détail"]) expect(html, t).toContain(t);
    expect(html).not.toContain("Mesure-contre"); // les défavorables sont dans leur onglet
    // Ni le critère ni le score et le rang : ils sont déjà dans la ligne cliquée.
    expect(html).not.toContain("du classement");
    expect(html).not.toContain("score +3");
  });
  it("onglets en haut : favorables et défavorables, chacun avec son nombre en groupes de mesures ; favorables au départ ; bouton discret vers le détail par mesure", () => {
    const l = { ...ligne, pour: [{ theme: "logement", groupes: ["G1", "G2"], mesures: ["Mes-un", "Mes-deux", "Mes-trois"] }], contre: [{ theme: "retraite", groupes: ["G3"], mesures: ["Mes-quatre"] }] };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/aria-selected="true"[^>]*>Favorables <span class="ideal-onglet-nombre">2</);
    expect(html).toMatch(/aria-selected="false"[^>]*>Défavorables <span class="ideal-onglet-nombre">1</);
    expect(html.indexOf("ideal-onglets")).toBeLessThan(html.indexOf("ideal-badges"));
    for (const t of ["G1", "G2"]) expect(html, t).toContain(t);
    expect(html).not.toContain("G3"); // dans l'onglet des défavorables
    expect(html).not.toContain("Mes-un"); // groupes de mesures au départ
    expect(html).toContain("Voir le détail par mesure");
    expect(html).not.toContain("ideal-voir-plus");
  });
  it("au-dessus des onglets : une seule jauge de total, en groupes de mesures au départ", () => {
    const l = { ...ligne, pour: [{ theme: "logement", groupes: ["G1", "G2"], mesures: ["Mes-un", "Mes-deux", "Mes-trois"] }], contre: [{ theme: "retraite", groupes: ["G3"], mesures: ["Mes-quatre"] }] };
    const html = renderToStaticMarkup(<ModaleDetail ligne={l} unite="thèmes" critere="Selon votre situation" onFermer={() => {}} />);
    expect(html).not.toContain("Au total");
    const jauges = html.match(/aria-label="Score [^"]*favorable[^"]*"/g) ?? [];
    expect(jauges).toEqual(['aria-label="Score +1 : 2 favorables moins 1 défavorable"']);
    expect(html.indexOf("ideal-total-libelle")).toBeLessThan(html.indexOf('role="tablist"'));
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
    expect(html).toMatch(/>Proches <span class="ideal-onglet-nombre">/);
    expect(html).toMatch(/>Opposées <span class="ideal-onglet-nombre">/);
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
  it("la première lettre d'un groupe de mesures est une majuscule, pas celle du titre d'une mesure", () => {
    const p = [{ theme: "logement", groupes: ["baisse des loyers"], mesures: ["encadrement des loyers"] }];
    expect(renderToStaticMarkup(<PoursContres pour={p} contre={[]} unite="thèmes" />)).toContain(">Baisse des loyers<");
    expect(renderToStaticMarkup(<PoursContres pour={p} contre={[]} unite="thèmes" parMesureImpose />)).toContain(">encadrement des loyers<");
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
