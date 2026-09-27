import { candidatsDeBase, derniereMiseAJour, type BaseCharge } from "../data/bases";

interface AccueilProps {
  base: BaseCharge;
  onCommencer: () => void;
}

function dateLisible(iso: string): string {
  // "AAAA-MM-JJ" → lu en heure locale à midi, pour ne jamais basculer au jour précédent selon le fuseau du visiteur.
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

// Page de départ du site : présente l'outil avant les thèmes. Aucun formulaire ici — l'idée de personnalisation est
// annoncée, pas engagée : le consentement et les questions restent dans le parcours par thème.
export default function Accueil({ base, onCommencer }: AccueilProps) {
  const { avecDonnees } = candidatsDeBase(base);
  const maj = derniereMiseAJour(base);
  const n = avecDonnees.length;

  return (
    <section className="accueil">
      <h1>Simulateur d'impact personnel — Présidentielle 2027</h1>
      <p className="chapeau">
        En vue de l'élection présidentielle de 2027, cet outil rassemble, thème par thème et à partir de sources
        publiques, les mesures des programmes des candidats déclarés.
      </p>
      {maj && <p className="maj">Dernière mise à jour des données : {dateLisible(maj)}.</p>}
      <p>
        Vous pouvez consulter ces programmes tels quels. Vous pouvez aussi, si vous le souhaitez, obtenir une vue
        personnalisée — sur votre consentement, avec des questions toutes facultatives — simulant ce que chaque
        mesure changerait concrètement pour votre situation si elle s'appliquait durant le mandat à venir.
      </p>
      <p className="hint">
        {n} {n > 1 ? "candidats sont couverts" : "candidat est couvert"} à ce stade dans la base « {base.info.libelle} »,
        toujours présentés par ordre alphabétique : pas de classement, pas de score.
      </p>
      <button type="button" onClick={onCommencer}>
        Découvrir les thèmes
      </button>
    </section>
  );
}
