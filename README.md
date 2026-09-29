# wp-projekt

Privates Repo. **Keine Mandantendaten, keine Zugangsdaten, keine Prüfungsunterlagen einchecken** (`.gitignore` schliesst `.env*`, `daten/`, `*.xlsx`, `*.csv` aus).

Web-App für automatisierbare Prüfungshandlungen der ordentlichen Revision. Auf jeder Seite wird eine Excel- oder PDF-Datei hochgeladen, daraus werden Stichproben bzw. Prüfhinweise erzeugt. Grundlage ist das Schweizer Handbuch der Wirtschaftsprüfung, Band «Ordentliche Revision» (EXPERTsuisse, HWP OR 2024).

## Aufbau

| Seite | Ablauf | Grundlage |
|---|---|---|
| `/einzelfall` **Einzelfallprüfung** | Einzelfallprüfung aus dem Katalog wählen (Aktiven, Passiven, Erfolgsrechnung) → Excel hochladen → Grundgesamtheit abstimmen → Umfang festlegen (MUS-Formel, 95 % Standard) → Stichprobe ziehen → Auswertung (obere Fehlergrenze bzw. Hochrechnung) | HWP Teil III.4.9 (Katalog), III.4.5 (Stichproben), Rz. 792 (Hochrechnung) |
| `/kontrolle` **Kontrollprüfung** | **IKS-Matrix hochladen (Excel oder PDF) → Prüfplan erzeugen** (je Kontrolle: fällig? Existenzprüfung oder Funktionsprüfung, Umfang, Prüfungshandlungen, CSV-Export; Lücken und fehlende Angaben werden ausgewiesen, nichts wird geraten) → Funktionsprüfung einer Kontrolle übernehmen; oder direkt: Kontrolle wählen (Beispielkontrollen je Prozess oder eigene) → Excel mit Vorgängen hochladen → automatische Datenprüfung über alle Vorgänge (Funktionstrennung, Freigabe fehlt, Freigabe verspätet) → Stichprobe über den Prüfzeitraum → Auswertung der Abweichungen | HWP Teil III.4.2 (Funktionsprüfungen), Rz. 303–308, 600–603, 764, 794–796; Existenzprüfung des IKS Rz. 1398–1422 |
| `/journal` **Journalprüfung** | Journal als Excel hochladen → Stichtag und Schwellen festlegen → Buchungen nach definierten Merkmalen erhöhten Risikos bewerten → Auswahl (risikobasiert plus Zufallsanteil) | ISA-CH 240 Tz. 33(a), A42–A45 (Merkmale in A44); HWP Teil III.3.9.4.2 Rz. 374–377 |

Going Concern ist bewusst nicht enthalten.

Jede Auswahl liefert eine **Dokumentationsnotiz** (Methode, Seed, Umfang, Grundgesamtheit, Randziffer) und einen **CSV-Download** mit der Zeilennummer aus der Quelldatei. Gleicher Seed, gleiche Datei und gleiche Parameter ergeben dieselbe Auswahl.

## Import (Excel und PDF)

**Excel:** `.xlsx` (bis 20 MB, 200'000 Zeilen). **PDF:** Text-PDFs mit Tabellen, z.B. Kontodetails, Saldenlisten, Journalauszüge (bis 20 MB, 500 Seiten). Beides wird im Browser gelesen und **nicht hochgeladen**. Kopfzeile und Spalten werden vorgeschlagen (Beleg, Datum, Konto, Text, Betrag oder Soll/Haben, je nach Seite Erfasser, Freigeber, Buchungsart, Erfassungs-/Freigabedatum) und können korrigiert werden. Filter: Konto, Datum, Mindestbetrag, Buchungsseite (Soll/Haben). Der Import weist Kontrollzahlen aus (Anzahl, Summen) und erlaubt den Abgleich mit dem Hauptbuchsaldo; übersprungene Zeilen (auch Summenzeilen) werden mit Grund gelistet. Fehlt für ein Kriterium eine Spalte, steht es als **«nicht prüfbar»**, nie als «ohne Auffälligkeit».

**PDF im Detail:** Zeilen und Spalten werden aus den Textpositionen abgeleitet (pdf.js). Wiederholte Kopfzeilen je Seite werden entfernt, die **Seitenzahl** je Posten wird in Auswahl und CSV ausgewiesen. Beträge in Klammern oder mit Minus am Ende gelten als negativ (Soll/Haben: Soll − Haben). Die Tabelle ist eine **Näherung**: Spalten, Vorzeichen und Beträge kontrollieren und die Kontrollsumme mit der Quelle abgleichen. **Gescannte PDFs (Bilder) und passwortgeschützte PDFs werden nicht gelesen** (kein OCR); dann Excel-Export verwenden.

## Wichtige Grenzen

- **Urheberrecht:** Der Katalog (`src/lib/hwp/`) enthält keine Textauszüge aus dem Handbuch, sondern eigene Kurzformulierungen mit Randziffer. Die Randziffern wurden am Handbuch (Ausgabe 2024) geprüft; Auswahl und Formulierung sind eine Arbeitshilfe, kein Ersatz für das Handbuch.
- **Kontrollen:** Das Handbuch enthält keinen Katalog konkreter Schlüsselkontrollen. Die Kontrollen sind **Beispiele (eigener Vorschlag)** und an das Mandat anzupassen; aus dem Handbuch stammen Kontrollarten und Prüfungshandlungen.
- **Stichprobenumfang bei Kontrollen:** Die Staffelung nach Häufigkeit (1/1/2/5/25, sonst 10 %, höchstens 40) stammt aus den Q&A des Handbuchs zur CMS-Prüfung (PS-CH 980); die Übertragung auf IKS-Funktionsprüfungen ist durch den Prüfer zu bestätigen. Alternativ: statistische Attributprüfung.
- **ISA-CH 240 statt ISA 240 (Revised):** Die Journal-Kriterien folgen ISA-CH 240 (gültig ab 15.12.2022), Tz. 33(a) und A44. Wochenende/Feiertag und Wiederholungen stehen nur im HWP (Rz. 375) und sind als «ergänzend» abschaltbar. Die überarbeitete Fassung ISA 240 (Revised) lag nicht vor; ein Abgleich ist vom Prüfer vorzunehmen. Buchungen zum Periodenende sind Pflichtbestandteil der Auswahl (Tz. 33(a)(ii)); die Befragung nach Tz. 33(a)(i) und die Erwägung nach (iii) werden in der Notiz dokumentiert.
- MUS-Umfang und Stringer-Grenze setzen erwartete Fehler = 0 voraus; Unterbewertungen werden ausgewiesen, nicht saldiert.
- Alle Ergebnisse sind rechnerische Vorschläge und **Prüfhinweise, keine Urteile**. Umfang, Methode und Würdigung liegen beim Prüfer.
- Zugang: ein Passwort für alle, keine Benutzerverwaltung. Die Bremse gegen Fehlversuche liegt im Speicher je Server-Instanz. Für echte Mandantendaten und mehrere Personen ist eine Benutzerverwaltung nötig.

## Zugang und Datenschutz

Anmeldung mit `ADMIN_PASSWORD` (mind. 12 Zeichen) und `AUTH_SECRET` (mind. 32 Zeichen), siehe `.env.example`. Fehlt eine Variable, bleibt alles gesperrt (fail closed). Session-Cookie: HttpOnly, SameSite=Strict, Secure, 8 Stunden; Sperre in `src/proxy.ts` plus Prüfung im Layout; Origin-Prüfung bei schreibenden Anfragen; Security-Header in `next.config.ts`. Berechnungen laufen im Browser; eingefügte Daten werden nicht gesendet und nicht gespeichert.

## Code

- `src/lib/hwp/`: Kataloge (Einzelfallprüfungen, Kontrollen) und Quellenangabe
- `src/lib/pruefung/`: `stichprobe.ts` (Auswahl, MUS, Attribut), `umfang.ts` (Umfang, Hochrechnung), `kontrolle.ts` (Datentests, Stichprobe), `journalpruefung.ts` (Merkmale, Auswahl), `analytik.ts` (Vorjahresvergleich, Regression; derzeit nicht in der Oberfläche)
- `src/lib/import.ts`, `pdf.ts`, `tabelle.ts`, `dokumentation.ts`: Import (Excel, PDF), Tabellen, Notiz
- `src/app/(app)/`: Seiten; `src/components/`: Bausteine

## Entwicklung

```
npm install
cp .env.example .env.local   # Werte eintragen, nie committen
npm run dev
npm run typecheck && npm run lint && npm test
```

## IKS-Matrix und Prüfplan (Kontrollprüfung)

Die Matrix wird im Browser gelesen (Excel `.xlsx` oder PDF mit Text). Erkannt werden Prozess, Risiko(-ID), Kontroll-ID, Kontrolle, Häufigkeit, Kontrollart, Ausführung, Schlüsselkontrolle, Ebene, Nachweis und «zuletzt geprüft»; die Zuordnung der Spalten ist zu bestätigen.

- **Fälligkeit** (HWP Rz. 1409–1410): Kontrollen der Einheit und generelle IT-Kontrollen jährlich; Prozess-Schlüsselkontrollen im Planungszyklus (Standard 3 Jahre, nach «zuletzt geprüft»). Fehlt die Angabe, gilt die Kontrolle als fällig.
- **Prüfart**: Existenzprüfung (Walk-through, Rz. 1416–1420) oder Funktionsprüfung mit Stichprobe (deckt die Existenz ab, Rz. 1402); je Kontrolle änderbar.
- **Umfang der Funktionsprüfung**: Staffelung nach Häufigkeit (indikativ; Q&A zur CMS-Prüfung, PS-CH 980, durch den Prüfer zu bestätigen). Ist die Häufigkeit unbekannt, gibt es keine Zahl, sondern den Hinweis, den Umfang von Hand festzulegen.
- **Nicht geraten**: Fehlende Kontrollart/Ausführung/Schlüsselkontrolle werden als Hinweis ausgewiesen; «halbjährlich» wird mit Hinweis der Stufe «vierteljährlich» zugeordnet; «teilautomatisiert» gilt vorsichtig als manuell. Risiken ohne Kontrolle erscheinen als Lücke.
- Der Prüfplan ist ein Vorschlag; Schlüsselkontrollen, Ausgestaltung und Verwertbarkeit früherer Prüfungen beurteilt der Prüfer.
