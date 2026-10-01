import { Compass, Eye, Trophy, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { PREFIXE_ANONYME } from "./aveugle";
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

function BlocFlou({ resultat }: { resultat: ResultatAffiche }) {
  // Une pastille par ex æquo (au plus trois), ou « ? » quand rien ne départage : aucune identité, seulement des lettres.
  const lettres = resultat.departageable ? resultat.gagnants.slice(0, 3).map((g) => g.lettre) : ["?"];
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
        {lettres.map((lettre) => (
          <Pastille key={lettre} slug={`${PREFIXE_ANONYME}${lettre}`} nom={`Candidat ${lettre}`} />
        ))}
        <p>Prénom Nom, parti du candidat</p>
      </div>
      <p className="hint">Identité masquée.</p>
    </div>
  );
}

function BlocRevele({ resultat }: { resultat: ResultatAffiche }) {
  const { gagnants, solde, departageable, ecartes, unite } = resultat;
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
                    {partiAffichable(g.identite.parti) && <span className="detail-parti">{partiAffichable(g.identite.parti)}</span>}{" "}
                    <span className="hint">(Candidat {g.lettre})</span>
                    <br />
                    Score {solde > 0 ? `+${solde}` : solde} : {g.ameliorants} en votre faveur, {g.degradants} en votre défaveur, sur {g.analyses} {unite} étudiés
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </>
      ) : resultat.tousEcartes ? (
        <p>
          <strong>Tous les candidats étudiés sont écartés</strong> : condamnation définitive connue.
        </p>
      ) : (
        <p>
          <strong>Égalité parfaite : aucun candidat ne se détache.</strong>
        </p>
      )}
      {ecartes > 0 && !resultat.tousEcartes && (
        <p className="hint">
          {ecartes} candidat{ecartes > 1 ? "s" : ""} {ecartes > 1 ? "écartés" : "écarté"} (condamnation définitive connue).
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
        <p className="hint">Pas encore de résultat : les mesures des candidats n'ont pas encore été étudiées sur les sujets que vous avez choisis.</p>
      ) : (
        <p className="hint">Pas encore de résultat : choisissez au moins une position dans « Mes convictions ».</p>
      )}
    </div>
  );
}

export function CardCandidatIdeal({ situation, convictions, questionsRestantes, positionsChoisies = false, revele, onReveler, onRecommencer }: CardCandidatIdealProps) {
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

  const resultats = [situation, convictions].filter((r): r is ResultatAffiche => r !== null);
  if (resultats.length === 0) return null;
  const n = questionsRestantes;
  const afficher = (r: ResultatAffiche) => (revele ? <BlocRevele key={r.titre} resultat={r} /> : <BlocFlou key={r.titre} resultat={r} />);
  return (
    <section className={`carte-ideal${revele ? "" : " carte-ideal--floue"}`} aria-label="Candidat idéal">
      <h2 ref={titre} tabIndex={-1}>
        <Trophy size={24} aria-hidden="true" focusable="false" />
        Votre candidat idéal
      </h2>
      <div className="ideal-colonnes" aria-live="polite">
        {situation && <div className="ideal-colonne">{afficher(situation)}</div>}
        <div className="ideal-colonne">{convictions ? afficher(convictions) : <BlocAbsent positionsChoisies={positionsChoisies} />}</div>
      </div>
      <p className="hint regle-ideal">
        Comment est calculé le score ? +1 point par thème où les mesures du candidat vous avantagent, −1 point par thème où elles vous désavantagent. Même règle pour tous, aucun thème ne compte plus qu'un autre. En cas d'égalité, tous les candidats concernés sont montrés. Plus il y a de thèmes étudiés, plus le score est fiable.
      </p>
      {/* Le bouton n'est pas une card à part : il est posé PAR-DESSUS les résultats floutés, qui restent lisibles derrière (titres nets,
          identités floutées). Révélé, il laisse place à un simple pied de card. */}
      {revele ? (
        <div className="ideal-pied">
          <p className="chapeau">Voici votre candidat idéal pour 2027 d'après vos réponses.</p>
          <button type="button" className="secondaire" onClick={onRecommencer}>
            Recommencer la simulation
          </button>
        </div>
      ) : (
        <div className="ideal-voile">
          <div className="ideal-voile-contenu">
            <p className="chapeau">
              Votre candidat idéal selon votre situation{convictions ? " et selon vos convictions" : ""} est prêt.
              {n > 0 && ` ${n === 1 ? "Une question reste à traiter dans les thèmes" : `${n} questions restent à traiter dans les thèmes`} : y répondre affine le résultat.`}
            </p>
            <button type="button" onClick={onReveler}>
              <Eye size={20} aria-hidden="true" focusable="false" />
              Révéler mon programme de candidat idéal pour 2027
            </button>
          </div>
        </div>
      )}
    </section>
  );
}