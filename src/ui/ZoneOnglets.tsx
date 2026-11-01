import { Compass, Lock, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { Onglet } from "./etatZones";
import "./deuxZones.css";

interface ZoneOngletsProps {
  zone: "situation" | "convictions";
  onglet: Onglet;
  // « Candidats » n'est ouvert qu'une fois la suggestion révélée.
  candidatsOuverts: boolean;
  onChoisir: (onglet: Onglet) => void;
  questions: ReactNode;
  candidats: ReactNode;
}

// Un bloc latéral à deux onglets. Tant que « Candidats » est verrouillé, son contenu n'est pas rendu du tout (rien d'identifiant
// dans la page) et l'onglet affiché est toujours « Questions ».
export function ZoneOnglets({ zone, onglet, candidatsOuverts, onChoisir, questions, candidats }: ZoneOngletsProps) {
  const actif: Onglet = candidatsOuverts ? onglet : "questions";
  const idOnglet = (o: Onglet) => `zone-${zone}-onglet-${o}`;
  const idPanneau = `zone-${zone}-panneau`;
  return (
    <section className={`zone zone--${zone}`} aria-label={zone === "situation" ? "Ma situation" : "Mes convictions"}>
      <h2 className="zone-titre">
        {zone === "situation" ? <UserRound size={22} aria-hidden="true" focusable="false" /> : <Compass size={22} aria-hidden="true" focusable="false" />}
        {zone === "situation" ? "Ma situation" : "Mes convictions"}
      </h2>
      <div className="zone-onglets" role="tablist" aria-label={zone === "situation" ? "Ma situation" : "Mes convictions"}>
        <button type="button" role="tab" id={idOnglet("questions")} aria-selected={actif === "questions"} aria-controls={idPanneau} className="zone-onglet" onClick={() => onChoisir("questions")}>
          Questions
        </button>
        <button
          type="button"
          role="tab"
          id={idOnglet("candidats")}
          aria-selected={actif === "candidats"}
          aria-controls={idPanneau}
          aria-disabled={!candidatsOuverts}
          disabled={!candidatsOuverts}
          className="zone-onglet"
          onClick={() => onChoisir("candidats")}
        >
          {!candidatsOuverts && <Lock size={16} aria-hidden="true" focusable="false" />}
          Candidats
        </button>
      </div>
      <div className="zone-corps" role="tabpanel" id={idPanneau} aria-labelledby={idOnglet(actif)}>
        {actif === "questions" ? questions : candidats}
      </div>
    </section>
  );
}
