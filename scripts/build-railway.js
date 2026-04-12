#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session V23 — Pre-built frontend
 *
 * The React frontend is pre-built locally and committed as server/public/.
 * Railway's Railpack only copies the server folder, so the station folder
 * is not available during build. This script just runs prisma generate
 * and verifies public/ exists.
 *
 * Railway settings:
 *   - Build Command  = node scripts/build-railway.js
 *   - Start Command  = node src/server.js
 */
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var publicDir = join(serverRoot, 'public');

function run(cmd) {
  console.log('[build] > ' + cmd);
  execSync(cmd, { cwd: serverRoot, stdio: 'inherit' });
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ProSalonPOS — Railway Build (V23)      ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// ── Step 1: Prisma generate ──
console.log('[build] Step 1: Generating Prisma client...');
run('npx prisma generate');
console.log('[build] ✅ Prisma client generated');
console.log('');

// ── Step 2: Push schema to database ──
console.log('[build] Step 2: Pushing schema to database...');
try {
  run('npx prisma db push --accept-data-loss');
  console.log('[build] ✅ Database schema up to date');
} catch (e) {
  console.warn('[build] ⚠️ prisma db push failed (may not have DATABASE_URL at build time)');
  console.warn('[build]    Schema will be pushed at runtime if needed.');
}
console.log('');

// ── Step 3: Verify pre-built frontend ──
console.log('[build] Step 3: Checking for pre-built frontend...');
if (existsSync(join(publicDir, 'index.html'))) {
  console.log('[build] ✅ Pre-built frontend found in public/');
} else {
  console.error('[build] ❌ FATAL: public/index.html not found!');
  console.error('[build]    The frontend must be pre-built locally before pushing to GitHub.');
  console.error('[build]    Run: cd prosalonpos-station && npm run build');
  console.error('[build]    Then copy dist/ contents to prosalonpos-server/public/');
  process.exit(1);
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ✅ BUILD COMPLETE — Ready to start     ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
