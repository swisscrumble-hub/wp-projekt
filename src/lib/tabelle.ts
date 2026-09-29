/**
 * Eingefügte Tabellen (aus Excel/CSV) einlesen. Alles läuft im Browser; Daten werden nirgends hin gesendet.
 * Trennzeichen: Tabulator, Semikolon oder Komma (in dieser Priorität). Zahlen: 1'234.50, 1234,50 oder 1234.50.
 * «1,234» wird als Dezimalzahl 1.234 gelesen (Schweizer/deutsche Schreibweise); Tausenderkommas nur bei Muster 1,234,567.
 */
export class TabellenFehler extends Error {}

export function parseZahl(roh: string): number {
  let t = roh.trim().replace(/^(chf|eur|usd|fr\.)\s*/i, "").replace(/[\s'’]/g, "");
  // Negative Beträge: «(123.45)» oder «123.45-» (Buchhaltungs- und PDF-Listen)
  let negativ = false;
  const klammer = /^\((.+)\)$/.exec(t);
  if (klammer) {
    t = klammer[1]!;
    negativ = true;
  } else if (/^[^-].*-$/.test(t)) {
    t = t.slice(0, -1);
    negativ = true;
  }
  if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new TabellenFehler(`«${roh.trim()}» ist keine Zahl.`);
  return negativ ? -Number(t) : Number(t);
}

export function zeilen(text: string): string[][] {
  const linien = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (linien.length === 0) return [];
  const erste = linien[0]!;
  const trenner = erste.includes("\t") ? "\t" : erste.includes(";") ? ";" : ",";
  return linien.map((l) => l.split(trenner).map((z) => z.trim()));
}

/** Zeilen mit fester Spaltenzahl; eine Kopfzeile (erste Zeile, wenn in einer Zahlspalte keine Zahl steht) wird übersprungen. */
export function tabelleOhneKopf(text: string, spalten: number, zahlSpalten: number[]): string[][] {
  let z = zeilen(text);
  const erste = z[0];
  if (erste && zahlSpalten.some((i) => { try { parseZahl(erste[i] ?? ""); return false; } catch { return true; } })) z = z.slice(1);
  z.forEach((r, i) => {
    if (r.length < spalten) throw new TabellenFehler(`Zeile ${i + 1}: ${spalten} Spalten erwartet, ${r.length} gefunden.`);
  });
  return z;
}

/** Erste Zeile ist die Kopfzeile; Spaltennamen werden kleingeschrieben zugeordnet. */
export function tabelleMitKopf(text: string): Record<string, string>[] {
  const z = zeilen(text);
  if (z.length < 2) throw new TabellenFehler("Kopfzeile und mindestens eine Datenzeile nötig.");
  const kopf = z[0]!.map((k) => k.toLowerCase());
  return z.slice(1).map((r) => Object.fromEntries(kopf.map((k, i) => [k, r[i] ?? ""])));
}

export function zahlIn(zeile: string[], index: number, zeilenNr: number): number {
  try {
    return parseZahl(zeile[index] ?? "");
  } catch (e) {
    throw new TabellenFehler(`Zeile ${zeilenNr}: ${e instanceof Error ? e.message : "Ungültige Zahl."}`);
  }
}
