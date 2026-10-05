import type { Meilleurs, Solde } from "../engine/candidatIdeal";
import { PREFIXE_ANONYME, type Correspondance } from "./aveugle";
import type { ResultatAffiche } from "./CardCandidatIdeal";

// Pont entre le calcul (slugs réels) et la card (lettres). Tant que `revele` est faux, AUCUNE identité n'est transmise à la
// card, pas même le slug réel : elle ne reçoit que les lettres. Une correspondance introuvable donne « ? » et aucune identité
// (on ne devine jamais un nom).
export function versResultatAffiche(titre: string, unite: ResultatAffiche["unite"], m: Meilleurs | null, correspondance: Correspondance[], revele: boolean, soldesAnonymes: Solde[] = []): ResultatAffiche | null {
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
      // Floutée : les mesures viennent du calcul sur les cartes ANONYMISÉES (noms et partis déjà remplacés dans les textes),
      // retrouvées par la lettre ; révélée : les textes réels. Introuvable : rien (jamais le texte réel d'un candidat masqué).
      const anonyme = c ? soldesAnonymes.find((x) => x.slug === PREFIXE_ANONYME + c.lettre) : undefined;
      return {
        lettre: c?.lettre ?? "?",
        identite: revele && c ? { slug: c.slug, nom: c.nom, parti: c.parti } : null,
        ameliorants: g.ameliorants,
        degradants: g.degradants,
        analyses: g.analyses,
        pour: revele ? g.pour : (anonyme?.pour ?? []),
        contre: revele ? g.contre : (anonyme?.contre ?? []),
      };
    }),
  };
}
