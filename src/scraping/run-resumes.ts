import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CandidatMeta, Proposition, ResumeTheme, Theme } from "../types";
import { appelerClaudeCli, MODELE_CLI, PanneCli } from "./claude-cli";
import { empreinteResume, resumerTheme } from "./resumes";

// Usage : npm run scrape:resumes [-- --bases=a,b --candidats=x,y --themes=t --force --dry-run --concurrence=3 --plafond-ref=15 --limite=5]
// Pour chaque candidat × thème : un texte de 40 à 60 mots résumant TOUTES ses mesures, mots clés rattachés à leurs
// mesures (voir resumes.ts). Commande claude (abonnement, pas le crédit API). Rejouable : un résumé à jour, ou refusé
// pour les mêmes mesures, n'est pas refait (sauf --force).

const RACINE = process.cwd();

interface Refus {
  theme: string;
  empreinte: string;
  raison: string;
  date: string;
}

interface Tache {
  base: string;
  slug: string;
  nom: string;
  theme: Theme;
  propositions: Proposition[];
  empreinte: string;
}

function valeur(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
}

function lire<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

function ecrire(chemin: string, valeur: unknown): void {
  writeFileSync(chemin, JSON.stringify(valeur, null, 2) + "\n");
}

const affichable = (p: Proposition) => p.statut === "complet" || p.statut === "partiel";

function planifier(force: boolean): Tache[] {
  const filtreBases = valeur("bases")?.split(",");
  const filtreCandidats = valeur("candidats")?.split(",");
  const filtreThemes = valeur("themes")?.split(",");
  const taches: Tache[] = [];
  for (const base of readdirSync(resolve(RACINE, "data/bases"), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    if (filtreBases && !filtreBases.includes(base.name)) continue;
    const themes = lire<Theme[]>(resolve(RACINE, "data/bases", base.name, "themes.json"), []);
    const dossier = resolve(RACINE, "data/bases", base.name, "programmes");
    if (!existsSync(dossier)) continue;
    for (const slug of readdirSync(dossier).sort()) {
      if (filtreCandidats && !filtreCandidats.includes(slug)) continue;
      const d = resolve(dossier, slug);
      const propositions = lire<Proposition[]>(resolve(d, "propositions.json"), []).filter(affichable);
      if (propositions.length === 0) continue;
      const nom = lire<CandidatMeta>(resolve(d, "meta.json"), { nom: slug } as CandidatMeta).nom;
      const resumes = lire<ResumeTheme[]>(resolve(d, "resumes.json"), []);
      const refus = lire<Refus[]>(resolve(d, "_resumes-refuses.json"), []);
      for (const theme of themes) {
        if (filtreThemes && !filtreThemes.includes(theme.id)) continue;
        const duTheme = propositions.filter((p) => p.theme === theme.id);
        if (duTheme.length === 0) continue;
        const empreinte = empreinteResume(duTheme);
        const fait = resumes.some((r) => r.theme === theme.id && r.empreinte === empreinte) || refus.some((r) => r.theme === theme.id && r.empreinte === empreinte);
        if (force || !fait) taches.push({ base: base.name, slug, nom, theme, propositions: duTheme, empreinte });
      }
    }
  }
  return taches;
}

// Écritures sérialisées : plusieurs thèmes d'un même candidat se terminent en parallèle.
let file: Promise<unknown> = Promise.resolve();
function enFile(tache: () => void): Promise<void> {
  const suite = file.then(tache, tache);
  file = suite.catch(() => undefined);
  return suite;
}

async function main(): Promise<void> {
  const taches = planifier(process.argv.includes("--force"));
  const limite = valeur("limite") !== undefined ? Number(valeur("limite")) : undefined;
  const aFaire = limite !== undefined ? taches.slice(0, limite) : taches;
  const plafond = Number(valeur("plafond-ref") ?? 15);
  const concurrence = Math.max(1, Number(valeur("concurrence") ?? 3));
  const mesures = aFaire.reduce((s, t) => s + t.propositions.length, 0);
  console.log(`[plan] ${taches.length} résumé(s) à faire, ${aFaire.length} lancé(s) (${mesures} mesures), 2 à 4 appels chacun, concurrence ${concurrence}`);
  console.log(`[plan] plafond de coût de référence : ${plafond} $ (tarif public ; l'usage compte dans l'abonnement, pas sur le crédit API)`);
  if (process.argv.includes("--dry-run")) {
    console.log("[dry-run] aucun appel n'a été lancé.");
    return;
  }

  const outils = { appeler: (prompt: string, systeme: string, schema: object) => appelerClaudeCli(prompt, systeme, schema, { effort: "low" }) };
  const restantes = [...aFaire];
  let cout = 0;
  let faits = 0;
  let refuses = 0;
  let arret: string | null = null;

  async function travailleur(): Promise<void> {
    for (;;) {
      if (arret) return;
      if (cout >= plafond) {
        arret = `plafond de coût de référence atteint (${cout.toFixed(2)} $)`;
        return;
      }
      const t = restantes.shift();
      if (!t) return;
      const nom = `${t.base} · ${t.slug} × ${t.theme.id}`;
      let r;
      try {
        r = await resumerTheme(t.nom, t.theme.libelle, t.propositions, outils);
      } catch (erreur) {
        if (erreur instanceof PanneCli) {
          arret = erreur.message;
          return;
        }
        console.log(`[erreur] ${nom} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
        continue;
      }
      cout += r.coutReferenceUsd;
      const dossier = resolve(RACINE, "data/bases", t.base, "programmes", t.slug);
      const date = new Date().toISOString().slice(0, 10);
      await enFile(() => {
        const cheminResumes = resolve(dossier, "resumes.json");
        const cheminRefus = resolve(dossier, "_resumes-refuses.json");
        const resumes = lire<ResumeTheme[]>(cheminResumes, []).filter((x) => x.theme !== t.theme.id);
        const refus = lire<Refus[]>(cheminRefus, []).filter((x) => x.theme !== t.theme.id);
        if (r.ok && r.segments) {
          resumes.push({ theme: t.theme.id, segments: r.segments, propositions: t.propositions.map((p) => p.id).sort(), empreinte: t.empreinte, date, modele: MODELE_CLI });
        } else {
          refus.push({ theme: t.theme.id, empreinte: t.empreinte, raison: r.raison ?? "refusé", date });
        }
        ecrire(cheminResumes, resumes.sort((a, b) => a.theme.localeCompare(b.theme)));
        if (refus.length > 0) ecrire(cheminRefus, refus.sort((a, b) => a.theme.localeCompare(b.theme)));
        else if (existsSync(cheminRefus)) ecrire(cheminRefus, []);
      });
      if (r.ok) faits += 1;
      else refuses += 1;
      console.log(`[${r.ok ? "ok" : "refusé"}] ${nom} : ${t.propositions.length} mesures${r.ok ? "" : ` — ${r.raison}`} (${r.coutReferenceUsd.toFixed(3)} $, cumul ${cout.toFixed(2)} $)`);
    }
  }

  await Promise.all(Array.from({ length: concurrence }, () => travailleur()));
  console.log(`[terminé] ${faits} résumé(s), ${refuses} refusé(s), coût de référence ${cout.toFixed(2)} $`);
  if (arret) console.log(`[arrêt] ${arret}. Relancer la même commande reprend là où c'est resté.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
