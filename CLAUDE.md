# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Next.js 16 / React 19 web app (German, Swiss spelling: «ss» instead of «ß») that automates audit procedures for the Swiss ordinary audit (ordentliche Revision), based on the HWP OR 2024 handbook (EXPERTsuisse) and ISA-CH 240. Users upload Excel/PDF files; the app proposes samples and audit hints. The README is the authoritative spec for behaviour, limits and legal references — read it before changing audit logic.

**Never commit client data, credentials or audit documents** (`.gitignore` excludes `.env*`, `daten/`, `*.xlsx`, `*.csv`). Test fixtures must be built in code, not as files.

## Commands

```
npm install                  # node_modules is not checked in
npm run dev                  # needs .env.local with ADMIN_PASSWORD (≥12) and AUTH_SECRET (≥32), see .env.example
npm run typecheck            # next typegen && tsc --noEmit
npm run lint
npm test                     # node:test via tsx, all src/**/*.test.ts
npx tsx --test src/lib/pruefung/umfang.test.ts                # single file
npx tsx --test --test-name-pattern="Einzelfall" src/lib/pruefung/umfang.test.ts   # single test
npm run build
```

CI (`.github/workflows/ci.yml`) runs typecheck, test, lint, build on Node 22. Tests use `node:test` + `node:assert/strict` (no Jest/Vitest) and cover only `src/lib/` — pure logic, no DOM.

## Architecture

- **All computation runs client-side.** Pages under `src/app/(app)/` and components are `"use client"`; uploaded files are parsed in the browser (`src/lib/datei.ts` dispatches to `read-excel-file` or `pdfjs-dist`, both dynamically imported) and never sent to the server. Keep it that way — do not add API routes that receive audit data.
- **Server side is only auth.** `src/proxy.ts` (Next 16 proxy, formerly middleware) gates every route except `/` and `/api/auth/login`, and rejects cross-origin non-GET requests. `src/app/(app)/layout.tsx` re-checks the session (defense in depth). `src/lib/auth.ts` signs/verifies session tokens; missing env vars must keep everything locked (fail closed). Security headers live in `next.config.ts`.
- **Data pipeline:** file → `Blatt` (rows of `Zelle`, plus page numbers for PDFs) → `import.ts` (header detection, column suggestions, filters, control totals, skipped rows with reason) → domain logic in `src/lib/pruefung/` or `src/lib/iks.ts` → `dokumentation.ts` (documentation note) and CSV export with source row number.
- **Domain modules** (`src/lib/pruefung/`): `stichprobe.ts` (sampling, MUS, attribute), `umfang.ts` (sample sizes, caps, extrapolation — `OBERGRENZE_STICHPROBE`, `NORMAL_MAX`, `KONTROLL_STAFFELUNG` are shared constants), `kontrolle.ts` (control data tests), `journalpruefung.ts` (journal-entry risk criteria), `analytik.ts` (not wired into the UI). `src/lib/iks.ts` parses an IKS/risk-control matrix and builds the test plan for `/kontrolle`.
- **Catalogs** (`src/lib/hwp/`): procedures and example controls with Randziffer references; cite via `hwpZitat()` / `isaZitat()` from `quelle.ts`.
- **UI building blocks** live in `src/components/ui.tsx` (`Karte`, `Schritt`, `Feld`, `Knopf`, `Hinweise`, `Tabelle`, `chf`/`prozent` formatters in de-CH, `lade` for CSV download). Reuse them instead of new ad-hoc markup; styling is Tailwind 4.
- **Deployment:** Vercel runs `npm run vercel-build` (`scripts/vercel-build.mjs`), which skips the Prisma steps when no `prisma/schema.prisma` exists — currently there is none, so it is just `next build`. Any future API route should be wrapped with `geschuetzt()` from `src/lib/session.ts`.

## Invariants to preserve

- **Determinism:** randomness only via `seededRandom` (`src/lib/pruefung/zufall.ts`, mulberry32). Same seed + file + parameters must yield the same selection; the seed is part of the documentation note.
- **Nothing is guessed:** if a column/field is missing, the criterion is «nicht prüfbar» / «nicht angegeben» with a hint — never silently treated as «ohne Auffälligkeit». Results are hints, not judgments.
- **Sample size caps:** proposals max 10 per procedure (Einzelfall min 5), up to 15 at «Erhöhtes Risiko»; 15 is an absolute cap, also for manual input. When the cap undercuts the formula, show the computed value with a note.
- **Copyright:** catalogs contain no text from the HWP or ISA-CH, only own short wording plus Randziffer/Tz. references. Don't paste handbook text.
- Domain errors are dedicated `Error` subclasses (`StichprobenFehler`, `IksFehler`, `PdfFehler`, `DateiFehler`) with user-facing German messages.
- `tsconfig` has `noUncheckedIndexedAccess`; import paths use the `@/*` alias for `src/*`.
