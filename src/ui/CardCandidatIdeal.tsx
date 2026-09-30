import { useEffect, useRef } from "react";
import { PREFIXE_ANONYME } from "./aveugle";
import { Pastille } from "./Pastille";

// Card « candidat idéal » (décision du 2026-09-30) : seul endroit du produit qui désigne un candidat, par une règle publique
// et identique pour tous (solde = thèmes améliorants moins dégradants, sans pondération). Deux résultats séparés :
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
  unite: "thèmes" | "constats";
  gagnants: GagnantAffiche[];
  solde: number;
  departageable: boolean;
  ecartes: number;
}

interface CardCandidatIdealProps {
  situation: ResultatAffiche | null;
  convictions: ResultatAffiche | null;
  questionsRestantes: number;
  revele: boolean;
  onReveler: () => void;
  onRecommencer: () => void;
}

function BlocFlou({ resultat }: { resultat: ResultatAffiche }) {
  // Une pastille par ex æquo (au plus trois), ou « ? » quand rien ne départage : aucune identité, seulement des lettres.
  const lettres = resultat.departageable ? resultat.gagnants.slice(0, 3).map((g) => g.lettre) : ["?"];
  return (
    <div className="ideal-bloc">
      <h3>{resultat.titre}</h3>
      <div className="ideal-flou" aria-hidden="true">
        {lettres.map((lettre) => (
          <Pastille key={lettre} slug={`${PREFIXE_ANONYME}${lettre}`} nom={`Candidat ${lettre}`} />
        ))}
        <p className="ideal-nom">Prénom Nom, parti du candidat</p>
      </div>
      <p className="hint">Identité masquée.</p>
    </div>
  );
}

function BlocRevele({ resultat }: { resultat: ResultatAffiche }) {
  const { gagnants, solde, departageable, ecartes, unite } = resultat;
  return (
    <div className="ideal-bloc">
      <h3>{resultat.titre}</h3>
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
                    <strong>{g.identite.nom}</strong>{" "}
                    <span className="hint">
                      ({/^non renseign/i.test(g.identite.parti) ? "" : `${g.identite.parti}, `}Candidat {g.lettre})
                    </span>
                    <br />
                    Solde {solde > 0 ? `+${solde}` : solde} — améliorants : {g.ameliorants}, dégradants : {g.degradants}, sur {g.analyses} {unite} analysés
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </>
      ) : (
        <p>
          <strong>Les données ne permettent pas de départager les candidats.</strong>
        </p>
      )}
      {ecartes > 0 && (
        <p className="hint">
          {ecartes} candidat{ecartes > 1 ? "s" : ""} {ecartes > 1 ? "écartés" : "écarté"} : condamnation définitive recensée.
        </p>
      )}
    </div>
  );
}

export function CardCandidatIdeal({ situation, convictions, questionsRestantes, revele, onReveler, onRecommencer }: CardCandidatIdealProps) {
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
  return (
    <section className={`carte-ideal${revele ? "" : " carte-ideal--floue"}`} aria-label="Candidat idéal">
      <div className="carte-ideal-card">
        <h2 ref={titre} tabIndex={-1}>
          Votre candidat idéal
        </h2>
        <div aria-live="polite">
          {resultats.map((r) => (revele ? <BlocRevele key={r.titre} resultat={r} /> : <BlocFlou key={r.titre} resultat={r} />))}
        </div>
        <p className="hint regle-ideal">
          Solde = améliorants moins dégradants : il compense un thème par un autre. Aucune pondération, même règle pour tous les candidats ; une égalité n'est jamais départagée arbitrairement. Il dépend du nombre d'indicateurs disponibles.
        </p>
      </div>
      <div className="bandeau-accueil bandeau-accueil--compact">
        {revele ? (
          <>
            <p className="chapeau">Voici votre candidat idéal pour 2027 d'après vos réponses.</p>
            <button type="button" onClick={onRecommencer}>
              Recommencer la simulation
            </button>
          </>
        ) : (
          <>
            <p className="chapeau">
              Cette card contient le meilleur programme selon votre situation{convictions ? " et le meilleur programme selon vos convictions" : ""}.
              {n > 0 && ` Votre résultat peut être affiné si vous répondez ${n === 1 ? "à la question propre aux thèmes" : `aux ${n} questions propres aux thèmes`}, directement dans ceux-ci.`}
            </p>
            <button type="button" onClick={onReveler}>
              Révéler mon programme de candidat idéal pour 2027
            </button>
          </>
        )}
      </div>
    </section>
  );
}
