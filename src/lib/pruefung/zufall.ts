/** Deterministischer Zufall (mulberry32): gleicher Seed = gleiche Auswahl. Der Seed gehört in die Prüfungsdokumentation. */
export type Zufall = () => number;

export function seededRandom(seed: number): Zufall {
  if (!Number.isInteger(seed)) throw new RangeError("Seed muss eine ganze Zahl sein.");
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
