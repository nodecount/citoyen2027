import { useState } from "react";
import PageThemes from "./ui/PageThemes";
import ProfilForm from "./ui/ProfilForm";
import Monitoring from "./ui/Monitoring";
import { SelecteurBase } from "./ui/SelecteurBase";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { chargerBase, listerBases } from "./data/bases";
import type { ProfilPartiel } from "./profil";

type Ecran = "themes" | "formulaire";

const BASES = listerBases();

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("themes");
  // Les réponses du visiteur restent en mémoire de la page : ni envoyées, ni stockées.
  const [profil, setProfil] = useState<ProfilPartiel>({});
  const [baseId, setBaseId] = useState<string>(() => baseInitiale(BASES).id);
  const base = chargerBase(baseId);

  function choisirBase(id: string): void {
    retenirBase(id);
    setBaseId(id);
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

  if (ecran === "formulaire") {
    return (
      <ProfilForm
        profilInitial={profil}
        onValider={(p) => {
          setProfil(p);
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
      <PageThemes base={base} profil={profil} onRenseigner={() => setEcran("formulaire")} onEffacer={() => setProfil({})} />
    </>
  );
}
