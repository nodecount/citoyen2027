import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { flushSync } from "react-dom";
import { libelleCitation } from "../citations";
import { evaluerProposition } from "../engine";
import type { NiveauProjection, Projection } from "../engine/projection";
import { estRepondue, questionsDuTheme, questionsVisibles, type Questionnaire } from "../questionnaire";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil, Proposition, Remarque, ResumeTheme } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";
import { NON_VERIFIE, type ConstatIntegrite } from "../data/integrite";
import { PanneauConvictions } from "./Convictions";
import { FluxCandidats } from "./FluxCandidats";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { partiAffichable } from "./parti";
import { NIVEAUX, decrireEffet } from "./projection";
import { SectionQuestions, type SurReponse } from "./Questions";


function BadgeNiveau({ niveau }: { niveau: NiveauProjection }) {
  const { libelle, symbole, sens } = NIVEAUX[niveau];
  return (
    <span className={`niveau niveau--${niveau.replace("_", "-")}`} title={sens}>
      <span aria-hidden="true">{symbole}</span> {libelle}
    </span>
  );
}

// Légende : le niveau en simple texte (symbole + mot, dans sa couleur), sans cadre — les quatre pareils, « mixte » compris.
function MotNiveau({ niveau }: { niveau: NiveauProjection }) {
  const { libelle, symbole } = NIVEAUX[niveau];
  return (
    <strong className="echelle-mot">
      <span aria-hidden="true">{symbole}</span> {libelle}
    </strong>
  );
}

function ListeSources({ sources }: { sources: Array<{ texte: string; url: string }> }) {
  return (
    <>
      {sources.map((source, index) => (
        <span key={source.url}>
          {index > 0 && ", "}
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.texte}
          </a>
        </span>
      ))}
    </>
  );
}

function MesureAnalysee({ proposition, profil, remarques = [] }: { proposition: Proposition; profil: ProfilPartiel; remarques?: Remarque[] }) {
  // Une règle propre à une mesure ne s'applique que si le visiteur a répondu aux questions dont elle dépend
  // (voir evaluerProposition) : sinon explication générale, jamais « non concerné » sur une réponse manquante.
  const impact = evaluerProposition(profil, proposition);
  const laConcernant = remarques.filter((r) => r.mesures.includes(proposition.id));
  // Chaque mesure est repliée : son titre suffit pour parcourir la liste ; on la déplie pour le détail et la source.
  return (
    <li>
      <details className="mesure">
        <summary>{proposition.titre}</summary>
        <div className="mesure-corps">
          {impact.explication !== proposition.titre && <p>{impact.explication}</p>}
          {impact.niveau === "chiffre_personnalise" && impact.montant_estime !== undefined && (
            <p>Estimation pour votre profil : {impact.montant_estime} €/an</p>
          )}
          {!impact.concerne && (
            <p>
              <em>Cette mesure ne s'applique pas à votre profil.</em>
            </p>
          )}
          {/* Remarque de relecture sur le résumé du thème (voir Remarque) : jamais dans le calcul, seulement ici, à
              côté de la mesure qu'elle désigne. */}
          {laConcernant.map((r, index) => (
            <p className="remarque" key={index}>
              <strong>Remarque :</strong> {r.texte}
            </p>
          ))}
          {/* Sans source : mode « à l'aveugle » (le nom de la source trahirait l'auteur). */}
          {proposition.sources.length > 0 && (
            <p className="sources">
              Source :{" "}
              <ListeSources sources={proposition.sources.map((s) => ({ texte: libelleCitation(s), url: s.url }))} />
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

// Sur un vrai « mixte » (favorable ET défavorable, jamais le « mixte à préciser »), répartit les mesures du thème
// entre celles retenues comme favorables et celles retenues comme défavorables, d'après les effets que l'indicateur a
// effectivement retenus (voir `Projection.effetsRetenus`). Une mesure aux effets contradictoires peut figurer dans
// les deux listes ; une mesure sans effet retenu (exclue, ou sans effet déterminé) ne figure dans aucune des deux.
function grouperParPolarite(projection: Projection, propositions: Proposition[]): { favorables: Proposition[]; defavorables: Proposition[] } {
  const idsFavorables = new Set(projection.effetsRetenus.filter((e) => e.polarite === "favorable").map((e) => e.propositionId));
  const idsDefavorables = new Set(projection.effetsRetenus.filter((e) => e.polarite === "defavorable").map((e) => e.propositionId));
  return {
    favorables: propositions.filter((p) => idsFavorables.has(p.id)),
    defavorables: propositions.filter((p) => idsDefavorables.has(p.id)),
  };
}

// Un groupe de mesures sous un petit titre coloré (vert « favorables », rouge « défavorables » : les couleurs déjà
// utilisées pour ces sens partout ailleurs sur la page). Chaque mesure garde son affichage habituel (titre dépliable,
// explication, source). Rien n'est affiché si le groupe est vide.
function GroupeMesures({
  titre,
  sens,
  propositions,
  profil,
  remarques,
  resume,
}: {
  titre: string;
  sens: "favorable" | "defavorable" | "neutre";
  propositions: Proposition[];
  profil: ProfilPartiel;
  remarques?: Remarque[];
  // Avec un résumé : le groupe n'en montre que les mots clés (numérotés 1, 2, 3…) dont les mesures sont dans le groupe,
  // pas la liste des mesures (qui est dans l'onglet « Mesures »). Sans résumé : la liste des mesures du groupe.
  resume?: ResumeTheme | null;
}) {
  if (propositions.length === 0) return null;
  const ids = new Set(propositions.map((p) => p.id));
  const segments = resume ? resume.segments.map((s) => ({ ...s, mesures: s.mesures.filter((id) => ids.has(id)) })).filter((s) => s.mesures.length > 0) : [];
  return (
    <div className={`groupe-mesures groupe-mesures--${sens}`}>
      <p className="groupe-mesures-titre">
        {titre} ({propositions.length})
      </p>
      {resume ? (
        <CitationsResume resume={{ ...resume, segments }} propositions={propositions} />
      ) : (
        <ul className="liste-mesures">
          {propositions.map((proposition) => (
            <MesureAnalysee key={proposition.id} proposition={proposition} profil={profil} remarques={remarques} />
          ))}
        </ul>
      )}
    </div>
  );
}

// Résumé en 40 à 60 mots : chaque mot clé porte un numéro renvoyant à ses mesures (voir CitationsResume, dans
// l'onglet Mesures).
function Resume({ resume }: { resume: ResumeTheme }) {
  let numero = 0;
  return (
    <p className="resume">
      {resume.segments.map((segment, index) => {
        if (segment.mesures.length === 0) return <span key={index}>{segment.texte}</span>;
        numero += 1;
        return (
          <span key={index} className="mot-cle">
            {segment.texte}
            <sup>{numero}</sup>
          </span>
        );
      })}
    </p>
  );
}

// Simulateur anonyme, onglet « Résumé » : une phrase continue, comme le résumé de l'exploration, bâtie avec les seuls mots clés
// du résumé du thème (à défaut, les titres des mesures) qui touchent la situation du visiteur. Vert : mesures favorables ;
// rouge : défavorables ; les deux : souligné moitié vert, moitié rouge. Le mot « favorable » / « défavorable » est dit aux
// lecteurs d'écran : la couleur n'est jamais seule.
function ResumeSituation({ resume, propositions, favorables, defavorables }: { resume: ResumeTheme | null; propositions: Proposition[]; favorables: Proposition[]; defavorables: Proposition[] }) {
  const idsF = new Set(favorables.map((p) => p.id));
  const idsD = new Set(defavorables.map((p) => p.id));
  const elements = resume
    ? resume.segments.filter((s) => s.mesures.length > 0).map((s) => ({ texte: s.texte, f: s.mesures.some((id) => idsF.has(id)), d: s.mesures.some((id) => idsD.has(id)) }))
    : propositions.map((p) => ({ texte: p.titre, f: idsF.has(p.id), d: idsD.has(p.id) }));
  const retenus = elements.filter((e) => e.f || e.d);
  if (retenus.length === 0) return null;
  // Les mots clés sont des morceaux de la phrase d'origine : on les recolle (virgules, « et » avant le dernier, point final).
  // Majuscule au début ; minuscule ensuite, sauf sigle ou nom propre (deuxième lettre en capitale).
  const nettoyer = (t: string) => t.trim().replace(/[.;,\s]+$/, "");
  const milieuDePhrase = (t: string) => (/^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  return (
    <p className="resume">
      {retenus.map((e, index) => {
        const sens = e.f && e.d ? "mixte" : e.f ? "favorable" : "defavorable";
        const brut = nettoyer(e.texte);
        const texte = index === 0 ? brut.charAt(0).toUpperCase() + brut.slice(1) : milieuDePhrase(brut);
        const separateur = index === 0 ? "" : index === retenus.length - 1 ? " et " : ", ";
        return (
          <span key={index}>
            {separateur}
            <span className={`mot-cle mot-cle--${sens}`}>
              {texte}
              <span className="cache-visuel"> ({sens === "mixte" ? "favorable et défavorable" : sens === "favorable" ? "favorable" : "défavorable"} pour votre situation)</span>
            </span>
          </span>
        );
      })}
      .
    </p>
  );
}

// Simulateur anonyme : les mesures ne sont pas toutes affichées ; le bouton ouvre le mode exploration, qui les montre.
function AppelExplorer({ onExplorer }: { onExplorer?: () => void }) {
  return (
    <div className="appel-profil">
      <p>En simulation, seules les mesures vous concernant sont affichées.</p>
      {onExplorer && (
        <button type="button" className="bouton-en-ligne" onClick={onExplorer}>
          Passer en mode exploration
        </button>
      )}
    </div>
  );
}

// `titre` n'est mis entre guillemets que lorsqu'il reprend vraiment la source mot pour mot (voir `titre_litteral` sur
// Proposition) : jamais sur une reformulation neutre, qui ne doit jamais se faire passer pour une citation.
export function texteMesure(p: Proposition): string {
  return p.titre_litteral ? `« ${p.titre} »` : p.titre;
}

// Les groupes de mesures sont des morceaux d'une phrase (souvent en minuscules) : en tête d'un groupe, la première lettre est une majuscule.
export function premiereEnMajuscule(texte: string): string {
  const t = texte.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Un spoiler par mot clé du résumé, numéroté comme son renvoi : à l'intérieur, les mesures qu'il recouvre, citées
// (entre guillemets quand c'en est une), avec leurs sources.
export function CitationsResume({ resume, propositions }: { resume: ResumeTheme; propositions: Proposition[] }) {
  const parId = new Map(propositions.map((p) => [p.id, p]));
  const motsCles = resume.segments.filter((s) => s.mesures.length > 0);
  return (
    <ol className="citations-resume">
      {motsCles.map((segment, index) => (
        <li key={index}>
          <details className="citation-reference">
            <summary>
              {index + 1}. {premiereEnMajuscule(segment.texte)}
            </summary>
            <ul className="citation-reference-corps">
              {segment.mesures
                .map((id) => parId.get(id))
                .filter((p): p is Proposition => p !== undefined)
                .map((p) => (
                  <li key={p.id}>
                    {texteMesure(p)}{" "}
                    {p.sources.length > 0 && (
                      <span className="sources">
                        (<ListeSources sources={p.sources.map((s) => ({ texte: libelleCitation(s), url: s.url }))} />)
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  );
}

// Appel à l'action de l'onglet « Favorable / défavorable » quand aucun indicateur n'existe : passer en mode simulateur
// (depuis l'exploration) ou renseigner des informations (en simulateur, avant toute réponse).
export interface ActionProfil {
  type: "simuler" | "renseigner";
  onClick: () => void;
}

// Onglet ouvert d'emblée dans le détail d'un candidat (« detail » : le détail des mesures, quelle que soit sa forme).
type VueInitiale = "resume" | "polarite" | "detail";

// Le détail d'un candidat sur un thème, ouvert depuis son portrait : programme d'abord (synthèse, sources, mesures),
// puis — seulement si le visiteur a donné des informations — ce que cela change pour lui.
function DetailCandidat({ ligne, profil, id, onFermer, vueInitiale, actionProfil, convictions, integrite, anonyme = false, onExplorer }: { ligne: LigneCandidat; profil: ProfilPartiel; id: string; onFermer?: () => void; vueInitiale?: VueInitiale; actionProfil?: ActionProfil; convictions?: Convictions; integrite?: ConstatIntegrite | null; anonyme?: boolean; onExplorer?: () => void }) {
  const { meta, projection, synthese, resume, sources, messagesSansBadge, messagesIncertitude, messagesEffetsExclus, propositions, remarques } = ligne;
  const niveau = projection?.niveau ?? null;
  // Trois onglets possibles, ouverts sur « Résumé » : le résumé (à défaut, la synthèse texte ; à défaut encore, un
  // message qui dit qu'il n'y en a pas), la répartition favorable/défavorable (dès qu'une projection existe, quel que
  // soit son niveau), et le détail des mesures. Avec un résumé, ce dernier est celui de ses références citées ; sans,
  // c'est la liste complète des mesures.
  const vueDetail = resume ? "citations" : "detail";
  // Le détail s'ouvre toujours sur « Résumé », en exploration comme en simulateur (à l'étape « mesures adaptées », le résumé
  // se limite à l'analyse de la situation du visiteur).
  const vueDepart = vueInitiale ?? "resume";
  const [vue, setVue] = useState<"resume" | "polarite" | "citations" | "detail" | "mesures">(vueDepart === "detail" ? vueDetail : vueDepart);
  const vueActive = vue;
  const nombre = propositions.length;
  // Répartition entre mesures favorables et défavorables, pour TOUT candidat ayant une projection — pas seulement un
  // « mixte » : l'onglet dédié la montre quel que soit l'indicateur (améliorant, dégradant, non concerné, mixte, ou
  // même sans badge). Une mesure sans effet retenu (exclue, ou sans effet déterminé) tombe dans « Autres mesures ».
  const { favorables, defavorables } = projection ? grouperParPolarite(projection, propositions) : { favorables: [], defavorables: [] };
  const autres = propositions.filter((p) => !favorables.includes(p) && !defavorables.includes(p));

  return (
    <div className="detail" id={id} role="region" aria-label={`Détail : ${meta.nom}`}>
      {onFermer && (
        <button type="button" className="bouton-icone detail-fermer" aria-label={`Fermer : ${meta.nom}`} onClick={onFermer}>
          <X size={20} aria-hidden="true" />
        </button>
      )}
      {/* Portrait agrandi, sorti d'un tiers au-dessus du cadre — un rappel du candidat qu'on vient d'ouvrir. */}
      <div className="detail-profil">
        <span className="detail-avatar">
          <Pastille slug={meta.slug} nom={meta.nom} />
        </span>
        <h3 className="detail-titre">
          {meta.nom}
          {partiAffichable(meta.parti) && <span className="detail-parti">{partiAffichable(meta.parti)}</span>}
        </h3>
        <div className="onglets-detail" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={vueActive === "resume"} onClick={() => setVue("resume")}>
            Résumé
          </button>
          {/* Mode anonyme : l'onglet « Mesures » existe, sans décompte (il identifierait le candidat) ; au lieu de la liste
              complète, il explique qu'elle est dans « Explorer les mesures » et y renvoie. */}
          {anonyme ? (
            <button type="button" aria-pressed={vueActive === "mesures"} onClick={() => setVue("mesures")}>
              Mesures
            </button>
          ) : (
            <button type="button" aria-pressed={vueActive === vueDetail} onClick={() => setVue(vueDetail)}>
              Mesures ({nombre})
            </button>
          )}
          <button type="button" aria-pressed={vueActive === "polarite"} onClick={() => setVue("polarite")}>
            Favorable / défavorable
          </button>
        </div>
      </div>
      {/* Entête (portrait, nom, onglets) fixe ; le contenu (résumé ou liste des mesures, puis « Pour votre profil ») défile. */}
      <div className="detail-contenu">
      {vueActive === "polarite" && !projection ? (
        actionProfil ? (
          <div className="appel-profil">
            <p>
              {actionProfil.type === "simuler" ? (
                <>
                  Pour estimer ce que le programme de <strong className="nom-candidat">{meta.nom}</strong> pourrait changer pour vous, accédez au simulateur :
                </>
              ) : (
                "Pour savoir ce que ce programme change pour vous, renseignez quelques informations."
              )}
            </p>
            <button type="button" className="bouton-en-ligne" onClick={actionProfil.onClick}>
              {actionProfil.type === "simuler" ? "Simuler selon ma situation et mes convictions" : "Renseigner mes informations"}
            </button>
          </div>
        ) : (
          <p className="hint">Impossible de dire ce que ce candidat changerait pour vous sur ce thème.</p>
        )
      ) : vueActive === "mesures" ? (
        <AppelExplorer onExplorer={onExplorer} />
      ) : vueActive === "polarite" ? (
        <>
          <GroupeMesures titre="Mesures favorables" sens="favorable" propositions={favorables} profil={profil} remarques={remarques} resume={resume} />
          <GroupeMesures titre="Mesures défavorables" sens="defavorable" propositions={defavorables} profil={profil} remarques={remarques} resume={resume} />
          {!anonyme && <GroupeMesures titre="Autres mesures" sens="neutre" propositions={autres} profil={profil} remarques={remarques} resume={resume} />}
        </>
      ) : vueActive === "detail" ? (
        <ul className="liste-mesures">
          {propositions.map((proposition) => (
            <MesureAnalysee key={proposition.id} proposition={proposition} profil={profil} remarques={remarques} />
          ))}
        </ul>
      ) : vueActive === "citations" && resume ? (
        <CitationsResume resume={resume} propositions={propositions} />
      ) : anonyme && projection ? (
        // Simulateur anonyme : même forme de résumé qu'en exploration, mais limitée aux mesures qui touchent la situation du
        // visiteur (vert : favorables, rouge : défavorables). Le rappel « pas toutes les mesures » reste dans l'onglet Mesures.
        <ResumeSituation resume={resume} propositions={propositions} favorables={favorables} defavorables={defavorables} />
      ) : resume ? (
        <Resume resume={resume} />
      ) : synthese ? (
        <>
          <p className="synthese">{synthese.texte}</p>
          {sources.length > 0 && (
            <p className="sources-citees">
              Sources : <ListeSources sources={sources} />
            </p>
          )}
        </>
      ) : (
        <p className="hint aucun-resume">Pas de résumé pour ce candidat sur ce thème.</p>
      )}

      {convictions && aDesConvictions(convictions) && (
        <PanneauConvictions propositions={propositions} convictions={convictions} integrite={convictions.exemplarite ? (integrite ?? null) : null} />
      )}

      {/* Simulateur anonyme : l'analyse de la situation (et le détail de ses effets) n'est que dans « Résumé » ; « Favorable /
          défavorable » ne la répète pas sous la répartition des mesures. */}
      {(!anonyme || vueActive === "resume") && (
      <>
      {projection &&
        (niveau ? (
          <>
            {!anonyme && (
              <p className="pour-votre-profil">
                <strong>Pour votre profil :</strong> {NIVEAUX[niveau].sens}
              </p>
            )}
            {messagesIncertitude.map((message) => (
              <p className="pour-votre-profil incertitude" key={message}>
                {message}
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="pour-votre-profil">
              <strong>Pour vous :</strong> impossible de conclure pour l'instant.
            </p>
            {messagesSansBadge.map((message) => (
              <p className="pour-votre-profil" key={message}>
                {message}
              </p>
            ))}
          </>
        ))}
      {/* Toujours affiché quand il s'applique, même à côté d'un badge : jamais l'impression que l'indicateur tient compte de tout. */}
      {/* Simulateur anonyme : ce décompte (« 6 mesures supplémentaires… ») trahirait le candidat. */}
      {!anonyme && messagesEffetsExclus.map((message) => (
        <p className="pour-votre-profil exclus" key={message}>
          {message}
        </p>
      ))}

      {/* Simulateur anonyme : le résumé coloré ci-dessus remplace ce détail. */}
      {!anonyme && projection && projection.effetsRetenus.length > 0 && (
        <details className="pourquoi">
          <summary>Pourquoi ce résultat ?</summary>
          <ul>
            {projection.effetsRetenus.map(({ propositionId, effet, polarite }, index) => {
              const mesure = propositions.find((p) => p.id === propositionId);
              return (
                <li key={`${propositionId}-${index}`}>
                  <strong>{mesure?.titre ?? propositionId}</strong>
                  <br />
                  {decrireEffet(effet)} — {polarite === "favorable" ? "favorable" : "défavorable"} pour votre situation.
                  <br />
                  <q>{effet.extrait}</q>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      </>
      )}
      </div>
    </div>
  );
}

// Copie d'un élément posée au même endroit de la carte, qui s'estompe puis disparaît : donne un fondu de sortie à un
// élément que React retire aussitôt du DOM. Décorative (masquée aux lecteurs d'écran, non cliquable).
function estomper(element: HTMLElement) {
  const carte = element.closest("article");
  if (!carte || typeof element.animate !== "function") return;
  const cadre = carte.getBoundingClientRect();
  const place = element.getBoundingClientRect();
  const copie = element.cloneNode(true) as HTMLElement;
  copie.removeAttribute("id");
  copie.setAttribute("aria-hidden", "true");
  Object.assign(copie.style, {
    position: "absolute",
    left: `${place.left - cadre.left}px`,
    top: `${place.top - cadre.top}px`,
    width: `${place.width}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "3",
  });
  carte.appendChild(copie);
  copie.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out" }).finished.then(
    () => copie.remove(),
    () => copie.remove(),
  );
}
// Zones du tiroir de portraits en mode simulateur : de gauche à droite, ce qui améliore, ce qui est mixte ou neutre, ce qui
// dégrade la situation du visiteur.
const ZONES_TIROIR = [
  { id: "gauche", libelle: "Candidats qui améliorent votre situation" },
  { id: "milieu", libelle: "Candidats mixtes pour votre situation" },
  { id: "droite", libelle: "Candidats qui dégradent votre situation" },
] as const;

// « Non concerné » et « sans indicateur » ne font qu'un : ces candidats ne sont dans aucune zone colorée, mais sur une
// ligne à part sous les zones (« neutres »), sans indicateur, comme en mode « Explorer les mesures ».
function zoneDe(ligne: LigneCandidat): "gauche" | "milieu" | "droite" | "neutres" {
  const niveau = ligne.projection?.niveau;
  return niveau === "ameliorant" ? "gauche" : niveau === "degradant" ? "droite" : niveau === "mixte" ? "milieu" : "neutres";
}
// Le rendu serveur (tests) n'exécute pas d'effet de mise en page.
const useEffetLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Un portrait = une pastille à initiales et — seulement s'il existe — la couleur de l'indicateur du candidat sur ce
// thème, en bordure. Le nom n'est pas écrit sous la pastille, mais il reste le nom accessible du bouton et s'affiche
// au survol. Le mot et le symbole de l'indicateur ne sont pas répétés sous chaque portrait (la légende, affichée en
// permanence au-dessus de la grille, les porte déjà pour les quatre niveaux) : la couleur n'est donc jamais la SEULE
// façon de connaître le niveau, seulement la façon la plus rapide une fois la légende lue. Tant qu'aucun candidat
// n'est sélectionné, chaque portrait affiche son nombre de mesures, comme un compteur de notifications. Le pied de
// carte garde toujours la même taille (rétractée), qu'un candidat soit ouvert ou non.
function Portrait({ ligne, ouvert, idDetail, onBasculer, neutre = false, simulateur = false }: { ligne: LigneCandidat; ouvert: boolean; idDetail: string; onBasculer: () => void; neutre?: boolean; simulateur?: boolean }) {
  // `neutre` : portrait sans indicateur (candidats non concernés affichés à part) — ni couleur, ni niveau dans son nom.
  const niveau = neutre ? null : (ligne.projection?.niveau ?? null);
  const { nom } = ligne.meta;
  const parti = partiAffichable(ligne.meta.parti);
  const nombre = ligne.propositions.length;
  const precision = niveau ? ` — ${NIVEAUX[niveau].libelle}${ligne.projection?.incertain ? ", à préciser" : ""}` : "";
  // Exploration : le nombre de mesures du candidat. Simulateur : pas le total (40 mesures suffit à reconnaître un candidat),
  // mais ce qui compte pour le visiteur — mesures favorables pour « améliorant », défavorables pour « dégradant », les deux
  // pour « mixte » —, sur un fond de la couleur de l'indicateur ; rien pour « non concerné » et « sans indicateur ».
  const { favorables, defavorables } = simulateur && niveau && ligne.projection ? grouperParPolarite(ligne.projection, ligne.propositions) : { favorables: [], defavorables: [] };
  const comptes: Array<{ sens: "favorable" | "defavorable"; nombre: number }> = [];
  if ((niveau === "ameliorant" || niveau === "mixte") && favorables.length > 0) comptes.push({ sens: "favorable", nombre: favorables.length });
  if ((niveau === "degradant" || niveau === "mixte") && defavorables.length > 0) comptes.push({ sens: "defavorable", nombre: defavorables.length });
  const pluriel = (n: number) => `${n} mesure${n > 1 ? "s" : ""}`;
  const resumeComptes = comptes.map((c) => `${pluriel(c.nombre)} ${c.sens === "favorable" ? "favorable" : "défavorable"}${c.nombre > 1 ? "s" : ""}`).join(", ");
  const label = `${nom}${parti ? ` (${parti})` : ""}${precision}${simulateur ? (resumeComptes ? ` : ${resumeComptes}` : "") : ` : ${pluriel(nombre)} sur ce thème`}`;
  return (
    <li className="avec-infobulle">
      <button
        type="button"
        className={`portrait${ouvert ? " portrait--ouvert" : ""}`}
        data-niveau={niveau ?? undefined}
        aria-expanded={ouvert}
        aria-controls={idDetail}
        aria-label={label}
        onClick={onBasculer}
      >
        <Pastille slug={ligne.meta.slug} nom={nom} />
        {simulateur ? (
          comptes.length > 0 && (
            <span className="portrait-comptes" aria-hidden="true">
              {comptes.map((c) => (
                <span key={c.sens} className={`portrait-compte portrait-compte--${c.sens}`}>
                  {c.nombre}
                </span>
              ))}
            </span>
          )
        ) : (
          <span className="portrait-compte" aria-hidden="true">
            {nombre}
          </span>
        )}
      </button>
      {/* Nom du candidat : vraie infobulle au survol et au focus (le nom complet est déjà dans le nom accessible du
          bouton, d'où aria-hidden). */}
      <span className="infobulle infobulle--nom" aria-hidden="true">
        {nom}
        {parti && <span className="infobulle-parti">{parti}</span>}
      </span>
    </li>
  );
}

// Questions propres à un thème : le visiteur les renseigne à son rythme, une fois le formulaire général validé. Chaque
// réponse s'applique tout de suite : l'indicateur des portraits de ce thème s'affine.
function QuestionsDuTheme({ theme, idTheme, questions, profil, onReponse }: { theme: string; idTheme: string; questions: ChampProfil[]; profil: ProfilPartiel; onReponse: SurReponse }) {
  // Pas de titre ni de décompte : chaque question est simplement précédée de « Pour affiner : ».
  return (
    <section className="questions-theme" aria-label={`Questions sur le thème ${theme}`}>
      <SectionQuestions questions={questions} profil={profil} onReponse={onReponse} idPrefixe={`theme-${idTheme}`} prefixe="Pour affiner : " />
    </section>
  );
}

// `ouvertInitial` : candidat ouvert à l'arrivée (lien depuis le tableau de l'accueil) ; ensuite, au clic sur un portrait.
function CarteTheme({
  card,
  profil,
  questionsTheme,
  onReponse,
  ouvertInitial,
  vueInitiale,
  actionProfil,
  masquerNonConcernes,
  simulateur,
  sansFlux,
  anonyme,
  onExplorer,
  convictions,
  integrites,
}: {
  // Simulateur à l'aveugle : pas de liste complète des mesures ; l'appel à l'action renvoie vers « Explorer les mesures ».
  anonyme: boolean;
  onExplorer?: () => void;
  convictions?: Convictions;
  // Faits d'intégrité par slug ; null quand ils ne doivent pas s'afficher (option désactivée, mode aveugle).
  integrites?: Record<string, ConstatIntegrite> | null;
  card: CardTheme;
  profil: ProfilPartiel;
  // Questions propres à ce thème, à afficher seulement une fois le formulaire général validé ; [] sinon.
  questionsTheme: ChampProfil[];
  onReponse: SurReponse;
  ouvertInitial?: string;
  vueInitiale?: VueInitiale;
  actionProfil?: ActionProfil;
  masquerNonConcernes: boolean;
  // Indicateurs affichés : la pastille « +X » ne compte que les candidats sans mesure sur le thème.
  simulateur: boolean;
  // Mode « Simuler pour moi » : pas de flux de bulles de paroles.
  sansFlux: boolean;
}) {
  const { theme, absents, enCoursAnalyse } = card;
  const [ouvert, setOuvert] = useState<string | null>(ouvertInitial ?? null);
  // Option du visiteur : les candidats dont les mesures ne changent rien à sa situation sont retirés. « Non concerné » et
  // « sans indicateur » sont une seule catégorie : le masquage retire les deux. Un candidat ouvert reste affiché (arrivée
  // par un lien, ou détail déjà ouvert), même s'il fait partie de cette catégorie.
  const lignes = masquerNonConcernes ? card.lignes.filter((l) => !l.projection || (l.projection.niveau !== "non_concerne" && l.projection.niveau !== null) || l.meta.slug === ouvert) : card.lignes;
  const nombreMasques = card.lignes.length - lignes.length;
  // Simulateur : la pastille ne regroupe que les candidats sans mesure sur le thème (comme en exploration) ; les non
  // concernés masqués disparaissent sans être comptés.
  const autres = simulateur ? absents.length : nombreMasques + absents.length;
  const ligneOuverte = lignes.find((l) => l.meta.slug === ouvert) ?? null;
  const idDetail = `detail-${theme.id}`;

  // « +X » unique : les candidats sans mesure sur ce thème et ceux dont les mesures ne changent rien à la situation du
  // visiteur (masqués). Une vraie infobulle (survol ET focus clavier) l'explique ; elle ne parle de « votre situation »
  // que si des candidats ont été masqués pour cette raison, donc seulement une fois le visiteur renseigné — sinon ce
  // sont simplement des candidats sans mesure sur le thème.
  const pastillePlus =
    autres > 0 ? (
      <li className="portraits-plus avec-infobulle">
        <span className="portrait-plus" tabIndex={0} role="img" aria-label={`${autres} autre${autres > 1 ? "s" : ""} candidat${autres > 1 ? "s" : ""}`} aria-describedby={`infobulle-${theme.id}`}>
          +{autres}
        </span>
        <span className="infobulle" role="tooltip" id={`infobulle-${theme.id}`}>
          {nombreMasques > 0 ? "Ces candidats n'ont aucune mesure qui change votre situation sur ce thème." : "Ces candidats n'ont aucune mesure sur ce thème."}
        </span>
      </li>
    ) : null;
  const portraitsDe = (liste: LigneCandidat[], neutre = false) =>
    liste.map((ligne) => <Portrait key={ligne.meta.slug} ligne={ligne} ouvert={ouvert === ligne.meta.slug} idDetail={idDetail} onBasculer={() => basculer(ligne.meta.slug)} neutre={neutre} simulateur={simulateur} />);
  const neutres = lignes.filter((l) => zoneDe(l) === "neutres");
  // Zones du tiroir seulement quand des indicateurs existent (mode simulateur, formulaire enregistré).
  const enZones = lignes.some((l) => l.projection);
  // Animations d'ouverture et de fermeture du candidat (désactivées si le visiteur demande de limiter les animations).
  // Ouverture : la pastille blanche qui entoure icône et libellé grandit à partir du seul médaillon. Elle est centrée,
  // donc son bord gauche — et le médaillon, posé contre ce bord — glisse vers la gauche, du centre à sa place finale ;
  // son ombre apparaît progressivement. Fermeture : le mouvement inverse (la pastille rétrécit, le médaillon revient au
  // centre) pendant que le corps de la carte s'estompe, puis seulement le candidat est refermé.
  const medaillon = useRef<HTMLDivElement>(null);
  const entete_ = useRef<HTMLElement>(null);
  const corps_ = useRef<HTMLDivElement>(null);
  const ouvertAvant = useRef(Boolean(ligneOuverte));
  const fermeture = useRef(false);
  // Vrai après une fermeture : le titre et la question du thème réapparaissent en fondu (pas au premier affichage).
  const [retour, setRetour] = useState(false);
  const OPTIONS_ANIMATION = { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
  const sansAnimation = () => typeof window === "undefined" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffetLayout(() => {
    const change = ouvertAvant.current !== Boolean(ligneOuverte);
    ouvertAvant.current = Boolean(ligneOuverte);
    const element = medaillon.current;
    const entete = entete_.current;
    if (!change || !ligneOuverte || !element || !entete || typeof entete.animate !== "function" || sansAnimation()) return;
    const ombre = getComputedStyle(entete).boxShadow;
    entete.animate(
      [
        { width: `${element.offsetWidth}px`, boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)" },
        { width: `${entete.offsetWidth}px`, boxShadow: ombre },
      ],
      OPTIONS_ANIMATION,
    );
  }, [ligneOuverte]);

  function fermer() {
    const entete = entete_.current;
    const element = medaillon.current;
    const corps = corps_.current;
    if (!entete || !element || !corps || typeof entete.animate !== "function" || sansAnimation()) {
      setOuvert(null);
      return;
    }
    if (fermeture.current) return;
    fermeture.current = true;
    const options = { ...OPTIONS_ANIMATION, fill: "forwards" as FillMode };
    const pastille = entete.animate(
      [
        { width: `${entete.offsetWidth}px`, boxShadow: getComputedStyle(entete).boxShadow },
        { width: `${element.offsetWidth}px`, boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)" },
      ],
      options,
    );
    const autres = [
      corps.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, duration: 250 }),
      ...Array.from(entete.querySelectorAll("h2")).map((titre) => titre.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, duration: 150 })),
    ];
    const terminer = () => {
      flushSync(() => {
        setOuvert(null);
        setRetour(true);
      });
      [pastille, ...autres].forEach((animation) => animation.cancel());
      fermeture.current = false;
    };
    pastille.finished.then(terminer, () => {
      fermeture.current = false;
    });
  }

  // Ouvrir un autre candidat remplace directement le détail ; cliquer sur le candidat ouvert le referme (avec animation).
  function basculer(slug: string) {
    if (ouvert === slug) {
      fermer();
      return;
    }
    if (ouvert === null && !sansAnimation()) {
      // Le titre et la question, sur le point de disparaître de leur place, s'estompent au lieu de s'éclipser.
      const entete = entete_.current;
      if (entete) entete.querySelectorAll<HTMLElement>(":scope > h2, :scope > .question-theme").forEach(estomper);
    }
    setRetour(false);
    setOuvert(slug);
  }
  // Carte de hauteur fixe : en-tête (thème), corps défilant qui accueille le texte du candidat choisi, pied avec les
  // portraits. Ouvrir un candidat ne change pas la taille de la carte ni la mise en page de la grille.
  return (
    <article className={`carte${ligneOuverte ? " carte--ouvert" : ""}`} id={`theme-${theme.id}`} aria-labelledby={`titre-${theme.id}`}>
      {/* Candidat ouvert : le médaillon rejoint le titre sur une ligne, pour laisser la place au texte du candidat. */}
      <header className={`carte-entete${ligneOuverte ? " carte-entete--ouvert" : ""}${retour && !ligneOuverte ? " carte-entete--retour" : ""}`} ref={entete_}>
        <div className="medaillon" aria-hidden="true" ref={medaillon}>
          <IconeTheme themeId={theme.id} taille={24} />
        </div>
        <h2 id={`titre-${theme.id}`}>{theme.libelle}</h2>
        {!ligneOuverte && (
          <p className="question-theme">
            {theme.sujets?.length ? `Sujets abordés : ${theme.sujets.join(", ")}.` : theme.question_citoyen}
          </p>
        )}
      </header>

      <div className={`carte-corps${ligneOuverte ? " carte-corps--detail" : ""}`} ref={corps_}>
        {enCoursAnalyse ? (
          <p className="hint">Ce thème est en cours d'analyse : aucun programme n'a encore été analysé sur ce sujet.</p>
        ) : (
          <>
            {ligneOuverte ? (
              <DetailCandidat ligne={ligneOuverte} profil={profil} id={idDetail} onFermer={fermer} vueInitiale={vueInitiale} actionProfil={actionProfil} convictions={convictions} anonyme={anonyme} onExplorer={onExplorer} integrite={integrites ? (integrites[ligneOuverte.meta.slug] ?? NON_VERIFIE) : null} />
            ) : (
              <>
                {lignes.length > 0 && questionsTheme.length === 0 && !sansFlux && <FluxCandidats key={lignes.map((l) => l.meta.slug).join("|")} lignes={lignes} />}
                {questionsTheme.length > 0 && <QuestionsDuTheme theme={theme.libelle} idTheme={theme.id} questions={questionsTheme} profil={profil} onReponse={onReponse} />}
                {/* Les portraits, toujours visibles en pied de carte ,
                    suffisent à inviter au clic : pas besoin de le répéter ici. */}
                {lignes.length === 0 && (
                  <p className="hint carte-invite">Aucun candidat ne change votre situation sur ce thème, d'après vos réponses.</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {!enCoursAnalyse && (
        <footer className={`carte-pied${enZones ? " carte-pied--zones" : ""}`}>
          {enZones ? (
            // Simulateur : trois zones, teintées dans la couleur de leur niveau. À gauche ceux qui améliorent la situation du
            // visiteur (vert), au milieu les mixtes (neutre), à droite ceux qui la dégradent (rouge). Dans
            // chaque zone, l'ordre reste alphabétique.
            <>
            <div className="tiroir-zones">
              {ZONES_TIROIR.map((zone) => (
                <ul className="portraits" data-zone={zone.id} key={zone.id} aria-label={`${zone.libelle}, thème ${theme.libelle}`}>
                  {portraitsDe(lignes.filter((l) => zoneDe(l) === zone.id))}
                </ul>
              ))}
            </div>
            {/* Hors couleurs : non concernés (si on les affiche) et « +X », sur une ligne à part, sans indicateur. */}
            {(neutres.length > 0 || pastillePlus) && (
              <ul className="portraits" data-zone="neutres" aria-label={`Candidats non concernés, thème ${theme.libelle}`}>
                {portraitsDe(neutres, true)}
                {pastillePlus}
              </ul>
            )}
            </>
          ) : (
            <ul className="portraits" aria-label={`Candidats, thème ${theme.libelle}`}>
              {portraitsDe(lignes)}
              {pastillePlus}
            </ul>
          )}
        </footer>
      )}
    </article>
  );
}

interface VueThemesProps {
  cards: CardTheme[];
  profil: ProfilPartiel;
  // Vrai après validation du formulaire général ET dès que le visiteur a donné une information : c'est alors seulement
  // que les indicateurs (les couleurs autour des portraits) existent.
  personnalise: boolean;
  questionnaire: Questionnaire;
  // Vrai après validation du formulaire général : les questions propres à chaque thème deviennent disponibles.
  questionsActives: boolean;
  onReponse: SurReponse;
  // ue : onglet ouvert d'emblée (« detail » = le détail des mesures) ; par défaut le résumé.
  ouvertInitial?: { theme: string; candidat: string; vue?: VueInitiale };
  // Mode « Simuler pour moi » : le flux de bulles de paroles n'est pas affiché.
  sansFlux?: boolean;
  // Mode anonyme (simulateur) et passage en « Explorer les mesures » proposé dans le détail d'un candidat.
  anonyme?: boolean;
  onExplorer?: () => void;
  // Appel à l'action de l'onglet « Favorable / défavorable » tant qu'aucun indicateur n'existe.
  actionProfil?: ActionProfil;
  // Convictions du visiteur et faits d'intégrité (voir Convictions.tsx) : affichés dans le détail de chaque candidat.
  convictions?: Convictions;
  integrites?: Record<string, ConstatIntegrite> | null;
}

export function VueThemes({ cards, profil, personnalise, questionnaire, questionsActives, onReponse, ouvertInitial, sansFlux = false, anonyme = false, onExplorer, actionProfil, convictions = CONVICTIONS_VIDES, integrites = null }: VueThemesProps) {
  const [masquer, setMasquer] = useState(true);
  const masquerNonConcernes = personnalise && masquer;
  // Exploration : tous les tiroirs de portraits ont la même hauteur (celle du plus haut) : on mesure le plus haut à sa
  // hauteur naturelle, puis on l'impose à tous (variable CSS sur la grille). Recalcul quand le contenu change et quand la
  // fenêtre est redimensionnée (le nombre de lignes de portraits dépend de la largeur des cartes).
  // Simulateur avec indicateurs (`personnalise`) : chaque tiroir est dimensionné à ses seuls candidats, sans égalisation.
  const grille = useRef<HTMLDivElement>(null);
  useEffetLayout(() => {
    const element = grille.current;
    if (!element) return;
    const egaliser = () => {
      element.style.setProperty("--tiroir-hauteur", "0px");
      if (personnalise) return;
      const hauteurs = [...element.querySelectorAll<HTMLElement>(".carte-pied")].map((tiroir) => tiroir.getBoundingClientRect().height);
      element.style.setProperty("--tiroir-hauteur", `${Math.ceil(Math.max(0, ...hauteurs))}px`);
    };
    egaliser();
    window.addEventListener("resize", egaliser);
    return () => window.removeEventListener("resize", egaliser);
  }, [cards, personnalise, masquer]);
  return (
    <section className="themes">
      {personnalise && (
        // Légende en « règle graduée » : la même lecture gauche → droite que les tiroirs de portraits (mieux · mixte · moins
        // bien), avec un point par niveau sur la ligne, le point « dégradant » en étant le bout. « Non concerné » est HORS ligne : un
        // point gris seul, au bout, non rattaché.
        <section className="section-secondaire echelle" aria-label="Comment lire les indicateurs">
          <p className="echelle-question">
            <strong>Si ce candidat était élu, l'effet sur ma situation, pour ce thème, serait :</strong>
          </p>
          <ol className="echelle-reperes">
            {(["ameliorant", "mixte", "degradant"] as NiveauProjection[]).map((niveau) => (
              <li key={niveau} data-niveau={niveau}>
                <MotNiveau niveau={niveau} />
                <span className="echelle-sens">{NIVEAUX[niveau].sens}</span>
              </li>
            ))}
            {/* Hors règle : un point gris seul au bout de la ligne, non rattaché. « Pas d'indicateur » (mesures ou réponses qui
                ne permettent pas de conclure) est la même catégorie. */}
            <li className="echelle-hors" data-niveau="non_concerne">
              <MotNiveau niveau="non_concerne" />
              <span className="echelle-sens">{NIVEAUX.non_concerne.sens}</span>
              <label className="interrupteur">
                <input type="checkbox" role="switch" checked={masquer} onChange={(e) => setMasquer(e.target.checked)} />
                <span className="interrupteur-piste" aria-hidden="true" />
                Masquer les candidats dont les mesures ne changent rien à ma situation
              </label>
            </li>
          </ol>
        </section>
      )}
      <div className="grille-themes" ref={grille}>
        {cards.map((card) => (
          <CarteTheme
            key={card.theme.id}
            card={card}
            profil={profil}
            questionsTheme={questionsActives ? questionsVisibles(questionsDuTheme(questionnaire, card.theme.id), profil).filter((q) => !estRepondue(q, profil)) : []}
            onReponse={onReponse}
            ouvertInitial={ouvertInitial?.theme === card.theme.id ? ouvertInitial.candidat : undefined}
            vueInitiale={ouvertInitial?.theme === card.theme.id ? ouvertInitial.vue : undefined}
            masquerNonConcernes={masquerNonConcernes}
            simulateur={personnalise}
            sansFlux={sansFlux}
            anonyme={anonyme}
            onExplorer={onExplorer}
            actionProfil={actionProfil}
            convictions={convictions}
            integrites={integrites}
          />
        ))}
      </div>
    </section>
  );
}
