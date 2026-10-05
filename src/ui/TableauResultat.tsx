import { useState, type KeyboardEvent, type ReactNode } from "react";
import { projeterPosition } from "../engine/positions";
import type { ChoixPositions } from "../positions";
import type { Proposition } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { intensite } from "./TableauCouverture";

export interface ComptesCellule {
  favorables: number;
  defavorables: number;
}

// Nombre de mesures qui améliorent / dégradent la situation du visiteur pour un candidat sur un thème : celles dont un
// effet retenu par le moteur est favorable (ou défavorable). Une mesure est comptée une fois par sens.
export function comptesMesures(projection: { effetsRetenus: { propositionId: string; polarite: string }[] } | null): ComptesCellule {
  const ids = (sens: string) => new Set((projection?.effetsRetenus ?? []).filter((e) => e.polarite === sens).map((e) => e.propositionId));
  return { favorables: ids("favorable").size, defavorables: ids("defavorable").size };
}

// Convictions : nombre de mesures du candidat sur un thème qui vont dans le sens (« pour ») ou à l'opposé (« contre ») d'une
// position choisie par le visiteur, tous sujets choisis confondus. Une mesure est comptée une fois par sens ; seules les
// mesures étiquetées comptent (une mesure sans étiquette n'est ni pour ni contre).
export function comptesConvictions(propositions: Proposition[], choix: ChoixPositions): ComptesCellule {
  const pour = new Set<string>();
  const contre = new Set<string>();
  for (const [sujet, position] of Object.entries(choix)) {
    for (const r of projeterPosition(sujet, position, propositions).retenues) (r.conforme ? pour : contre).add(r.propositionId);
  }
  return { favorables: pour.size, defavorables: contre.size };
}

// Vert (--ameliorant) ou rouge (--degradant) plus ou moins opaque selon le nombre de mesures : même échelle (racine carrée)
// que le tableau de l'accueil. Le nombre reste écrit, la couleur n'est qu'un repère.
export function fondDemi(n: number, maximum: number, sens: "favorable" | "defavorable"): { background: string; color?: string } {
  const opacite = 0.12 + 0.78 * intensite(n, maximum);
  const rgb = sens === "favorable" ? "30, 122, 90" : "180, 50, 63";
  return { background: `rgba(${rgb}, ${opacite.toFixed(3)})`, color: opacite > 0.5 ? "#ffffff" : undefined };
}

interface TableauPoursContresProps {
  cards: CardTheme[];
  titre: string;
  // Mots du libellé lu par les lecteurs d'écran : « favorable » / « défavorable » ou « dans le sens » / « à l'opposé ».
  mots: { favorable: string; defavorable: string; vide: string };
  comptes: (ligne: LigneCandidat) => ComptesCellule;
}

// Tableau à double entrée comme celui de l'accueil (candidats en lignes, thèmes en colonnes, même survol : la ligne et la
// colonne de la cellule sont mises en valeur), avec dans chaque cellule le nombre de mesures « pour » (vert, « + ») et « contre »
// (rouge, « − »). Une cellule mixte porte les deux couleurs côte à côte. Lignes par ordre alphabétique : un rangement, jamais
// un classement.
function TableauPoursContres({ cards, titre, mots, comptes }: TableauPoursContresProps) {
  const [survol, setSurvol] = useState<{ ligne: string; colonne: string } | null>(null);
  const metas = new Map<string, { slug: string; nom: string }>();
  for (const card of cards) for (const l of card.lignes) metas.set(l.meta.slug, { slug: l.meta.slug, nom: l.meta.nom });
  const lignes = [...metas.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const comptesCellule = (slug: string, card: CardTheme): ComptesCellule => {
    const ligne = card.lignes.find((l) => l.meta.slug === slug);
    return ligne ? comptes(ligne) : { favorables: 0, defavorables: 0 };
  };
  const maximum = Math.max(0, ...lignes.flatMap((c) => cards.flatMap((card) => Object.values(comptesCellule(c.slug, card)))));

  return (
    <div className="tableau-defilement">
      <table className="tableau-couverture tableau-resultat" onMouseLeave={() => setSurvol(null)}>
        <caption>{titre}</caption>
        <thead>
          <tr>
            <th scope="col" className="coin">
              <span className="cache-visuel">Candidat</span>
            </th>
            {cards.map(({ theme }) => (
              <th scope="col" key={theme.id} className={survol?.colonne === theme.id ? "surligne" : undefined}>
                <span className="entete-theme">
                  <IconeTheme themeId={theme.id} />
                  <span>{theme.libelle}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((candidat) => {
            const ligneSurlignee = survol?.ligne === candidat.slug;
            return (
              <tr key={candidat.slug} className={ligneSurlignee ? "surligne" : undefined}>
                <th scope="row">
                  <span className="candidat-ligne">
                    <Pastille slug={candidat.slug} nom={candidat.nom} className="pastille--petite" />
                    <span>{candidat.nom}</span>
                  </span>
                </th>
                {cards.map((card) => {
                  const { favorables, defavorables } = comptesCellule(candidat.slug, card);
                  const classes = [
                    favorables === 0 && defavorables === 0 ? "cellule-vide" : "cellule-resultat",
                    survol?.colonne === card.theme.id ? "colonne-surlignee" : "",
                    ligneSurlignee && survol?.colonne === card.theme.id ? "cellule-survolee" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const auSurvol = () => setSurvol({ ligne: candidat.slug, colonne: card.theme.id });
                  if (favorables === 0 && defavorables === 0) {
                    return (
                      <td key={card.theme.id} className={classes} onMouseEnter={auSurvol}>
                        <span aria-label={mots.vide}>—</span>
                      </td>
                    );
                  }
                  const libelle = `${candidat.nom}, ${card.theme.libelle} : ${favorables} mesure${favorables > 1 ? "s" : ""} ${mots.favorable}, ${defavorables} ${mots.defavorable}`;
                  return (
                    <td key={card.theme.id} className={classes} aria-label={libelle} onMouseEnter={auSurvol}>
                      {favorables > 0 && (
                        <span className="demi-resultat" style={fondDemi(favorables, maximum, "favorable")}>
                          +{favorables}
                        </span>
                      )}
                      {defavorables > 0 && (
                        <span className="demi-resultat" style={fondDemi(defavorables, maximum, "defavorable")}>
                          −{defavorables}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface TableauResultatProps {
  cards: CardTheme[];
  // Positions choisies dans « Mes convictions » : sans elles, seul le tableau de la situation est affiché.
  positions?: ChoixPositions;
  // Bandeau de révélation des identités, collé en haut de l'écran tant que le tableau est visible (absent une fois révélé).
  bandeau?: ReactNode;
}

// Résultat en tableaux : un selon la situation du visiteur, un selon ses convictions (seulement s'il a choisi des positions).
export function TableauResultat({ cards, positions = {}, bandeau }: TableauResultatProps) {
  const aDesConvictions = Object.keys(positions).length > 0;
  const [onglet, setOnglet] = useState<Onglet>("situation");
  // Si les positions disparaissent (réponses effacées), on revient à l'onglet qui existe toujours.
  const actif: Onglet = aDesConvictions ? onglet : "situation";
  const choisir = (suivant: Onglet) => {
    setOnglet(suivant);
    if (typeof document !== "undefined") document.getElementById(`onglet-resultat-${suivant}`)?.focus();
  };
  // Flèches gauche / droite : passent d'un onglet à l'autre, comme sur un ensemble d'onglets standard.
  const auClavier = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      choisir(e.key === "ArrowRight" || e.key === "End" ? "convictions" : "situation");
    }
  };
  return (
    <div className="tableaux-resultat">
      {bandeau && <div className="bandeau-revelation-tableau">{bandeau}</div>}
      {aDesConvictions && (
        <div className="onglets onglets--tableaux" role="tablist" aria-label="Tableau du résultat">
          {ONGLETS.map(({ id, libelle }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`onglet-resultat-${id}`}
              aria-selected={actif === id}
              aria-controls="panneau-resultat"
              tabIndex={actif === id ? 0 : -1}
              onClick={() => setOnglet(id)}
              onKeyDown={auClavier}
            >
              {libelle}
            </button>
          ))}
        </div>
      )}
      <div id="panneau-resultat" role={aDesConvictions ? "tabpanel" : undefined} aria-labelledby={aDesConvictions ? `onglet-resultat-${actif}` : undefined}>
        {actif === "situation" ? (
          <TableauPoursContres
            cards={cards}
            titre="Selon votre situation : mesures qui améliorent (+) ou dégradent (−) votre situation, par candidat et par thème"
            mots={{ favorable: "favorable", defavorable: "défavorable", vide: "aucune mesure qui change votre situation" }}
            comptes={(l) => comptesMesures(l.projection)}
          />
        ) : (
          <TableauPoursContres
            cards={cards}
            titre="Selon vos convictions : mesures dans le sens (+) ou à l'opposé (−) de vos positions, par candidat et par thème"
            mots={{ favorable: "dans le sens de vos convictions", defavorable: "à l'opposé", vide: "aucune mesure sur vos convictions" }}
            comptes={(l) => comptesConvictions(l.propositions, positions)}
          />
        )}
      </div>
    </div>
  );
}

type Onglet = "situation" | "convictions";
const ONGLETS: Array<{ id: Onglet; libelle: string }> = [
  { id: "situation", libelle: "Selon ma situation" },
  { id: "convictions", libelle: "Selon mes convictions" },
];
