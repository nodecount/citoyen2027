import { afterEach, describe, expect, it } from "vitest";
import { unlinkSync, writeFileSync } from "node:fs";
import { chargerEnv } from "./env";

const CHEMIN_TEST = "src/ingestion/.env.test-tmp";

describe("chargerEnv", () => {
  afterEach(() => {
    delete process.env.TEST_CLE_ENV;
    delete process.env.TEST_CLE_DEJA_DEFINIE;
    try {
      unlinkSync(CHEMIN_TEST);
    } catch {
      // fichier déjà absent, rien à nettoyer
    }
  });

  it("charge les variables d'un fichier .env dans process.env", () => {
    writeFileSync(CHEMIN_TEST, "TEST_CLE_ENV=valeur-test\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_ENV).toBe("valeur-test");
  });

  it("ne remplace pas une variable déjà définie dans l'environnement", () => {
    process.env.TEST_CLE_DEJA_DEFINIE = "valeur-existante";
    writeFileSync(CHEMIN_TEST, "TEST_CLE_DEJA_DEFINIE=valeur-du-fichier\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_DEJA_DEFINIE).toBe("valeur-existante");
  });

  it("ne fait rien si le fichier n'existe pas", () => {
    expect(() => chargerEnv("chemin/inexistant/.env")).not.toThrow();
  });

  it("ignore les lignes vides et les commentaires", () => {
    writeFileSync(CHEMIN_TEST, "# commentaire\n\nTEST_CLE_ENV=valeur-test\n");
    chargerEnv(CHEMIN_TEST);
    expect(process.env.TEST_CLE_ENV).toBe("valeur-test");
  });
});
