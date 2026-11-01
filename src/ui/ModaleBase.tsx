import { useEffect, useRef } from "react";
import { Plug, Unplug, X } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { PiedModale } from "./PiedModale";

interface ModaleBaseProps {
  ouverte: boolean;
  bases: InfoBase[];
  // Ouvre une page de contrôle (monitoring, tests de situations) POUR cette base : chaque source a son propre découpage.
  onControle: (id: string, cible: "monitoring" | "tests-situations") => void;
  onFermer: () => void;
}

// État des sources de données, dans une modale (plus de sélection : une source connectée est affichée, une déconnectée ne l'est pas). Rendue seulement quand elle est ouverte (rien dans la page
// sinon). Se ferme par Échap, par un clic hors du panneau, par le bouton de fermeture, ou en choisissant une base.
export function ModaleBase({ ouverte, bases, onControle, onFermer }: ModaleBaseProps) {
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    panneau.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return (
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale" role="dialog" aria-modal="true" aria-labelledby="modale-base-titre" tabIndex={-1} ref={panneau}>
        <div className="modale-entete">
          <h2 id="modale-base-titre">Base de connaissances</h2>
          <button type="button" className="bouton-icone" aria-label="Fermer" onClick={onFermer}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <ul className="sources-bases">
          {bases.map((base) => {
            const branchee = !base.desactivee;
            const Pictogramme = branchee ? Plug : Unplug;
            return (
              <li key={base.id} className={branchee ? "source source--branchee" : "source source--debranchee"}>
                <p className="source-nom">
                  <Pictogramme size={20} aria-hidden="true" focusable="false" />
                  <strong>{base.libelle}</strong>
                  <span className="source-etat">{branchee ? "Connectée" : "Déconnectée"}</span>
                </p>
                <p className="source-description">{base.description}</p>
                {/* Les liens de contrôle n'existent que pour une source branchée. */}
                {branchee && (
                  <p className="source-liens">
                    {([["monitoring", "Monitoring"], ["tests-situations", "Tests de situations"]] as const).map(([cible, libelle]) => (
                      <button
                        key={cible}
                        type="button"
                        className="lien-menu"
                        onClick={() => {
                          onControle(base.id, cible);
                          onFermer();
                        }}
                      >
                        {libelle}
                      </button>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>        <PiedModale onFermer={onFermer} />
      </div>
    </div>
  );
}
