/**
 * Stichprobenumfang und Hochrechnung nach HWP OR 2024, Teil III.4.5 (ISA-CH 530), für Einzelfall- und Kontrollprüfungen.
 *
 * Der Umfang darf nach Rz. 762 statistisch (Formel) oder nach pflichtgemässem Ermessen festgelegt werden. Die Werte hier sind
 * rechnerische Vorschläge; der Prüfer kann jeden Umfang überschreiben und begründet die Festlegung in den Arbeitspapieren.
 */
import type { Haeufigkeit } from "../hwp/kontrollen";
import { hwpZitat } from "../hwp/quelle";
import { StichprobenFehler, musStichprobenumfang } from "./stichprobe";

// --- Einzelfallprüfung -------------------------------------------------------------

export type EinzelfallUmfang = {
  n: number;
  /** Umfang der Formel vor der Begrenzung auf die Grundgesamtheit */
  rechnerisch: number;
  vollpruefung: boolean;
  konfidenz: number;
  zuverlaessigkeitsfaktor: number;
  normbezug: string;
  hinweise: string[];
};

/**
 * Monetäre Stichprobe (MUS): n = Buchwert × Zuverlässigkeitsfaktor / tolerierbare falsche Darstellung.
 * Standard-Konfidenz 95 % (Rz. 775: «normalerweise 95 %», tiefer nur bei weiteren positiven Prüfungsergebnissen).
 * Die tolerierbare falsche Darstellung entspricht höchstens der Toleranzwesentlichkeit (Rz. 766).
 */
export function einzelfallUmfang(p: { buchwert: number; toleranz: number; anzahlPosten: number; konfidenz?: number }): EinzelfallUmfang {
  const konfidenz = p.konfidenz ?? 0.95;
  if (!Number.isInteger(p.anzahlPosten) || p.anzahlPosten < 1) throw new StichprobenFehler("Die Grundgesamtheit ist leer.");
  const u = musStichprobenumfang({ buchwert: p.buchwert, toleranz: p.toleranz, konfidenz });
  const hinweise = [...u.hinweise, "Die tolerierbare falsche Darstellung darf die Toleranzwesentlichkeit nicht übersteigen (Rz. 766)."];
  if (konfidenz < 0.95) hinweise.push("Konfidenz unter 95 %: nur vertretbar, wenn weitere positive Prüfungsergebnisse (z.B. wirksames IKS) vorliegen (Rz. 775).");
  const vollpruefung = u.n >= p.anzahlPosten;
  if (vollpruefung) hinweise.push("Der rechnerische Umfang erreicht die Grundgesamtheit: lückenlose Prüfung (Rz. 758).");
  return {
    n: Math.min(u.n, p.anzahlPosten),
    rechnerisch: u.n,
    vollpruefung,
    konfidenz,
    zuverlaessigkeitsfaktor: u.zuverlaessigkeitsfaktor,
    normbezug: hwpZitat([757, 762, 766, 775]),
    hinweise,
  };
}

// --- Kontrollprüfung ------------------------------------------------------------------

/**
 * Indikative Staffelung der Mindeststichprobenumfänge nach Häufigkeit der Kontrolle.
 * QUELLE: HWP OR 2024, Ausgewählte Fragen und Antworten zur Prüfung von Compliance-Management-Systemen (PS-CH 980), Ziel ca. 10 %
 * der Vorgänge, höchstens 40. Die Staffelung gilt dort für CMS-Prüfungen; ihre Übertragung auf IKS-Funktionsprüfungen ist
 * durch den Prüfer zu bestätigen. Automatisierte Kontrollen: Test of one (Rz. 602).
 */
export const KONTROLL_STAFFELUNG: Record<Haeufigkeit, { n: number | "10%"; erwarteteVorgaenge: number | null }> = {
  jaehrlich: { n: 1, erwarteteVorgaenge: 1 },
  vierteljaehrlich: { n: 1, erwarteteVorgaenge: 4 },
  monatlich: { n: 2, erwarteteVorgaenge: 12 },
  woechentlich: { n: 5, erwarteteVorgaenge: 52 },
  taeglich: { n: 25, erwarteteVorgaenge: 250 },
  haeufiger: { n: "10%", erwarteteVorgaenge: null },
  automatisiert: { n: 1, erwarteteVorgaenge: null },
};

export const MAX_KONTROLL_STICHPROBE = 40;

export type KontrollUmfang = { n: number; vollpruefung: boolean; normbezug: string; hinweise: string[] };

export function kontrollUmfang(p: { haeufigkeit: Haeufigkeit; anzahlVorgaenge: number }): KontrollUmfang {
  if (!Number.isInteger(p.anzahlVorgaenge) || p.anzahlVorgaenge < 1) throw new StichprobenFehler("Die Vorgangsliste ist leer.");
  const s = KONTROLL_STAFFELUNG[p.haeufigkeit];
  const soll = s.n === "10%" ? Math.min(Math.ceil(p.anzahlVorgaenge * 0.1), MAX_KONTROLL_STICHPROBE) : s.n;
  const n = Math.min(soll, p.anzahlVorgaenge);
  const hinweise = [
    "Indikative Staffelung aus den Q&A des HWP zur CMS-Prüfung (PS-CH 980); Übertragbarkeit auf diese Kontrolle durch den Prüfer bestätigen. Umfang bestimmen ausserdem Risiko, tolerierbare und erwartete Abweichungen (Rz. 764).",
  ];
  if (p.haeufigkeit === "automatisiert") {
    hinweise.push("Automatisierte Kontrolle: Test of one nach Prüfung der generellen IT-Kontrollen; bei Systemänderungen im Zeitraum vor und nach der Änderung prüfen (Rz. 602).");
  }
  if (p.haeufigkeit === "haeufiger") hinweise.push(`Öfter/unregelmässig: 10 % der Vorgänge, höchstens ${MAX_KONTROLL_STICHPROBE}.`);
  if (s.erwarteteVorgaenge !== null && (p.anzahlVorgaenge < s.erwarteteVorgaenge * 0.5 || p.anzahlVorgaenge > s.erwarteteVorgaenge * 1.5)) {
    hinweise.push(`Die Datei enthält ${p.anzahlVorgaenge} Vorgänge, bei dieser Häufigkeit sind etwa ${s.erwarteteVorgaenge} zu erwarten: Häufigkeit oder Vollständigkeit der Liste prüfen (Rz. 600).`);
  }
  if (n >= p.anzahlVorgaenge) hinweise.push("Der Umfang erreicht alle Vorgänge: lückenlose Prüfung.");
  return { n, vollpruefung: n >= p.anzahlVorgaenge, normbezug: hwpZitat([600, 602, 764]), hinweise };
}

// --- Hochrechnung nach Rz. 792 ------------------------------------------------------------

export type HochrechnungHwp = {
  fehlerAnteilProzent: number;
  hochgerechnet: number;
  anomalien: number;
  total: number;
  normbezug: string;
  hinweise: string[];
};

/**
 * Verhältnis-Hochrechnung falscher Darstellungen (Rz. 792, Abbildung 48): Anomalien werden nicht hochgerechnet, sondern dem
 * hochgerechneten Betrag hinzugefügt. Beispiel: GG 1'000'000, Stichprobe 400'000, Fehler 35'000 (davon Anomalien 10'000)
 * → 25'000 / 400'000 × 1'000'000 = 62'500, total 72'500.
 */
export function hochrechnungHwp(p: { grundgesamtheitWert: number; stichprobeWert: number; festgestellteFehler: number; anomalien?: number }): HochrechnungHwp {
  const anomalien = p.anomalien ?? 0;
  if (!(p.stichprobeWert > 0) || !(p.grundgesamtheitWert > 0)) throw new StichprobenFehler("Stichproben- und Grundgesamtheitswert müssen > 0 sein.");
  if (p.stichprobeWert > p.grundgesamtheitWert) throw new StichprobenFehler("Der Stichprobenwert übersteigt die Grundgesamtheit.");
  if (!(p.festgestellteFehler >= 0) || !(anomalien >= 0) || anomalien > p.festgestellteFehler) throw new StichprobenFehler("Fehler und Anomalien: Anomalien dürfen die festgestellten Fehler nicht übersteigen.");
  const rest = p.festgestellteFehler - anomalien;
  const anteil = rest / p.stichprobeWert;
  const hochgerechnet = anteil * p.grundgesamtheitWert;
  return {
    fehlerAnteilProzent: anteil * 100,
    hochgerechnet,
    anomalien,
    total: hochgerechnet + anomalien,
    normbezug: hwpZitat([792, 793]),
    hinweise: [
      "Die Hochrechnung reicht in der Regel nicht aus, um den vom Management zu korrigierenden Betrag festzulegen; sie ist mit dem Management zu erörtern, ggf. sind weitere Prüfungshandlungen nötig (Rz. 793).",
      "Anomalien sind nur dann auszunehmen, wenn belegt ist, dass sie nicht repräsentativ sind, und werden nicht hochgerechnet.",
    ],
  };
}
