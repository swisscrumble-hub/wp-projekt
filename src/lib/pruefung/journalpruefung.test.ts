import assert from "node:assert/strict";
import { test } from "node:test";
import type { Importiert, Spalten } from "../import";
import { JournalFehler, KRITERIUM_IDS, pruefeJournal, waehleJournal } from "./journalpruefung";

const P = { stichtag: "2025-12-31" };
let zaehler = 0;
const b = (over: Partial<Importiert> = {}): Importiert => {
  zaehler++;
  return { id: `J${zaehler}`, excelZeile: zaehler + 1, datum: "2025-06-10", konto: "4000", text: "Miete Juni", betrag: 1234.56, buchwert: 1234.56, ...over };
};
const VOLL: Spalten = { id: 0, betrag: 1, datum: 2, konto: 3, text: 4, erfasser: 5, manuell: 6, erfassungsdatum: 7 };
const kriterien = (r: ReturnType<typeof pruefeJournal>, id: string) => r.ergebnisse.find((e) => e.id === id)?.kriterien ?? [];

/** Grundrauschen: viele normale Buchungen auf 6 Konten von 4 Erfassern */
function grund(n = 60): Importiert[] {
  return Array.from({ length: n }, (_, i) => b({ id: `G${i}`, konto: String(4000 + (i % 6)), erfasser: ["a", "b", "c", "d"][i % 4], betrag: 100 + i * 7.13, manuell: false, datum: `2025-0${(i % 9) + 1}-1${i % 9}` }));
}

test("Periodenende und nachträgliche Erfassung", () => {
  const r = pruefeJournal([...grund(), b({ id: "E", datum: "2025-12-29" }), b({ id: "N", datum: "2025-12-20", erfassungsdatum: "2026-01-15" }), b({ id: "F", datum: "2025-12-20", erfassungsdatum: "2025-12-20" })], VOLL, P);
  assert.ok(kriterien(r, "E").includes("periodenende"));
  assert.ok(kriterien(r, "N").includes("nachtraeglich"));
  assert.ok(!kriterien(r, "F").includes("nachtraeglich"));
  assert.ok(!kriterien(r, "F").includes("periodenende"));
});

test("Wochenende/Feiertag nur bei manuellen Buchungen, wenn die Buchungsart vorhanden ist", () => {
  const r = pruefeJournal(
    [...grund(), b({ id: "SAm", datum: "2025-06-14", manuell: true }), b({ id: "SAa", datum: "2025-06-14", manuell: false }), b({ id: "FT", datum: "2025-08-01", manuell: true }), b({ id: "MO", datum: "2025-06-16", manuell: true })],
    VOLL,
    { ...P, feiertage: ["2025-08-01"] },
  );
  assert.ok(kriterien(r, "SAm").includes("wochenende_feiertag"));
  assert.ok(!kriterien(r, "SAa").includes("wochenende_feiertag"));
  assert.ok(kriterien(r, "FT").includes("wochenende_feiertag"));
  assert.ok(!kriterien(r, "MO").includes("wochenende_feiertag"));
});

test("Ohne Buchungsart werden alle Wochenendbuchungen markiert", () => {
  const s: Spalten = { id: 0, betrag: 1, datum: 2 };
  const r = pruefeJournal([b({ id: "x", datum: "2025-06-14", manuell: undefined })], s, P);
  assert.ok(kriterien(r, "x").includes("wochenende_feiertag"));
});

test("Runde Zahlen und gleiche Endziffern", () => {
  const r = pruefeJournal([...grund(), b({ id: "R", betrag: 50_000 }), b({ id: "K", betrag: 5_000 }), b({ id: "E", betrag: 12_777 }), b({ id: "C", betrag: 20_000.5 })], VOLL, P);
  assert.ok(kriterien(r, "R").includes("runde_zahl"));
  assert.ok(!kriterien(r, "K").includes("runde_zahl"), "unter Mindestbetrag");
  assert.ok(kriterien(r, "E").includes("runde_zahl"));
  assert.ok(!kriterien(r, "C").includes("runde_zahl"));
});

test("Seltene Konten, seltene Erfasser, fehlende Erläuterung, Risikokonto, manuell", () => {
  const r = pruefeJournal(
    [...grund(), b({ id: "SK", konto: "9999", erfasser: "a" }), b({ id: "SE", erfasser: "praktikant" }), b({ id: "T", text: "" }), b({ id: "RK", konto: "4001" }), b({ id: "M", manuell: true })],
    VOLL,
    { ...P, risikokonten: ["4001"], seltenErfasserAnteil: 0.03 },
  );
  assert.ok(kriterien(r, "SK").includes("selten_konto"));
  assert.ok(kriterien(r, "SE").includes("selten_erfasser"));
  assert.ok(kriterien(r, "T").includes("ohne_erlaeuterung"));
  assert.ok(kriterien(r, "RK").includes("risikokonto"));
  assert.ok(kriterien(r, "M").includes("manuell"));
  assert.ok(r.anteilManuell !== undefined && r.anteilManuell > 0);
});

test("Wiederholung: gleicher Betrag auf gleichem Konto, monatliche Abfolge wird erkannt", () => {
  const r = pruefeJournal(
    [...grund(), b({ id: "W1", konto: "4000", betrag: 777.77, datum: "2025-01-31" }), b({ id: "W2", konto: "4000", betrag: 777.77, datum: "2025-02-28" }), b({ id: "W3", konto: "4000", betrag: 777.77, datum: "2025-03-31" }), b({ id: "W4", konto: "4000", betrag: 888.88, datum: "2025-04-30" })],
    VOLL,
    P,
  );
  assert.ok(kriterien(r, "W1").includes("wiederholung"));
  assert.match(r.ergebnisse.find((e) => e.id === "W2")!.gruende.join(" "), /monatlicher Abfolge/);
  assert.ok(!kriterien(r, "W4").includes("wiederholung"));
});

test("Fehlende Spalten: Kriterium «nicht prüfbar», nie stillschweigend erfüllt", () => {
  const s: Spalten = { id: 0, betrag: 1 };
  const r = pruefeJournal([b({ id: "a" }), b({ id: "b" })], s, P);
  for (const k of ["selten_konto", "selten_erfasser", "periodenende", "nachtraeglich", "ohne_erlaeuterung", "ohne_konto", "risikokonto", "manuell"] as const) {
    assert.equal(r.abdeckung[k].geprueft, 0, k);
    assert.equal(r.abdeckung[k].nichtPruefbar, 2, k);
  }
  assert.match(r.hinweise.join(" "), /nicht prüfbar/);
  assert.match(r.hinweise[0]!, /keine Feststellung/);
  assert.match(r.hinweise[1]!, /ISA-CH 240/);
  assert.match(r.hinweise[1]!, /nicht die überarbeitete Fassung ISA 240 \(Revised\)/);
});

test("Alle Kriterien haben eine Abdeckungszeile; Score = Anzahl Treffer; Sortierung nach Score, dann Betrag", () => {
  const r = pruefeJournal([...grund(), b({ id: "H", betrag: 50_000, datum: "2025-12-30", text: "" }), b({ id: "L", betrag: 60_000 })], VOLL, P);
  assert.deepEqual(Object.keys(r.abdeckung).sort(), [...KRITERIUM_IDS].sort());
  const h = r.ergebnisse.find((e) => e.id === "H")!;
  assert.equal(h.score, h.kriterien.length);
  assert.ok(h.score >= 3);
  assert.equal(r.ergebnisse[0]!.id, "H");
});

test("Auswahl: Risikoanteil zuerst, Zufallsanteil aus dem Rest, reproduzierbar, ohne Duplikate", () => {
  const mittel = Array.from({ length: 8 }, (_, i) => b({ id: `T${i}`, text: "", betrag: 100 + i }));
  const journal = [...grund(), ...mittel, b({ id: "H1", betrag: 50_000, datum: "2025-12-30", text: "" }), b({ id: "H2", betrag: 40_000, datum: "2025-12-31", text: "" })];
  const r = pruefeJournal(journal, VOLL, P);
  const a = waehleJournal(r, 10, 42, 0.2);
  assert.equal(a.ausgewaehlt.length, 10);
  assert.equal(new Set(a.ausgewaehlt).size, 10);
  assert.equal(a.zufaellig.length, 2);
  assert.ok(a.periodenende.includes("H1") && a.periodenende.includes("H2"), "Buchungen zum Periodenende sind Pflichtbestandteil");
  assert.deepEqual(a.ausgewaehlt, waehleJournal(r, 10, 42, 0.2).ausgewaehlt);
  assert.notDeepEqual(a.zufaellig, waehleJournal(r, 10, 43, 0.2).zufaellig);
  const alle = waehleJournal(r, 5000, 1);
  assert.equal(alle.ausgewaehlt.length, r.anzahl);
  assert.match(alle.hinweise.join(" "), /alle Buchungen ausgewählt/);
});

test("Ungültige Eingaben", () => {
  assert.throws(() => pruefeJournal([b()], VOLL, { stichtag: "kein Datum" }), JournalFehler);
  assert.throws(() => pruefeJournal([], VOLL, P), JournalFehler);
  assert.throws(() => pruefeJournal([b()], VOLL, { ...P, wiederholungMin: 1 }), JournalFehler);
});

test("Ohne Kontonummer (ISA-CH 240 A44 (d))", () => {
  const r = pruefeJournal([...grund(), b({ id: "OK", konto: undefined })], VOLL, P);
  assert.ok(kriterien(r, "OK").includes("ohne_konto"));
  assert.ok(!kriterien(r, "G0").includes("ohne_konto"));
});

test("Ergänzende HWP-Kriterien lassen sich abschalten: keine Treffer, nicht in der Abdeckung, Hinweis vermerkt", () => {
  const journal = [b({ id: "S", datum: "2025-06-14", manuell: true }), b({ id: "W1", betrag: 777.77, datum: "2025-01-31" }), b({ id: "W2", betrag: 777.77, datum: "2025-02-28" }), b({ id: "W3", betrag: 777.77, datum: "2025-03-31" })];
  const an = pruefeJournal(journal, VOLL, P);
  assert.ok(kriterien(an, "S").includes("wochenende_feiertag"));
  const aus = pruefeJournal(journal, VOLL, { ...P, ergaenzendeKriterien: false });
  assert.ok(!kriterien(aus, "S").includes("wochenende_feiertag"));
  assert.ok(!kriterien(aus, "W1").includes("wiederholung"));
  assert.equal(aus.abdeckung.wochenende_feiertag.aktiv, false);
  assert.equal(aus.abdeckung.wochenende_feiertag.geprueft, 0);
  assert.equal(aus.abdeckung.wochenende_feiertag.nichtPruefbar, 0);
  assert.match(aus.hinweise.join(" "), /ausgeschaltet/);
  assert.match(an.hinweise.join(" "), /nicht im Text des ISA-CH 240/);
});

test("Auswahl: Ohne Buchungen zum Periodenende wird die Lücke gemeldet (Tz. 33(a)(ii))", () => {
  const r = pruefeJournal(grund(), VOLL, P);
  const a = waehleJournal(r, 10, 1);
  assert.equal(a.periodenende.length, 0);
  assert.match(a.hinweise.join(" "), /Tz\. 33\(a\)\(ii\) ist nicht erfüllt/);
});

test("Auswahl: Periodenende-Anteil begrenzt, Rest risikobasiert/zufällig, keine Duplikate", () => {
  const spaet = Array.from({ length: 10 }, (_, i) => b({ id: `P${i}`, datum: "2025-12-30", betrag: 100 + i }));
  const r = pruefeJournal([...grund(), ...spaet], VOLL, P);
  const a = waehleJournal(r, 10, 5, 0.2, 0.3);
  assert.equal(a.periodenende.length, 3);
  assert.equal(a.zufaellig.length, 2);
  assert.equal(new Set(a.ausgewaehlt).size, a.ausgewaehlt.length);
  assert.equal(a.ausgewaehlt.length, 10);
  assert.match(a.hinweise.join(" "), /Von 10 Buchungen zum Ende des Berichtszeitraums/);
});
