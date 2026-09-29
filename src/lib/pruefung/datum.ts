/** Kalendertage als «YYYY-MM-DD»-Strings, ohne Zeitzonenfehler (UTC-Rechnung). */
const MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/;

export function istIsoDatum(s: string): boolean {
  const m = MUSTER.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Tage seit 1970-01-01 (ganze Zahl). */
export function tagNummer(s: string): number {
  if (!istIsoDatum(s)) throw new RangeError(`Ungültiges Datum: «${s}».`);
  const m = MUSTER.exec(s)!;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** 0 = Sonntag … 6 = Samstag */
export const wochentag = (s: string): number => new Date(tagNummer(s) * 86_400_000).getUTCDay();
