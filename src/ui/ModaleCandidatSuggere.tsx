import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DetailCritere } from "../engine/candidatIdeal";
import { enPortail, JaugeNote, PoursContres, RondScore, type LigneClassement } from "./CardCandidatIdeal";
import { Pastille } from "./Pastille";
import { bordAffichable, partiAffichable } from "./parti";
import { PiedModale } from "./PiedModale";

type Critere = "situation" | "convictions";

const borne = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

const LIBELLES: Record<Critere, { onglet: string; unite: "thèmes" | "sujets"; de: string }> = {
  situation: { onglet: "Ma situation", unite: "thèmes", de: "votre situation" },
  convictions: { onglet: "Mes convictions", unite: "sujets", de: "vos convictions" },
};

// Les mêmes phrases que la fenêtre de détail d'un candidat du top : combien de mesures vont dans le sens du visiteur, et à combien
// de mesures correspond le 100 quand la note est plus basse. Rien de plus.
function TexteCritere({ critere, d }: { critere: Critere; d: DetailCritere }) {
  const total = d.ameliorants + d.degradants;
  if (total === 0) return null;
  const note = borne(d.noteBrute);
  return (
    <p className="hint">
      <strong>
        {d.ameliorants}/{total}
      </strong>{" "}
      des mesures {critere === "convictions" ? "vont dans le sens de vos convictions" : "vous avantagent"}.
      {note < 100 && (
        <span>
          {" "}
          Un score de 100 % correspond à {d.reference} mesures, le maximum chez un candidat : {Math.max(0, d.score)} sur {d.reference}, soit un score de {note} %.
        </span>
      )}
    </p>
  );
}
// Détail du candidat suggéré : ses deux notes (situation, convictions), leur moyenne, et pour chaque critère les mesures dans le sens
// du visiteur et à l'opposé. Sert à refaire la moyenne soi-même. Ouverte seulement une fois la suggestion révélée.
// `lignes` : le candidat de la première place, ou tous ceux à égalité (un onglet chacun).
export function ModaleCandidatSuggere({ lignes, onFermer }: { lignes: LigneClassement[]; onFermer: () => void }) {
  const fermer = useRef<HTMLButtonElement>(null);
  const [lettre, setLettre] = useState(lignes[0]?.lettre);
  const [critereChoisi, setCritere] = useState<Critere | null>(null);
  const ligne = lignes.find((l) => l.lettre === lettre) ?? lignes[0];
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    fermer.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("keydown", surTouche);
      avant?.focus?.();
    };
  }, [onFermer]);
  const identite = ligne?.identite;
  if (!ligne || !identite) return null;

  const criteres = (["situation", "convictions"] as const).flatMap((c) => (ligne.criteres?.[c] ? [{ id: c, d: ligne.criteres[c]! }] : []));
  const ouvert = criteres.find((c) => c.id === critereChoisi) ?? criteres[0];
  const plusieurs = lignes.length > 1;

  return enPortail(
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale modale--ideal" role="dialog" aria-modal="true" aria-labelledby="modale-suggere-titre">
        <div className="modale-entete">
          {plusieurs ? (
            <h2 id="modale-suggere-titre">Candidats à égalité</h2>
          ) : (
            <h2 id="modale-suggere-titre" className="ideal-modale-titre">
              <Pastille slug={identite.slug} nom={identite.nom} />
              <span>
                {identite.nom}
                {partiAffichable(identite.parti) && <span className="detail-parti">{partiAffichable(identite.parti)}</span>}
                {bordAffichable(identite.slug, identite.parti) && <span className="detail-parti detail-bord">{bordAffichable(identite.slug, identite.parti)}</span>}
              </span>
            </h2>
          )}
          <RondScore note={ligne.note ?? 0} />
          <button type="button" className="bouton-icone" ref={fermer} onClick={onFermer} aria-label="Fermer le détail du candidat suggéré">
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        {plusieurs && (
          <div className="ideal-egales" role="tablist" aria-label="Candidats à égalité">
            {lignes.map((l) =>
              l.identite ? (
                <button key={l.lettre} type="button" role="tab" className="ideal-egale" aria-selected={l.lettre === ligne.lettre} onClick={() => setLettre(l.lettre)}>
                  <Pastille slug={l.identite.slug} nom={l.identite.nom} />
                  {l.identite.nom}
                  {partiAffichable(l.identite.parti) && <span className="detail-parti ideal-egale-parti">{partiAffichable(l.identite.parti)}</span>}
                  {bordAffichable(l.identite.slug, l.identite.parti) && <span className="detail-parti ideal-egale-parti detail-bord">{bordAffichable(l.identite.slug, l.identite.parti)}</span>}
                </button>
              ) : null,
            )}
          </div>
        )}
        <div className="ideal-totaux">
          {criteres.map(({ id, d }) => (
            <div key={id} className="ideal-total">
              <span className="ideal-total-libelle">{LIBELLES[id].onglet}</span>
              <JaugeNote note={borne(d.noteBrute)} />
            </div>
          ))}
        </div>
        <div className="ideal-onglets" role="tablist" aria-label="Critères">
          {criteres.map(({ id, d }) => (
            <button key={id} type="button" role="tab" id={`onglet-suggere-${id}`} aria-selected={ouvert?.id === id} aria-controls="panneau-suggere" className="ideal-onglet" onClick={() => setCritere(id)}>
              {LIBELLES[id].onglet} <span className="ideal-onglet-nombre">{d.ameliorants + d.degradants}</span>
            </button>
          ))}
        </div>
        <div id="panneau-suggere" className="ideal-modale-corps" role="tabpanel" aria-labelledby={ouvert ? `onglet-suggere-${ouvert.id}` : undefined}>
          {ouvert && (
            <>
              <TexteCritere critere={ouvert.id} d={ouvert.d} />
              {ouvert.d.pour.length === 0 && ouvert.d.contre.length === 0 ? (
                <p className="hint">Aucune mesure ne vous concerne chez ce candidat sur ce critère.</p>
              ) : (
                <PoursContres key={`${ouvert.id}-${ligne.lettre}`} pour={ouvert.d.pour} contre={ouvert.d.contre} unite={LIBELLES[ouvert.id].unite} parMesureImpose toutAfficher sansTotal />
              )}
            </>
          )}
        </div>
        <PiedModale onFermer={onFermer} />
      </div>
    </div>,
  );
}
