"use client";

import { useState } from "react";
import { hochrechnungHwp } from "@/lib/pruefung/umfang";
import { musAuswertung, type MusAuswertung } from "@/lib/pruefung/stichprobe";
import { tabelleOhneKopf, zahlIn } from "@/lib/tabelle";
import { Daten, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, chf, num } from "@/components/ui";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler.");

/**
 * Auswertung der Einzelfallprüfung. Monetär (MUS): obere Fehlergrenze nach Stringer. Zufällig/systematisch: Verhältnis-Hochrechnung
 * nach HWP Rz. 792 (Anomalien werden nicht hochgerechnet).
 */
export default function EinzelfallAuswertung({
  methode,
  intervall,
  konfidenz,
  toleranz,
  grundgesamtheitWert,
  stichprobeWert,
}: {
  methode: "monetaer" | "zufaellig" | "systematisch";
  intervall?: number;
  konfidenz: number;
  toleranz: number;
  grundgesamtheitWert: number;
  stichprobeWert: number;
}) {
  const [daten, setDaten] = useState("");
  const [fehlerSumme, setFehlerSumme] = useState("");
  const [anomalien, setAnomalien] = useState("0");
  const [mus, setMus] = useState<MusAuswertung | null>(null);
  const [hr, setHr] = useState<ReturnType<typeof hochrechnungHwp> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function auswerten() {
    try {
      setFehler(null);
      if (methode === "monetaer") {
        const liste = daten.trim() ? tabelleOhneKopf(daten, 3, [1, 2]).map((z, i) => ({ id: z[0]!, buchwert: zahlIn(z, 1, i + 1), gepruefterWert: zahlIn(z, 2, i + 1) })) : [];
        setMus(musAuswertung({ intervall: intervall ?? 0, konfidenz, toleranz, fehler: liste }));
        setHr(null);
      } else {
        setHr(hochrechnungHwp({ grundgesamtheitWert, stichprobeWert, festgestellteFehler: num(fehlerSumme || "0"), anomalien: num(anomalien || "0") }));
        setMus(null);
      }
    } catch (e) {
      setMus(null);
      setHr(null);
      setFehler(msg(e));
    }
  }

  return (
    <Karte titel={methode === "monetaer" ? "Auswertung: obere Fehlergrenze (MUS)" : "Auswertung: Hochrechnung falscher Darstellungen"} norm={methode === "monetaer" ? "Stringer-Grenze, PS 530; HWP OR 2024, Teil III Rz. 792" : "HWP OR 2024, Teil III Rz. 792–794"}>
      {methode === "monetaer" ? (
        <Daten label="Geprüfte Elemente mit Abweichung" hilfe="ID;Buchwert;Geprüfter Wert je Zeile. Leer lassen, wenn keine Abweichung festgestellt wurde. Elemente ab Intervall gelten als sicher ausgewählt und werden nicht hochgerechnet." value={daten} onChange={(e) => setDaten(e.target.value)} rows={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Festgestellte falsche Darstellungen (Summe)" inputMode="decimal" value={fehlerSumme} onChange={(e) => setFehlerSumme(e.target.value)} />
          <Feld label="Davon Anomalien" inputMode="decimal" value={anomalien} onChange={(e) => setAnomalien(e.target.value)} hilfe="Nur, wenn belegt ist, dass sie nicht repräsentativ sind." />
        </div>
      )}
      <Knopf onClick={auswerten}>Auswerten</Knopf>
      <Fehler text={fehler} />
      {mus && (
        <div className="space-y-3">
          <Tabelle
            kopf={["Position", "Betrag"]}
            zeilen={[
              ["Basispräzision", chf(mus.basisPraezision)],
              ["Projizierte Fehlaussage", chf(mus.projizierteFehlaussage)],
              ["Zuschlag Folgerisiko", chf(mus.zuschlagFolgerisiko)],
              ["Bekannte Fehlaussage (sichere Elemente)", chf(mus.bekannteFehlaussageSichereFaelle)],
              ["Obere Fehlergrenze", chf(mus.obereFehlergrenze)],
              ["Tolerierbare falsche Darstellung", chf(mus.toleranz)],
            ]}
          />
          <p className="text-sm font-medium text-slate-800">{mus.vergleich}</p>
          <Hinweise liste={mus.hinweise} />
        </div>
      )}
      {hr && (
        <div className="space-y-3">
          <Tabelle
            kopf={["Position", "Wert"]}
            zeilen={[
              ["Grundgesamtheit", chf(grundgesamtheitWert)],
              ["Stichprobenwert", chf(stichprobeWert)],
              ["Fehleranteil in der Stichprobe", `${hr.fehlerAnteilProzent.toFixed(2)} %`],
              ["Hochgerechnete falsche Darstellung", chf(hr.hochgerechnet)],
              ["Anomalien", chf(hr.anomalien)],
              ["Total", chf(hr.total)],
            ]}
          />
          <Hinweise liste={hr.hinweise} />
        </div>
      )}
    </Karte>
  );
}
