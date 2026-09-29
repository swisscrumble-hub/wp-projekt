/**
 * Kontrollprüfungen (Funktionsprüfungen) nach HWP OR 2024, Teil III.4.2 und III.3.8.4.
 *
 * Aus dem Handbuch stammen die Systematik (Kontrollarten Rz. 303–308; Umfang und Ablauf von Funktionsprüfungen Rz. 600–603;
 * Test of one bei automatisierten Kontrollen Rz. 602) und die Stichprobenfaktoren (Rz. 764). Das Handbuch enthält keinen
 * Katalog konkreter Schlüsselkontrollen je Prozess. Die Kontrollen unten sind deshalb BEISPIELKONTROLLEN (eigener Vorschlag,
 * nicht aus dem HWP) und an das Mandat anzupassen; eine eigene Kontrolle kann frei definiert werden.
 */
export type Prozess = "Einkauf und Kreditoren" | "Verkauf und Debitoren" | "Personal" | "Vorräte" | "Anlagen" | "Bank und Zahlungsverkehr" | "Abschluss und Journal" | "IT (automatisierte Kontrollen)" | "Eigene Kontrolle";

/** Kontrollarten (Rz. 303–308) */
export type Wirkung = "präventiv" | "detektiv";
export type Ausfuehrung = "manuell" | "automatisiert" | "durch die Unternehmensleitung";

/** Prüfungshandlungen bei Funktionsprüfungen (Rz. 603) */
export const PRUEFHANDLUNGEN = [
  "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)",
  "Befragung von Mitarbeitenden",
  "Beobachtung der Anwendung der Kontrolle",
  "Walk-through (Verfolgung eines Geschäftsvorfalls durch das System)",
  "IT-gestützte Prüfungshandlung",
  "Durchsicht der Berichte der internen Revision",
] as const;

/** Automatische Datenprüfungen, die aus der Excel-Datei über alle Vorgänge laufen (Vollprüfung, keine Stichprobe) */
export type Datentest = "funktionstrennung" | "freigabe_fehlt" | "freigabe_verspaetet";

export const DATENTEST_INFO: Record<Datentest, { titel: string; braucht: string }> = {
  funktionstrennung: { titel: "Erfasser und Freigeber sind verschiedene Personen", braucht: "Spalten Erfasser und Freigeber" },
  freigabe_fehlt: { titel: "Jeder Vorgang hat eine Freigabe", braucht: "Spalte Freigeber" },
  freigabe_verspaetet: { titel: "Freigabe liegt nicht nach dem Datum der Ausführung (Zahlung bzw. Buchung)", braucht: "Spalten Freigabedatum und Datum" },
};

export type Haeufigkeit = "jaehrlich" | "vierteljaehrlich" | "monatlich" | "woechentlich" | "taeglich" | "haeufiger" | "automatisiert";

export const HAEUFIGKEIT_LABEL: Record<Haeufigkeit, string> = {
  jaehrlich: "Einmal jährlich",
  vierteljaehrlich: "Einmal vierteljährlich",
  monatlich: "Monatlich",
  woechentlich: "Wöchentlich",
  taeglich: "Täglich",
  haeufiger: "Öfter als täglich / unregelmässig",
  automatisiert: "IT-/automatisiert",
};

export type Kontrolle = {
  id: string;
  prozess: Prozess;
  titel: string;
  wirkung: Wirkung;
  ausfuehrung: Ausfuehrung;
  haeufigkeit: Haeufigkeit;
  /** Vorgangsliste, die die Excel-Datei enthalten soll */
  population: string;
  pruefhandlung: (typeof PRUEFHANDLUNGEN)[number];
  datentests: Datentest[];
  /** Was pro gezogenem Vorgang zu prüfen ist */
  nachweis: string;
  /** Kontrolle wird an Beträgen gemessen (Betragsspalte nötig) */
  mitBetrag: boolean;
};

export const KONTROLLEN: Kontrolle[] = [
  { id: "ek-rechnungsfreigabe", prozess: "Einkauf und Kreditoren", titel: "Freigabe der Lieferantenrechnung vor Zahlung (Vier-Augen-Prinzip)", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "haeufiger",
    population: "Lieferantenrechnungen des Jahres: Belegnummer, Datum, Betrag, Erfasser, Freigeber, Freigabedatum", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Visum auf der Rechnung, Übereinstimmung mit Bestellung und Lieferung, Kompetenzregelung eingehalten", mitBetrag: true },
  { id: "ek-dreiweg", prozess: "Einkauf und Kreditoren", titel: "Abgleich Bestellung, Wareneingang und Rechnung", wirkung: "detektiv", ausfuehrung: "manuell", haeufigkeit: "haeufiger",
    population: "Wareneingänge bzw. Rechnungen des Jahres: Belegnummer, Datum, Betrag", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: [],
    nachweis: "Bestellung, Lieferschein und Rechnung stimmen überein; Abweichungen wurden geklärt", mitBetrag: true },
  { id: "ek-zahlungsfreigabe", prozess: "Bank und Zahlungsverkehr", titel: "Freigabe von Zahlungsläufen (Kollektivunterschrift)", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "woechentlich",
    population: "Zahlungsläufe des Jahres: Belegnummer, Datum, Betrag, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt"],
    nachweis: "Freigabe durch zeichnungsberechtigte Personen gemäss Handelsregister/Kompetenzregelung; Zahlungsliste stimmt mit freigegebenen Rechnungen überein", mitBetrag: true },
  { id: "vk-gutschriften", prozess: "Verkauf und Debitoren", titel: "Genehmigung von Gutschriften und Rabatten", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "haeufiger",
    population: "Gutschriften des Jahres: Belegnummer, Datum, Betrag, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Genehmigung vor Erfassung, sachlicher Grund, Kompetenzregelung eingehalten", mitBetrag: true },
  { id: "vk-kreditlimite", prozess: "Verkauf und Debitoren", titel: "Prüfung der Kreditlimite vor Auftragsfreigabe", wirkung: "präventiv", ausfuehrung: "automatisiert", haeufigkeit: "automatisiert",
    population: "Aufträge des Jahres: Auftragsnummer, Datum, Betrag", pruefhandlung: "IT-gestützte Prüfungshandlung", datentests: [],
    nachweis: "Test of one: Systemeinstellung und ein Auftrag über der Limite; Wirksamkeit der generellen IT-Kontrollen (Rz. 602)", mitBetrag: true },
  { id: "vk-op-ueberwachung", prozess: "Verkauf und Debitoren", titel: "Überwachung der offenen Posten und Mahnwesen", wirkung: "detektiv", ausfuehrung: "manuell", haeufigkeit: "monatlich",
    population: "Monatliche Offene-Posten-Listen bzw. Mahnläufe: Datum, Betrag", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: [],
    nachweis: "Durchsicht durch die verantwortliche Person dokumentiert, Massnahmen bei überfälligen Posten", mitBetrag: false },
  { id: "pe-stammdaten", prozess: "Personal", titel: "Freigabe von Lohn- und Stammdatenänderungen", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "haeufiger",
    population: "Änderungen der Personalstammdaten: Belegnummer, Datum, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Änderungsantrag, Genehmigung, Übereinstimmung mit Arbeitsvertrag bzw. Beschluss", mitBetrag: false },
  { id: "pe-lohnlauf", prozess: "Personal", titel: "Kontrolle und Freigabe des Lohnlaufs (Abstimmung Rekapitulation)", wirkung: "detektiv", ausfuehrung: "manuell", haeufigkeit: "monatlich",
    population: "Lohnläufe des Jahres: Datum, Gesamtbetrag, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt"],
    nachweis: "Rekapitulation abgestimmt, Abweichungen zum Vormonat geklärt, Freigabe dokumentiert", mitBetrag: true },
  { id: "vo-inventur", prozess: "Vorräte", titel: "Genehmigung von Inventurdifferenzen", wirkung: "detektiv", ausfuehrung: "manuell", haeufigkeit: "jaehrlich",
    population: "Inventurdifferenzen: Artikel, Datum, Betrag, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt"],
    nachweis: "Ursachenanalyse, Genehmigung der Korrekturbuchung", mitBetrag: true },
  { id: "an-investition", prozess: "Anlagen", titel: "Investitionsfreigabe gemäss Kompetenzregelung", wirkung: "präventiv", ausfuehrung: "durch die Unternehmensleitung", haeufigkeit: "haeufiger",
    population: "Investitionen des Jahres: Belegnummer, Datum, Betrag, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Investitionsantrag und Genehmigung vor Bestellung, Kompetenzstufe eingehalten", mitBetrag: true },
  { id: "ba-abstimmung", prozess: "Bank und Zahlungsverkehr", titel: "Monatliche Bankabstimmung", wirkung: "detektiv", ausfuehrung: "manuell", haeufigkeit: "monatlich",
    population: "Bankabstimmungen des Jahres: Bankkonto, Datum, Erfasser, Freigeber", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt"],
    nachweis: "Abstimmung durch unabhängige Person, offene Differenzen zeitnah geklärt, Visum", mitBetrag: false },
  { id: "ab-manuell", prozess: "Abschluss und Journal", titel: "Freigabe manueller Journalbuchungen", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "haeufiger",
    population: "Manuelle Journalbuchungen des Jahres: Belegnummer, Datum, Betrag, Erfasser, Freigeber, Freigabedatum", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Begründung und Unterlagen zur Buchung, Freigabe durch eine zweite Person; Bezug zur Journalprüfung (Rz. 375)", mitBetrag: true },
  { id: "it-automatisiert", prozess: "IT (automatisierte Kontrollen)", titel: "Automatisierte Anwendungskontrolle (z.B. Plausibilitätsprüfung, automatischer Abgleich)", wirkung: "präventiv", ausfuehrung: "automatisiert", haeufigkeit: "automatisiert",
    population: "Vorgangsliste, auf die die automatisierte Kontrolle wirkt (optional)", pruefhandlung: "IT-gestützte Prüfungshandlung", datentests: [],
    nachweis: "Test of one nach Prüfung der generellen IT-Kontrollen; bei Systemänderungen im Zeitraum vor und nach der Änderung (Rz. 602)", mitBetrag: false },
  { id: "eigen", prozess: "Eigene Kontrolle", titel: "Eigene Kontrolle (frei definieren)", wirkung: "präventiv", ausfuehrung: "manuell", haeufigkeit: "monatlich",
    population: "Liste der Vorgänge, in denen die Kontrolle durchgeführt wurde", pruefhandlung: "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)", datentests: ["funktionstrennung", "freigabe_fehlt", "freigabe_verspaetet"],
    nachweis: "Durchführung und Dokumentation der Kontrolle für den gezogenen Vorgang", mitBetrag: false },
];

export const prozesse: Prozess[] = [...new Set(KONTROLLEN.map((k) => k.prozess))];
export const findeKontrolle = (id: string) => KONTROLLEN.find((k) => k.id === id);
