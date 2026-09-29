"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { MAX_DATEI_BYTES, findeKopfzeile, importiere, schlageSpaltenVor, type ImportErgebnis, type Spalten, type Zelle } from "@/lib/import";
import { Auswahl, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, chf } from "@/components/ui";

type Blatt = { sheet: string; data: Zelle[][] };
const KEINE = "-1";

function SpaltenWahl({ label, kopf, wert, onChange }: { label: string; kopf: Zelle[]; wert?: number; onChange: (i?: number) => void }) {
  return (
    <Auswahl label={label} value={wert === undefined ? KEINE : String(wert)} onChange={(e) => onChange(e.target.value === KEINE ? undefined : Number(e.target.value))}>
      <option value={KEINE}>– nicht verwenden –</option>
      {kopf.map((k, i) => (
        <option key={i} value={i}>
          {`${i + 1}: ${k == null || k === "" ? "(ohne Titel)" : String(k)}`}
        </option>
      ))}
    </Auswahl>
  );
}

type Erweitert = "erfasser" | "freigeber" | "manuell" | "erfassungsdatum" | "freigabedatum";
const ERWEITERT_LABEL: Record<Erweitert, string> = {
  erfasser: "Erfasser",
  freigeber: "Freigeber",
  manuell: "Buchungsart (manuell/automatisch)",
  erfassungsdatum: "Erfassungsdatum",
  freigabedatum: "Freigabedatum",
};

export default function ExcelImport({
  onUebernehmen,
  erweitert = [],
  betragOptional = false,
  erwartet,
  voreinstellung,
  titel = "Excel-Datei importieren",
}: {
  onUebernehmen: (e: ImportErgebnis, dateiname: string, spalten: Spalten) => void;
  erweitert?: Erweitert[];
  /** Kontrollprüfung: Die Datei darf eine reine Vorgangsliste ohne Beträge sein. */
  betragOptional?: boolean;
  /** Was die Datei enthalten soll (Anzeige) */
  erwartet?: { titel: string; spalten: string };
  voreinstellung?: { konten?: string; datumVon?: string; datumBis?: string; vorzeichen?: "soll" | "haben" };
  titel?: string;
}) {
  const [blaetter, setBlaetter] = useState<Blatt[] | null>(null);
  const [name, setName] = useState("");
  const [blatt, setBlatt] = useState(0);
  const [kopfNr, setKopfNr] = useState(1);
  const [spalten, setSpalten] = useState<Spalten>({});
  const [modus, setModus] = useState<"betrag" | "sollhaben">("betrag");
  const [absolut, setAbsolut] = useState(true);
  const [konten, setKonten] = useState(voreinstellung?.konten ?? "");
  const [von, setVon] = useState(voreinstellung?.datumVon ?? "");
  const [bis, setBis] = useState(voreinstellung?.datumBis ?? "");
  const [ohneBetrag, setOhneBetrag] = useState(false);
  const [vorzeichen, setVorzeichen] = useState<"" | "soll" | "haben">(voreinstellung?.vorzeichen ?? "");
  const [minBetrag, setMinBetrag] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const daten = useMemo(() => blaetter?.[blatt]?.data ?? [], [blaetter, blatt]);
  const kopf = daten[kopfNr - 1] ?? [];

  function vorschlag(d: Zelle[][]) {
    const k = Math.max(findeKopfzeile(d), 0);
    const s = schlageSpaltenVor(d[k] ?? []);
    setKopfNr(k + 1);
    setSpalten(s);
    setModus(s.soll !== undefined && s.haben !== undefined ? "sollhaben" : "betrag");
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setBlaetter(null);
    setName("");
    if (!/\.xlsx$/i.test(datei.name)) return setFehler("Nur .xlsx-Dateien werden gelesen. Andere Formate in Excel als .xlsx speichern oder die Tabelle unten einfügen.");
    if (datei.size > MAX_DATEI_BYTES) return setFehler("Die Datei ist grösser als 20 MB. Bitte eingrenzen.");
    setLaedt(true);
    try {
      const { default: lese } = await import("read-excel-file/universal");
      const sheets = (await lese(await datei.arrayBuffer())) as Blatt[];
      if (sheets.length === 0) throw new Error("leer");
      setBlaetter(sheets);
      setName(datei.name);
      setBlatt(0);
      vorschlag(sheets[0]!.data);
    } catch {
      setFehler("Die Datei konnte nicht gelesen werden. Ist es eine gültige, nicht passwortgeschützte .xlsx-Datei?");
    } finally {
      setLaedt(false);
    }
  }

  const ergebnis = useMemo(() => {
    if (!blaetter) return null;
    try {
      const wahl: Spalten = ohneBetrag
        ? { ...spalten, betrag: undefined, soll: undefined, haben: undefined }
        : modus === "betrag"
          ? { ...spalten, soll: undefined, haben: undefined }
          : { ...spalten, betrag: undefined };
      const erlaubt = new Set<string>(["id", "betrag", "soll", "haben", "datum", "konto", "text", ...erweitert]);
      for (const k of Object.keys(wahl) as (keyof Spalten)[]) if (!erlaubt.has(k)) delete wahl[k];
      const min = minBetrag.trim() ? Number(minBetrag.replace(/['’\s]/g, "").replace(",", ".")) : undefined;
      return {
        spalten: wahl,
        ok: importiere(daten, {
          kopfzeile: kopfNr - 1,
          spalten: wahl,
          absolut,
          ohneBetrag,
          filter: {
            konten: konten.split(",").map((k) => k.trim()).filter(Boolean),
            datumVon: von || undefined,
            datumBis: bis || undefined,
            minBetrag: min !== undefined && Number.isFinite(min) ? min : undefined,
            vorzeichen: vorzeichen || undefined,
          },
        }),
      };
    } catch (e) {
      return { fehler: e instanceof Error ? e.message : "Import nicht möglich." };
    }
  }, [blaetter, daten, kopfNr, spalten, modus, absolut, konten, von, bis, minBetrag, ohneBetrag, erweitert, vorzeichen]);

  const setzeSpalte = (feld: keyof Spalten) => (i?: number) => setSpalten((s) => ({ ...s, [feld]: i }));
  const r = ergebnis && "ok" in ergebnis ? ergebnis.ok : null;
  const gewaehlteSpalten: Spalten = ergebnis && "spalten" in ergebnis && ergebnis.spalten ? ergebnis.spalten : {};

  return (
    <Karte titel={titel} norm="Die Datei wird im Browser gelesen und nicht hochgeladen.">
      {erwartet && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <strong>{erwartet.titel}:</strong> {erwartet.spalten}
        </p>
      )}
      <label className="flex min-h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-4 text-sm font-medium text-slate-800 active:bg-slate-100">
        <FileSpreadsheet className="h-5 w-5" aria-hidden />
        {laedt ? "Wird gelesen …" : name ? `Geladen: ${name} (andere Datei wählen)` : ".xlsx-Datei wählen"}
        <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => void dateiGewaehlt(e.target.files?.[0])} />
      </label>
      <Fehler text={fehler} />

      {blaetter && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Auswahl
              label="Tabellenblatt"
              value={blatt}
              onChange={(e) => {
                const i = Number(e.target.value);
                setBlatt(i);
                vorschlag(blaetter[i]!.data);
              }}
            >
              {blaetter.map((b, i) => (
                <option key={i} value={i}>
                  {b.sheet} ({b.data.length} Zeilen)
                </option>
              ))}
            </Auswahl>
            <Feld label="Kopfzeile (Zeilennummer)" inputMode="numeric" value={kopfNr} onChange={(e) => setKopfNr(Math.max(1, Number(e.target.value) || 1))} hilfe="Zeile mit den Spaltentiteln" />
            <Auswahl label="Betrag aus" value={ohneBetrag ? "keiner" : modus} disabled={ohneBetrag} onChange={(e) => setModus(e.target.value as "betrag" | "sollhaben")}>
              <option value="betrag">einer Betragsspalte</option>
              <option value="sollhaben">Soll und Haben (Soll − Haben)</option>
              <option value="keiner">(keine Beträge)</option>
            </Auswahl>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SpaltenWahl label="Belegnummer / ID" kopf={kopf} wert={spalten.id} onChange={setzeSpalte("id")} />
            {ohneBetrag ? null : modus === "betrag" ? (
              <SpaltenWahl label="Betrag" kopf={kopf} wert={spalten.betrag} onChange={setzeSpalte("betrag")} />
            ) : (
              <>
                <SpaltenWahl label="Soll" kopf={kopf} wert={spalten.soll} onChange={setzeSpalte("soll")} />
                <SpaltenWahl label="Haben" kopf={kopf} wert={spalten.haben} onChange={setzeSpalte("haben")} />
              </>
            )}
            <SpaltenWahl label="Datum" kopf={kopf} wert={spalten.datum} onChange={setzeSpalte("datum")} />
            <SpaltenWahl label="Konto" kopf={kopf} wert={spalten.konto} onChange={setzeSpalte("konto")} />
            <SpaltenWahl label="Text" kopf={kopf} wert={spalten.text} onChange={setzeSpalte("text")} />
            {erweitert.map((f) => (
              <SpaltenWahl key={f} label={ERWEITERT_LABEL[f]} kopf={kopf} wert={spalten[f]} onChange={setzeSpalte(f)} />
            ))}
          </div>
          {betragOptional && (
            <label className="flex min-h-11 touch-manipulation items-center gap-3 text-sm text-slate-800">
              <input type="checkbox" checked={ohneBetrag} onChange={(e) => setOhneBetrag(e.target.checked)} className="h-6 w-6" />
              Die Datei enthält keine Beträge (reine Vorgangsliste)
            </label>
          )}
          <label className="flex min-h-11 touch-manipulation items-center gap-3 text-sm text-slate-800">
            <input type="checkbox" checked={absolut} onChange={(e) => setAbsolut(e.target.checked)} className="h-6 w-6" />
            Beträge als Absolutwert ziehen (Soll und Haben heben sich nicht auf)
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Feld label="Nur Konto/Konten" value={konten} onChange={(e) => setKonten(e.target.value)} placeholder="z. B. 1020, 1100" hilfe="Kommagetrennt, leer = alle" />
            <Feld label="Datum von" placeholder="2025-01-01" value={von} onChange={(e) => setVon(e.target.value)} />
            <Feld label="Datum bis" placeholder="2025-12-31" value={bis} onChange={(e) => setBis(e.target.value)} />
            <Feld label="Mindestbetrag" inputMode="decimal" value={minBetrag} onChange={(e) => setMinBetrag(e.target.value)} hilfe="Betrag ≥ Wert (absolut)" />
            {!ohneBetrag && (
              <Auswahl label="Buchungsseite" value={vorzeichen} onChange={(e) => setVorzeichen(e.target.value as "" | "soll" | "haben")}>
                <option value="">Soll und Haben</option>
                <option value="soll">Nur Soll (Betrag positiv)</option>
                <option value="haben">Nur Haben (Betrag negativ)</option>
              </Auswahl>
            )}
          </div>

          {ergebnis && "fehler" in ergebnis && <Fehler text={ergebnis.fehler ?? null} />}
          {r && (
            <div className="space-y-3">
              <Tabelle
                kopf={["Kontrollzahl", "Wert"]}
                zeilen={[
                  ["Zeilen gelesen (ohne leere)", r.kontrolle.zeilenGelesen],
                  ["Posten importiert", r.kontrolle.anzahl],
                  ["Summe (mit Vorzeichen)", chf(r.kontrolle.summe)],
                  ["Summe (Absolutwerte)", chf(r.kontrolle.summeAbsolut)],
                  ["Davon negativ / null", `${r.kontrolle.negativ} / ${r.kontrolle.null}`],
                ]}
              />
              <Hinweise liste={r.hinweise} />
              {r.uebersprungen.length > 0 && (
                <details className="text-sm text-slate-700">
                  <summary className="min-h-11 cursor-pointer py-2">Übersprungene Zeilen ({r.uebersprungen.length})</summary>
                  <ul className="list-disc pl-5">
                    {r.uebersprungen.slice(0, 50).map((u) => (
                      <li key={u.zeile}>
                        Zeile {u.zeile}: {u.grund}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Tabelle
                kopf={["Zeile", "ID", "Datum", "Konto", "Text", "Betrag"]}
                zeilen={r.posten.slice(0, 5).map((p) => [p.excelZeile, p.id, p.datum ?? "", p.konto ?? "", p.text ?? "", chf(p.betrag)])}
              />
              <Knopf disabled={r.posten.length === 0} onClick={() => onUebernehmen(r, name, gewaehlteSpalten)}>
                Als Grundgesamtheit übernehmen ({r.posten.length} Posten)
              </Knopf>
            </div>
          )}
        </div>
      )}
    </Karte>
  );
}
