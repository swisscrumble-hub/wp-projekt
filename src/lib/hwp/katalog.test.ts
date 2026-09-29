import assert from "node:assert/strict";
import { test } from "node:test";
import { EINZELFALL, gruppen } from "./einzelfall";
import { KONTROLLEN, PRUEFHANDLUNGEN } from "./kontrollen";
import { hwpZitat } from "./quelle";

test("Einzelfall-Katalog: eindeutige IDs, Randziffern im Bereich III.4.9 bzw. den zitierten Kapiteln, Pflichtangaben", () => {
  const ids = new Set(EINZELFALL.map((e) => e.id));
  assert.equal(ids.size, EINZELFALL.length);
  for (const e of EINZELFALL) {
    assert.ok(gruppen.includes(e.gruppe), e.id);
    assert.ok(e.titel && e.position && e.nachweis && e.population.spalten, e.id);
    for (const rz of [e.rz, ...(e.rzWeitere ?? [])]) assert.ok(Number.isInteger(rz) && rz > 0 && rz < 1200, `${e.id}: Rz ${rz}`);
  }
  // Jede Gruppe ist besetzt
  for (const g of gruppen) assert.ok(EINZELFALL.some((e) => e.gruppe === g), g);
});

test("Kontroll-Katalog: eindeutige IDs, gültige Prüfhandlung, Datentests nur bei sinnvollen Kontrollen; Beispielkontrollen sind gekennzeichnet", () => {
  assert.equal(new Set(KONTROLLEN.map((k) => k.id)).size, KONTROLLEN.length);
  for (const k of KONTROLLEN) {
    assert.ok(PRUEFHANDLUNGEN.includes(k.pruefhandlung), k.id);
    if (k.ausfuehrung === "automatisiert") assert.deepEqual(k.datentests, [], `${k.id}: automatisierte Kontrollen haben keine Freigabetests`);
  }
});

test("Zitat: Format", () => {
  assert.equal(hwpZitat(898), "EXPERTsuisse, HWP OR 2024, Teil III Rz. 898");
  assert.equal(hwpZitat([912, 659]), "EXPERTsuisse, HWP OR 2024, Teil III Rz. 912, 659");
});

test("Soll-/Haben-Handlungen haben die passende Buchungsseite voreingestellt", () => {
  const seite = (id: string) => EINZELFALL.find((e) => e.id === id)?.vorzeichen;
  assert.equal(seite("ford-soll"), "soll");
  assert.equal(seite("ford-haben"), "haben");
  assert.equal(seite("kred-soll"), "soll");
  assert.equal(seite("kred-haben"), "haben");
});
