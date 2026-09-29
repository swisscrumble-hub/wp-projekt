// scripts/vercel-build.mjs
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

process.chdir(rootDir);

const log = (msg) => console.log(`[build] ${msg}`);
const fail = (msg) => { console.error(`[FAIL] ${msg}`); process.exit(1); };

log('Start Vercel Build Script');

try {
  log('1. Prisma: Generiere Client…');
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (e) {
  fail('Prisma-Client-Generierung fehlgeschlagen.');
}

if (process.env.DIRECT_URL || process.env.DATABASE_URL) {
  try {
    log('2. Prisma: Führe Migrationen aus…');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (e) {
    fail('Prisma-Migration fehlgeschlagen.');
  }
} else {
  // Nur Namen nennen, nie Werte ausgeben.
  console.error('[WARNUNG] DATABASE_URL/DIRECT_URL fehlen: Migrationen werden übersprungen. In Vercel unter Settings → Environment Variables setzen.');
}

try {
  log('3. Next.js Build…');
  execSync('npx next build', { stdio: 'inherit' });
} catch (e) {
  fail('Next.js-Build fehlgeschlagen.');
}

log('Build erfolgreich beendet.');
