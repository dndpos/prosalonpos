/**
 * ProSalonPOS — Database Configuration
 * Prisma client singleton. Import this everywhere you need database access.
 * 
 * Supports two database modes:
 *   - PostgreSQL (development / cloud deployment)
 *   - SQLite (self-hosted .exe installer)
 * 
 * Mode is determined by DATABASE_URL in .env:
 *   - Starts with "postgresql://" → PostgreSQL mode
 *   - Starts with "file:" → SQLite mode
 * 
 * Both modes use the exact same Prisma client API — no code changes needed
 * in any route file. The only difference is the underlying database engine.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

var dbUrl = process.env.DATABASE_URL || '';
var isSQLite = dbUrl.startsWith('file:');

// Ensure the database directory exists (ProgramData on production)
if (isSQLite) {
  var dbPath = dbUrl.replace('file:', '');
  var dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log('[DB] Created database directory:', dbDir);
  }
}

var prisma = new PrismaClient();

// Log which database mode is active on startup
if (isSQLite) {
  console.log('[DB] SQLite mode — self-hosted / .exe installer');
  console.log('[DB] Database file:', dbUrl.replace('file:', ''));
} else {
  console.log('[DB] PostgreSQL mode — development / cloud');
}

export { isSQLite };
export default prisma;
