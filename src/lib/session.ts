import { cookies } from "next/headers";
import { COOKIE_NAME, pruefeSessionToken } from "@/lib/auth";

/** Serverseitige Prüfung (zusätzlich zum Proxy: Defense in Depth). */
export async function istAngemeldet(): Promise<boolean> {
  return pruefeSessionToken((await cookies()).get(COOKIE_NAME)?.value);
}

/** Umhüllt einen Route-Handler: ohne gültige Session antwortet er mit 401, bevor Daten angefasst werden. */
export function geschuetzt<A extends unknown[]>(handler: (request: Request, ...args: A) => Promise<Response>) {
  return async (request: Request, ...args: A): Promise<Response> => {
    if (!(await istAngemeldet())) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    return handler(request, ...args);
  };
}
