// app/ki-hub/verbindungen/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Annahme: Diese Hilfsfunktionen werden in /lib erstellt
// Für den Moment definieren wir die Anonymisierung direkt hier
const SENSITIVE_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // E-Mail
  /\b(?:\+41\s?|0)(7[0-9])\s?(\d{3})\s?(\d{2?(\d{2})\s?(\d{2})\b/g, // Tel CH
  /\b\d{2}.\d{4}.\d{4}.\d{2}\b/g, // AHV
];

const anonymize = (text: string): string => {
  let anonymized = text;
  SENSITIVE_PATTERNS.forEach(pattern => {
    anonymized = anonymized.replace(pattern, '[REDACTED]');
  });
  return anonymized.trim();
};

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const { query } = await request.json();
    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // 1. Datenschutz: Anonymisierung vor jeder Verarbeitung
    const safeQuery = anonymize(query);

    // 2. Hybrid-Suche: Nur spezifische, nicht sensible Spalten abfragen
    // Hinweis: Die Vektor-Suche setzt ein passendes Prisma-Schema voraus
    const results = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        summary: true, 
      },
      take: 5,
      // Beispielhafter Filter (muss an dein pgvector-Schema angepasst werden)
      where: {
        // Hier würde die Vektor-Ähnlichkeit stehen
      },
    });

    const duration = Date.now() - startTime;
    
    // 3. Sicheres Logging: Nur Metriken, keine Nutzerdaten
    console.log(`[METRIC] search_call: latency=${duration}ms, results=${results.length}, query_hash=${crypto.createHash('sha256').update(safeQuery).digest('hex')}`);

    return NextResponse.json({ matches: results });
  } catch (err) {
    console.error(`[ERROR] ki_hub_search: ${err instanceof Error ? err.message : 'unknown'}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
