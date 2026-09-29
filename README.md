# wp-projekt

Privates Repo. **Keine Mandantendaten, keine Zugangsdaten, keine Prüfungsunterlagen einchecken** (`.gitignore` schliesst `.env*`, `daten/`, `*.xlsx`, `*.csv` aus).

Web-App für automatisierbare Prüfungshandlungen der ordentlichen Revision. Auf jeder Seite wird eine Excel-Datei hochgeladen, daraus werden Stichproben bzw. Prüfhinweise erzeugt. Grundlage ist das Schweizer Handbuch der Wirtschaftsprüfung, Band «Ordentliche Revision» (EXPERTsuisse, HWP OR 2024).

## Aufbau

| Seite | Ablauf | Grundlage |
|---|---|---|
| `/einzelfall` **Einzelfallprüfung** | Einzelfallprüfung aus dem Katalog wählen (Aktiven, Passiven, Erfolgsrechnung) → Excel hochladen → Grundgesamtheit abstimmen → Umfang festlegen (MUS-Formel, 95 % Standard) → Stichprobe ziehen → Auswertung (obere Fehlergrenze bzw. Hochrechnung) | HWP Teil III.4.9 (Katalog), III.4.5 (Stichproben), Rz. 792 (Hochrechnung) |
| `/kontrolle` **Kontrollprüfung** | Kontrolle wählen (Beispielkontrollen je Prozess oder eigene) → Excel mit Vorgängen hochladen → automatische Datenprüfung über alle Vorgänge (Funktionstrennung, Freigabe fehlt, Freigabe verspätet) → Stichprobe über den Prüfzeitraum → Auswertung der Abweichungen | HWP Teil III.4.2 (Funktionsprüfungen), Rz. 303–308, 600–603, 764, 794–796 |
| `/journal` **Journalprüfung** | Journal als Excel hochladen → Stichtag und Schwellen festlegen → Buchungen nach definierten Merkmalen erhöhten Risikos bewerten → Auswahl (risikobasiert plus Zufallsanteil) | HWP Teil III.3.9.4.2 Rz. 374–377 (Merkmale aus ISA-CH 240) |

Going Concern ist bewusst nicht enthalten.

Jede Auswahl liefert eine **Dokumentationsnotiz** (Methode, Seed, Umfang, Grundgesamtheit, Randziffer) und einen **CSV-Download** mit der Zeilennummer aus der Quelldatei. Gleicher Seed, gleiche Datei und gleiche Parameter ergeben dieselbe Auswahl.

## Excel-Import

`.xlsx` (bis 20 MB, 200'000 Zeilen), im Browser gelesen und **nicht hochgeladen**. Kopfzeile und Spalten werden vorgeschlagen (Beleg, Datum, Konto, Text, Betrag oder Soll/Haben, je nach Seite Erfasser, Freigeber, Buchungsart, Erfassungs-/Freigabedatum) und können korrigiert werden. Filter: Konto, Datum, Mindestbetrag, Buchungsseite (Soll/Haben). Der Import weist Kontrollzahlen aus (Anzahl, Summen) und erlaubt den Abgleich mit dem Hauptbuchsaldo; übersprungene Zeilen (auch Summenzeilen) werden mit Grund gelistet. Fehlt für ein Kriterium eine Spalte, steht es als **«nicht prüfbar»**, nie als «ohne Auffälligkeit».

## Wichtige Grenzen

- **Urheberrecht:** Der Katalog (`src/lib/hwp/`) enthält keine Textauszüge aus dem Handbuch, sondern eigene Kurzformulierungen mit Randziffer. Die Randziffern wurden am Handbuch (Ausgabe 2024) geprüft; Auswahl und Formulierung sind eine Arbeitshilfe, kein Ersatz für das Handbuch.
- **Kontrollen:** Das Handbuch enthält keinen Katalog konkreter Schlüsselkontrollen. Die Kontrollen sind **Beispiele (eigener Vorschlag)** und an das Mandat anzupassen; aus dem Handbuch stammen Kontrollarten und Prüfungshandlungen.
- **Stichprobenumfang bei Kontrollen:** Die Staffelung nach Häufigkeit (1/1/2/5/25, sonst 10 %, höchstens 40) stammt aus den Q&A des Handbuchs zur CMS-Prüfung (PS-CH 980); die Übertragung auf IKS-Funktionsprüfungen ist durch den Prüfer zu bestätigen. Alternativ: statistische Attributprüfung.
- **ISA 240 (Revised):** Die Journal-Kriterien folgen Rz. 375 (ISA-CH 240). Der Abgleich mit dem Wortlaut von ISA 240 (Revised) war nicht Teil der Unterlagen und ist vom Prüfer vorzunehmen.
- MUS-Umfang und Stringer-Grenze setzen erwartete Fehler = 0 voraus; Unterbewertungen werden ausgewiesen, nicht saldiert.
- Alle Ergebnisse sind rechnerische Vorschläge und **Prüfhinweise, keine Urteile**. Umfang, Methode und Würdigung liegen beim Prüfer.
- Zugang: ein Passwort für alle, keine Benutzerverwaltung. Die Bremse gegen Fehlversuche liegt im Speicher je Server-Instanz. Für echte Mandantendaten und mehrere Personen ist eine Benutzerverwaltung nötig.

## Zugang und Datenschutz

Anmeldung mit `ADMIN_PASSWORD` (mind. 12 Zeichen) und `AUTH_SECRET` (mind. 32 Zeichen), siehe `.env.example`. Fehlt eine Variable, bleibt alles gesperrt (fail closed). Session-Cookie: HttpOnly, SameSite=Strict, Secure, 8 Stunden; Sperre in `src/proxy.ts` plus Prüfung im Layout; Origin-Prüfung bei schreibenden Anfragen; Security-Header in `next.config.ts`. Berechnungen laufen im Browser; eingefügte Daten werden nicht gesendet und nicht gespeichert.

## Code

- `src/lib/hwp/`: Kataloge (Einzelfallprüfungen, Kontrollen) und Quellenangabe
- `src/lib/pruefung/`: `stichprobe.ts` (Auswahl, MUS, Attribut), `umfang.ts` (Umfang, Hochrechnung), `kontrolle.ts` (Datentests, Stichprobe), `journalpruefung.ts` (Merkmale, Auswahl), `analytik.ts` (Vorjahresvergleich, Regression; derzeit nicht in der Oberfläche)
- `src/lib/import.ts`, `tabelle.ts`, `dokumentation.ts`: Import, Tabellen, Notiz
- `src/app/(app)/`: Seiten; `src/components/`: Bausteine

## Entwicklung

```
npm install
cp .env.example .env.local   # Werte eintragen, nie committen
npm run dev
npm run typecheck && npm run lint && npm test
```
