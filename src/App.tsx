import { useState } from "react";
import Accueil from "./ui/Accueil";
import ProfilForm from "./ui/ProfilForm";
import Resultats from "./ui/Resultats";
import Monitoring from "./ui/Monitoring";
import { SelecteurBase } from "./ui/SelecteurBase";
import { baseInitiale, retenirBase } from "./ui/choixBase";
import { chargerBase, listerBases } from "./data/bases";
import type { Profil } from "./types";

type Ecran = "accueil" | "formulaire" | "resultats";

const BASES = listerBases();

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [profil, setProfil] = useState<Profil | null>(null);
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
      <>
        {selecteur}
        <ProfilForm
          onValider={(p) => {
            setProfil(p);
            setEcran("resultats");
          }}
        />
      </>
    );
  }

  if (ecran === "resultats" && profil) {
    return (
      <>
        {selecteur}
        <Resultats profil={profil} base={base} />
      </>
    );
  }

  return (
    <>
      {selecteur}
      <Accueil base={base} onCommencer={() => setEcran("formulaire")} />
    </>
  );
}
