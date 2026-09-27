import { useState } from "react";
import Accueil from "./ui/Accueil";
import { Menu, type Ecran as EcranMenu } from "./ui/Menu";
import PageThemes from "./ui/PageThemes";
import PageQuestionsGenerales from "./ui/PageQuestionsGenerales";
import Monitoring from "./ui/Monitoring";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { chargerBase, listerBases } from "./data/bases";
import { CHAMPS_PROFIL } from "./questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "./profil";
import type { ChampProfil } from "./types";

type Ecran = EcranMenu | "questions-generales";

const BASES = listerBases();

export default function App() {
  // La page de départ présente l'outil avant d'entrer dans les thèmes.
  const [ecran, setEcran] = useState<Ecran>("accueil");
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

  if (window.location.pathname === "/monitoring") {
    return <Monitoring base={base} />;
  }

  // Le formulaire général est un écran à part entière (pas de menu ni de distraction pendant la saisie), mais reste
  // accessible en un clic depuis le menu de tout écran : « Thèmes » y ramène.
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

  // Naviguer vers "accueil"/"themes" via le menu quitte le formulaire général sans rien enregistrer (identique à
  // « Retour aux thèmes ») : le menu ne doit jamais laisser un écran caché en incohérence avec le menu affiché.
  const menu = <Menu ecran={ecran} onNaviguer={setEcran} bases={BASES} baseActive={baseId} onChoisirBase={choisirBase} />;

  return (
    <>
      {menu}
      {ecran === "accueil" ? (
        <Accueil base={base} onCommencer={() => setEcran("themes")} />
      ) : (
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
      )}
    </>
  );
}
