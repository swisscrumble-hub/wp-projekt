// scripts/vercel-build.mjs
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

process.chdir(rootDir);

const log = (msg) => console.log(`[build] ${msg}`);
const fail = (msg) => { console.error(`[FAIL] ${msg}`); process.exit(1); };

log('Start Vercel Build Script');

const hatPrisma = existsSync(join(rootDir, 'prisma', 'schema.prisma'));

if (hatPrisma) {
  try {
    log('1. Prisma: Generiere Client…');
    execSync('npx prisma generate', { stdio: 'inherit' });
  } catch {
    fail('Prisma-Client-Generierung fehlgeschlagen.');
  }
} else {
  log('1. Prisma: kein Schema vorhanden, Schritt übersprungen.');
}

if (!hatPrisma) {
  log('2. Migrationen: kein Prisma-Schema, Schritt übersprungen.');
} else if (process.env.DIRECT_URL || process.env.DATABASE_URL) {
  try {
    log('2. Prisma: Führe Migrationen aus…');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch {
    fail('Prisma-Migration fehlgeschlagen.');
  }
} else {
  // Nur Namen nennen, nie Werte ausgeben.
  console.error('[WARNUNG] DATABASE_URL/DIRECT_URL fehlen: Migrationen werden übersprungen. In Vercel unter Settings → Environment Variables setzen.');
}

try {
  log('3. Next.js Build…');
  execSync('npx next build', { stdio: 'inherit' });
} catch {
  fail('Next.js-Build fehlgeschlagen.');
}

log('Build erfolgreich beendet.');
