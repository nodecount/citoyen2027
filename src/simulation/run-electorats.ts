import { writeFileSync } from "node:fs";
import { trouverPosition, trouverSujet } from "../positions";
import { ELECTORATS, basesASimuler, simuler, type ResultatBase } from "./electorats";
import { formaterGagnants as formaterTexte, formaterSuivants } from "./format";

// Lance la simulation d'électorats sur chaque base et écrit le tableau de résultats dans docs/.
//   npx vite-node src/simulation/run-electorats.ts
// (vite-node : le chargement des données passe par import.meta.glob, comme dans l'application.)

const SORTIE = "docs/simulation-electorats.md";

// Mise en forme partagée avec la page « Tests de situations » (format.ts) ; ici le nom du gagnant est mis en gras.
const formaterGagnants = (gagnants: Parameters<typeof formaterTexte>[0], departageable: boolean) =>
  formaterTexte(gagnants.map((g) => ({ ...g, nom: `**${g.nom}**` })), departageable);

const echapper = (t: string) => t.replace(/\|/g, "\\|");

const bases = basesASimuler();
const resultats = new Map<string, ResultatBase[]>();
for (const electorat of ELECTORATS) resultats.set(electorat.id, bases.map((b) => simuler(electorat, b)));

const lignes: string[] = [];
lignes.push("# Simulation d'électorats : qui désigne le simulateur ?");
lignes.push("");
lignes.push(`Généré par \`src/simulation/run-electorats.ts\` le ${new Date().toISOString().slice(0, 10)}. Même contenu que la page « Tests de situations » du site (accessible depuis la modale de choix de la base, avec verdicts saisissables) : cette version écrite sert de trace datée.`);
lignes.push("");
lignes.push("Chaque électorat répond au formulaire « ma situation » et choisit des positions dans « mes convictions », puis passe dans **le calcul exact de la page de résultat** (mêmes fonctions que l'application) sur chacune des deux bases. « Sans condamnation » n'est pas coché.");
lignes.push("");
lignes.push("Lecture d'une cellule : `Nom (+score = N pour − M contre, sur K)` : le score est le nombre de thèmes (situation) ou de croisements sujet × thème (convictions) favorables moins défavorables ; K est le nombre de thèmes ou croisements où le candidat a un résultat. Les ex æquo sont tous listés. « Suivants » : les trois meilleurs scores après le ou les gagnants, pour juger si l'écart est net.");
lignes.push("");
lignes.push("**À arbitrer** : pour chaque ligne, le candidat désigné correspond-il à ce qu'attendrait cet électorat ? Colonne « Verdict » à remplir.");
lignes.push("");
lignes.push("## Tableau des résultats");
lignes.push("");
lignes.push("| Électorat | Base | Selon la situation | Suivants (situation) | Selon les convictions | Suivants (convictions) | Verdict |");
lignes.push("|---|---|---|---|---|---|---|");
for (const electorat of ELECTORATS) {
  for (const r of resultats.get(electorat.id)!) {
    const s = r.situation ? echapper(formaterGagnants(r.situation.gagnants, r.situation.departageable)) : "aucun résultat";
    const ss = r.situation ? echapper(formaterSuivants(r.situation.suivants)) : "—";
    const c = r.convictions ? echapper(formaterGagnants(r.convictions.gagnants, r.convictions.departageable)) : "aucun résultat (aucune mesure étiquetée sur ces sujets)";
    const sc = r.convictions ? echapper(formaterSuivants(r.convictions.suivants)) : "—";
    lignes.push(`| ${echapper(electorat.nom)} | ${r.base} | ${s} | ${ss} | ${c} | ${sc} |  |`);
  }
}
lignes.push("");
lignes.push("## Profils simulés");
lignes.push("");
for (const electorat of ELECTORATS) {
  lignes.push(`### ${electorat.nom}`);
  lignes.push("");
  lignes.push(electorat.description);
  lignes.push("");
  lignes.push("- **Réponses au formulaire** : " + Object.entries(electorat.reponses).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`).join(" · "));
  const positions = Object.entries(electorat.convictions)
    .filter(([, p]) => p !== "")
    .map(([sujet, position]) => `${trouverSujet(sujet)?.libelle ?? `?${sujet}`} → ${trouverPosition(sujet, position)?.libelle ?? `?${position}`}`);
  lignes.push("- **Convictions** : " + positions.join(" · "));
  const retenues = resultats.get(electorat.id)!.map((r) => `${r.base} : ${r.reponsesRetenues} réponses`).join(" ; ");
  lignes.push(`- **Réponses retenues par base** (une question absente d'une base y est ignorée) : ${retenues}`);
  lignes.push("");
}
writeFileSync(SORTIE, lignes.join("\n") + "\n", "utf8");
console.log(`Écrit : ${SORTIE} (${ELECTORATS.length} électorats × ${bases.length} bases)`);
