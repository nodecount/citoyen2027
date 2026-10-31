import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { ProgrammesSansMesure } from "./ProgrammesSansMesure";

interface ModaleBaseProps {
  ouverte: boolean;
  bases: InfoBase[];
  actif: string;
  onChoisir: (id: string) => void;
  // Ouvre une page de contrôle (monitoring, tests de situations) POUR cette base : chaque source a son propre découpage.
  onControle: (id: string, cible: "monitoring" | "tests-situations") => void;
  onFermer: () => void;
  // Par base, les candidats sans aucune mesure dans cette source (absent : rien n'est dit, comme en simulateur où les candidats sont masqués).
  sansMesure?: Record<string, string[]>;
}

// Choix de la base de connaissances, dans une modale. Rendue seulement quand elle est ouverte (rien dans la page
// sinon). Se ferme par Échap, par un clic hors du panneau, par le bouton de fermeture, ou en choisissant une base.
export function ModaleBase({ ouverte, bases, actif, onChoisir, onControle, onFermer, sansMesure }: ModaleBaseProps) {
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
        <p className="hint">Choisissez la source des données affichées sur tout le site.</p>
        <ul className="choix-bases">
          {bases.map((base) => (
            <li key={base.id}>
              <label className={[base.id === actif ? "choix-base choix-base--actif" : "choix-base", base.desactivee ? "choix-base--desactivee" : ""].join(" ").trim()}>
                <input
                  type="radio"
                  name="base-de-connaissances"
                  value={base.id}
                  disabled={base.desactivee}
                  checked={base.id === actif}
                  onChange={() => {
                    onChoisir(base.id);
                    onFermer();
                  }}
                />
                <span>
                  <strong>{base.libelle}</strong>
                  <span className="choix-base-description">{base.description}</span>
                </span>
              </label>
              <ProgrammesSansMesure noms={sansMesure?.[base.id] ?? []} />
              <p className="choix-base-controles">
                <span>Contrôle de cette source :</span>
                {([["monitoring", "Monitoring"], ["tests-situations", "Tests de situations"]] as const).map(([cible, libelle]) => (
                  <button
                    key={cible}
                    type="button"
                    className="lien-menu"
                    disabled={base.desactivee}
                    onClick={() => {
                      onControle(base.id, cible);
                      onFermer();
                    }}
                  >
                    {libelle}
                  </button>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
