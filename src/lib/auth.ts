/**
 * Passwortschutz per signiertem Session-Cookie (HMAC-SHA256, Web Crypto).
 *
 * Umgebungsvariablen:
 *  - ADMIN_PASSWORD: Passwort für den Zugang (mind. 12 Zeichen)
 *  - AUTH_SECRET:  Geheimnis zum Signieren der Sessions (mind. 32 Zeichen, zufällig)
 * Fehlt eine Variable oder ist sie zu schwach, bleibt alles gesperrt (fail closed).
 */
export const COOKIE_NAME = "wp_session";
export const SESSION_DAUER_S = 8 * 60 * 60; // 8 Stunden

const MIN_PASSWORT = 12;
const MIN_SECRET = 32;

const enc = new TextEncoder();

function masterPasswort(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function konfigurationsFehler(): string | null {
  const passwort = masterPasswort();
  const secret = process.env.AUTH_SECRET ?? "";
  if (passwort.length < MIN_PASSWORT) return `ADMIN_PASSWORD fehlt oder hat weniger als ${MIN_PASSWORT} Zeichen.`;
  if (secret.length < MIN_SECRET) return `AUTH_SECRET fehlt oder hat weniger als ${MIN_SECRET} Zeichen.`;
  return null;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function ausBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacSchluessel(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(process.env.AUTH_SECRET ?? ""), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Erzeugt ein signiertes Session-Token mit Ablaufzeit. */
export async function erzeugeSessionToken(jetztMs: number = Date.now()): Promise<string> {
  const nutzlast = base64url(enc.encode(JSON.stringify({ exp: Math.floor(jetztMs / 1000) + SESSION_DAUER_S })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacSchluessel(), enc.encode(nutzlast)));
  return `${nutzlast}.${base64url(sig)}`;
}

/** Prüft Signatur (zeitkonstant) und Ablauf. */
export async function pruefeSessionToken(token: string | undefined, jetztMs: number = Date.now()): Promise<boolean> {
  if (konfigurationsFehler() || !token) return false;
  const [nutzlast, sig, rest] = token.split(".");
  if (!nutzlast || !sig || rest !== undefined) return false;
  const sigBytes = ausBase64url(sig);
  if (!sigBytes) return false;
  const gueltig = await crypto.subtle.verify("HMAC", await hmacSchluessel(), sigBytes, enc.encode(nutzlast));
  if (!gueltig) return false;
  const daten = ausBase64url(nutzlast);
  if (!daten) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(daten)) as { exp?: unknown };
    return typeof exp === "number" && exp > Math.floor(jetztMs / 1000);
  } catch {
    return false;
  }
}

/** Zeitkonstanter Passwortvergleich (über SHA-256, damit die Länge nicht durchsickert). */
export async function passwortStimmt(eingabe: string): Promise<boolean> {
  if (konfigurationsFehler()) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(eingabe)),
    crypto.subtle.digest("SHA-256", enc.encode(masterPasswort())),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
