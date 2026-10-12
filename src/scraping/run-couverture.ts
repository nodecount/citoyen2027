import { resolve } from "node:path";
import { chargerPropositionsCandidat } from "./ecriture";
import { listerCandidatsAvecPropositions } from "./orchestration";
import { compterCouverture, trous } from "./couverture";

// Usage : npm run scrape:couverture [-- --base=agregateurs --candidat=melenchon]
// Aucun appel au modèle : lit les effets déjà écrits et dit, pour chaque réponse possible du formulaire, combien de mesures la
// ciblent (favorables / défavorables). À lancer après chaque `scrape:structurer` : les « trous » listés sont les publics dont on
// ne sait pas si une mesure les dégrade ou les avantage, faute d'effet qui les vise.

function valeur(nom: string): string | undefined {
  const argument = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return argument?.slice(nom.length + 3);
}

const base = valeur("base") ?? "agregateurs";
const racine = resolve(process.cwd(), "data/bases", base);
const candidat = valeur("candidat");
const slugs = candidat ? [candidat] : listerCandidatsAvecPropositions(racine);
const propositions = slugs.flatMap((slug) => chargerPropositionsCandidat(racine, slug));
const bilan = compterCouverture(propositions, base);

console.log(`[couverture] base ${base}, ${candidat ?? `${slugs.length} candidats`}, ${propositions.length} propositions`);
console.log(`[couverture] effets pour tout le monde : ${bilan.pourTous.favorables} favorables, ${bilan.pourTous.defavorables} défavorables`);
let champ = "";
for (const c of bilan.parReponse) {
  if (c.champ !== champ) {
    champ = c.champ;
    console.log(`\n${champ}`);
  }
  const alerte = c.favorables === 0 || c.defavorables === 0 ? "  ⚠" : "";
  console.log(`  ${c.valeur.padEnd(28)} +${String(c.favorables).padStart(3)}  −${String(c.defavorables).padStart(3)}${alerte}`);
}
const t = trous(bilan);
console.log(`\n[couverture] ${t.sansDefavorable.length} réponse(s) sans aucune mesure défavorable ciblée, ${t.sansFavorable.length} sans aucune favorable (⚠ ci-dessus).`);
