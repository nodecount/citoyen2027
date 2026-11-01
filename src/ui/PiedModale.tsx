// Bouton de fermeture en bas d'une fenêtre : à portée du pouce, sans remonter jusqu'à la croix de l'en-tête.
export function PiedModale({ onFermer }: { onFermer: () => void }) {
  return (
    <div className="modale-pied">
      <button type="button" className="secondaire" onClick={onFermer}>
        Fermer
      </button>
    </div>
  );
}
