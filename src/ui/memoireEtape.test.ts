import { describe, expect, it } from "vitest";
import { etapeDeDepart, lireEtape } from "./memoireEtape";

const arrivee = (memorisee: Parameters<typeof etapeDeDepart>[0]["memorisee"], aDesReponses: boolean, aDesConvictions: boolean) => etapeDeDepart({ memorisee, aDesReponses, aDesConvictions });

describe("étape d'arrivée dans le simulateur", () => {
  it("l'étape où le visiteur s'était arrêté prime, quelle qu'elle soit", () => {
    expect(arrivee("situation", true, true)).toBe("situation");
    expect(arrivee("themes", false, false)).toBe("themes");
    expect(arrivee("convictions", true, false)).toBe("convictions");
    expect(arrivee("resultat", true, true)).toBe("resultat");
  });
  it("sans étape mémorisée : 1 par défaut, 2 avec des réponses gardées, 3 avec des convictions gardées", () => {
    expect(arrivee(null, false, false)).toBe("situation");
    expect(arrivee(null, true, false)).toBe("themes");
    expect(arrivee(null, true, true)).toBe("convictions");
    expect(arrivee(null, false, true)).toBe("convictions");
  });
  it("jamais directement sur le résultat quand il n'est pas atteignable (réponses effacées depuis)", () => {
    expect(arrivee("resultat", false, false)).toBe("situation");
    expect(arrivee("resultat", false, true)).toBe("convictions");
  });
  it("sans stockage disponible (rendu serveur, navigation privée) : aucune étape mémorisée, sans erreur", () => {
    expect(lireEtape()).toBeNull();
  });
});
