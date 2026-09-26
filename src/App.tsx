import { useState } from "react";
import PageThemes from "./ui/PageThemes";
import PageQuestionsGenerales from "./ui/PageQuestionsGenerales";
import Monitoring from "./ui/Monitoring";
import { SelecteurBase } from "./ui/SelecteurBase";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { chargerBase, listerBases } from "./data/bases";
import { CHAMPS_PROFIL } from "./questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "./profil";
import type { ChampProfil } from "./types";

type Ecran = "themes" | "questions-generales";

const BASES = listerBases();

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("themes");
  // Les réponses du visiteur restent en mémoire de la page : ni envoyées, ni stockées.
  const [profil, setProfil] = useState<ProfilPartiel>({});
  // Les indicateurs n'apparaissent qu'après la validation du formulaire général.
  const [generalSoumis, setGeneralSoumis] = useState(false);
  const [baseId, setBaseId] = useState<string>(() => baseInitiale(BASES).id);
  const base = chargerBase(baseId);

  function choisirBase(id: string): void {
    retenirBase(id);
    setBaseId(id);
  }

  // Réponses données depuis un thème, après le formulaire général : elles s'appliquent tout de suite.
  function repondreDansUnTheme(champ: ChampProfil, brut: string | string[]): void {
    setProfil((precedent) => mettreAJourReponse(precedent, champ, brut, CHAMPS_PROFIL));
  }

  const selecteur = <SelecteurBase bases={BASES} actif={baseId} onChoisir={choisirBase} />;

  if (window.location.pathname === "/monitoring") {
    return (
      <>
        {selecteur}
        <Monitoring base={base} />
      </>
    );
  }

  if (ecran === "questions-generales") {
    return (
      <PageQuestionsGenerales
        questions={base.questionnaire.generales}
        profilInitial={profil}
        onValider={(p) => {
          setProfil(p);
          setGeneralSoumis(true);
          setEcran("themes");
          window.scrollTo(0, 0);
        }}
        onAnnuler={() => setEcran("themes")}
      />
    );
  }

  return (
    <>
      {selecteur}
      <PageThemes
        base={base}
        profil={profil}
        generalSoumis={generalSoumis}
        onRenseigner={() => setEcran("questions-generales")}
        onEffacer={() => {
          setProfil({});
          setGeneralSoumis(false);
        }}
        onReponse={repondreDansUnTheme}
      />
    </>
  );
}
