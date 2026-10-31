import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GagnantAffiche, ResultatAffiche } from "./CardCandidatIdeal";
import { EcranDeuxZones } from "./EcranDeuxZones";
import { apresRevelation, ONGLETS_QUESTIONS } from "./etatZones";

const gagnant = (lettre: string, nom: string, slug: string): GagnantAffiche => ({
  lettre,
  identite: { slug, nom, parti: "Parti-test" },
  ameliorants: 3,
  degradants: 1,
  analyses: 7,
  solde: 2,
  pour: [],
  contre: [],
});
const resultat = (titre: string, g: GagnantAffiche, unite: "thèmes" | "sujets" = "thèmes"): ResultatAffiche => ({
  titre,
  unite,
  gagnants: [g],
  classement: [{ ...g, rang: 1, note: 80 }],
  solde: 2,
  departageable: true,
  ecartes: 0,
  tousEcartes: false,
});
const SIT = resultat("Selon votre situation", gagnant("A", "Nom-Reel-Sit", "slug-sit"));
const CONV = resultat("Selon vos convictions", gagnant("B", "Nom-Reel-Conv", "slug-conv"), "sujets");
const COMB = resultat("Selon votre situation et vos convictions", gagnant("A", "Nom-Reel-Centre", "slug-centre"));

const base = {
  situation: { repondues: 0, total: 18 },
  convictions: { repondues: 0, total: 35 },
  resultatSituation: null,
  resultatConvictions: null,
  combine: null,
  positionsChoisies: false,
  revele: false,
  onglets: ONGLETS_QUESTIONS,
  mesuresAccessibles: false,
  peutEffacerReponses: false,
  peutEffacerConvictions: false,
  onReveler: () => {},
  onRevenir: () => {},
  onChoisirOnglet: () => {},
  onOuvrir: () => {},
  onEffacerReponses: () => {},
  onEffacerConvictions: () => {},
};
const rendre = (p: Partial<Parameters<typeof EcranDeuxZones>[0]> = {}) => renderToStaticMarkup(<EcranDeuxZones {...base} {...p} />);

describe("EcranDeuxZones", () => {
  it("départ : deux « Commencer », compteurs à zéro, « Révéler » inactif, onglets Candidats verrouillés, pas de lien vers les mesures", () => {
    const html = rendre();
    expect(html.match(/Commencer/g)).toHaveLength(2);
    expect(html).toContain("0 question sur 18");
    expect(html).toContain("0 sujet sur 35");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toContain("Voir les mesures adaptées");
    expect(html).not.toContain("Effacer");
  });

  it("un côté rempli : « Continuer », lien vers les mesures, « Révéler » actif, source annoncée, effacements proposés", () => {
    const html = rendre({ situation: { repondues: 9, total: 18 }, mesuresAccessibles: true, peutEffacerReponses: true, combine: COMB });
    expect(html).toContain("Continuer");
    expect(html).toContain("Voir les mesures adaptées");
    expect(html).toContain("Calculé sur votre situation seule");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Révéler/);
    expect(html).toContain("Effacer mes réponses");
    expect(html).toContain("bouton-effacer");
    expect(html).not.toContain("Effacer mes convictions");
  });

  it("non révélé : aucune identité réelle dans la page, même si les résultats en portent", () => {
    const html = rendre({ situation: { repondues: 9, total: 18 }, resultatSituation: SIT, resultatConvictions: CONV, combine: COMB });
    for (const secret of ["Nom-Reel-Sit", "Nom-Reel-Conv", "Nom-Reel-Centre", "slug-sit", "slug-conv", "slug-centre", "Parti-test", "/candidats/"]) expect(html, secret).not.toContain(secret);
  });

  it("révélé : les deux classements remplacent les questions, bouton « Revenir aux questions »", () => {
    const html = rendre({ situation: { repondues: 9, total: 18 }, revele: true, onglets: apresRevelation(), resultatSituation: SIT, resultatConvictions: CONV, combine: COMB });
    for (const nom of ["Nom-Reel-Sit", "Nom-Reel-Conv", "Nom-Reel-Centre"]) expect(html).toContain(nom);
    expect(html).toContain("Revenir aux questions");
    expect(html).not.toContain("Commencer");
  });

  it("révélé, onglets indépendants : questions à gauche, classement des convictions à droite", () => {
    const html = rendre({ situation: { repondues: 9, total: 18 }, revele: true, onglets: { gauche: "questions", droite: "candidats" }, resultatSituation: SIT, resultatConvictions: CONV, combine: COMB });
    expect(html).not.toContain("Nom-Reel-Sit");
    expect(html).toContain("Nom-Reel-Conv");
    expect(html).toContain("Continuer");
  });

  it("révélé, sans résultat convictions : le classement de droite dit pourquoi", () => {
    const html = rendre({ revele: true, onglets: apresRevelation(), situation: { repondues: 9, total: 18 }, resultatSituation: SIT, combine: COMB });
    expect(html).toContain("choisissez au moins une position");
  });

  it("confirmation ouverte : titre, message de précision, boutons", () => {
    const html = rendre({ situation: { repondues: 9, total: 18 }, confirmationOuverteInitiale: true });
    expect(html).toContain("Révéler votre candidat idéal ?");
    expect(html).toContain("17 % de précision");
    expect(html).toContain("Oui, révéler");
    expect(html).toContain("Continuer à répondre");
  });

  it("propose l'aide sur le calcul du score", () => {
    expect(rendre()).toContain("Comment est suggéré le candidat ?");
  });
});
