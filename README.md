# wp-projekt

Privates Repo. **Keine Mandantendaten, keine Zugangsdaten, keine Prüfungsunterlagen einchecken** (`.gitignore` schliesst `.env*`, `daten/`, `*.xlsx`, `*.csv` aus).

## Automatisierbare Prüfungshandlungen (`src/lib/pruefung/`)

Reine Rechenlogik ohne Framework und ohne Netzwerkzugriff. Ergebnisse sind nachvollziehbar (Seed, Intervall, Faktoren, Normbezug) und sind **Prüfhinweise, keine Urteile**; die Würdigung bleibt beim Prüfer.

| Modul | Inhalt | Norm |
|---|---|---|
| `stichprobe.ts` | Zufalls-, systematische und monetäre Auswahl (MUS mit sicherer Auswahl grosser Posten), MUS-Umfang, Stringer-Obergrenze, Attributprüfung (Clopper-Pearson), geschichtete Auswahl, Verhältnis-Hochrechnung | PS 530 (ISA 530) |
| `analytik.ts` | Horizontal-/Vertikalanalyse, Kennzahlen, Regression und Erwartungswert mit Toleranzband, Trend | PS 520 (ISA 520) |
| `zufall.ts` | Reproduzierbarer Zufall (Seed gehört in die Dokumentation) | |

Annahmen und Grenzen (stehen auch in den Ergebnissen):
- MUS-Umfang und Stringer-Grenze: erwartete Fehlaussage = 0; nur Überbewertungen werden hochgerechnet, Unterbewertungen ausgewiesen und nicht saldiert.
- Erwartungswert-Band ist eine Näherung (Standardfehler der Prognose, k = 2); weniger als 6 Datenpunkte → keine Berechnung.
- Nicht-statistische Verfahren liefern keine Aussage zur Sicherheit.

Noch offen: Betrugsrisikoindikatoren (ISA 240), Going Concern, Oberfläche, Datenbank.

## Entwicklung

```
npm install
npm run typecheck
npm test
```
