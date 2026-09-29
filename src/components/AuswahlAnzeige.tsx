"use client";

import { useState } from "react";
import { auswahlAlsCsv, type Importiert } from "@/lib/import";
import { Hinweise, Knopf, Tabelle, chf, kopiere, lade } from "@/components/ui";

/** Gezogene Elemente mit Angaben aus der Datei, CSV-Download und Dokumentationsnotiz. */
export default function AuswahlAnzeige({
  posten,
  ids,
  seed,
  methode,
  notiz,
  dateiname,
  hinweise = [],
  bemerkung,
  mitBetrag = true,
}: {
  posten: Importiert[];
  ids: string[];
  seed: number;
  methode: string;
  notiz: string;
  dateiname: string;
  hinweise?: string[];
  bemerkung?: Map<string, string>;
  mitBetrag?: boolean;
}) {
  const [kopiert, setKopiert] = useState<boolean | null>(null);
  const gewaehlt = new Set(ids);
  const details = posten.filter((p) => gewaehlt.has(p.id));
  const mitSeite = details.some((p) => p.seite);
  const kopf = ["Zeile", ...(mitSeite ? ["Seite"] : []), "ID", "Datum", "Konto", "Text", ...(mitBetrag ? ["Betrag"] : []), ...(bemerkung ? ["Prüfhinweis"] : [])];
  return (
    <div className="space-y-3">
      <Tabelle
        kopf={kopf}
        zeilen={details.map((p) => [p.excelZeile, ...(mitSeite ? [p.seite ?? ""] : []), p.id, p.datum ?? "", p.konto ?? "", p.text ?? "", ...(mitBetrag ? [chf(p.betrag)] : []), ...(bemerkung ? [bemerkung.get(p.id) ?? ""] : [])])}
      />
      <div className="flex flex-wrap gap-2">
        <Knopf onClick={() => lade(auswahlAlsCsv(posten, ids, { methode, seed }, bemerkung), dateiname)}>Auswahl als CSV herunterladen</Knopf>
        <Knopf
          onClick={async () => setKopiert(await kopiere(notiz))}
        >
          Dokumentationsnotiz kopieren
        </Knopf>
        {kopiert !== null && <span className="self-center text-sm text-slate-600">{kopiert ? "Kopiert." : "Kopieren nicht möglich, Text unten markieren."}</span>}
      </div>
      <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-800">{notiz}</pre>
      <Hinweise liste={hinweise} />
    </div>
  );
}
