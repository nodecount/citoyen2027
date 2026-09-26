import { describe, expect, it } from "vitest";
import { DIMENSIONS_EFFET } from "../effets";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import type { Projection } from "../engine/projection";
import { DIMENSIONS_LIBELLES, NIVEAUX, decrireEffet, libelleChamp, messagesIncertitude, messagesSansBadge } from "./projection";

function proposition(effets: Effet[] | undefined): Proposition {
  return {
    id: "x-1",
    candidat: "x",
    theme: "fiscalite",
    titre: "Mesure",
    resume_factuel: "Résumé",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-24",
    effets,
  };
}

function sansBadge(surcharge: Partial<Projection>): Projection {
  return { niveau: null, raisons: [], champsManquants: [], effetsRetenus: [], incertain: false, ...surcharge };
}

describe("NIVEAUX", () => {
  it("définit exactement les quatre niveaux, chacun avec un libellé et un symbole distincts", () => {
    expect(Object.keys(NIVEAUX).sort()).toEqual(["ameliorant", "degradant", "mixte", "non_concerne"]);
    const symboles = Object.values(NIVEAUX).map((n) => n.symbole);
    expect(new Set(symboles).size).toBe(4);
    expect(NIVEAUX.ameliorant.libelle).toBe("Améliorant");
    expect(NIVEAUX.non_concerne.libelle).toBe("Non concerné");
  });
});

describe("decrireEffet", () => {
  it("décrit la grandeur et le sens en langage courant, sans jugement", () => {
    const effet: Effet = { cibles: [], dimension: "revenu_disponible", sens: "baisse", source_url: "u", extrait: "e" };
    expect(decrireEffet(effet)).toBe("Revenu disponible en baisse");
  });

  it("traite le sens indéterminé", () => {
    const effet: Effet = { cibles: [], dimension: "emploi", sens: "indetermine", source_url: "u", extrait: "e" };
    expect(decrireEffet(effet)).toBe("Emploi, sens non déterminé");
  });

  it("a un libellé pour chaque dimension", () => {
    for (const dimension of DIMENSIONS_EFFET) expect(DIMENSIONS_LIBELLES[dimension].length).toBeGreaterThan(0);
  });
});

describe("libelleChamp", () => {
  it("reprend l'intitulé du formulaire citoyen, ou le nom du champ à défaut", () => {
    expect(libelleChamp("logement")).toBe("Statut de logement");
    expect(libelleChamp("enfants_a_charge")).toBe("Enfants à charge");
    expect(libelleChamp("inconnu")).toBe("inconnu");
  });
});

describe("messagesSansBadge", () => {
  it("demande de renseigner le champ manquant, par son intitulé", () => {
    const messages = messagesSansBadge(
      sansBadge({ raisons: ["informations_manquantes"], champsManquants: ["logement"] }),
      [proposition([])],
    );
    expect(messages).toEqual(["Renseignez « Statut de logement » pour affiner cet indicateur."]);
  });

  it("explique qu'un public non identifiable par le formulaire empêche la projection", () => {
    const messages = messagesSansBadge(sansBadge({ raisons: ["critere_hors_formulaire"] }), [proposition([])]);
    expect(messages[0]).toContain("formulaire");
  });

  it("explique qu'un programme ne permet pas de déterminer l'effet", () => {
    const messages = messagesSansBadge(sansBadge({ raisons: ["effet_non_determinable"] }), [proposition([])]);
    expect(messages[0]).toContain("déterminer");
  });

  it("distingue des mesures pas encore analysées (anciennes données) de mesures analysées sans effet déterminable", () => {
    const pasAnalysees = messagesSansBadge(sansBadge({ raisons: ["aucun_effet_determine"] }), [proposition(undefined)]);
    const analysees = messagesSansBadge(sansBadge({ raisons: ["aucun_effet_determine"] }), [proposition([])]);
    expect(pasAnalysees[0]).toContain("pas encore");
    expect(analysees[0]).toContain("programme publié");
    expect(pasAnalysees[0]).not.toBe(analysees[0]);
  });

  it("cumule plusieurs raisons, dans un ordre stable", () => {
    const messages = messagesSansBadge(
      sansBadge({ raisons: ["effet_non_determinable", "informations_manquantes"], champsManquants: ["logement", "tranche_age"] }),
      [proposition([])],
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("Statut de logement");
    expect(messages[0]).toContain("Tranche d'âge");
  });

  it("ne renvoie rien quand il y a un badge", () => {
    expect(messagesSansBadge({ niveau: "ameliorant", raisons: [], champsManquants: [], effetsRetenus: [], incertain: false }, [])).toEqual([]);
  });
});

describe("messagesIncertitude", () => {
  it("ne dit rien quand l'indicateur ne vient pas d'une incertitude", () => {
    expect(messagesIncertitude(sansBadge({ niveau: "mixte" }))).toEqual([]);
    expect(messagesIncertitude(sansBadge({ niveau: "ameliorant" }))).toEqual([]);
  });

  it("explique le « mixte » par prudence et nomme ce qu'il faut préciser", () => {
    const messages = messagesIncertitude(sansBadge({ niveau: "mixte", incertain: true, raisons: ["informations_manquantes"], champsManquants: ["logement"] }));
    expect(messages[0]).toContain("par prudence");
    expect(messages[0]).toContain("mixte");
    expect(messages[1]).toContain("Statut de logement");
  });

  it("signale un public que le formulaire ne sait pas décrire", () => {
    const messages = messagesIncertitude(sansBadge({ niveau: "mixte", incertain: true, raisons: ["critere_hors_formulaire"] }));
    expect(messages.join(" ")).toContain("formulaire");
  });
});
