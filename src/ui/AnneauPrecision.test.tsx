import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnneauPrecision } from "./AnneauPrecision";

const disque = (html: string) => html.slice(html.indexOf('class="anneau-disque"'));

describe("AnneauPrecision", () => {
  it("non révélé : barre de progression annoncée et pourcentage dans le disque", () => {
    const html = renderToStaticMarkup(<AnneauPrecision pourcent={17} revele={false} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="17"');
    expect(disque(html)).toContain("17 %");
    expect(disque(html)).toContain("de précision");
  });

  it("révélé : le portrait remplace le pourcentage, l'anneau reste", () => {
    const html = renderToStaticMarkup(
      <AnneauPrecision pourcent={85} revele={true}>
        <b>AB</b>
      </AnneauPrecision>,
    );
    expect(html).toContain('aria-valuenow="85"');
    expect(disque(html)).toContain("<b>AB</b>");
    expect(disque(html)).not.toContain("%");
  });

  it("le disque est uni : aucune bordure en pointillés dans la feuille de style", () => {
    expect(readFileSync("src/ui/deuxZones.css", "utf-8")).not.toContain("dashed");
  });
});
