/**
 * Journalprüfung (Journal Entry Testing, JET) nach den Merkmalen manipulierter Journalbuchungen.
 *
 * QUELLEN: ISA-CH 240 (gültig ab 15.12.2022), Tz. 32, 33(a) und A42–A45 (Merkmale in A44) sowie HWP OR 2024, Teil III.3.9.4.2,
 * Rz. 374–377. Zwei Kriterien (Wochenende/Feiertag, Wiederholungen) stehen nur im HWP (Rz. 375), nicht im Text des ISA-CH 240;
 * sie sind als «ergänzend» gekennzeichnet und abschaltbar. Es handelt sich nicht um die überarbeitete Fassung ISA 240 (Revised);
 * deren Abgleich bleibt dem Prüfer überlassen. Kriterien und Schwellen sind Parameter.
 *
 * Treffer sind Prüfhinweise, keine Feststellung dolosen Handelns; ohne Treffer ist nichts bewiesen. Fehlen Spalten, die ein
 * Kriterium braucht, wird es als «nicht prüfbar» ausgewiesen und nie stillschweigend als «ohne Auffälligkeit» gewertet.
 * Art, zeitliche Einteilung und Umfang legt der Prüfer nach pflichtgemässem Ermessen fest (A45); Buchungen zum Ende des
 * Berichtszeitraums sind auszuwählen (Tz. 33(a)(ii)), ob auch solche des gesamten Zeitraums nötig sind, ist zu erwägen (Tz. 33(a)(iii)).
 */
import { hwpZitat, isaZitat } from "../hwp/quelle";
import type { Importiert, Spalten } from "../import";
import { istIsoDatum, tagNummer, wochentag } from "./datum";
import { StichprobenFehler, zufallsauswahl } from "./stichprobe";

export class JournalFehler extends Error {}

export const KRITERIEN = {
  selten_konto: { titel: "Ungewöhnliche oder selten verwendete Konten", braucht: "Spalte Konto", quelle: "ISA-CH 240 A44 (a)", ergaenzend: false },
  selten_erfasser: { titel: "Buchung durch Personen, die typischerweise keine Journalbuchungen vornehmen", braucht: "Spalte Erfasser", quelle: "ISA-CH 240 A44 (b)", ergaenzend: false },
  periodenende: { titel: "Buchung zum Ende des Berichtszeitraums", braucht: "Spalte Datum", quelle: "ISA-CH 240 Tz. 33(a)(ii), A44 (c), A45", ergaenzend: false },
  nachtraeglich: { titel: "Nachträgliche Abschlussbuchung / Erfassung vor oder während der Abschlussaufstellung", braucht: "Spalten Datum und Erfassungsdatum", quelle: "ISA-CH 240 A44 (c), (d)", ergaenzend: false },
  ohne_erlaeuterung: { titel: "Keine oder kaum Erläuterung", braucht: "Spalte Text", quelle: "ISA-CH 240 A44 (c)", ergaenzend: false },
  ohne_konto: { titel: "Buchung ohne Kontonummer", braucht: "Spalte Konto", quelle: "ISA-CH 240 A44 (d)", ergaenzend: false },
  runde_zahl: { titel: "Runde Zahlen oder gleiche Endziffern", braucht: "Betrag", quelle: "ISA-CH 240 A44 (e)", ergaenzend: false },
  risikokonto: { titel: "Konto mit erhöhtem Risiko (Schätzungen, konzerninterne Geschäftsvorfälle, nicht abgestimmte Differenzen, in der Vergangenheit anfällig u.a.)", braucht: "Spalte Konto und Liste der Risikokonten", quelle: "ISA-CH 240 A44 (Art und Komplexität der Konten)", ergaenzend: false },
  manuell: { titel: "Nicht standardisierte (manuelle) Journalbuchung", braucht: "Spalte Buchungsart", quelle: "ISA-CH 240 A44 (ausserhalb des gewöhnlichen Geschäftsverlaufs)", ergaenzend: false },
  wochenende_feiertag: { titel: "Manuelle Buchung an Wochenend- oder Feiertagen", braucht: "Spalte Datum (Buchungsart für «manuell»)", quelle: "HWP Rz. 375 (ergänzend, nicht im ISA-CH 240)", ergaenzend: true },
  wiederholung: { titel: "Buchungen wiederholen sich in regelmässiger oder unregelmässiger Frequenz", braucht: "Betrag (Konto und Datum verbessern die Aussage)", quelle: "HWP Rz. 375 (ergänzend, nicht im ISA-CH 240)", ergaenzend: true },
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
  /** Ergänzende Kriterien aus dem HWP (Wochenende/Feiertag, Wiederholungen) anwenden; Standard: ja */
  ergaenzendeKriterien?: boolean;
};

export type Abdeckung = { geprueft: number; nichtPruefbar: number; treffer: number; aktiv: boolean };

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

  const ergaenzend = p.ergaenzendeKriterien !== false;
  const abd = Object.fromEntries(KRITERIUM_IDS.map((k) => [k, { geprueft: 0, nichtPruefbar: 0, treffer: 0, aktiv: ergaenzend || !KRITERIEN[k].ergaenzend }])) as Record<Kriterium, Abdeckung>;
  const treffer = new Map<string, { kriterien: Kriterium[]; gruende: string[] }>(posten.map((x) => [x.id, { kriterien: [], gruende: [] }]));
  const hinweise = [
    "Treffer sind Prüfhinweise, keine Feststellung dolosen Handelns. Ohne Treffer ist nichts bewiesen; die Merkmale sind ein Hilfsmittel (Rz. 377).",
    `Grundlage: ${isaZitat("33(a), A42–A45")} (nicht die überarbeitete Fassung ISA 240 (Revised)) und HWP Rz. 374–377. Die Festlegung der Schwellen und der Abgleich mit ISA 240 (Revised) sind durch den Prüfer vorzunehmen.`,
    ...(ergaenzend ? ["Wochenende/Feiertag und Wiederholungen sind Ergänzungen aus dem HWP (Rz. 375) und stehen nicht im Text des ISA-CH 240."] : ["Ergänzende Kriterien aus dem HWP (Wochenende/Feiertag, Wiederholungen) sind ausgeschaltet."]),
  ];

  const markiere = (k: Kriterium, id: string, grund: string) => {
    if (!abd[k].aktiv) return;
    const t = treffer.get(id)!;
    t.kriterien.push(k);
    t.gruende.push(`${KRITERIEN[k].titel}: ${grund}`);
    abd[k].treffer++;
  };
  const pruefbar = (k: Kriterium, ok: boolean) => {
    if (!abd[k].aktiv) return;
    if (ok) abd[k].geprueft++;
    else abd[k].nichtPruefbar++;
  };

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

    // 5b. ohne Kontonummer
    pruefbar("ohne_konto", spalten.konto !== undefined);
    if (spalten.konto !== undefined && !x.konto) markiere("ohne_konto", x.id, "keine Kontonummer");

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
    if (abd[k].aktiv && abd[k].nichtPruefbar > 0) hinweise.push(`Kriterium «${KRITERIEN[k].titel}»: ${abd[k].nichtPruefbar} von ${posten.length} Buchungen nicht prüfbar (${KRITERIEN[k].braucht}).`);
  }

  const ergebnisse: JournalErgebnisZeile[] = posten
    .map((x) => {
      const t = treffer.get(x.id)!;
      return { id: x.id, excelZeile: x.excelZeile, kriterien: t.kriterien, gruende: t.gruende, score: t.kriterien.length, betrag: x.betrag };
    })
    .sort((a, b) => b.score - a.score || Math.abs(b.betrag) - Math.abs(a.betrag) || a.excelZeile - b.excelZeile);

  return { normbezug: `${isaZitat("32, 33(a), A42–A45")}; ${hwpZitat([374, 375, 376, 377])}`, anzahl: posten.length, ergebnisse, abdeckung: abd, anteilManuell, hinweise };
}

export type JournalAuswahl = {
  seed: number;
  /** Buchungen zum Ende des Berichtszeitraums bzw. nachträglich erfasst (Tz. 33(a)(ii)) */
  periodenende: string[];
  risikobasiert: string[];
  zufaellig: string[];
  /** Reihenfolge: Periodenende, risikobasiert, zufällig */
  ausgewaehlt: string[];
  hinweise: string[];
};

/**
 * Auswahl der zu prüfenden Buchungen. Drei Teile: (1) Buchungen zum Ende des Berichtszeitraums bzw. nachträglich erfasste, denn
 * diese sind auszuwählen (Tz. 33(a)(ii), A45); (2) die übrigen mit den höchsten Risikoscores; (3) ein Zufallsanteil aus allen
 * übrigen Buchungen (Unvorhersehbarkeit; deckt den gesamten Berichtszeitraum ab, Tz. 33(a)(iii)). Der Seed gehört in die Dokumentation.
 */
export function waehleJournal(ergebnis: JournalErgebnis, n: number, seed: number, zufallsAnteil = 0.2, periodenendeAnteil = 0.3): JournalAuswahl {
  if (!Number.isInteger(n) || n < 1) throw new StichprobenFehler("Der Umfang muss eine ganze Zahl ≥ 1 sein.");
  if (!(zufallsAnteil >= 0 && zufallsAnteil <= 1) || !(periodenendeAnteil >= 0 && periodenendeAnteil <= 1)) throw new StichprobenFehler("Die Anteile müssen zwischen 0 und 1 liegen.");
  const gesamt = Math.min(n, ergebnis.ergebnisse.length);
  const nZufall = Math.min(Math.round(gesamt * zufallsAnteil), gesamt);
  const nPeriode = Math.min(Math.round(gesamt * periodenendeAnteil), gesamt - nZufall);

  const periodenPool = ergebnis.ergebnisse.filter((e) => e.kriterien.includes("periodenende") || e.kriterien.includes("nachtraeglich"));
  const periode = periodenPool.slice(0, nPeriode).map((e) => e.id);
  const risikoPlaetze = Math.max(gesamt - nZufall - periode.length, 0);
  const risiko = ergebnis.ergebnisse.filter((e) => e.score > 0 && !periode.includes(e.id)).slice(0, risikoPlaetze).map((e) => e.id);
  const belegt = new Set([...periode, ...risiko]);
  const rest = ergebnis.ergebnisse.filter((e) => !belegt.has(e.id));
  const nRest = gesamt - belegt.size;
  const zufall = nRest > 0 && rest.length > 0 ? zufallsauswahl(rest.map((e) => ({ id: e.id, buchwert: Math.abs(e.betrag) })), Math.min(nRest, rest.length), seed).ausgewaehlt : [];

  const hinweise: string[] = [];
  if (periodenPool.length === 0) {
    hinweise.push("Keine Buchungen zum Ende des Berichtszeitraums oder mit nachträglicher Erfassung gefunden (oder Datum/Erfassungsdatum fehlt): Die Auswahl nach Tz. 33(a)(ii) ist nicht erfüllt. Ursache klären.");
  } else if (periode.length < periodenPool.length) {
    hinweise.push(`Von ${periodenPool.length} Buchungen zum Ende des Berichtszeitraums bzw. mit nachträglicher Erfassung wurden ${periode.length} ausgewählt; Umfang nach pflichtgemässem Ermessen (A45), bei Bedarf Umfang oder Periodenende-Anteil erhöhen.`);
  }
  hinweise.push("Der Zufallsanteil stützt sich auf den gesamten Berichtszeitraum (Tz. 33(a)(iii)); ob darüber hinaus weitere Buchungen zu prüfen sind, legt der Prüfer fest.");
  if (risiko.length < risikoPlaetze) hinweise.push(`Nur ${risiko.length} weitere Buchungen mit Treffer; der Rest der Auswahl ist zufällig gezogen.`);
  if (n > ergebnis.ergebnisse.length) hinweise.push("Der Umfang übersteigt die Anzahl Buchungen: alle Buchungen ausgewählt.");
  return { seed, periodenende: periode, risikobasiert: risiko, zufaellig: zufall, ausgewaehlt: [...periode, ...risiko, ...zufall], hinweise };
}
