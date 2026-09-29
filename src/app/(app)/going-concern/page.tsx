"use client";

import { useState } from "react";
import { INDIKATOREN, covenantPruefung, kapitalschutz, liquiditaetsprognose, wuerdigeFragebogen, type Antwort, type FragebogenAntworten } from "@/lib/pruefung/goingConcern";
import { parseZahl, tabelleOhneKopf, zahlIn } from "@/lib/tabelle";
import { Daten, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, chf } from "@/components/ui";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Unbekannter Fehler.");
const num = (s: string) => Number(s.replace(/['’\s]/g, ""));

function FragebogenKarte() {
  const [a, setA] = useState<FragebogenAntworten>({});
  const [r, setR] = useState<ReturnType<typeof wuerdigeFragebogen> | null>(null);
  const setze = (id: string, antwort: Antwort) => setA((v) => ({ ...v, [id]: { ...v[id], antwort } }));
  return (
    <Karte titel="1. Fragebogen: Ereignisse und Gegebenheiten" norm="PS 570 (ISA 570)">
      <p className="text-sm text-slate-600">Jeder Punkt braucht eine Antwort. Ein «Ja» braucht eine Begründung. Unbeantwortete Punkte verhindern die Auswertung.</p>
      <div className="space-y-3">
        {INDIKATOREN.map((i) => (
          <fieldset key={i.id} className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-500 uppercase">{i.kategorie}</legend>
            <p className="text-sm text-slate-900">{i.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["ja", "nein", "unbekannt"] as Antwort[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={a[i.id]?.antwort === opt}
                  onClick={() => setze(i.id, opt)}
                  className={`min-h-11 touch-manipulation rounded-xl border px-4 text-sm font-medium ${a[i.id]?.antwort === opt ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"}`}
                >
                  {opt === "ja" ? "Ja" : opt === "nein" ? "Nein" : "Unbekannt"}
                </button>
              ))}
            </div>
            {a[i.id]?.antwort === "ja" && (
              <input
                aria-label={`Begründung zu ${i.text}`}
                placeholder="Begründung / Beleg"
                value={a[i.id]?.notiz ?? ""}
                onChange={(e) => setA((v) => ({ ...v, [i.id]: { antwort: "ja", notiz: e.target.value } }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus:border-slate-900 focus:outline-none"
              />
            )}
          </fieldset>
        ))}
      </div>
      <Knopf onClick={() => setR(wuerdigeFragebogen(a))}>Fragebogen würdigen</Knopf>
      {r && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">{r.status === "unvollstaendig" ? "Unvollständig: keine Auswertung." : `Auswertbar: ${r.bejaht.length} Punkt(e) bejaht.`}</p>
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function LiquiditaetKarte() {
  const [daten, setDaten] = useState("");
  const [anfang, setAnfang] = useState("");
  const [linie, setLinie] = useState("0");
  const [r, setR] = useState<ReturnType<typeof liquiditaetsprognose> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte titel="2. Liquiditätsprognose" norm="PS 570 (ISA 570)">
      <Daten label="Monate" hilfe="Monat (JJJJ-MM);Einzahlungen;Auszahlungen, lückenlos aufeinanderfolgend." value={daten} onChange={(e) => setDaten(e.target.value)} placeholder={"2026-01;200'000;250'000\n2026-02;180'000;190'000"} rows={5} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Anfangsbestand flüssige Mittel" inputMode="decimal" value={anfang} onChange={(e) => setAnfang(e.target.value)} />
        <Feld label="Freie Kreditlinie" inputMode="decimal" value={linie} onChange={(e) => setLinie(e.target.value)} />
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            const monate = tabelleOhneKopf(daten, 3, [1, 2]).map((z, i) => ({ monat: z[0]!, einzahlungen: zahlIn(z, 1, i + 1), auszahlungen: zahlIn(z, 2, i + 1) }));
            setR(liquiditaetsprognose({ anfangsbestand: parseZahl(anfang), freieKreditlinie: parseZahl(linie), monate }));
          } catch (e) {
            setR(null);
            setFehler(msg(e));
          }
        }}
      >
        Prognose rechnen
      </Knopf>
      <Fehler text={fehler} />
      {r && (
        <div className="space-y-3">
          <Tabelle kopf={["Monat", "Saldo", "Verfügbar inkl. Kreditlinie", "Kreditlinie genutzt"]} zeilen={r.verlauf.map((v) => [v.monat, chf(v.saldo), chf(v.verfuegbar), v.kreditlinieInAnspruch ? "ja" : "nein"])} />
          <p className="text-sm font-medium text-slate-800">{r.ersterEngpass ? `Erster rechnerischer Engpass: ${r.ersterEngpass}. Tiefpunkt ${r.tiefpunkt.monat} (${chf(r.tiefpunkt.verfuegbar)}).` : `Kein rechnerischer Engpass im Prognosezeitraum. Tiefpunkt ${r.tiefpunkt.monat} (${chf(r.tiefpunkt.verfuegbar)}).`}</p>
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function CovenantKarte() {
  const [daten, setDaten] = useState("");
  const [r, setR] = useState<ReturnType<typeof covenantPruefung> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte titel="3. Kreditvereinbarungen (Covenants)" norm="PS 570 (ISA 570)">
      <Daten label="Covenants" hilfe="Name;Typ (min oder max);Grenze;Ist" value={daten} onChange={(e) => setDaten(e.target.value)} placeholder={"EK-Quote;min;0.30;0.28\nVerschuldungsgrad;max;3;2.8"} rows={4} />
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            const list = tabelleOhneKopf(daten, 4, [2, 3]).map((z, i) => {
              const typ = z[1]!.toLowerCase();
              if (typ !== "min" && typ !== "max") throw new Error(`Zeile ${i + 1}: Typ muss «min» oder «max» sein.`);
              return { name: z[0]!, typ: typ as "min" | "max", grenze: zahlIn(z, 2, i + 1), ist: zahlIn(z, 3, i + 1) };
            });
            setR(covenantPruefung(list));
          } catch (e) {
            setR(null);
            setFehler(msg(e));
          }
        }}
      >
        Prüfen
      </Knopf>
      <Fehler text={fehler} />
      {r && (
        <div className="space-y-2">
          <Tabelle kopf={["Covenant", "Typ", "Grenze", "Ist", "Reserve", "Status"]} zeilen={r.ergebnisse.map((c) => [c.name, c.typ, c.grenze, c.ist, c.reserve == null ? "–" : `${(c.reserve * 100).toFixed(1)} %`, c.status])} />
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

function KapitalKarte() {
  const [w, setW] = useState({ aktienkapital: "", gesetzlicheReserven: "", aktiven: "", fremdkapital: "", rangruecktritt: "0" });
  const [r, setR] = useState<ReturnType<typeof kapitalschutz> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const f = (k: keyof typeof w, label: string) => <Feld label={label} inputMode="decimal" value={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.value })} />;
  return (
    <Karte titel="4. Kapitalverlust und Überschuldung (Hinweis)" norm="Art. 725a / 725b OR, geltende Fassung prüfen">
      <div className="grid gap-3 sm:grid-cols-2">
        {f("aktienkapital", "Aktienkapital")}
        {f("gesetzlicheReserven", "Gesetzliche Reserven")}
        {f("aktiven", "Aktiven (Total)")}
        {f("fremdkapital", "Fremdkapital (Total)")}
        {f("rangruecktritt", "Rangrücktritt (nur wenn wirksam)")}
      </div>
      <Knopf
        onClick={() => {
          try {
            setFehler(null);
            setR(kapitalschutz({ aktienkapital: num(w.aktienkapital), gesetzlicheReserven: num(w.gesetzlicheReserven), aktiven: num(w.aktiven), fremdkapital: num(w.fremdkapital), rangruecktritt: num(w.rangruecktritt) }));
          } catch (e) {
            setR(null);
            setFehler(msg(e));
          }
        }}
      >
        Berechnen
      </Knopf>
      <Fehler text={fehler} />
      {r && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800">
            Eigenkapital (Buchwerte) {chf(r.eigenkapital)}. Kapitalverlust-Hinweis: <strong>{r.kapitalverlust ? "ja" : "nein"}</strong>. Überschuldungs-Hinweis: <strong>{r.ueberschuldung ? "ja" : "nein"}</strong>.
          </p>
          <Hinweise liste={r.hinweise} />
        </div>
      )}
    </Karte>
  );
}

export default function GoingConcernSeite() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Going Concern</h1>
      <p className="text-sm text-slate-600">Dieses Modul erfasst und rechnet. Über die Fortführungsfähigkeit entscheidet der Prüfer.</p>
      <FragebogenKarte />
      <LiquiditaetKarte />
      <CovenantKarte />
      <KapitalKarte />
    </div>
  );
}
