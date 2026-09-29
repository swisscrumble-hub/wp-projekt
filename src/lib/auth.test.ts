import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { erzeugeSessionToken, konfigurationsFehler, passwortStimmt, pruefeSessionToken } from "./auth";

const alt = { p: process.env.ADMIN_PASSWORD, s: process.env.AUTH_SECRET };
beforeEach(() => {
  process.env.ADMIN_PASSWORD = "ein-langes-passwort";
  process.env.AUTH_SECRET = "x".repeat(40);
});
afterEach(() => {
  if (alt.p === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = alt.p;
  if (alt.s === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = alt.s;
});

test("Token: gültig, manipuliert, abgelaufen", async () => {
  const t = await erzeugeSessionToken();
  assert.equal(await pruefeSessionToken(t), true);
  assert.equal(await pruefeSessionToken(t.slice(0, -2) + "xx"), false);
  assert.equal(await pruefeSessionToken(undefined), false);
  assert.equal(await pruefeSessionToken(t, Date.now() + 9 * 3600 * 1000), false);
});

test("Fail closed: schwache oder fehlende Konfiguration sperrt alles", async () => {
  const t = await erzeugeSessionToken();
  process.env.AUTH_SECRET = "kurz";
  assert.ok(konfigurationsFehler());
  assert.equal(await pruefeSessionToken(t), false);
  process.env.AUTH_SECRET = "x".repeat(40);
  process.env.ADMIN_PASSWORD = "kurz";
  assert.equal(await passwortStimmt("kurz"), false);
});

test("Passwortvergleich", async () => {
  assert.equal(await passwortStimmt("ein-langes-passwort"), true);
  assert.equal(await passwortStimmt("falsch"), false);
});
