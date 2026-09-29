"use client";

import { useMemo, useState } from "react";
import { DATENTEST_INFO, HAEUFIGKEIT_LABEL, KONTROLLEN, findeKontrolle, prozesse, type Datentest, type Haeufigkeit, type Kontrolle } from "@/lib/hwp/kontrollen";
import { hwpZitat } from "@/lib/hwp/quelle";
import { baueNotiz } from "@/lib/dokumentation";
import type { ImportErgebnis, Importiert, Spalten } from "@/lib/import";
import { kontrollDatentests, kontrollStichprobe, type DatentestErgebnis } from "@/lib/pruefung/kontrolle";
import { attributStichprobenumfang, type AuswahlErgebnis } from "@/lib/pruefung/stichprobe";
import { kontrollUmfang, type KontrollUmfang } from "@/lib/pruefung/umfang";
import type { IksKontrolle, Pruefplanzeile } from "@/lib/iks";
import Abstimmung from "@/components/Abstimmung";
import AuswahlAnzeige from "@/components/AuswahlAnzeige";
import DateiImport from "@/components/DateiImport";
import KontrollAuswertung from "@/components/KontrollAuswertung";
import MatrixImport from "@/components/MatrixImport";
import { Auswahl, Fehler, Feld, Hinweise, Karte, Knopf, Schritt, Tabelle } from "@/components/ui";

const ZITAT = hwpZitat([303, 306, 307, 600, 602, 603, 764]);

export default function KontrollSeite() {
  const [id, setId] = useState<string | null>(null);
  const [eigenTitel, setEigenTitel] = useState("");
  const [haeufigkeit, setHaeufigkeit] = useState<Haeufigkeit>("monatlich");
  const [tests, setTests] = useState<Datentest[]>([]);
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [quelle, setQuelle] = useState<{ ergebnis: ImportErgebnis; name: string; spalten: Spalten } | null>(null);
  const [verfahren, setVerfahren] = useState<"staffelung" | "statistisch">("staffelung");
  const [rate, setRate] = useState("0.05");
  const [konfidenz, setKonfidenz] = useState("0.95");
  const [erwartet, setErwartet] = useState("0");
  const [methode, setMethode] = useState<"systematisch" | "zufaellig">("systematisch");
  const [nManuell, setNManuell] = useState("");
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)));
  const [gezogen, setGezogen] = useState<{ auswahl: AuswahlErgebnis; notiz: string } | null>(null);
  const [datentests, setDatentests] = useState<{ ergebnisse: DatentestErgebnis[]; hinweise: string[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const [matrix, setMatrix] = useState<{ k: IksKontrolle; z: Pruefplanzeile } | null>(null);

  const k: Kontrolle | undefined = useMemo(() => {
    const basis = id ? findeKontrolle(id) : undefined;
    if (!basis || !matrix || id !== "eigen") return basis;
    const m = matrix.k;
    return { ...basis, wirkung: m.wirkung ?? basis.wirkung, ausfuehrung: m.ausfuehrung ?? basis.ausfuehrung, nachweis: matrix.z.nachweis, datentests: matrix.z.funktion.datentests };
  }, [id, matrix]);
  const posten: Importiert[] = useMemo(() => quelle?.ergebnis.posten ?? [], [quelle]);

  const vorgeschlagen = useMemo(() => {
    if (posten.length === 0) return null;
    try {
      if (verfahren === "statistisch") {
        const u = attributStichprobenumfang({ tolerierbareRate: Number(rate), konfidenz: Number(konfidenz), erwarteteAbweichungen: Number(erwartet) });
        const n = Math.min(u.n, posten.length);
        return { ok: { n, vollpruefung: n >= posten.length, normbezug: hwpZitat([764]), hinweise: ["Statistische Attributprüfung (Binomial); Umfang wächst mit erwarteten Abweichungen und tiefer tolerierbarer Rate (Rz. 764)."] } as KontrollUmfang };
      }
      return { ok: kontrollUmfang({ haeufigkeit, anzahlVorgaenge: posten.length }) };
    } catch (e) {
      return { fehler: e instanceof Error ? e.message : "Umfang nicht berechenbar." };
    }
  }, [posten, verfahren, rate, konfidenz, erwartet, haeufigkeit]);

  function ausMatrix(m: IksKontrolle, z: Pruefplanzeile) {
    waehle("eigen");
    setMatrix({ k: m, z });
    setEigenTitel(`${m.id}: ${m.kontrolle}`.slice(0, 200));
    setHaeufigkeit(m.haeufigkeit ?? "monatlich");
    setTests(z.funktion.datentests);
    setNManuell(z.funktion.n ? String(z.funktion.n) : "");
    setFehler(m.haeufigkeit ? null : "Die Häufigkeit ist in der Matrix nicht angegeben oder nicht erkannt: bitte unten die Häufigkeit wählen bzw. den Umfang von Hand festlegen.");
    setTimeout(() => document.getElementById("schritt-kontrolle")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function waehle(neu: string) {
    setMatrix(null);
    const c = findeKontrolle(neu)!;
    setId(neu);
    setHaeufigkeit(c.haeufigkeit);
    setTests(c.datentests);
    setQuelle(null);
    setGezogen(null);
    setDatentests(null);
    setNManuell("");
    setFehler(null);
  }

  const titel = k ? (k.id === "eigen" && eigenTitel.trim() ? eigenTitel.trim() : k.titel) : "";
  const voreinstellung = { datumVon: von || undefined, datumBis: bis || undefined };

  function pruefenUndZiehen() {
    if (!k || !quelle) return;
    try {
      setFehler(null);
      setDatentests(tests.length ? kontrollDatentests(posten, quelle.spalten, tests) : null);
      const n = nManuell.trim() ? Number(nManuell) : vorgeschlagen?.ok ? vorgeschlagen.ok.n : NaN;
      if (!Number.isInteger(n) || n < 1) throw new Error("Umfang nicht festgelegt.");
      const a = kontrollStichprobe(posten, n, Number(seed), methode);
      const notiz = baueNotiz({
        bereich: "Kontrollprüfung",
        handlung: `${k.prozess}: ${titel}`,
        norm: ZITAT,
        datei: quelle.name,
        grundgesamtheit: { anzahl: posten.length },
        methode: methode === "systematisch" ? "Systematisch, nach Datum sortiert (deckt den Prüfzeitraum ab)" : "Zufällig",
        seed: Number(seed),
        umfang: a.ausgewaehlt.length,
        zusatz: [
          `Häufigkeit der Kontrolle: ${HAEUFIGKEIT_LABEL[haeufigkeit]}`,
          `Kontrollart: ${k.wirkung}, ${k.ausfuehrung}; Prüfungshandlung: ${k.pruefhandlung}`,
          `Umfang: ${nManuell.trim() ? "vom Prüfer festgelegt (Ermessen, Rz. 764)" : verfahren === "staffelung" ? "Staffelung nach Häufigkeit (indikativ, Q&A zur CMS-Prüfung)" : `statistisch, tolerierbare Rate ${Number(rate) * 100} %, Konfidenz ${Number(konfidenz) * 100} %`}`,
          `Nachweis je Vorgang: ${k.nachweis}`,
          ...(matrix
            ? [
                `Quelle: IKS-Matrix, ${matrix.k.seite ? `Seite ${matrix.k.seite}` : `Zeile ${matrix.k.excelZeile}`}; Kontroll-ID ${matrix.k.id}${matrix.k.prozess ? `; Prozess ${matrix.k.prozess}` : ""}${matrix.k.risiken.length ? `; Risiko: ${matrix.k.risiken.join(" | ")}` : ""}`,
                `Kontrollart laut Matrix: ${matrix.k.wirkung ?? "nicht angegeben"}, ${matrix.k.ausfuehrung ?? "nicht angegeben"}`,
              ]
            : []),
          ...(von || bis ? [`Prüfzeitraum: ${von || "–"} bis ${bis || "–"}`] : []),
        ],
        ausgewaehlt: a.ausgewaehlt,
        zeitpunkt: new Date().toISOString(),
      });
      setGezogen({ auswahl: a, notiz });
    } catch (e) {
      setGezogen(null);
      setFehler(e instanceof Error ? e.message : "Nicht möglich.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Kontrollprüfung</h1>
      <p className="text-sm text-slate-600">
        Funktionsprüfungen des internen Kontrollsystems nach HWP OR 2024, Teil III.4.2. Das Handbuch enthält keinen Katalog konkreter Kontrollen; die Kontrollen unten sind Beispiele (eigener Vorschlag) und an das Mandat anzupassen.
      </p>

      <MatrixImport onFunktionspruefung={ausMatrix} />

      <div id="schritt-kontrolle" />
      <Karte titel="1. Kontrolle wählen" norm={`Kontrollarten und Ablauf: ${ZITAT}`}>
        {prozesse.map((p) => (
          <details key={p} open={p === "Einkauf und Kreditoren" || KONTROLLEN.find((c) => c.id === id)?.prozess === p} className="rounded-xl border border-slate-200">
            <summary className="min-h-12 cursor-pointer touch-manipulation px-4 py-3 text-sm font-semibold text-slate-900">{p}</summary>
            <ul className="divide-y divide-slate-100">
              {KONTROLLEN.filter((c) => c.prozess === p).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => waehle(c.id)} aria-pressed={id === c.id} className={`flex min-h-14 w-full touch-manipulation flex-col items-start gap-0.5 px-4 py-3 text-left ${id === c.id ? "bg-slate-900 text-white" : "active:bg-slate-100"}`}>
                    <span className="text-sm font-medium">{c.titel}</span>
                    <span className={`text-xs ${id === c.id ? "text-slate-300" : "text-slate-500"}`}>
                      {c.wirkung} · {c.ausfuehrung} · {HAEUFIGKEIT_LABEL[c.haeufigkeit]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {k && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
            {matrix && <Hinweise liste={[`Aus der IKS-Matrix übernommen (${matrix.k.id}).${matrix.k.wirkung && matrix.k.ausfuehrung ? "" : " Kontrollart bzw. Ausführung fehlen in der Matrix und sind hier vorläufig mit dem Standard belegt: bitte bestätigen."}`]} />}
            {k.id === "eigen" && <Feld label="Bezeichnung der Kontrolle" value={eigenTitel} onChange={(e) => setEigenTitel(e.target.value)} />}
            <p>
              <strong>Kontrollart:</strong> {k.wirkung}, {k.ausfuehrung} (Rz. 303–308) · <strong>Prüfungshandlung:</strong> {k.pruefhandlung} (Rz. 603)
            </p>
            <p>
              <strong>Nachweis je Vorgang:</strong> {k.nachweis}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Auswahl label="Häufigkeit der Kontrolle" value={haeufigkeit} onChange={(e) => setHaeufigkeit(e.target.value as Haeufigkeit)}>
                {(Object.keys(HAEUFIGKEIT_LABEL) as Haeufigkeit[]).map((h) => (
                  <option key={h} value={h}>
                    {HAEUFIGKEIT_LABEL[h]}
                  </option>
                ))}
              </Auswahl>
              <Feld label="Prüfzeitraum von" placeholder="2025-01-01" value={von} onChange={(e) => setVon(e.target.value)} />
              <Feld label="Prüfzeitraum bis" placeholder="2025-12-31" value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-slate-600 uppercase">Automatische Datenprüfungen über alle Vorgänge</legend>
              {(Object.keys(DATENTEST_INFO) as Datentest[]).map((t) => (
                <label key={t} className="flex min-h-11 touch-manipulation items-center gap-3">
                  <input type="checkbox" className="h-6 w-6" checked={tests.includes(t)} onChange={(e) => setTests(e.target.checked ? [...tests, t] : tests.filter((x) => x !== t))} />
                  <span>
                    {DATENTEST_INFO[t].titel} <span className="text-xs text-slate-500">({DATENTEST_INFO[t].braucht})</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </Karte>

      {k && (
        <>
          <div className="space-y-3">
            <Schritt nr={2} titel="Excel oder PDF hochladen" />
            <DateiImport
              key={`${k.id}|${von}|${bis}`}
              titel="Vorgangsliste der Kontrolle"
              erwartet={{ titel: "Erwarteter Inhalt", spalten: k.population }}
              erweitert={["erfasser", "freigeber", "erfassungsdatum", "freigabedatum"]}
              betragOptional
              voreinstellung={voreinstellung}
              onUebernehmen={(ergebnis, name, spalten) => {
                setQuelle({ ergebnis, name, spalten });
                setGezogen(null);
                setDatentests(null);
              }}
            />
          </div>

          {quelle && (
            <>
              {quelle.ergebnis.kontrolle.summeAbsolut > 0 && (
                <Karte titel="Vorgangsliste" norm={`${quelle.name}: ${posten.length} Vorgänge`}>
                  <Abstimmung summe={quelle.ergebnis.kontrolle.summe} label="Kontrollsumme laut Quelle" />
                </Karte>
              )}

              <div className="space-y-3">
                <Schritt nr={3} titel="Stichprobe festlegen und ziehen" />
                <Karte titel="Umfang und Auswahl" norm={hwpZitat([600, 602, 764, 783])}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Auswahl label="Umfang bestimmen" value={verfahren} onChange={(e) => setVerfahren(e.target.value as "staffelung" | "statistisch")}>
                      <option value="staffelung">Staffelung nach Häufigkeit</option>
                      <option value="statistisch">Statistisch (Attributprüfung)</option>
                    </Auswahl>
                    <Auswahl label="Auswahl" value={methode} onChange={(e) => setMethode(e.target.value as "systematisch" | "zufaellig")}>
                      <option value="systematisch">Systematisch über den Zeitraum</option>
                      <option value="zufaellig">Zufällig</option>
                    </Auswahl>
                    <Feld label="Seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} hilfe="Gleicher Seed = gleiche Auswahl" />
                  </div>
                  {verfahren === "statistisch" && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Feld label="Tolerierbare Abweichungsrate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} hilfe="0.05 = 5 %" />
                      <Feld label="Konfidenz" inputMode="decimal" value={konfidenz} onChange={(e) => setKonfidenz(e.target.value)} />
                      <Feld label="Erwartete Abweichungen" inputMode="numeric" value={erwartet} onChange={(e) => setErwartet(e.target.value)} />
                    </div>
                  )}
                  {vorgeschlagen?.fehler && <Fehler text={vorgeschlagen.fehler} />}
                  {vorgeschlagen?.ok && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-800">
                        Vorschlag: <strong>{vorgeschlagen.ok.n}</strong> von {posten.length} Vorgängen.
                      </p>
                      <Hinweise liste={vorgeschlagen.ok.hinweise} />
                    </div>
                  )}
                  <Feld label="Umfang von Hand festlegen (optional)" inputMode="numeric" value={nManuell} onChange={(e) => setNManuell(e.target.value)} hilfe="Pflichtgemässes Ermessen; überschreibt den Vorschlag" />
                  <Knopf onClick={pruefenUndZiehen}>Datenprüfung durchführen und Stichprobe ziehen</Knopf>
                  <Fehler text={fehler} />
                </Karte>
              </div>

              {datentests && (
                <Karte titel="Automatische Datenprüfung (alle Vorgänge)" norm={hwpZitat(758)}>
                  <Tabelle kopf={["Prüfung", "Geprüft", "Nicht prüfbar", "Abweichungen"]} zeilen={datentests.ergebnisse.map((e) => [e.titel, e.geprueft, e.nichtPruefbar, e.abweichungen.length])} />
                  {datentests.ergebnisse.filter((e) => e.abweichungen.length > 0).map((e) => (
                    <details key={e.test} className="text-sm text-slate-800">
                      <summary className="min-h-11 cursor-pointer py-2 font-medium">{e.titel}: {e.abweichungen.length} Abweichung(en)</summary>
                      <Tabelle kopf={["Zeile", "ID", "Grund"]} zeilen={e.abweichungen.slice(0, 100).map((a) => [a.excelZeile, a.id, a.grund])} />
                    </details>
                  ))}
                  <Hinweise liste={datentests.hinweise} />
                </Karte>
              )}

              {gezogen && (
                <>
                  <Karte titel={`Stichprobe: ${gezogen.auswahl.ausgewaehlt.length} von ${posten.length} Vorgängen`} norm={`${titel}`}>
                    <AuswahlAnzeige
                      posten={posten}
                      ids={gezogen.auswahl.ausgewaehlt}
                      seed={gezogen.auswahl.seed}
                      methode={methode}
                      notiz={gezogen.notiz}
                      dateiname={`kontrolle-${k.id}-seed${gezogen.auswahl.seed}.csv`}
                      hinweise={gezogen.auswahl.hinweise}
                      mitBetrag={!quelle.ergebnis.posten.every((p) => p.betrag === 0)}
                    />
                    <Tabelle kopf={["Prüfe je Vorgang"]} zeilen={[[k.nachweis], [`Prüfungshandlung: ${k.pruefhandlung}`]]} />
                  </Karte>
                  <KontrollAuswertung n={gezogen.auswahl.ausgewaehlt.length} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
