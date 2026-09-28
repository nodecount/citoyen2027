import { useState } from "react";
import type { LigneCandidat } from "./cards";
import { Pastille } from "./Pastille";

// Durée d'une traversée (du bas au haut de la carte), en secondes, et nombre maximal de portraits en même temps.
const DUREE_S = 20;
const EMPLACEMENTS_MAX = 4;

interface Tirage {
  curseur: number;
  slug: string;
  nom: string;
  mesure: string;
  // Position horizontale du portrait, en % de la largeur : X_GAUCHE ou X_DROITE selon la parité du curseur.
  x: number;
}

// Les candidats se succèdent alternativement à gauche et à droite, à des positions fixes (pas de hasard sur x).
const X_GAUCHE = 22;
const X_DROITE = 100 - X_GAUCHE;

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

// Ce que dit la bulle : de préférence un mot clé du résumé du candidat sur ce thème (la version résumée d'une mesure,
// celle qu'on retrouve en accentué dans l'onglet Résumé) ; à défaut de résumé, le titre d'une mesure.
function textesPossibles(ligne: LigneCandidat): string[] {
  const motsCles = (ligne.resume?.segments ?? []).filter((s) => s.mesures.length > 0).map((s) => s.texte.trim()).filter(Boolean);
  return motsCles.length > 0 ? motsCles : ligne.propositions.map((p) => p.titre);
}

// Un candidat tiré au hasard (jamais l'un de ceux déjà à l'écran tant qu'il en reste d'autres, sans quoi le même
// candidat reviendrait en double) et l'une de ses mesures, au hasard aussi. Le curseur ne sert qu'à alterner les côtés.
function tirer(lignes: LigneCandidat[], curseur: number, dejaLa: string[]): Tirage {
  const libres = lignes.filter((l) => !dejaLa.includes(l.meta.slug));
  const choix = libres.length > 0 ? libres : lignes;
  const ligne = choix[Math.floor(Math.random() * choix.length)];
  const textes = textesPossibles(ligne);
  const mesure = majuscule(textes[Math.floor(Math.random() * textes.length)]);
  return { curseur, slug: ligne.meta.slug, nom: ligne.meta.nom, mesure, x: curseur % 2 === 0 ? X_GAUCHE : X_DROITE };
}

// Tirages de départ : chacun exclut les précédents.
function tiragesDeDepart(lignes: LigneCandidat[]): Tirage[] {
  const tirages: Tirage[] = [];
  const nombre = Math.min(EMPLACEMENTS_MAX, lignes.length);
  for (let i = 0; i < nombre; i++) tirages.push(tirer(lignes, i, tirages.map((t) => t.slug)));
  return tirages;
}
// Animation d'ambiance, tant qu'aucun candidat n'est choisi : les portraits remontent du bas de la carte et s'effacent
// en haut, chacun avec une bulle qui cite en entier, sur autant de lignes qu'il faut, une seule de ses mesures (au hasard, tirée de nouveau à
// chaque passage). Purement décoratif : masqué aux lecteurs d'écran, non cliquable, sans le nombre de mesures, et
// supprimé si le visiteur demande de limiter les animations. Le côté de la bulle dépend de la position du portrait :
// à droite quand il est à gauche de la carte, à gauche quand il en est près du bord droit.
// À remonter avec une `key` propre à la liste des candidats (elle fige les tirages de départ).
export function FluxCandidats({ lignes }: { lignes: LigneCandidat[] }) {
  const avecMesures = lignes.filter((l) => l.propositions.length > 0);
  const [tirages, setTirages] = useState<Tirage[]>(() => (avecMesures.length === 0 ? [] : tiragesDeDepart(avecMesures)));
  if (tirages.length === 0) return null;
  const nombre = tirages.length;

  // À chaque fin de traversée, l'emplacement repart avec un autre candidat, tiré au hasard parmi ceux absents de l'écran.
  function relancer(indice: number) {
    setTirages((precedents) =>
      precedents.map((t, i) => (i === indice ? tirer(avecMesures, t.curseur + nombre, precedents.filter((_, j) => j !== indice).map((autre) => autre.slug)) : t)),
    );
  }

  return (
    <div className="flux-candidats" aria-hidden="true">
      {tirages.map((t, i) => (
        <div
          key={i}
          className={`flux-item ${t.x < 50 ? "flux-item--bulle-droite" : "flux-item--bulle-gauche"}`}
          style={{ animationDelay: `${(i * DUREE_S) / nombre}s`, animationDuration: `${DUREE_S}s` } as React.CSSProperties}
          onAnimationIteration={() => relancer(i)}
        >
          <Pastille slug={t.slug} nom={t.nom} />
          <span className="flux-bulle">{t.mesure}</span>
        </div>
      ))}
    </div>
  );
}
