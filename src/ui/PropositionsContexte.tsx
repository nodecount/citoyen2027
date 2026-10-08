import { createContext } from "react";
import type { Proposition } from "../types";

// Mesures de la base active, fournies aux questions pour afficher « combien de mesures cette réponse concerne ».
// Null (aucun fournisseur) : les questions n'affichent pas de compteur.
export const PropositionsBase = createContext<Proposition[] | null>(null);