/**
 * Kontrollprüfung (Funktionsprüfung): automatische Datenprüfungen über alle Vorgänge der Excel-Datei (Vollprüfung, Rz. 758)
 * und Stichprobenauswahl über den Prüfzeitraum. Die Datentests ersetzen nicht die Prüfung der Kontrolle am einzelnen Vorgang;
 * sie zeigen Vorgänge, bei denen die Spuren der Kontrolle (Freigabe, Funktionstrennung) fehlen oder auffallen.
 */
import { DATENTEST_INFO, type Datentest } from "../hwp/kontrollen";
import { hwpZitat } from "../hwp/quelle";
import type { Importiert, Spalten } from "../import";
import { tagNummer } from "./datum";
import { StichprobenFehler, systematischeAuswahl, zufallsauswahl, type AuswahlErgebnis } from "./stichprobe";

export type DatentestErgebnis = {
  test: Datentest;
  titel: string;
  braucht: string;
  geprueft: number;
  nichtPruefbar: number;
  abweichungen: { id: string; excelZeile: number; grund: string }[];
};

export function kontrollDatentests(posten: Importiert[], spalten: Spalten, tests: Datentest[]): { ergebnisse: DatentestErgebnis[]; hinweise: string[] } {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const ergebnisse: DatentestErgebnis[] = tests.map((test) => {
    const e: DatentestErgebnis = { test, titel: DATENTEST_INFO[test].titel, braucht: DATENTEST_INFO[test].braucht, geprueft: 0, nichtPruefbar: 0, abweichungen: [] };
    for (const x of posten) {
      if (test === "funktionstrennung") {
        if (spalten.erfasser === undefined || spalten.freigeber === undefined || !x.erfasser || !x.freigeber) e.nichtPruefbar++;
        else {
          e.geprueft++;
          if (norm(x.erfasser) === norm(x.freigeber)) e.abweichungen.push({ id: x.id, excelZeile: x.excelZeile, grund: `Erfasser und Freigeber identisch («${x.erfasser}»)` });
        }
      } else if (test === "freigabe_fehlt") {
        if (spalten.freigeber === undefined) e.nichtPruefbar++;
        else {
          e.geprueft++;
          if (!x.freigeber) e.abweichungen.push({ id: x.id, excelZeile: x.excelZeile, grund: "keine Freigabe erfasst" });
        }
      } else {
        // freigabe_verspaetet: nur prüfbar, wenn Freigabe und Ausführung datiert sind
        if (spalten.freigabedatum === undefined || spalten.datum === undefined || !x.freigabedatum || !x.datum) e.nichtPruefbar++;
        else {
          e.geprueft++;
          if (tagNummer(x.freigabedatum) > tagNummer(x.datum)) e.abweichungen.push({ id: x.id, excelZeile: x.excelZeile, grund: `Freigabe am ${x.freigabedatum}, Ausführung am ${x.datum}` });
        }
      }
    }
    return e;
  });
  const hinweise = [
    `Vollprüfung über alle ${posten.length} Vorgänge der Datei (${hwpZitat(758)}). Abweichungen sind Prüfhinweise: Ursache und Bedeutung beurteilt der Prüfer; ohne Abweichung ist die Kontrolle nicht als wirksam belegt.`,
  ];
  for (const e of ergebnisse) if (e.nichtPruefbar > 0) hinweise.push(`«${e.titel}»: ${e.nichtPruefbar} von ${posten.length} Vorgängen nicht prüfbar (${e.braucht}).`);
  return { ergebnisse, hinweise };
}

/**
 * Stichprobe über den Prüfzeitraum: systematisch nach Datum sortiert (deckt den gesamten Zeitraum ab, Rz. 600, 783) oder
 * zufällig. Ohne Datumsspalte gilt die Reihenfolge der Datei.
 */
export function kontrollStichprobe(posten: Importiert[], n: number, seed: number, methode: "systematisch" | "zufaellig"): AuswahlErgebnis {
  if (posten.length === 0) throw new StichprobenFehler("Die Vorgangsliste ist leer.");
  const sortiert = [...posten].sort((a, b) => (a.datum && b.datum ? tagNummer(a.datum) - tagNummer(b.datum) : 0) || a.excelZeile - b.excelZeile);
  const p = sortiert.map((x) => ({ id: x.id, buchwert: 1 }));
  return methode === "systematisch" ? systematischeAuswahl(p, n, seed) : zufallsauswahl(p, n, seed);
}
