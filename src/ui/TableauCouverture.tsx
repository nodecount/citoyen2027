import { useState } from "react";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Theme } from "../types";
import { affichable } from "./cards";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import type { Ouverture } from "./router";

export function compterMesures(candidat: CandidatCharge, themeId: string): number {
  return candidat.propositions.filter((p) => p.theme === themeId && affichable(p)).length;
}

// Intensité de la couleur d'une cellule, entre 0 et 1. Racine carrée : un programme très détaillé sur un thème ne doit
// pas écraser visuellement tous les autres. La couleur est un repère de densité, jamais une note : le nombre est écrit.
export function intensite(n: number, maximum: number): number {
  if (n <= 0 || maximum <= 0) return 0;
  return Math.sqrt(n / maximum);
}

// Bleu d'action (#1b3f94) plus ou moins opaque : une seule teinte, sans connotation bonne ou mauvaise (ni vert ni rouge).
export function styleCellule(n: number, maximum: number): { background?: string; color?: string } {
  const i = intensite(n, maximum);
  if (i === 0) return {};
  const opacite = 0.1 + 0.75 * i;
  return { background: `rgba(27, 63, 148, ${opacite.toFixed(3)})`, color: opacite > 0.5 ? "#ffffff" : undefined };
}

interface TableauCouvertureProps {
  themes: Theme[];
  candidats: CandidatCharge[];
  onOuvrir?: (ouverture: Ouverture) => void;
}

// Vue d'ensemble de la base : candidats en lignes (ordre alphabétique, jamais un classement), thèmes en colonnes
// (ordre du référentiel), nombre de mesures sourcées à l'intersection. Un nombre de mesures n'est pas une note : un
// programme plus détaillé n'est pas « meilleur », il est seulement plus documenté. Au survol d'une cellule, sa ligne et
// sa colonne sont mises en valeur pour faciliter la lecture croisée.
export function TableauCouverture({ themes, candidats, onOuvrir }: TableauCouvertureProps) {
  const [survol, setSurvol] = useState<{ ligne: string; colonne: string } | null>(null);
  const lignes = [...candidats].sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));
  const comptes = new Map(lignes.map((c) => [c.meta.slug, new Map(themes.map((t) => [t.id, compterMesures(c, t.id)]))]));
  const maximum = Math.max(0, ...[...comptes.values()].flatMap((m) => [...m.values()]));

  return (
    <div className="tableau-defilement">
      <table className="tableau-couverture" onMouseLeave={() => setSurvol(null)}>
        <caption>Nombre de mesures sourcées, par candidat et par thème</caption>
        <thead>
          <tr>
            <th scope="col" className="coin">
              Candidat
            </th>
            {themes.map((theme) => (
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
            const slug = candidat.meta.slug;
            const ligneSurlignee = survol?.ligne === slug;
            return (
              <tr key={slug} className={ligneSurlignee ? "surligne" : undefined}>
                <th scope="row">
                  <span className="candidat-ligne">
                    <Pastille slug={slug} nom={candidat.meta.nom} className="pastille--petite" />
                    <span>{candidat.meta.nom}</span>
                  </span>
                </th>
                {themes.map((theme) => {
                  const n = comptes.get(slug)!.get(theme.id)!;
                  const classes = [
                    n === 0 ? "cellule-vide" : "",
                    survol?.colonne === theme.id ? "colonne-surlignee" : "",
                    ligneSurlignee && survol?.colonne === theme.id ? "cellule-survolee" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <td
                      key={theme.id}
                      className={classes || undefined}
                      style={styleCellule(n, maximum)}
                      onMouseEnter={() => setSurvol({ ligne: slug, colonne: theme.id })}
                    >
                      {n === 0 ? (
                        <span aria-label="aucune mesure">—</span>
                      ) : onOuvrir ? (
                        // Toute la case est cliquable : elle ouvre ce candidat dans la carte du thème.
                        <button
                          type="button"
                          className="cellule-lien"
                          aria-label={`${candidat.meta.nom}, ${theme.libelle} : ${n} mesure${n > 1 ? "s" : ""}`}
                          onClick={() => onOuvrir({ theme: theme.id, candidat: slug })}
                          onFocus={() => setSurvol({ ligne: slug, colonne: theme.id })}
                        >
                          {n}
                        </button>
                      ) : (
                        n
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
