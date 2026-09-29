"use client";

import { useMemo, useState } from "react";
import { KRITERIEN, KRITERIUM_IDS, pruefeJournal, waehleJournal, type JournalAuswahl, type JournalErgebnis } from "@/lib/pruefung/journalpruefung";
import { baueNotiz } from "@/lib/dokumentation";
import { hwpZitat } from "@/lib/hwp/quelle";
import type { ImportErgebnis, Importiert, Spalten } from "@/lib/import";
import { istIsoDatum } from "@/lib/pruefung/datum";
import AuswahlAnzeige from "@/components/AuswahlAnzeige";
import ExcelImport from "@/components/ExcelImport";
import Abstimmung from "@/components/Abstimmung";
import { Daten, Fehler, Feld, Hinweise, Karte, Knopf, Schritt, Tabelle, num } from "@/components/ui";

const ZITAT = hwpZitat([374, 375, 376, 377]);
const liste = (s: string) => s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

export default function JournalSeite() {
  const [quelle, setQuelle] = useState<{ ergebnis: ImportErgebnis; name: string; spalten: Spalten } | null>(null);
  const [stichtag, setStichtag] = useState("");
  const [fenster, setFenster] = useState("7");
  const [feiertage, setFeiertage] = useState("");
  const [risikokonten, setRisikokonten] = useState("");
  const [seltenKonto, setSeltenKonto] = useState("3");
  const [seltenErfasser, setSeltenErfasser] = useState("1");
  const [rundung, setRundung] = useState("1000");
  const [minRund, setMinRund] = useState("10000");
  const [n, setN] = useState("25");
  const [zufall, setZufall] = useState("20");
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)));
  const [ergebnis, setErgebnis] = useState<JournalErgebnis | null>(null);
  const [auswahl, setAuswahl] = useState<{ a: JournalAuswahl; notiz: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const posten: Importiert[] = useMemo(() => quelle?.ergebnis.posten ?? [], [quelle]);

  function pruefen() {
    if (!quelle) return;
    try {
      setFehler(null);
      const r = pruefeJournal(posten, quelle.spalten, {
        stichtag,
        endeFensterTage: num(fenster),
        feiertage: liste(feiertage),
        risikokonten: liste(risikokonten),
        seltenKontoMax: num(seltenKonto),
        seltenErfasserAnteil: num(seltenErfasser) / 100,
        rundung: num(rundung),
        minRundbetrag: num(minRund),
      });
      const a = waehleJournal(r, Number(n), Number(seed), num(zufall) / 100);
      const notiz = baueNotiz({
        bereich: "Journalprüfung",
        handlung: "Journal Entry Testing: Auswahl nach Merkmalen erhöhten Risikos",
        norm: `${ZITAT} (Merkmale aus ISA-CH 240; Abgleich mit ISA 240 (Revised) durch den Prüfer)`,
        datei: quelle.name,
        grundgesamtheit: { anzahl: posten.length, wert: quelle.ergebnis.kontrolle.summeAbsolut },
        methode: `Risikobasiert nach Score (${a.risikobasiert.length}) plus Zufallsauswahl (${a.zufaellig.length})`,
        seed: Number(seed),
        umfang: a.ausgewaehlt.length,
        zusatz: [
          `Stichtag: ${stichtag}, Fenster Periodenende: ${fenster} Tage`,
          `Angewandte Kriterien: ${KRITERIUM_IDS.filter((k) => r.abdeckung[k].geprueft > 0).map((k) => KRITERIEN[k].titel).join("; ") || "keine"}`,
          `Nicht prüfbare Kriterien: ${KRITERIUM_IDS.filter((k) => r.abdeckung[k].geprueft === 0).map((k) => KRITERIEN[k].titel).join("; ") || "keine"}`,
          ...(r.anteilManuell !== undefined ? [`Anteil manueller Buchungen: ${(r.anteilManuell * 100).toFixed(1)} %`] : []),
        ],
        ausgewaehlt: a.ausgewaehlt,
        zeitpunkt: new Date().toISOString(),
      });
      setErgebnis(r);
      setAuswahl({ a, notiz });
    } catch (e) {
      setErgebnis(null);
      setAuswahl(null);
      setFehler(e instanceof Error ? e.message : "Prüfung nicht möglich.");
    }
  }

  const bemerkung = useMemo(() => new Map((ergebnis?.ergebnisse ?? []).filter((e) => e.score > 0).map((e) => [e.id, e.kriterien.map((k) => KRITERIEN[k].titel).join("; ")])), [ergebnis]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Journalprüfung</h1>
      <p className="text-sm text-slate-600">
        Journal Entry Testing nach definierten Merkmalen erhöhten Risikos dolosen Handelns (HWP OR 2024, Teil III Rz. 374–377, mit den Beispielen aus ISA-CH 240). Der Abgleich mit ISA 240 (Revised) ist durch den Prüfer vorzunehmen; Schwellen sind Parameter.
      </p>

      <div className="space-y-3">
        <Schritt nr={1} titel="Journal als Excel hochladen" />
        <ExcelImport
          titel="Buchungsjournal"
          erwartet={{ titel: "Erwarteter Inhalt", spalten: "Belegnummer, Buchungsdatum, Konto, Text, Betrag oder Soll/Haben; für mehr Kriterien: Erfasser, Buchungsart (manuell/automatisch), Erfassungsdatum" }}
          erweitert={["erfasser", "manuell", "erfassungsdatum"]}
          onUebernehmen={(e, name, spalten) => {
            setQuelle({ ergebnis: e, name, spalten });
            setErgebnis(null);
            setAuswahl(null);
          }}
        />
      </div>

      {quelle && (
        <>
          <Karte titel="Journal" norm={`${quelle.name}: ${posten.length} Buchungen`}>
            <Abstimmung summe={quelle.ergebnis.kontrolle.summeAbsolut} label="Total laut Hauptbuch (Soll- bzw. Habentotal des Journals)" />
          </Karte>

          <div className="space-y-3">
            <Schritt nr={2} titel="Kriterien festlegen und Auswahl ziehen" />
            <Karte titel="Parameter" norm={ZITAT}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Feld label="Stichtag (Geschäftsjahresende)" placeholder="2025-12-31" value={stichtag} onChange={(e) => setStichtag(e.target.value)} />
                <Feld label="Umfang der Auswahl" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} hilfe="Pflichtgemässes Ermessen (Rz. 377)" />
                <Feld label="Davon Zufallsanteil (%)" inputMode="numeric" value={zufall} onChange={(e) => setZufall(e.target.value)} hilfe="Unvorhersehbarkeit; auch Buchungen ohne Treffer" />
              </div>
              {stichtag && !istIsoDatum(stichtag) && <Fehler text="Der Stichtag ist kein gültiges Datum." />}
              <div className="grid gap-3 sm:grid-cols-2">
                <Daten label="Feiertage (kantonal)" hilfe="JJJJ-MM-TT, durch Komma oder Zeilenumbruch getrennt" value={feiertage} onChange={(e) => setFeiertage(e.target.value)} rows={3} />
                <Daten label="Risikokonten" hilfe="Konten mit Schätzungen, konzerninternen Geschäftsvorfällen, nicht abgestimmten Differenzen u.a." value={risikokonten} onChange={(e) => setRisikokonten(e.target.value)} rows={3} />
              </div>
              <details className="text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium text-slate-800">Schwellen anpassen</summary>
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <Feld label="Periodenende: Tage vor dem Stichtag" inputMode="numeric" value={fenster} onChange={(e) => setFenster(e.target.value)} />
                  <Feld label="Seltenes Konto: höchstens … Buchungen" inputMode="numeric" value={seltenKonto} onChange={(e) => setSeltenKonto(e.target.value)} />
                  <Feld label="Seltener Erfasser: Anteil unter … %" inputMode="decimal" value={seltenErfasser} onChange={(e) => setSeltenErfasser(e.target.value)} />
                  <Feld label="Rundbetrag: Vielfaches von" inputMode="decimal" value={rundung} onChange={(e) => setRundung(e.target.value)} />
                  <Feld label="Rundbetrag: ab Betrag" inputMode="decimal" value={minRund} onChange={(e) => setMinRund(e.target.value)} />
                  <Feld label="Seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} hilfe="Gleicher Seed = gleiche Zufallsauswahl" />
                </div>
              </details>
              <Knopf onClick={pruefen}>Journal prüfen und Auswahl ziehen</Knopf>
              <Fehler text={fehler} />
            </Karte>
          </div>

          {ergebnis && (
            <Karte titel="Abdeckung der Kriterien" norm={ergebnis.normbezug}>
              <Tabelle
                kopf={["Kriterium", "Geprüft", "Nicht prüfbar", "Treffer"]}
                zeilen={KRITERIUM_IDS.map((k) => [KRITERIEN[k].titel, ergebnis.abdeckung[k].geprueft, ergebnis.abdeckung[k].nichtPruefbar, ergebnis.abdeckung[k].treffer])}
              />
              <Hinweise liste={ergebnis.hinweise} />
            </Karte>
          )}

          {ergebnis && auswahl && (
            <>
              <Karte titel={`Auswahl: ${auswahl.a.ausgewaehlt.length} von ${ergebnis.anzahl} Buchungen`} norm={`${auswahl.a.risikobasiert.length} risikobasiert, ${auswahl.a.zufaellig.length} zufällig`}>
                <AuswahlAnzeige posten={posten} ids={auswahl.a.ausgewaehlt} seed={auswahl.a.seed} methode="Journalprüfung (risikobasiert plus Zufall)" notiz={auswahl.notiz} dateiname={`journal-seed${auswahl.a.seed}.csv`} hinweise={auswahl.a.hinweise} bemerkung={bemerkung} />
              </Karte>
              <Karte titel="Buchungen mit den meisten Treffern" norm="Rangfolge nach Anzahl Kriterien, dann Betrag">
                <Tabelle
                  kopf={["Zeile", "ID", "Treffer", "Gründe"]}
                  zeilen={ergebnis.ergebnisse.filter((e) => e.score > 0).slice(0, 50).map((e) => [e.excelZeile, e.id, e.score, e.gruende.join(" · ")])}
                />
              </Karte>
            </>
          )}
        </>
      )}
    </div>
  );
}
