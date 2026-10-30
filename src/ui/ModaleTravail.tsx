import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModaleTravailProps {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

// Fenêtre de travail (questions de situation, convictions) posée par-dessus le tableau de bord : pas de changement de page sur
// ordinateur, plein écran sur téléphone. Le contenu reste monté même fermée (seulement masqué) pour ne perdre aucun brouillon.
// Échap, la croix, « Terminé » ou un clic sur le fond la ferment ; la page derrière ne défile plus tant qu'elle est ouverte.
export function ModaleTravail({ ouverte, titre, onFermer, children }: ModaleTravailProps) {
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    panneau.current?.focus();
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouverte, onFermer]);

  return (
    <div className="modale-fond" hidden={!ouverte} onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale modale--travail" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={panneau}>
        <div className="modale-entete">
          <h2>{titre}</h2>
          <button type="button" className="secondaire modale-fermer" onClick={onFermer} aria-label="Fermer">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        {children}
        <div className="barre-retour">
          <button type="button" onClick={onFermer}>
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}
