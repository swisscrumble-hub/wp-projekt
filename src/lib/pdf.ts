/**
 * PDF-Import: liest Text mit Positionen (pdf.js, im Browser) und rekonstruiert daraus eine Tabelle für dieselbe Auswertung wie beim Excel-Import.
 *
 * GRENZEN (werden in der Oberfläche genannt): Die Tabelle wird aus Textpositionen abgeleitet und ist eine Näherung. Spalten,
 * Vorzeichen und Beträge sind zu kontrollieren, die Kontrollsumme ist mit der Quelle abzugleichen. Gescannte PDFs (Bilder) haben
 * keinen Text und werden nicht gelesen (kein OCR). Die Datei verlässt das Gerät nicht.
 */
import { findeKopfzeile, type Zelle } from "./import";

export class PdfFehler extends Error {}

export const MAX_SEITEN = 500;

export type PdfElement = { seite: number; x0: number; x1: number; y: number; h: number; text: string };

export type PdfTabelle = {
  zeilen: string[][];
  /** Seitennummer (1-basiert) je Zeile */
  seiten: number[];
  spalten: number;
  entferntKopfzeilen: number;
  hinweise: string[];
};

type Zeile = { seite: number; y: number; h: number; zellen: { x0: number; x1: number; text: string }[] };

/** Gruppiert Elemente zu Zeilen (gleiche Grundlinie) und Zellen (Lücke grösser als ~0.9 Schrifthöhe = neue Zelle). */
function zeilenBilden(elemente: PdfElement[], lueckeFaktor: number): Zeile[] {
  const zeilen: Zeile[] = [];
  const seiten = [...new Set(elemente.map((e) => e.seite))].sort((a, b) => a - b);
  for (const s of seiten) {
    const auf = elemente.filter((e) => e.seite === s).sort((a, b) => b.y - a.y || a.x0 - b.x0);
    let aktuell: { y: number; h: number; items: PdfElement[] } | null = null;
    const fertig: { y: number; h: number; items: PdfElement[] }[] = [];
    for (const e of auf) {
      const h = Math.max(e.h, 1);
      if (aktuell && Math.abs(e.y - aktuell.y) <= 0.5 * Math.max(h, aktuell.h)) aktuell.items.push(e);
      else {
        aktuell = { y: e.y, h, items: [e] };
        fertig.push(aktuell);
      }
    }
    for (const l of fertig) {
      const items = l.items.sort((a, b) => a.x0 - b.x0);
      const zellen: Zeile["zellen"] = [];
      for (const it of items) {
        const letzte = zellen[zellen.length - 1];
        const h = Math.max(it.h, l.h);
        if (letzte && it.x0 - letzte.x1 <= lueckeFaktor * h) {
          letzte.text += (it.x0 - letzte.x1 > 0.1 * h ? " " : "") + it.text;
          letzte.x1 = Math.max(letzte.x1, it.x1);
        } else zellen.push({ x0: it.x0, x1: it.x1, text: it.text });
      }
      zeilen.push({ seite: s, y: l.y, h: l.h, zellen });
    }
  }
  return zeilen;
}

/** Spalten = Vereinigung überlappender Zellintervalle aus Zeilen mit mindestens 2 Zellen (Titel und Fusszeilen prägen keine Spalten). */
function spaltenBilden(zeilen: Zeile[]): [number, number][] {
  const iv = zeilen.filter((z) => z.zellen.length >= 2).flatMap((z) => z.zellen.map((c) => [c.x0, c.x1] as [number, number]));
  iv.sort((a, b) => a[0] - b[0]);
  const spalten: [number, number][] = [];
  for (const [a, b] of iv) {
    const l = spalten[spalten.length - 1];
    if (l && a <= l[1]) l[1] = Math.max(l[1], b);
    else spalten.push([a, b]);
  }
  return spalten;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function tabelleAusElementen(roh: PdfElement[], opt: { lueckeFaktor?: number } = {}): PdfTabelle {
  const elemente = roh.filter((e) => e.text.trim() !== "").map((e) => ({ ...e, text: e.text.trim() }));
  if (elemente.length === 0) throw new PdfFehler("Im PDF wurde kein Text gefunden. Gescannte PDFs (Bilder) werden nicht gelesen, es gibt keine Texterkennung (OCR).");
  const zeilen = zeilenBilden(elemente, opt.lueckeFaktor ?? 0.9);
  const spalten = spaltenBilden(zeilen);
  if (spalten.length < 2) throw new PdfFehler("Im PDF wurde keine Tabelle erkannt (weniger als 2 Spalten). Bitte die Tabelle als Excel exportieren oder eine tabellarische Auswertung verwenden.");

  const spalteVon = (x0: number, x1: number): number => {
    let beste = -1;
    let ueberlappung = 0;
    spalten.forEach(([a, b], i) => {
      const o = Math.min(x1, b) - Math.max(x0, a);
      if (o > ueberlappung) {
        ueberlappung = o;
        beste = i;
      }
    });
    if (beste >= 0) return beste;
    let abstand = Infinity;
    spalten.forEach(([a, b], i) => {
      const d = Math.min(Math.abs(x0 - a), Math.abs(x0 - b));
      if (d < abstand) {
        abstand = d;
        beste = i;
      }
    });
    return beste;
  };

  let rows: string[][] = [];
  let seiten: number[] = [];
  for (const z of zeilen) {
    const r = Array<string>(spalten.length).fill("");
    for (const c of z.zellen) {
      const i = spalteVon(c.x0, c.x1);
      r[i] = r[i] ? `${r[i]} ${c.text}` : c.text;
    }
    if (r.some((c) => c !== "")) {
      rows.push(r);
      seiten.push(z.seite);
    }
  }

  // Wiederholte Kopfzeilen (eine je Seite) entfernen
  let entfernt = 0;
  const k = findeKopfzeile(rows as Zelle[][]);
  if (k >= 0) {
    const kopf = rows[k]!.map(norm).join("|");
    const neu: string[][] = [];
    const neuSeiten: number[] = [];
    rows.forEach((r, i) => {
      if (i > k && r.map(norm).join("|") === kopf) entfernt++;
      else {
        neu.push(r);
        neuSeiten.push(seiten[i]!);
      }
    });
    rows = neu;
    seiten = neuSeiten;
  }

  const anzahlSeiten = new Set(seiten).size;
  return {
    zeilen: rows,
    seiten,
    spalten: spalten.length,
    entferntKopfzeilen: entfernt,
    hinweise: [
      `PDF: ${anzahlSeiten} Seite(n) mit Text, ${spalten.length} Spalten aus den Textpositionen abgeleitet${entfernt ? `, ${entfernt} wiederholte Kopfzeile(n) entfernt` : ""}. Die Tabelle ist eine Näherung: Spalten, Vorzeichen und Beträge kontrollieren und die Kontrollsumme mit der Quelle abgleichen.`,
    ],
  };
}

// --- pdf.js -------------------------------------------------------------------

type PdfSeite = { getTextContent(): Promise<{ items: unknown[] }>; getOperatorList?(): Promise<{ fnArray: number[] }> };
type PdfDokument = { numPages: number; getPage(n: number): Promise<PdfSeite>; destroy?: () => Promise<void> };
export type PdfJs = {
  getDocument(src: { data: Uint8Array; isEvalSupported: boolean; enableXfa: boolean }): { promise: Promise<PdfDokument> };
  /** Operator-Codes von pdf.js (für die Bild-Erkennung in der Diagnose) */
  OPS?: Record<string, number>;
};

type TextItem = { str?: unknown; transform?: unknown; width?: unknown; height?: unknown };

export async function lesePdf(daten: ArrayBuffer | Uint8Array, pdfjs: PdfJs): Promise<PdfTabelle> {
  const bytes = daten instanceof Uint8Array ? daten : new Uint8Array(daten);
  let doc: PdfDokument;
  try {
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false }).promise;
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "PasswordException") throw new PdfFehler("Das PDF ist passwortgeschützt und kann nicht gelesen werden.");
    throw new PdfFehler("Das PDF konnte nicht gelesen werden (ungültige oder beschädigte Datei).");
  }
  if (doc.numPages > MAX_SEITEN) throw new PdfFehler(`Das PDF hat mehr als ${MAX_SEITEN} Seiten; bitte eingrenzen.`);
  const elemente: PdfElement[] = [];
  let textElementeRoh = 0;
  for (let s = 1; s <= doc.numPages; s++) {
    const inhalt = await (await doc.getPage(s)).getTextContent();
    for (const it of inhalt.items as TextItem[]) {
      if (typeof it.str !== "string" || !Array.isArray(it.transform)) continue;
      textElementeRoh++;
      const t = it.transform as number[];
      const x0 = Number(t[4]);
      const y = Number(t[5]);
      const breite = Number(it.width);
      const hoehe = Number(it.height) || Math.abs(Number(t[3])) || 0;
      if (![x0, y, breite].every(Number.isFinite)) continue;
      elemente.push({ seite: s, x0, x1: x0 + breite, y, h: hoehe, text: it.str });
    }
  }
  if (!elemente.some((e) => e.text.trim() !== "")) {
    const bilder = await zaehleBilder(doc, pdfjs);
    await doc.destroy?.();
    throw new PdfFehler(keinTextMeldung(doc.numPages, textElementeRoh, bilder));
  }
  await doc.destroy?.();
  return tabelleAusElementen(elemente);
}

/** Anzahl Bilder im PDF (null, wenn pdf.js sie nicht zählen kann). Nur im Fehlerfall aufgerufen. */
async function zaehleBilder(doc: PdfDokument, pdfjs: PdfJs): Promise<number | null> {
  const ops = pdfjs.OPS;
  if (!ops) return null;
  const bildCodes = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject, ops.paintJpegXObject].filter((c): c is number => typeof c === "number"));
  if (bildCodes.size === 0) return null;
  let n = 0;
  try {
    for (let s = 1; s <= Math.min(doc.numPages, 50); s++) {
      const seite = await doc.getPage(s);
      if (!seite.getOperatorList) return null;
      n += (await seite.getOperatorList()).fnArray.filter((c) => bildCodes.has(c)).length;
    }
  } catch {
    return null;
  }
  return n;
}

export function keinTextMeldung(seiten: number, textElemente: number, bilder: number | null): string {
  const befund =
    bilder && bilder > 0
      ? `Es enthält ${bilder} Bild(er) und keinen Text: vermutlich ein gescanntes PDF.`
      : bilder === 0
        ? "Es enthält weder Text noch Bilder: der Text ist vermutlich als Umrisse (Pfade) gespeichert oder die Seiten sind leer."
        : "Es enthält keinen lesbaren Text.";
  return `Im PDF wurde kein Text gefunden (${seiten} Seite(n), ${textElemente} Textelement(e)). ${befund} Es gibt keine Texterkennung (OCR). Lässt sich Text im PDF-Programm markieren? Wenn nicht, bitte die Tabelle als Excel exportieren.`;
}
