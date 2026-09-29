/**
 * Journalprüfung (Journal Entry Testing, JET) nach den Merkmalen erhöhten Risikos dolosen Handelns.
 *
 * QUELLE: HWP OR 2024, Teil III.3.9.4.2, Rz. 374–377 (mit den Beispielmerkmalen aus ISA-CH 240). Die Kriterien unten
 * bilden die Aufzählung in Rz. 375 ab. HINWEIS: Der Abgleich mit dem Wortlaut von ISA 240 (Revised) war nicht Teil der
 * bereitgestellten Unterlagen und ist durch den Prüfer vorzunehmen; Kriterien und Schwellen sind Parameter.
 *
 * Treffer sind Prüfhinweise, keine Feststellung dolosen Handelns; ohne Treffer ist nichts bewiesen. Fehlen Spalten, die ein
 * Kriterium braucht, wird es als «nicht prüfbar» ausgewiesen und nie stillschweigend als «ohne Auffälligkeit» gewertet.
 * Art, zeitliche Einteilung und Umfang legt der Prüfer nach pflichtgemässem Ermessen fest (Rz. 377).
 */
import { hwpZitat } from "../hwp/quelle";
import type { Importiert, Spalten } from "../import";
import { istIsoDatum, tagNummer, wochentag } from "./datum";
import { StichprobenFehler, zufallsauswahl } from "./stichprobe";

export class JournalFehler extends Error {}

export const KRITERIEN = {
  selten_konto: { titel: "Ungewöhnliche oder selten verwendete Konten", braucht: "Spalte Konto" },
  selten_erfasser: { titel: "Buchung durch Personen, die typischerweise keine Journalbuchungen vornehmen", braucht: "Spalte Erfasser" },
  periodenende: { titel: "Buchung zum Ende des Berichtszeitraums", braucht: "Spalte Datum" },
  nachtraeglich: { titel: "Nachträgliche Abschlussbuchung / Erfassung vor oder während der Abschlussaufstellung", braucht: "Spalten Datum und Erfassungsdatum" },
  ohne_erlaeuterung: { titel: "Keine oder kaum Erläuterung", braucht: "Spalte Text" },
  wochenende_feiertag: { titel: "Manuelle Buchung an Wochenend- oder Feiertagen", braucht: "Spalte Datum (Buchungsart für «manuell»)" },
  runde_zahl: { titel: "Runde Zahlen oder gleiche Endziffern", braucht: "Betrag" },
  wiederholung: { titel: "Buchungen wiederholen sich in regelmässiger oder unregelmässiger Frequenz", braucht: "Betrag (Konto und Datum verbessern die Aussage)" },
  risikokonto: { titel: "Konto mit erhöhtem Risiko (definierte Risikokonten: Schätzungen, konzerninterne Geschäftsvorfälle, nicht abgestimmte Konten u.a.)", braucht: "Spalte Konto und Liste der Risikokonten" },
  manuell: { titel: "Nicht standardisierte (manuelle) Journalbuchung", braucht: "Spalte Buchungsart" },
} as const;

export type Kriterium = keyof typeof KRITERIEN;
export const KRITERIUM_IDS = Object.keys(KRITERIEN) as Kriterium[];

export type JournalParameter = {
  /** Geschäftsjahresende YYYY-MM-DD */
  stichtag: string;
  /** Tage vor dem Stichtag, die als «Ende des Berichtszeitraums» gelten (Standard 7) */
  endeFensterTage?: number;
  /** Konto gilt als selten, wenn es höchstens so oft bebucht wurde (Standard 3) */
  seltenKontoMax?: number;
  /** Erfasser gilt als selten, wenn sein Anteil an den Buchungen darunter liegt (Standard 1 %) */
  seltenErfasserAnteil?: number;
  /** Text mit weniger Zeichen gilt als nicht erläutert (Standard 5) */
  textMinLaenge?: number;
  /** Rundbetrag: Vielfaches von … (Standard 1000) ab Mindestbetrag (Standard 10'000) */
  rundung?: number;
  minRundbetrag?: number;
  /** Feiertage YYYY-MM-DD (kantonal unterschiedlich; vom Prüfer zu liefern) */
  feiertage?: string[];
  /** Als risikobehaftet definierte Konten */
  risikokonten?: string[];
  /** Ab so vielen gleichen Buchungen (Konto und Betrag) gilt eine Wiederholung (Standard 3) */
  wiederholungMin?: number;
};

export type Abdeckung = { geprueft: number; nichtPruefbar: number; treffer: number };

export type JournalErgebnisZeile = {
  id: string;
  excelZeile: number;
  kriterien: Kriterium[];
  gruende: string[];
  score: number;
  betrag: number;
};

export type JournalErgebnis = {
  normbezug: string;
  anzahl: number;
  ergebnisse: JournalErgebnisZeile[];
  abdeckung: Record<Kriterium, Abdeckung>;
  /** Anteil manueller Buchungen (0–1), wenn die Buchungsart vorhanden ist */
  anteilManuell?: number;
  hinweise: string[];
};

const GLEICHE_ENDZIFFERN = /(\d)\1\1$/;

function rundOderEndziffern(betrag: number, rundung: number, minBetrag: number): string | null {
  const a = Math.abs(betrag);
  if (a < minBetrag) return null;
  const rappen = Math.round(a * 100);
  if (rappen % Math.round(rundung * 100) === 0) return `Betrag ${a} ist ein Vielfaches von ${rundung}`;
  if (Number.isInteger(a) && GLEICHE_ENDZIFFERN.test(String(a)) && !/000$/.test(String(a))) return `Betrag ${a} endet auf drei gleiche Ziffern`;
  return null;
}

export function pruefeJournal(posten: Importiert[], spalten: Spalten, p: JournalParameter): JournalErgebnis {
  if (!istIsoDatum(p.stichtag)) throw new JournalFehler("Der Stichtag ist kein gültiges Datum (JJJJ-MM-TT).");
  if (posten.length === 0) throw new JournalFehler("Das Journal enthält keine Buchungen.");
  const fenster = p.endeFensterTage ?? 7;
  const seltenKonto = p.seltenKontoMax ?? 3;
  const seltenAnteil = p.seltenErfasserAnteil ?? 0.01;
  const textMin = p.textMinLaenge ?? 5;
  const rundung = p.rundung ?? 1000;
  const minRund = p.minRundbetrag ?? 10_000;
  const wiederholungMin = p.wiederholungMin ?? 3;
  if (fenster < 0 || seltenKonto < 0 || !(seltenAnteil >= 0 && seltenAnteil <= 1) || textMin < 0 || rundung <= 0 || minRund < 0 || wiederholungMin < 2) {
    throw new JournalFehler("Ungültige Parameter.");
  }
  const feiertage = new Set((p.feiertage ?? []).filter(istIsoDatum));
  const risikokonten = new Set((p.risikokonten ?? []).map((k) => k.trim()).filter(Boolean));
  const stichtag = tagNummer(p.stichtag);

  const abd = Object.fromEntries(KRITERIUM_IDS.map((k) => [k, { geprueft: 0, nichtPruefbar: 0, treffer: 0 }])) as Record<Kriterium, Abdeckung>;
  const treffer = new Map<string, { kriterien: Kriterium[]; gruende: string[] }>(posten.map((x) => [x.id, { kriterien: [], gruende: [] }]));
  const hinweise = [
    "Treffer sind Prüfhinweise, keine Feststellung dolosen Handelns. Ohne Treffer ist nichts bewiesen; die Merkmale sind ein Hilfsmittel (Rz. 377).",
    "Abgleich der Kriterien mit dem Wortlaut von ISA 240 (Revised) und die Festlegung der Schwellen sind durch den Prüfer vorzunehmen.",
  ];

  const markiere = (k: Kriterium, id: string, grund: string) => {
    const t = treffer.get(id)!;
    t.kriterien.push(k);
    t.gruende.push(`${KRITERIEN[k].titel}: ${grund}`);
    abd[k].treffer++;
  };
  const pruefbar = (k: Kriterium, ok: boolean) => (ok ? abd[k].geprueft++ : abd[k].nichtPruefbar++);

  // Häufigkeiten für seltene Konten und Erfasser
  const proKonto = new Map<string, number>();
  const proErfasser = new Map<string, number>();
  posten.forEach((x) => {
    if (x.konto) proKonto.set(x.konto, (proKonto.get(x.konto) ?? 0) + 1);
    if (x.erfasser) proErfasser.set(x.erfasser, (proErfasser.get(x.erfasser) ?? 0) + 1);
  });
  const mitErfasser = [...proErfasser.values()].reduce((a, b) => a + b, 0);
  const erfasserAussagekraeftig = proErfasser.size >= 3 && mitErfasser >= 30;
  if (spalten.erfasser !== undefined && !erfasserAussagekraeftig) {
    hinweise.push("Selten buchende Erfasser: zu wenige Erfasser oder Buchungen (weniger als 3 Erfasser bzw. 30 Buchungen) für eine aussagekräftige Häufigkeitsanalyse; Kriterium nicht angewandt.");
  }
  if (spalten.konto !== undefined && proKonto.size < 5) hinweise.push("Seltene Konten: weniger als 5 verschiedene Konten im Journal; das Kriterium ist wenig aussagekräftig.");

  // Wiederholungen: gleicher Betrag auf gleichem Konto
  const gruppen = new Map<string, Importiert[]>();
  posten.forEach((x) => {
    const key = `${x.konto ?? ""}|${Math.round(Math.abs(x.betrag) * 100)}`;
    gruppen.set(key, [...(gruppen.get(key) ?? []), x]);
  });

  for (const x of posten) {
    // 1. seltenes Konto
    pruefbar("selten_konto", spalten.konto !== undefined && !!x.konto && proKonto.size >= 5);
    if (spalten.konto !== undefined && x.konto && proKonto.size >= 5 && (proKonto.get(x.konto) ?? 0) <= seltenKonto) markiere("selten_konto", x.id, `Konto ${x.konto} wurde nur ${proKonto.get(x.konto)}× bebucht`);

    // 2. seltener Erfasser
    const erfOk = spalten.erfasser !== undefined && !!x.erfasser && erfasserAussagekraeftig;
    pruefbar("selten_erfasser", erfOk);
    if (erfOk && (proErfasser.get(x.erfasser!) ?? 0) / mitErfasser < seltenAnteil) {
      markiere("selten_erfasser", x.id, `«${x.erfasser}» erfasst nur ${(((proErfasser.get(x.erfasser!) ?? 0) / mitErfasser) * 100).toFixed(1)} % der Buchungen`);
    }

    // 3. Periodenende
    pruefbar("periodenende", spalten.datum !== undefined && !!x.datum);
    if (x.datum) {
      const abstand = stichtag - tagNummer(x.datum);
      if (abstand >= 0 && abstand <= fenster) markiere("periodenende", x.id, `${abstand} Tag(e) vor dem Stichtag`);
    }

    // 4. nachträgliche Erfassung
    pruefbar("nachtraeglich", spalten.datum !== undefined && spalten.erfassungsdatum !== undefined && !!x.datum && !!x.erfassungsdatum);
    if (x.datum && x.erfassungsdatum && tagNummer(x.datum) <= stichtag && tagNummer(x.erfassungsdatum) > stichtag) {
      markiere("nachtraeglich", x.id, `im Geschäftsjahr gebucht, aber erst am ${x.erfassungsdatum} erfasst`);
    }

    // 5. ohne Erläuterung
    pruefbar("ohne_erlaeuterung", spalten.text !== undefined);
    if (spalten.text !== undefined && (x.text ?? "").length < textMin) markiere("ohne_erlaeuterung", x.id, x.text ? `Text «${x.text}» hat weniger als ${textMin} Zeichen` : "kein Text");

    // 6. Wochenende/Feiertag (nur manuelle Buchungen, wenn die Buchungsart vorhanden ist)
    const zeitOk = spalten.datum !== undefined && !!x.datum && (spalten.manuell === undefined || x.manuell !== undefined);
    pruefbar("wochenende_feiertag", zeitOk);
    if (zeitOk && x.datum && (spalten.manuell === undefined || x.manuell === true)) {
      const wt = wochentag(x.datum);
      if (wt === 0 || wt === 6) markiere("wochenende_feiertag", x.id, `${x.datum} ist ein ${wt === 0 ? "Sonntag" : "Samstag"}`);
      else if (feiertage.has(x.datum)) markiere("wochenende_feiertag", x.id, `${x.datum} ist ein angegebener Feiertag`);
    }

    // 7. runde Zahlen
    pruefbar("runde_zahl", true);
    const rund = rundOderEndziffern(x.betrag, rundung, minRund);
    if (rund) markiere("runde_zahl", x.id, rund);

    // 8. Wiederholung
    pruefbar("wiederholung", true);
    const g = gruppen.get(`${x.konto ?? ""}|${Math.round(Math.abs(x.betrag) * 100)}`)!;
    if (g.length >= wiederholungMin && Math.abs(x.betrag) > 0) {
      const daten = g.map((y) => y.datum).filter((d): d is string => !!d).map(tagNummer).sort((a, b) => a - b);
      const monatlich = daten.length >= wiederholungMin && daten.slice(1).filter((d, i) => d - daten[i]! >= 25 && d - daten[i]! <= 35).length >= wiederholungMin - 1;
      markiere("wiederholung", x.id, `${g.length}× derselbe Betrag${x.konto ? ` auf Konto ${x.konto}` : ""}${monatlich ? " in monatlicher Abfolge" : ""}`);
    }

    // 9. Risikokonto
    const rkOk = spalten.konto !== undefined && !!x.konto && risikokonten.size > 0;
    pruefbar("risikokonto", rkOk);
    if (rkOk && risikokonten.has(x.konto!)) markiere("risikokonto", x.id, `Konto ${x.konto} ist als Risikokonto definiert`);

    // 10. manuell
    pruefbar("manuell", spalten.manuell !== undefined && x.manuell !== undefined);
    if (x.manuell === true) markiere("manuell", x.id, "manuelle Buchung");
  }

  let anteilManuell: number | undefined;
  if (spalten.manuell !== undefined) {
    const bekannt = posten.filter((x) => x.manuell !== undefined);
    if (bekannt.length) {
      anteilManuell = bekannt.filter((x) => x.manuell).length / bekannt.length;
      hinweise.push(`Anteil manueller Buchungen: ${(anteilManuell * 100).toFixed(1)} %. Ein hoher Anteil erhöht das Risiko und spricht für mehr aussagebezogene Prüfungen (Rz. 375).`);
    }
  }
  for (const k of KRITERIUM_IDS) {
    if (abd[k].nichtPruefbar > 0) hinweise.push(`Kriterium «${KRITERIEN[k].titel}»: ${abd[k].nichtPruefbar} von ${posten.length} Buchungen nicht prüfbar (${KRITERIEN[k].braucht}).`);
  }

  const ergebnisse: JournalErgebnisZeile[] = posten
    .map((x) => {
      const t = treffer.get(x.id)!;
      return { id: x.id, excelZeile: x.excelZeile, kriterien: t.kriterien, gruende: t.gruende, score: t.kriterien.length, betrag: x.betrag };
    })
    .sort((a, b) => b.score - a.score || Math.abs(b.betrag) - Math.abs(a.betrag) || a.excelZeile - b.excelZeile);

  return { normbezug: hwpZitat([374, 375, 376, 377]), anzahl: posten.length, ergebnisse, abdeckung: abd, anteilManuell, hinweise };
}

export type JournalAuswahl = {
  seed: number;
  risikobasiert: string[];
  zufaellig: string[];
  /** Reihenfolge: risikobasiert, dann zufällig */
  ausgewaehlt: string[];
  hinweise: string[];
};

/**
 * Auswahl der zu prüfenden Buchungen: die höchsten Risikoscores zuerst, dazu ein Zufallsanteil aus allen übrigen Buchungen
 * (Unvorhersehbarkeit; auch Buchungen ohne Treffer haben eine Chance, Rz. 767). Der Seed gehört in die Dokumentation.
 */
export function waehleJournal(ergebnis: JournalErgebnis, n: number, seed: number, zufallsAnteil = 0.2): JournalAuswahl {
  if (!Number.isInteger(n) || n < 1) throw new StichprobenFehler("Der Umfang muss eine ganze Zahl ≥ 1 sein.");
  if (!(zufallsAnteil >= 0 && zufallsAnteil <= 1)) throw new StichprobenFehler("Der Zufallsanteil muss zwischen 0 und 1 liegen.");
  const gesamt = Math.min(n, ergebnis.ergebnisse.length);
  const nZufall = Math.min(Math.round(gesamt * zufallsAnteil), gesamt);
  const mitTreffer = ergebnis.ergebnisse.filter((e) => e.score > 0);
  const risiko = mitTreffer.slice(0, gesamt - nZufall).map((e) => e.id);
  const rest = ergebnis.ergebnisse.filter((e) => !risiko.includes(e.id));
  const nRest = gesamt - risiko.length;
  const zufall = nRest > 0 && rest.length > 0 ? zufallsauswahl(rest.map((e) => ({ id: e.id, buchwert: Math.abs(e.betrag) })), Math.min(nRest, rest.length), seed).ausgewaehlt : [];
  const hinweise: string[] = [];
  if (mitTreffer.length < gesamt - nZufall) hinweise.push(`Nur ${mitTreffer.length} Buchungen mit Treffer; der Rest der Auswahl ist zufällig gezogen.`);
  if (n > ergebnis.ergebnisse.length) hinweise.push("Der Umfang übersteigt die Anzahl Buchungen: alle Buchungen ausgewählt.");
  return { seed, risikobasiert: risiko, zufaellig: zufall, ausgewaehlt: [...risiko, ...zufall], hinweise };
}
