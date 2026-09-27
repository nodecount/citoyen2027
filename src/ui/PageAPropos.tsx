import type { InfoBase } from "../data/bases";
import { PORTRAITS } from "./Pastille";

interface PageAProposProps {
  bases: InfoBase[];
  nomsParSlug: Record<string, string>;
}

// Page « À propos » : ce qui n'aide pas directement à choisir, mais qu'un site doit dire quelque part — une seule fois.
export default function PageAPropos({ bases, nomsParSlug }: PageAProposProps) {
  const credits = Object.entries(PORTRAITS).sort(([a], [b]) => a.localeCompare(b));
  return (
    <section className="a-propos">
      <h1>À propos</h1>

      <h2>Indépendant</h2>
      <p>Aucun lien avec un parti ou un candidat. Les candidats sont toujours présentés par ordre alphabétique.</p>

      <h2>D'où viennent les données</h2>
      <ul>
        {bases.map((base) => (
          <li key={base.id}>
            <strong>{base.libelle}</strong> : {base.description}
          </li>
        ))}
      </ul>
      <p>Chaque mesure renvoie à sa source.</p>

      <h2>Vos données</h2>
      <p>Vos réponses restent dans votre navigateur. Rien n'est envoyé ni enregistré.</p>

      <h2>Crédits photos</h2>
      <p>Photos sous licence libre, via Wikimedia Commons.</p>
      <ul className="liste-credits">
        {credits.map(([slug, p]) => (
          <li key={slug}>
            <strong>{nomsParSlug[slug] ?? slug}</strong> : {p.auteur},{" "}
            <a href={p.licence_url || p.source_url} target="_blank" rel="noopener noreferrer">
              {p.licence}
            </a>{" "}
            (
            <a href={p.source_url} target="_blank" rel="noopener noreferrer">
              source
            </a>
            )
          </li>
        ))}
      </ul>
    </section>
  );
}
