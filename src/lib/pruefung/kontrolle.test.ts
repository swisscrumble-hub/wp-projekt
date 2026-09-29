import assert from "node:assert/strict";
import { test } from "node:test";
import type { Importiert, Spalten } from "../import";
import { kontrollDatentests, kontrollStichprobe } from "./kontrolle";

const v = (id: string, over: Partial<Importiert> = {}): Importiert => ({ id, excelZeile: Number(id.slice(1)) + 1, betrag: 0, buchwert: 0, datum: "2025-03-10", erfasser: "mk", freigeber: "ab", freigabedatum: "2025-03-09", ...over });
const S: Spalten = { id: 0, datum: 1, erfasser: 2, freigeber: 3, freigabedatum: 4 };

test("Funktionstrennung, fehlende Freigabe, verspätete Freigabe", () => {
  const r = kontrollDatentests(
    [v("V1"), v("V2", { freigeber: "MK " }), v("V3", { freigeber: undefined, freigabedatum: undefined }), v("V4", { freigabedatum: "2025-03-11" }), v("V5", { freigabedatum: "2025-03-10" })],
    S,
    ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
  );
  const por = Object.fromEntries(r.ergebnisse.map((e) => [e.test, e]));
  assert.deepEqual(por.funktionstrennung!.abweichungen.map((a) => a.id), ["V2"]);
  assert.equal(por.funktionstrennung!.nichtPruefbar, 1);
  assert.deepEqual(por.freigabe_fehlt!.abweichungen.map((a) => a.id), ["V3"]);
  assert.deepEqual(por.freigabe_verspaetet!.abweichungen.map((a) => a.id), ["V4"]);
  assert.match(r.hinweise[0]!, /Vollprüfung über alle 5 Vorgänge/);
  assert.match(r.hinweise[0]!, /nicht als wirksam belegt/);
});

test("Fehlende Spalten: Test «nicht prüfbar», keine stillen Bestwerte", () => {
  const r = kontrollDatentests([v("V1"), v("V2")], { id: 0 }, ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"]);
  for (const e of r.ergebnisse) {
    assert.equal(e.geprueft, 0);
    assert.equal(e.nichtPruefbar, 2);
    assert.equal(e.abweichungen.length, 0);
  }
  assert.match(r.hinweise.join(" "), /nicht prüfbar/);
});

test("Stichprobe über den Zeitraum: systematisch nach Datum sortiert, reproduzierbar", () => {
  const vorgaenge = Array.from({ length: 52 }, (_, i) => v(`V${i + 1}`, { datum: `2025-${String(Math.floor(i / 5) + 1).padStart(2, "0")}-${String((i % 5) + 1).padStart(2, "0")}` })).reverse();
  const a = kontrollStichprobe(vorgaenge, 5, 3, "systematisch");
  assert.equal(a.ausgewaehlt.length, 5);
  assert.deepEqual(a.ausgewaehlt, kontrollStichprobe(vorgaenge, 5, 3, "systematisch").ausgewaehlt);
  const monate = new Set(a.ausgewaehlt.map((id) => vorgaenge.find((x) => x.id === id)!.datum!.slice(0, 7)));
  assert.ok(monate.size >= 4, "die Auswahl verteilt sich über den Zeitraum");
  assert.equal(kontrollStichprobe(vorgaenge, 5, 3, "zufaellig").ausgewaehlt.length, 5);
});
