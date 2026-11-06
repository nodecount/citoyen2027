import type { BaseCharge } from "../../data/bases";

export interface IndicateursBase {
  candidatsAvecMesures: number;
  candidatsTotal: number;
  themes: number;
  mesures: number;
  mesuresAvecEffets: number;
  mesuresAvecPosition: number;
}

// Chiffres d'ensemble d'une base, comptés dans ses données (aucune estimation) : de quoi vérifier d'un coup d'œil
// qu'une collecte ou une structuration a bien produit ce qu'on attend.
export function indicateursBase(base: BaseCharge): IndicateursBase {
  const toutes = Object.values(base.propositions).flat();
  return {
    candidatsAvecMesures: Object.values(base.propositions).filter((liste) => liste.length > 0).length,
    candidatsTotal: Object.keys(base.metas).length,
    themes: base.themes.length,
    mesures: toutes.length,
    mesuresAvecEffets: toutes.filter((p) => (p.effets?.length ?? 0) > 0).length,
    mesuresAvecPosition: toutes.filter((p) => (p.positions?.length ?? 0) > 0).length,
  };
}
