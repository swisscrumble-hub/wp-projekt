"use client";

import { useState } from "react";
import { erwartungswertPruefung, horizontalanalyse, vertikalanalyse, type ErwartungsErgebnis } from "@/lib/pruefung/analytik";
import { tabelleOhneKopf, zahlIn } from "@/lib/tabelle";
import { Daten, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, chf, prozent } from "@/components/ui";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler.");

function VergleichKarte() {
  const [daten, setDaten] = useState("");
  const [rel, setRel] = useState("10");
  const [abs, setAbs] = useState("10000");
  const [basis, setBasis] = useState("");
  const [basisVj, setBasisVj] = useState("");
  const [h, setH] = useState<ReturnType<typeof horizontalanalyse> | null>(null);
  const [v, setV] = useState<ReturnType<typeof vertikalanalyse> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function rechnen() {
    try {
      setFehler(null);
      const z = tabelleOhneKopf(daten, 3, [1, 2]).map((r, i) => ({ konto: r[0]!, aktuell: zahlIn(r, 1, i + 1), vorjahr: zahlIn(r, 2, i + 1) }));
      setH(horizontalanalyse(z, { relativ: Number(rel) / 100, absolut: Number(abs.replace(/['’\s]/g, "")) }));
      setV(basis.trim() ? vertikalanalyse(z, { aktuell: Number(basis.replace(/['’\s]/g, "")), vorjahr: basisVj.trim() ? Number(basisVj.replace(/['’\s]/g, "")) : undefined }) : null);
    } catch (e) {
      setH(null);
      setV(null);
      setFehler(msg(e));
    }
  }

  return (
    <Karte titel="Vorjahresvergleich und Strukturanalyse" norm="Horizontal-/Vertikalanalyse, PS 520 (ISA 520)">
      <Daten label="Konten" hilfe="Konto;Aktuell;Vorjahr (Kopfzeile erlaubt)" value={daten} onChange={(e) => setDaten(e.target.value)} placeholder={"Umsatz;1'200'000;1'000'000\nPersonalaufwand;450'000;430'000"} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Feld label="Schwelle relativ (%)" inputMode="decimal" value={rel} onChange={(e) => setRel(e.target.value)} />
        <Feld label="Schwelle absolut" inputMode="decimal" value={abs} onChange={(e) => setAbs(e.target.value)} hilfe="Orientiert an der Wesentlichkeit." />
        <Feld label="Basis aktuell (optional)" inputMode="decimal" value={basis} onChange={(e) => setBasis(e.target.value)} hilfe="Bilanzsumme bzw. Umsatz" />
        <Feld label="Basis Vorjahr (optional)" inputMode="decimal" value={basisVj} onChange={(e) => setBasisVj(e.target.value)} />
      </div>
      <Knopf onClick={rechnen}>Analysieren</Knopf>
      <Fehler text={fehler} />
      {h && (
        <div className="space-y-3">
          <Tabelle
            kopf={["Konto", "Aktuell", "Vorjahr", "Abweichung", "%", "Hinweis"]}
            zeilen={h.ergebnisse.map((e) => [e.konto, chf(e.aktuell), chf(e.vorjahr), chf(e.abweichung), prozent(e.abweichungProzent), e.auffaellig ? `Auffällig: ${e.grund}` : ""])}
          />
          <Hinweise liste={h.hinweise} />
        </div>
      )}
      {v && (
        <Tabelle
          kopf={["Konto", "Anteil", "Anteil Vorjahr", "Veränderung (Prozentpunkte)"]}
          zeilen={v.ergebnisse.map((e) => [e.konto, prozent(e.anteilProzent), prozent(e.anteilVorjahrProzent), e.veraenderungProzentpunkte == null ? "–" : e.veraenderungProzentpunkte.toLocaleString("de-CH", { maximumFractionDigits: 1 })])}
        />
      )}
    </Karte>
  );
}

function ErwartungKarte() {
  const [daten, setDaten] = useState("");
  const [x, setX] = useState("");
  const [ist, setIst] = useState("");
  const [k, setK] = useState("2");
  const [r, setR] = useState<ErwartungsErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function rechnen() {
    try {
      setFehler(null);
      const historie = tabelleOhneKopf(daten, 2, [0, 1]).map((z, i) => ({ x: zahlIn(z, 0, i + 1), y: zahlIn(z, 1, i + 1) }));
      setR(erwartungswertPruefung({ historie, xAktuell: Number(x.replace(/['’\s]/g, "")), istWert: Number(ist.replace(/['’\s]/g, "")), k: Number(k) }));
    } catch (e) {
      setR(null);
      setFehler(msg(e));
    }
  }

  return (
    <Karte titel="Erwartungswert per Regression" norm="z. B. Energiekosten gegen Produktionsvolumen, PS 520">
      <Daten label="Historische Paare" hilfe="X;Y je Zeile (z. B. Produktionsmenge;Energiekosten), mindestens 6 Paare." value={daten} onChange={(e) => setDaten(e.target.value)} rows={5} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label="X aktuell" inputMode="decimal" value={x} onChange={(e) => setX(e.target.value)} />
        <Feld label="Ist-Wert (Y)" inputMode="decimal" value={ist} onChange={(e) => setIst(e.target.value)} />
        <Feld label="Toleranz k" inputMode="decimal" value={k} onChange={(e) => setK(e.target.value)} hilfe="k × Standardfehler der Prognose" />
      </div>
      <Knopf onClick={rechnen}>Erwartungswert berechnen</Knopf>
      <Fehler text={fehler} />
      {r && !r.ok && <Fehler text={r.grund} />}
      {r && r.ok && (
        <div className="space-y-3">
          <Tabelle
            kopf={["Erwartet", "Untere Grenze", "Obere Grenze", "Ist", "Abweichung", "R²"]}
            zeilen={[[chf(r.erwartet), chf(r.untereGrenze), chf(r.obereGrenze), chf(r.ist), chf(r.abweichung), r.r2.toFixed(3)]]}
          />
          <p className="text-sm font-medium text-slate-800">{r.ausserhalb ? "Der Ist-Wert liegt ausserhalb des Toleranzbands: weiter abklären." : "Der Ist-Wert liegt innerhalb des Toleranzbands. Das ist kein Nachweis der Richtigkeit."}</p>
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

export default function AnalytikSeite() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytische Prüfungshandlungen</h1>
      <VergleichKarte />
      <ErwartungKarte />
    </div>
  );
}
