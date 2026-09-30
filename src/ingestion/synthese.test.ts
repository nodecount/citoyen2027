import { describe, expect, it, vi } from "vitest";
import {
  SCHEMA_SYNTHESE,
  construireRequeteSynthese,
  construireRequeteVerificationSynthese,
  erreurSynthese,
  genererSynthese,
  motsEvaluatifsTrouves,
  verifierSyntheseParModele,
} from "./synthese";
import type { CandidatMeta, Proposition } from "../types";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function proposition(id: string, surcharge: Partial<Proposition> = {}): Proposition {
  return {
    id,
    candidat: "test",
    theme: "fiscalite",
    titre: `Mesure ${id}`,
    resume_factuel: "Le candidat propose une contribution sur les hauts revenus ; le seuil n'est pas précisé.",
    sources: [
      { type: "primaire", label: "Site officiel", url: "https://exemple-officiel.fr/a", nom: "exemple-officiel.fr", annee: 2026 },
      { type: "primaire", label: "Amendement", url: "https://www.assemblee-nationale.fr/x", nom: "Assemblée nationale", annee: 2021 },
    ],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-24",
    effets: [
      {
        cibles: [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }],
        dimension: "revenu_disponible",
        sens: "baisse",
        source_url: "https://exemple-officiel.fr/a",
        extrait: "contribution exceptionnelle sur les hauts revenus",
      },
    ],
    ...surcharge,
  };
}

const TEXTE_VALIDE =
  "Le programme prévoit une contribution supplémentaire sur les hauts revenus, dont le seuil n'est pas précisé. " +
  "Cette mesure vise les foyers de la tranche de revenus la plus élevée et réduirait leur revenu disponible.";

const IDS = ["test-fisc-001", "test-fisc-002"];

function synthese(surcharge: Record<string, unknown> = {}) {
  return { texte: TEXTE_VALIDE, propositions_utilisees: [...IDS], ...surcharge };
}

describe("erreurSynthese (contrôles déterministes)", () => {
  it("accepte une synthèse neutre qui couvre toutes les mesures", () => {
    expect(erreurSynthese(synthese(), IDS)).toBeNull();
  });

  it("refuse une synthèse qui omet une mesure : pas de sélection partielle qui favoriserait un angle", () => {
    expect(erreurSynthese(synthese({ propositions_utilisees: ["test-fisc-001"] }), IDS)).toContain("test-fisc-002");
  });

  it("refuse une synthèse qui invoque une mesure inconnue", () => {
    expect(erreurSynthese(synthese({ propositions_utilisees: [...IDS, "autre-999"] }), IDS)).toContain("autre-999");
  });

  it("refuse un texte trop court ou démesuré", () => {
    expect(erreurSynthese(synthese({ texte: "Trop court." }), IDS)).toContain("court");
    expect(erreurSynthese(synthese({ texte: "x".repeat(1300) }), IDS)).toContain("long");
  });

  it("refuse les balises parasites de la sortie du modèle", () => {
    expect(erreurSynthese(synthese({ texte: `${TEXTE_VALIDE}</texte>\n</invoke>\n` }), IDS)).toContain("balises");
  });

  it("refuse une URL ou un identifiant interne dans le texte : les sources sont ajoutées par l'interface", () => {
    expect(erreurSynthese(synthese({ texte: `${TEXTE_VALIDE} Voir https://exemple.fr/page.` }), IDS)).toContain("URL");
    expect(erreurSynthese(synthese({ texte: `${TEXTE_VALIDE} (test-fisc-001)` }), IDS)).toContain("identifiant");
  });

  it("refuse un vocabulaire évaluatif, accents et casse ignorés", () => {
    expect(erreurSynthese(synthese({ texte: `${TEXTE_VALIDE} Une mesure DÉFAVORABLE aux ménages.` }), IDS)).toContain(
      "évaluatif",
    );
  });

  it("refuse une valeur qui n'a pas la forme attendue", () => {
    expect(erreurSynthese(null, IDS)).not.toBeNull();
    expect(erreurSynthese({ texte: 12 }, IDS)).not.toBeNull();
    expect(erreurSynthese({ texte: TEXTE_VALIDE, propositions_utilisees: "a" }, IDS)).not.toBeNull();
  });
});

describe("motsEvaluatifsTrouves", () => {
  it("détecte des jugements de valeur et les niveaux de l'indicateur, qui n'ont pas leur place dans le texte", () => {
    expect(motsEvaluatifsTrouves("Une réforme courageuse et bénéfique.")).toEqual(
      expect.arrayContaining(["courageu", "benefique"]),
    );
    expect(motsEvaluatifsTrouves("La situation serait dégradante.")).not.toEqual([]);
  });

  it("ne signale pas un texte descriptif", () => {
    expect(motsEvaluatifsTrouves(TEXTE_VALIDE)).toEqual([]);
  });
});

describe("construireRequeteSynthese", () => {
  const props = [proposition("test-fisc-001"), proposition("test-fisc-002")];

  it("n'utilise aucun outil web : la synthèse dérive des seules mesures vérifiées", () => {
    const requete = construireRequeteSynthese(META, "fiscalite", "Mes impôts et taxes", props);
    expect(requete.tools).toEqual([]);
  });

  it("transmet les mesures avec leurs effets et les sources datées, sans URL ni extrait", () => {
    const { messages } = construireRequeteSynthese(META, "fiscalite", "Mes impôts et taxes", props);
    const contenu = messages[0].content;
    expect(contenu).toContain("test-fisc-001");
    expect(contenu).toContain("Assemblée nationale");
    expect(contenu).toContain("2021");
    expect(contenu).not.toContain("https://");
    expect(contenu).not.toContain("contribution exceptionnelle sur les hauts revenus");
  });

  it("impose au modèle les règles de neutralité, de couverture et de datation", () => {
    const { system } = construireRequeteSynthese(META, "fiscalite", "Mes impôts et taxes", props);
    const texte = system.replace(/\s+/g, " ");
    expect(texte).toContain("Candidat Test");
    expect(texte).toContain("Mes impôts et taxes");
    expect(texte).toContain("toutes les mesures");
    expect(texte).toContain("vocabulaire évaluatif");
    expect(texte).toContain("antérieure à 2026");
    expect(texte).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("exige un objet {texte, propositions_utilisees} en sortie structurée, sans minItems/maxItems", () => {
    const requete = construireRequeteSynthese(META, "fiscalite", "Mes impôts et taxes", props);
    expect(requete.output_config.format).toEqual({ type: "json_schema", schema: SCHEMA_SYNTHESE });
    expect(JSON.stringify(SCHEMA_SYNTHESE)).not.toMatch(/minItems|maxItems/);
  });
});

describe("genererSynthese", () => {
  const props = [proposition("test-fisc-001"), proposition("test-fisc-002")];

  it("retourne la synthèse quand le modèle répond avec un JSON conforme", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(synthese()) }] }) } };
    const resultat = await genererSynthese(client, META, "fiscalite", "Mes impôts et taxes", props);
    expect(resultat).toEqual({ ok: true, synthese: synthese() });
  });

  it("signale l'erreur, sans lever, quand le JSON ne passe pas les contrôles", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(synthese({ propositions_utilisees: [] })) }] }) } };
    const resultat = await genererSynthese(client, META, "fiscalite", "Mes impôts et taxes", props);
    expect(resultat.ok).toBe(false);
  });

  it("signale l'erreur quand la réponse n'est pas du JSON", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "pas du json" }] }) } };
    expect((await genererSynthese(client, META, "fiscalite", "Mes impôts et taxes", props)).ok).toBe(false);
  });

  it("lève si le modèle refuse ou si un outil serveur échoue (comme pour les propositions)", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [], stop_reason: "refusal" }) } };
    await expect(genererSynthese(client, META, "fiscalite", "Mes impôts et taxes", props)).rejects.toThrow();
  });
});

describe("verifierSyntheseParModele", () => {
  const props = [proposition("test-fisc-001"), proposition("test-fisc-002")];

  it("construit une relecture indépendante sans outil, avec le texte et les mesures", () => {
    const requete = construireRequeteVerificationSynthese(META, "Mes impôts et taxes", props, synthese());
    expect(requete.tools).toEqual([]);
    expect(requete.messages[0].content).toContain(TEXTE_VALIDE);
    expect(requete.messages[0].content).toContain("test-fisc-002");
  });

  it("retourne PASS ou FAIL avec la raison du relecteur", async () => {
    const pass = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ verdict: "PASS" }) }] }) } };
    expect(await verifierSyntheseParModele(pass, META, "Mes impôts et taxes", props, synthese())).toEqual({ statut: "PASS" });

    const fail = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ verdict: "FAIL", raison: "affirmation non étayée" }) }] }) } };
    expect(await verifierSyntheseParModele(fail, META, "Mes impôts et taxes", props, synthese())).toEqual({
      statut: "FAIL",
      raison: "affirmation non étayée",
    });
  });

  it("traite une réponse illisible comme un échec : jamais de PASS par défaut", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "???" }] }) } };
    expect((await verifierSyntheseParModele(client, META, "Mes impôts et taxes", props, synthese())).statut).toBe("FAIL");
  });
});

describe("genererSynthese — nouvelle tentative après un refus déterministe", () => {
  const props = [proposition("test-fisc-001"), proposition("test-fisc-002")];
  const reponseTexte = (v: unknown) => ({ content: [{ type: "text", text: JSON.stringify(v) }], stop_reason: "end_turn" });
  const TROP_LONG = "x".repeat(1300);

  it("renvoie l'erreur au modèle et retente UNE fois : un texte trop long se corrige pour ~1 centime", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(reponseTexte(synthese({ texte: TROP_LONG })))
      .mockResolvedValueOnce(reponseTexte(synthese()));
    const resultat = await genererSynthese({ messages: { create } }, META, "fiscalite", "Mes impôts et taxes", props);
    expect(resultat).toEqual({ ok: true, synthese: synthese() });
    expect(create).toHaveBeenCalledTimes(2);
    const seconde = create.mock.calls[1][0].messages;
    expect(seconde).toHaveLength(3);
    expect(String(seconde[2].content)).toContain("trop long");
    expect(String(seconde[1].content ?? seconde[1].content?.[0]?.text)).toContain("xxxx"); // le texte refusé est rendu au modèle
  });

  it("s'arrête après deux échecs et CONSERVE le dernier texte refusé pour la relecture humaine", async () => {
    const create = vi.fn().mockResolvedValue(reponseTexte(synthese({ texte: TROP_LONG })));
    const resultat = await genererSynthese({ messages: { create } }, META, "fiscalite", "Mes impôts et taxes", props);
    expect(create).toHaveBeenCalledTimes(2);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.erreur).toContain("trop long");
      expect(resultat.texte).toBe(TROP_LONG);
    }
  });

  it("ne retente pas une panne d'outil ou une sortie tronquée : elles lèvent", async () => {
    const create = vi.fn().mockResolvedValue({ content: [], stop_reason: "max_tokens" });
    await expect(genererSynthese({ messages: { create } }, META, "fiscalite", "Mes impôts et taxes", props)).rejects.toThrow("tronquée");
    expect(create).toHaveBeenCalledTimes(1);
  });
});