import { useEffect, useRef } from "react";

interface ModaleConfirmationProps {
  ouverte: boolean;
  titre: string;
  message: string;
  libelleConfirmer: string;
  // « Annuler » par défaut.
  libelleAnnuler?: string;
  // Vrai par défaut : la confirmation est un bouton danger (rouge). Faux pour une action qui n'efface rien (ex. révéler).
  destructrice?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

// Confirmation avant une action qu'on ne peut pas défaire. Même habillage que la modale de choix de base. Le focus
// arrive sur « Annuler » (le choix sûr) ; Échap ou un clic hors du panneau annulent aussi.
export function ModaleConfirmation({ ouverte, titre, message, libelleConfirmer, libelleAnnuler = "Annuler", destructrice = true, onConfirmer, onAnnuler }: ModaleConfirmationProps) {
  const annuler = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    annuler.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnuler();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouverte, onAnnuler]);

  if (!ouverte) return null;

  return (
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onAnnuler()}>
      <div className="modale modale--confirmation" role="alertdialog" aria-modal="true" aria-labelledby="modale-confirmation-titre" aria-describedby="modale-confirmation-message">
        <div className="modale-entete">
          <h2 id="modale-confirmation-titre">{titre}</h2>
        </div>
        <p id="modale-confirmation-message">{message}</p>
        <div className="actions">
          <button type="button" className="secondaire" ref={annuler} onClick={onAnnuler}>
            {libelleAnnuler}
          </button>
          <button type="button" className={destructrice ? "bouton-danger" : undefined} onClick={onConfirmer}>
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </div>
  );
}
