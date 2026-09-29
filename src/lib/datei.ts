import { MAX_DATEI_BYTES, type Zelle } from "@/lib/import";
import { PdfFehler, lesePdf, type PdfJs } from "@/lib/pdf";

export type Blatt = { sheet: string; data: Zelle[][]; /** nur PDF: Seite je Zeile */ seiten?: number[]; hinweise?: string[] };

export class DateiFehler extends Error {}

/** Liest eine .xlsx- oder .pdf-Datei im Browser in Tabellenblätter (nichts wird hochgeladen). */
export async function leseDatei(datei: File): Promise<Blatt[]> {
  const istPdf = /\.pdf$/i.test(datei.name);
  if (!istPdf && !/\.xlsx$/i.test(datei.name)) throw new DateiFehler("Es werden .xlsx- und .pdf-Dateien gelesen. Andere Formate (z.B. .xls, .csv) in Excel als .xlsx speichern oder die Tabelle unten einfügen.");
  if (datei.size > MAX_DATEI_BYTES) throw new DateiFehler("Die Datei ist grösser als 20 MB. Bitte eingrenzen.");
  try {
    if (istPdf) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const t = await lesePdf(await datei.arrayBuffer(), pdfjs as unknown as PdfJs);
      return [{ sheet: `PDF (${new Set(t.seiten).size} Seiten mit Text)`, data: t.zeilen, seiten: t.seiten, hinweise: t.hinweise }];
    }
    const { default: lese } = await import("read-excel-file/universal");
    const sheets = (await lese(await datei.arrayBuffer())) as Blatt[];
    if (sheets.length === 0) throw new Error("leer");
    return sheets;
  } catch (e) {
    if (e instanceof PdfFehler) throw new DateiFehler(e.message);
    throw new DateiFehler(istPdf ? "Das PDF konnte nicht gelesen werden." : "Die Datei konnte nicht gelesen werden. Ist es eine gültige, nicht passwortgeschützte .xlsx-Datei?");
  }
}
