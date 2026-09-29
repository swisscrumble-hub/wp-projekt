import type { Zelle } from "@/lib/import";
import { Auswahl } from "@/components/ui";

const KEINE = "-1";

export default function SpaltenWahl({ label, kopf, wert, onChange }: { label: string; kopf: Zelle[]; wert?: number; onChange: (i?: number) => void }) {
  return (
    <Auswahl label={label} value={wert === undefined ? KEINE : String(wert)} onChange={(e) => onChange(e.target.value === KEINE ? undefined : Number(e.target.value))}>
      <option value={KEINE}>– nicht verwenden –</option>
      {kopf.map((k, i) => (
        <option key={i} value={i}>
          {`${i + 1}: ${k == null || k === "" ? "(ohne Titel)" : String(k)}`}
        </option>
      ))}
    </Auswahl>
  );
}
