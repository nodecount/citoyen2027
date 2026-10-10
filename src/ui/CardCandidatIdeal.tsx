import { CircleHelp, Compass, Eye, Trophy, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import type { Raison } from "../engine/candidatIdeal";
import { PREFIXE_ANONYME } from "./aveugle";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { partiAffichable } from "./parti";

// Card « candidat idéal » (décision du 2026-09-30, refondue le 2026-10-10) : seul endroit du produit qui désigne un candidat, par
// une règle publique et identique pour tous (score = thèmes favorables moins thèmes défavorables, sans pondération). Au centre,
// le candidat qui cumule les deux critères (situation + convictions) ; de part et d'autre, le top 5 de chaque critère, avec la
// jauge de score de chacun. Floutée tant qu'elle n'est pas révélée : l'identité n'est alors PAS dans la page.
export interface GagnantAffiche {
  lettre: string;
  // Ignorée tant que `revele` est faux, même si elle est fournie : le flou CSS n'est jamais la seule protection.
  identite: { slug: string; nom: string; parti: string } | null;
  ameliorants: number;
  degradants: number;
  analyses: number;
  // Score du candidat (améliorants − dégradants).
  solde: number;
  // Mesures qui ont fait pencher le score (vides tant que la card est floutée).
  pour: Raison[];
  contre: Raison[];
}

// Une ligne du top : le rang est partagé par les ex æquo.
export interface LigneClassement extends GagnantAffiche {
  rang: number;
}

export interface ResultatAffiche {
  titre: string;
  unite: "thèmes" | "sujets";
  gagnants: GagnantAffiche[];
  // Top 3 places, du meilleur score au moins bon : les ex æquo partagent la même place (`rang`).
  classement: LigneClassement[];
  solde: number;
  departageable: boolean;
  ecartes: number;
  // Tous les candidats avec des données sont écartés par l'intégrité (≠ « les données ne permettent pas de départager »).
  tousEcartes: boolean;
}

interface CardCandidatIdealProps {
  situation: ResultatAffiche | null;
  convictions: ResultatAffiche | null;
  // Candidat qui cumule les deux critères (situation seule quand il n'y a pas de résultat « convictions »).
  combine: ResultatAffiche | null;
  questionsRestantes: number;
  // Le visiteur a choisi au moins une position (pour expliquer l'absence de résultat « convictions »).
  positionsChoisies?: boolean;
  revele: boolean;
  onReveler: () => void;
}

// Nombre de badges montrés par colonne avant « Voir plus ».
const MESURES_VISIBLES = 3;

const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

// Les points du score, en deux listes parallèles (autant de blocs que le score en compte) : l'icône du thème, puis les groupes
// des mesures (rien de plus).
// Badges d'une série : un par groupe de mesures (ou par mesure), une seule fois par thème.
export function badgesDe(points: Raison[], parMesure: boolean): Array<{ theme: string; groupe: string }> {
  const vus = new Set<string>();
  return points
    .flatMap((p) => (parMesure ? p.mesures : p.groupes).map((groupe) => ({ theme: p.theme, groupe })))
    .filter((b) => !vus.has(`${b.theme}|${b.groupe}`) && vus.add(`${b.theme}|${b.groupe}`));
}

// Nombre de groupes de mesures (ou de mesures) derrière un score, pour et contre confondus : celui des onglets de la fenêtre.
export const compterBadges = (pour: Raison[], contre: Raison[], parMesure: boolean): number => badgesDe(pour, parMesure).length + badgesDe(contre, parMesure).length;

// Intitulés des deux côtés (ceux de l'écran des mesures : favorables / défavorables à la situation ; proches / opposées aux
// convictions), au pluriel pour l'étiquette et au singulier accordé pour le total.
const intitules = (unite: ResultatAffiche["unite"]) =>
  unite === "sujets"
    ? { pour: "proches de vos convictions", contre: "opposées à vos convictions", pourSing: "proche de vos convictions", contreSing: "opposé à vos convictions" }
    : { pour: "favorables à votre situation", contre: "défavorables à votre situation", pourSing: "favorable à votre situation", contreSing: "défavorable à votre situation" };

// « Au total : 5 mesures favorables à votre situation, 0 mesure défavorable à votre situation. » (ou en groupes de mesures).
export function phraseTotal(pour: Raison[], contre: Raison[], unite: ResultatAffiche["unite"], parMesure: boolean): string {
  const intitule = intitules(unite);
  const nom = (n: number) => (parMesure ? (n > 1 ? "mesures" : "mesure") : n > 1 ? "groupes de mesures" : "groupe de mesures");
  const total = (n: number, pluriel: string, singulier: string) => `${n} ${nom(n)} ${n > 1 ? pluriel : singulier}`;
  const nPour = badgesDe(pour, parMesure).length;
  const nContre = badgesDe(contre, parMesure).length;
  return `Au total : ${total(nPour, intitule.pour, intitule.pourSing)}, ${total(nContre, intitule.contre, intitule.contreSing)}.`;
}

export function PoursContres({
  pour,
  contre,
  unite,
  interactif = true,
  deplieInitial = false,
  parMesureInitial = false,
  parMesureImpose,
  toutAfficher = false,
  sansTotal = false,
}: {
  pour: Raison[];
  contre: Raison[];
  unite: ResultatAffiche["unite"];
  // Faux sous le flou : pas de bouton (il serait flou et inerte).
  interactif?: boolean;
  // Pour les tests de rendu statique, qui ne peuvent pas cliquer sur « Voir plus ».
  deplieInitial?: boolean;
  parMesureInitial?: boolean;
  // Quand l'appelant (la fenêtre de détail, avec ses onglets) choisit lui-même groupes ou mesures : plus de bouton de bascule ici.
  parMesureImpose?: boolean;
  // Tout montrer d'emblée, sans « Voir plus » (la fenêtre défile et ses onglets restent en haut).
  toutAfficher?: boolean;
  // Le total est écrit ailleurs (au-dessus des onglets de la fenêtre).
  sansTotal?: boolean;
}) {
  // Un seul bouton par card : il déplie les pour et les contre ensemble.
  const [depliePropre, setDeplie] = useState(deplieInitial);
  const deplie = depliePropre || toutAfficher;
  // Un seul bouton par card aussi pour passer des groupes de mesures aux mesures elles-mêmes (les deux séries changent ensemble).
  const [parMesurePropre, setParMesure] = useState(parMesureInitial);
  const parMesure = parMesureImpose ?? parMesurePropre;
  if (pour.length === 0 && contre.length === 0) return null;
  // Un badge par groupe de mesures (et non un par point du score), ou par mesure quand le visiteur les demande : un même
  // badge n'apparaît qu'une fois par thème.
  const listePour = badgesDe(pour, parMesure);
  const listeContre = badgesDe(contre, parMesure);
  const aDeplier = !toutAfficher && Math.max(listePour.length, listeContre.length) > MESURES_VISIBLES;
  // Badges que « Voir plus » révèle : ceux au-delà des trois premiers, pour et contre confondus.
  const cachés =
    Math.max(0, listePour.length - MESURES_VISIBLES) +
    Math.max(0, listeContre.length - MESURES_VISIBLES);
  const visibles = (liste: Array<{ theme: string; groupe: string }>) =>
    deplie ? liste : liste.slice(0, MESURES_VISIBLES);
  const intitule = intitules(unite);
  const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const etiquette = (sens: "pour" | "contre") => (
    <li key={`etiquette-${sens}`} className={`ideal-badges-etiquette ideal-badges-etiquette--${sens}`}>
      {majuscule(intitule[sens])}
    </li>
  );
  const badge = (
    sens: "pour" | "contre",
    b: { theme: string; groupe: string },
    i: number,
  ) => (
    <li
      key={`${sens}-${b.theme}-${i}`}
      className={`ideal-badge ideal-badge--${sens}`}
    >
      <span className="ideal-raison-icone">
        <IconeTheme themeId={b.theme} taille={18} />
      </span>
      <span className="ideal-raison-titre">{b.groupe}</span>
    </li>
  );
  return (
    <div className="ideal-poursontres">
      {/* Une seule ligne de badges (qui passe à la suivante quand elle est pleine) : les « pour » d'abord, les « contre » ensuite,
          chaque série précédée de son intitulé. */}
      <ul className="ideal-badges">
        {listePour.length > 0 && etiquette("pour")}
        {visibles(listePour).map((b, i) => badge("pour", b, i))}
        {listeContre.length > 0 && etiquette("contre")}
        {visibles(listeContre).map((b, i) => badge("contre", b, i))}
      </ul>
      {/* Une fois tout déplié : le total de chaque côté, en groupes de mesures (c'est ce que comptent les badges). */}
      {deplie && !sansTotal && <p className="hint ideal-badges-total">{phraseTotal(pour, contre, unite, parMesure)}</p>}
      {interactif && (aDeplier || parMesureImpose === undefined) && (
        <div className="ideal-actions-badges">
          {aDeplier && (
            <button
              type="button"
              className="secondaire ideal-voir-plus"
              aria-expanded={deplie}
              onClick={() => setDeplie(!deplie)}
            >
              {deplie ? "Voir moins" : `Voir plus (${cachés} autres)`}
            </button>
          )}
          {/* Passe des groupes de mesures (mots clés du résumé) aux mesures elles-mêmes, et inversement. */}
          {parMesureImpose === undefined && (
            <button
              type="button"
              className="secondaire ideal-voir-mesures"
              aria-pressed={parMesure}
              onClick={() => setParMesure(!parMesure)}
            >
              {parMesure ? "Voir les groupes de mesures" : "Voir les mesures"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Jauge de score : une barre centrée sur zéro, verte vers la droite (score positif), rouge vers la gauche (score négatif). Sa
// longueur compare le score au nombre de thèmes (ou de croisements) étudiés dans le classement : même échelle pour toute la
// colonne. Le score est aussi écrit, avec son signe : la couleur ne porte jamais seule l'information.
// `barres` faux : seul le score est montré (des candidats à égalité de score n'ont pas forcément les mêmes points favorables et
// défavorables : on ne dessine alors les barres d'aucun d'eux plutôt que de prêter celles de l'un à tous).
export function Jauge({ ameliorants, degradants, echelle, barres = true }: { ameliorants: number; degradants: number; echelle: number; barres?: boolean }) {
  const solde = ameliorants - degradants;
  const part = (n: number) => Math.min(50, (n / Math.max(1, echelle)) * 50);
  const etiquette = barres
    ? `Score ${signe(solde)} : ${ameliorants} favorable${ameliorants > 1 ? "s" : ""} moins ${degradants} défavorable${degradants > 1 ? "s" : ""}, sur ${echelle} étudié${echelle > 1 ? "s" : ""}`
    : `Score ${signe(solde)}`;
  return (
    <span className="ideal-jauge" role="img" aria-label={etiquette}>
      <span className="ideal-jauge-piste" aria-hidden="true">
        {barres && (
          <>
            <span className="ideal-jauge-barre ideal-jauge-barre--neg" style={{ width: `${part(degradants)}%` }} />
            <span className="ideal-jauge-barre ideal-jauge-barre--pos" style={{ width: `${part(ameliorants)}%` }} />
          </>
        )}
      </span>
      <span className="ideal-jauge-valeur" aria-hidden="true">
        {signe(solde)}
      </span>
    </span>
  );
}

// Même en-tête pour les deux résultats : une icône, et la question à laquelle il répond.
function TitreResultat({ titre }: { titre: string }) {
  const Icone = titre === "Selon votre situation" ? UserRound : Compass;
  return (
    <h3>
      <Icone size={20} aria-hidden="true" focusable="false" />
      {titre}
    </h3>
  );
}

// Portrait d'un candidat du top : sa photo une fois révélé, sa lettre anonyme tant que la card est floutée.
function PortraitTop({ ligne, revele }: { ligne: LigneClassement; revele: boolean }) {
  const identite = revele ? ligne.identite : null;
  return identite ? <Pastille slug={identite.slug} nom={identite.nom} /> : <Pastille slug={`${PREFIXE_ANONYME}${ligne.lettre}`} nom={`Candidat ${ligne.lettre}`} />;
}

// Une ligne du top = une place : numéro, portrait, nom et jauge. Un seul candidat : son nom et son parti. Plusieurs candidats à
// égalité : leurs portraits en pile et « X candidats » à la place du nom et du parti (le détail de chacun est dans la fenêtre).
// Révélée, toute la ligne est un bouton qui ouvre cette fenêtre ; floutée, une simple ligne (le voile la recouvre, et rien
// d'identifiant n'y figure).
function LignePlace({ place, echelle, revele, onOuvrir }: { place: LigneClassement[]; echelle: number; revele: boolean; onOuvrir: () => void }) {
  const premier = place[0];
  const identite = revele ? premier.identite : null;
  // Mêmes points favorables et défavorables chez tous les candidats de la ligne : barres communes ; sinon, le score seul.
  const memeDetail = place.every((l) => l.ameliorants === premier.ameliorants && l.degradants === premier.degradants);
  const contenu = (
    <>
      <span className="ideal-ligne-rang">{premier.rang}</span>
      {place.length === 1 ? (
        <PortraitTop ligne={premier} revele={revele} />
      ) : (
        <span className="ideal-pile">
          {place.slice(0, 3).map((l) => (
            <PortraitTop key={l.lettre} ligne={l} revele={revele} />
          ))}
        </span>
      )}
      <span className="ideal-ligne-corps">
        {place.length === 1 ? (
          <span className="ideal-ligne-identite">
            <span className="ideal-ligne-nom">{identite ? identite.nom : `Candidat ${premier.lettre}`}</span>
            {identite && partiAffichable(identite.parti) && <span className="detail-parti ideal-ligne-parti">{partiAffichable(identite.parti)}</span>}
          </span>
        ) : (
          <span className="ideal-ligne-nom">{place.length} candidats</span>
        )}
        <Jauge ameliorants={premier.ameliorants} degradants={premier.degradants} echelle={echelle} barres={memeDetail} />
      </span>
    </>
  );
  return revele && identite ? (
    <button type="button" className="ideal-ligne" aria-haspopup="dialog" onClick={onOuvrir}>
      {contenu}
    </button>
  ) : (
    <div className="ideal-ligne">{contenu}</div>
  );
}

// Un top 3 (situation ou convictions) : trois lignes au plus, une par PLACE. Les candidats à égalité de score sont regroupés
// dans la même ligne, sous un seul numéro et une seule jauge (sans mention d'égalité : ils sont côte à côte). Les titres restent nets sous le flou ; seules les lignes sont floutées.
function ColonneTop({ resultat, revele, onOuvrir }: { resultat: ResultatAffiche; revele: boolean; onOuvrir: (place: LigneClassement[]) => void }) {
  const lignes = resultat.classement;
  const echelle = Math.max(1, ...lignes.map((l) => l.analyses));
  const places = [...new Set(lignes.map((l) => l.rang))].map((rang) => lignes.filter((l) => l.rang === rang));
  return (
    <div className="ideal-bloc ideal-top">
      <TitreResultat titre={resultat.titre} />
      {lignes.length === 0 ? (
        resultat.tousEcartes ? (
          <p>
            <strong>Tous les candidats étudiés sont écartés</strong> : condamnation connue.
          </p>
        ) : (
          <p className="hint">Aucun candidat n'a de résultat sur ce critère.</p>
        )
      ) : (
        <ol className={`ideal-lignes${revele ? "" : " ideal-flou"}`} {...(revele ? {} : { "aria-hidden": true as const })}>
          {places.map((place) => (
            <li key={place[0].rang}>
              <LignePlace place={place} echelle={echelle} revele={revele} onOuvrir={() => onOuvrir(place)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Au centre : le candidat qui cumule les deux critères. Floutée, seul le NOMBRE d'ex æquo est dit : jamais leur identité.
function CentreIdeal({ combine, revele }: { combine: ResultatAffiche | null; revele: boolean }) {
  const gagnants = combine && combine.departageable ? combine.gagnants : [];
  return (
    <div className="ideal-centre">
      <p className="ideal-centre-etiquette">Candidat idéal, tous critères confondus</p>
      {gagnants.length > 1 && (
        <p>
          <strong>{gagnants.length} candidats à égalité</strong>
        </p>
      )}
      {gagnants.length === 0 ? (
        combine?.tousEcartes ? (
          <p>
            <strong>Tous les candidats étudiés sont écartés</strong> : condamnation connue.
          </p>
        ) : (
          <p>
            <strong>Égalité parfaite : aucun candidat ne se détache.</strong>
          </p>
        )
      ) : (
        <ul className={`ideal-centre-liste${revele ? "" : " ideal-flou"}`} {...(revele ? {} : { "aria-hidden": true as const })}>
          {gagnants.map((g) => {
            const identite = revele ? g.identite : null;
            return (
              <li key={g.lettre}>
                {identite ? <Pastille slug={identite.slug} nom={identite.nom} className="pastille--ideal" /> : <Pastille slug={`${PREFIXE_ANONYME}${g.lettre}`} nom={`Candidat ${g.lettre}`} className="pastille--ideal" />}
                <strong className="ideal-centre-nom">{identite ? identite.nom : "Prénom Nom"}</strong>
                <span className="detail-parti">{identite ? (partiAffichable(identite.parti) ?? "") : "parti du candidat"}</span>              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Résultat « convictions » non calculable (aucune position choisie, ou aucune mesure étiquetée sur ces sujets) : on le dit
// plutôt que de laisser croire qu'il n'existe pas, sans rien inventer.
function BlocAbsent({ positionsChoisies }: { positionsChoisies: boolean }) {
  return (
    <div className="ideal-bloc ideal-bloc--absent">
      <TitreResultat titre="Selon vos convictions" />
      {positionsChoisies ? (
        <p className="hint">
          Pas encore de résultat : les mesures des candidats n'ont pas encore
          été étudiées sur les sujets que vous avez choisis.
        </p>
      ) : (
        <p className="hint">
          Pas encore de résultat : choisissez au moins une position dans « Mes
          convictions ».
        </p>
      )}
    </div>
  );
}

// Les fenêtres sont rendues dans <body> : aucun parent (débordement caché, filtre, transformation) ne peut en fausser la taille.
// Sans page (rendu statique des tests), elles restent en place.
function enPortail(contenu: ReactElement) {
  return typeof document === "undefined" ? contenu : createPortal(contenu, document.body);
}

// Détail d'une ligne du top : les groupes de mesures derrière le score, avec le passage aux mesures elles-mêmes. Échap, la croix
// ou un clic hors du panneau ferment ; le focus revient sur la ligne qui l'a ouverte.
// `egales` : tous les candidats de la même place (au moins deux en cas d'égalité) ; un sélecteur permet de passer de l'un à l'autre.
export function ModaleDetail({ ligne: ligneInitiale, egales, unite, critere, onFermer }: { ligne: LigneClassement; egales?: LigneClassement[]; unite: ResultatAffiche["unite"]; critere: string; onFermer: () => void }) {
  const fermer = useRef<HTMLButtonElement>(null);
  const [parMesure, setParMesure] = useState(false);
  const [lettre, setLettre] = useState(ligneInitiale.lettre);
  const ligne = egales?.find((l) => l.lettre === lettre) ?? ligneInitiale;
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    fermer.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("keydown", surTouche);
      avant?.focus?.();
    };
  }, [onFermer]);
  const identite = ligne.identite;
  const plusieurs = (egales?.length ?? 0) > 1;
  if (!identite) return null;
  return enPortail(
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale modale--ideal" role="dialog" aria-modal="true" aria-labelledby="modale-ideal-titre">
        <div className="modale-entete">
          {/* Plusieurs candidats : le nom est déjà dans l'onglet sélectionné, le titre n'est donc pas répété. */}
          {plusieurs ? (
            <h2 id="modale-ideal-titre">Candidats à égalité</h2>
          ) : (
            <h2 id="modale-ideal-titre" className="ideal-modale-titre">
              <Pastille slug={identite.slug} nom={identite.nom} />
              <span>
                {identite.nom}
                {partiAffichable(identite.parti) && <span className="detail-parti">{partiAffichable(identite.parti)}</span>}
              </span>
            </h2>
          )}
          <button type="button" className="bouton-icone" ref={fermer} onClick={onFermer} aria-label="Fermer le détail">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        {/* Égalité : les candidats de la même place, pour passer de l'un à l'autre. */}
        {plusieurs && egales && (
          <div className="ideal-egales" role="tablist" aria-label="Candidats à égalité">
            {egales.map((l) =>
              l.identite ? (
                <button key={l.lettre} type="button" role="tab" className="ideal-egale" aria-selected={l.lettre === ligne.lettre} onClick={() => setLettre(l.lettre)}>
                  <Pastille slug={l.identite.slug} nom={l.identite.nom} />
                  {l.identite.nom}
                  {partiAffichable(l.identite.parti) && <span className="detail-parti ideal-egale-parti">{partiAffichable(l.identite.parti)}</span>}
                </button>
              ) : null,
            )}
          </div>
        )}
        {/* Les deux totaux (groupes, puis mesures) d'abord, puis les onglets collés en haut de la fenêtre : on change de vue sans
            remonter, même avec beaucoup de mesures. */}
        <div className="ideal-totaux">
          <p className="hint">{phraseTotal(ligne.pour, ligne.contre, unite, false)}</p>
          <p className="hint">{phraseTotal(ligne.pour, ligne.contre, unite, true)}</p>
        </div>
        <div className="ideal-onglets" role="tablist" aria-label="Affichage des mesures">
          {[
            { mesures: false, libelle: "Groupes de mesures" },
            { mesures: true, libelle: "Mesures" },
          ].map(({ mesures, libelle }) => (
            <button
              key={libelle}
              type="button"
              role="tab"
              id={`onglet-${mesures ? "mesures" : "groupes"}`}
              aria-selected={parMesure === mesures}
              aria-controls="panneau-mesures"
              className="ideal-onglet"
              onClick={() => setParMesure(mesures)}
            >
              {libelle} <span className="ideal-onglet-nombre">{compterBadges(ligne.pour, ligne.contre, mesures)}</span>
            </button>
          ))}
        </div>
        {/* Seule la liste défile : l'en-tête, les totaux et les onglets restent à l'écran, et la fenêtre ne dépasse jamais la page. */}
        <div id="panneau-mesures" className="ideal-modale-corps" role="tabpanel" aria-labelledby={`onglet-${parMesure ? "mesures" : "groupes"}`}>
          <PoursContres key={`${critere}-${ligne.lettre}`} pour={ligne.pour} contre={ligne.contre} unite={unite} parMesureImpose={parMesure} toutAfficher sansTotal />
        </div>
      </div>
    </div>,
  );
}

// Aide à la compréhension du score : la règle, en courtes sections. Même fonctionnement que le détail d'une ligne (Échap, croix,
// clic à côté ; le focus revient sur le bouton d'ouverture).
export function ModaleAideScore({ onFermer }: { onFermer: () => void }) {
  const fermer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    fermer.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("keydown", surTouche);
      avant?.focus?.();
    };
  }, [onFermer]);
  return enPortail(
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale modale--ideal modale--aide" role="dialog" aria-modal="true" aria-labelledby="modale-aide-titre">
        <div className="modale-entete">
          <h2 id="modale-aide-titre">Comment est calculé le score ?</h2>
          <button type="button" className="bouton-icone" ref={fermer} onClick={onFermer} aria-label="Fermer l'aide">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <section>
          <h3>Selon votre situation</h3>
          <ul>
            <li>Chaque thème où les mesures du candidat vous avantagent rapporte 1 point.</li>
            <li>Chaque thème où elles vous désavantagent fait perdre 1 point.</li>
            <li>Un thème à la fois favorable et défavorable vaut 0 : il n'apparaît pas.</li>
          </ul>
        </section>
        <section>
          <h3>Selon vos convictions</h3>
          <ul>
            <li>Sur un thème, les mesures vont dans le sens d'une position que vous avez choisie : 1 point.</li>
            <li>Elles vont à l'opposé : 1 point en moins.</li>
            <li>Un même sujet peut compter dans plusieurs thèmes.</li>
          </ul>
        </section>
        <section>
          <h3>Les classements</h3>
          <ul>
            <li>Au centre : le candidat dont vos deux scores, additionnés, sont les plus élevés.</li>
            <li>De chaque côté : les 3 meilleures places de chaque critère, les candidats à égalité partageant la même place.</li>
            <li>En cas d'égalité, tous les candidats concernés sont montrés.</li>
          </ul>
        </section>
        <section>
          <h3>La jauge</h3>
          <ul>
            <li>Le vert, à droite du zéro, représente les points favorables.</li>
            <li>Le rouge, à gauche, représente les points défavorables.</li>
            <li>Le chiffre est la différence : 8 favorables et 3 défavorables font +5.</li>
            <li>La longueur des barres se compare au nombre de thèmes étudiés.</li>
          </ul>
        </section>
        <section>
          <h3>Les mesures d'un candidat</h3>
          <ul>
            <li>Cliquez sur un candidat du classement pour les voir.</li>
            <li>Chaque badge est un groupe de mesures. Son icône indique le thème.</li>
            <li>Les onglets en haut de la fenêtre passent des groupes de mesures aux mesures elles-mêmes, avec leur nombre.</li>
          </ul>
        </section>
        <section>
          <h3>Bon à savoir</h3>
          <ul>
            <li>La règle est la même pour tous les candidats.</li>
            <li>Aucun thème ni aucun sujet ne compte plus qu'un autre.</li>
            <li>Plus il y a de thèmes étudiés, plus le score est fiable.</li>
          </ul>
        </section>
      </div>
    </div>,
  );
}

// Annonce du résultat et bouton de révélation : même texte sur la card (posé par-dessus les résultats floutés) et sur le tableau
// du résultat (où il lève l'anonymat des lignes).
export function BandeauRevelation({
  avecConvictions,
  questionsRestantes,
  onReveler,
}: {
  avecConvictions: boolean;
  questionsRestantes: number;
  onReveler: () => void;
}) {
  const n = questionsRestantes;
  return (
    <div className="ideal-voile-contenu">
      <p className="chapeau">
        Votre candidat idéal selon votre situation
        {avecConvictions ? " et selon vos convictions" : ""} est prêt.
        {n > 0 &&
          ` ${n === 1 ? "Une question reste à traiter dans les thèmes" : `${n} questions restent à traiter dans les thèmes`} : y répondre affine le résultat.`}
      </p>
      <button type="button" onClick={onReveler}>
        <Eye size={20} aria-hidden="true" focusable="false" />
        Révéler mon programme de candidat idéal pour 2027
      </button>
    </div>
  );
}

export function CardCandidatIdeal({
  situation,
  convictions,
  combine,
  questionsRestantes,
  positionsChoisies = false,
  revele,
  onReveler,
}: CardCandidatIdealProps) {
  // À la révélation (et à « Recommencer »), le bouton cliqué disparaît : le focus passe au titre de la card, sinon il
  // retomberait sur la page et un lecteur d'écran n'entendrait pas le résultat. Pas de focus au premier affichage.
  const titre = useRef<HTMLHeadingElement>(null);
  const dejaAffichee = useRef(false);
  useEffect(() => {
    if (!dejaAffichee.current) {
      dejaAffichee.current = true;
      return;
    }
    titre.current?.focus();
  }, [revele]);

  // Ligne dont le détail est ouvert (le critère d'où elle vient, pour savoir quelles mesures lire). Jamais ouvert floutée.
  const [ouverte, setOuverte] = useState<{ place: LigneClassement[]; resultat: ResultatAffiche } | null>(null);
  useEffect(() => {
    if (!revele) setOuverte(null);
  }, [revele]);
  // Identité stable : la modale n'efface ni ne reprend le focus à chaque rendu.
  const fermerDetail = useCallback(() => setOuverte(null), []);
  const [aide, setAide] = useState(false);
  const fermerAide = useCallback(() => setAide(false), []);

  if (!situation && !convictions) return null;
  const n = questionsRestantes;
  return (
    <section
      className={`carte-ideal${revele ? "" : " carte-ideal--floue"}`}
      aria-label="Candidat idéal"
    >
      <div className="ideal-entete">
        <h2 ref={titre} tabIndex={-1}>
          <Trophy size={24} aria-hidden="true" focusable="false" />
          Votre candidat idéal
        </h2>
        <button type="button" className="secondaire ideal-aide" aria-haspopup="dialog" onClick={() => setAide(true)}>
          <CircleHelp size={20} aria-hidden="true" focusable="false" />
          Comment est calculé le score ?
        </button>
      </div>
      {/* Le candidat idéal au centre, comme s'il séparait les deux classements : à gauche la situation, à droite les convictions. */}
      <div className="ideal-mer" aria-live="polite">
        <div className="ideal-colonne ideal-colonne--gauche">
          {situation ? (
            <ColonneTop resultat={situation} revele={revele} onOuvrir={(place) => setOuverte({ place, resultat: situation })} />
          ) : null}
        </div>
        <CentreIdeal combine={combine} revele={revele} />
        <div className="ideal-colonne ideal-colonne--droite">
          {convictions ? (
            <ColonneTop resultat={convictions} revele={revele} onOuvrir={(place) => setOuverte({ place, resultat: convictions })} />
          ) : (
            <BlocAbsent positionsChoisies={positionsChoisies} />
          )}
        </div>
      </div>
      {ouverte && <ModaleDetail ligne={ouverte.place[0]} egales={ouverte.place} unite={ouverte.resultat.unite} critere={ouverte.resultat.titre} onFermer={fermerDetail} />}
      {aide && <ModaleAideScore onFermer={fermerAide} />}
      {/* Le bouton n'est pas une card à part : il est posé PAR-DESSUS les résultats floutés, qui restent lisibles derrière (titres nets,
          identités floutées). Révélé, il laisse place à un simple pied de card. */}
      {revele ? null : (
        <div className="ideal-voile">
          <BandeauRevelation avecConvictions={convictions !== null} questionsRestantes={n} onReveler={onReveler} />
        </div>
      )}
    </section>
  );
}
