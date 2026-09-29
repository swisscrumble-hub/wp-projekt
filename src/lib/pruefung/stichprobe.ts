/**
 * Stichprobenlogik nach PS 530 (ISA 530): Auswahl (zufällig, systematisch, monetär/MUS), Stichprobenumfang,
 * Auswertung und Hochrechnung. Reine Rechenlogik: keine Daten verlassen das System, alle Ergebnisse sind
 * nachvollziehbar (Seed, Intervall, Faktoren) und ersetzen nie das Urteil des Prüfers.
 *
 * Annahmen, die im Ergebnis stehen: MUS-Umfang und Stringer-Grenze setzen erwartete Fehler = 0 bzw. Überbewertungen voraus.
 */
import { seededRandom } from "./zufall";

export class StichprobenFehler extends Error {}

export type Posten = { id: string; buchwert: number };

export type Grundgesamtheit = { anzahl: number; wert: number };

export type AuswahlErgebnis = {
  methode: "zufaellig" | "systematisch" | "monetaer";
  normbezug: string;
  seed: number;
  grundgesamtheit: Grundgesamtheit;
  /** IDs in der Reihenfolge der Grundgesamtheit */
  ausgewaehlt: string[];
  /** Nur MUS/systematisch: Auswahlintervall (Betrag bzw. Anzahl) */
  intervall?: number;
  /** Nur MUS: Posten ≥ Intervall, immer geprüft (Einzelfallprüfung, keine Hochrechnung) */
  sicherAusgewaehlt?: string[];
  hinweise: string[];
};

const NORM = "PS 530 (ISA 530) Prüfungsnachweise: Stichprobenverfahren";

function pruefePosten(posten: Posten[]): void {
  if (posten.length === 0) throw new StichprobenFehler("Die Grundgesamtheit ist leer.");
  const ids = new Set<string>();
  for (const p of posten) {
    if (!p.id || ids.has(p.id)) throw new StichprobenFehler(`ID fehlt oder ist doppelt: «${p.id}».`);
    if (!Number.isFinite(p.buchwert)) throw new StichprobenFehler(`Buchwert von «${p.id}» ist keine Zahl.`);
    ids.add(p.id);
  }
}

function pruefeUmfang(n: number, max: number): void {
  if (!Number.isInteger(n) || n < 1) throw new StichprobenFehler("Der Stichprobenumfang muss eine ganze Zahl ≥ 1 sein.");
  if (n > max) throw new StichprobenFehler(`Der Stichprobenumfang (${n}) übersteigt die Grundgesamtheit (${max}).`);
}

const gg = (posten: Posten[]): Grundgesamtheit => ({ anzahl: posten.length, wert: posten.reduce((s, p) => s + p.buchwert, 0) });

/** Einfache Zufallsauswahl ohne Zurücklegen (partieller Fisher-Yates). */
export function zufallsauswahl(posten: Posten[], n: number, seed: number): AuswahlErgebnis {
  pruefePosten(posten);
  pruefeUmfang(n, posten.length);
  const zufall = seededRandom(seed);
  const idx = posten.map((_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(zufall() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  const gewaehlt = idx.slice(0, n).sort((a, b) => a - b);
  return {
    methode: "zufaellig",
    normbezug: NORM,
    seed,
    grundgesamtheit: gg(posten),
    ausgewaehlt: gewaehlt.map((i) => posten[i]!.id),
    hinweise: [],
  };
}

/** Systematische Auswahl: fester Abstand N/n, zufälliger Start. Bei periodischer Ordnung der Liste verzerrungsanfällig. */
export function systematischeAuswahl(posten: Posten[], n: number, seed: number): AuswahlErgebnis {
  pruefePosten(posten);
  pruefeUmfang(n, posten.length);
  const k = posten.length / n;
  const start = seededRandom(seed)() * k;
  const gewaehlt = Array.from({ length: n }, (_, i) => Math.floor(start + i * k));
  return {
    methode: "systematisch",
    normbezug: NORM,
    seed,
    grundgesamtheit: gg(posten),
    ausgewaehlt: gewaehlt.map((i) => posten[i]!.id),
    intervall: k,
    hinweise: ["Prüfen, ob die Reihenfolge der Liste ein Muster enthält, das mit dem Intervall zusammenfällt (PS 530)."],
  };
}

/**
 * Monetäre Auswahl (MUS/PPS): Wahrscheinlichkeit proportional zum Buchwert. Posten ≥ Intervall werden sicher
 * ausgewählt und das Intervall aus dem Rest neu berechnet. Buchwerte ≤ 0 sind nicht Teil der MUS-Population.
 */
export function monetaereAuswahl(posten: Posten[], n: number, seed: number): AuswahlErgebnis {
  pruefePosten(posten);
  pruefeUmfang(n, posten.length);
  const hinweise: string[] = [];
  const nichtPositiv = posten.filter((p) => p.buchwert <= 0);
  const positiv = posten.filter((p) => p.buchwert > 0);
  if (positiv.length === 0) throw new StichprobenFehler("Kein Posten mit positivem Buchwert: MUS nicht anwendbar.");
  if (nichtPositiv.length > 0) {
    hinweise.push(`${nichtPositiv.length} Posten mit Buchwert ≤ 0 sind nicht in der MUS-Population und separat zu prüfen.`);
  }

  const sicher = new Set<string>();
  let intervall = 0;
  for (;;) {
    const rest = positiv.filter((p) => !sicher.has(p.id));
    const restN = n - sicher.size;
    if (restN <= 0 || rest.length === 0) break;
    intervall = rest.reduce((s, p) => s + p.buchwert, 0) / restN;
    const neu = rest.filter((p) => p.buchwert >= intervall);
    if (neu.length === 0) break;
    neu.forEach((p) => sicher.add(p.id));
  }

  const rest = positiv.filter((p) => !sicher.has(p.id));
  const restN = Math.max(n - sicher.size, 0);
  const gewaehlt = new Set<string>(sicher);
  if (restN > 0 && rest.length > 0) {
    const start = seededRandom(seed)() * intervall;
    let treffer = 0;
    let kumuliert = 0;
    for (const p of rest) {
      kumuliert += p.buchwert;
      let getroffen = false;
      while (treffer < restN && start + treffer * intervall < kumuliert) {
        getroffen = true;
        treffer++;
      }
      if (getroffen) gewaehlt.add(p.id);
    }
  }
  if (sicher.size >= n) hinweise.push("Die sicher auszuwählenden Posten erreichen bereits den Stichprobenumfang; der Umfang ist zu klein für diese Population.");

  return {
    methode: "monetaer",
    normbezug: NORM,
    seed,
    grundgesamtheit: gg(posten),
    ausgewaehlt: posten.filter((p) => gewaehlt.has(p.id)).map((p) => p.id),
    intervall,
    sicherAusgewaehlt: posten.filter((p) => sicher.has(p.id)).map((p) => p.id),
    hinweise,
  };
}

// ---------------------------------------------------------------------------
// Statistische Grundlagen
// ---------------------------------------------------------------------------

function pruefeKonfidenz(c: number): void {
  if (!(c > 0.5 && c < 1)) throw new StichprobenFehler("Das Konfidenzniveau muss zwischen 0.5 und 1 liegen (z.B. 0.95).");
}

/** P(X ≤ k) für X ~ Poisson(λ). */
function poissonCdf(k: number, lambda: number): number {
  let term = Math.exp(-lambda);
  let summe = term;
  for (let j = 1; j <= k; j++) {
    term *= lambda / j;
    summe += term;
  }
  return summe;
}

/** Poisson-Zuverlässigkeitsfaktor: obere Grenze λ für i Fehler bei Konfidenz c (P(X ≤ i | λ) = 1 − c). i=0, 95 % → 2.9957. */
export function poissonFaktor(i: number, konfidenz: number): number {
  pruefeKonfidenz(konfidenz);
  if (!Number.isInteger(i) || i < 0) throw new StichprobenFehler("Fehleranzahl muss eine ganze Zahl ≥ 0 sein.");
  let lo = 0;
  let hi = 2 * i + 60;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (poissonCdf(i, mid) > 1 - konfidenz) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// MUS: Umfang und Auswertung (Stringer-Grenze)
// ---------------------------------------------------------------------------

export type MusUmfang = { n: number; zuverlaessigkeitsfaktor: number; normbezug: string; hinweise: string[] };

/** MUS-Stichprobenumfang bei erwarteter Fehlaussage 0: n = Buchwert × RF / tolerierbare Fehlaussage. */
export function musStichprobenumfang(p: { buchwert: number; toleranz: number; konfidenz: number }): MusUmfang {
  if (!(p.buchwert > 0)) throw new StichprobenFehler("Der Gesamtbuchwert muss > 0 sein.");
  if (!(p.toleranz > 0 && p.toleranz < p.buchwert)) throw new StichprobenFehler("Die tolerierbare Fehlaussage muss > 0 und kleiner als der Gesamtbuchwert sein.");
  const rf = poissonFaktor(0, p.konfidenz);
  return {
    n: Math.ceil((p.buchwert * rf) / p.toleranz),
    zuverlaessigkeitsfaktor: rf,
    normbezug: NORM,
    hinweise: ["Annahme: erwartete Fehlaussage = 0. Bei erwarteten Fehlern ist der Umfang grösser und mit Tabellenwerten bzw. Software festzulegen."],
  };
}

export type MusFehler = { id: string; buchwert: number; gepruefterWert: number };

export type MusAuswertung = {
  normbezug: string;
  intervall: number;
  konfidenz: number;
  basisPraezision: number;
  projizierteFehlaussage: number;
  zuschlagFolgerisiko: number;
  bekannteFehlaussageSichereFaelle: number;
  unterbewertungenNichtSaldiert: number;
  obereFehlergrenze: number;
  toleranz: number;
  /** Nur rechnerischer Vergleich, kein Urteil */
  vergleich: string;
  hinweise: string[];
};

/**
 * MUS-Auswertung mit der Stringer-Grenze: obere Fehlergrenze = Basispräzision + Σ Fehlaussage_i × (RF_i − RF_{i−1}),
 * Fehler nach Taint absteigend. Posten ≥ Intervall gehen als bekannte Fehlaussage ohne Hochrechnung ein.
 * Nur Überbewertungen werden projiziert; Unterbewertungen werden ausgewiesen, nicht saldiert (konservativ).
 */
export function musAuswertung(p: { intervall: number; konfidenz: number; toleranz: number; fehler: MusFehler[] }): MusAuswertung {
  pruefeKonfidenz(p.konfidenz);
  if (!(p.intervall > 0)) throw new StichprobenFehler("Das Intervall muss > 0 sein.");
  const hinweise: string[] = [];
  let bekannt = 0;
  let unter = 0;
  const taints: number[] = [];
  for (const f of p.fehler) {
    if (!(f.buchwert > 0) || !Number.isFinite(f.gepruefterWert)) throw new StichprobenFehler(`Ungültige Angaben zu «${f.id}».`);
    const abw = f.buchwert - f.gepruefterWert;
    if (abw === 0) continue;
    if (abw < 0) {
      unter += -abw;
      continue;
    }
    if (f.buchwert >= p.intervall) {
      bekannt += abw;
      continue;
    }
    let t = abw / f.buchwert;
    if (t > 1) {
      hinweise.push(`Taint von «${f.id}» über 100 % wurde auf 100 % begrenzt.`);
      t = 1;
    }
    taints.push(t);
  }
  taints.sort((a, b) => b - a);

  const rf0 = poissonFaktor(0, p.konfidenz);
  let projiziert = 0;
  let zuschlag = 0;
  let vorher = rf0;
  taints.forEach((t, i) => {
    const rf = poissonFaktor(i + 1, p.konfidenz);
    const pm = t * p.intervall;
    projiziert += pm;
    zuschlag += pm * (rf - vorher - 1);
    vorher = rf;
  });
  const basis = rf0 * p.intervall;
  const obere = basis + projiziert + zuschlag + bekannt;
  if (unter > 0) hinweise.push("Unterbewertungen sind nicht mit Überbewertungen saldiert und separat zu würdigen.");
  hinweise.push("Die Stringer-Grenze ist konservativ; sie ersetzt nicht die Würdigung von Art und Ursache der Fehler (PS 530).");

  return {
    normbezug: NORM,
    intervall: p.intervall,
    konfidenz: p.konfidenz,
    basisPraezision: basis,
    projizierteFehlaussage: projiziert,
    zuschlagFolgerisiko: zuschlag,
    bekannteFehlaussageSichereFaelle: bekannt,
    unterbewertungenNichtSaldiert: unter,
    obereFehlergrenze: obere,
    toleranz: p.toleranz,
    vergleich:
      obere <= p.toleranz
        ? "Rechnerisch liegt die obere Fehlergrenze innerhalb der tolerierbaren Fehlaussage."
        : "Rechnerisch liegt die obere Fehlergrenze über der tolerierbaren Fehlaussage.",
    hinweise,
  };
}

// ---------------------------------------------------------------------------
// Attributprüfung (Kontrolltests, Abweichungsrate)
// ---------------------------------------------------------------------------

/** P(X ≤ k) für X ~ Binomial(n, p), iterativ ohne Fakultäten. */
function binomCdf(k: number, n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let pmf = Math.pow(1 - p, n);
  let summe = pmf;
  for (let j = 0; j < k && j < n; j++) {
    pmf *= ((n - j) / (j + 1)) * (p / (1 - p));
    summe += pmf;
  }
  return Math.min(summe, 1);
}

/** Kleinster Umfang n, sodass bei ≤ k erwarteten Abweichungen die obere Grenze die tolerierbare Rate nicht übersteigt. */
export function attributStichprobenumfang(p: { tolerierbareRate: number; konfidenz: number; erwarteteAbweichungen?: number }) {
  pruefeKonfidenz(p.konfidenz);
  if (!(p.tolerierbareRate > 0 && p.tolerierbareRate < 1)) throw new StichprobenFehler("Die tolerierbare Abweichungsrate muss zwischen 0 und 1 liegen.");
  const k = p.erwarteteAbweichungen ?? 0;
  if (!Number.isInteger(k) || k < 0) throw new StichprobenFehler("Erwartete Abweichungen: ganze Zahl ≥ 0.");
  for (let n = Math.max(k, 1); n <= 20000; n++) {
    if (binomCdf(k, n, p.tolerierbareRate) <= 1 - p.konfidenz) return { n, normbezug: NORM, hinweise: [] as string[] };
  }
  throw new StichprobenFehler("Kein Stichprobenumfang bis 20'000 erreicht die Anforderung.");
}

/** Einseitige obere Grenze der Abweichungsrate (Clopper-Pearson). 0 Abweichungen, n=59, 95 % → 4.95 %. */
export function attributAuswertung(p: { n: number; abweichungen: number; konfidenz: number; tolerierbareRate: number }) {
  pruefeKonfidenz(p.konfidenz);
  if (!Number.isInteger(p.n) || p.n < 1 || !Number.isInteger(p.abweichungen) || p.abweichungen < 0 || p.abweichungen > p.n) {
    throw new StichprobenFehler("Ungültige Angaben zu Umfang oder Abweichungen.");
  }
  let lo = p.abweichungen / p.n;
  let hi = 1;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (binomCdf(p.abweichungen, p.n, mid) > 1 - p.konfidenz) lo = mid;
    else hi = mid;
  }
  const obere = (lo + hi) / 2;
  return {
    normbezug: NORM,
    stichprobenrate: p.abweichungen / p.n,
    obereGrenze: obere,
    vergleich:
      obere <= p.tolerierbareRate
        ? "Rechnerisch liegt die obere Grenze der Abweichungsrate innerhalb der tolerierbaren Rate."
        : "Rechnerisch liegt die obere Grenze der Abweichungsrate über der tolerierbaren Rate.",
    hinweise: ["Qualitative Würdigung der Abweichungen (Ursache, Art) bleibt beim Prüfer."],
  };
}

// ---------------------------------------------------------------------------
// Nicht-statistisch
// ---------------------------------------------------------------------------

/** Geschichtete, nicht-statistische Auswahl: alle Posten ab Schwelle, dazu eine Zufallsauswahl aus dem Rest. */
export function geschichteteAuswahl(posten: Posten[], schwelle: number, nRest: number, seed: number) {
  pruefePosten(posten);
  const hoch = posten.filter((p) => Math.abs(p.buchwert) >= schwelle);
  const rest = posten.filter((p) => Math.abs(p.buchwert) < schwelle);
  const zufall = nRest > 0 && rest.length > 0 ? zufallsauswahl(rest, Math.min(nRest, rest.length), seed) : null;
  const ids = new Set([...hoch.map((p) => p.id), ...(zufall?.ausgewaehlt ?? [])]);
  return {
    normbezug: NORM,
    seed,
    vollstaendigGeprueft: hoch.map((p) => p.id),
    zufallAusRest: zufall?.ausgewaehlt ?? [],
    ausgewaehlt: posten.filter((p) => ids.has(p.id)).map((p) => p.id),
    hinweise: ["Nicht-statistisch: Aus dem Restbereich ist keine statistische Aussage zur Sicherheit möglich."],
  };
}

/** Verhältnis-Hochrechnung als Punktschätzung. Keine Aussage zur Sicherheit; bei Bedarf MUS oder Attributprüfung verwenden. */
export function hochrechnungVerhaeltnis(p: { grundgesamtheitWert: number; stichprobeWert: number; fehlerSumme: number }) {
  if (!(p.stichprobeWert > 0) || !(p.grundgesamtheitWert > 0)) throw new StichprobenFehler("Stichproben- und Grundgesamtheitswert müssen > 0 sein.");
  if (p.stichprobeWert > p.grundgesamtheitWert) throw new StichprobenFehler("Der Stichprobenwert übersteigt die Grundgesamtheit.");
  return {
    normbezug: NORM,
    projizierteFehlaussage: (p.fehlerSumme / p.stichprobeWert) * p.grundgesamtheitWert,
    hinweise: ["Punktschätzung ohne Konfidenz; nicht als statistische Obergrenze verwenden."],
  };
}
