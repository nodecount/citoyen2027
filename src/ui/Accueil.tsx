import { FileText, LayoutGrid, UserRoundCheck, Users } from "lucide-react";
import { candidatsDeBase, derniereMiseAJour, type BaseCharge } from "../data/bases";
import type { Ouverture } from "./router";
import { TableauCouverture } from "./TableauCouverture";

interface AccueilProps {
  base: BaseCharge;
  onCommencer: () => void;
  onOuvrir: (ouverture: Ouverture) => void;
}

function dateLisible(iso: string): string {
  // "AAAA-MM-JJ" → lu en heure locale à midi, pour ne jamais basculer au jour précédent selon le fuseau du visiteur.
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

// Accueil : ce qu'est l'outil (en une phrase), ses garanties, puis qui propose quoi. Pas de formulaire ici :
// la personnalisation est annoncée, elle se fait dans le parcours par thème.
export default function Accueil({ base, onCommencer, onOuvrir }: AccueilProps) {
  const { avecDonnees } = candidatsDeBase(base);
  const maj = derniereMiseAJour(base);
  const n = avecDonnees.length;

  return (
    <section className="accueil">
      <div className="bandeau-accueil">
        <h1>Présidentielle 2027 : les programmes, thème par thème</h1>
        <p className="chapeau">
          Les mesures des candidats, avec leurs sources. Quel est le candidat qui vous correspond le mieux ?{" "}
          <strong>Faites le test pour guider votre choix.</strong>
        </p>
        <button type="button" onClick={onCommencer}>
          Accéder au simulateur
        </button>
      </div>

      <ul className="atouts">
        <li>
          <Users aria-hidden="true" />
          <strong>{n} candidats</strong>
          <span>à l'élection présidentielle 2027</span>
        </li>
        <li>
          <FileText aria-hidden="true" />
          <strong>Programmes officiels</strong>
          <span>{maj ? `à jour du ${dateLisible(maj)}` : "une source par mesure"}</span>
        </li>
        <li>
          <LayoutGrid aria-hidden="true" />
          <strong>{base.themes.length} thèmes</strong>
          <span>populaires et différenciants</span>
        </li>
        <li>
          <UserRoundCheck aria-hidden="true" />
          <strong>Adapté à votre situation</strong>
          <span>facultatif, gratuit, rien n'est enregistré</span>
        </li>
      </ul>

      <h2 className="accueil-sous-titre">
        <LayoutGrid aria-hidden="true" />
        Qui propose quoi ?
      </h2>
      <TableauCouverture themes={base.themes} candidats={avecDonnees} onOuvrir={onOuvrir} />

    </section>
  );
}
