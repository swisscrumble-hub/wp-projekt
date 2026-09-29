import assert from "node:assert/strict";
import { test } from "node:test";
import { FraudFehler, pruefeJournal, type Buchung } from "./fraud";
import { istIsoDatum, tagNummer, wochentag } from "./datum";

const P = { geschaeftsjahrEnde: "2025-12-31" };
const b = (id: string, over: Partial<Buchung> = {}): Buchung => ({ id, datum: "2025-06-10", konto: "1020", betrag: 1234.56, ...over });
const regeln = (r: ReturnType<typeof pruefeJournal>) => r.befunde.map((x) => `${x.regel}:${x.buchungen.join("+")}`);

test("Datum: Validierung, Tage, Wochentag", () => {
  assert.equal(istIsoDatum("2025-02-29"), false);
  assert.equal(istIsoDatum("2024-02-29"), true);
  assert.equal(tagNummer("2025-01-02") - tagNummer("2025-01-01"), 1);
  assert.equal(wochentag("2025-12-28"), 0);
  assert.equal(wochentag("2025-12-27"), 6);
});

test("Zeit: ausserhalb 07–19 Uhr wird markiert, Grenzen stimmen, fehlende Zeit ist nicht prüfbar", () => {
  const r = pruefeJournal([b("a", { zeit: "23:40" }), b("b", { zeit: "07:00" }), b("c", { zeit: "19:00" }), b("d", { zeit: "06:59" }), b("e")], P);
  assert.deepEqual(regeln(r).filter((x) => x.startsWith("ausserhalb")), ["ausserhalb_zeit:a", "ausserhalb_zeit:c", "ausserhalb_zeit:d"]);
  assert.equal(r.abdeckung.ausserhalb_zeit.nichtPruefbar, 1);
  assert.match(r.hinweise.join(" "), /ausserhalb_zeit.*nicht prüfbar/);
});

test("Wochenende und Rundbetrag", () => {
  const r = pruefeJournal([b("sa", { datum: "2025-06-14" }), b("so", { datum: "2025-06-15" }), b("mo", { datum: "2025-06-16" }), b("rund", { betrag: -50_000 }), b("klein", { betrag: 5000 }), b("cents", { betrag: 10_000.5 })], P);
  const s = regeln(r);
  assert.ok(s.includes("wochenende:sa") && s.includes("wochenende:so") && !s.includes("wochenende:mo"));
  assert.ok(s.includes("rundbetrag:rund"));
  assert.ok(!s.includes("rundbetrag:klein") && !s.includes("rundbetrag:cents"));
});

test("Manuelle Buchung kurz vor Jahresende; automatische und unbekannte nicht", () => {
  const r = pruefeJournal(
    [b("m", { datum: "2025-12-29", manuell: true }), b("auto", { datum: "2025-12-29", manuell: false }), b("frueh", { datum: "2025-12-01", manuell: true }), b("unb", { datum: "2025-12-30" }), b("nach", { datum: "2026-01-02", manuell: true })],
    P,
  );
  assert.deepEqual(regeln(r).filter((x) => x.startsWith("jahresende")), ["jahresende_manuell:m"]);
  assert.equal(r.abdeckung.jahresende_manuell.nichtPruefbar, 1);
});

test("Doppelzahlung: gleicher Partner und Betrag im Fenster; anderer Betrag oder zu spät nicht", () => {
  const r = pruefeJournal(
    [
      b("z1", { partner: "Meier AG", betrag: 4500, datum: "2025-03-01", belegnr: "R-7" }),
      b("z2", { partner: "Meier AG", betrag: -4500, datum: "2025-03-10", belegnr: "R-7" }),
      b("z3", { partner: "Meier AG", betrag: 4500, datum: "2025-06-01" }),
      b("z4", { partner: "Meier AG", betrag: 4501, datum: "2025-03-11" }),
      b("z5", { partner: "Müller GmbH", betrag: 4500, datum: "2025-03-11" }),
    ],
    P,
  );
  const dz = r.befunde.filter((x) => x.regel === "doppelzahlung");
  assert.equal(dz.length, 1);
  assert.deepEqual(dz[0]!.buchungen, ["z1", "z2"]);
  assert.match(dz[0]!.begruendung, /Gleiche Belegnummer/);
});

test("Funktionstrennung: Erfasser = Freigeber", () => {
  const r = pruefeJournal([b("x", { erfasser: "mk", freigeber: "mk" }), b("y", { erfasser: "mk", freigeber: "ab" }), b("z", { erfasser: "mk" })], P);
  assert.deepEqual(regeln(r).filter((x) => x.startsWith("funktion")), ["funktionstrennung:x"]);
  assert.equal(r.abdeckung.funktionstrennung.nichtPruefbar, 1);
});

test("Ungültige Eingaben werden abgelehnt; Hinweistext relativiert Treffer", () => {
  assert.throws(() => pruefeJournal([b("a"), b("a")], P), FraudFehler);
  assert.throws(() => pruefeJournal([b("a", { datum: "2025-13-01" })], P), FraudFehler);
  assert.throws(() => pruefeJournal([b("a", { zeit: "25:00" })], P), FraudFehler);
  assert.throws(() => pruefeJournal([], { geschaeftsjahrEnde: "kein Datum" }), FraudFehler);
  const r = pruefeJournal([], P);
  assert.match(r.hinweise[0]!, /keine Feststellung/);
  assert.equal(r.befunde.length, 0);
});
