import { CircleHelp, Compass, Eye, Trophy, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import type { Raison } from "../engine/candidatIdeal";
import { PREFIXE_ANONYME } from "./aveugle";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { partiAffichable } from "./parti";
import { premiereEnMajuscule } from "./VueThemes";

// Card « candidat idéal » (décision du 2026-09-30, refondue le 2026-10-10) : seul endroit du produit qui désigne un candidat, par
// une règle publique et identique pour tous (score = mesures favorables moins mesures défavorables, sans pourcentage ni pondération). Au centre,
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
  // Score noté sur 100 (100 = le nombre de mesures du candidat qui en a le plus), jamais négatif : c'est ce que montre la barre du top.
  note?: number;
  // Nombre de mesures du candidat qui en a le plus : ce qui vaut 100 (sert à expliquer la note dans la fenêtre de détail).
  reference?: number;
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

// Nombre de badges montrés par colonne avant « Voir plus ».
const MESURES_VISIBLES = 3;

const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

// Les points du score, en deux listes parallèles (autant de blocs que le score en compte) : l'icône du thème, puis les groupes
// des mesures (rien de plus).
// Badges d'une série : un par groupe de mesures (ou par mesure), une seule fois par thème.
export function badgesDe(points: Raison[], parMesure: boolean): Array<{ theme: string; groupe: string }> {
  const vus = new Set<string>();
  return points
    // Un groupe est un morceau de phrase, souvent en minuscules : sa première lettre est une majuscule (pas les titres de mesures).
    .flatMap((p) => (parMesure ? p.mesures : p.groupes.map(premiereEnMajuscule)).map((groupe) => ({ theme: p.theme, groupe })))
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
  cote,
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
  // Un seul côté (la fenêtre de détail sépare favorables et défavorables par onglets) : sans intitulé, il est dans l'onglet.
  cote?: "pour" | "contre";
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
  const listePour = cote === "contre" ? [] : badgesDe(pour, parMesure);
  const listeContre = cote === "pour" ? [] : badgesDe(contre, parMesure);
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
        {listePour.length > 0 && !cote && etiquette("pour")}
        {visibles(listePour).map((b, i) => badge("pour", b, i))}
        {listeContre.length > 0 && !cote && etiquette("contre")}
        {visibles(listeContre).map((b, i) => badge("contre", b, i))}
      </ul>
      {cote && (cote === "pour" ? listePour : listeContre).length === 0 && (
        <p className="hint">Aucune mesure {cote === "pour" ? intitule.pourSing : intitule.contreSing}.</p>
      )}
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
// longueur compare chaque nombre de mesures au plus grand de la colonne : même échelle pour tous ses candidats. Le score est aussi écrit, avec son signe : la couleur ne porte jamais seule l'information.
// `barres` faux : seul le score est montré (des candidats à égalité de score n'ont pas forcément les mêmes points favorables et
// défavorables : on ne dessine alors les barres d'aucun d'eux plutôt que de prêter celles de l'un à tous).
export function Jauge({ ameliorants, degradants, echelle, barres = true }: { ameliorants: number; degradants: number; echelle: number; barres?: boolean }) {
  const solde = ameliorants - degradants;
  const part = (n: number) => Math.min(50, (n / Math.max(1, echelle)) * 50);
  const etiquette = barres
    ? `Score ${signe(solde)} : ${ameliorants} favorable${ameliorants > 1 ? "s" : ""} moins ${degradants} défavorable${degradants > 1 ? "s" : ""}`
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

// Barre du top : le score noté sur 100, de 0 à 100, qui part de la gauche dans les deux colonnes. Le chiffre est écrit : la couleur ne
// porte jamais seule l'information.
export function JaugeNote({ note }: { note: number }) {
  return (
    <span className="ideal-note" role="img" aria-label={`Score ${note} sur 100`}>
      <span className="ideal-note-piste" aria-hidden="true">
        <span className="ideal-note-barre" style={{ width: `${Math.min(100, Math.max(0, note))}%` }} />
      </span>
      <span className="ideal-note-valeur" aria-hidden="true">
        {note}
        <small>/100</small>
      </span>
    </span>
  );
}

// Rappel du score dans la fenêtre de détail : un rond dont le contour se remplit comme la barre du top (100 = le maximum), avec la
// note écrite au centre.
export function RondScore({ note }: { note: number }) {
  const n = Math.min(100, Math.max(0, note));
  return (
    <span className="ideal-rond" role="img" aria-label={`Score ${n} sur 100`}>
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle className="ideal-rond-piste" cx="32" cy="32" r="27" />
        <circle className="ideal-rond-arc" cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${n} 100`} transform="rotate(-90 32 32)" />
      </svg>
      <span className="ideal-rond-valeur" aria-hidden="true">
        {n}
        <small>/100</small>
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
function LignePlace({ place, revele, onOuvrir }: { place: LigneClassement[]; revele: boolean; onOuvrir: () => void }) {
  const premier = place[0];
  const identite = revele ? premier.identite : null;
  // Des ex æquo ont le même score, donc la même note : une seule barre pour toute la ligne.
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
        <JaugeNote note={premier.note ?? 0} />
      </span>
    </>
  );
  const classe = "ideal-ligne";
  return revele && identite ? (
    <button type="button" className={classe} aria-haspopup="dialog" onClick={onOuvrir}>
      {contenu}
    </button>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

// Un top 3 (situation ou convictions) : trois lignes au plus, une par PLACE. Les candidats à égalité de score sont regroupés
// dans la même ligne, sous un seul numéro et une seule jauge (sans mention d'égalité : ils sont côte à côte). Les titres restent nets sous le flou ; seules les lignes sont floutées.
export function ColonneTop({ resultat, revele, onOuvrir }: { resultat: ResultatAffiche; revele: boolean; onOuvrir: (place: LigneClassement[]) => void }) {
  const lignes = resultat.classement;
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
              <LignePlace place={place} revele={revele} onOuvrir={() => onOuvrir(place)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Résultat « convictions » non calculable (aucune position choisie, ou aucune mesure étiquetée sur ces sujets) : on le dit
// plutôt que de laisser croire qu'il n'existe pas, sans rien inventer.
export function BlocAbsent({ positionsChoisies }: { positionsChoisies: boolean }) {
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
  const nPour = badgesDe(ligne.pour, parMesure).length;
  const nContre = badgesDe(ligne.contre, parMesure).length;
  // « 20/20 des mesures vous avantagent » : la part des mesures qui vont dans le bon sens, en mesures (l'unité du score), à côté du
  // rond. Elle ne change pas le classement. La seconde phrase explique une note sous 100 même quand toutes les mesures sont
  // favorables : le 100 est celui du candidat qui a le plus de mesures qui touchent le visiteur.
  const mesuresPour = badgesDe(ligne.pour, true).length;
  const mesuresContre = badgesDe(ligne.contre, true).length;
  const mesuresTotal = mesuresPour + mesuresContre;
  const explicationNote = ligne.reference !== undefined && ligne.note !== undefined && ligne.note < 100 && mesuresTotal > 0 ? { reference: ligne.reference, score: Math.max(0, mesuresPour - mesuresContre), note: ligne.note } : null;
  // Onglet ouvert : les favorables, sauf s'il n'y en a aucun alors qu'il y a des défavorables.
  const [coteChoisi, setCote] = useState<"pour" | "contre" | null>(null);
  const cote = coteChoisi ?? (nPour === 0 && nContre > 0 ? "contre" : "pour");
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
          <RondScore note={ligne.note ?? 0} />
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
        <p className="hint ideal-score-explication">
          {mesuresTotal === 0 ? (
            "Aucune mesure ne vous concerne chez ce candidat."
          ) : (
            <>
              <strong>
                {mesuresPour}/{mesuresTotal}
              </strong>{" "}
              des mesures {unite === "sujets" ? "vont dans le sens de vos convictions" : "vous avantagent"}.
              {explicationNote && (
                <span className="ideal-score-reference">
                  {" "}
                  Le candidat qui en a le plus en a {explicationNote.reference} : {explicationNote.score} sur {explicationNote.reference}, soit {explicationNote.note}/100.
                </span>
              )}
            </>
          )}
        </p>
        {/* La barre du total (en groupes de mesures, ou en mesures si le visiteur le demande) d'abord, puis les onglets collés en
            haut de la fenêtre : favorables d'un côté, défavorables de l'autre. Le bouton discret change tout le contenu d'un coup. */}
        <div className="ideal-totaux">
          <div className="ideal-total">
            <span className="ideal-total-libelle">{parMesure ? "Mesures" : "Groupes de mesures"}</span>
            <Jauge ameliorants={nPour} degradants={nContre} echelle={Math.max(nPour, nContre, 1)} />
          </div>
          <button type="button" className="ideal-bascule" aria-pressed={parMesure} onClick={() => setParMesure(!parMesure)}>
            {parMesure ? "Voir par groupes de mesures" : "Voir le détail par mesure"}
          </button>
        </div>
        <div className="ideal-onglets" role="tablist" aria-label="Favorables et défavorables">
          {(
            [
              { id: "pour", libelle: unite === "sujets" ? "Proches" : "Favorables", n: nPour },
              { id: "contre", libelle: unite === "sujets" ? "Opposées" : "Défavorables", n: nContre },
            ] as const
          ).map(({ id, libelle, n }) => (
            <button key={id} type="button" role="tab" id={`onglet-${id}`} aria-selected={cote === id} aria-controls="panneau-mesures" className="ideal-onglet" onClick={() => setCote(id)}>
              {libelle} <span className="ideal-onglet-nombre">{n}</span>
            </button>
          ))}
        </div>
        {/* Seule la liste défile : l'en-tête, la barre et les onglets restent à l'écran, et la fenêtre ne dépasse jamais la page. */}
        <div id="panneau-mesures" className="ideal-modale-corps" role="tabpanel" aria-labelledby={`onglet-${cote}`}>
          <PoursContres key={`${critere}-${ligne.lettre}`} pour={ligne.pour} contre={ligne.contre} unite={unite} parMesureImpose={parMesure} toutAfficher sansTotal cote={cote} />
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
          <h2 id="modale-aide-titre">Comment est suggéré le candidat ?</h2>
          <button type="button" className="bouton-icone" ref={fermer} onClick={onFermer} aria-label="Fermer l'aide">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <section>
          <h3>Le candidat suggéré</h3>
          <ul>
            <li>Chaque candidat a deux scores : un selon votre situation, un selon vos convictions.</li>
            <li>Les deux sont additionnés : le candidat suggéré a le total le plus élevé.</li>
            <li>Dans chaque bloc, l'onglet « Candidats » montre les 3 meilleures places.</li>
          </ul>
        </section>
        <section>
          <h3>Le score d'un candidat</h3>
          <ul>
            <li>Une mesure qui va dans votre sens rapporte 1 point au candidat. Une mesure à l'opposé lui retire 1 point.</li>
          </ul>
        </section>
        <section>
          <h3>La précision</h3>
          <ul>
            <li>Plus vous répondez aux questions, plus la suggestion est précise.</li>
          </ul>
        </section>
        <section>
          <h3>Bon à savoir</h3>
          <ul>
            <li>La règle est la même pour tous. Le détail et les limites sont dans la page « À propos ».</li>
          </ul>
        </section>
      </div>
    </div>,
  );
}
