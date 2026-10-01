import { useState } from "react";
import type { LigneCandidat } from "./cards";
import { Pastille } from "./Pastille";
import type { NiveauProjection } from "../engine/projection";

// Durée d'une traversée (du bas au haut de la carte), en secondes, et nombre maximal de portraits en même temps.
const DUREE_S = 20;
const EMPLACEMENTS_MAX = 4;

interface Tirage {
  curseur: number;
  slug: string;
  nom: string;
  mesure: string;
  // Niveau de l'indicateur du CANDIDAT sur ce thème (simulateur) : colore son portrait, comme la légende. « Non concerné »
  // n'a pas de couleur (comme sur les portraits), pas plus qu'en exploration où il n'y a pas d'indicateur.
  niveau: NiveauProjection | null;
  // Sens de la MESURE citée dans la bulle : colore la bulle (vert ou rouge) ; absent quand il n'est pas établi.
  sens: "favorable" | "defavorable" | null;
  // Position horizontale du portrait, en % de la largeur : X_GAUCHE ou X_DROITE selon la parité du curseur.
  x: number;
}

// Les candidats se succèdent alternativement à gauche et à droite, à des positions fixes (pas de hasard sur x).
const X_GAUCHE = 22;
const X_DROITE = 100 - X_GAUCHE;

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

// Ce que dit la bulle : de préférence un mot clé du résumé du candidat sur ce thème (la version résumée d'une mesure,
// celle qu'on retrouve en accentué dans l'onglet Résumé) ; à défaut de résumé, le titre d'une mesure.
function textesPossibles(ligne: LigneCandidat): Array<{ texte: string; ids: string[] }> {
  const motsCles = (ligne.resume?.segments ?? []).filter((s) => s.mesures.length > 0 && s.texte.trim()).map((s) => ({ texte: s.texte.trim(), ids: s.mesures }));
  return motsCles.length > 0 ? motsCles : ligne.propositions.map((p) => ({ texte: p.titre, ids: [p.id] }));
}

// Sens de LA mesure citée (pas du candidat : un candidat « mixte » a des mesures favorables ET défavorables, chacune est
// l'une ou l'autre) : favorable ou défavorable si tous ses effets retenus vont dans le même sens, sinon pas de couleur.
function sensDeLaMesure(ligne: LigneCandidat, ids: string[]): "favorable" | "defavorable" | null {
  const sens = new Set((ligne.projection?.effetsRetenus ?? []).filter((e) => ids.includes(e.propositionId)).map((e) => e.polarite));
  return sens.size === 1 ? ([...sens][0] as "favorable" | "defavorable") : null;
}

// Un candidat tiré au hasard (jamais l'un de ceux déjà à l'écran tant qu'il en reste d'autres, sans quoi le même
// candidat reviendrait en double) et l'une de ses mesures, au hasard aussi. Le curseur ne sert qu'à alterner les côtés.
function tirer(lignes: LigneCandidat[], curseur: number, dejaLa: string[]): Tirage {
  const libres = lignes.filter((l) => !dejaLa.includes(l.meta.slug));
  const choix = libres.length > 0 ? libres : lignes;
  const ligne = choix[Math.floor(Math.random() * choix.length)];
  const textes = textesPossibles(ligne);
  const choisi = textes[Math.floor(Math.random() * textes.length)];
  const mesure = majuscule(choisi.texte);
  const niveau = ligne.projection?.niveau;
  return { curseur, slug: ligne.meta.slug, nom: ligne.meta.nom, mesure, sens: sensDeLaMesure(ligne, choisi.ids), niveau: niveau && niveau !== "non_concerne" ? niveau : null, x: curseur % 2 === 0 ? X_GAUCHE : X_DROITE };
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
          data-niveau={t.niveau ?? undefined}
          data-sens={t.sens ?? undefined}
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
