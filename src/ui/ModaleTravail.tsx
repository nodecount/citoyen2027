import { ArrowLeft, ArrowRight, Compass, UserRound, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Fourni par la fenêtre quand elle a une introduction : le pas à pas s'en sert pour son « Précédent » de la première question.
export const RetourIntroContexte = createContext<(() => void) | undefined>(undefined);
// Fourni par la fenêtre : l'écran de fin des questions s'en sert pour ramener au simulateur.
export const FermerContexte = createContext<(() => void) | undefined>(undefined);

// Fourni par une fenêtre de questions : les deux emplacements de son pied fixe (la bascule d'affichage à gauche, la navigation à droite)
// et le moyen de dire que la navigation est tenue par le contenu (une question à la fois : Précédent, Suivant, Enregistrer et fermer).
interface PiedFenetre {
  bascule: HTMLElement | null;
  navigation: HTMLElement | null;
  revendiquerNavigation: (oui: boolean) => void;
}
const PiedContexte = createContext<PiedFenetre | null>(null);

// Hook : tant que le composant est monté, la navigation du pied lui appartient (le bouton « Enregistrer et fermer » par défaut s'efface).
export function useNavigationPied(actif: boolean) {
  const pied = useContext(PiedContexte);
  const revendiquer = pied?.revendiquerNavigation;
  useEffect(() => {
    if (!actif || !revendiquer) return;
    revendiquer(true);
    return () => revendiquer(false);
  }, [actif, revendiquer]);
}

// Range ses enfants dans le pied fixe de la fenêtre. Hors fenêtre (ou avant que le pied existe), ils restent là où ils sont écrits.
export function ActionPied({ zone = "bascule", children }: { zone?: "bascule" | "navigation"; children: ReactNode }) {
  const pied = useContext(PiedContexte);
  const emplacement = pied ? pied[zone] : null;
  return emplacement ? createPortal(children, emplacement) : <>{children}</>;
}
// Ramène en haut : la page (téléphone) et les zones qui défilent dans la fenêtre (ordinateur).
export function remonterEnHaut() {
  if (typeof window === "undefined") return;
  window.scrollTo?.(0, 0);
  document.querySelectorAll<HTMLElement>(".modale--travail .modale-corps, .modale--travail .modale-corps > form, .modale--travail .modale-corps > section, .modale--travail .modale-intro").forEach((el) => {
    el.scrollTop = 0;
  });
}
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
  // Vue de lecture (cards de thèmes) : fenêtre presque aussi large que l'écran ; sur téléphone, sans cadre, comme la page Exploration.
  large?: boolean;
  // Fenêtre d'un des deux blocs du tableau de bord : son titre reprend la couleur et l'icône du bloc (bleu / vert).
  zone?: "situation" | "convictions";
}

// Fenêtre de travail (questions de situation, convictions) posée par-dessus le tableau de bord : pas de changement de page sur
// ordinateur, étape dans la page sur téléphone. Le contenu reste monté même fermée ou derrière l'introduction (seulement masqué)
// pour ne perdre aucun brouillon. Échap, la croix, « Terminé » ou un clic sur le fond la ferment ; la page derrière ne défile
// plus tant qu'elle est ouverte (ordinateur).
export function ModaleTravail({ ouverte, titre, onFermer, children, intro, introAuDebut = false, pleinePage = false, large = false, zone }: ModaleTravailProps) {
  const panneau = useRef<HTMLDivElement>(null);
  const [introVue, setIntroVue] = useState(false);
  // « Précédent » sur la toute première question ramène à l'introduction, même une fois des réponses données.
  const [introRevue, setIntroRevue] = useState(false);
  const afficherIntro = Boolean(intro) && ((introAuDebut && !introVue) || introRevue);
  const retourIntro = useCallback(() => setIntroRevue(true), []);
  // Toujours le dernier onFermer, sans relancer l'effet à chaque rendu : sinon chaque réponse remontait la page.
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  // Pied fixe des fenêtres de questions : son emplacement (pour les boutons de bascule) et l'état « tout le contenu est visible »,
  // qui retire le flou signalant qu'on peut encore défiler.
  const [emplacementBascule, setEmplacementBascule] = useState<HTMLElement | null>(null);
  const [emplacementNavigation, setEmplacementNavigation] = useState<HTMLElement | null>(null);
  const [navigationRevendiquee, setNavigationRevendiquee] = useState(false);
  const [enButee, setEnButee] = useState(true);
  useEffect(() => {
    if (!ouverte || !pleinePage) return;
    const racine = panneau.current;
    if (!racine) return;
    let image = 0;
    const evaluer = () => {
      image = 0;
      const corps = racine.querySelector<HTMLElement>(".modale-corps");
      if (!corps) return;
      // Le conteneur qui défile : le corps ou, en vue de questions, le formulaire qu'il contient.
      const defilant = [corps, ...Array.from(corps.querySelectorAll<HTMLElement>(":scope > form, :scope > section"))].find((el) => {
        const o = getComputedStyle(el).overflowY;
        return (o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1;
      });
      // Sans conteneur qui défile (téléphone : c'est la page), on regarde si le bas de la fenêtre est à l'écran.
      setEnButee(defilant ? defilant.scrollTop + defilant.clientHeight >= defilant.scrollHeight - 2 : racine.getBoundingClientRect().bottom <= window.innerHeight + 2);
    };
    const planifier = () => {
      if (!image) image = requestAnimationFrame(evaluer);
    };
    planifier();
    racine.addEventListener("scroll", planifier, true); // le défilement ne remonte pas : on l'écoute en capture
    window.addEventListener("scroll", planifier);
    window.addEventListener("resize", planifier);
    const observateur = typeof MutationObserver !== "undefined" ? new MutationObserver(planifier) : null;
    observateur?.observe(racine, { childList: true, subtree: true });
    return () => {
      if (image) cancelAnimationFrame(image);
      racine.removeEventListener("scroll", planifier, true);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
      observateur?.disconnect();
    };
  }, [ouverte, pleinePage]);

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
      <div className={`modale modale--travail${pleinePage ? " modale--plein" : ""}${large ? " modale--large" : ""}`} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={panneau}>
        {/* Téléphone seulement (caché sur ordinateur) : retour à la simulation. */}
        <button type="button" className="modale-lien-retour" onClick={onFermer}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" />
          Retour à la simulation
        </button>
        <div className={zone ? `modale-entete modale-entete--zone modale-entete--${zone}` : "modale-entete"}>
          {zone ? (
            <h2 className={`modale-titre-zone modale-titre-zone--${zone}`}>
              {zone === "situation" ? <UserRound size={22} aria-hidden="true" focusable="false" /> : <Compass size={22} aria-hidden="true" focusable="false" />}
              {titre}
            </h2>
          ) : (
            <h2>{titre}</h2>
          )}
          {/* Le bouton qui change l'affichage des questions (une à la fois / toutes d'un coup) se range ici, entre le titre et la croix. */}
          {pleinePage && <div className="modale-entete-bascule" ref={setEmplacementBascule} hidden={afficherIntro} />}
          <button type="button" className="secondaire modale-fermer" onClick={onFermer} aria-label="Fermer">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        {intro && (
          <div className="modale-intro" hidden={!afficherIntro}>
            <div className="modale-intro-texte">{intro}</div>
            <button type="button" className="modale-intro-continuer" onClick={() => {
                setIntroVue(true);
                setIntroRevue(false);
                requestAnimationFrame(remonterEnHaut);
              }}>
              Continuer
              <ArrowRight size={18} aria-hidden="true" focusable="false" />
            </button>
          </div>
        )}
        <div className="modale-corps" hidden={afficherIntro}>
          <FermerContexte.Provider value={onFermer}>
            <RetourIntroContexte.Provider value={intro ? retourIntro : undefined}>
              <PiedContexte.Provider value={pleinePage ? { bascule: emplacementBascule, navigation: emplacementNavigation, revendiquerNavigation: setNavigationRevendiquee } : null}>{children}</PiedContexte.Provider>
            </RetourIntroContexte.Provider>
          </FermerContexte.Provider>
          {!pleinePage && (
            <div className="barre-retour">
              <button type="button" onClick={onFermer}>
                Terminé
              </button>
            </div>
          )}
        </div>
        {/* Pied fixe des fenêtres de questions : la bascule (une question à la fois / toutes d'un coup) et « Enregistrer et fermer », toujours
            visibles ; un flou au-dessus dit qu'on peut encore défiler. */}
        {pleinePage && (
          <div className={`modale-pied-travail${enButee ? " modale-pied-travail--butee" : ""}`} hidden={afficherIntro}>
            <div className="modale-pied-travail-navigation" ref={setEmplacementNavigation} />
            {!navigationRevendiquee && (
              <button type="button" className="modale-pied-travail-fermer" onClick={onFermer}>
                Enregistrer et fermer
              </button>
            )}          </div>
        )}
      </div>    </div>
  );
}
