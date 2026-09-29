import assert from "node:assert/strict";
import { test } from "node:test";
import type { Zelle } from "./import";
import {
  IksFehler, erzeugePruefplan, leiteEbeneAb, leseIksMatrix, normalisiereAusfuehrung, normalisiereEbene, normalisiereHaeufigkeit, normalisiereSchluessel, normalisiereWirkung, pruefplanAlsCsv,
  schlageIksSpaltenVor, type Pruefart,
} from "./iks";

test("Häufigkeit: gängige Schreibweisen, halbjährlich mit Hinweis, Unbekanntes wird nie geraten", () => {
  assert.equal(normalisiereHaeufigkeit("Jährlich").wert, "jaehrlich");
  assert.equal(normalisiereHaeufigkeit("quartalsweise").wert, "vierteljaehrlich");
  assert.equal(normalisiereHaeufigkeit("Monatlich").wert, "monatlich");
  assert.equal(normalisiereHaeufigkeit("wöchentlich").wert, "woechentlich");
  assert.equal(normalisiereHaeufigkeit("täglich").wert, "taeglich");
  assert.equal(normalisiereHaeufigkeit("mehrmals täglich").wert, "haeufiger");
  assert.equal(normalisiereHaeufigkeit("laufend / bei jedem Vorgang").wert, "haeufiger");
  assert.equal(normalisiereHaeufigkeit("bei Bedarf").wert, "haeufiger");
  const halb = normalisiereHaeufigkeit("halbjährlich");
  assert.equal(halb.wert, "vierteljaehrlich");
  assert.match(halb.hinweis!, /halbjährlich/);
  const unklar = normalisiereHaeufigkeit("nach Vereinbarung mit dem VR");
  assert.equal(unklar.wert, undefined);
  assert.match(unklar.hinweis!, /nicht erkannt/);
  assert.deepEqual(normalisiereHaeufigkeit(""), {});
});

test("Kontrollart, Ausführung, Schlüsselkontrolle, Ebene", () => {
  assert.equal(normalisiereWirkung("Präventiv"), "präventiv");
  assert.equal(normalisiereWirkung("detektiv"), "detektiv");
  assert.equal(normalisiereWirkung("irgendwas"), undefined);
  assert.equal(normalisiereAusfuehrung("automatisch").wert, "automatisiert");
  assert.equal(normalisiereAusfuehrung("IT-gestützt").wert, "automatisiert");
  assert.equal(normalisiereAusfuehrung("manuell").wert, "manuell");
  assert.equal(normalisiereAusfuehrung("Geschäftsleitung").wert, "durch die Unternehmensleitung");
  const teil = normalisiereAusfuehrung("teilautomatisiert");
  assert.equal(teil.wert, "manuell");
  assert.match(teil.hinweis!, /vorsichtig/);
  assert.equal(normalisiereSchluessel("Ja"), true);
  assert.equal(normalisiereSchluessel("nein"), false);
  assert.equal(normalisiereSchluessel(""), undefined);
  assert.equal(normalisiereSchluessel("vielleicht"), undefined);
  assert.equal(normalisiereEbene("Unternehmensebene"), "Einheit");
  assert.equal(normalisiereEbene("IT"), "IT");
  assert.equal(normalisiereEbene("Prozess"), "Prozess");
  assert.equal(leiteEbeneAb("Generelle IT-Kontrollen"), "IT");
  assert.equal(leiteEbeneAb("Governance und Kontrollumfeld"), "Einheit");
  assert.equal(leiteEbeneAb("Einkauf"), "Prozess");
});

const KOPF: Zelle[] = ["Prozess", "Risiko-ID", "Risiko", "Kontroll-ID", "Kontrolle", "Häufigkeit", "Kontrollart", "Ausführung", "Schlüsselkontrolle", "Verantwortlich", "Nachweis", "Zuletzt geprüft"];
const MATRIX: Zelle[][] = [
  ["IKS-Matrix Musterfirma AG"],
  KOPF,
  // Prozess und Risiko nur in der ersten Zeile eines Blocks (verbundene Zellen)
  ["Einkauf", "R1", "Unautorisierte Bestellungen", "K1", "Bestellungen über 5'000 CHF werden vom Abteilungsleiter freigegeben (Vier-Augen-Prinzip)", "laufend", "präventiv", "manuell", "ja", "Leiter Einkauf", "Visum auf Bestellung", 2023],
  [null, null, null, "K2", "Drei-Wege-Abgleich Bestellung, Wareneingang, Rechnung im ERP", "täglich", "präventiv", "automatisch", "ja", "ERP", null, 2024],
  [null, "R2", "Doppelte Zahlung", "K3", "Monatliche Kontrolle der Zahlungsvorschlagsliste", "monatlich", "detektiv", "manuell", "nein", null, null, null],
  ["Governance", "R3", "Fehlende Kompetenz im Rechnungswesen", "K4", "Jährliche Weiterbildungsplanung im Finanzbereich", "jährlich", "präventiv", "Geschäftsleitung", "ja", "CFO", null, null],
  ["Generelle IT-Kontrollen", "R4", "Unberechtigter Zugriff", "K5", "Halbjährliche Überprüfung der Benutzerberechtigungen", "halbjährlich", "detektiv", "manuell", "ja", "IT-Leiter", "Berechtigungsliste", 2025],
  [null, "R5", "Risiko ohne jede Kontrolle", null, null, null, null, null, null, null, null, null],
  ["Einkauf", "R1", "Unautorisierte Bestellungen", "K1", "Bestellungen über 5'000 CHF werden vom Abteilungsleiter freigegeben (Vier-Augen-Prinzip)", "laufend", "präventiv", "manuell", "ja", null, null, null],
];

test("Spaltenvorschlag aus der Kopfzeile", () => {
  const s = schlageIksSpaltenVor(KOPF);
  assert.deepEqual(s, { prozess: 0, risikoId: 1, risiko: 2, kontrollId: 3, kontrolle: 4, haeufigkeit: 5, wirkung: 6, ausfuehrung: 7, schluessel: 8, verantwortlich: 9, nachweis: 10, zuletzt: 11 });
});

test("Matrix lesen: verbundene Zellen werden aufgefüllt, Duplikate zusammengeführt, Risiko ohne Kontrolle als Lücke", () => {
  const m = leseIksMatrix(MATRIX, 1, schlageIksSpaltenVor(KOPF));
  assert.deepEqual(m.kontrollen.map((k) => k.id), ["K1", "K2", "K3", "K4", "K5"]);
  const k2 = m.kontrollen.find((k) => k.id === "K2")!;
  assert.equal(k2.prozess, "Einkauf", "Prozess von oben übernommen");
  assert.deepEqual(k2.risikoIds, ["R1"], "Risiko von oben übernommen");
  assert.equal(k2.ausfuehrung, "automatisiert");
  assert.equal(k2.haeufigkeit, "taeglich");
  assert.equal(k2.zuletzt, 2024);
  const k1 = m.kontrollen[0]!;
  assert.equal(k1.haeufigkeit, "haeufiger");
  assert.equal(k1.schluessel, true);
  assert.equal(k1.excelZeile, 3);
  assert.equal(m.kontrollen.find((k) => k.id === "K5")!.haeufigkeit, "vierteljaehrlich");
  assert.match(m.kontrollen.find((k) => k.id === "K5")!.hinweise.join(" "), /halbjährlich/);
  assert.equal(m.kontrollen.find((k) => k.id === "K4")!.ebene, "Einheit");
  assert.equal(m.kontrollen.find((k) => k.id === "K5")!.ebene, "IT");
  assert.equal(m.kontrollen.find((k) => k.id === "K4")!.ebeneAbgeleitet, true);
  assert.equal(m.luecken.length, 1);
  assert.match(m.luecken[0]!, /R5.*ohne Kontrolle/);
  assert.match(m.hinweise.join(" "), /verbundene Zellen/);
});

test("Matrix lesen: ohne Kontrollspalte oder ohne Kontrollen ein klarer Fehler", () => {
  assert.throws(() => leseIksMatrix(MATRIX, 1, {}), IksFehler);
  assert.throws(() => leseIksMatrix([KOPF], 0, { kontrolle: 4 }), /Keine Kontrollen/);
  assert.throws(() => leseIksMatrix(MATRIX, 99, { kontrolle: 4 }), IksFehler);
});

test("Ohne Angaben zur Schlüsselkontrolle: Hinweis, nichts wird stillschweigend eingestuft", () => {
  const z: Zelle[][] = [["Kontrolle", "Häufigkeit"], ["Rechnungsprüfung", "monatlich"], ["Abstimmung", "unklar"]];
  const m = leseIksMatrix(z, 0, { kontrolle: 0, haeufigkeit: 1 });
  assert.equal(m.kontrollen[0]!.id, "K-2");
  assert.match(m.hinweise.join(" "), /keine Angabe zu Schlüsselkontrollen/);
  assert.match(m.hinweise.join(" "), /1 von 2 Kontrollen ohne erkannte Häufigkeit/);
  assert.equal(m.kontrollen[1]!.haeufigkeit, undefined);
});

test("Prüfplan: Einheit und IT jährlich, Rotation nach Zyklus, Nicht-Schlüsselkontrollen ausgenommen", () => {
  const m = leseIksMatrix(MATRIX, 1, schlageIksSpaltenVor(KOPF));
  const plan = erzeugePruefplan(m.kontrollen, { pruefjahr: 2026 });
  const z = (id: string) => plan.zeilen.find((x) => x.kontrolle.id === id)!;
  assert.equal(z("K4").vorgeschlagen, "existenz");
  assert.match(z("K4").faelligGrund, /jährlich/);
  assert.equal(z("K5").vorgeschlagen, "existenz", "IT jährlich, auch wenn 2025 geprüft");
  assert.equal(z("K1").vorgeschlagen, "existenz", "zuletzt 2023, Zyklus 3 erreicht");
  assert.equal(z("K2").vorgeschlagen, "keine", "zuletzt 2024: Rotation");
  assert.match(z("K2").faelligGrund, /Rotation/);
  assert.equal(z("K3").vorgeschlagen, "keine");
  assert.match(z("K3").faelligGrund, /keine Schlüsselkontrolle/);
  assert.ok(erzeugePruefplan(m.kontrollen, { pruefjahr: 2026, nurSchluessel: true }).zeilen.every((x) => x.kontrolle.schluessel !== false));
});

test("Prüfplan: Umfang nach Häufigkeit, automatisierte Kontrollen = Test of one, häufige = 10 %, Unbekanntes ohne Zahl", () => {
  const m = leseIksMatrix(MATRIX, 1, schlageIksSpaltenVor(KOPF));
  const plan = erzeugePruefplan(m.kontrollen, { pruefjahr: 2026 });
  const f = (id: string) => plan.zeilen.find((x) => x.kontrolle.id === id)!.funktion;
  assert.equal(f("K2").n, 1);
  assert.match(f("K2").umfangText, /Test of one/);
  assert.equal(f("K2").handlung, "IT-gestützte Prüfungshandlung");
  assert.equal(f("K1").n, null);
  assert.match(f("K1").umfangText, /10 %.*höchstens 10.*15/);
  assert.equal(f("K3").n, 2, "monatlich = 2");
  assert.equal(f("K4").n, 1, "jährlich = 1");
  const unklar = erzeugePruefplan(leseIksMatrix([["Kontrolle", "Häufigkeit"], ["X", "nach Vereinbarung"]], 0, { kontrolle: 0, haeufigkeit: 1 }).kontrollen, { pruefjahr: 2026 });
  assert.equal(unklar.zeilen[0]!.funktion.n, null);
  assert.match(unklar.zeilen[0]!.funktion.umfangText, /nicht erkannt/);
});

test("Prüfplan: Existenz-Handlungen nach Rz. 1416–1420, Datenprüfungen nur bei Freigabe im Kontrolltext", () => {
  const m = leseIksMatrix(MATRIX, 1, schlageIksSpaltenVor(KOPF));
  const plan = erzeugePruefplan(m.kontrollen, { pruefjahr: 2026 });
  const k1 = plan.zeilen.find((x) => x.kontrolle.id === "K1")!;
  assert.match(k1.existenz.join(" "), /Walk-through/);
  assert.match(k1.existenz.join(" "), /Rz\. 1420/);
  assert.match(k1.existenz.join(" "), /Leiter Einkauf/);
  assert.match(k1.existenz.join(" "), /Visum auf Bestellung/);
  assert.deepEqual(k1.funktion.datentests, ["freigabe_fehlt", "funktionstrennung"]);
  assert.deepEqual(plan.zeilen.find((x) => x.kontrolle.id === "K3")!.funktion.datentests, []);
  assert.deepEqual(plan.zeilen.find((x) => x.kontrolle.id === "K2")!.funktion.datentests, [], "automatisierte Kontrollen haben keine Freigabetests");
});

test("Prüfplan: Hinweise zur Existenzprüfung, fehlende Ebenen, Zyklus über drei Jahre, ungültige Eingaben", () => {
  const m = leseIksMatrix(MATRIX, 1, schlageIksSpaltenVor(KOPF));
  const p = erzeugePruefplan(m.kontrollen, { pruefjahr: 2026 });
  assert.match(p.hinweise.join(" "), /keine Wirksamkeitsprüfung/);
  const nurProzess = leseIksMatrix([["Prozess", "Kontrolle"], ["Einkauf", "A"], ["Verkauf", "B"]], 0, { prozess: 0, kontrolle: 1 });
  const h = erzeugePruefplan(nurProzess.kontrollen, { pruefjahr: 2026, zyklus: 5 }).hinweise.join(" ");
  assert.match(h, /Keine Kontrollen auf Ebene der Einheit/);
  assert.match(h, /Keine generellen IT-Kontrollen/);
  assert.match(h, /über drei Jahre/);
  assert.throws(() => erzeugePruefplan(m.kontrollen, { pruefjahr: 26 }), IksFehler);
  assert.throws(() => erzeugePruefplan(m.kontrollen, { pruefjahr: 2026, zyklus: 0 }), IksFehler);
});

test("Prüfplan-CSV: Auswahl des Prüfers, Formelschutz, Quelle im Kopf", () => {
  const z: Zelle[][] = [["Kontrolle", "Häufigkeit", "Schlüsselkontrolle"], ["=cmd|calc", "monatlich", "ja"]];
  const plan = erzeugePruefplan(leseIksMatrix(z, 0, { kontrolle: 0, haeufigkeit: 1, schluessel: 2 }).kontrollen, { pruefjahr: 2026 });
  const arten: Record<string, Pruefart> = { "K-2": "funktion" };
  const csv = pruefplanAlsCsv(plan, arten, { pruefjahr: 2026 });
  assert.ok(csv.startsWith("﻿# Prüfplan Kontrollprüfung, Prüfjahr 2026"));
  assert.match(csv, /'=cmd\|calc/);
  assert.match(csv, /Funktionsprüfung \(deckt die Existenz ab\)/);
  assert.match(csv, /2 Vorgänge \(Staffelung «Monatlich»\)/);
});
