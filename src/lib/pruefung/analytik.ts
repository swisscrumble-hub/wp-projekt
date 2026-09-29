/**
 * Analytische Prüfungshandlungen nach PS 520 (ISA 520): Horizontal-/Vertikalanalyse, Kennzahlen und Regression für
 * Erwartungswerte. Auffälligkeiten sind «Prüfhinweise» und keine Urteile; fehlende Hinweise beweisen nichts.
 */
export class AnalytikFehler extends Error {}

export const NORM_ANALYTIK = "PS 520 (ISA 520) Analytische Prüfungshandlungen";

const zahl = (v: number, name: string) => {
  if (!Number.isFinite(v)) throw new AnalytikFehler(`${name} ist keine Zahl.`);
};

// --- Horizontalanalyse ------------------------------------------------------

export type Zeile = { konto: string; aktuell: number; vorjahr: number };
export type HorizontalErgebnis = {
  konto: string;
  aktuell: number;
  vorjahr: number;
  abweichung: number;
  /** null, wenn Vorjahr 0 */
  abweichungProzent: number | null;
  auffaellig: boolean;
  grund?: string;
};

/**
 * Vergleich mit dem Vorjahr. Auffällig ist eine Abweichung nur, wenn sie relativ UND absolut die Schwellen erreicht
 * (die absolute Schwelle sollte sich an der Wesentlichkeit orientieren, sonst fallen Kleinstkonten auf).
 */
export function horizontalanalyse(zeilen: Zeile[], schwellen: { relativ: number; absolut: number }) {
  if (zeilen.length === 0) throw new AnalytikFehler("Keine Zeilen übergeben.");
  if (!(schwellen.relativ >= 0) || !(schwellen.absolut >= 0)) throw new AnalytikFehler("Schwellen müssen ≥ 0 sein.");
  const ergebnisse: HorizontalErgebnis[] = zeilen.map((z) => {
    zahl(z.aktuell, `Aktuell (${z.konto})`);
    zahl(z.vorjahr, `Vorjahr (${z.konto})`);
    const abw = z.aktuell - z.vorjahr;
    const rel = z.vorjahr === 0 ? null : abw / Math.abs(z.vorjahr);
    const absOk = Math.abs(abw) >= schwellen.absolut && abw !== 0;
    const relOk = rel === null ? true : Math.abs(rel) >= schwellen.relativ;
    const auffaellig = absOk && relOk;
    return {
      konto: z.konto,
      aktuell: z.aktuell,
      vorjahr: z.vorjahr,
      abweichung: abw,
      abweichungProzent: rel === null ? null : rel * 100,
      auffaellig,
      grund: auffaellig ? (rel === null ? "Vorjahr 0: neue Position" : "Schwellen relativ und absolut erreicht") : undefined,
    };
  });
  return {
    normbezug: NORM_ANALYTIK,
    ergebnisse,
    hinweise: ["Auffälligkeiten sind Prüfhinweise. Keine Auffälligkeit ist kein Nachweis der Richtigkeit."],
  };
}

// --- Vertikalanalyse und Kennzahlen -----------------------------------------

export type VertikalErgebnis = { konto: string; anteilProzent: number; anteilVorjahrProzent: number | null; veraenderungProzentpunkte: number | null };

/** Anteil jeder Position an einer Basis (Bilanzsumme bzw. Umsatz), optional mit Strukturveränderung zum Vorjahr. */
export function vertikalanalyse(zeilen: Zeile[], basis: { aktuell: number; vorjahr?: number }) {
  zahl(basis.aktuell, "Basis aktuell");
  if (basis.aktuell === 0) throw new AnalytikFehler("Die Basis darf nicht 0 sein.");
  if (basis.vorjahr !== undefined) zahl(basis.vorjahr, "Basis Vorjahr");
  const ergebnisse: VertikalErgebnis[] = zeilen.map((z) => {
    const anteil = (z.aktuell / basis.aktuell) * 100;
    const vj = basis.vorjahr ? (z.vorjahr / basis.vorjahr) * 100 : null;
    return { konto: z.konto, anteilProzent: anteil, anteilVorjahrProzent: vj, veraenderungProzentpunkte: vj === null ? null : anteil - vj };
  });
  return { normbezug: NORM_ANALYTIK, ergebnisse, hinweise: [] as string[] };
}

/** Quotient; null bei Nenner 0 (nie Infinity/NaN in Berichten). */
export const verhaeltnis = (zaehler: number, nenner: number): number | null => (nenner === 0 || !Number.isFinite(zaehler / nenner) ? null : zaehler / nenner);

export const eigenkapitalquote = (eigenkapital: number, bilanzsumme: number) => verhaeltnis(eigenkapital, bilanzsumme);
/** Liquiditätsgrad 2 = (flüssige Mittel + kurzfristige Forderungen) / kurzfristiges Fremdkapital */
export const liquiditaetsgrad2 = (fluessigeMittel: number, kurzfristigeForderungen: number, kurzfristigesFremdkapital: number) =>
  verhaeltnis(fluessigeMittel + kurzfristigeForderungen, kurzfristigesFremdkapital);
/** Debitorenlaufzeit in Tagen = Debitoren / Umsatz × Tage (Umsatzbasis und Mehrwertsteuer konsistent wählen). */
export const debitorenlaufzeitTage = (debitoren: number, umsatz: number, tage = 365) => {
  const v = verhaeltnis(debitoren, umsatz);
  return v === null ? null : v * tage;
};

// --- Regression / Erwartungswert --------------------------------------------

export type Punkt = { x: number; y: number };
export type Regression = { n: number; steigung: number; achsenabschnitt: number; r2: number; reststandardfehler: number; xMittel: number; sxx: number; xMin: number; xMax: number };

/** Lineare Regression (kleinste Quadrate). Mindestens 3 Punkte, x nicht konstant. */
export function regression(punkte: Punkt[]): Regression {
  const n = punkte.length;
  if (n < 3) throw new AnalytikFehler("Für eine Regression sind mindestens 3 Datenpunkte nötig.");
  punkte.forEach((p) => {
    zahl(p.x, "x");
    zahl(p.y, "y");
  });
  const xm = punkte.reduce((s, p) => s + p.x, 0) / n;
  const ym = punkte.reduce((s, p) => s + p.y, 0) / n;
  const sxx = punkte.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  if (sxx === 0) throw new AnalytikFehler("Alle x-Werte sind gleich: keine Regression möglich.");
  const sxy = punkte.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const b = sxy / sxx;
  const a = ym - b * xm;
  const sse = punkte.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
  const sst = punkte.reduce((s, p) => s + (p.y - ym) ** 2, 0);
  return {
    n,
    steigung: b,
    achsenabschnitt: a,
    r2: sst === 0 ? 1 : 1 - sse / sst,
    reststandardfehler: Math.sqrt(sse / (n - 2)),
    xMittel: xm,
    sxx,
    xMin: Math.min(...punkte.map((p) => p.x)),
    xMax: Math.max(...punkte.map((p) => p.x)),
  };
}

export const MIN_DATENPUNKTE_ERWARTUNG = 6;

export type ErwartungsErgebnis =
  | { ok: false; grund: string; normbezug: string }
  | {
      ok: true;
      normbezug: string;
      erwartet: number;
      untereGrenze: number;
      obereGrenze: number;
      ist: number;
      abweichung: number;
      ausserhalb: boolean;
      r2: number;
      hinweise: string[];
    };

/**
 * Erwartungswert aus historischen Paaren (z.B. Energiekosten vs. Produktionsvolumen) und Vergleich mit dem Ist-Wert.
 * Toleranzband = Erwartungswert ± k × Standardfehler der Prognose (Näherung, keine t-Verteilung; Standard k = 2).
 * Bei zu wenig Daten wird nichts berechnet (kein Spekulieren).
 */
export function erwartungswertPruefung(p: { historie: Punkt[]; xAktuell: number; istWert: number; k?: number }): ErwartungsErgebnis {
  if (p.historie.length < MIN_DATENPUNKTE_ERWARTUNG) {
    return { ok: false, normbezug: NORM_ANALYTIK, grund: `Unzureichende Datenbasis: ${p.historie.length} Datenpunkte, mindestens ${MIN_DATENPUNKTE_ERWARTUNG} nötig.` };
  }
  zahl(p.xAktuell, "xAktuell");
  zahl(p.istWert, "istWert");
  const k = p.k ?? 2;
  if (!(k > 0)) throw new AnalytikFehler("k muss > 0 sein.");
  const r = regression(p.historie);
  const erwartet = r.achsenabschnitt + r.steigung * p.xAktuell;
  const se = r.reststandardfehler * Math.sqrt(1 + 1 / r.n + (p.xAktuell - r.xMittel) ** 2 / r.sxx);
  const hinweise = ["Toleranzband ist eine Näherung; das Band ist im Licht der Wesentlichkeit und der Erwartungsgenauigkeit zu würdigen (PS 520)."];
  if (r.r2 < 0.7) hinweise.push(`Bestimmtheitsmass R² = ${r.r2.toFixed(2)}: das Modell erklärt die Werte nur begrenzt; Erwartungswert mit Vorsicht verwenden.`);
  if (p.xAktuell < r.xMin || p.xAktuell > r.xMax) hinweise.push("Der aktuelle x-Wert liegt ausserhalb des historischen Bereichs (Extrapolation).");
  const untere = erwartet - k * se;
  const obere = erwartet + k * se;
  return {
    ok: true,
    normbezug: NORM_ANALYTIK,
    erwartet,
    untereGrenze: untere,
    obereGrenze: obere,
    ist: p.istWert,
    abweichung: p.istWert - erwartet,
    ausserhalb: p.istWert < untere || p.istWert > obere,
    r2: r.r2,
    hinweise,
  };
}

// --- Trend -----------------------------------------------------------------

/** Trend einer Zeitreihe (Perioden 1..n) als lineare Regression: Steigung pro Periode und R². */
export function trend(werte: number[]) {
  const r = regression(werte.map((y, i) => ({ x: i + 1, y })));
  return { normbezug: NORM_ANALYTIK, steigungProPeriode: r.steigung, r2: r.r2, hinweise: r.n < MIN_DATENPUNKTE_ERWARTUNG ? ["Kurze Zeitreihe: Trend nur eingeschränkt aussagekräftig."] : [] };
}
