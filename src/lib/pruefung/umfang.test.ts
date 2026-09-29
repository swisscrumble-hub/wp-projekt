import assert from "node:assert/strict";
import { test } from "node:test";
import { StichprobenFehler } from "./stichprobe";
import { einzelfallUmfang, hochrechnungHwp, kontrollUmfang } from "./umfang";

test("Einzelfall: 95 % Standard, n = BV × 2.9957 / Toleranz, Begrenzung auf die Grundgesamtheit", () => {
  const u = einzelfallUmfang({ buchwert: 1_000_000, toleranz: 50_000, anzahlPosten: 500 });
  assert.equal(u.konfidenz, 0.95);
  assert.equal(u.n, 60);
  assert.equal(u.vollpruefung, false);
  const klein = einzelfallUmfang({ buchwert: 100_000, toleranz: 5_000, anzahlPosten: 20 });
  assert.equal(klein.rechnerisch, 60);
  assert.equal(klein.n, 20);
  assert.equal(klein.vollpruefung, true);
  assert.match(klein.hinweise.join(" "), /lückenlose Prüfung/);
});

test("Einzelfall: tiefere Konfidenz wird mit Verweis auf Rz. 775 vermerkt; ungültige Eingaben werden abgelehnt", () => {
  const u = einzelfallUmfang({ buchwert: 1_000_000, toleranz: 50_000, anzahlPosten: 500, konfidenz: 0.9 });
  assert.ok(u.n < 60);
  assert.match(u.hinweise.join(" "), /Rz\. 775/);
  assert.throws(() => einzelfallUmfang({ buchwert: 100, toleranz: 200, anzahlPosten: 5 }), StichprobenFehler);
  assert.throws(() => einzelfallUmfang({ buchwert: 100, toleranz: 10, anzahlPosten: 0 }), StichprobenFehler);
});

test("Kontrolle: Staffelung nach Häufigkeit", () => {
  assert.equal(kontrollUmfang({ haeufigkeit: "jaehrlich", anzahlVorgaenge: 1 }).n, 1);
  assert.equal(kontrollUmfang({ haeufigkeit: "monatlich", anzahlVorgaenge: 12 }).n, 2);
  assert.equal(kontrollUmfang({ haeufigkeit: "woechentlich", anzahlVorgaenge: 52 }).n, 5);
  assert.equal(kontrollUmfang({ haeufigkeit: "taeglich", anzahlVorgaenge: 250 }).n, 25);
  assert.equal(kontrollUmfang({ haeufigkeit: "automatisiert", anzahlVorgaenge: 900 }).n, 1);
  assert.match(kontrollUmfang({ haeufigkeit: "automatisiert", anzahlVorgaenge: 900 }).hinweise.join(" "), /Test of one/);
});

test("Kontrolle: öfter/unregelmässig = 10 %, höchstens 40; nie mehr als Vorgänge", () => {
  assert.equal(kontrollUmfang({ haeufigkeit: "haeufiger", anzahlVorgaenge: 100 }).n, 10);
  assert.equal(kontrollUmfang({ haeufigkeit: "haeufiger", anzahlVorgaenge: 5000 }).n, 40);
  assert.equal(kontrollUmfang({ haeufigkeit: "haeufiger", anzahlVorgaenge: 3 }).n, 1);
  const alle = kontrollUmfang({ haeufigkeit: "taeglich", anzahlVorgaenge: 10 });
  assert.equal(alle.n, 10);
  assert.equal(alle.vollpruefung, true);
  assert.throws(() => kontrollUmfang({ haeufigkeit: "monatlich", anzahlVorgaenge: 0 }), StichprobenFehler);
});

test("Kontrolle: Abweichung zwischen Häufigkeit und Dateiinhalt wird gemeldet", () => {
  assert.match(kontrollUmfang({ haeufigkeit: "monatlich", anzahlVorgaenge: 3 }).hinweise.join(" "), /etwa 12/);
  assert.doesNotMatch(kontrollUmfang({ haeufigkeit: "monatlich", anzahlVorgaenge: 12 }).hinweise.join(" "), /etwa 12/);
});

test("Hochrechnung nach Rz. 792 (Beispiel des Handbuchs): 62'500 + Anomalien 10'000 = 72'500", () => {
  const h = hochrechnungHwp({ grundgesamtheitWert: 1_000_000, stichprobeWert: 400_000, festgestellteFehler: 35_000, anomalien: 10_000 });
  assert.equal(h.fehlerAnteilProzent, 6.25);
  assert.equal(h.hochgerechnet, 62_500);
  assert.equal(h.total, 72_500);
  assert.match(h.hinweise[0]!, /Rz\. 793/);
  assert.throws(() => hochrechnungHwp({ grundgesamtheitWert: 100, stichprobeWert: 10, festgestellteFehler: 1, anomalien: 2 }), StichprobenFehler);
  assert.throws(() => hochrechnungHwp({ grundgesamtheitWert: 100, stichprobeWert: 200, festgestellteFehler: 1 }), StichprobenFehler);
});
