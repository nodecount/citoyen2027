import type { ReactNode } from "react";
import "./deuxZones.css";

const RAYON = 45;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

interface AnneauPrecisionProps {
  // Part de réponses données (0 à 100), côtés situation et convictions confondus.
  pourcent: number;
  revele: boolean;
  // Une fois révélé, ce qui remplace le pourcentage dans le disque (le portrait du candidat).
  children?: ReactNode;
}

// Anneau de progression autour d'un disque uni. Non révélé, le disque dit le pourcentage de précision ; révélé, il montre le
// candidat et le pourcentage disparaît (l'anneau, lui, reste).
export function AnneauPrecision({ pourcent, revele, children }: AnneauPrecisionProps) {
  const borne = Math.min(100, Math.max(0, pourcent));
  return (
    <div className="anneau" role="progressbar" aria-label="Précision de la suggestion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={borne}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="anneau-fond" cx="50" cy="50" r={RAYON} />
        <circle className="anneau-valeur" cx="50" cy="50" r={RAYON} strokeDasharray={CIRCONFERENCE} strokeDashoffset={CIRCONFERENCE * (1 - borne / 100)} />
      </svg>
      <div className="anneau-disque">
        {revele ? (
          children
        ) : (
          <span>
            {borne} %<small>de précision</small>
          </span>
        )}
      </div>
    </div>
  );
}
