# wp-projekt

Privates Repo. **Keine Mandantendaten, keine Zugangsdaten, keine Prüfungsunterlagen einchecken** (`.gitignore` schliesst `.env*`, `daten/`, `*.xlsx`, `*.csv` aus).

## Automatisierbare Prüfungshandlungen (`src/lib/pruefung/`)

Reine Rechenlogik ohne Framework und ohne Netzwerkzugriff. Ergebnisse sind nachvollziehbar (Seed, Intervall, Faktoren, Normbezug) und sind **Prüfhinweise, keine Urteile**; die Würdigung bleibt beim Prüfer.

| Modul | Inhalt | Norm |
|---|---|---|
| `stichprobe.ts` | Zufalls-, systematische und monetäre Auswahl (MUS mit sicherer Auswahl grosser Posten), MUS-Umfang, Stringer-Obergrenze, Attributprüfung (Clopper-Pearson), geschichtete Auswahl, Verhältnis-Hochrechnung | PS 530 (ISA 530) |
| `analytik.ts` | Horizontal-/Vertikalanalyse, Kennzahlen, Regression und Erwartungswert mit Toleranzband, Trend | PS 520 (ISA 520) |
| `fraud.ts` | Betrugsrisikoindikatoren im Journal: Erfassung ausserhalb üblicher Zeit, Wochenende, Rundbeträge, manuelle Buchungen vor Jahresende, Doppelzahlungen, fehlende Funktionstrennung; Abdeckung je Regel (nicht prüfbar wird ausgewiesen) | PS 240 (ISA 240) |
| `goingConcern.ts` | Fragebogen (unvollständig = keine Auswertung), Liquiditätsprognose mit Kreditlinie und Engpass, Covenants, Kapitalverlust/Überschuldung als rechnerischer Hinweis | PS 570 (ISA 570), Art. 725a/725b OR |
| `datum.ts`, `zufall.ts` | Reproduzierbarer Zufall (Seed gehört in die Dokumentation) | |

Annahmen und Grenzen (stehen auch in den Ergebnissen):
- MUS-Umfang und Stringer-Grenze: erwartete Fehlaussage = 0; nur Überbewertungen werden hochgerechnet, Unterbewertungen ausgewiesen und nicht saldiert.
- Erwartungswert-Band ist eine Näherung (Standardfehler der Prognose, k = 2); weniger als 6 Datenpunkte → keine Berechnung.
- Nicht-statistische Verfahren liefern keine Aussage zur Sicherheit.

- Fraud-Regeln sind Heuristiken für die Auswahl von Prüfungshandlungen; sie decken Management Override nicht ab. Fehlen Uhrzeit, Partner oder Erfasser, ist die Regel für diese Buchungen «nicht prüfbar».
- Going Concern entscheidet nie über die Fortführung; die Artikelbezüge zum OR sind gegen die geltende Fassung zu prüfen.

Noch offen: Oberfläche (Next.js), Datenbank, Anmeldung. Vor einer Anbindung an Vercel müssen `next` und `prisma` samt Schema in `package.json` ergänzt werden; das Build-Skript setzt beides voraus.

## Entwicklung

```
npm install
npm run typecheck
npm test
```
