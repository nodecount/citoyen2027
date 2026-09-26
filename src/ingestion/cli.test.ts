import { describe, expect, it } from "vitest";
import { analyserArguments } from "./cli";

describe("analyserArguments", () => {
  it("lit une liste de candidats séparés par des virgules", () => {
    const options = analyserArguments(["--candidats=attal,glucksmann"]);
    expect(options.candidats).toEqual(["attal", "glucksmann"]);
  });

  it("lit une liste de thèmes optionnelle", () => {
    const options = analyserArguments(["--candidats=attal", "--themes=fiscalite,sante"]);
    expect(options.themes).toEqual(["fiscalite", "sante"]);
  });

  it("lit le mode --refresh avec un thème optionnel", () => {
    const options = analyserArguments(["--refresh=attal:fiscalite"]);
    expect(options.refresh).toEqual({ slug: "attal", theme: "fiscalite" });
  });

  it("lit le mode --refresh sans thème (tous les thèmes du candidat)", () => {
    const options = analyserArguments(["--refresh=attal"]);
    expect(options.refresh).toEqual({ slug: "attal", theme: undefined });
  });

  it("lit le drapeau --force", () => {
    const options = analyserArguments(["--candidats=attal", "--force"]);
    expect(options.force).toBe(true);
  });

  it("force est absent par défaut", () => {
    const options = analyserArguments(["--candidats=attal"]);
    expect(options.force).toBeUndefined();
  });
});

describe("analyserArguments — mode corpus et budget", () => {
  it("le mode par défaut est « corpus » et le budget par défaut de 2 €", () => {
    const options = analyserArguments(["--candidats=retailleau"]);
    expect(options.mode).toBe("corpus");
    expect(options.budgetEur).toBe(2);
    expect(options.dryRun).toBe(false);
    expect(options.actualiserSources).toBe(false);
  });

  it("lit --budget en euros, avec une virgule ou un point décimal", () => {
    expect(analyserArguments(["--budget=5"]).budgetEur).toBe(5);
    expect(analyserArguments(["--budget=1.5"]).budgetEur).toBe(1.5);
    expect(analyserArguments(["--budget=0,75"]).budgetEur).toBe(0.75);
  });

  it("refuse un budget absurde plutôt que de lancer sans plafond", () => {
    expect(() => analyserArguments(["--budget=0"])).toThrow("budget");
    expect(() => analyserArguments(["--budget=-3"])).toThrow("budget");
    expect(() => analyserArguments(["--budget=beaucoup"])).toThrow("budget");
  });

  it("lit --dry-run, --actualiser-sources et --mode=recherche-web", () => {
    const options = analyserArguments(["--candidats=a", "--dry-run", "--actualiser-sources", "--mode=recherche-web"]);
    expect(options.dryRun).toBe(true);
    expect(options.actualiserSources).toBe(true);
    expect(options.mode).toBe("recherche-web");
  });

  it("refuse un mode inconnu", () => {
    expect(() => analyserArguments(["--mode=magique"])).toThrow("mode");
  });
});

describe("analyserArguments — --synthese-seule", () => {
  it("lit --synthese-seule : ne refait que la synthèse des mesures déjà enregistrées", () => {
    expect(analyserArguments(["--candidats=retailleau", "--synthese-seule"]).syntheseSeule).toBe(true);
  });
  it("est absent par défaut", () => {
    expect(analyserArguments(["--candidats=retailleau"]).syntheseSeule).toBe(false);
  });
});

describe("analyserArguments — --retraiter", () => {
  it("lit --retraiter : refaire relecture et synthèse depuis les extractions déjà payées", () => {
    expect(analyserArguments(["--candidats=retailleau", "--retraiter"]).retraiter).toBe(true);
    expect(analyserArguments(["--candidats=retailleau"]).retraiter).toBe(false);
  });
});
