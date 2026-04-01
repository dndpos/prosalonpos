#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session 91 — v3
 *
 * Railway constraints:
 *   - Root Directory = /prosalonpos-server → Railway only copies this folder to /app/
 *   - The station folder is NOT available during build when Root Directory is set
 *   - Database is NOT reachable during build (internal networking not available)
 *
 * So this script:
 *   1. Generates Prisma client (no DB needed)
 *   2. Skips db push (moved to start command)
 *   3. Skips frontend build (we pre-build and include public/ in the server zip)
 *
 * Usage (in Railway):
 *   Build command: node scripts/build-railway.js
 *   Start command: npx prisma db push --skip-generate && node src/server.js
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var publicDir = join(serverRoot, 'public');

function run(cmd, cwd) {
  console.log('[build-railway] Running: ' + cmd);
  console.log('[build-railway]      in: ' + cwd);
  execSync(cmd, { cwd: cwd, stdio: 'inherit' });
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ProSalonPOS — Railway Build (S91v3)    ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// Step 1: Generate Prisma client (no database connection needed)
console.log('[build-railway] Step 1: Prisma generate...');
run('npx prisma generate', serverRoot);
console.log('[build-railway] ✅ Prisma client generated');

// Step 2: Check for pre-built frontend
if (existsSync(publicDir)) {
  console.log('[build-railway] ✅ Pre-built frontend found in public/');
} else {
  console.log('[build-railway] ⚠️  No public/ folder — frontend must be pre-built');
  console.log('[build-railway] ⚠️  Run the frontend build locally and include public/ in the server');
}

// Note: db push moved to start command because DB is not reachable during build
console.log('[build-railway] Note: prisma db push runs at startup (DB not available during build)');

console.log('');
console.log('[build-railway] ✅ Build complete!');
console.log('');
