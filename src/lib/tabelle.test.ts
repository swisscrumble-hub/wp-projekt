import assert from "node:assert/strict";
import { test } from "node:test";
import { TabellenFehler, parseZahl, tabelleMitKopf, tabelleOhneKopf, zeilen } from "./tabelle";

test("parseZahl: Schweizer und deutsche Schreibweisen, ungültiges wird abgelehnt", () => {
  assert.equal(parseZahl("1'234.50"), 1234.5);
  assert.equal(parseZahl("1234,50"), 1234.5);
  assert.equal(parseZahl("-12.5"), -12.5);
  assert.equal(parseZahl("1,234,567"), 1234567);
  assert.equal(parseZahl(" 100 "), 100);
  assert.throws(() => parseZahl("abc"), TabellenFehler);
  assert.throws(() => parseZahl(""), TabellenFehler);
  assert.throws(() => parseZahl("1e5"), TabellenFehler);
});

test("Trennzeichen werden erkannt; Kommentare und Leerzeilen ignoriert", () => {
  assert.deepEqual(zeilen("a;1\n\n# x\nb;2"), [["a", "1"], ["b", "2"]]);
  assert.deepEqual(zeilen("a\t1\nb\t2"), [["a", "1"], ["b", "2"]]);
  assert.deepEqual(zeilen("a,1"), [["a", "1"]]);
});

test("Kopfzeile wird übersprungen, zu wenige Spalten melden die Zeile", () => {
  assert.equal(tabelleOhneKopf("id;betrag\nA;10\nB;20", 2, [1]).length, 2);
  assert.equal(tabelleOhneKopf("A;10\nB;20", 2, [1]).length, 2);
  assert.throws(() => tabelleOhneKopf("A;10\nB", 2, [1]), /Zeile 2/);
});

test("Tabelle mit Kopf: Spaltennamen kleingeschrieben", () => {
  assert.deepEqual(tabelleMitKopf("ID;Datum\n1;2025-01-01"), [{ id: "1", datum: "2025-01-01" }]);
  assert.throws(() => tabelleMitKopf("nur Kopf"), TabellenFehler);
});
