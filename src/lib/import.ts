/**
 * Import einer Excel-Tabelle (Kontodetails, Buchungsjournal) als Grundgesamtheit für Stichproben.
 * Reine Logik: Die Datei wird im Browser gelesen und verlässt das Gerät nicht.
 *
 * Für die Vollständigkeit der Grundgesamtheit (PS 530) weist der Import Kontrollzahlen aus (Anzahl, Summe) und
 * listet jede übersprungene Zeile mit Grund. Summen-/Übertragszeilen werden nie stillschweigend mitgezählt.
 */
import { istIsoDatum } from "./pruefung/datum";
import { TabellenFehler, parseZahl } from "./tabelle";

export type Zelle = string | number | boolean | Date | null | undefined;

export const MAX_ZEILEN = 200_000;
export const MAX_DATEI_BYTES = 20 * 1024 * 1024;

export type Spalten = { id?: number; betrag?: number; soll?: number; haben?: number; datum?: number; konto?: number; text?: number };

export type ImportOptionen = {
  /** 0-basierter Index der Kopfzeile */
  kopfzeile: number;
  spalten: Spalten;
  /** Beträge als Absolutwert verwenden (Soll/Haben oder Gutschriften nicht gegenseitig aufheben) */
  absolut: boolean;
  filter?: { konten?: string[]; datumVon?: string; datumBis?: string; minBetrag?: number };
};

export type Importiert = {
  /** eindeutig; Belegnummer, bei Duplikaten «Beleg#Zeile», ohne Belegspalte «Zeile N» */
  id: string;
  /** Zeilennummer in der gelesenen Tabelle (1 = erste Zeile) */
  excelZeile: number;
  beleg?: string;
  datum?: string;
  konto?: string;
  text?: string;
  /** vorzeichenbehaftet, wie in der Quelle */
  betrag: number;
  /** Wert für die Stichprobe (Absolutwert, falls gewählt) */
  buchwert: number;
};

export type ImportErgebnis = {
  posten: Importiert[];
  uebersprungen: { zeile: number; grund: string }[];
  kontrolle: { zeilenGelesen: number; anzahl: number; summe: number; summeAbsolut: number; negativ: number; null: number };
  hinweise: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, "");
const text = (z: Zelle): string => (z == null ? "" : z instanceof Date ? "" : String(z).trim());
const leer = (z: Zelle) => text(z) === "" && !(z instanceof Date) && typeof z !== "number";

/** Kopfzeile = Zeile mit den meisten Textzellen in den ersten 20 Zeilen (mindestens 2). -1, wenn keine erkennbar ist. */
export function findeKopfzeile(zeilen: Zelle[][]): number {
  let beste = -1;
  let max = 1;
  zeilen.slice(0, 20).forEach((z, i) => {
    const n = z.filter((c) => typeof c === "string" && c.trim() !== "" && Number.isNaN(Number(c.replace(",", ".")))).length;
    if (n > max) {
      max = n;
      beste = i;
    }
  });
  return beste;
}

const SYNONYME: Record<keyof Spalten, string[]> = {
  id: ["beleg", "belegnr", "belegnummer", "belegno", "buchungsnr", "buchungsnummer", "journalnr", "id", "nr", "documentno", "docno"],
  betrag: ["betrag", "buchwert", "saldo", "wert", "amount", "betragchf", "chf"],
  soll: ["soll", "debit", "sollbetrag"],
  haben: ["haben", "credit", "habenbetrag"],
  datum: ["datum", "buchungsdatum", "belegdatum", "valuta", "date", "bdatum"],
  konto: ["konto", "kontonr", "kontonummer", "sachkonto", "account", "kto"],
  text: ["text", "buchungstext", "beschreibung", "bezeichnung", "description", "kontotext"],
};

/** Schlägt Spalten anhand der Kopfzeile vor (der Benutzer bestätigt oder korrigiert). */
export function schlageSpaltenVor(kopf: Zelle[]): Spalten {
  const namen = kopf.map((k) => norm(text(k)));
  const s: Spalten = {};
  for (const feld of Object.keys(SYNONYME) as (keyof Spalten)[]) {
    const i = namen.findIndex((n, idx) => n && SYNONYME[feld].includes(n) && !Object.values(s).includes(idx));
    if (i >= 0) s[feld] = i;
  }
  // Soll/Haben haben Vorrang vor einer einzelnen Betragsspalte, wenn beide Spalten vorhanden sind.
  if (s.soll !== undefined && s.haben !== undefined) delete s.betrag;
  return s;
}

function zuIsoDatum(z: Zelle): string | undefined {
  if (z instanceof Date) {
    if (Number.isNaN(z.getTime())) return undefined;
    return `${z.getUTCFullYear()}-${String(z.getUTCMonth() + 1).padStart(2, "0")}-${String(z.getUTCDate()).padStart(2, "0")}`;
  }
  const t = text(z);
  const ch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  const iso = ch ? `${ch[3]}-${ch[2]!.padStart(2, "0")}-${ch[1]!.padStart(2, "0")}` : t.slice(0, 10);
  return istIsoDatum(iso) ? iso : undefined;
}

function zuZahl(z: Zelle): number | undefined {
  if (typeof z === "number") return Number.isFinite(z) ? z : undefined;
  if (typeof z === "string" && z.trim() !== "") {
    try {
      return parseZahl(z);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const SUMMENZEILE = /^(total|summe|gesamt|gesamtsumme|zwischensumme|übertrag|uebertrag)\b/i;

export function importiere(zeilen: Zelle[][], opt: ImportOptionen): ImportErgebnis {
  if (zeilen.length > MAX_ZEILEN + 1) throw new TabellenFehler(`Die Tabelle hat mehr als ${MAX_ZEILEN} Zeilen; bitte eingrenzen.`);
  const s = opt.spalten;
  const hatBetrag = s.betrag !== undefined || (s.soll !== undefined && s.haben !== undefined);
  if (!hatBetrag) throw new TabellenFehler("Bitte eine Betragsspalte oder Soll und Haben wählen.");
  if (opt.kopfzeile < 0 || opt.kopfzeile >= zeilen.length) throw new TabellenFehler("Kopfzeile ausserhalb der Tabelle.");

  const f = opt.filter ?? {};
  const konten = f.konten?.length ? new Set(f.konten) : null;
  const uebersprungen: ImportErgebnis["uebersprungen"] = [];
  const roh: Omit<Importiert, "id" | "buchwert">[] = [];
  let gelesen = 0;
  let ausserhalbFilter = 0;

  for (let i = opt.kopfzeile + 1; i < zeilen.length; i++) {
    const z = zeilen[i] ?? [];
    if (z.every(leer)) continue;
    gelesen++;
    const nr = i + 1;
    const zell = (idx?: number) => (idx === undefined ? undefined : z[idx]);

    const kennung = [zell(s.id), zell(s.text), zell(s.konto)].map((c) => text(c ?? null));
    if (kennung.some((k) => SUMMENZEILE.test(k))) {
      uebersprungen.push({ zeile: nr, grund: "Summen-/Übertragszeile" });
      continue;
    }

    let betrag: number | undefined;
    if (s.betrag !== undefined) betrag = zuZahl(zell(s.betrag));
    else {
      const so = zell(s.soll);
      const ha = zell(s.haben);
      const sn = zuZahl(so);
      const hn = zuZahl(ha);
      if ((!leer(so) && sn === undefined) || (!leer(ha) && hn === undefined)) betrag = undefined;
      else if (sn === undefined && hn === undefined) betrag = undefined;
      else betrag = (sn ?? 0) - (hn ?? 0);
    }
    if (betrag === undefined) {
      uebersprungen.push({ zeile: nr, grund: "Betrag fehlt oder ist keine Zahl" });
      continue;
    }

    const datum = s.datum !== undefined ? zuIsoDatum(zell(s.datum)) : undefined;
    if (s.datum !== undefined && (f.datumVon || f.datumBis) && !datum) {
      uebersprungen.push({ zeile: nr, grund: "Datum nicht lesbar (Datumsfilter aktiv)" });
      continue;
    }
    const konto = s.konto !== undefined ? text(zell(s.konto) ?? null) : undefined;
    if ((konten && !konten.has(konto ?? "")) || (f.datumVon && datum! < f.datumVon) || (f.datumBis && datum! > f.datumBis) || (f.minBetrag !== undefined && Math.abs(betrag) < f.minBetrag)) {
      ausserhalbFilter++;
      continue;
    }
    roh.push({
      excelZeile: nr,
      beleg: s.id !== undefined ? text(zell(s.id) ?? null) || undefined : undefined,
      datum,
      konto: konto || undefined,
      text: s.text !== undefined ? text(zell(s.text) ?? null) || undefined : undefined,
      betrag,
    });
  }

  const haeufigkeit = new Map<string, number>();
  roh.forEach((r) => r.beleg && haeufigkeit.set(r.beleg, (haeufigkeit.get(r.beleg) ?? 0) + 1));
  const posten: Importiert[] = roh.map((r) => ({
    ...r,
    id: r.beleg ? ((haeufigkeit.get(r.beleg) ?? 0) > 1 ? `${r.beleg}#${r.excelZeile}` : r.beleg) : `Zeile ${r.excelZeile}`,
    buchwert: opt.absolut ? Math.abs(r.betrag) : r.betrag,
  }));

  const summe = posten.reduce((a, p) => a + p.betrag, 0);
  const kontrolle = {
    zeilenGelesen: gelesen,
    anzahl: posten.length,
    summe: Math.round(summe * 100) / 100,
    summeAbsolut: Math.round(posten.reduce((a, p) => a + Math.abs(p.betrag), 0) * 100) / 100,
    negativ: posten.filter((p) => p.betrag < 0).length,
    null: posten.filter((p) => p.betrag === 0).length,
  };

  const hinweise = ["Kontrollsumme und Anzahl mit der Quelle abstimmen: Nur eine vollständige und richtige Grundgesamtheit trägt die Stichprobenaussage (PS 530)."];
  if (uebersprungen.length) hinweise.push(`${uebersprungen.length} Zeile(n) übersprungen (siehe Liste); prüfen, ob dadurch Posten fehlen.`);
  if (ausserhalbFilter) hinweise.push(`${ausserhalbFilter} Zeile(n) durch die Filter ausgeschlossen. Der Ausschluss ist zu dokumentieren.`);
  if (opt.absolut && kontrolle.negativ > 0) hinweise.push(`${kontrolle.negativ} Posten mit negativem Betrag werden als Absolutwert gezogen; Soll und Haben heben sich nicht auf.`);
  if (!opt.absolut && kontrolle.negativ > 0) hinweise.push("Negative Buchwerte sind nicht in der MUS-Population (nur bei zufälliger/systematischer Auswahl berücksichtigt).");
  if (posten.length === 0) hinweise.push("Keine Posten importiert.");
  return { posten, uebersprungen, kontrolle, hinweise };
}

/** CSV-Zelle; verhindert Formeleinschleusung («=», «+», «-», «@», Tab am Anfang von Text) und quotet Trennzeichen. */
export function csvZelle(wert: string | number | undefined): string {
  if (wert === undefined) return "";
  if (typeof wert === "number") return String(wert);
  let t = wert.replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`;
  return /[";]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Ausgewählte Posten als CSV (Semikolon, mit BOM für Excel), inkl. Zeilennummer der Quelle. */
export function auswahlAlsCsv(posten: Importiert[], ids: string[], meta: { methode: string; seed: number }): string {
  const gewaehlt = new Set(ids);
  const kopf = ["Zeile", "ID", "Beleg", "Datum", "Konto", "Text", "Betrag"];
  const zeilen = posten
    .filter((p) => gewaehlt.has(p.id))
    .map((p) => [p.excelZeile, p.id, p.beleg, p.datum, p.konto, p.text, p.betrag].map((c) => csvZelle(c as string | number | undefined)).join(";"));
  return `﻿# Methode: ${csvZelle(meta.methode)}; Seed: ${meta.seed}\r\n${kopf.join(";")}\r\n${zeilen.join("\r\n")}\r\n`;
}
