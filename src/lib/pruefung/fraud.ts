/**
 * Betrugsrisikoindikatoren für Journalbuchungen (PS 240 / ISA 240, Journal Entry Testing).
 *
 * Diese Heuristiken markieren Buchungen für die weitere Prüfung. Ein Treffer ist ein Prüfhinweis und keine Feststellung
 * von Betrug; ein fehlender Treffer beweist nichts. Fehlen Angaben, die eine Regel braucht (z.B. Uhrzeit), wird die Regel
 * für diese Buchungen als «nicht prüfbar» ausgewiesen und nie stillschweigend als «ohne Auffälligkeit» gewertet.
 */
import { istIsoDatum, tagNummer, wochentag } from "./datum";

export class FraudFehler extends Error {}

export const NORM_FRAUD = "PS 240 (ISA 240) Verantwortlichkeiten bei dolosen Handlungen: Prüfung von Journalbuchungen";

export type Buchung = {
  id: string;
  /** YYYY-MM-DD */
  datum: string;
  /** HH:MM (Erfassungszeit), optional */
  zeit?: string;
  konto: string;
  betrag: number;
  text?: string;
  erfasser?: string;
  freigeber?: string;
  /** true = manuelle Buchung, false = automatisch/Schnittstelle, undefined = unbekannt */
  manuell?: boolean;
  /** Kreditor/Zahlungsempfänger für die Doppelzahlungsprüfung */
  partner?: string;
  belegnr?: string;
};

export type Regel = "ausserhalb_zeit" | "wochenende" | "rundbetrag" | "jahresende_manuell" | "doppelzahlung" | "funktionstrennung";

export type FraudParameter = {
  /** Geschäftsjahresende YYYY-MM-DD */
  geschaeftsjahrEnde: string;
  /** übliche Erfassungszeit in Stunden (Standard 7–19 Uhr) */
  arbeitszeit?: { von: number; bis: number };
  /** Fenster vor dem Jahresende in Tagen (Standard 7) */
  jahresendTage?: number;
  /** Rundung in CHF (Standard 1000) und Mindestbetrag (Standard 10000) */
  rundung?: number;
  minRundbetrag?: number;
  /** Zeitfenster für Doppelzahlungen in Tagen (Standard 30) */
  doppelzahlungTage?: number;
};

export type Befund = { regel: Regel; buchungen: string[]; begruendung: string };
export type Abdeckung = { geprueft: number; nichtPruefbar: number };

export type FraudErgebnis = {
  normbezug: string;
  anzahlBuchungen: number;
  befunde: Befund[];
  abdeckung: Record<Regel, Abdeckung>;
  hinweise: string[];
};

const ZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REGELN: Regel[] = ["ausserhalb_zeit", "wochenende", "rundbetrag", "jahresende_manuell", "doppelzahlung", "funktionstrennung"];

export function pruefeJournal(buchungen: Buchung[], p: FraudParameter): FraudErgebnis {
  if (!istIsoDatum(p.geschaeftsjahrEnde)) throw new FraudFehler("Geschäftsjahresende ist kein gültiges Datum (YYYY-MM-DD).");
  const von = p.arbeitszeit?.von ?? 7;
  const bis = p.arbeitszeit?.bis ?? 19;
  const fenster = p.jahresendTage ?? 7;
  const rundung = p.rundung ?? 1000;
  const minRund = p.minRundbetrag ?? 10_000;
  const dpTage = p.doppelzahlungTage ?? 30;
  if (!(von >= 0 && bis <= 24 && von < bis) || fenster < 0 || rundung <= 0 || minRund < 0 || dpTage < 0) throw new FraudFehler("Ungültige Parameter.");

  const ids = new Set<string>();
  for (const b of buchungen) {
    if (!b.id || ids.has(b.id)) throw new FraudFehler(`Buchungs-ID fehlt oder ist doppelt: «${b.id}».`);
    ids.add(b.id);
    if (!istIsoDatum(b.datum)) throw new FraudFehler(`Ungültiges Datum bei «${b.id}».`);
    if (!Number.isFinite(b.betrag)) throw new FraudFehler(`Ungültiger Betrag bei «${b.id}».`);
    if (b.zeit !== undefined && !ZEIT.test(b.zeit)) throw new FraudFehler(`Ungültige Zeit bei «${b.id}» (HH:MM).`);
  }

  const befunde: Befund[] = [];
  const abd = Object.fromEntries(REGELN.map((r) => [r, { geprueft: 0, nichtPruefbar: 0 }])) as Record<Regel, Abdeckung>;
  const ende = tagNummer(p.geschaeftsjahrEnde);

  for (const b of buchungen) {
    // 1. Erfassung ausserhalb der üblichen Zeit
    if (b.zeit === undefined) abd.ausserhalb_zeit.nichtPruefbar++;
    else {
      abd.ausserhalb_zeit.geprueft++;
      const h = Number(b.zeit.slice(0, 2)) + Number(b.zeit.slice(3)) / 60;
      if (h < von || h >= bis) befunde.push({ regel: "ausserhalb_zeit", buchungen: [b.id], begruendung: `Erfasst um ${b.zeit}, ausserhalb ${von}:00–${bis}:00 Uhr.` });
    }
    // 2. Wochenende
    abd.wochenende.geprueft++;
    const wt = wochentag(b.datum);
    if (wt === 0 || wt === 6) befunde.push({ regel: "wochenende", buchungen: [b.id], begruendung: `Buchungsdatum ${b.datum} fällt auf ein Wochenende.` });
    // 3. Rundbetrag
    abd.rundbetrag.geprueft++;
    const rappen = Math.round(Math.abs(b.betrag) * 100);
    if (Math.abs(b.betrag) >= minRund && rappen % Math.round(rundung * 100) === 0) {
      befunde.push({ regel: "rundbetrag", buchungen: [b.id], begruendung: `Betrag ${b.betrag} ist ein Vielfaches von ${rundung} (ab ${minRund}).` });
    }
    // 4. Manuelle Korrektur kurz vor Jahresende
    if (b.manuell === undefined) abd.jahresende_manuell.nichtPruefbar++;
    else {
      abd.jahresende_manuell.geprueft++;
      const abstand = ende - tagNummer(b.datum);
      if (b.manuell && abstand >= 0 && abstand <= fenster) {
        befunde.push({ regel: "jahresende_manuell", buchungen: [b.id], begruendung: `Manuelle Buchung ${abstand} Tag(e) vor Geschäftsjahresende.` });
      }
    }
    // 6. Funktionstrennung
    if (b.erfasser === undefined || b.freigeber === undefined) abd.funktionstrennung.nichtPruefbar++;
    else {
      abd.funktionstrennung.geprueft++;
      if (b.erfasser === b.freigeber) befunde.push({ regel: "funktionstrennung", buchungen: [b.id], begruendung: `Erfasser und Freigeber sind identisch («${b.erfasser}»).` });
    }
  }

  // 5. Doppelzahlungen: gleicher Partner, gleicher Betrag, innerhalb des Zeitfensters
  const gruppen = new Map<string, Buchung[]>();
  for (const b of buchungen) {
    if (!b.partner) {
      abd.doppelzahlung.nichtPruefbar++;
      continue;
    }
    abd.doppelzahlung.geprueft++;
    const key = `${b.partner}|${Math.round(Math.abs(b.betrag) * 100)}`;
    gruppen.set(key, [...(gruppen.get(key) ?? []), b]);
  }
  for (const g of gruppen.values()) {
    const sortiert = [...g].sort((a, b) => tagNummer(a.datum) - tagNummer(b.datum));
    for (let i = 1; i < sortiert.length; i++) {
      const a = sortiert[i - 1]!;
      const b = sortiert[i]!;
      if (tagNummer(b.datum) - tagNummer(a.datum) <= dpTage) {
        const gleich = a.belegnr && a.belegnr === b.belegnr ? " Gleiche Belegnummer." : "";
        befunde.push({ regel: "doppelzahlung", buchungen: [a.id, b.id], begruendung: `Gleicher Partner «${a.partner}» und Betrag ${Math.abs(b.betrag)} innerhalb von ${dpTage} Tagen.${gleich}` });
      }
    }
  }

  const hinweise = [
    "Treffer sind Prüfhinweise, keine Feststellung dolosen Handelns. Ohne Treffer ist nichts bewiesen.",
    "Die Management-Override-Risiken sind mit diesen Regeln nicht abgedeckt; sie ersetzen kein vollständiges Journal Entry Testing.",
  ];
  for (const r of REGELN) if (abd[r].nichtPruefbar > 0) hinweise.push(`Regel «${r}»: ${abd[r].nichtPruefbar} von ${buchungen.length} Buchungen nicht prüfbar (Angaben fehlen).`);
  return { normbezug: NORM_FRAUD, anzahlBuchungen: buchungen.length, befunde, abdeckung: abd, hinweise };
}
