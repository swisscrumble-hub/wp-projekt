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

## Anwendung (Next.js 16)

Vier Seiten unter Anmeldung: `/stichproben`, `/analytik`, `/betrug`, `/going-concern`. Daten werden eingefügt (Excel/CSV, Trennzeichen Tab, `;` oder `,`; Zahlen wie `1'234.50` oder `1234,50`) und **im Browser berechnet**; Mandantendaten werden nicht an einen Server gesendet und nicht gespeichert.

Zugang: Passwort (`ADMIN_PASSWORD`, mind. 12 Zeichen) und `AUTH_SECRET` (mind. 32 Zeichen), siehe `.env.example`. Fehlt eine Variable, bleibt alles gesperrt (fail closed). Session-Cookie: HttpOnly, SameSite=Strict, Secure, 8 Stunden; Origin-Prüfung bei schreibenden Anfragen; Security-Header in `next.config.ts`.

Grenzen der Anmeldung: Ein Passwort für alle, keine Benutzerverwaltung. Die Bremse gegen Fehlversuche liegt im Speicher je Server-Instanz und ist auf Vercel nur eine Bremse, kein vollständiger Schutz. Für mehrere Personen oder echte Mandantendaten ist eine richtige Benutzerverwaltung nötig.

Noch offen: Datenbank/Speichern von Prüfungen, Benutzer und Rollen, Normbibliothek.

## Entwicklung

```
npm install
cp .env.example .env.local   # Werte eintragen, nie committen
npm run dev
npm run typecheck && npm run lint && npm test
```
