"use client";

import { useState } from "react";
import { attributAuswertung } from "@/lib/pruefung/stichprobe";
import { Fehler, Feld, Hinweise, Karte, Knopf } from "@/components/ui";

/**
 * Auswertung der Kontrollprüfung: Bei Funktionsprüfungen ist der Abweichungsgrad der Stichprobe zugleich der hochgerechnete Grad
 * (Rz. 794); ein unerwartet hoher Grad kann das beurteilte Risiko erhöhen (Rz. 796).
 */
export default function KontrollAuswertung({ n }: { n: number }) {
  const [abw, setAbw] = useState("0");
  const [rate, setRate] = useState("0.05");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [r, setR] = useState<ReturnType<typeof attributAuswertung> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte titel="Auswertung der Kontrollprüfung" norm="HWP OR 2024, Teil III Rz. 794–796">
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label="Festgestellte Abweichungen" inputMode="numeric" value={abw} onChange={(e) => setAbw(e.target.value)} hilfe={`von ${n} geprüften Vorgängen`} />
        <Feld label="Tolerierbare Abweichungsrate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} hilfe="0.05 = 5 %" />
        <Feld label="Konfidenz" inputMode="decimal" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)} />
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            setR(attributAuswertung({ n, abweichungen: Number(abw), konfidenz: Number(konfidenz), tolerierbareRate: Number(rate) }));
          } catch (e) {
            setR(null);
            setFehler(e instanceof Error ? e.message : "Ungültige Eingabe.");
          }
        }}
      >
        Auswerten
      </Knopf>
      <Fehler text={fehler} />
      {r && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800">
            Abweichungsgrad in der Stichprobe <strong>{(r.stichprobenrate * 100).toFixed(2)} %</strong> (gilt als Grad der Grundgesamtheit, Rz. 794); statistische obere Grenze {(r.obereGrenze * 100).toFixed(2)} %. {r.vergleich}
          </p>
          <Hinweise
            liste={[
              ...r.hinweise,
              ...(Number(abw) > 0 ? ["Abweichungen festgestellt: Ursache und Systematik klären, die Stichprobe erweitern und die Risikobeurteilung überprüfen (Rz. 796). Bei Feststellungen ist zu klären, ob es sich um einen Einzelfall oder eine systematische Feststellung handelt."] : []),
            ]}
          />
        </div>
      )}
    </Karte>
  );
}
