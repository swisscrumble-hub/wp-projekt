/**
 * Quellenangabe zum «Schweizer Handbuch der Wirtschaftsprüfung, Band Ordentliche Revision» (EXPERTsuisse, Ausgabe 2024).
 *
 * URHEBERRECHT: Das Handbuch ist urheberrechtlich geschützt (Nachdruck und Kopieren, auch auszugsweise, nur mit Zustimmung).
 * Die Kataloge in diesem Ordner enthalten deshalb keine Textauszüge, sondern eigene, knappe Formulierungen mit Verweis
 * auf die Randziffer (Rz.). Die Randziffern sind am Original zu überprüfen; die Auswahl und Formulierung der Prüfungs-
 * handlungen ist eine Arbeitshilfe und kein Ersatz für das Handbuch.
 */
export const HWP_TITEL = "EXPERTsuisse, HWP OR 2024";

export function hwpZitat(rz: number | number[], teil = "Teil III"): string {
  const liste = Array.isArray(rz) ? rz : [rz];
  return `${HWP_TITEL}, ${teil} Rz. ${liste.join(", ")}`;
}

/**
 * ISA-CH 240 «Verantwortlichkeiten des Abschlussprüfers bei dolosen Handlungen» (gültig für Prüfungen von Abschlüssen für
 * Zeiträume, die am oder nach dem 15.12.2022 enden). Auch dieser Standard ist urheberrechtlich geschützt: Der Code enthält
 * nur Randziffern-Verweise und eigene Kurzformulierungen. Es handelt sich NICHT um die überarbeitete Fassung ISA 240 (Revised).
 */
export const ISA_CH_240 = "ISA-CH 240 (gültig ab 15.12.2022)";

export const isaZitat = (tz: string): string => `${ISA_CH_240}, Tz. ${tz}`;
