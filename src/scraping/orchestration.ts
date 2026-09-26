import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CandidatMeta, Proposition } from "../types";
import { PanneCli } from "./claude-cli";
import {
  chargerJournalStructuration,
  chargerPropositionsCandidat,
  ecrirePropositionsCandidat,
  enregistrerJournalStructuration,
} from "./ecriture";
import { readFileSync } from "node:fs";
import {
  THEMES_SANS_EFFET,
  decouperEnGroupes,
  empreinteGroupe,
  structurerGroupe,
  type EntreeStructuration,
  type OutilsAppel,
} from "./structuration";

export interface OptionsStructuration {
  candidats?: string[];
  themes?: string[];
  force?: boolean;
  concurrence?: number;
  // Plafond du coût de RÉFÉRENCE (tarif public) cumulé : garde-fou de volume, pas une facture (abonnement).
  plafondRefUsd?: number;
  limiteGroupes?: number;
}

export interface GroupePlanifie {
  slug: string;
  nomCandidat: string;
  themeId: string;
  index: number;
  entrees: EntreeStructuration[];
  empreinte: string;
  aFaire: boolean;
}

export interface Plan {
  groupes: GroupePlanifie[];
  // Propositions de thèmes sans effet possible sur un citoyen : marquées « analysées, sans effet » sans appel.
  sansAppel: Array<{ slug: string; ids: string[] }>;
}

export function listerCandidatsAvecPropositions(racineBase: string): string[] {
  const dossier = resolve(racineBase, "programmes");
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => chargerPropositionsCandidat(racineBase, slug).length > 0)
    .sort();
}

function nomDuCandidat(racineBase: string, slug: string): string {
  const chemin = resolve(racineBase, "programmes", slug, "meta.json");
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as CandidatMeta).nom : slug;
}

export function planifier(racineBase: string, options: OptionsStructuration = {}): Plan {
  const slugs = options.candidats ?? listerCandidatsAvecPropositions(racineBase);
  const groupes: GroupePlanifie[] = [];
  const sansAppel: Plan["sansAppel"] = [];

  for (const slug of slugs) {
    const propositions = chargerPropositionsCandidat(racineBase, slug);
    const journal = chargerJournalStructuration(racineBase, slug);
    const nomCandidat = nomDuCandidat(racineBase, slug);
    const parTheme = new Map<string, Proposition[]>();
    for (const p of propositions) parTheme.set(p.theme, [...(parTheme.get(p.theme) ?? []), p]);

    const idsSansEffet: string[] = [];
    for (const [themeId, liste] of parTheme) {
      if (options.themes && !options.themes.includes(themeId)) continue;
      if (THEMES_SANS_EFFET.has(themeId)) {
        idsSansEffet.push(...liste.map((p) => p.id));
        continue;
      }
      const entrees: EntreeStructuration[] = liste.map((p) => ({ id: p.id, texte: p.resume_factuel, url: p.sources[0]?.url ?? "" }));
      decouperEnGroupes(entrees).forEach((groupe, index) => {
        const empreinte = empreinteGroupe(groupe);
        const fait = journal.some((e) => e.theme === themeId && e.groupe === index && e.empreinte === empreinte);
        groupes.push({ slug, nomCandidat, themeId, index, entrees: groupe, empreinte, aFaire: options.force === true || !fait });
      });
    }
    if (idsSansEffet.length > 0) sansAppel.push({ slug, ids: idsSansEffet });
  }
  return { groupes, sansAppel };
}

export interface ResumeStructuration {
  groupesFaits: number;
  erreurs: Array<{ groupe: string; message: string }>;
  arret: "panne" | "plafond" | null;
  messageArret?: string;
  coutReferenceUsd: number;
  appels: number;
}

// Sérialise les écritures : plusieurs groupes d'un même candidat se terminent en parallèle et écrasent le même fichier.
function fileAttente() {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(tache: () => T | Promise<T>): Promise<T> => {
    const suite = queue.then(tache, tache);
    queue = suite.catch(() => undefined);
    return suite;
  };
}

export async function executer(
  racineBase: string,
  plan: Plan,
  themeLibelle: (themeId: string) => string,
  outils: OutilsAppel,
  modele: string,
  options: OptionsStructuration = {},
  journaliser: (ligne: string) => void = console.log,
): Promise<ResumeStructuration> {
  const ecrire = fileAttente();
  const resume: ResumeStructuration = { groupesFaits: 0, erreurs: [], arret: null, coutReferenceUsd: 0, appels: 0 };

  // Thèmes sans effet possible : marqués sans appel.
  for (const { slug, ids } of plan.sansAppel) {
    await ecrire(() => {
      const propositions = chargerPropositionsCandidat(racineBase, slug);
      const cibles = new Set(ids);
      ecrirePropositionsCandidat(racineBase, slug, propositions.map((p) => (cibles.has(p.id) ? { ...p, effets: [] } : p)));
    });
  }

  let aFaire = plan.groupes.filter((g) => g.aFaire);
  if (options.limiteGroupes !== undefined) aFaire = aFaire.slice(0, options.limiteGroupes);
  const plafond = options.plafondRefUsd ?? Infinity;
  const file = [...aFaire];

  async function travailleur(): Promise<void> {
    for (;;) {
      if (resume.arret) return;
      if (resume.coutReferenceUsd >= plafond) {
        resume.arret = "plafond";
        resume.messageArret = `Plafond de coût de référence atteint (${resume.coutReferenceUsd.toFixed(2)} $ sur ${plafond} $).`;
        return;
      }
      const groupe = file.shift();
      if (!groupe) return;
      const nom = `${groupe.slug} × ${groupe.themeId} #${groupe.index + 1}`;
      let rapport;
      for (let essai = 1; essai <= 2 && !rapport; essai += 1) {
        try {
          rapport = await structurerGroupe(groupe.nomCandidat, themeLibelle(groupe.themeId), groupe.entrees, outils);
        } catch (erreur) {
          const message = erreur instanceof Error ? erreur.message : String(erreur);
          if (erreur instanceof PanneCli) {
            resume.arret = "panne";
            resume.messageArret = message;
            return;
          }
          if (essai === 2) resume.erreurs.push({ groupe: nom, message });
        }
      }
      if (!rapport) {
        journaliser(`[erreur] ${nom} : ${resume.erreurs[resume.erreurs.length - 1]?.message}`);
        continue;
      }
      resume.coutReferenceUsd += rapport.coutReferenceUsd;
      resume.appels += rapport.appels;
      resume.groupesFaits += 1;

      let avecEffets = 0;
      let sansEffet = 0;
      const rejetees: Array<{ id: string; raison: string }> = [];
      await ecrire(() => {
        const propositions = chargerPropositionsCandidat(racineBase, groupe.slug);
        const misesAJour = propositions.map((p) => {
          const r = rapport.resultats.get(p.id);
          if (!r) return p;
          if (r.statut === "structuree") return { ...p, effets: r.effets };
          const { effets: _retire, ...sansEffets } = p;
          return sansEffets as Proposition;
        });
        ecrirePropositionsCandidat(racineBase, groupe.slug, misesAJour);
        for (const [id, r] of rapport.resultats) {
          if (r.statut === "rejetee") rejetees.push({ id, raison: r.raison });
          else if (r.effets.length > 0) avecEffets += 1;
          else sansEffet += 1;
        }
        enregistrerJournalStructuration(racineBase, groupe.slug, {
          theme: groupe.themeId,
          groupe: groupe.index,
          empreinte: groupe.empreinte,
          date: new Date().toISOString().slice(0, 10),
          modele,
          propositions: groupe.entrees.length,
          avec_effets: avecEffets,
          sans_effet: sansEffet,
          rejetees,
          cout_reference_usd: Number(rapport.coutReferenceUsd.toFixed(4)),
          appels: rapport.appels,
        });
      });
      journaliser(
        `[groupe] ${nom} : ${groupe.entrees.length} propositions → ${avecEffets} avec effets, ${sansEffet} sans effet, ${rejetees.length} rejetée(s) ` +
          `(${rapport.coutReferenceUsd.toFixed(3)} $ de référence, cumul ${resume.coutReferenceUsd.toFixed(2)} $)`,
      );
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, options.concurrence ?? 3) }, () => travailleur()));
  return resume;
}
