import { useEffect, useRef, useState } from "react";

// Indicateur d'enregistrement automatique, identique sur les deux formulaires : rien tant que rien n'a changé, puis
// « Enregistrement… » pendant la pause, puis « ✓ Enregistré ». Sa place est réservée (pas de saut de mise en page).
export type EtatEnregistrement = "repos" | "enregistrement" | "enregistre";

export function IndicateurEnregistrement({ etat }: { etat: EtatEnregistrement }) {
  return (
    <p className={`enregistrement enregistrement--${etat}`} role="status">
      {etat === "enregistrement" && "Enregistrement…"}
      {etat === "enregistre" && "✓ Enregistré"}
    </p>
  );
}

// Rangée de l'indicateur, HORS du panneau et du formulaire (sous eux), alignée à droite. Sa hauteur est réservée.
export function RangeeEnregistrement({ etat }: { etat: EtatEnregistrement }) {
  return (
    <div className="rangee-enregistrement">
      <IndicateurEnregistrement etat={etat} />
    </div>
  );
}

// Pour un formulaire dont les changements sont déjà appliqués à chaque action (cases, listes) : l'indicateur suit le même
// parcours que l'enregistrement différé de l'autre formulaire. `signaler()` à chaque modification.
export function useSignalEnregistrement(delaiMs = 400): { etat: EtatEnregistrement; signaler: () => void } {
  const [etat, setEtat] = useState<EtatEnregistrement>("repos");
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), []);
  const signaler = () => {
    setEtat("enregistrement");
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setEtat("enregistre"), delaiMs);
  };
  return { etat, signaler };
}
