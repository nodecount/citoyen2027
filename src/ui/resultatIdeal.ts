import type { Meilleurs } from "../engine/candidatIdeal";
import type { Correspondance } from "./aveugle";
import type { ResultatAffiche } from "./CardCandidatIdeal";

// Pont entre le calcul (slugs réels) et la card (lettres). Tant que `revele` est faux, AUCUNE identité n'est transmise à la
// card, pas même le slug réel : elle ne reçoit que les lettres. Une correspondance introuvable donne « ? » et aucune identité
// (on ne devine jamais un nom).
export function versResultatAffiche(titre: string, unite: ResultatAffiche["unite"], m: Meilleurs | null, correspondance: Correspondance[], revele: boolean): ResultatAffiche | null {
  if (!m) return null;
  return {
    titre,
    unite,
    solde: m.solde,
    departageable: m.departageable,
    ecartes: m.ecartes,
    tousEcartes: m.tousEcartes,
    gagnants: m.gagnants.map((g) => {
      const c = correspondance.find((x) => x.slug === g.slug);
      return {
        lettre: c?.lettre ?? "?",
        identite: revele && c ? { slug: c.slug, nom: c.nom, parti: c.parti } : null,
        ameliorants: g.ameliorants,
        degradants: g.degradants,
        analyses: g.analyses,
      };
    }),
  };
}
