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
