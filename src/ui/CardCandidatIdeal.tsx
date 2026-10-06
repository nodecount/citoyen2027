import { Compass, Eye, Trophy, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Raison } from "../engine/candidatIdeal";
import { PREFIXE_ANONYME } from "./aveugle";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { partiAffichable } from "./parti";

// Card « candidat idéal » (décision du 2026-09-30) : seul endroit du produit qui désigne un candidat, par une règle publique
// et identique pour tous (score = thèmes favorables moins thèmes défavorables, sans pondération). Deux résultats séparés :
// situation et convictions. Floutée tant qu'elle n'est pas révélée : l'identité n'est alors PAS dans la page.
export interface GagnantAffiche {
  lettre: string;
  // Ignorée tant que `revele` est faux, même si elle est fournie : le flou CSS n'est jamais la seule protection.
  identite: { slug: string; nom: string; parti: string } | null;
  ameliorants: number;
  degradants: number;
  analyses: number;
  // Mesures qui ont fait pencher le score (vides tant que la card est floutée).
  pour: Raison[];
  contre: Raison[];
}

export interface ResultatAffiche {
  titre: string;
  unite: "thèmes" | "sujets";
  gagnants: GagnantAffiche[];
  solde: number;
  departageable: boolean;
  ecartes: number;
  // Tous les candidats avec des données sont écartés par l'intégrité (≠ « les données ne permettent pas de départager »).
  tousEcartes: boolean;
}

interface CardCandidatIdealProps {
  situation: ResultatAffiche | null;
  convictions: ResultatAffiche | null;
  questionsRestantes: number;
  // Le visiteur a choisi au moins une position (pour expliquer l'absence de résultat « convictions »).
  positionsChoisies?: boolean;
  revele: boolean;
  onReveler: () => void;
  onRecommencer: () => void;
}

// Nombre de badges montrés par colonne avant « Voir plus ».
const MESURES_VISIBLES = 3;

// Floutée, la card montre tout sauf l'identité : les listes de points y sont (textes déjà épurés des noms par l'anonymisation),
// seul le flou CSS les rend illisibles. Nom, parti et portrait réels n'y sont JAMAIS (voir `identite`, ignorée ici).
function BlocFlou({ resultat }: { resultat: ResultatAffiche }) {
  // Un bloc par ex æquo (au plus trois), ou « ? » quand rien ne départage.
  const visibles = resultat.departageable ? resultat.gagnants.slice(0, 3) : [];
  return (
    <div className="ideal-bloc">
      <TitreResultat titre={resultat.titre} />
      {/* Seul le NOMBRE d'ex æquo est dit : jamais leur identité. */}
      {resultat.departageable && resultat.gagnants.length > 1 && (
        <p>
          <strong>{resultat.gagnants.length} candidats à égalité</strong>
        </p>
      )}
      <div className="ideal-flou" aria-hidden="true">
        {visibles.length === 0 ? (
          <div className="ideal-flou-candidat">
            <div className="ideal-flou-entete">
              <Pastille slug={`${PREFIXE_ANONYME}?`} nom="Candidat ?" />
              <p>Prénom Nom, parti du candidat</p>
            </div>
          </div>
        ) : (
          visibles.map((g) => (
            <div key={g.lettre} className="ideal-flou-candidat">
              <div className="ideal-flou-entete">
                <Pastille
                  slug={`${PREFIXE_ANONYME}${g.lettre}`}
                  nom={`Candidat ${g.lettre}`}
                />
                <p>Prénom Nom, parti du candidat</p>
              </div>
              <PoursContres
                pour={g.pour}
                contre={g.contre}
                unite={resultat.unite}
                interactif={false}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Les points du score, en deux listes parallèles (autant de blocs que le score en compte) : l'icône du thème, puis les groupes
// des mesures (rien de plus).
export function PoursContres({
  pour,
  contre,
  unite,
  interactif = true,
  deplieInitial = false,
}: {
  pour: Raison[];
  contre: Raison[];
  unite: ResultatAffiche["unite"];
  // Faux sous le flou : pas de bouton (il serait flou et inerte).
  interactif?: boolean;
  // Pour les tests de rendu statique, qui ne peuvent pas cliquer sur « Voir plus ».
  deplieInitial?: boolean;
}) {
  // Un seul bouton par card : il déplie les pour et les contre ensemble.
  const [deplie, setDeplie] = useState(deplieInitial);
  if (pour.length === 0 && contre.length === 0) return null;
  // Un badge par groupe de mesures (et non un par point du score) : un même groupe n'apparaît qu'une fois par thème.
  const badges = (points: Raison[]) => {
    const vus = new Set<string>();
    return points
      .flatMap((p) => p.groupes.map((groupe) => ({ theme: p.theme, groupe })))
      .filter(
        (b) =>
          !vus.has(`${b.theme}|${b.groupe}`) &&
          vus.add(`${b.theme}|${b.groupe}`),
      );
  };
  const listePour = badges(pour);
  const listeContre = badges(contre);
  const aDeplier = Math.max(listePour.length, listeContre.length) > MESURES_VISIBLES;
  // Badges que « Voir plus » révèle : ceux au-delà des trois premiers, pour et contre confondus.
  const cachés =
    Math.max(0, listePour.length - MESURES_VISIBLES) +
    Math.max(0, listeContre.length - MESURES_VISIBLES);
  const visibles = (liste: Array<{ theme: string; groupe: string }>) =>
    deplie ? liste : liste.slice(0, MESURES_VISIBLES);
  const convictions = unite === "sujets";
  // Intitulés des deux côtés (ceux de l'écran des mesures : favorables / défavorables à la situation ; proches / opposées aux
  // convictions), au pluriel pour l'étiquette et au singulier accordé pour le total.
  const intitule = convictions
    ? { pour: "proches de vos convictions", contre: "opposées à vos convictions", pourSing: "proche de vos convictions", contreSing: "opposé à vos convictions" }
    : { pour: "favorables à votre situation", contre: "défavorables à votre situation", pourSing: "favorable à votre situation", contreSing: "défavorable à votre situation" };
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
  const total = (n: number, pluriel: string, singulier: string) =>
    `${n} groupe${n > 1 ? "s" : ""} de mesures ${n > 1 ? pluriel : singulier}`;
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
      {deplie && (
        <p className="hint ideal-badges-total">
          Au total : {total(listePour.length, intitule.pour, intitule.pourSing)}, {total(listeContre.length, intitule.contre, intitule.contreSing)}.
        </p>
      )}
      {interactif && aDeplier && (
        <button
          type="button"
          className="secondaire ideal-voir-plus"
          aria-expanded={deplie}
          onClick={() => setDeplie(!deplie)}
        >
          {deplie ? "Voir moins" : `Voir plus (${cachés} autres)`}
        </button>
      )}
    </div>
  );
}

function BlocRevele({ resultat }: { resultat: ResultatAffiche }) {
  const { gagnants, departageable, unite } = resultat;
  return (
    <div className="ideal-bloc">
      <TitreResultat titre={resultat.titre} />
      {departageable ? (
        <>
          {gagnants.length > 1 && (
            <p>
              <strong>{gagnants.length} candidats à égalité</strong>
            </p>
          )}
          <ul className="ideal-gagnants">
            {gagnants.map((g) =>
              g.identite ? (
                <li key={g.lettre}>
                  <Pastille slug={g.identite.slug} nom={g.identite.nom} />
                  <div>
                    <strong>{g.identite.nom}</strong>
                    {partiAffichable(g.identite.parti) && (
                      <span className="detail-parti">
                        {partiAffichable(g.identite.parti)}
                      </span>
                    )}{" "}
                    <span className="hint">(Candidat {g.lettre})</span>
                  </div>
                  <PoursContres pour={g.pour} contre={g.contre} unite={unite} />
                </li>
              ) : null,
            )}
          </ul>
        </>
      ) : resultat.tousEcartes ? (
        <p>
          <strong>Tous les candidats étudiés sont écartés</strong> :
          condamnation connue.
        </p>
      ) : (
        <p>
          <strong>Égalité parfaite : aucun candidat ne se détache.</strong>
        </p>
      )}
    </div>
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
  questionsRestantes,
  positionsChoisies = false,
  revele,
  onReveler,
  onRecommencer,
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

  const resultats = [situation, convictions].filter(
    (r): r is ResultatAffiche => r !== null,
  );
  if (resultats.length === 0) return null;
  const n = questionsRestantes;
  const afficher = (r: ResultatAffiche) =>
    revele ? (
      <BlocRevele key={r.titre} resultat={r} />
    ) : (
      <BlocFlou key={r.titre} resultat={r} />
    );
  return (
    <section
      className={`carte-ideal${revele ? "" : " carte-ideal--floue"}`}
      aria-label="Candidat idéal"
    >
      <h2 ref={titre} tabIndex={-1}>
        <Trophy size={24} aria-hidden="true" focusable="false" />
        Votre candidat idéal
      </h2>
      <div className="ideal-colonnes" aria-live="polite">
        {situation && (
          <div className="ideal-colonne">{afficher(situation)}</div>
        )}
        <div className="ideal-colonne">
          {convictions ? (
            afficher(convictions)
          ) : (
            <BlocAbsent positionsChoisies={positionsChoisies} />
          )}
        </div>
      </div>
      <p className="hint regle-ideal">
        Comment est calculé le score ? Selon votre situation : +1 point par
        thème où les mesures du candidat vous avantagent, −1 point par thème où
        elles vous désavantagent. Selon vos convictions : +1 point chaque fois
        que, sur un thème, ses mesures vont dans le sens d'une position que vous
        avez choisie, −1 point quand elles vont à l'opposé ; un même sujet peut
        donc compter dans plusieurs thèmes. Chaque badge des deux listes est un
        groupe de mesures du candidat : l'icône indique son thème. Un thème à la
        fois favorable et défavorable vaut 0 et n'apparaît pas. Même règle pour
        tous, aucun thème ni sujet ne compte plus qu'un autre. En cas d'égalité,
        tous les candidats concernés sont montrés. Plus il y a de thèmes
        étudiés, plus le score est fiable.
      </p>
      {/* Le bouton n'est pas une card à part : il est posé PAR-DESSUS les résultats floutés, qui restent lisibles derrière (titres nets,
          identités floutées). Révélé, il laisse place à un simple pied de card. */}
      {revele ? (
        <div className="ideal-pied">
          <p className="chapeau">
            Voici votre candidat idéal pour 2027 d'après vos réponses.
          </p>
          <button type="button" className="secondaire" onClick={onRecommencer}>
            Recommencer la simulation
          </button>
        </div>
      ) : (
        <div className="ideal-voile">
          <BandeauRevelation avecConvictions={convictions !== null} questionsRestantes={n} onReveler={onReveler} />
        </div>
      )}
    </section>
  );
}
