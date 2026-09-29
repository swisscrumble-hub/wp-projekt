"use client";

import { useState } from "react";
import { attributAuswertung, attributStichprobenumfang, monetaereAuswahl, musAuswertung, musStichprobenumfang, systematischeAuswahl, zufallsauswahl, type AuswahlErgebnis, type MusAuswertung } from "@/lib/pruefung/stichprobe";
import { tabelleOhneKopf, zahlIn } from "@/lib/tabelle";
import { Auswahl, Daten, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, chf } from "@/components/ui";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler.");

function AuswahlKarte({ onIntervall }: { onIntervall: (i: number) => void }) {
  const [daten, setDaten] = useState("");
  const [methode, setMethode] = useState("monetaer");
  const [n, setN] = useState("25");
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)));
  const [ergebnis, setErgebnis] = useState<AuswahlErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function ziehen() {
    try {
      setFehler(null);
      const posten = tabelleOhneKopf(daten, 2, [1]).map((z, i) => ({ id: z[0]!, buchwert: zahlIn(z, 1, i + 1) }));
      const umfang = Number(n);
      const s = Number(seed);
      const r = methode === "zufaellig" ? zufallsauswahl(posten, umfang, s) : methode === "systematisch" ? systematischeAuswahl(posten, umfang, s) : monetaereAuswahl(posten, umfang, s);
      setErgebnis(r);
      if (r.methode === "monetaer" && r.intervall) onIntervall(r.intervall);
    } catch (e) {
      setErgebnis(null);
      setFehler(msg(e));
    }
  }

  return (
    <Karte titel="1. Stichprobe ziehen" norm="PS 530 (ISA 530)">
      <Daten label="Grundgesamtheit" hilfe="Eine Zeile pro Posten: ID;Buchwert (Kopfzeile erlaubt). Aus Excel einfügbar." value={daten} onChange={(e) => setDaten(e.target.value)} placeholder={"D-1001;12'500.00\nD-1002;830.50"} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Auswahl label="Methode" value={methode} onChange={(e) => setMethode(e.target.value)}>
          <option value="monetaer">Monetär (MUS)</option>
          <option value="zufaellig">Zufällig</option>
          <option value="systematisch">Systematisch</option>
        </Auswahl>
        <Feld label="Umfang n" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
        <Feld label="Seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} hilfe="Gleicher Seed = gleiche Auswahl. In die Dokumentation übernehmen." />
      </div>
      <Knopf onClick={ziehen}>Auswahl ziehen</Knopf>
      <Fehler text={fehler} />
      {ergebnis && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            {ergebnis.ausgewaehlt.length} von {ergebnis.grundgesamtheit.anzahl} Posten (Buchwert gesamt {chf(ergebnis.grundgesamtheit.wert)}), Seed {ergebnis.seed}
            {ergebnis.intervall !== undefined && <>, Intervall {chf(ergebnis.intervall)}</>}.
          </p>
          {ergebnis.sicherAusgewaehlt && ergebnis.sicherAusgewaehlt.length > 0 && <p className="text-sm text-slate-700">Sicher ausgewählt (≥ Intervall): {ergebnis.sicherAusgewaehlt.join(", ")}</p>}
          <p className="rounded-xl bg-slate-50 p-3 font-mono text-sm break-words">{ergebnis.ausgewaehlt.join("\n")}</p>
          <Hinweise liste={ergebnis.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function UmfangKarte() {
  const [buchwert, setBuchwert] = useState("");
  const [toleranz, setToleranz] = useState("");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [text, setText] = useState<{ n: number; rf: number; hinweise: string[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte titel="Stichprobenumfang (MUS)" norm="n = Buchwert × Zuverlässigkeitsfaktor / tolerierbare Fehlaussage">
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label="Gesamtbuchwert" inputMode="decimal" value={buchwert} onChange={(e) => setBuchwert(e.target.value)} />
        <Feld label="Tolerierbare Fehlaussage" inputMode="decimal" value={toleranz} onChange={(e) => setToleranz(e.target.value)} />
        <Feld label="Konfidenz" inputMode="decimal" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)} />
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            const r = musStichprobenumfang({ buchwert: Number(buchwert.replace(/['’\s]/g, "")), toleranz: Number(toleranz.replace(/['’\s]/g, "")), konfidenz: Number(konfidenz) });
            setText({ n: r.n, rf: r.zuverlaessigkeitsfaktor, hinweise: r.hinweise });
          } catch (e) {
            setText(null);
            setFehler(msg(e));
          }
        }}
      >
        Umfang berechnen
      </Knopf>
      <Fehler text={fehler} />
      {text && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800">
            Stichprobenumfang <strong>{text.n}</strong> (Zuverlässigkeitsfaktor {text.rf.toFixed(4)}).
          </p>
          <Hinweise liste={text.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function MusKarte({ intervallVorgabe }: { intervallVorgabe: string }) {
  const [intervall, setIntervall] = useState("");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [toleranz, setToleranz] = useState("");
  const [daten, setDaten] = useState("");
  const [r, setR] = useState<MusAuswertung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const wert = intervall || intervallVorgabe;

  function auswerten() {
    try {
      setFehler(null);
      const fehlerListe = daten.trim() ? tabelleOhneKopf(daten, 3, [1, 2]).map((z, i) => ({ id: z[0]!, buchwert: zahlIn(z, 1, i + 1), gepruefterWert: zahlIn(z, 2, i + 1) })) : [];
      setR(musAuswertung({ intervall: Number(wert), konfidenz: Number(konfidenz), toleranz: Number(toleranz.replace(/['’\s]/g, "")), fehler: fehlerListe }));
    } catch (e) {
      setR(null);
      setFehler(msg(e));
    }
  }

  return (
    <Karte titel="2. MUS auswerten (obere Fehlergrenze)" norm="Stringer-Grenze, PS 530">
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label="Intervall" inputMode="decimal" value={wert} onChange={(e) => setIntervall(e.target.value)} hilfe="Wird aus der Auswahl übernommen." />
        <Feld label="Konfidenz" inputMode="decimal" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)} />
        <Feld label="Tolerierbare Fehlaussage" inputMode="decimal" value={toleranz} onChange={(e) => setToleranz(e.target.value)} />
      </div>
      <Daten label="Geprüfte Posten mit Abweichung" hilfe="ID;Buchwert;Geprüfter Wert. Leer lassen, wenn keine Fehler gefunden wurden." value={daten} onChange={(e) => setDaten(e.target.value)} rows={4} />
      <Knopf onClick={auswerten}>Auswerten</Knopf>
      <Fehler text={fehler} />
      {r && (
        <div className="space-y-3">
          <Tabelle
            kopf={["Position", "Betrag"]}
            zeilen={[
              ["Basispräzision", chf(r.basisPraezision)],
              ["Projizierte Fehlaussage", chf(r.projizierteFehlaussage)],
              ["Zuschlag Folgerisiko", chf(r.zuschlagFolgerisiko)],
              ["Bekannte Fehlaussage (sichere Posten)", chf(r.bekannteFehlaussageSichereFaelle)],
              ["Obere Fehlergrenze", chf(r.obereFehlergrenze)],
              ["Tolerierbare Fehlaussage", chf(r.toleranz)],
            ]}
          />
          <p className="text-sm font-medium text-slate-800">{r.vergleich}</p>
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function AttributKarte() {
  const [rate, setRate] = useState("0.05");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [erwartet, setErwartet] = useState("0");
  const [n, setN] = useState("");
  const [abw, setAbw] = useState("0");
  const [umfang, setUmfang] = useState<number | null>(null);
  const [aus, setAus] = useState<ReturnType<typeof attributAuswertung> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte titel="Kontrolltest (Attributprüfung)" norm="Abweichungsrate, PS 530">
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label="Tolerierbare Rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} hilfe="0.05 = 5 %" />
        <Feld label="Konfidenz" inputMode="decimal" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)} />
        <Feld label="Erwartete Abweichungen" inputMode="numeric" value={erwartet} onChange={(e) => setErwartet(e.target.value)} />
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            setUmfang(attributStichprobenumfang({ tolerierbareRate: Number(rate), konfidenz: Number(konfidenz), erwarteteAbweichungen: Number(erwartet) }).n);
          } catch (e) {
            setUmfang(null);
            setFehler(msg(e));
          }
        }}
      >
        Umfang berechnen
      </Knopf>
      {umfang !== null && <p className="text-sm text-slate-800">Stichprobenumfang: <strong>{umfang}</strong></p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Geprüfte Fälle" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
        <Feld label="Festgestellte Abweichungen" inputMode="numeric" value={abw} onChange={(e) => setAbw(e.target.value)} />
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            setAus(attributAuswertung({ n: Number(n), abweichungen: Number(abw), konfidenz: Number(konfidenz), tolerierbareRate: Number(rate) }));
          } catch (e) {
            setAus(null);
            setFehler(msg(e));
          }
        }}
      >
        Auswerten
      </Knopf>
      <Fehler text={fehler} />
      {aus && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800">
            Stichprobenrate {(aus.stichprobenrate * 100).toFixed(2)} %, obere Grenze {(aus.obereGrenze * 100).toFixed(2)} %. {aus.vergleich}
          </p>
          <Hinweise liste={aus.hinweise} />
        </div>
      )}
    </Karte>
  );
}

export default function StichprobenSeite() {
  const [intervall, setIntervall] = useState("");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Stichproben</h1>
      <UmfangKarte />
      <AuswahlKarte onIntervall={(i) => setIntervall(String(i))} />
      <MusKarte intervallVorgabe={intervall} />
      <AttributKarte />
    </div>
  );
}
