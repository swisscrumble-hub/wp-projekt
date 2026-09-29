import { redirect } from "next/navigation";
import LoginFormular from "@/components/LoginFormular";
import { istAngemeldet } from "@/lib/session";

/** Startseite = Login. Angemeldete Personen gehen direkt zu den Stichproben. */
export default async function Home() {
  if (await istAngemeldet()) redirect("/stichproben");
  return <LoginFormular />;
}
