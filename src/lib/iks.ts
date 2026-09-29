/**
 * IKS-Matrix (Risiko-Kontroll-Matrix): einlesen und daraus einen Prüfplan für Kontrollprüfungen erzeugen.
 *
 * GRUNDLAGE: HWP OR 2024, Teil III.6 (Prüfung der Existenz des IKS nach Art. 728a Abs. 1 Ziff. 3 OR, PS-CH 890; Rz. 1398–1422)
 * und III.4.2 (Funktionsprüfungen, Rz. 594–603). Die Existenzprüfung bezieht sich auf Schlüsselkontrollen auf Ebene der Einheit,
 * der Prozesse und der generellen IT-Kontrollen; sie ist keine Wirksamkeitsprüfung (Rz. 1415). Funktionsprüfungen dienen der
 * Abstützung auf das IKS (Rz. 594) und decken die Existenz ab (Rz. 1402). Schlüsselkontrollen können rotiert werden, in der Regel
 * innerhalb von höchstens drei Jahren (Rz. 1409–1410).
 *
 * Nichts wird geraten: Was in der Matrix fehlt oder nicht erkannt wird (Häufigkeit, Kontrollart, Schlüsselkontrolle), bleibt
 * «nicht angegeben» und erscheint als Prüfhinweis. Der Prüfplan ist ein Vorschlag; Umfang der Abstützung und Auswahl der
 * Kontrollen liegen im pflichtgemässen Ermessen des Prüfers (Rz. 1408).
 */
import { DATENTEST_INFO, HAEUFIGKEIT_LABEL, type Ausfuehrung, type Datentest, type Haeufigkeit, type Wirkung } from "./hwp/kontrollen";
import { hwpZitat } from "./hwp/quelle";
import { csvZelle, findeKopfzeile, type Zelle } from "./import";
import { KONTROLL_STAFFELUNG } from "./pruefung/umfang";

export class IksFehler extends Error {}

export const MAX_KONTROLLEN = 5000;

export type IksSpalten = {
  prozess?: number;
  risikoId?: number;
  risiko?: number;
  kontrollId?: number;
  kontrolle?: number;
  haeufigkeit?: number;
  wirkung?: number;
  ausfuehrung?: number;
  schluessel?: number;
  ebene?: number;
  verantwortlich?: number;
  nachweis?: number;
  /** Jahr der letzten Prüfung (für die Rotation) */
  zuletzt?: number;
};

export type Ebene = "Einheit" | "Prozess" | "IT";

export type IksKontrolle = {
  id: string;
  excelZeile: number;
  seite?: number;
  prozess?: string;
  risikoIds: string[];
  risiken: string[];
  kontrolle: string;
  haeufigkeitRoh?: string;
  haeufigkeit?: Haeufigkeit;
  wirkung?: Wirkung;
  ausfuehrung?: Ausfuehrung;
  schluessel?: boolean;
  ebene?: Ebene;
  ebeneAbgeleitet: boolean;
  verantwortlich?: string;
  nachweis?: string;
  zuletzt?: number;
  hinweise: string[];
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const t = (z: Zelle | undefined): string => (z == null || z instanceof Date ? "" : String(z).trim());

const SYNONYME: Record<keyof IksSpalten, string[]> = {
  prozess: ["prozess", "prozessname", "geschaftsprozess", "bereich", "process"],
  risikoId: ["risikoid", "risikonr", "risikonummer", "riskid", "risikoref", "rid"],
  risiko: ["risiko", "risikobeschreibung", "risk", "risikoszenario"],
  kontrollId: ["kontrollid", "kontrollnr", "kontrollnummer", "kontrolleid", "controlid", "kid", "ref", "kontrollref"],
  kontrolle: ["kontrolle", "kontrollbeschreibung", "kontrollaktivitat", "kontrollmassnahme", "massnahme", "control", "kontrollaktivitaet", "beschreibungkontrolle"],
  haeufigkeit: ["haeufigkeit", "frequenz", "frequency", "turnus", "periodizitat", "periodizitaet", "durchfuhrung"],
  wirkung: ["kontrollart", "praeventivdetektiv", "praeventivdetektiv", "art", "kontrolltyp", "wirkung", "controltype"],
  ausfuehrung: ["ausfuhrung", "ausfuehrung", "manuellautomatisch", "automatisierungsgrad", "automatisierung", "manuellautomatisiert", "nature"],
  schluessel: ["schlusselkontrolle", "schluesselkontrolle", "keycontrol", "schlussel", "schluessel", "key", "schlusselkontrolljanein"],
  ebene: ["ebene", "kontrollebene", "level", "controllevel"],
  verantwortlich: ["verantwortlich", "kontrollverantwortlicher", "verantwortlicher", "owner", "controlowner", "kontrolleigner"],
  nachweis: ["nachweis", "dokumentation", "kontrollnachweis", "evidence", "nachweisdokument"],
  zuletzt: ["zuletztgepruft", "zuletztgeprueft", "letztepruefung", "letztepruefungjahr", "gepruftim", "geprueftim", "letzterpruefungszeitpunkt"],
};

/** Spaltenvorschlag anhand der Kopfzeile (der Benutzer bestätigt oder korrigiert). */
export function schlageIksSpaltenVor(kopf: Zelle[]): IksSpalten {
  // zwei Schreibweisen: Umlaute ausgeschrieben (ä→ae) und nur ohne Akzent (ä→a)
  const namen = kopf.map((k): [string, string] => {
    const roh = t(k);
    return [norm(roh.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")), norm(roh)];
  });
  const s: IksSpalten = {};
  const belegt = new Set<number>();
  // Reihenfolge: spezifische Felder zuerst, damit «Kontrolle» nicht «Kontrollart» oder «Kontroll-ID» verdrängt
  const reihenfolge: (keyof IksSpalten)[] = ["kontrollId", "risikoId", "schluessel", "zuletzt", "haeufigkeit", "ausfuehrung", "wirkung", "ebene", "verantwortlich", "nachweis", "prozess", "kontrolle", "risiko"];
  for (const feld of reihenfolge) {
    const i = namen.findIndex((n, idx) => n[0] && !belegt.has(idx) && (SYNONYME[feld].includes(n[0]) || SYNONYME[feld].includes(n[1])));
    if (i >= 0) {
      s[feld] = i;
      belegt.add(i);
    }
  }
  return s;
}

// --- Normalisierung ------------------------------------------------------------

export function normalisiereHaeufigkeit(roh: string): { wert?: Haeufigkeit; hinweis?: string } {
  const x = roh.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
  if (!x.trim()) return {};
  if (/mehrmals|laufend|kontinuierlich|fortlaufend|bei jedem|jede[rs]? (vorgang|transaktion|buchung)|pro (vorgang|transaktion|buchung)|ereignis|anlass|bei bedarf|stundlich|stuendlich|ad[- ]?hoc|unregelmassig|unregelmaessig/.test(x)) return { wert: "haeufiger" };
  if (/halbj|halbjaehr/.test(x)) return { wert: "vierteljaehrlich", hinweis: "halbjährlich: nächstliegende Stufe «vierteljährlich» verwendet (gleiche Staffelung); durch den Prüfer bestätigen" };
  if (/quartal|vierteljahr|viertelj|vierteljaehr|quarterly|3[- ]?monat|dreimonat/.test(x)) return { wert: "vierteljaehrlich" };
  if (/jahr|jaehr|annual|yearly|1x pro jahr|einmal pro jahr|jahresende|abschluss/.test(x)) return { wert: "jaehrlich" };
  if (/monat|monthly/.test(x)) return { wert: "monatlich" };
  if (/woche|woech|weekly/.test(x)) return { wert: "woechentlich" };
  if (/tag|taeglich|daily/.test(x)) return { wert: "taeglich" };
  if (/automat|system|it-gest|programmiert/.test(x)) return { wert: "automatisiert" };
  return { hinweis: `Häufigkeit «${roh.trim()}» nicht erkannt: von Hand wählen` };
}

export function normalisiereWirkung(roh: string): Wirkung | undefined {
  const x = roh.toLowerCase();
  if (/pr(ä|ae|a)ventiv|preventive|vorbeugend|verhindernd/.test(x)) return "präventiv";
  if (/detektiv|detective|aufdeckend|nachgelagert|korrektiv/.test(x)) return "detektiv";
  return undefined;
}

export function normalisiereAusfuehrung(roh: string): { wert?: Ausfuehrung; hinweis?: string } {
  const x = roh.toLowerCase();
  if (!x.trim()) return {};
  if (/halb|teil|semi/.test(x) && /automat/.test(x)) return { wert: "manuell", hinweis: "teilautomatisiert: als manuell eingestuft (vorsichtig); IT-gestützte Anteile gesondert beurteilen" };
  if (/automat|programmiert|system(gest|seitig|intern)?|maschinell|\bit\b|it-gest/.test(x)) return { wert: "automatisiert" };
  if (/management|unternehmensleitung|geschäftsleitung|geschaeftsleitung|verwaltungsrat|\bvr\b|\bgl\b/.test(x)) return { wert: "durch die Unternehmensleitung" };
  if (/manuell|manual|hand|person/.test(x)) return { wert: "manuell" };
  return { hinweis: `Ausführung «${roh.trim()}» nicht erkannt` };
}

export function normalisiereSchluessel(roh: string): boolean | undefined {
  const x = roh.trim().toLowerCase();
  if (!x) return undefined;
  if (/^(ja|j|yes|y|x|true|1|key|schlüssel|schluessel|schlüsselkontrolle|schluesselkontrolle)$/.test(x)) return true;
  if (/^(nein|n|no|false|0|-|nicht|keine?)$/.test(x)) return false;
  return undefined;
}

export function normalisiereEbene(roh: string): Ebene | undefined {
  const x = roh.toLowerCase();
  if (/einheit|unternehmen|entity|konzern|group|governance|kontrollumfeld/.test(x)) return "Einheit";
  if (/\bit\b|itgc|informatik|system/.test(x)) return "IT";
  if (/prozess|process|transaktion/.test(x)) return "Prozess";
  return undefined;
}

/** Ebene aus dem Prozessnamen ableiten, wenn die Matrix keine Ebene enthält (wird als «abgeleitet» gekennzeichnet). */
export function leiteEbeneAb(prozess: string): Ebene {
  if (/generelle it|itgc|\bit\b|informatik|zugriff|berechtigung|change management|systembetrieb/i.test(prozess)) return "IT";
  if (/governance|kontrollumfeld|unternehmensebene|entity|tone at|compliance|risikomanagement|überwachung|ueberwachung|monitoring/i.test(prozess)) return "Einheit";
  return "Prozess";
}

// --- Matrix lesen --------------------------------------------------------------

export type IksMatrix = { kontrollen: IksKontrolle[]; luecken: string[]; hinweise: string[] };

export function leseIksMatrix(zeilen: Zelle[][], kopfzeile: number, sp: IksSpalten, opt: { seiten?: number[] } = {}): IksMatrix {
  if (sp.kontrolle === undefined) throw new IksFehler("Bitte die Spalte mit der Kontrollbeschreibung wählen.");
  if (kopfzeile < 0 || kopfzeile >= zeilen.length) throw new IksFehler("Kopfzeile ausserhalb der Tabelle.");
  if (zeilen.length - kopfzeile > MAX_KONTROLLEN + 1) throw new IksFehler(`Die Matrix hat mehr als ${MAX_KONTROLLEN} Zeilen; bitte eingrenzen.`);

  const kontrollen = new Map<string, IksKontrolle>();
  const luecken: string[] = [];
  const hinweise: string[] = [];
  let aufgefuellt = 0;
  let vorProzess = "";
  let vorRisikoId = "";
  let vorRisiko = "";

  for (let i = kopfzeile + 1; i < zeilen.length; i++) {
    const z = zeilen[i] ?? [];
    if (z.every((c) => t(c) === "")) continue;
    const nr = i + 1;
    const zell = (idx?: number) => (idx === undefined ? "" : t(z[idx]));

    // Verbundene Zellen: leere Felder von der Zeile darüber übernehmen (Prozess, Risiko)
    let prozess = zell(sp.prozess);
    let risikoId = zell(sp.risikoId);
    let risiko = zell(sp.risiko);
    const eigenesRisiko = risiko !== "" || risikoId !== "";
    if (sp.prozess !== undefined) {
      if (prozess === "") {
        prozess = vorProzess;
        if (prozess) aufgefuellt++;
      } else vorProzess = prozess;
    }
    if (eigenesRisiko) {
      vorRisikoId = risikoId;
      vorRisiko = risiko;
    } else {
      if (sp.risikoId !== undefined) risikoId = vorRisikoId;
      if (sp.risiko !== undefined) risiko = vorRisiko;
    }

    const text = zell(sp.kontrolle);
    const kid = zell(sp.kontrollId);
    if (text === "" && kid === "") {
      if (eigenesRisiko) luecken.push(`Zeile ${nr}: Risiko${risikoId ? ` ${risikoId}` : ""} ohne Kontrolle${risiko ? ` («${risiko.slice(0, 80)}»)` : ""}: Design prüfen`);
      continue;
    }
    if (text === "") {
      luecken.push(`Zeile ${nr}: Kontrolle ${kid} ohne Beschreibung`);
      continue;
    }

    const id = kid || `K-${nr}`;
    const bestehend = kontrollen.get(id);
    if (bestehend) {
      if (risikoId && !bestehend.risikoIds.includes(risikoId)) bestehend.risikoIds.push(risikoId);
      if (risiko && !bestehend.risiken.includes(risiko)) bestehend.risiken.push(risiko);
      if (bestehend.kontrolle !== text) bestehend.hinweise.push(`Kontroll-ID ${id} kommt mehrfach mit abweichender Beschreibung vor (Zeile ${nr}); Beschreibung der ersten Zeile verwendet`);
      continue;
    }

    const hinweiseK: string[] = [];
    const hRoh = zell(sp.haeufigkeit);
    let h = normalisiereHaeufigkeit(hRoh);
    const wirkungRoh = zell(sp.wirkung);
    const wirkung = sp.wirkung !== undefined ? normalisiereWirkung(wirkungRoh) : undefined;
    if (sp.wirkung !== undefined && wirkungRoh && !wirkung) hinweiseK.push(`Kontrollart «${wirkungRoh}» nicht erkannt`);
    const ausRoh = zell(sp.ausfuehrung);
    const aus = sp.ausfuehrung !== undefined ? normalisiereAusfuehrung(ausRoh) : {};
    if (aus.hinweis) hinweiseK.push(aus.hinweis);
    if (h.hinweis) hinweiseK.push(h.hinweis);
    if (sp.haeufigkeit === undefined) h = {};
    const schluessel = sp.schluessel !== undefined ? normalisiereSchluessel(zell(sp.schluessel)) : undefined;
    let ebene = sp.ebene !== undefined ? normalisiereEbene(zell(sp.ebene)) : undefined;
    let abgeleitet = false;
    if (!ebene) {
      ebene = leiteEbeneAb(prozess);
      abgeleitet = true;
    }
    const zuletztRoh = zell(sp.zuletzt);
    const zuletzt = /^\d{4}$/.test(zuletztRoh.slice(0, 4)) && zuletztRoh !== "" ? Number(zuletztRoh.slice(0, 4)) : undefined;

    kontrollen.set(id, {
      id,
      excelZeile: nr,
      seite: opt.seiten?.[i],
      prozess: prozess || undefined,
      risikoIds: risikoId ? [risikoId] : [],
      risiken: risiko ? [risiko] : [],
      kontrolle: text,
      haeufigkeitRoh: hRoh || undefined,
      haeufigkeit: h.wert,
      wirkung,
      ausfuehrung: aus.wert,
      schluessel,
      ebene,
      ebeneAbgeleitet: abgeleitet,
      verantwortlich: zell(sp.verantwortlich) || undefined,
      nachweis: zell(sp.nachweis) || undefined,
      zuletzt,
      hinweise: hinweiseK,
    });
  }

  const liste = [...kontrollen.values()];
  if (liste.length === 0) throw new IksFehler("Keine Kontrollen gefunden. Kopfzeile und Spalte «Kontrolle» prüfen.");
  if (aufgefuellt > 0) hinweise.push(`${aufgefuellt} leere Zelle(n) in der Prozess-Spalte wurden von der Zeile darüber übernommen (verbundene Zellen). Zuordnung kontrollieren.`);
  if (sp.risiko !== undefined || sp.risikoId !== undefined) hinweise.push("Leere Risiko-Zellen gelten als Fortsetzung des Risikos der Zeile darüber (mehrere Kontrollen je Risiko).");
  const ohneH = liste.filter((k) => !k.haeufigkeit).length;
  if (ohneH) hinweise.push(`${ohneH} von ${liste.length} Kontrollen ohne erkannte Häufigkeit: Umfang der Funktionsprüfung von Hand festlegen.`);
  const ohneS = liste.filter((k) => k.schluessel === undefined).length;
  if (ohneS === liste.length) hinweise.push("Die Matrix enthält keine Angabe zu Schlüsselkontrollen: Alle Kontrollen werden als mögliche Schlüsselkontrollen behandelt; Einstufung durch den Prüfer (Rz. 1399, 1406).");
  else if (ohneS) hinweise.push(`${ohneS} Kontrollen ohne Angabe «Schlüsselkontrolle»: Einstufung durch den Prüfer.`);
  const abgeleitetAnz = liste.filter((k) => k.ebeneAbgeleitet).length;
  if (abgeleitetAnz) hinweise.push(`Bei ${abgeleitetAnz} Kontrollen wurde die Ebene (Einheit, Prozess, IT) aus dem Prozessnamen abgeleitet; Einstufung kontrollieren.`);
  return { kontrollen: liste, luecken, hinweise };
}

// --- Prüfplan --------------------------------------------------------------------

export type Pruefart = "funktion" | "existenz" | "keine";

export const PRUEFART_LABEL: Record<Pruefart, string> = {
  funktion: "Funktionsprüfung (deckt die Existenz ab)",
  existenz: "Nur Existenzprüfung (Walk-through)",
  keine: "Nicht prüfen (Rotation / keine Schlüsselkontrolle)",
};

export type Pruefplanzeile = {
  kontrolle: IksKontrolle;
  faellig: boolean;
  faelligGrund: string;
  vorgeschlagen: Pruefart;
  existenz: string[];
  funktion: { n: number | null; umfangText: string; handlung: string; datentests: Datentest[] };
  nachweis: string;
  hinweise: string[];
};

export type Pruefplan = { zeilen: Pruefplanzeile[]; hinweise: string[]; normbezug: string };

const FREIGABE = /freigab|genehmig|visum|visier|vier-?augen|4-?augen|autorisier|unterschrift|bewillig/i;
const FUNKTIONSTRENNUNG = /vier-?augen|4-?augen|funktionstrennung|kollektiv|doppel/i;

export function erzeugePruefplan(kontrollen: IksKontrolle[], opt: { pruefjahr: number; zyklus?: number; nurSchluessel?: boolean }): Pruefplan {
  const zyklus = opt.zyklus ?? 3;
  if (!Number.isInteger(opt.pruefjahr) || opt.pruefjahr < 2000 || opt.pruefjahr > 2100) throw new IksFehler("Prüfjahr ungültig.");
  if (!Number.isInteger(zyklus) || zyklus < 1) throw new IksFehler("Der Planungszyklus muss mindestens 1 Jahr betragen.");

  const liste = opt.nurSchluessel ? kontrollen.filter((k) => k.schluessel !== false) : kontrollen;
  const zeilen: Pruefplanzeile[] = liste.map((k) => {
    const hinweise = [...k.hinweise];
    let faellig = true;
    let grund = "";
    if (k.ebene === "Einheit" || k.ebene === "IT") {
      grund = `Ebene ${k.ebene === "IT" ? "generelle IT-Kontrollen" : "der Einheit"}: jährlich zu prüfen (Rz. 1409)`;
    } else if (k.zuletzt === undefined) {
      grund = "letzte Prüfung unbekannt: fällig";
    } else if (opt.pruefjahr - k.zuletzt >= zyklus) {
      grund = `zuletzt ${k.zuletzt}, Planungszyklus ${zyklus} Jahre erreicht (Rz. 1410)`;
    } else {
      faellig = false;
      grund = `Rotation: zuletzt ${k.zuletzt}, Planungszyklus ${zyklus} Jahre; setzt voraus, dass sich Kontrolle und Rahmenbedingungen nicht wesentlich geändert haben (Rz. 1409)`;
    }
    if (k.schluessel === false) {
      faellig = false;
      grund = "keine Schlüsselkontrolle: die Existenzprüfung bezieht sich auf Schlüsselkontrollen (Rz. 1399)";
    }
    if (k.schluessel === undefined) hinweise.push("Schlüsselkontrolle nicht angegeben: Einstufung durch den Prüfer");
    if (k.ebeneAbgeleitet) hinweise.push(`Ebene aus dem Prozessnamen abgeleitet (${k.ebene})`);

    const auto = k.ausfuehrung === "automatisiert";
    const existenz = [
      "Durchsicht der Dokumentation der Kontrolle (Ausgestaltung); allein nicht ausreichend (Rz. 1418)",
      `Befragung der Kontrollverantwortlichen${k.verantwortlich ? ` (${k.verantwortlich})` : ""}; allein nicht ausreichend (Rz. 1417)`,
      "Walk-through: ein Geschäftsvorfall von der Initiierung bis zur Buchung (Wurzelstichprobe, Rz. 1420)",
      `Einsichtnahme in den Nachweis der Durchführung${k.nachweis ? `: ${k.nachweis}` : ""} (Rz. 1418)`,
      ...(auto ? ["Einsicht in Systemeinstellung bzw. Konfiguration; generelle IT-Kontrollen beurteilen (Rz. 1407)"] : []),
    ];

    let n: number | null = null;
    let umfangText: string;
    if (auto) {
      n = 1;
      umfangText = "Test of one nach Prüfung der generellen IT-Kontrollen; bei Systemänderungen im Zeitraum vor und nach der Änderung (Rz. 602)";
    } else if (!k.haeufigkeit) {
      umfangText = k.haeufigkeitRoh ? `Häufigkeit «${k.haeufigkeitRoh}» nicht erkannt: von Hand wählen` : "Häufigkeit nicht angegeben: von Hand wählen";
    } else if (k.haeufigkeit === "haeufiger") {
      umfangText = "10 % der Vorgänge, höchstens 40 (Anzahl nach Upload der Vorgangsliste)";
    } else if (k.haeufigkeit === "automatisiert") {
      n = 1;
      umfangText = "Test of one (Rz. 602)";
    } else {
      const s = KONTROLL_STAFFELUNG[k.haeufigkeit];
      n = typeof s.n === "number" ? s.n : null;
      umfangText = `${n} ${n === 1 ? "Vorgang" : "Vorgänge"} (Staffelung «${HAEUFIGKEIT_LABEL[k.haeufigkeit]}»)`;
    }

    const datentests: Datentest[] = [];
    if (!auto && FREIGABE.test(k.kontrolle)) {
      datentests.push("freigabe_fehlt");
      if (FUNKTIONSTRENNUNG.test(k.kontrolle)) datentests.push("funktionstrennung");
    }

    return {
      kontrolle: k,
      faellig,
      faelligGrund: grund,
      vorgeschlagen: faellig ? ("existenz" as Pruefart) : ("keine" as Pruefart),
      existenz,
      funktion: {
        n,
        umfangText,
        handlung: auto ? "IT-gestützte Prüfungshandlung" : "Nachvollzug der Kontrollaktivität (z.B. Nachrechnen)",
        datentests,
      },
      nachweis: k.nachweis ?? "Nachweis der Durchführung der Kontrolle (Beleg, Visum, Abstimmung)",
      hinweise,
    };
  });

  const hinweise = [
    `Die Existenzprüfung nach Art. 728a Abs. 1 Ziff. 3 OR bezieht sich auf Schlüsselkontrollen und ist keine Wirksamkeitsprüfung (Rz. 1399, 1415); wo Funktionsprüfungen durchgeführt werden, sind für die Existenz keine weiteren Arbeiten nötig (Rz. 1402). Ob auf das IKS abgestützt wird, entscheidet der Prüfer (Rz. 594).`,
    "Der Prüfplan ist ein Vorschlag. Welche Kontrollen auf welcher Ebene geprüft werden, liegt im pflichtgemässen Ermessen des Prüfers (Rz. 1408).",
  ];
  if (zyklus > 3) hinweise.push("Planungszyklus über drei Jahre: In der Regel sollen Schlüsselkontrollen spätestens nach drei Jahren erneut geprüft werden (Rz. 1410).");
  if (!kontrollen.some((k) => k.ebene === "Einheit")) hinweise.push("Keine Kontrollen auf Ebene der Einheit in der Matrix (Kontrollumfeld, Governance): Vollständigkeit prüfen; sie sind jedes Jahr zu prüfen (Rz. 1403, 1409).");
  if (!kontrollen.some((k) => k.ebene === "IT")) hinweise.push("Keine generellen IT-Kontrollen in der Matrix: Vollständigkeit prüfen; sie sind jedes Jahr zu beurteilen (Rz. 1403, 1407, 1409).");
  return { zeilen, hinweise, normbezug: hwpZitat([594, 600, 602, 1399, 1402, 1403, 1409, 1410, 1413, 1416, 1420]) };
}

/** Prüfplan als CSV (Semikolon, BOM). `arten` = vom Prüfer gewählte Prüfart je Kontroll-ID. */
export function pruefplanAlsCsv(plan: Pruefplan, arten: Record<string, Pruefart>, meta: { pruefjahr: number }): string {
  const kopf = ["Kontroll-ID", "Prozess", "Ebene", "Risiko", "Kontrolle", "Kontrollart", "Ausführung", "Häufigkeit", "Schlüsselkontrolle", "Geplante Prüfung", "Umfang", "Prüfungshandlung", "Datenprüfungen", "Nachweis", "Hinweise"];
  const zeilen = plan.zeilen.map((z) => {
    const k = z.kontrolle;
    const art = arten[k.id] ?? z.vorgeschlagen;
    return [
      k.id,
      k.prozess,
      k.ebene ? `${k.ebene}${k.ebeneAbgeleitet ? " (abgeleitet)" : ""}` : "",
      k.risiken.join(" | "),
      k.kontrolle,
      k.wirkung ?? "nicht angegeben",
      k.ausfuehrung ?? "nicht angegeben",
      k.haeufigkeit ? HAEUFIGKEIT_LABEL[k.haeufigkeit] : (k.haeufigkeitRoh ?? "nicht angegeben"),
      k.schluessel === undefined ? "nicht angegeben" : k.schluessel ? "ja" : "nein",
      PRUEFART_LABEL[art],
      art === "funktion" ? z.funktion.umfangText : art === "existenz" ? "Walk-through: 1 Geschäftsvorfall (Rz. 1420)" : "",
      art === "funktion" ? z.funktion.handlung : art === "existenz" ? z.existenz.join("; ") : "",
      art === "funktion" ? z.funktion.datentests.map((d) => DATENTEST_INFO[d].titel).join("; ") : "",
      z.nachweis,
      [z.faelligGrund, ...z.hinweise].join("; "),
    ]
      .map((c) => csvZelle(c as string | undefined))
      .join(";");
  });
  return `﻿# Prüfplan Kontrollprüfung, Prüfjahr ${meta.pruefjahr}; Grundlage: ${plan.normbezug}\r\n${kopf.join(";")}\r\n${zeilen.join("\r\n")}\r\n`;
}

export { findeKopfzeile };
