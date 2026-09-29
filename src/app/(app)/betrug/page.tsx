"use client";

import { useState } from "react";
import { pruefeJournal, type FraudErgebnis } from "@/lib/pruefung/fraud";
import { parseZahl, tabelleMitKopf } from "@/lib/tabelle";
import { Daten, Fehler, Feld, Hinweise, Karte, Knopf, Tabelle } from "@/components/ui";

const VORLAGE = "id;datum;zeit;konto;betrag;erfasser;freigeber;manuell;partner;belegnr";
const REGEL_NAME: Record<string, string> = {
  ausserhalb_zeit: "Erfassung ausserhalb üblicher Zeit",
  wochenende: "Buchung am Wochenende",
  rundbetrag: "Rundbetrag",
  jahresende_manuell: "Manuelle Buchung vor Jahresende",
  doppelzahlung: "Mögliche Doppelzahlung",
  funktionstrennung: "Erfasser = Freigeber",
};

export default function BetrugSeite() {
  const [daten, setDaten] = useState("");
  const [ende, setEnde] = useState("");
  const [von, setVon] = useState("7");
  const [bis, setBis] = useState("19");
  const [r, setR] = useState<FraudErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function pruefen() {
    try {
      setFehler(null);
      const buchungen = tabelleMitKopf(daten).map((z, i) => {
        if (!z.id) throw new Error(`Zeile ${i + 2}: ID fehlt.`);
        let betrag: number;
        try {
          betrag = parseZahl(z.betrag ?? "");
        } catch {
          throw new Error(`Zeile ${i + 2}: Betrag «${z.betrag}» ist keine Zahl.`);
        }
        const manuell = (z.manuell ?? "").toLowerCase();
        return {
          id: z.id,
          datum: z.datum ?? "",
          zeit: z.zeit || undefined,
          konto: z.konto ?? "",
          betrag,
          erfasser: z.erfasser || undefined,
          freigeber: z.freigeber || undefined,
          manuell: ["ja", "true", "1", "j", "manuell"].includes(manuell) ? true : ["nein", "false", "0", "n", "auto"].includes(manuell) ? false : undefined,
          partner: z.partner || undefined,
          belegnr: z.belegnr || undefined,
        };
      });
      setR(pruefeJournal(buchungen, { geschaeftsjahrEnde: ende, arbeitszeit: { von: Number(von), bis: Number(bis) } }));
    } catch (e) {
      setR(null);
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Betrugsrisikoindikatoren</h1>
      <Karte titel="Journal prüfen" norm="PS 240 (ISA 240), Prüfung von Journalbuchungen">
        <Daten
          label="Journalbuchungen"
          hilfe={`Erste Zeile = Kopfzeile, z. B. ${VORLAGE}. Pflicht: id, datum (JJJJ-MM-TT), betrag. Fehlende optionale Spalten machen die jeweilige Regel «nicht prüfbar».`}
          value={daten}
          onChange={(e) => setDaten(e.target.value)}
          rows={8}
          placeholder={`${VORLAGE}\nB-1;2025-12-29;23:40;4000;50000;mk;mk;ja;Meier AG;R-7`}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Feld label="Geschäftsjahresende" placeholder="2025-12-31" value={ende} onChange={(e) => setEnde(e.target.value)} />
          <Feld label="Übliche Zeit von (Uhr)" inputMode="numeric" value={von} onChange={(e) => setVon(e.target.value)} />
          <Feld label="bis (Uhr)" inputMode="numeric" value={bis} onChange={(e) => setBis(e.target.value)} />
        </div>
        <Knopf onClick={pruefen}>Prüfen</Knopf>
        <Fehler text={fehler} />
      </Karte>
      {r && (
        <Karte titel={`Ergebnis: ${r.befunde.length} Prüfhinweis(e) bei ${r.anzahlBuchungen} Buchungen`} norm={r.normbezug}>
          <Hinweise liste={r.hinweise} />
          {r.befunde.length > 0 ? (
            <Tabelle kopf={["Regel", "Buchung(en)", "Begründung"]} zeilen={r.befunde.map((b) => [REGEL_NAME[b.regel] ?? b.regel, b.buchungen.join(", "), b.begruendung])} />
          ) : (
            <p className="text-sm text-slate-700">Keine Prüfhinweise. Das beweist nichts; beachte die Abdeckung unten.</p>
          )}
          <Tabelle
            kopf={["Regel", "Geprüft", "Nicht prüfbar"]}
            zeilen={Object.entries(r.abdeckung).map(([regel, a]) => [REGEL_NAME[regel] ?? regel, a.geprueft, a.nichtPruefbar])}
          />
        </Karte>
      )}
    </div>
  );
}
