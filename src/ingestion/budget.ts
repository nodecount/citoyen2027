// Plafond de coût DUR : estimation avant chaque appel, cumul réel après. Le premier essai réel a coûté
// ~15 € pour un seul thème sans que rien ne l'arrête ; ici, un appel qui ferait dépasser le budget n'est
// jamais envoyé.

export interface Tarifs {
  // USD par million de jetons.
  entree: number;
  sortie: number;
  ecritureCache: number;
  lectureCache: number;
}

// HYPOTHÈSE : tarifs de la famille Sonnet (3 $ entrée / 15 $ sortie, écriture de cache ×1,25, lecture ×0,1).
// À CONFIRMER avec la grille de la console Anthropic avant de s'y fier : le plafond n'est aussi juste que ces chiffres.
export const TARIFS_PAR_MODELE: Record<string, Tarifs> = {
  "claude-sonnet-5": { entree: 3, sortie: 15, ecritureCache: 3.75, lectureCache: 0.3 },
};

// HYPOTHÈSE de change, à ajuster (0,9 € pour 1 $ environ).
export const EUR_PAR_USD = 0.9;

export interface UsageMinimal {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ProfilAppel {
  jetonsCorpus: number; // la partie mise en cache
  jetonsAutres: number; // instructions et question, non mises en cache
  jetonsSortieMax: number;
  cache: "ecriture" | "lecture" | "aucun";
}

// Coût attendu au PIRE pour la sortie (max_tokens atteint) : un plafond doit être prudent.
export function estimerAppelUsd(tarifs: Tarifs, appel: ProfilAppel): number {
  const tarifCorpus = appel.cache === "ecriture" ? tarifs.ecritureCache : appel.cache === "lecture" ? tarifs.lectureCache : tarifs.entree;
  return (appel.jetonsCorpus * tarifCorpus + appel.jetonsAutres * tarifs.entree + appel.jetonsSortieMax * tarifs.sortie) / 1e6;
}

// Note : dans l'API, input_tokens exclut les jetons de cache ; ils sont comptés à part.
export function coutReelUsd(tarifs: Tarifs, usage: UsageMinimal | undefined): number {
  if (!usage) return 0;
  return (
    ((usage.input_tokens ?? 0) * tarifs.entree +
      (usage.output_tokens ?? 0) * tarifs.sortie +
      (usage.cache_creation_input_tokens ?? 0) * tarifs.ecritureCache +
      (usage.cache_read_input_tokens ?? 0) * tarifs.lectureCache) /
    1e6
  );
}

export class BudgetDepasse extends Error {}

const DUREE_CACHE_MS = 4.5 * 60_000; // durée de vie du cache de prompt : 5 minutes, avec une marge

export class Budget {
  depenseEur = 0;
  private dernierUsageCacheMs: number | undefined;

  constructor(
    readonly plafondEur: number,
    readonly tarifs: Tarifs,
    readonly eurParUsd: number = EUR_PAR_USD,
  ) {}

  get restantEur(): number {
    return this.plafondEur - this.depenseEur;
  }

  enEuros(usd: number): number {
    return usd * this.eurParUsd;
  }

  // À appeler AVANT chaque appel : lève si le coût estimé ferait dépasser le plafond.
  verifierAvant(estimationUsd: number, contexte: string): void {
    const estimationEur = this.enEuros(estimationUsd);
    if (this.depenseEur + estimationEur > this.plafondEur) {
      throw new BudgetDepasse(
        `Budget dépassé avant l'appel « ${contexte} » : dépensé ${this.depenseEur.toFixed(2)} €, appel estimé ${estimationEur.toFixed(2)} €, plafond ${this.plafondEur.toFixed(2)} €. Rien n'a été envoyé.`,
      );
    }
  }

  // Le corpus est-il encore en cache ? Sert à estimer le prochain appel (lecture ≈ 10 fois moins chère).
  modeCache(maintenantMs: number = Date.now()): "ecriture" | "lecture" {
    return this.dernierUsageCacheMs !== undefined && maintenantMs - this.dernierUsageCacheMs < DUREE_CACHE_MS ? "lecture" : "ecriture";
  }

  // À appeler APRÈS chaque appel, avec l'usage réel ; renvoie le coût de l'appel en euros.
  enregistrer(usage: UsageMinimal | undefined, maintenantMs: number = Date.now()): number {
    const eur = this.enEuros(coutReelUsd(this.tarifs, usage));
    this.depenseEur += eur;
    if ((usage?.cache_creation_input_tokens ?? 0) > 0 || (usage?.cache_read_input_tokens ?? 0) > 0) this.dernierUsageCacheMs = maintenantMs;
    return eur;
  }
}
