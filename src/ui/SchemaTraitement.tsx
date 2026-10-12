import type { ReactNode } from "react";

// Schéma de la chaîne de traitement (page « À propos »), en documentation technique : ce que fait le code, ce que fait un modèle
// d'IA, et ce qui contrôle quoi. Chaque étape dit QUI agit : le mot (« Code » / « Modèle d'IA ») porte l'information, la forme
// de la pastille la double, jamais la couleur seule.
type Acteur = "code" | "modele";

interface Etape {
  titre: string;
  acteur: Acteur;
  texte: string;
  // Commande qui lance l'étape quand il y en a une (documentation pour qui veut rejouer la chaîne).
  commande?: string;
}

const COLLECTE: Etape = {
  titre: "Collecte des mesures",
  acteur: "code",
  texte: "Chaque mesure est recopiée telle que la source la publie, avec son lien. Une seule requête publique, aucun modèle. Un candidat que la source retire est retiré de chez nous.",
  commande: "npm run scrape:ifrap",
};

const SITUATION: Etape[] = [
  { titre: "Effets sur un citoyen", acteur: "modele", texte: "Le modèle indique à qui s'adresse la mesure et ce qu'elle change (revenu, coût de la vie, droits, coût d'emploi pour un employeur…), en citant un extrait de la mesure.", commande: "npm run scrape:structurer" },
  { titre: "Contrôle de l'extrait", acteur: "code", texte: "Le code vérifie que chaque extrait cité se retrouve mot pour mot dans la mesure. Sinon l'effet est écarté." },
  { titre: "Seconde lecture", acteur: "modele", texte: "Un second appel relit chaque effet. S'il en refuse un, tous les effets de la mesure sont retirés : jamais de conclusion fondée sur la moitié d'une mesure." },
  { titre: "Sens de l'effet", acteur: "code", texte: "Favorable ou défavorable est fixé par une table de règles écrite dans le code, jamais par le modèle." },
];

const CONVICTIONS: Etape[] = [
  { titre: "Étiquetage des positions", acteur: "modele", texte: "Le modèle indique quelle position défend la mesure sur un sujet (nucléaire, immigration, Europe…), en citant un extrait.", commande: "npm run scrape:positions" },
  { titre: "Contrôle de l'extrait", acteur: "code", texte: "Même règle : l'extrait doit se retrouver mot pour mot dans la mesure, sinon l'étiquette est écartée." },
  { titre: "Seconde lecture", acteur: "modele", texte: "Une étiquette refusée retire toutes celles de la mesure. Une mesure sans étiquette n'a aucune position : elle n'est jamais comptée « contre »." },
];

const NOM_ACTEUR: Record<Acteur, string> = { code: "Code", modele: "Modèle d'IA" };

function CarteEtape({ etape, numero }: { etape: Etape; numero: number }) {
  return (
    <li className="etape-schema">
      <span className="etape-schema-numero" aria-hidden="true">
        {numero}
      </span>
      <div>
        <h4>
          {etape.titre} <span className={`acteur acteur--${etape.acteur}`}>{NOM_ACTEUR[etape.acteur]}</span>
        </h4>
        <p>{etape.texte}</p>
        {etape.commande && <code>{etape.commande}</code>}
      </div>
    </li>
  );
}

function Colonne({ titre, etapes, depart, children }: { titre: string; etapes: Etape[]; depart: number; children?: ReactNode }) {
  return (
    <section className="colonne-schema">
      <h3>{titre}</h3>
      <ol>
        {etapes.map((e, i) => (
          <CarteEtape key={e.titre + i} etape={e} numero={depart + i} />
        ))}
      </ol>
      {children}
    </section>
  );
}

export default function SchemaTraitement() {
  return (
    <figure className="schema-traitement" aria-label="Schéma de la chaîne de traitement des mesures">
      <ol className="schema-entree">
        <CarteEtape etape={COLLECTE} numero={1} />
      </ol>
      <div className="schema-fleche" aria-hidden="true" />
      <div className="schema-colonnes">
        <Colonne titre="Pour votre situation" etapes={SITUATION} depart={2} />
        <Colonne titre="Pour vos convictions" etapes={CONVICTIONS} depart={6} />
      </div>
      <div className="schema-fleche" aria-hidden="true" />
      <ol className="schema-sortie">
        <CarteEtape
          numero={9}
          etape={{
            titre: "Calcul dans votre navigateur",
            acteur: "code",
            texte: "Vos réponses et vos convictions sont comparées aux mesures chez vous, sans rien envoyer. Pour chaque thème : améliorant, mixte, dégradant ou non concerné. Le score est le nombre de mesures favorables moins le nombre de mesures défavorables.",
          }}
        />
      </ol>
      <figcaption>
        Un modèle d'IA propose, le code contrôle. À ce jour, aucun effet ni aucune étiquette n'a encore été relu une à une par une personne.
      </figcaption>
    </figure>
  );
}
