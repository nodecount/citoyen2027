import { SUJETS_CONVICTION, trouverPosition, type PositionMesure, type SujetConviction } from "../positions";
import type { Proposition } from "../types";
import { positionsDeLaProposition } from "./sensDuVote";

// Constat « convictions » d'un candidat sur un thème, pour UN sujet choisi par le visiteur : ce que ses mesures étiquetées
// sur ce sujet disent par rapport à la position choisie. Règle publique, sans pondération :
//  - « ameliorant » : au moins une mesure défend la position choisie, aucune ne défend une autre position du sujet ;
//  - « degradant »  : au moins une mesure défend une autre position du sujet, aucune ne défend la position choisie ;
//  - « mixte »      : les deux ;
//  - null           : aucune mesure étiquetée sur ce sujet (on ne devine pas, l'absence n'est ni pour ni contre).
// Les niveaux gardent les mêmes noms que l'indicateur « Ma situation » pour réutiliser le solde du candidat idéal ; l'interface
// les présente avec ses propres mots (« proche de votre position », « opposé »).
export interface ConstatPosition {
  niveau: "ameliorant" | "mixte" | "degradant" | null;
  // Mesures prises en compte, avec leur étiquette (pour « Pourquoi ? »).
  retenues: Array<{ propositionId: string; etiquette: PositionMesure; conforme: boolean }>;
}

export function projeterPosition(sujetId: string, positionChoisie: string, propositions: Proposition[]): ConstatPosition {
  const retenues: ConstatPosition["retenues"] = [];
  if (!trouverPosition(sujetId, positionChoisie)) return { niveau: null, retenues };
  let conformes = 0;
  let opposees = 0;
  for (const proposition of propositions) {
    if (proposition.statut === "provisoire") continue;
    for (const etiquette of positionsDeLaProposition(proposition)) {
      if (etiquette.sujet !== sujetId) continue;
      const conforme = etiquette.position === positionChoisie;
      retenues.push({ propositionId: proposition.id, etiquette, conforme });
      if (conforme) conformes += 1;
      else opposees += 1;
    }
  }
  const niveau: ConstatPosition["niveau"] = conformes > 0 && opposees > 0 ? "mixte" : conformes > 0 ? "ameliorant" : opposees > 0 ? "degradant" : null;
  return { niveau, retenues };
}

// Sujets de convictions à proposer pour une base : ceux qu'au moins une de SES mesures étiquette. Poser une question qui ne
// peut influencer aucun résultat ne servirait à rien (« minimum nécessaire ») : chaque source a ainsi les sujets que ses
// propres mesures permettent de départager. Sans mesures fournies (null), tout le catalogue.
export function sujetsDisponibles(propositions: Proposition[] | null): SujetConviction[] {
  if (propositions === null) return SUJETS_CONVICTION;
  const etiquetes = new Set<string>();
  for (const p of propositions) {
    if (p.statut === "provisoire") continue;
    for (const e of positionsDeLaProposition(p)) etiquetes.add(e.sujet);
  }
  return SUJETS_CONVICTION.filter((s) => etiquetes.has(s.id));
}