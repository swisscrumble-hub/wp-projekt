import assert from "node:assert/strict";
import { test } from "node:test";
import {
  StichprobenFehler, attributAuswertung, attributStichprobenumfang, geschichteteAuswahl, hochrechnungVerhaeltnis,
  monetaereAuswahl, musAuswertung, musStichprobenumfang, poissonFaktor, systematischeAuswahl, zufallsauswahl, type Posten,
} from "./stichprobe";

const nah = (a: number, b: number, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const liste = (n: number, wert = 100): Posten[] => Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, buchwert: wert }));

test("Poisson-Faktoren entsprechen den Tabellenwerten (95 % / 90 %)", () => {
  nah(poissonFaktor(0, 0.95), 2.9957);
  nah(poissonFaktor(1, 0.95), 4.7439);
  nah(poissonFaktor(2, 0.95), 6.2953);
  nah(poissonFaktor(3, 0.95), 7.7537);
  nah(poissonFaktor(0, 0.9), 2.3026);
  nah(poissonFaktor(1, 0.9), 3.8897);
});

test("Zufallsauswahl: reproduzierbar, ohne Duplikate, richtiger Umfang", () => {
  const a = zufallsauswahl(liste(100), 10, 42);
  const b = zufallsauswahl(liste(100), 10, 42);
  assert.deepEqual(a.ausgewaehlt, b.ausgewaehlt);
  assert.equal(new Set(a.ausgewaehlt).size, 10);
  assert.notDeepEqual(a.ausgewaehlt, zufallsauswahl(liste(100), 10, 43).ausgewaehlt);
});

test("Eingaben werden abgelehnt: leer, doppelte ID, Umfang zu gross", () => {
  assert.throws(() => zufallsauswahl([], 1, 1), StichprobenFehler);
  assert.throws(() => zufallsauswahl([{ id: "a", buchwert: 1 }, { id: "a", buchwert: 2 }], 1, 1), StichprobenFehler);
  assert.throws(() => zufallsauswahl(liste(5), 6, 1), StichprobenFehler);
  assert.throws(() => zufallsauswahl(liste(5), 0, 1), StichprobenFehler);
});

test("Systematische Auswahl: n Posten, gleichmässiger Abstand", () => {
  const r = systematischeAuswahl(liste(100), 10, 7);
  assert.equal(r.ausgewaehlt.length, 10);
  const idx = r.ausgewaehlt.map((id) => Number(id.slice(1)) - 1);
  idx.slice(1).forEach((v, i) => assert.ok(v - idx[i]! === 10));
});

test("MUS: grosse Posten sicher, Rest ergibt insgesamt n Treffer, Buchwert ≤ 0 ausgeschlossen", () => {
  const posten: Posten[] = [{ id: "G", buchwert: 5000 }, { id: "Neg", buchwert: -50 }, { id: "Null", buchwert: 0 }, ...liste(50, 100)];
  const r = monetaereAuswahl(posten, 10, 1);
  assert.deepEqual(r.sicherAusgewaehlt, ["G"]);
  assert.ok(!r.ausgewaehlt.includes("Neg") && !r.ausgewaehlt.includes("Null"));
  assert.equal(r.ausgewaehlt.length, 10);
  assert.match(r.hinweise.join(" "), /Buchwert ≤ 0/);
  assert.deepEqual(r.ausgewaehlt, monetaereAuswahl(posten, 10, 1).ausgewaehlt);
});

test("MUS: Auswahlwahrscheinlichkeit ist proportional zum Buchwert", () => {
  const posten: Posten[] = [{ id: "klein", buchwert: 100 }, { id: "gross", buchwert: 900 }, ...liste(0)];
  let gross = 0;
  const lauf = 2000;
  for (let s = 1; s <= lauf; s++) if (monetaereAuswahl(posten, 1, s).ausgewaehlt.includes("gross")) gross++;
  nah(gross / lauf, 0.9, 0.03);
});

test("MUS-Umfang: 1'000'000 / Toleranz 50'000 / 95 % → 60", () => {
  const u = musStichprobenumfang({ buchwert: 1_000_000, toleranz: 50_000, konfidenz: 0.95 });
  assert.equal(u.n, 60);
  assert.throws(() => musStichprobenumfang({ buchwert: 100, toleranz: 200, konfidenz: 0.95 }), StichprobenFehler);
});

test("MUS-Auswertung ohne Fehler: obere Grenze = RF × Intervall", () => {
  const a = musAuswertung({ intervall: 10_000, konfidenz: 0.95, toleranz: 50_000, fehler: [] });
  nah(a.obereFehlergrenze, 29_957, 1);
  assert.match(a.vergleich, /innerhalb/);
});

test("MUS-Auswertung Stringer: ein Fehler mit Taint 50 %", () => {
  const a = musAuswertung({ intervall: 10_000, konfidenz: 0.95, toleranz: 30_000, fehler: [{ id: "x", buchwert: 200, gepruefterWert: 100 }] });
  nah(a.projizierteFehlaussage, 5_000, 1);
  nah(a.obereFehlergrenze, 29_957 + 5_000 * (4.7439 - 2.9957), 2);
  assert.match(a.vergleich, /über/);
});

test("MUS-Auswertung: Fehler in sicherem Posten wird nicht hochgerechnet; Unterbewertung nicht saldiert", () => {
  const a = musAuswertung({
    intervall: 10_000, konfidenz: 0.95, toleranz: 100_000,
    fehler: [{ id: "gross", buchwert: 20_000, gepruefterWert: 19_000 }, { id: "u", buchwert: 500, gepruefterWert: 600 }],
  });
  assert.equal(a.bekannteFehlaussageSichereFaelle, 1000);
  assert.equal(a.projizierteFehlaussage, 0);
  assert.equal(a.unterbewertungenNichtSaldiert, 100);
});

test("Attribut: 5 % Toleranz, 95 % → 59; Auswertung 0 von 59 → 4.95 %", () => {
  assert.equal(attributStichprobenumfang({ tolerierbareRate: 0.05, konfidenz: 0.95 }).n, 59);
  nah(attributAuswertung({ n: 59, abweichungen: 0, konfidenz: 0.95, tolerierbareRate: 0.05 }).obereGrenze, 1 - Math.pow(0.05, 1 / 59), 1e-4);
  assert.ok(attributStichprobenumfang({ tolerierbareRate: 0.05, konfidenz: 0.95, erwarteteAbweichungen: 1 }).n > 59);
  assert.match(attributAuswertung({ n: 59, abweichungen: 2, konfidenz: 0.95, tolerierbareRate: 0.05 }).vergleich, /über/);
});

test("Nicht-statistisch: Schichtung und Verhältnis-Hochrechnung mit Hinweisen", () => {
  const g = geschichteteAuswahl([{ id: "a", buchwert: 1000 }, ...liste(20)], 500, 3, 5);
  assert.deepEqual(g.vollstaendigGeprueft, ["a"]);
  assert.equal(g.ausgewaehlt.length, 4);
  const h = hochrechnungVerhaeltnis({ grundgesamtheitWert: 1_000_000, stichprobeWert: 200_000, fehlerSumme: 1_000 });
  assert.equal(h.projizierteFehlaussage, 5_000);
  assert.match(h.hinweise[0]!, /ohne Konfidenz/);
  assert.throws(() => hochrechnungVerhaeltnis({ grundgesamtheitWert: 10, stichprobeWert: 20, fehlerSumme: 1 }), StichprobenFehler);
});
