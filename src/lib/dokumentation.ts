/**
 * Dokumentationsnotiz für die Arbeitspapiere: hält fest, was gezogen wurde und wie (Methode, Seed, Umfang, Grundgesamtheit),
 * damit die Auswahl reproduzierbar ist. Reiner Text; nichts wird gespeichert oder gesendet.
 */
export type NotizDaten = {
  bereich: "Einzelfallprüfung" | "Kontrollprüfung" | "Journalprüfung";
  handlung: string;
  norm: string;
  datei: string;
  grundgesamtheit: { anzahl: number; wert?: number };
  methode: string;
  seed: number;
  umfang: number;
  zusatz?: string[];
  ausgewaehlt: string[];
  zeitpunkt: string;
};

export function baueNotiz(d: NotizDaten): string {
  const zeilen = [
    `${d.bereich}: ${d.handlung}`,
    `Grundlage: ${d.norm}`,
    `Datei: ${d.datei}`,
    `Grundgesamtheit: ${d.grundgesamtheit.anzahl} Posten${d.grundgesamtheit.wert !== undefined ? `, Wert ${d.grundgesamtheit.wert.toLocaleString("de-CH", { maximumFractionDigits: 2 })}` : ""}`,
    `Methode: ${d.methode}`,
    `Seed: ${d.seed} (gleicher Seed, gleiche Datei und gleiche Parameter ergeben dieselbe Auswahl)`,
    `Umfang: ${d.umfang}`,
    ...(d.zusatz ?? []),
    `Ausgewählt (${d.ausgewaehlt.length}): ${d.ausgewaehlt.join(", ")}`,
    `Erstellt: ${d.zeitpunkt}`,
    "Hinweis: Rechnerischer Vorschlag. Festlegung von Umfang und Methode sowie die Würdigung der Ergebnisse liegen beim Prüfer.",
  ];
  return zeilen.join("\n");
}
