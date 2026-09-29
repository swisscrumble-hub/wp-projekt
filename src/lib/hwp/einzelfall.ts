/**
 * Katalog der Einzelfallprüfungen (aussagebezogene Prüfungshandlungen mit Stichprobe) nach HWP OR 2024, Teil III.4.9
 * (Beispiele aussagebezogener Prüfungshandlungen je Bilanz- und Erfolgsrechnungsposition).
 *
 * Eigene Formulierungen; die Randziffer (rz) nennt die Stelle im Handbuch. Der Katalog ist eine Auswahl der Handlungen,
 * die sich auf eine Grundgesamtheit aus Einzelposten stützen (Buchungen, Salden, Bestände). Reine Abstimmungen, Befragungen und
 * Beurteilungen (z.B. Werthaltigkeitstests) sind nicht enthalten.
 */
import { hwpZitat } from "./quelle";

export type Gruppe = "Aktiven" | "Passiven" | "Erfolgsrechnung";
export type Aussage = "Existenz" | "Vollständigkeit" | "Genauigkeit" | "Bewertung" | "Periodenabgrenzung" | "Eigentum/Ausweis";

export type Einzelfallpruefung = {
  id: string;
  gruppe: Gruppe;
  position: string;
  titel: string;
  /** Hauptaussage, auf die die Handlung zielt */
  aussage: Aussage;
  /** Randziffer im HWP OR 2024, Teil III */
  rz: number;
  /** Zusätzliche Randziffern (z.B. zu Bestätigungen) */
  rzWeitere?: number[];
  /** Was die Excel-Datei enthalten soll */
  population: { titel: string; spalten: string };
  /** Nachweis, gegen den jedes gezogene Element geprüft wird */
  nachweis: string;
  /** Voreingestellte Auswahl: monetär (wertproportional, MUS) oder zufällig (ohne Wertbezug) */
  auswahl: "monetaer" | "zufaellig";
  /** Voreinstellung für den Datumsfilter: Fenster in Tagen um das Geschäftsjahresende */
  stichtagFenster?: number;
  /** Nur Posten nach dem Stichtag (Suche nach nicht bilanzierten Verbindlichkeiten) */
  nurNachStichtag?: boolean;
  /** Nur Soll- bzw. Habenbuchungen (Betrag = Soll − Haben; Soll positiv) */
  vorzeichen?: "soll" | "haben";
  hinweis?: string;
};

const KD = "Kontodetail (Buchungsjournal des Kontos): Belegnummer, Datum, Text, Betrag oder Soll/Haben";
const SL = "Saldenliste per Abschlussstichtag: Kontonummer/Name, Saldo";

export const EINZELFALL: Einzelfallpruefung[] = [
  // --- Aktiven ---------------------------------------------------------------
  { id: "flm-bank", gruppe: "Aktiven", position: "Flüssige Mittel", titel: "Bankbuchungen mit Bankauszügen abgleichen", aussage: "Existenz", rz: 896,
    population: { titel: "Kontodetail Bankkonto", spalten: KD }, nachweis: "Periodischer oder täglicher Bankauszug", auswahl: "monetaer" },
  { id: "flm-einnahmen", gruppe: "Aktiven", position: "Flüssige Mittel", titel: "Einnahmeposten mit Belegen prüfen", aussage: "Vollständigkeit", rz: 896,
    population: { titel: "Kontodetail Kasse/Bank (Eingänge)", spalten: KD }, nachweis: "Zahlungsbeleg, Kassabeleg", auswahl: "monetaer", vorzeichen: "soll" },
  { id: "ford-best", gruppe: "Aktiven", position: "Forderungen aus Lieferungen und Leistungen", titel: "Saldenbestätigungen einholen", aussage: "Existenz", rz: 898, rzWeitere: [659],
    population: { titel: "Debitorensaldenliste", spalten: SL }, nachweis: "Externe Bestätigung; bei ausbleibender Antwort alternative Prüfungshandlungen (Folgezahlungen, Fakturakopien, Warenausgangsscheine)", auswahl: "monetaer" },
  { id: "ford-soll", gruppe: "Aktiven", position: "Forderungen aus Lieferungen und Leistungen", titel: "Belastungen (Soll) auf Debitorenkonten mit Rechnungskopien prüfen", aussage: "Existenz", rz: 898,
    population: { titel: "Kontodetail Debitoren (Soll-Buchungen)", spalten: KD }, nachweis: "Rechnungskopie, Versandunterlagen, Korrespondenz", auswahl: "monetaer", vorzeichen: "soll" },
  { id: "ford-haben", gruppe: "Aktiven", position: "Forderungen aus Lieferungen und Leistungen", titel: "Gutschriften (Haben) auf Debitorenkonten mit Zahlungseingängen prüfen", aussage: "Genauigkeit", rz: 898,
    population: { titel: "Kontodetail Debitoren (Haben-Buchungen)", spalten: KD }, nachweis: "Zahlungseingang bei Bank/Kasse, Vertragskonditionen, Korrespondenz", auswahl: "monetaer", vorzeichen: "haben" },
  { id: "ford-werthaltig", gruppe: "Aktiven", position: "Forderungen aus Lieferungen und Leistungen", titel: "Offene Posten auf Werthaltigkeit prüfen (Altersgliederung)", aussage: "Bewertung", rz: 898,
    population: { titel: "Offene-Posten-Liste mit Fälligkeit", spalten: "Belegnummer/Kunde, Rechnungsdatum, Betrag (offen)" }, nachweis: "Zahlungseingang nach Stichtag, Betreibungs-/Konkursstatus, Korrespondenz", auswahl: "monetaer",
    hinweis: "Die Beurteilung des Delkredere selbst ist eine Ermessensfrage und nicht Teil der Auswahl." },
  { id: "anz-geleistet", gruppe: "Aktiven", position: "Übrige kurzfristige Forderungen", titel: "Buchungen auf Anzahlungskonten (geleistete Anzahlungen) mit Belegen prüfen", aussage: "Existenz", rz: 900, rzWeitere: [899],
    population: { titel: "Kontodetail Anzahlungen", spalten: KD }, nachweis: "Zahlungsbeleg, Vertrag, Bestellung", auswahl: "monetaer" },
  { id: "vorr-zaehl", gruppe: "Aktiven", position: "Vorräte", titel: "Inventarposten nachzählen (Liste zum Lager)", aussage: "Existenz", rz: 901, rzWeitere: [654],
    population: { titel: "Inventarliste per Stichtag", spalten: "Artikelnummer, Bezeichnung, Menge, Wert (Bestandeswert)" }, nachweis: "Nachzählung vor Ort, Beurteilung von Zustand und Alter", auswahl: "monetaer",
    hinweis: "Die Gegenrichtung (Lager zur Liste, Vollständigkeit) ist eine Auswahl am Lager und nicht aus der Liste ziehbar." },
  { id: "vorr-bewertung", gruppe: "Aktiven", position: "Vorräte", titel: "Vorratsbewertung nachrechnen", aussage: "Bewertung", rz: 901,
    population: { titel: "Inventarliste mit Preisen", spalten: "Artikelnummer, Menge, Einstandspreis, Wert" }, nachweis: "Angewandte Bewertungsmethode (z.B. Durchschnittspreis), Einkaufsrechnungen", auswahl: "monetaer" },
  { id: "san-zugang", gruppe: "Aktiven", position: "Sachanlagen", titel: "Zugänge mit Belegen abgleichen", aussage: "Existenz", rz: 907,
    population: { titel: "Anlagenzugänge des Jahres", spalten: "Belegnummer, Datum, Bezeichnung, Betrag" }, nachweis: "Lieferantenrechnung, Vertrag, Abnahmeprotokoll; Aktivierungsfähigkeit", auswahl: "monetaer" },
  { id: "san-bestand", gruppe: "Aktiven", position: "Sachanlagen", titel: "Anlagenbestand abgleichen und besichtigen", aussage: "Existenz", rz: 907,
    population: { titel: "Anlagenbuchhaltung / Anlageninventar", spalten: "Anlagennummer, Bezeichnung, Restbuchwert" }, nachweis: "Besichtigung im Betrieb, Inventarlisten, Grundbuchauszug bei Grundstücken", auswahl: "monetaer" },
  { id: "san-abgang", gruppe: "Aktiven", position: "Sachanlagen", titel: "Abgänge und Gewinne/Verluste nachrechnen", aussage: "Genauigkeit", rz: 907,
    population: { titel: "Anlagenabgänge des Jahres", spalten: "Anlagennummer, Datum, Erlös oder Buchwert" }, nachweis: "Verkaufsbeleg, Anlagenbuchhaltung, Buchung von Gewinn/Verlust", auswahl: "monetaer" },
  { id: "imm-zugang", gruppe: "Aktiven", position: "Immaterielle Werte", titel: "Zugänge mit Unterlagen abgleichen", aussage: "Existenz", rz: 908,
    population: { titel: "Zugänge immaterielle Werte", spalten: "Belegnummer, Datum, Bezeichnung, Betrag" }, nachweis: "Verträge, Rechnungen Dritter, Nachweis der Aktivierungsvoraussetzungen", auswahl: "monetaer" },
  { id: "fin-mut", gruppe: "Aktiven", position: "Finanzanlagen", titel: "Mutationen mit Unterlagen abgleichen", aussage: "Existenz", rz: 904,
    population: { titel: "Kontodetail Finanzanlagen", spalten: KD }, nachweis: "Bankabrechnung, Depotauszug, Darlehensvertrag", auswahl: "monetaer" },
  { id: "ara", gruppe: "Aktiven", position: "Aktive Rechnungsabgrenzungen", titel: "Einzelposten der Abgrenzung prüfen", aussage: "Periodenabgrenzung", rz: 903,
    population: { titel: "Aufstellung der aktiven Abgrenzungen", spalten: "Bezeichnung, Betrag, Leistungszeitraum" }, nachweis: "Rechnung, Vertrag, Berechnung der Abgrenzung", auswahl: "monetaer" },
  // --- Passiven ----------------------------------------------------------------
  { id: "kred-best", gruppe: "Passiven", position: "Verbindlichkeiten aus Lieferungen und Leistungen", titel: "Saldenbestätigungen einholen", aussage: "Vollständigkeit", rz: 912, rzWeitere: [659],
    population: { titel: "Kreditorensaldenliste", spalten: SL }, nachweis: "Externe Bestätigung; bei Abweichung oder ohne Antwort alternative Prüfungshandlungen", auswahl: "monetaer",
    hinweis: "Zur Vollständigkeit auch Lieferanten mit kleinem oder Nullsaldo, aber hohem Umsatz beiziehen (nicht aus dem Saldo ziehbar)." },
  { id: "kred-haben", gruppe: "Passiven", position: "Verbindlichkeiten aus Lieferungen und Leistungen", titel: "Gutschriften (Haben) auf Kreditorenkonten mit visierten Fakturen prüfen", aussage: "Genauigkeit", rz: 912,
    population: { titel: "Kontodetail Kreditoren (Haben-Buchungen)", spalten: KD }, nachweis: "Visierte Faktura, Einkaufsunterlagen, Korrespondenz", auswahl: "monetaer", vorzeichen: "haben" },
  { id: "kred-soll", gruppe: "Passiven", position: "Verbindlichkeiten aus Lieferungen und Leistungen", titel: "Belastungen (Soll) auf Kreditorenkonten mit Zahlungsbelegen prüfen", aussage: "Genauigkeit", rz: 912,
    population: { titel: "Kontodetail Kreditoren (Soll-Buchungen)", spalten: KD }, nachweis: "Zahlungsbeleg, Gegenbuchung, Lieferantengutschrift, geleistete Anzahlungen", auswahl: "monetaer", vorzeichen: "soll" },
  { id: "verb-nichtbil", gruppe: "Passiven", position: "Verbindlichkeiten aus Lieferungen und Leistungen", titel: "Suche nach nicht bilanzierten Verbindlichkeiten (Zahlungen und Rechnungen nach dem Stichtag)", aussage: "Vollständigkeit", rz: 658, rzWeitere: [912],
    population: { titel: "Zahlungen bzw. Rechnungseingänge nach dem Stichtag", spalten: "Belegnummer, Datum, Lieferant/Text, Betrag" }, nachweis: "Rechnung und Leistungsdatum: gehört die Verbindlichkeit in das geprüfte Geschäftsjahr?", auswahl: "monetaer", nurNachStichtag: true },
  { id: "verb-zins", gruppe: "Passiven", position: "Verzinsliche Verbindlichkeiten", titel: "Kapital- und Zinszahlungen mit Belegen und Gegenkonten abgleichen", aussage: "Genauigkeit", rz: 917, rzWeitere: [919],
    population: { titel: "Kontodetail verzinsliche Verbindlichkeiten", spalten: KD }, nachweis: "Bankbeleg, Zinsabrechnung, Darlehensvertrag", auswahl: "monetaer" },
  { id: "anz-erhalten", gruppe: "Passiven", position: "Übrige kurzfristige Verbindlichkeiten", titel: "Buchungen auf Anzahlungskonten (erhaltene Anzahlungen) mit Belegen abgleichen", aussage: "Vollständigkeit", rz: 915,
    population: { titel: "Kontodetail erhaltene Anzahlungen", spalten: KD }, nachweis: "Zahlungseingang, Vertrag, Stand der begonnenen Arbeiten", auswahl: "monetaer" },
  { id: "pra", gruppe: "Passiven", position: "Passive Rechnungsabgrenzungen", titel: "Bildung und Auflösung von Abgrenzungen prüfen", aussage: "Periodenabgrenzung", rz: 916,
    population: { titel: "Buchungen auf Abgrenzungskonten", spalten: KD }, nachweis: "Rechnung, Vertrag, Berechnung der Abgrenzung", auswahl: "monetaer" },
  { id: "rueck", gruppe: "Passiven", position: "Rückstellungen", titel: "Einzelposten der Rückstellungen prüfen", aussage: "Bewertung", rz: 920, rzWeitere: [921],
    population: { titel: "Aufstellung der Rückstellungen", spalten: "Bezeichnung, Betrag, Grund" }, nachweis: "Verträge, Korrespondenz, Berechnung; Vorliegen der Bilanzierungspflicht", auswahl: "monetaer" },
  // --- Erfolgsrechnung --------------------------------------------------------------
  { id: "erl-belege", gruppe: "Erfolgsrechnung", position: "Nettoerlöse aus Lieferungen und Leistungen", titel: "Erlösbuchungen mit Ausgangsrechnungen und Abrechnungen abgleichen", aussage: "Existenz", rz: 941,
    population: { titel: "Kontodetail Erlöskonten", spalten: KD }, nachweis: "Ausgangsrechnung, Abrechnung; Erfassungskriterien für Erlöse erfüllt", auswahl: "monetaer" },
  { id: "erl-cutoff", gruppe: "Erfolgsrechnung", position: "Nettoerlöse aus Lieferungen und Leistungen", titel: "Periodengerechte Verbuchung der Erlöse um den Stichtag prüfen", aussage: "Periodenabgrenzung", rz: 941,
    population: { titel: "Kontodetail Erlöskonten (Buchungen um den Stichtag)", spalten: KD }, nachweis: "Lieferdatum bzw. Leistungserbringung gegenüber Buchungsdatum", auswahl: "monetaer", stichtagFenster: 10,
    hinweis: "Fenster um den Stichtag ist eine Voreinstellung (±10 Tage); Prüfer legt fest." },
  { id: "erl-voll", gruppe: "Erfolgsrechnung", position: "Nettoerlöse aus Lieferungen und Leistungen", titel: "Vollständigkeit: Lieferdokumente mit Ausgangsrechnungen abgleichen", aussage: "Vollständigkeit", rz: 941,
    population: { titel: "Lieferscheine / Warenausgang des Jahres", spalten: "Lieferscheinnummer, Datum, Wert" }, nachweis: "Ausgangsrechnung zum Lieferschein vorhanden und periodengerecht verbucht", auswahl: "monetaer" },
  { id: "mat-belege", gruppe: "Erfolgsrechnung", position: "Materialaufwand", titel: "Belastungen auf Waren-/Materialkonten mit Lieferantenfakturen abgleichen", aussage: "Existenz", rz: 943,
    population: { titel: "Kontodetail Waren-/Materialaufwand", spalten: KD }, nachweis: "Lieferantenfaktura, Abrechnung", auswahl: "monetaer" },
  { id: "mat-eingang", gruppe: "Erfolgsrechnung", position: "Materialaufwand", titel: "Wareneingänge mit Lagerbuchhaltung und Eingangsdokumenten abgleichen", aussage: "Periodenabgrenzung", rz: 943,
    population: { titel: "Wareneingänge des Jahres (Umfeld Stichtag)", spalten: "Belegnummer, Datum, Betrag" }, nachweis: "Lagerbuchhaltung, Lieferschein/Eingangsdokument", auswahl: "monetaer", stichtagFenster: 10 },
  { id: "pers-belege", gruppe: "Erfolgsrechnung", position: "Personalaufwand", titel: "Buchungen auf Personalaufwandkonten mit Belegen prüfen", aussage: "Genauigkeit", rz: 945,
    population: { titel: "Kontodetail Personalaufwand", spalten: KD }, nachweis: "Beleg, Rekapitulation, Abrechnung der Sozialversicherungen", auswahl: "monetaer" },
  { id: "betr-belege", gruppe: "Erfolgsrechnung", position: "Übriger betrieblicher Aufwand", titel: "Buchungen mit Belegen, Abrechnungen und Verträgen prüfen", aussage: "Existenz", rz: 946,
    population: { titel: "Kontodetail übriger betrieblicher Aufwand", spalten: KD }, nachweis: "Beleg, Abrechnung, Vertrag", auswahl: "monetaer" },
  { id: "fremd", gruppe: "Erfolgsrechnung", position: "Betriebsfremder Aufwand und Ertrag", titel: "Posten mit Belegen prüfen", aussage: "Eigentum/Ausweis", rz: 955,
    population: { titel: "Kontodetail betriebsfremder Aufwand/Ertrag", spalten: KD }, nachweis: "Beleg und sonstige Unterlagen; korrekter Ausweis", auswahl: "monetaer",
    hinweis: "Bei kleinen Populationen ist eine lückenlose Prüfung vorzuziehen (Rz. 758)." },
  { id: "ao", gruppe: "Erfolgsrechnung", position: "Ausserordentlicher, einmaliger oder periodenfremder Aufwand und Ertrag", titel: "Posten mit Belegen prüfen", aussage: "Eigentum/Ausweis", rz: 957,
    population: { titel: "Kontodetail ausserordentlicher Aufwand/Ertrag", spalten: KD }, nachweis: "Beleg und sonstige Unterlagen; korrekter Ausweis", auswahl: "monetaer",
    hinweis: "Bei kleinen Populationen ist eine lückenlose Prüfung vorzuziehen (Rz. 758)." },
];

export const gruppen: Gruppe[] = ["Aktiven", "Passiven", "Erfolgsrechnung"];

export const findeEinzelfall = (id: string) => EINZELFALL.find((e) => e.id === id);

export const einzelfallZitat = (e: Einzelfallpruefung) => hwpZitat([e.rz, ...(e.rzWeitere ?? [])]);
