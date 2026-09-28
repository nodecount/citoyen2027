import { useEffect, useState } from "react";
import Accueil from "./ui/Accueil";
import { Menu } from "./ui/Menu";
import { PiedDePage } from "./ui/PiedDePage";
import PageThemes from "./ui/PageThemes";
import PageQuestionsGenerales from "./ui/PageQuestionsGenerales";
import PageAPropos from "./ui/PageAPropos";
import Monitoring from "./ui/Monitoring";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { ecranDepuisChemin, naviguerVers, type Ecran, type Ouverture } from "./ui/router";
import { chargerBase, listerBases } from "./data/bases";
import { CHAMPS_PROFIL } from "./questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "./profil";
import type { ChampProfil } from "./types";

const BASES = listerBases();

export default function App() {
  // L'écran affiché suit l'adresse : « / » accueil, « /simulateur », « /ma-situation », « /a-propos ».
  const [ecran, setEcran] = useState<Ecran>(() => ecranDepuisChemin(window.location.pathname));
  // Les réponses du visiteur restent en mémoire de la page : ni envoyées, ni stockées.
  const [profil, setProfil] = useState<ProfilPartiel>({});
  // Les indicateurs n'apparaissent qu'après la validation du formulaire général.
  const [generalSoumis, setGeneralSoumis] = useState(false);
  const [baseId, setBaseId] = useState<string>(() => baseInitiale(BASES).id);
  const base = chargerBase(baseId);

  // Boutons précédent/suivant du navigateur.
  useEffect(() => {
    const surRetour = () => setEcran(ecranDepuisChemin(window.location.pathname));
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
  }, []);

  // Avec une ouverture, c'est la page des thèmes qui fait défiler jusqu'à la carte (voir PageThemes).
  function allerA(cible: Ecran, ouverture?: Ouverture): void {
    naviguerVers(cible, ouverture);
    setEcran(cible);
    if (!ouverture) window.scrollTo(0, 0);
  }

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

  return (
    <>
      <Menu ecran={ecran} onNaviguer={allerA} bases={BASES} baseActive={baseId} onChoisirBase={choisirBase} />
      {ecran === "accueil" && <Accueil base={base} onCommencer={() => allerA("simulateur")} onOuvrir={(ouverture) => allerA("simulateur", ouverture)} />}
      {ecran === "a-propos" && <PageAPropos bases={BASES} nomsParSlug={Object.fromEntries(Object.entries(base.metas).map(([slug, m]) => [slug, m.nom]))} />}
      {ecran === "questions-generales" && (
        <PageQuestionsGenerales
          questions={base.questionnaire.generales}
          profilInitial={profil}
          onValider={(p) => {
            setProfil(p);
            setGeneralSoumis(true);
            allerA("simulateur");
          }}
          onAnnuler={() => allerA("simulateur")}
        />
      )}
      {ecran === "simulateur" && (
        <PageThemes
          base={base}
          profil={profil}
          generalSoumis={generalSoumis}
          onValider={(p) => {
            setProfil(p);
            setGeneralSoumis(true);
          }}
          onEffacer={() => {
            setProfil({});
            setGeneralSoumis(false);
          }}
          onReponse={repondreDansUnTheme}
        />
      )}
      <PiedDePage onNaviguer={allerA} />
    </>
  );
}
