import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Même seuil que la feuille de style : en dessous, la vue de travail est une étape dans la page, pas une fenêtre.
const MOBILE = "(max-width: 52rem)";

interface ModaleTravailProps {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  // Introduction affichée en pleine page, comme une toute première question sans réponse : on la passe par « Continuer »,
  // puis elle ne reparaît plus. Elle n'est montrée que tant que `introAuDebut` est vrai (aucune réponse donnée).
  intro?: ReactNode;
  introAuDebut?: boolean;
  // Vue de questions : le contenu occupe toute la hauteur de la fenêtre (une question par écran, sans défiler).
  pleinePage?: boolean;
}

// Fenêtre de travail (questions de situation, convictions) posée par-dessus le tableau de bord : pas de changement de page sur
// ordinateur, étape dans la page sur téléphone. Le contenu reste monté même fermée ou derrière l'introduction (seulement masqué)
// pour ne perdre aucun brouillon. Échap, la croix, « Terminé » ou un clic sur le fond la ferment ; la page derrière ne défile
// plus tant qu'elle est ouverte (ordinateur).
export function ModaleTravail({ ouverte, titre, onFermer, children, intro, introAuDebut = false, pleinePage = false }: ModaleTravailProps) {
  const panneau = useRef<HTMLDivElement>(null);
  const [introVue, setIntroVue] = useState(false);
  const afficherIntro = Boolean(intro) && introAuDebut && !introVue;
  // Toujours le dernier onFermer, sans relancer l'effet à chaque rendu : sinon chaque réponse remontait la page.
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    if (!ouverte) return;
    // Sur téléphone, la vue est une étape à part, dans la page (le menu reste visible) : la page défile normalement et
    // on repart du haut. Sur ordinateur, c'est une fenêtre : la page derrière est figée.
    const etape = window.matchMedia?.(MOBILE).matches ?? false;
    if (etape) window.scrollTo?.(0, 0);
    panneau.current?.focus({ preventScroll: true });
    const precedent = document.body.style.overflow;
    if (!etape) document.body.style.overflow = "hidden";
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouverte]);

  return (
    <div className="modale-fond" hidden={!ouverte} onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modale modale--travail${pleinePage ? " modale--plein" : ""}`} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={panneau}>
        {/* Téléphone seulement (caché sur ordinateur) : retour à la simulation. */}
        <button type="button" className="modale-lien-retour" onClick={onFermer}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" />
          Retour à la simulation
        </button>
        <div className="modale-entete">
          <h2>{titre}</h2>
          <button type="button" className="secondaire modale-fermer" onClick={onFermer} aria-label="Fermer">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        {intro && (
          <div className="modale-intro" hidden={!afficherIntro}>
            <div className="modale-intro-texte">{intro}</div>
            <button type="button" className="modale-intro-continuer" onClick={() => setIntroVue(true)}>
              Continuer
              <ArrowRight size={18} aria-hidden="true" focusable="false" />
            </button>
          </div>
        )}
        <div className="modale-corps" hidden={afficherIntro}>
          {children}
          <div className="barre-retour">
            <button type="button" onClick={onFermer}>
              Terminé
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
