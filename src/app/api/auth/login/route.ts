import { COOKIE_NAME, SESSION_DAUER_S, erzeugeSessionToken, konfigurationsFehler, passwortStimmt } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_FEHLVERSUCHE = 5;
const FENSTER_MS = 15 * 60 * 1000;

/**
 * Brute-Force-Bremse pro Server-Instanz (im Speicher, ohne Datenbank).
 * Grenze: Auf Vercel gibt es mehrere Instanzen, die Zähler nicht teilen. Der Schutz ist deshalb nur eine Bremse;
 * das eigentliche Sicherheitsniveau kommt vom langen Passwort (mind. 12 Zeichen) und der Verzögerung.
 */
const fehlversuche = new Map<string, number[]>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unbekannt";
}

export async function POST(request: Request) {
  const problem = konfigurationsFehler();
  if (problem) {
    console.error("Login gesperrt:", problem);
    return Response.json({ error: "Der Zugang ist nicht konfiguriert. Bitte ADMIN_PASSWORD und AUTH_SECRET setzen." }, { status: 503 });
  }

  const ip = clientIp(request);
  const jetzt = Date.now();
  const aktuell = (fehlversuche.get(ip) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  if (aktuell.length >= MAX_FEHLVERSUCHE) {
    return Response.json({ error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const passwort = typeof body?.passwort === "string" ? body.passwort : "";

  if (!(await passwortStimmt(passwort))) {
    fehlversuche.set(ip, [...aktuell, jetzt]);
    await new Promise((r) => setTimeout(r, 500)); // bremst automatisierte Versuche
    return Response.json({ error: "Passwort falsch." }, { status: 401 });
  }

  fehlversuche.delete(ip);
  const antwort = Response.json({ ok: true });
  antwort.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${await erzeugeSessionToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAUER_S}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return antwort;
}
