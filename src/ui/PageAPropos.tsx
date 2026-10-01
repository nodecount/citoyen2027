import { Camera, Database, Lock, Scale } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { Pastille, PORTRAITS } from "./Pastille";

interface PageAProposProps {
  bases: InfoBase[];
  nomsParSlug: Record<string, string>;
}

// Page « À propos » : ce qui n'aide pas directement à choisir, mais qu'un site doit dire quelque part — une seule fois.
// Une section = un bloc avec son icône.
export default function PageAPropos({ bases, nomsParSlug }: PageAProposProps) {
  const credits = Object.entries(PORTRAITS).sort(([a], [b]) => a.localeCompare(b));
  return (
    <section className="a-propos">
      <div className="sections-a-propos">
        <article className="bloc-a-propos">
          <Scale aria-hidden="true" />
          <h2>Indépendant</h2>
          <p>Aucun lien avec un parti ou un candidat.</p>
          <p>Les candidats sont toujours présentés par ordre alphabétique.</p>
        </article>

        <article className="bloc-a-propos">
          <Database aria-hidden="true" />
          <h2>D'où viennent les données</h2>
          <ul>
            {bases.map((base) => (
              <li key={base.id}>
                <strong>{base.libelle}</strong> : {base.description}
              </li>
            ))}
          </ul>
          <p>Chaque mesure renvoie à sa source.</p>
        </article>

        <article className="bloc-a-propos">
          <Lock aria-hidden="true" />
          <h2>Vos données</h2>
          <p>Vos réponses restent dans votre navigateur.</p>
          <p>Rien n'est envoyé ni enregistré.</p>
        </article>
      </div>

      <article className="bloc-a-propos bloc-credits">
        <Camera aria-hidden="true" />
        <h2>Crédits photos</h2>
        <p>Photos sous licence libre, via Wikimedia Commons.</p>
        <ul className="liste-credits">
          {credits.map(([slug, p]) => (
            <li key={slug}>
              <Pastille slug={slug} nom={nomsParSlug[slug] ?? slug} className="pastille--petite" />
              <span>
                <strong>{nomsParSlug[slug] ?? slug}</strong>
                <span className="credit-detail">
                  {p.auteur} ·{" "}
                  <a href={p.licence_url || p.source_url} target="_blank" rel="noopener noreferrer">
                    {p.licence}
                  </a>{" "}
                  ·{" "}
                  <a href={p.source_url} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
