import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import { ELECTORATS } from "../simulation/electorats";
import PageTestsSituations from "./PageTestsSituations";

describe("PageTestsSituations", () => {
  it.each(["officielle", "agregateurs"])("base %s : chaque situation type, ses résultats et son verdict", (id) => {
    const html = renderToStaticMarkup(<PageTestsSituations base={chargerBase(id)} />);
    expect(html).toContain(chargerBase(id).info.libelle);
    for (const e of ELECTORATS) expect(html).toContain(e.nom.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    expect(html.match(/>Selon la situation</g)).toHaveLength(ELECTORATS.length);
    expect(html.match(/>Selon les convictions</g)).toHaveLength(ELECTORATS.length);
    expect(html.match(/<legend>Verdict<\/legend>/g)).toHaveLength(ELECTORATS.length);
  });
});
