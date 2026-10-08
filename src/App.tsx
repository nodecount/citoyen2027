import { useEffect, useMemo, useState } from "react";
import Accueil from "./ui/Accueil";
import { Menu } from "./ui/Menu";
import { PiedDePage } from "./ui/PiedDePage";
import PageThemes from "./ui/PageThemes";
import PageQuestionsGenerales from "./ui/PageQuestionsGenerales";
import PageAPropos from "./ui/PageAPropos";
import Monitoring from "./ui/Monitoring";
import PageTestsSituations from "./ui/PageTestsSituations";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { lireReponses, memoriserReponses } from "./ui/memoireReponses";
import { ecranDepuisChemin, naviguerVers, type Ecran, type Ouverture } from "./ui/router";
import { chargerBase, listerBases } from "./data/bases";
import { PropositionsBase } from "./ui/PropositionsContexte";
import { mettreAJourReponse, type ProfilPartiel } from "./profil";
import type { ChampProfil } from "./types";

const BASES = listerBases();

export default function App() {
  // L'écran affiché suit l'adresse : « / » accueil, « /exploration », « /simulateur », « /ma-situation », « /a-propos », « /monitoring », « /tests-situations ».
  const [ecran, setEcran] = useState<Ecran>(() => ecranDepuisChemin(window.location.pathname));
  // Les réponses du visiteur ne sont jamais envoyées ; elles sont gardées dans son navigateur (voir memoireReponses)
  // pour survivre à un rechargement de la page.
  const [memorise] = useState(lireReponses);
  const [profil, setProfil] = useState<ProfilPartiel>(memorise.profil);
  // Les indicateurs n'apparaissent qu'après l'enregistrement du formulaire général.
  const [generalSoumis, setGeneralSoumis] = useState(memorise.soumis);
  useEffect(() => memoriserReponses({ profil, soumis: generalSoumis }), [profil, generalSoumis]);
  const [baseId, setBaseId] = useState<string>(() => baseInitiale(BASES).id);
  const base = chargerBase(baseId);
  const propositionsDeBase = useMemo(() => Object.values(base.propositions).flat(), [baseId]);

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
    setProfil((precedent) => mettreAJourReponse(precedent, champ, brut, base.champs));
  }

  return (
    <PropositionsBase.Provider value={propositionsDeBase}>
      <Menu ecran={ecran} onNaviguer={allerA} bases={BASES} baseActive={baseId} onChoisirBase={choisirBase} />
      {ecran === "monitoring" && <Monitoring base={base} />}
      {ecran === "tests-situations" && <PageTestsSituations base={base} />}
      {ecran === "accueil" && <Accueil base={base} onCommencer={() => allerA("simulateur")} onOuvrir={(ouverture) => allerA("exploration", ouverture)} />}
      {ecran === "a-propos" && <PageAPropos bases={BASES} nomsParSlug={Object.fromEntries(Object.entries(base.metas).map(([slug, m]) => [slug, m.nom]))} />}
      {ecran === "questions-generales" && (
        <PageQuestionsGenerales
          champs={base.champs}
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
      {ecran === "exploration" && (
        <PageThemes
          key="exploration"
          mode="exploration"
          onNaviguer={allerA}
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
      {ecran === "simulateur" && (
        <PageThemes
          key="simulateur"
          mode="simulateur"
          onNaviguer={allerA}
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
    </PropositionsBase.Provider>
  );
}
