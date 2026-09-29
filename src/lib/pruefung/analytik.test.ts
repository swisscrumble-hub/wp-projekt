import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnalytikFehler, debitorenlaufzeitTage, eigenkapitalquote, erwartungswertPruefung, horizontalanalyse, liquiditaetsgrad2, regression, trend, verhaeltnis, vertikalanalyse,
} from "./analytik";

const nah = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("Horizontalanalyse: Schwellen relativ UND absolut, Vorjahr 0 = neue Position", () => {
  const r = horizontalanalyse(
    [
      { konto: "Umsatz", aktuell: 1_200_000, vorjahr: 1_000_000 },
      { konto: "Porto", aktuell: 300, vorjahr: 100 },
      { konto: "Beratung", aktuell: 60_000, vorjahr: 0 },
      { konto: "Miete", aktuell: 100_000, vorjahr: 99_000 },
    ],
    { relativ: 0.1, absolut: 10_000 },
  );
  const f = Object.fromEntries(r.ergebnisse.map((e) => [e.konto, e]));
  assert.equal(f.Umsatz!.auffaellig, true);
  nah(f.Umsatz!.abweichungProzent!, 20);
  assert.equal(f.Porto!.auffaellig, false, "hohe relative, aber kleine absolute Abweichung");
  assert.equal(f.Beratung!.abweichungProzent, null);
  assert.equal(f.Beratung!.auffaellig, true);
  assert.equal(f.Miete!.auffaellig, false);
  assert.match(r.hinweise[0]!, /kein Nachweis/);
});

test("Vertikalanalyse: Anteile und Strukturveränderung; Basis 0 wird abgelehnt", () => {
  const r = vertikalanalyse([{ konto: "Vorräte", aktuell: 200, vorjahr: 100 }], { aktuell: 1000, vorjahr: 1000 });
  nah(r.ergebnisse[0]!.anteilProzent, 20);
  nah(r.ergebnisse[0]!.veraenderungProzentpunkte!, 10);
  assert.throws(() => vertikalanalyse([], { aktuell: 0 }), AnalytikFehler);
});

test("Kennzahlen: Division durch 0 ergibt null, nie Infinity", () => {
  assert.equal(verhaeltnis(1, 0), null);
  assert.equal(eigenkapitalquote(300, 1000), 0.3);
  assert.equal(liquiditaetsgrad2(100, 200, 300), 1);
  assert.equal(debitorenlaufzeitTage(100, 0), null);
  nah(debitorenlaufzeitTage(50, 365)!, 50);
});

test("Regression: exakte Gerade y = 2x + 1", () => {
  const r = regression([1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x + 1 })));
  nah(r.steigung, 2);
  nah(r.achsenabschnitt, 1);
  nah(r.r2, 1);
  assert.throws(() => regression([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]), AnalytikFehler);
  assert.throws(() => regression([{ x: 1, y: 1 }, { x: 2, y: 2 }]), AnalytikFehler);
});

const energie = [[100, 52], [120, 61], [140, 69], [160, 82], [180, 88], [200, 101], [220, 109], [240, 121]].map(([x, y]) => ({ x: x!, y: y! }));

test("Erwartungswert: Ist im Band → nicht ausserhalb; grosse Abweichung → ausserhalb", () => {
  const ok = erwartungswertPruefung({ historie: energie, xAktuell: 190, istWert: 96 });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.ausserhalb, false);
  const auff = erwartungswertPruefung({ historie: energie, xAktuell: 190, istWert: 140 });
  if (auff.ok) {
    assert.equal(auff.ausserhalb, true);
    assert.ok(auff.abweichung > 30);
  }
});

test("Erwartungswert: zu wenig Daten → keine Berechnung; Extrapolation und schwaches R² werden vermerkt", () => {
  const knapp = erwartungswertPruefung({ historie: energie.slice(0, 4), xAktuell: 190, istWert: 96 });
  assert.equal(knapp.ok, false);
  if (!knapp.ok) assert.match(knapp.grund, /Unzureichende Datenbasis/);
  const extra = erwartungswertPruefung({ historie: energie, xAktuell: 400, istWert: 200 });
  if (extra.ok) assert.match(extra.hinweise.join(" "), /Extrapolation/);
  const rauschen = [1, 2, 3, 4, 5, 6, 7].map((x, i) => ({ x, y: [5, 1, 9, 2, 8, 1, 7][i]! }));
  const schwach = erwartungswertPruefung({ historie: rauschen, xAktuell: 4, istWert: 5 });
  if (schwach.ok) assert.match(schwach.hinweise.join(" "), /R²/);
});

test("Trend: steigende Reihe", () => {
  nah(trend([10, 20, 30, 40, 50, 60]).steigungProPeriode, 10);
  assert.match(trend([1, 2, 3]).hinweise[0]!, /Kurze Zeitreihe/);
});
