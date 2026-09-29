import assert from "node:assert/strict";
import { test } from "node:test";
import { GoingConcernFehler, INDIKATOREN, covenantPruefung, kapitalschutz, liquiditaetsprognose, wuerdigeFragebogen, type FragebogenAntworten } from "./goingConcern";

const alle = (antwort: "ja" | "nein" | "unbekannt"): FragebogenAntworten => Object.fromEntries(INDIKATOREN.map((i) => [i.id, { antwort }]));

test("Fragebogen: unvollständig wird nicht ausgewertet", () => {
  const a = alle("nein");
  delete a.f1;
  a.f2 = { antwort: "unbekannt" };
  const r = wuerdigeFragebogen(a);
  assert.equal(r.status, "unvollstaendig");
  assert.deepEqual(r.offen, ["f1", "f2"]);
  assert.match(r.hinweise[0]!, /Unzureichende Unterlagen/);
});

test("Fragebogen: vollständig ohne Ja sagt nicht «Fortführung gesichert»; mit Ja verweist auf die Würdigung", () => {
  const nein = wuerdigeFragebogen(alle("nein"));
  assert.equal(nein.status, "auswertbar");
  assert.match(nein.hinweise[0]!, /ersetzt nicht/);
  assert.ok(!/gesichert|in Ordnung/i.test(nein.hinweise.join(" ")));
  const a = alle("nein");
  a.f4 = { antwort: "ja" };
  const ja = wuerdigeFragebogen(a);
  assert.deepEqual(ja.bejaht, ["f4"]);
  assert.deepEqual(ja.ohneBegruendung, ["f4"]);
  assert.match(ja.hinweise.join(" "), /Pläne der Geschäftsleitung/);
});

test("Liquiditätsprognose: Saldo, Kreditlinie, erster Engpass, kurzer Horizont", () => {
  const r = liquiditaetsprognose({
    anfangsbestand: 100_000,
    freieKreditlinie: 50_000,
    monate: [
      { monat: "2026-01", einzahlungen: 200_000, auszahlungen: 250_000 },
      { monat: "2026-02", einzahlungen: 100_000, auszahlungen: 180_000 },
      { monat: "2026-03", einzahlungen: 100_000, auszahlungen: 150_000 },
    ],
  });
  assert.deepEqual(r.verlauf.map((v) => v.saldo), [50_000, -30_000, -80_000]);
  assert.equal(r.verlauf[1]!.kreditlinieInAnspruch, true);
  assert.equal(r.ersterEngpass, "2026-03");
  assert.equal(r.tiefpunkt.monat, "2026-03");
  assert.match(r.hinweise.join(" "), /kürzer als 12 Monate/);
  assert.throws(() => liquiditaetsprognose({ anfangsbestand: 0, freieKreditlinie: 0, monate: [{ monat: "2026-01", einzahlungen: 0, auszahlungen: 0 }, { monat: "2026-03", einzahlungen: 0, auszahlungen: 0 }] }), GoingConcernFehler);
  assert.throws(() => liquiditaetsprognose({ anfangsbestand: 0, freieKreditlinie: 0, monate: [] }), GoingConcernFehler);
});

test("Covenants: verletzt, knapp, eingehalten, Grenze 0", () => {
  const r = covenantPruefung([
    { name: "EK-Quote", typ: "min", grenze: 0.3, ist: 0.28 },
    { name: "Verschuldungsgrad", typ: "max", grenze: 3, ist: 2.8 },
    { name: "Zinsdeckung", typ: "min", grenze: 3, ist: 5 },
    { name: "Nullgrenze", typ: "min", grenze: 0, ist: 1 },
  ]);
  assert.deepEqual(r.ergebnisse.map((e) => e.status), ["verletzt", "knapp", "eingehalten", "eingehalten"]);
  assert.equal(r.ergebnisse[3]!.reserve, null);
});

test("Kapitalschutz: Kapitalverlust und Überschuldung als rechnerischer Hinweis", () => {
  const ok = kapitalschutz({ aktienkapital: 100_000, gesetzlicheReserven: 20_000, aktiven: 500_000, fremdkapital: 300_000 });
  assert.equal(ok.kapitalverlust, false);
  const verlust = kapitalschutz({ aktienkapital: 100_000, gesetzlicheReserven: 20_000, aktiven: 400_000, fremdkapital: 360_000 });
  assert.equal(verlust.kapitalverlust, true);
  assert.equal(verlust.ueberschuldung, false);
  const ueber = kapitalschutz({ aktienkapital: 100_000, gesetzlicheReserven: 0, aktiven: 300_000, fremdkapital: 350_000 });
  assert.equal(ueber.ueberschuldung, true);
  assert.equal(kapitalschutz({ aktienkapital: 100_000, gesetzlicheReserven: 0, aktiven: 300_000, fremdkapital: 350_000, rangruecktritt: 60_000 }).ueberschuldung, false);
  assert.match(ueber.hinweise[0]!, /Rangrücktritts/);
});
