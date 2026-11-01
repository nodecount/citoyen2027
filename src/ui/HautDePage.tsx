import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

// Pixels défilés à partir desquels le bouton apparaît.
const SEUIL = 600;

// Bouton flottant « Haut de page » (téléphone seulement : masqué par le CSS sur ordinateur), sur toutes les pages.
export function HautDePage() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const surDefilement = () => setVisible(window.scrollY > SEUIL);
    surDefilement();
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => window.removeEventListener("scroll", surDefilement);
  }, []);
  if (!visible) return null;
  const monter = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <button type="button" className="haut-de-page" onClick={monter} aria-label="Revenir en haut de la page">
      <ArrowUp size={22} aria-hidden="true" focusable="false" />
    </button>
  );
}
