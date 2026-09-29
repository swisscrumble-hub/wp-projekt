"use client";

import { useMemo, useState } from "react";
import { EINZELFALL, findeEinzelfall, gruppen, einzelfallZitat, type Einzelfallpruefung } from "@/lib/hwp/einzelfall";
import { baueNotiz } from "@/lib/dokumentation";
import type { ImportErgebnis, Importiert } from "@/lib/import";
import { istIsoDatum, addTage } from "@/lib/pruefung/datum";
import { monetaereAuswahl, systematischeAuswahl, zufallsauswahl, type AuswahlErgebnis } from "@/lib/pruefung/stichprobe";
import { OBERGRENZE_STICHPROBE, einzelfallUmfang, pruefeObergrenze } from "@/lib/pruefung/umfang";
import Abstimmung from "@/components/Abstimmung";
import AuswahlAnzeige from "@/components/AuswahlAnzeige";
import EinzelfallAuswertung from "@/components/EinzelfallAuswertung";
import DateiImport from "@/components/DateiImport";
import { Auswahl, Fehler, Feld, Hinweise, Karte, Knopf, Schritt, Tabelle, chf, num } from "@/components/ui";

const METHODE_LABEL = { monetaer: "Monetär (MUS, wertproportional)", zufaellig: "Zufällig (gleiche Chance)", systematisch: "Systematisch (fester Abstand)" } as const;
type Methode = keyof typeof METHODE_LABEL;

function Katalog({ gewaehlt, onWahl }: { gewaehlt: string | null; onWahl: (id: string) => void }) {
  const [suche, setSuche] = useState("");
  const q = suche.trim().toLowerCase();
  const passt = (e: Einzelfallpruefung) => !q || `${e.titel} ${e.position} ${e.aussage} ${e.rz}`.toLowerCase().includes(q);
  return (
    <div className="space-y-3">
      <Feld label="Suchen" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. Debitoren, Erlöse, 898" />
      {gruppen.map((g) => {
        const liste = EINZELFALL.filter((e) => e.gruppe === g && passt(e));
        if (liste.length === 0) return null;
        return (
          <details key={g} open={!!q || EINZELFALL.find((e) => e.id === gewaehlt)?.gruppe === g || g === "Aktiven"} className="rounded-xl border border-slate-200">
            <summary className="min-h-12 cursor-pointer touch-manipulation px-4 py-3 text-sm font-semibold text-slate-900">
              {g} ({liste.length})
            </summary>
            <ul className="divide-y divide-slate-100">
              {liste.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onWahl(e.id)}
                    aria-pressed={gewaehlt === e.id}
                    className={`flex min-h-14 w-full touch-manipulation flex-col items-start gap-0.5 px-4 py-3 text-left ${gewaehlt === e.id ? "bg-slate-900 text-white" : "active:bg-slate-100"}`}
                  >
                    <span className="text-sm font-medium">{e.titel}</span>
                    <span className={`text-xs ${gewaehlt === e.id ? "text-slate-300" : "text-slate-500"}`}>
                      {e.position} · {e.aussage} · Rz. {e.rz}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export default function EinzelfallSeite() {
  const [id, setId] = useState<string | null>(null);
  const [stichtag, setStichtag] = useState("");
  const [quelle, setQuelle] = useState<{ ergebnis: ImportErgebnis; name: string } | null>(null);
  const [toleranz, setToleranz] = useState("");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [methode, setMethode] = useState<Methode>("monetaer");
  const [nManuell, setNManuell] = useState("");
  const [erhoeht, setErhoeht] = useState(false);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)));
  const [gezogen, setGezogen] = useState<{ auswahl: AuswahlErgebnis; notiz: string; n: number; methode: Methode } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const eintrag = id ? findeEinzelfall(id) : undefined;
  const posten: Importiert[] = useMemo(() => quelle?.ergebnis.posten ?? [], [quelle]);

  const voreinstellung = useMemo<{ vorzeichen?: "soll" | "haben"; datumVon?: string; datumBis?: string } | undefined>(() => {
    if (!eintrag) return undefined;
    const basis = { vorzeichen: eintrag.vorzeichen };
    if (!istIsoDatum(stichtag)) return basis;
    if (eintrag.stichtagFenster !== undefined) return { ...basis, datumVon: addTage(stichtag, -eintrag.stichtagFenster), datumBis: addTage(stichtag, eintrag.stichtagFenster) };
    if (eintrag.nurNachStichtag) return { ...basis, datumVon: addTage(stichtag, 1) };
    return basis;
  }, [eintrag, stichtag]);

  const wert = useMemo(() => posten.reduce((a, p) => a + Math.max(p.buchwert, 0), 0), [posten]);
  const umfang = useMemo(() => {
    if (posten.length === 0 || !(num(toleranz) > 0)) return null;
    try {
      return { ok: einzelfallUmfang({ buchwert: wert, toleranz: num(toleranz), anzahlPosten: posten.length, konfidenz: Number(konfidenz), erhoehtesRisiko: erhoeht }) };
    } catch (e) {
      return { fehler: e instanceof Error ? e.message : "Umfang nicht berechenbar." };
    }
  }, [posten, wert, toleranz, konfidenz, erhoeht]);

  function waehle(neu: string) {
    setId(neu);
    setQuelle(null);
    setGezogen(null);
    setNManuell("");
    setFehler(null);
    const e = findeEinzelfall(neu);
    if (e) setMethode(e.auswahl);
  }

  function ziehen() {
    if (!eintrag || !quelle) return;
    try {
      setFehler(null);
      const n = nManuell.trim() ? Number(nManuell) : umfang?.ok ? umfang.ok.n : NaN;
      if (!Number.isInteger(n) || n < 1) throw new Error("Bitte Toleranz eingeben oder den Umfang von Hand festlegen.");
      pruefeObergrenze(n);
      const p = posten.map((x) => ({ id: x.id, buchwert: x.buchwert }));
      const s = Number(seed);
      const a = methode === "monetaer" ? monetaereAuswahl(p, n, s) : methode === "zufaellig" ? zufallsauswahl(p, n, s) : systematischeAuswahl(p, n, s);
      const notiz = baueNotiz({
        bereich: "Einzelfallprüfung",
        handlung: `${eintrag.position}: ${eintrag.titel}`,
        norm: einzelfallZitat(eintrag),
        datei: quelle.name,
        grundgesamtheit: { anzahl: posten.length, wert: quelle.ergebnis.kontrolle.summeAbsolut },
        methode: METHODE_LABEL[methode],
        seed: s,
        umfang: a.ausgewaehlt.length,
        zusatz: [
          `Nachweis pro Element: ${eintrag.nachweis}`,
          ...(methode === "monetaer" && a.intervall ? [`Intervall: ${a.intervall.toLocaleString("de-CH", { maximumFractionDigits: 2 })}`, `Sicher ausgewählt (≥ Intervall): ${a.sicherAusgewaehlt?.join(", ") || "keine"}`] : []),
          ...(num(toleranz) > 0 ? [`Tolerierbare falsche Darstellung: ${num(toleranz).toLocaleString("de-CH")}, Konfidenz ${(Number(konfidenz) * 100).toFixed(0)} %`] : []),
          ...(nManuell.trim() ? ["Umfang vom Prüfer festgelegt (Ermessen, Rz. 762)"] : []),
        ],
        ausgewaehlt: a.ausgewaehlt,
        zeitpunkt: new Date().toISOString(),
      });
      setGezogen({ auswahl: a, notiz, n, methode });
    } catch (e) {
      setGezogen(null);
      setFehler(e instanceof Error ? e.message : "Ziehen nicht möglich.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Einzelfallprüfung</h1>
      <p className="text-sm text-slate-600">Aussagebezogene Prüfungshandlungen nach dem Schweizer Handbuch der Wirtschaftsprüfung, Band Ordentliche Revision (HWP OR 2024, Teil III.4.9).</p>

      <Karte titel="1. Einzelfallprüfung wählen" norm="Auswahl aus den Beispielen aussagebezogener Prüfungshandlungen (eigene Kurzformulierungen mit Randziffer)">
        <Katalog gewaehlt={id} onWahl={waehle} />
        {eintrag && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
            <p className="font-semibold">{eintrag.titel}</p>
            <p>
              <strong>Position:</strong> {eintrag.position} · <strong>Aussage:</strong> {eintrag.aussage}
            </p>
            <p>
              <strong>Nachweis je Element:</strong> {eintrag.nachweis}
            </p>
            <p>
              <strong>Quelle:</strong> {einzelfallZitat(eintrag)}
            </p>
            {eintrag.hinweis && <p className="text-amber-900">{eintrag.hinweis}</p>}
          </div>
        )}
      </Karte>

      {eintrag && (
        <>
          {(eintrag.stichtagFenster !== undefined || eintrag.nurNachStichtag) && (
            <Karte titel="Geschäftsjahresende" norm="Für den Datumsfilter dieser Prüfungshandlung">
              <Feld label="Geschäftsjahresende (JJJJ-MM-TT)" placeholder="2025-12-31" value={stichtag} onChange={(e) => setStichtag(e.target.value)} hilfe={eintrag.nurNachStichtag ? "Es werden nur Posten nach diesem Datum vorgeschlagen." : `Vorgeschlagen wird ein Fenster von ±${eintrag.stichtagFenster} Tagen um das Datum (Prüfer legt fest).`} />
              {stichtag && !istIsoDatum(stichtag) && <Fehler text="Kein gültiges Datum." />}
            </Karte>
          )}

          <div className="space-y-3">
            <Schritt nr={2} titel="Excel oder PDF hochladen" />
            <DateiImport
              key={`${eintrag.id}|${voreinstellung?.datumVon ?? ""}|${voreinstellung?.datumBis ?? ""}`}
              titel={eintrag.population.titel}
              erwartet={{ titel: "Erwarteter Inhalt", spalten: eintrag.population.spalten }}
              voreinstellung={voreinstellung}
              onUebernehmen={(ergebnis, name) => {
                setQuelle({ ergebnis, name });
                setGezogen(null);
              }}
            />
          </div>

          {quelle && (
            <>
              <Karte titel="Grundgesamtheit" norm={`${quelle.name}: ${posten.length} Posten`}>
                <Abstimmung summe={quelle.ergebnis.kontrolle.summe} />
              </Karte>

              <div className="space-y-3">
                <Schritt nr={3} titel="Stichprobe festlegen und ziehen" />
                <Karte titel="Umfang und Methode" norm="HWP OR 2024, Teil III Rz. 757–775">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Feld label="Tolerierbare falsche Darstellung" inputMode="decimal" value={toleranz} onChange={(e) => setToleranz(e.target.value)} hilfe="Höchstens die Toleranzwesentlichkeit (Rz. 766)" />
                    <Auswahl label="Konfidenz" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)}>
                      <option value="0.95">95 % (Standard, Rz. 775)</option>
                      <option value="0.9">90 %</option>
                      <option value="0.8">80 %</option>
                    </Auswahl>
                    <Auswahl label="Methode" value={methode} onChange={(e) => setMethode(e.target.value as Methode)}>
                      {(Object.keys(METHODE_LABEL) as Methode[]).map((m) => (
                        <option key={m} value={m}>
                          {METHODE_LABEL[m]}
                        </option>
                      ))}
                    </Auswahl>
                  </div>
                  <label className="flex min-h-11 touch-manipulation items-center gap-3 text-sm text-slate-800">
                    <input type="checkbox" checked={erhoeht} onChange={(e) => setErhoeht(e.target.checked)} className="h-6 w-6" />
                    Erhöhtes Risiko (Vorschlag bis {OBERGRENZE_STICHPROBE} statt 10 Elemente)
                  </label>
                  {umfang?.fehler && <Fehler text={umfang.fehler} />}
                  {umfang?.ok && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-800">
                        Vorschlag: <strong>{umfang.ok.n}</strong> Elemente{umfang.ok.begrenzt ? ` (rechnerisch ${umfang.ok.rechnerisch})` : ""} (Buchwert {chf(wert)}, Faktor {umfang.ok.zuverlaessigkeitsfaktor.toFixed(2)}).
                      </p>
                      <Hinweise liste={umfang.ok.hinweise} />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Feld label="Umfang von Hand festlegen (optional)" inputMode="numeric" value={nManuell} onChange={(e) => setNManuell(e.target.value)} hilfe={`Pflichtgemässes Ermessen (Rz. 762); überschreibt den Vorschlag; höchstens ${OBERGRENZE_STICHPROBE}`} />
                    <Feld label="Seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} hilfe="Gleicher Seed = gleiche Auswahl. In die Dokumentation übernehmen." />
                  </div>
                  <Knopf onClick={ziehen}>Stichprobe ziehen</Knopf>
                  <Fehler text={fehler} />
                </Karte>
              </div>

              {gezogen && (
                <>
                  <Karte titel={`Auswahl: ${gezogen.auswahl.ausgewaehlt.length} von ${posten.length} Elementen`} norm={einzelfallZitat(eintrag)}>
                    <AuswahlAnzeige
                      posten={posten}
                      ids={gezogen.auswahl.ausgewaehlt}
                      seed={gezogen.auswahl.seed}
                      methode={METHODE_LABEL[gezogen.methode]}
                      notiz={gezogen.notiz}
                      dateiname={`einzelfall-${eintrag.id}-seed${gezogen.auswahl.seed}.csv`}
                      hinweise={gezogen.auswahl.hinweise}
                    />
                    {gezogen.auswahl.sicherAusgewaehlt && gezogen.auswahl.sicherAusgewaehlt.length > 0 && (
                      <p className="text-sm text-slate-700">Sicher ausgewählt (≥ Intervall, Einzelfallprüfung ohne Hochrechnung): {gezogen.auswahl.sicherAusgewaehlt.join(", ")}</p>
                    )}
                    <Tabelle kopf={["Prüfe je Element"]} zeilen={[[eintrag.nachweis]]} />
                  </Karte>
                  <EinzelfallAuswertung
                    methode={gezogen.methode}
                    intervall={gezogen.auswahl.intervall}
                    konfidenz={Number(konfidenz)}
                    toleranz={num(toleranz) > 0 ? num(toleranz) : 0}
                    grundgesamtheitWert={quelle.ergebnis.kontrolle.summeAbsolut}
                    stichprobeWert={posten.filter((p) => gezogen.auswahl.ausgewaehlt.includes(p.id)).reduce((a, p) => a + Math.abs(p.betrag), 0)}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
