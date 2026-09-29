"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { DateiFehler, leseDatei, type Blatt } from "@/lib/datei";
import { HAEUFIGKEIT_LABEL } from "@/lib/hwp/kontrollen";
import { findeKopfzeile } from "@/lib/import";
import { IksFehler, PRUEFART_LABEL, erzeugePruefplan, leseIksMatrix, pruefplanAlsCsv, schlageIksSpaltenVor, type IksKontrolle, type IksMatrix, type IksSpalten, type Pruefart, type Pruefplan, type Pruefplanzeile } from "@/lib/iks";
import SpaltenWahl from "@/components/SpaltenWahl";
import { Auswahl, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle, lade } from "@/components/ui";

const FELDER: [keyof IksSpalten, string][] = [
  ["kontrolle", "Kontrolle (Beschreibung) *"],
  ["kontrollId", "Kontroll-ID"],
  ["prozess", "Prozess"],
  ["risikoId", "Risiko-ID"],
  ["risiko", "Risiko"],
  ["haeufigkeit", "Häufigkeit"],
  ["wirkung", "Kontrollart (präventiv/detektiv)"],
  ["ausfuehrung", "Ausführung (manuell/automatisiert)"],
  ["schluessel", "Schlüsselkontrolle (ja/nein)"],
  ["ebene", "Ebene (Einheit/Prozess/IT)"],
  ["verantwortlich", "Verantwortlich"],
  ["nachweis", "Nachweis"],
  ["zuletzt", "Zuletzt geprüft (Jahr)"],
];

export default function MatrixImport({ onFunktionspruefung }: { onFunktionspruefung: (k: IksKontrolle, z: Pruefplanzeile) => void }) {
  const [blaetter, setBlaetter] = useState<Blatt[] | null>(null);
  const [name, setName] = useState("");
  const [blatt, setBlatt] = useState(0);
  const [kopfNr, setKopfNr] = useState(1);
  const [spalten, setSpalten] = useState<IksSpalten>({});
  const [jahr, setJahr] = useState(String(new Date().getFullYear()));
  const [zyklus, setZyklus] = useState("3");
  const [nurSchluessel, setNurSchluessel] = useState(true);
  const [standard, setStandard] = useState<"existenz" | "funktion">("existenz");
  const [arten, setArten] = useState<Record<string, Pruefart>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const daten = useMemo(() => blaetter?.[blatt]?.data ?? [], [blaetter, blatt]);
  const kopf = daten[kopfNr - 1] ?? [];

  function vorschlag(d: Blatt["data"]) {
    const k = Math.max(findeKopfzeile(d), 0);
    setKopfNr(k + 1);
    setSpalten(schlageIksSpaltenVor(d[k] ?? []));
    setArten({});
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setBlaetter(null);
    setLaedt(true);
    try {
      const b = await leseDatei(datei);
      setBlaetter(b);
      setName(datei.name);
      setBlatt(0);
      vorschlag(b[0]!.data);
    } catch (e) {
      setFehler(e instanceof DateiFehler ? e.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setLaedt(false);
    }
  }

  const ergebnis = useMemo((): { matrix: IksMatrix; plan: Pruefplan } | { fehler: string } | null => {
    if (!blaetter) return null;
    try {
      const matrix = leseIksMatrix(daten, kopfNr - 1, spalten, { seiten: blaetter[blatt]?.seiten });
      const plan = erzeugePruefplan(matrix.kontrollen, { pruefjahr: Number(jahr), zyklus: Number(zyklus), nurSchluessel });
      return { matrix, plan };
    } catch (e) {
      return { fehler: e instanceof IksFehler ? e.message : "Die Matrix konnte nicht gelesen werden." };
    }
  }, [blaetter, blatt, daten, kopfNr, spalten, jahr, zyklus, nurSchluessel]);

  const ok = ergebnis && "plan" in ergebnis ? ergebnis : null;
  const artVorschlag = (z: Pruefplanzeile): Pruefart => (z.vorgeschlagen === "existenz" ? standard : z.vorgeschlagen);
  const art = (z: Pruefplanzeile): Pruefart => arten[z.kontrolle.id] ?? artVorschlag(z);
  const anzahl = (a: Pruefart) => ok?.plan.zeilen.filter((z) => art(z) === a).length ?? 0;

  return (
    <Karte titel="IKS-Matrix hochladen und Prüfplan erzeugen" norm="Die Datei wird im Browser gelesen und nicht hochgeladen. Grundlage: HWP OR 2024, Rz. 1398–1422 (Existenzprüfung des IKS).">
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <strong>Erwarteter Inhalt:</strong> je Zeile eine Kontrolle, mindestens mit Beschreibung; hilfreich sind Prozess, Risiko, Kontroll-ID, Häufigkeit, Kontrollart, Ausführung und Schlüsselkontrolle. Leere Zellen in Prozess und Risiko (verbundene Zellen) werden von oben aufgefüllt. Was fehlt, wird nicht geraten, sondern als Hinweis ausgewiesen.
      </p>
      <label className="flex min-h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-4 text-sm font-medium text-slate-800 active:bg-slate-100">
        <FileSpreadsheet className="h-5 w-5" aria-hidden />
        {laedt ? "Wird gelesen …" : name ? `Geladen: ${name} (andere Datei wählen)` : "IKS-Matrix (.xlsx oder .pdf) wählen"}
        <input type="file" accept=".xlsx,.pdf,application/pdf" className="sr-only" onChange={(e) => void dateiGewaehlt(e.target.files?.[0])} />
      </label>
      <Fehler text={fehler} />

      {blaetter && (
        <div className="space-y-4">
          {blaetter[blatt]?.hinweise && <Hinweise liste={blaetter[blatt]!.hinweise!} />}
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
            <Feld label="Prüfjahr" inputMode="numeric" value={jahr} onChange={(e) => setJahr(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {FELDER.map(([f, label]) => (
              <SpaltenWahl key={f} label={label} kopf={kopf} wert={spalten[f]} onChange={(i) => setSpalten((s) => ({ ...s, [f]: i }))} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld label="Planungszyklus (Jahre)" inputMode="numeric" value={zyklus} onChange={(e) => setZyklus(e.target.value)} hilfe="Prozess-Schlüsselkontrollen: spätestens alle 3 Jahre (Rz. 1410); Einheit und IT jährlich (Rz. 1409)" />
            <Auswahl label="Fällige Kontrollen prüfen als" value={standard} onChange={(e) => setStandard(e.target.value as "existenz" | "funktion")}>
              <option value="existenz">Existenzprüfung (Walk-through), genügt für Art. 728a OR (Rz. 1402, 1420)</option>
              <option value="funktion">Funktionsprüfung mit Stichprobe (deckt die Existenz ab)</option>
            </Auswahl>
            <label className="flex min-h-11 touch-manipulation items-center gap-3 self-end text-sm text-slate-800">
              <input type="checkbox" checked={nurSchluessel} onChange={(e) => setNurSchluessel(e.target.checked)} className="h-6 w-6" />
              Nur Schlüsselkontrollen prüfen (Rz. 1399)
            </label>
          </div>

          {ergebnis && "fehler" in ergebnis && <Fehler text={ergebnis.fehler} />}
          {ok && (
            <div className="space-y-4">
              <Tabelle
                kopf={["Kennzahl", "Wert"]}
                zeilen={[
                  ["Kontrollen gelesen", ok.matrix.kontrollen.length],
                  ["Geplant: Funktionsprüfung", anzahl("funktion")],
                  ["Geplant: nur Existenzprüfung", anzahl("existenz")],
                  ["Nicht geprüft (Rotation / keine Schlüsselkontrolle)", anzahl("keine")],
                ]}
              />
              <Hinweise liste={[...ok.plan.hinweise, ...ok.matrix.hinweise]} />
              {ok.matrix.luecken.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <p className="font-semibold">Lücken in der Matrix (Risiko ohne Kontrolle): Rückfrage beim Mandanten, Auswirkung auf die Prüfung beurteilen</p>
                  <ul className="list-disc pl-5">
                    {ok.matrix.luecken.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-3">
                {ok.plan.zeilen.map((z) => {
                  const k = z.kontrolle;
                  const a = art(z);
                  return (
                    <article key={k.id} className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-semibold">{k.id}</span>
                        <span className="text-xs text-slate-500">
                          {[k.prozess, k.ebene && `${k.ebene}${k.ebeneAbgeleitet ? " (abgeleitet)" : ""}`, k.haeufigkeit ? HAEUFIGKEIT_LABEL[k.haeufigkeit] : k.haeufigkeitRoh, k.wirkung, k.ausfuehrung, k.seite ? `Seite ${k.seite}` : `Zeile ${k.excelZeile}`].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <p>{k.kontrolle}</p>
                      {k.risiken.length > 0 && <p className="text-xs text-slate-600">Risiko: {k.risiken.join(" | ")}</p>}
                      <Auswahl label="Geplante Prüfung" value={a} onChange={(e) => setArten((x) => ({ ...x, [k.id]: e.target.value as Pruefart }))}>
                        {(Object.keys(PRUEFART_LABEL) as Pruefart[]).map((p) => (
                          <option key={p} value={p}>
                            {PRUEFART_LABEL[p]}
                            {p === artVorschlag(z) ? " – Vorschlag" : ""}
                          </option>
                        ))}
                      </Auswahl>
                      <p className="text-xs text-slate-600">{z.faelligGrund}</p>
                      {a === "funktion" && (
                        <p>
                          <strong>Umfang:</strong> {z.funktion.umfangText}
                        </p>
                      )}
                      {a === "existenz" && (
                        <ul className="list-disc pl-5">
                          {z.existenz.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      )}
                      {z.hinweise.length > 0 && <Hinweise liste={z.hinweise} />}
                      {a === "funktion" && (
                        <Knopf onClick={() => onFunktionspruefung(k, z)}>Funktionsprüfung durchführen (Vorgangsliste hochladen)</Knopf>
                      )}
                    </article>
                  );
                })}
              </div>
              <Knopf onClick={() => lade(pruefplanAlsCsv(ok.plan, Object.fromEntries(ok.plan.zeilen.map((z) => [z.kontrolle.id, art(z)])), { pruefjahr: Number(jahr) }), `pruefplan-kontrollen-${jahr}.csv`)}>Prüfplan als CSV herunterladen</Knopf>
              <p className="text-xs text-slate-500">
                Der Prüfplan ist ein Vorschlag auf Grundlage der Matrix. Ob eine Kontrolle eine Schlüsselkontrolle ist, wie sie gestaltet ist und ob sich die Rahmenbedingungen geändert haben, beurteilt der Prüfer. Die Staffelung der Stichprobe ist indikativ (Q&amp;A zur CMS-Prüfung, PS-CH 980).
              </p>
            </div>
          )}
        </div>
      )}
    </Karte>
  );
}
