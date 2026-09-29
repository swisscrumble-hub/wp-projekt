import assert from "node:assert/strict";
import { test } from "node:test";
import readExcelFile from "read-excel-file/universal";
import { auswahlAlsCsv, csvZelle, findeKopfzeile, importiere, schlageSpaltenVor, zuManuell, type Zelle } from "./import";
import { TabellenFehler } from "./tabelle";
import { monetaereAuswahl } from "./pruefung/stichprobe";

// Kleine, erfundene Testdatei (Journal mit Leerzeile oben, Gutschrift, doppelter Belegnummer, Formelzelle, Summenzeile).
const XLSX_BASE64 = "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";

async function ladeFixture(): Promise<Zelle[][]> {
  const buf = Buffer.from(XLSX_BASE64, "base64");
  const sheets = await readExcelFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  return sheets[0]!.data as Zelle[][];
}

test("Excel-Datei: Kopfzeile und Spalten werden erkannt", async () => {
  const z = await ladeFixture();
  const k = findeKopfzeile(z);
  assert.equal(k, 1);
  const s = schlageSpaltenVor(z[k]!);
  assert.deepEqual(s, { id: 0, datum: 1, konto: 2, text: 3, soll: 4, haben: 5 });
});

test("Import Soll/Haben: Zeilennummern, Datum, Summenzeile übersprungen, eindeutige IDs, Kontrollzahlen", async () => {
  const z = await ladeFixture();
  const r = importiere(z, { kopfzeile: 1, spalten: schlageSpaltenVor(z[1]!), absolut: true });
  assert.equal(r.posten.length, 5);
  assert.deepEqual(r.uebersprungen, [{ zeile: 9, grund: "Summen-/Übertragszeile" }]);
  assert.equal(r.posten[0]!.excelZeile, 3);
  assert.equal(r.posten[0]!.datum, "2025-12-29");
  assert.equal(r.posten[0]!.id, "B-1");
  assert.deepEqual(r.posten.filter((p) => p.beleg === "B-3").map((p) => p.id), ["B-3#5", "B-3#6"]);
  assert.equal(r.posten[2]!.betrag, -750.5);
  assert.equal(r.posten[2]!.buchwert, 750.5);
  assert.equal(r.kontrolle.anzahl, 5);
  assert.equal(r.kontrolle.negativ, 1);
  assert.equal(r.kontrolle.summe, 5000 + 5000 - 750.5 + 120 + 99);
  assert.match(r.hinweise.join(" "), /Kontrollsumme/);
  assert.match(r.hinweise.join(" "), /Absolutwert/);
});

test("Filter: Konto, Datum, Mindestbetrag; Ausschluss wird vermerkt", async () => {
  const z = await ladeFixture();
  const basis = { kopfzeile: 1, spalten: schlageSpaltenVor(z[1]!), absolut: true } as const;
  assert.equal(importiere(z, { ...basis, filter: { konten: ["4000"] } }).posten.length, 2);
  assert.equal(importiere(z, { ...basis, filter: { datumVon: "2025-06-01", datumBis: "2025-12-31" } }).posten.length, 4);
  const r = importiere(z, { ...basis, filter: { minBetrag: 1000 } });
  assert.equal(r.posten.length, 2);
  assert.match(r.hinweise.join(" "), /durch die Filter ausgeschlossen/);
});

test("Ungültige Beträge werden mit Zeilennummer übersprungen; ohne Betragsspalte Fehler", () => {
  const z: Zelle[][] = [["Beleg", "Betrag"], ["A", 100], ["B", "abc"], ["C", "1'234.50"], ["D", null]];
  const r = importiere(z, { kopfzeile: 0, spalten: { id: 0, betrag: 1 }, absolut: false });
  assert.deepEqual(r.posten.map((p) => p.betrag), [100, 1234.5]);
  assert.deepEqual(r.uebersprungen.map((u) => u.zeile), [3, 5]);
  assert.throws(() => importiere(z, { kopfzeile: 0, spalten: { id: 0 }, absolut: false }), TabellenFehler);
  assert.throws(() => importiere(z, { kopfzeile: 9, spalten: { betrag: 1 }, absolut: false }), TabellenFehler);
});

test("Ohne Belegspalte: ID = «Zeile N»; Datum im Schweizer Format wird gelesen", () => {
  const z: Zelle[][] = [["Datum", "Betrag"], ["31.12.2025", 10], ["2025-01-02", 20], ["kaputt", 30]];
  const r = importiere(z, { kopfzeile: 0, spalten: { datum: 0, betrag: 1 }, absolut: false });
  assert.deepEqual(r.posten.map((p) => [p.id, p.datum]), [["Zeile 2", "2025-12-31"], ["Zeile 3", "2025-01-02"], ["Zeile 4", undefined]]);
  const gefiltert = importiere(z, { kopfzeile: 0, spalten: { datum: 0, betrag: 1 }, absolut: false, filter: { datumVon: "2025-01-01" } });
  assert.match(gefiltert.uebersprungen[0]!.grund, /Datum nicht lesbar/);
});

test("Import und Stichprobe zusammen: monetäre Auswahl aus dem Journal, Ergebnis rückverfolgbar", async () => {
  const z = await ladeFixture();
  const r = importiere(z, { kopfzeile: 1, spalten: schlageSpaltenVor(z[1]!), absolut: true });
  const a = monetaereAuswahl(r.posten.map((p) => ({ id: p.id, buchwert: p.buchwert })), 2, 7);
  assert.equal(a.ausgewaehlt.length, 2);
  a.ausgewaehlt.forEach((id) => assert.ok(r.posten.some((p) => p.id === id)));
});

test("CSV: Formeleinschleusung wird neutralisiert, Trennzeichen gequotet, BOM und Seed vorhanden", async () => {
  assert.equal(csvZelle("=cmd|calc"), "'=cmd|calc");
  assert.equal(csvZelle("+1"), "'+1");
  assert.equal(csvZelle('a;b"c'), '"a;b""c"');
  assert.equal(csvZelle("normal"), "normal");
  const z = await ladeFixture();
  const r = importiere(z, { kopfzeile: 1, spalten: schlageSpaltenVor(z[1]!), absolut: true });
  const csv = auswahlAlsCsv(r.posten, ["B-4"], { methode: "monetaer", seed: 7 });
  assert.ok(csv.startsWith("﻿# Methode: monetaer; Seed: 7"));
  assert.match(csv, /'=cmd\|calc/);
  assert.match(csv, /^7;B-4;B-4;2025-07-01/m);
});

test("Zusatzfelder: Erfasser, Freigeber, Buchungsart, Erfassungs- und Freigabedatum", () => {
  const z: Zelle[][] = [
    ["Beleg", "Betrag", "Erfasser", "Freigegeben von", "Buchungsart", "Erfasst am", "Freigabedatum"],
    ["A", 100, "mk", "ab", "manuell", "2026-01-05", "2026-01-06"],
    ["B", 200, "mk", "mk", "Schnittstelle", new Date(Date.UTC(2026, 0, 7)), null],
    ["C", 300, "xy", null, "unklar", null, null],
  ];
  const s = schlageSpaltenVor(z[0]!);
  assert.deepEqual(s, { id: 0, betrag: 1, erfasser: 2, freigeber: 3, manuell: 4, erfassungsdatum: 5, freigabedatum: 6 });
  const r = importiere(z, { kopfzeile: 0, spalten: s, absolut: false });
  assert.deepEqual(r.posten.map((p) => [p.erfasser, p.freigeber, p.manuell, p.erfassungsdatum, p.freigabedatum]), [
    ["mk", "ab", true, "2026-01-05", "2026-01-06"],
    ["mk", "mk", false, "2026-01-07", undefined],
    ["xy", undefined, undefined, undefined, undefined],
  ]);
  const csv = auswahlAlsCsv(r.posten, ["A"], { methode: "zufaellig", seed: 1 });
  assert.match(csv, /Erfasser;Freigeber;Manuell;Erfassungsdatum;Freigabedatum/);
  assert.match(csv, /mk;ab;ja;2026-01-05;2026-01-06/);
});

test("Buchungsart: unbekannte Werte werden nie geraten", () => {
  assert.equal(zuManuell("Ja"), true);
  assert.equal(zuManuell("System"), false);
  assert.equal(zuManuell("Sonstiges"), undefined);
  assert.equal(zuManuell(null), undefined);
});

test("Vorgangsliste ohne Betrag (Kontrollprüfung): Betrag 0, keine Betragsfehler", () => {
  const z: Zelle[][] = [["Beleg", "Datum"], ["V-1", "2026-01-05"], ["V-2", "2026-02-05"]];
  const r = importiere(z, { kopfzeile: 0, spalten: { id: 0, datum: 1 }, absolut: false, ohneBetrag: true });
  assert.equal(r.posten.length, 2);
  assert.equal(r.uebersprungen.length, 0);
  assert.equal(r.posten[0]!.betrag, 0);
});

test("Buchungsseite: nur Soll oder nur Haben; der Ausschluss wird vermerkt", () => {
  const z: Zelle[][] = [["Beleg", "Soll", "Haben"], ["A", 100, null], ["B", null, 50], ["C", 30, null], ["D", 0, 0]];
  const basis = { kopfzeile: 0, spalten: { id: 0, soll: 1, haben: 2 }, absolut: true } as const;
  assert.deepEqual(importiere(z, { ...basis, filter: { vorzeichen: "soll" } }).posten.map((p) => p.id), ["A", "C"]);
  const haben = importiere(z, { ...basis, filter: { vorzeichen: "haben" } });
  assert.deepEqual(haben.posten.map((p) => [p.id, p.betrag, p.buchwert]), [["B", -50, 50]]);
  assert.match(haben.hinweise.join(" "), /durch die Filter ausgeschlossen/);
});
