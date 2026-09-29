"use client";

import { useState } from "react";
import { Feld, chf, num } from "@/components/ui";

/** Vergleich der Summe der importierten Posten mit dem Saldo laut Hauptbuch/Bilanz (Vollständigkeit der Grundgesamtheit). */
export default function Abstimmung({ summe, label = "Saldo laut Hauptbuch / Bilanz" }: { summe: number; label?: string }) {
  const [wert, setWert] = useState("");
  const vergleich = num(wert);
  const differenz = Number.isFinite(vergleich) ? Math.round((summe - vergleich) * 100) / 100 : null;
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <Feld label={`${label} (optional)`} inputMode="decimal" value={wert} onChange={(e) => setWert(e.target.value)} hilfe={`Summe der importierten Posten: ${chf(summe)}`} />
      {differenz !== null && (
        <p className={`text-sm font-medium ${differenz === 0 ? "text-emerald-800" : "text-red-800"}`}>
          {differenz === 0 ? "Die Summe stimmt mit dem Vergleichswert überein." : `Differenz ${chf(differenz)}: Die Grundgesamtheit ist nicht abgestimmt. Ursache klären, bevor die Stichprobe verwendet wird (PS 530).`}
        </p>
      )}
    </div>
  );
}
