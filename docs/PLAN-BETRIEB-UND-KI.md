# Plan: Betrieb auf eigenen Servern und KI über den bbv AI Hub

Stand: 26.10.2026. Arbeitspapier, noch keine Codeänderungen.

## 1. Ausgangslage

**Die App verwendet heute kein KI-Modell.** Alle Prüfungshandlungen (Stichprobe, MUS, Umfang, Datentests, Journal-Merkmale, IKS-Prüfplan) sind deterministische Berechnungen in `src/lib/` und laufen im Browser. Es gibt keinen Aufruf an einen externen Dienst. Der Schritt «Modelle dürfen nicht öffentlich sein» betrifft also nicht eine bestehende Abhängigkeit, sondern jede **künftige** KI-Funktion.

Was der Server heute tut:

- Anmeldung mit einem gemeinsamen Passwort (`src/lib/auth.ts`, `src/app/api/auth/*`), signiertes Session-Cookie
- Zugriffssperre für alle Seiten (`src/proxy.ts`, zusätzlich `src/app/(app)/layout.tsx`)
- Ausliefern der Seiten; Security-Header in `next.config.ts`

Abhängigkeit von Vercel ist gering:

- `scripts/vercel-build.mjs` (Prisma-Schritte, die mangels Schema ohnehin übersprungen werden; sonst nur `next build`)
- Kommentar zur Fehlversuchs-Bremse in `src/app/api/auth/login/route.ts` (Zähler im Speicher je Instanz)
- Keine Datenbank, keine Vercel-Funktionen (KV, Blob, Edge Config), keine CDN-Schriften; der pdf.js-Worker wird mitgebündelt

Folge: Die App lässt sich ohne Umbau als normale Node.js-Anwendung betreiben.

## 2. Ziel

1. Die App läuft im eigenen Rechenzentrum bzw. in der eigenen Cloud-Umgebung, nur im internen Netz erreichbar.
2. Anmeldung über die Firmen-Identität (SSO) statt über ein gemeinsames Passwort.
3. KI-Funktionen nutzen ausschliesslich Modelle des **bbv AI Hub**. Kein Aufruf an öffentliche Anbieter, kein Aufruf direkt aus dem Browser.
4. Die heutigen Grundsätze bleiben: reproduzierbare Auswahl (Seed), nichts wird geraten, Ergebnisse sind Prüfhinweise.

## 3. Phase 1: Betrieb auf eigenen Servern

| Schritt | Inhalt |
|---|---|
| Build-Art | In `next.config.ts` `output: "standalone"` setzen; ergibt einen eigenständigen Node-Server (`node server.js`) ohne `node_modules` im Image. |
| Container | Dockerfile (mehrstufig: `npm ci` → `npm run build` → schlankes Laufzeit-Image mit Node 22, Benutzer ohne Root-Rechte). Image in die interne Registry. |
| Build-Umgebung | CI (heute GitHub Actions) baut und prüft weiter; zu klären, ob GitHub erlaubt ist oder auf internes GitLab/Azure DevOps umgezogen wird. npm-Pakete ggf. über internen Mirror. `NEXT_TELEMETRY_DISABLED=1` setzen. |
| Netz | Reverse Proxy (nginx/Traefik/Firmen-Gateway) mit TLS-Zertifikat der Firma; App nur intern erreichbar. HSTS und `Secure`-Cookie setzen HTTPS voraus. Der Proxy muss `Host` korrekt weiterreichen (Origin-Prüfung in `src/proxy.ts`) und `X-Forwarded-For` setzen (Fehlversuchs-Bremse). |
| Geheimnisse | `ADMIN_PASSWORD`, `AUTH_SECRET` (später SSO- und AI-Hub-Zugang) aus dem Secret-Store (z.B. Vault, Kubernetes Secrets), nie im Image. |
| Instanzen | Vorerst eine Instanz genügt (Berechnung im Browser, Server fast ohne Last). Bei mehreren Instanzen teilt sich die Fehlversuchs-Bremse nicht; mit SSO entfällt sie. |
| Aufräumen | `scripts/vercel-build.mjs` und `vercel-build`-Skript entfernen, README-Abschnitt «Entwicklung» um Docker-Betrieb ergänzen. |

Abnahme: Image startet intern, Login funktioniert, alle drei Seiten laufen mit Testdateien, CI grün.

## 4. Phase 2: Anmeldung über SSO

Ein gemeinsames Passwort genügt für echte Mandantendaten nicht (siehe README «Wichtige Grenzen»). Mit KI kommt hinzu, dass Aufrufe einer Person zuordenbar sein müssen.

- Anmeldung per OIDC gegen den Firmen-Identity-Provider (z.B. Microsoft Entra ID), Zugriff über eine Gruppe beschränkt.
- Session weiterhin als HttpOnly-/SameSite=Strict-Cookie; `src/proxy.ts` und `istAngemeldet()` prüfen dann das SSO-Token bzw. die eigene Session.
- Benutzername erscheint in der Dokumentationsnotiz und im Protokoll der KI-Aufrufe.
- Umsetzung entweder mit einer Bibliothek (z.B. Auth.js) oder hinter einem vorgeschalteten Auth-Proxy (oauth2-proxy / Firmen-Gateway). Entscheid abhängig davon, was die IT bereits betreibt.

## 5. Phase 3: KI über den bbv AI Hub

### 5.1 Architektur

```
Browser ──(nur ausgewählte, minimierte Daten, nach Bestätigung)──▶ eigener Next-Server: /api/ki/*  (geschuetzt())
                                                                      │  Schlüssel, Modellwahl, Protokoll
                                                                      ▼
                                                               bbv AI Hub (intern)
```

- **Nie direkt aus dem Browser** zum AI Hub: Der Zugangsschlüssel bliebe sonst nicht geheim, und Prompts liessen sich nicht kontrollieren.
- Eigene Route-Handler unter `src/app/api/ki/`, umhüllt mit `geschuetzt()` aus `src/lib/session.ts` (existiert bereits, wird heute nicht verwendet).
- Eine dünne Anbieter-Schicht `src/lib/ki/` (Schnittstelle `KiAnbieter` mit einer AI-Hub-Implementierung und einer Test-Attrappe). Konfiguration nur über Umgebungsvariablen, z.B. `KI_BASE_URL`, `KI_API_KEY`, `KI_MODELL`. Fehlt die Konfiguration, sind KI-Funktionen ausgeblendet (fail closed, wie heute beim Login).
- Tests laufen gegen die Attrappe; kein Test ruft den AI Hub auf.

### 5.2 Folge für den Datenschutz

Heute gilt: «Eingefügte Daten werden nicht an einen Server gesendet» (Hinweis in `src/app/(app)/layout.tsx`, README). **Mit KI stimmt das nicht mehr.** Deshalb:

- Pro KI-Funktion festlegen, welche Daten das Haus verlassen (vom Browser zum eigenen Server, von dort zum AI Hub).
- Datenminimierung: wo möglich nur Spaltenköpfe und wenige Beispielzeilen statt ganzer Journale; Namen/Personalnummern (Erfasser, Freigeber) vor dem Senden pseudonymisieren.
- Jeder Aufruf ist eine bewusste Handlung der Prüferin/des Prüfers (Knopf «KI-Vorschlag holen»), kein automatisches Senden.
- Hinweistext und README anpassen; Rechtsgrundlagen klären (Schweigepflicht der Revisionsstelle, revDSG, Mandatsvereinbarungen).
- Protokoll je Aufruf: Person, Zeitpunkt, Funktion, Modell, Datenumfang. **Kein** Speichern von Inhalten im Server-Log.

### 5.3 Kandidaten für KI-Funktionen

Die Stichprobenziehung und alle Berechnungen bleiben deterministisch und ohne KI (Reproduzierbarkeit, Seed). KI liefert nur **Vorschläge, die bestätigt werden**, gekennzeichnet als «KI-Vorschlag» und in der Dokumentationsnotiz mit Modell und Datum vermerkt.

| Priorität | Funktion | Daten an den AI Hub | Nutzen |
|---|---|---|---|
| 1 | Spaltenzuordnung vorschlagen (Excel, PDF, IKS-Matrix), wenn die heutige Erkennung in `import.ts`/`iks.ts` nichts findet | Spaltenköpfe, wenige Beispielwerte | Hoch, geringes Datenrisiko |
| 2 | IKS-Matrix: Freitext zu Häufigkeit, Kontrollart, Ausführung normalisieren | Einzelne Matrixfelder | Weniger «nicht angegeben»; Vorschlag bleibt zu bestätigen, Grundsatz «nichts wird geraten» bleibt |
| 3 | Entwurf von Prüfungshandlungen / Würdigungstext zur Dokumentationsnotiz | Ergebnisse der Berechnung, keine Rohdaten | Zeitgewinn bei der Dokumentation |
| 4 | Journal: Buchungstexte auf ungewöhnliche Formulierungen prüfen (ergänzend zu ISA-CH 240 A44) | Buchungstexte (sensibel) | Mittel; erst nach Datenschutz-Freigabe |
| 5 | Gescannte PDFs lesen (OCR), falls der AI Hub ein Bildmodell anbietet | Ganze Seiten (sensibel) | Schliesst die heutige Lücke «kein OCR» |

Urheberrecht: Auch in Prompts keine Textauszüge aus HWP oder ISA-CH verwenden, nur eigene Formulierungen mit Randziffer (wie in `src/lib/hwp/`).

### 5.4 Offene Fragen an bbv / AI Hub

Ohne diese Antworten lässt sich die Anbieter-Schicht nicht fertig bauen:

1. Schnittstelle: OpenAI-kompatibel, Anthropic-kompatibel oder eigene API? Gibt es ein SDK?
2. Authentisierung: API-Schlüssel, OAuth Client Credentials, mTLS? Pro Anwendung oder pro Person?
3. Welche Modelle stehen zur Verfügung (Text, Bild/OCR, Kontextlänge, strukturierte Ausgabe/JSON)?
4. Wo laufen die Modelle (Datenstandort Schweiz/EU)? Werden Eingaben gespeichert, protokolliert oder zum Training verwendet? Aufbewahrungsdauer?
5. Ist der AI Hub für Mandantendaten von Revisionsmandaten freigegeben? Gibt es eine Datenklassifizierung?
6. Netz: Ist der AI Hub von unseren Servern erreichbar (Firewall, Proxy, Zertifikate)?
7. Limiten und Kosten: Anfragen pro Minute, Tokenbudget, Abrechnung je Anwendung?
8. Testumgebung: Gibt es einen Zugang für Entwicklung, ohne echte Daten?

## 6. Phase 4: Betrieb

- Protokollierung ohne Mandantendaten (heute schon: Berechnung im Browser). Für `/api/ki/*` nur Metadaten loggen.
- Überwachung: Erreichbarkeit der App und des AI Hub; KI-Ausfall darf die Kernfunktionen nicht blockieren.
- Aktualisierungen: Next.js und Abhängigkeiten regelmässig nachführen (Sicherheitsupdates), Image neu bauen.
- Keine Datenbank, daher kein Backup nötig, solange kein Zustand serverseitig gespeichert wird. Ein KI-Protokoll würde das ändern.

## 7. Nächste Schritte

1. Fragen aus 5.4 an bbv stellen; Datenschutz-/Compliance-Freigabe für Mandantendaten im AI Hub anstossen.
2. Mit der IT klären: Zielplattform (VM, Docker-Host, Kubernetes), Registry, CI-System, Identity-Provider, Reverse Proxy.
3. Phase 1 umsetzen (standalone-Build, Dockerfile, Vercel-Skript entfernen) und intern abnehmen.
4. Phase 2 (SSO) umsetzen.
5. KI-Anbieter-Schicht mit Attrappe bauen, dann Funktion 1 (Spaltenzuordnung) als ersten Anwendungsfall gegen den AI Hub.
6. Nach Freigabe weitere Funktionen aus 5.3.
