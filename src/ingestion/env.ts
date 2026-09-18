import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function chargerEnv(cheminFichier: string = resolve(process.cwd(), ".env")): void {
  if (!existsSync(cheminFichier)) return;
  const contenu = readFileSync(cheminFichier, "utf-8");
  for (const ligne of contenu.split("\n")) {
    const ligneNettoyee = ligne.trim();
    if (ligneNettoyee === "" || ligneNettoyee.startsWith("#")) continue;
    const indexEgal = ligneNettoyee.indexOf("=");
    if (indexEgal === -1) continue;
    const cle = ligneNettoyee.slice(0, indexEgal).trim();
    const valeur = ligneNettoyee
      .slice(indexEgal + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[cle] === undefined) {
      process.env[cle] = valeur;
    }
  }
}
