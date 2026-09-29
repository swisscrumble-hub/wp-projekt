import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const antwort = Response.json({ ok: true });
  antwort.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return antwort;
}
