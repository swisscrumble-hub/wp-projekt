import { redirect } from "next/navigation";
import LoginFormular from "@/components/LoginFormular";
import { istAngemeldet } from "@/lib/session";

/** Startseite = Login. Angemeldete Personen gehen direkt zur Übersicht. */
export default async function Home() {
  if (await istAngemeldet()) redirect("/dashboard");
  return <LoginFormular />;
}
