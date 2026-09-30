import type { ModeAffichage } from "./memoireReponses";

// État de la card « candidat idéal » et des lettres de candidats : ce qui doit se réinitialiser dès que le sens des lettres
// change (nouvelle graine) ou que le contexte change (mode, base). Logique pure, testée à part : la page ne fait que la brancher.
export interface EtatIdeal {
  revele: boolean;
  // Graine du tirage des lettres (voir aveugle.ts) : une nouvelle graine, c'est d'autres candidats derrière « Candidat C ».
  graine: number;
}

export const tirerGraine = (): number => Math.floor(Math.random() * 2 ** 31);

// Card refloutée, nouvelles lettres (le formulaire, lui, est rouvert par la page : réponses et convictions intactes).
export function recommencer(): EtatIdeal {
  return { revele: false, graine: tirerGraine() };
}

// Quitter le simulateur, ou y entrer, repart de zéro : on ne revient jamais sur une card déjà révélée.
export function apresChangementDeMode(etat: EtatIdeal, courant: ModeAffichage, suivant: ModeAffichage): EtatIdeal {
  return suivant === courant ? etat : recommencer();
}

// Un autre jeu de candidats : le gagnant de la nouvelle base ne doit pas s'afficher révélé sans nouveau clic.
export function etatPourBase(etat: EtatIdeal, baseAffichee: string, baseCourante: string): EtatIdeal {
  return baseAffichee === baseCourante ? etat : recommencer();
}

// Clé de la grille de thèmes : elle change quand les lettres changent de sens (ou que les identités apparaissent), ce qui
// referme les détails ouverts — sinon « Candidat C » resterait ouvert alors qu'il désigne maintenant un autre candidat.
// Avec les identités visibles, la graine n'a aucun effet.
export function cleIdentites(aveugle: boolean, graine: number): string {
  return aveugle ? `aveugle-${graine}` : "identites";
}
