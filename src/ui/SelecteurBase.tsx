import type { InfoBase } from "../data/bases";

interface SelecteurBaseProps {
  bases: InfoBase[];
  actif: string;
  onChoisir: (id: string) => void;
}

// Une seule base : rien à choisir, on n'affiche rien. Sinon le citoyen voit toujours quelle base alimente la page.
export function SelecteurBase({ bases, actif, onChoisir }: SelecteurBaseProps) {
  if (bases.length < 2) return null;
  const courante = bases.find((b) => b.id === actif);
  return (
    <div className="selecteur-base">
      <label>
        Base de connaissances{" "}
        <select value={actif} onChange={(e) => onChoisir(e.target.value)}>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.libelle}
            </option>
          ))}
        </select>
      </label>
      {courante && <p className="hint">{courante.description}</p>}
    </div>
  );
}
