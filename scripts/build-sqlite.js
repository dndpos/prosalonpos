/**
 * ProSalonPOS — SQLite Build Script
 * 
 * Prepares the server for .exe installer packaging:
 *   1. Copies schema.sqlite.prisma → schema.prisma (temporarily)
 *   2. Runs prisma generate (creates SQLite-compatible client)
 *   3. Runs prisma migrate (creates the .db file with all tables)
 *   4. Restores the original PostgreSQL schema
 * 
 * Usage:  node scripts/build-sqlite.js
 * 
 * The resulting prosalonpos.db file and generated Prisma client
 * are what get bundled into the .exe installer.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var rootDir = join(__dirname, '..');
var prismaDir = join(rootDir, 'prisma');

var pgSchema = join(prismaDir, 'schema.prisma');
var sqliteSchema = join(prismaDir, 'schema.sqlite.prisma');
var pgBackup = join(prismaDir, 'schema.postgresql.prisma');

console.log('');
console.log('  ╔══════════════════════════════════════════╗');
console.log('  ║   ProSalonPOS — SQLite Build Script      ║');
console.log('  ╚══════════════════════════════════════════╝');
console.log('');

// ── Step 1: Verify SQLite schema exists ──
if (!existsSync(sqliteSchema)) {
  console.error('[ERROR] schema.sqlite.prisma not found in prisma/ folder');
  process.exit(1);
}

// ── Step 2: Back up the PostgreSQL schema ──
console.log('[1/5] Backing up PostgreSQL schema...');
copyFileSync(pgSchema, pgBackup);

// ── Step 3: Copy SQLite schema into position ──
console.log('[2/5] Switching to SQLite schema...');
copyFileSync(sqliteSchema, pgSchema);

// ── Step 4: Create .env for SQLite if not present ──
var envPath = join(rootDir, '.env');
var envContent = readFileSync(envPath, 'utf8').toString();
var originalEnv = envContent;

// Temporarily set DATABASE_URL to SQLite
var sqliteUrl = 'file:./prisma/prosalonpos.db';
if (envContent.includes('DATABASE_URL')) {
  envContent = envContent.replace(/DATABASE_URL=.*/g, 'DATABASE_URL=' + sqliteUrl);
} else {
  envContent += '\nDATABASE_URL=' + sqliteUrl + '\n';
}
writeFileSync(envPath, envContent);

try {
  // ── Step 5: Generate Prisma client for SQLite ──
  console.log('[3/5] Generating Prisma client for SQLite...');
  execSync('npx prisma generate', { cwd: rootDir, stdio: 'inherit' });

  // ── Step 6: Create the database with all tables ──
  console.log('[4/5] Creating SQLite database with all tables...');
  execSync('npx prisma db push --accept-data-loss', { cwd: rootDir, stdio: 'inherit' });

  console.log('[5/5] SQLite database created at: prisma/prosalonpos.db');
  console.log('');
  console.log('  ✅ Build complete!');
  console.log('  The .db file and Prisma client are ready for .exe packaging.');
  console.log('');

} catch (err) {
  console.error('[ERROR] Build failed:', err.message);
} finally {
  // ── Always restore the PostgreSQL schema ──
  console.log('[Cleanup] Restoring PostgreSQL schema...');
  copyFileSync(pgBackup, pgSchema);
  writeFileSync(envPath, originalEnv);
  console.log('[Cleanup] Done — dev environment unchanged.');
}
