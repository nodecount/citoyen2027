import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CandidatMeta, Proposition } from "../types";
import { PanneCli } from "./claude-cli";
import { chargerPropositionsCandidat, dossierCandidat, ecrirePropositionsCandidat } from "./ecriture";
import { decouperEnGroupes, empreinteGroupePositions, etiqueterGroupe } from "./etiquetage-positions";
import { listerCandidatsAvecPropositions } from "./orchestration";
import type { EntreeStructuration, OutilsAppel } from "./structuration";

// Orchestration de l'étiquetage des mesures par position : planifie les groupes (un candidat, tranches de 25 mesures), ignore
// ceux dont les textes et les prompts n'ont pas changé (rejouable sans repayer), applique les résultats au fichier des
// propositions et tient un journal par candidat (`_positions.json`).

export interface OptionsEtiquetage {
  candidats?: string[];
  force?: boolean;
  concurrence?: number;
  // Plafond du coût de RÉFÉRENCE (tarif public) cumulé : garde-fou de volume, pas une facture (abonnement).
  plafondRefUsd?: number;
  limiteGroupes?: number;
}

export interface GroupeEtiquetage {
  slug: string;
  nomCandidat: string;
  index: number;
  entrees: EntreeStructuration[];
  empreinte: string;
  aFaire: boolean;
}

export interface EntreeJournalPositions {
  groupe: number;
  empreinte: string;
  date: string;
  modele: string;
  propositions: number;
  etiquetees: number;
  sans_position: number;
  rejetees: Array<{ id: string; raison: string }>;
  cout_reference_usd: number;
  appels: number;
}

function cheminJournal(racineBase: string, slug: string): string {
  return resolve(dossierCandidat(racineBase, slug), "_positions.json");
}

export function chargerJournalPositions(racineBase: string, slug: string): EntreeJournalPositions[] {
  const chemin = cheminJournal(racineBase, slug);
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as EntreeJournalPositions[]) : [];
}

function enregistrerJournalPositions(racineBase: string, slug: string, entree: EntreeJournalPositions): void {
  const autres = chargerJournalPositions(racineBase, slug).filter((e) => e.groupe !== entree.groupe);
  writeFileSync(cheminJournal(racineBase, slug), JSON.stringify([...autres, entree].sort((a, b) => a.groupe - b.groupe), null, 2) + "\n");
}

function nomDuCandidat(racineBase: string, slug: string): string {
  const chemin = resolve(dossierCandidat(racineBase, slug), "meta.json");
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as CandidatMeta).nom : slug;
}

export function planifierEtiquetage(racineBase: string, options: OptionsEtiquetage = {}): GroupeEtiquetage[] {
  const slugs = options.candidats ?? listerCandidatsAvecPropositions(racineBase);
  const groupes: GroupeEtiquetage[] = [];
  for (const slug of slugs) {
    const propositions = chargerPropositionsCandidat(racineBase, slug);
    const journal = chargerJournalPositions(racineBase, slug);
    const nomCandidat = nomDuCandidat(racineBase, slug);
    const entrees: EntreeStructuration[] = propositions.map((p) => ({ id: p.id, texte: p.resume_factuel, url: p.sources[0]?.url ?? "" }));
    decouperEnGroupes(entrees).forEach((groupe, index) => {
      const empreinte = empreinteGroupePositions(groupe);
      const fait = journal.some((e) => e.groupe === index && e.empreinte === empreinte);
      groupes.push({ slug, nomCandidat, index, entrees: groupe, empreinte, aFaire: options.force === true || !fait });
    });
  }
  return groupes;
}

export interface ResumeEtiquetage {
  groupesFaits: number;
  erreurs: Array<{ groupe: string; message: string }>;
  arret: "panne" | "plafond" | null;
  messageArret?: string;
  coutReferenceUsd: number;
  appels: number;
  etiquetees: number;
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

export async function executerEtiquetage(
  racineBase: string,
  groupes: GroupeEtiquetage[],
  outils: OutilsAppel,
  modele: string,
  options: OptionsEtiquetage = {},
  journaliser: (ligne: string) => void = console.log,
): Promise<ResumeEtiquetage> {
  const ecrire = fileAttente();
  const resume: ResumeEtiquetage = { groupesFaits: 0, erreurs: [], arret: null, coutReferenceUsd: 0, appels: 0, etiquetees: 0 };
  let aFaire = groupes.filter((g) => g.aFaire);
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
      const nom = `${groupe.slug} #${groupe.index + 1}`;
      let rapport;
      for (let essai = 1; essai <= 2 && !rapport; essai += 1) {
        try {
          rapport = await etiqueterGroupe(groupe.nomCandidat, groupe.entrees, outils);
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

      let etiquetees = 0;
      let sansPosition = 0;
      const rejetees: Array<{ id: string; raison: string }> = [];
      await ecrire(() => {
        const propositions = chargerPropositionsCandidat(racineBase, groupe.slug);
        const misesAJour = propositions.map((p) => {
          const r = rapport.resultats.get(p.id);
          if (!r) return p;
          if (r.statut === "etiquetee") return { ...p, positions: r.positions };
          const { positions: _retire, ...sansPositions } = p;
          return sansPositions as Proposition; // rejetée : on ne garde aucune étiquette (et on ne devine pas)
        });
        ecrirePropositionsCandidat(racineBase, groupe.slug, misesAJour);
        for (const [id, r] of rapport.resultats) {
          if (r.statut === "rejetee") rejetees.push({ id, raison: r.raison });
          else if (r.positions.length > 0) etiquetees += 1;
          else sansPosition += 1;
        }
        resume.etiquetees += etiquetees;
        enregistrerJournalPositions(racineBase, groupe.slug, {
          groupe: groupe.index,
          empreinte: groupe.empreinte,
          date: new Date().toISOString().slice(0, 10),
          modele,
          propositions: groupe.entrees.length,
          etiquetees,
          sans_position: sansPosition,
          rejetees,
          cout_reference_usd: Number(rapport.coutReferenceUsd.toFixed(4)),
          appels: rapport.appels,
        });
      });
      journaliser(`[groupe] ${nom} : ${groupe.entrees.length} propositions → ${etiquetees} étiquetée(s), ${sansPosition} sans position, ${rejetees.length} rejetée(s) (cumul ${resume.coutReferenceUsd.toFixed(2)} $ de référence)`);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, options.concurrence ?? 3) }, () => travailleur()));
  return resume;
}
