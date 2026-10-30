import { describe, expect, it } from "vitest";
import { messageRevelation, progression, sourceDeLaSuggestion } from "./progression";

describe("progression", () => {
  it("additionne les deux côtés et arrondit à l'entier", () => {
    expect(progression({ repondues: 9, total: 18 }, { repondues: 0, total: 35 }).pourcent).toBe(17);
    expect(progression({ repondues: 18, total: 18 }, { repondues: 27, total: 35 }).pourcent).toBe(85);
  });
  it("donne 0 sans total, jamais NaN", () => {
    expect(progression({ repondues: 0, total: 0 }, { repondues: 0, total: 0 })).toEqual({ repondues: 0, total: 0, pourcent: 0 });
  });
  it("n'arrive à 100 que quand tout est répondu", () => {
    expect(progression({ repondues: 52, total: 52 }, { repondues: 0, total: 1 }).pourcent).toBe(98);
    expect(progression({ repondues: 199, total: 200 }, { repondues: 0, total: 0 }).pourcent).toBe(99);
    expect(progression({ repondues: 18, total: 18 }, { repondues: 35, total: 35 }).pourcent).toBe(100);
  });
});

describe("sourceDeLaSuggestion", () => {
  it("dit d'où vient la suggestion", () => {
    expect(sourceDeLaSuggestion({ repondues: 1, total: 18 }, { repondues: 0, total: 35 })).toBe("situation");
    expect(sourceDeLaSuggestion({ repondues: 0, total: 18 }, { repondues: 2, total: 35 })).toBe("convictions");
    expect(sourceDeLaSuggestion({ repondues: 1, total: 18 }, { repondues: 2, total: 35 })).toBe("les deux");
    expect(sourceDeLaSuggestion({ repondues: 0, total: 18 }, { repondues: 0, total: 35 })).toBeNull();
  });
});

describe("messageRevelation", () => {
  it("rappelle la précision et le côté répondu", () => {
    const m = messageRevelation({ repondues: 9, total: 18 }, { repondues: 0, total: 35 });
    expect(m).toContain("17 % de précision");
    expect(m).toContain("9 réponses sur 53 questions");
    expect(m).toContain("côté situation seulement");
    expect(messageRevelation({ repondues: 9, total: 18 }, { repondues: 3, total: 35 })).toContain("situation et convictions");
  });
});
