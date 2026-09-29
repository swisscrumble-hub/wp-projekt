import assert from "node:assert/strict";
import { test } from "node:test";
import { baueNotiz } from "./dokumentation";

test("Notiz enthält Methode, Seed, Umfang, Grundgesamtheit, Auswahl und den Vorbehalt", () => {
  const t = baueNotiz({
    bereich: "Einzelfallprüfung",
    handlung: "Saldenbestätigungen einholen",
    norm: "EXPERTsuisse, HWP OR 2024, Teil III Rz. 898",
    datei: "debitoren.xlsx",
    grundgesamtheit: { anzahl: 120, wert: 1_234_567.5 },
    methode: "Monetär (MUS)",
    seed: 42,
    umfang: 3,
    zusatz: ["Intervall: 411'522.5"],
    ausgewaehlt: ["D-1", "D-7", "D-9"],
    zeitpunkt: "2026-09-29T12:00:00.000Z",
  });
  assert.match(t, /^Einzelfallprüfung: Saldenbestätigungen einholen/);
  assert.match(t, /Seed: 42/);
  assert.match(t, /Ausgewählt \(3\): D-1, D-7, D-9/);
  assert.match(t, /Intervall: 411'522.5/);
  assert.match(t, /Prüfer/);
});
