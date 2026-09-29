/**
 * Going-Concern-Modul (PS 570 / ISA 570 und Schweizer Kapitalschutzregeln): Fragebogen, Liquiditätsprognose,
 * Kreditvereinbarungen (Covenants), rechnerische Hinweise auf Kapitalverlust und Überschuldung.
 *
 * Das Modul erfasst und rechnet. Es entscheidet nie über die Fortführungsfähigkeit: Ein unvollständiger Fragebogen wird
 * nicht ausgewertet, und auch ein vollständiger ersetzt nicht die Würdigung der Pläne der Geschäftsleitung durch den Prüfer.
 */
export class GoingConcernFehler extends Error {}

export const NORM_GC = "PS 570 (ISA 570) Fortführung der Unternehmenstätigkeit";

export type Indikator = { id: string; kategorie: "finanziell" | "betrieblich" | "sonstig"; text: string };

/** Beispiele für Ereignisse oder Gegebenheiten, die Zweifel an der Fortführung begründen können (nach dem Katalog in PS 570). */
export const INDIKATOREN: Indikator[] = [
  { id: "f1", kategorie: "finanziell", text: "Nettoverbindlichkeiten bzw. negatives Nettoumlaufvermögen" },
  { id: "f2", kategorie: "finanziell", text: "Kredite mit baldiger Fälligkeit ohne realistische Aussicht auf Verlängerung oder Rückzahlung" },
  { id: "f3", kategorie: "finanziell", text: "Hinweise auf Entzug finanzieller Unterstützung durch Kreditgeber oder Gesellschafter" },
  { id: "f4", kategorie: "finanziell", text: "Negative operative Geldflüsse (historisch oder prognostiziert)" },
  { id: "f5", kategorie: "finanziell", text: "Ungünstige Schlüsselkennzahlen" },
  { id: "f6", kategorie: "finanziell", text: "Erhebliche betriebliche Verluste oder erheblicher Wertverlust betriebsnotwendiger Vermögenswerte" },
  { id: "f7", kategorie: "finanziell", text: "Zahlungsrückstände oder Unfähigkeit, Gläubiger bei Fälligkeit zu bezahlen" },
  { id: "f8", kategorie: "finanziell", text: "Nichteinhaltung von Kreditbedingungen (Covenants)" },
  { id: "f9", kategorie: "finanziell", text: "Lieferanten verlangen Vorauskasse oder Zahlung bei Lieferung" },
  { id: "b1", kategorie: "betrieblich", text: "Verlust von Führungskräften oder Schlüsselpersonal ohne Ersatz" },
  { id: "b2", kategorie: "betrieblich", text: "Verlust eines Hauptmarktes, Schlüsselkunden, einer Lizenz oder eines Hauptlieferanten" },
  { id: "b3", kategorie: "betrieblich", text: "Arbeitsrechtliche Schwierigkeiten oder Engpässe bei wichtigen Vorleistungen" },
  { id: "s1", kategorie: "sonstig", text: "Nichteinhaltung von Kapitalvorschriften oder anderen gesetzlichen Anforderungen" },
  { id: "s2", kategorie: "sonstig", text: "Hängige Rechtsverfahren oder Änderungen von Gesetzen mit erheblicher Wirkung" },
];

export type Antwort = "ja" | "nein" | "unbekannt";
export type FragebogenAntworten = Record<string, { antwort: Antwort; notiz?: string }>;

export type FragebogenErgebnis = {
  normbezug: string;
  status: "unvollstaendig" | "auswertbar";
  offen: string[];
  bejaht: string[];
  ohneBegruendung: string[];
  hinweise: string[];
};

export function wuerdigeFragebogen(antworten: FragebogenAntworten): FragebogenErgebnis {
  const offen: string[] = [];
  const bejaht: string[] = [];
  const ohneBegruendung: string[] = [];
  for (const i of INDIKATOREN) {
    const a = antworten[i.id];
    if (!a || a.antwort === "unbekannt") offen.push(i.id);
    else if (a.antwort === "ja") {
      bejaht.push(i.id);
      if (!a.notiz?.trim()) ohneBegruendung.push(i.id);
    }
  }
  const hinweise: string[] = [];
  if (offen.length > 0) {
    hinweise.push(`Unzureichende Unterlagen: ${offen.length} Punkt(e) unbeantwortet oder unbekannt. Es erfolgt keine Auswertung.`);
  } else if (bejaht.length > 0) {
    hinweise.push(`${bejaht.length} Ereignis(se) oder Gegebenheit(en) bejaht: Pläne der Geschäftsleitung und eine mögliche wesentliche Unsicherheit sind vom Prüfer zu würdigen.`);
  } else {
    hinweise.push("Keiner der Punkte wurde bejaht. Das ersetzt nicht die eigene Beurteilung der Fortführungsfähigkeit.");
  }
  if (ohneBegruendung.length > 0) hinweise.push(`Begründung fehlt bei: ${ohneBegruendung.join(", ")}.`);
  return { normbezug: NORM_GC, status: offen.length > 0 ? "unvollstaendig" : "auswertbar", offen, bejaht, ohneBegruendung, hinweise };
}

// --- Liquiditätsprognose ------------------------------------------------------

export type Monat = { monat: string; einzahlungen: number; auszahlungen: number };
const MONAT = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function liquiditaetsprognose(p: { anfangsbestand: number; freieKreditlinie: number; monate: Monat[] }) {
  if (p.monate.length === 0) throw new GoingConcernFehler("Keine Prognosemonate übergeben.");
  if (!Number.isFinite(p.anfangsbestand) || !(p.freieKreditlinie >= 0)) throw new GoingConcernFehler("Anfangsbestand oder Kreditlinie ungültig.");
  let vorher = -1;
  let saldo = p.anfangsbestand;
  const verlauf = p.monate.map((m) => {
    const t = MONAT.exec(m.monat);
    if (!t) throw new GoingConcernFehler(`Ungültiger Monat «${m.monat}» (YYYY-MM).`);
    const nr = Number(t[1]) * 12 + Number(t[2]);
    if (vorher !== -1 && nr !== vorher + 1) throw new GoingConcernFehler(`Monate müssen lückenlos aufeinander folgen (bei «${m.monat}»).`);
    vorher = nr;
    if (!Number.isFinite(m.einzahlungen) || !Number.isFinite(m.auszahlungen)) throw new GoingConcernFehler(`Ungültige Beträge in «${m.monat}».`);
    saldo += m.einzahlungen - m.auszahlungen;
    return { monat: m.monat, saldo, verfuegbar: saldo + p.freieKreditlinie, kreditlinieInAnspruch: saldo < 0 };
  });
  const engpass = verlauf.find((v) => v.verfuegbar < 0);
  const tiefpunkt = verlauf.reduce((a, b) => (b.verfuegbar < a.verfuegbar ? b : a));
  const hinweise = ["Prognose beruht auf Annahmen der Geschäftsleitung; Annahmen, Vorjahres-Treffsicherheit und Sensitivitäten sind separat zu würdigen."];
  if (verlauf.length < 12) hinweise.push(`Prognosehorizont ${verlauf.length} Monate: kürzer als 12 Monate; Mindesthorizont nach PS 570 prüfen.`);
  return { normbezug: NORM_GC, verlauf, tiefpunkt, ersterEngpass: engpass?.monat ?? null, hinweise };
}

// --- Covenants ------------------------------------------------------------------

export type Covenant = { name: string; typ: "min" | "max"; grenze: number; ist: number };

/** Abstand zur Grenze relativ zur Grenze. «knapp» = weniger als `puffer` (Standard 10 %) Reserve. */
export function covenantPruefung(covenants: Covenant[], puffer = 0.1) {
  const ergebnisse = covenants.map((c) => {
    if (!Number.isFinite(c.ist) || !Number.isFinite(c.grenze)) throw new GoingConcernFehler(`Ungültige Werte bei «${c.name}».`);
    const abstand = c.typ === "min" ? c.ist - c.grenze : c.grenze - c.ist;
    const reserve = c.grenze === 0 ? null : abstand / Math.abs(c.grenze);
    const status = abstand < 0 ? ("verletzt" as const) : reserve !== null && reserve < puffer ? ("knapp" as const) : ("eingehalten" as const);
    return { ...c, reserve, status };
  });
  return { normbezug: NORM_GC, ergebnisse, hinweise: ["Vereinbarungstext, Messzeitpunkt und Definition der Kennzahl im Kreditvertrag sind massgeblich."] };
}

// --- Kapitalverlust / Überschuldung (rechnerischer Hinweis) --------------------------

export function kapitalschutz(p: { aktienkapital: number; gesetzlicheReserven: number; aktiven: number; fremdkapital: number; rangruecktritt?: number }) {
  for (const v of [p.aktienkapital, p.gesetzlicheReserven, p.aktiven, p.fremdkapital]) if (!Number.isFinite(v)) throw new GoingConcernFehler("Ungültige Bilanzwerte.");
  const eigenkapital = p.aktiven - p.fremdkapital;
  const grundlage = p.aktienkapital + p.gesetzlicheReserven;
  const ruecktritt = p.rangruecktritt ?? 0;
  return {
    normbezug: "Art. 725a OR (Kapitalverlust), Art. 725b OR (Überschuldung); geltende Fassung prüfen",
    eigenkapital,
    kapitalverlust: eigenkapital < grundlage / 2,
    ueberschuldung: eigenkapital + ruecktritt < 0,
    hinweise: [
      "Rechnerischer Hinweis auf Buchwerten. Für die Überschuldung sind Fortführungs- und Veräusserungswerte sowie die Wirksamkeit eines Rangrücktritts zu beurteilen.",
    ],
  };
}
