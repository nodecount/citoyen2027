import { useState } from "react";
import Accueil from "./ui/Accueil";
import ProfilForm from "./ui/ProfilForm";
import Resultats from "./ui/Resultats";
import Monitoring from "./ui/Monitoring";
import type { Profil } from "./types";

type Ecran = "accueil" | "formulaire" | "resultats";

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [profil, setProfil] = useState<Profil | null>(null);

  if (window.location.pathname === "/monitoring") {
    return <Monitoring />;
  }

  if (ecran === "accueil") {
    return <Accueil onCommencer={() => setEcran("formulaire")} />;
  }

  if (ecran === "formulaire") {
    return (
      <ProfilForm
        onValider={(p) => {
          setProfil(p);
          setEcran("resultats");
        }}
      />
    );
  }

  if (profil) {
    return <Resultats profil={profil} />;
  }

  return <Accueil onCommencer={() => setEcran("formulaire")} />;
}
