import type { CSSProperties } from "react";

// Panneau placé AU-DESSUS du formulaire (étapes « Ma situation » et « Mes convictions » du simulateur), tout sur une seule ligne :
// la barre de progression avec son % écrit dedans, le nombre de réponses, et, à droite, l'interrupteur qui met en valeur les
// réponses manquantes. L'indicateur d'enregistrement (hors du panneau, au-dessus et sous le formulaire) et l'effacement (en bas
// de l'écran, entre les deux boutons de navigation) ne sont pas ici. Le % est la part des champs remplis : un champ sans réponse
// ne compte pas, jamais comme un « non ». Sur écran étroit, les éléments passent à la ligne.
export function pourcentage(repondues: number, total: number): number {
  return total > 0 ? Math.round((repondues / total) * 100) : 0;
}

export function PanneauProgression({
  repondues,
  total,
  compte,
  manquantesEnValeur,
  onManquantes,
}: {
  repondues: number;
  total: number;
  // Ce qui est compté, au pluriel accordé (« 21 questions répondues sur 21 », « 13 convictions complétées sur 34 »).
  compte: string;
  manquantesEnValeur: boolean;
  onManquantes: (valeur: boolean) => void;
}) {
  const pct = pourcentage(repondues, total);
  return (
    <>
    {/* Téléphone seulement (caché ailleurs) : le panneau ci-dessous disparaît, remplacé par un rond flottant qui montre le
        pourcentage sur toute la page. Un appui met en valeur (ou non) les réponses manquantes, comme l'interrupteur du panneau. */}
    <button
      type="button"
      className="progression-flottante"
      aria-pressed={manquantesEnValeur}
      aria-label={`Complétion des réponses : ${pct} %, ${compte}. Mettre en valeur les réponses manquantes`}
      title="Mettre en valeur les réponses manquantes"
      onClick={() => onManquantes(!manquantesEnValeur)}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="progression-flottante-fond" cx="22" cy="22" r="18" />
        <circle className="progression-flottante-valeur" cx="22" cy="22" r="18" pathLength="100" strokeDasharray={`${pct} 100`} transform="rotate(-90 22 22)" />
      </svg>
      <span aria-hidden="true">{pct}&nbsp;%</span>
    </button>
    <div className="section-secondaire panneau-progression">
      <span className="panneau-progression-titre" id="panneau-progression-titre">
        Complétion des réponses :
      </span>
      {/* Le % est écrit au centre de la barre : blanc sur la partie remplie, bleu foncé sur le reste (dégradé net découpé dans le texte). */}
      <div className="panneau-barre" role="progressbar" aria-labelledby="panneau-progression-titre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="panneau-barre-remplie" style={{ width: `${pct}%` }} />
        <span className="panneau-barre-texte" style={{ "--pct": `${pct}%` } as CSSProperties}>
          {pct} %
        </span>
      </div>
      <p className="panneau-progression-compte" aria-live="polite">
        {compte}
      </p>
      <label className="interrupteur">
        <input type="checkbox" role="switch" checked={manquantesEnValeur} onChange={(e) => onManquantes(e.target.checked)} />
        <span className="interrupteur-piste" aria-hidden="true" />
        Mettre en valeur les réponses manquantes
      </label>
    </div>
    </>
  );
}
