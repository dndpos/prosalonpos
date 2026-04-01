#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session 91
 *
 * Railway runs this during deploy. It:
 *   1. Generates Prisma client
 *   2. Pushes schema to database (create/update tables)
 *   3. Installs + builds the frontend (prosalonpos-station)
 *   4. Copies the built files to server's public/ folder
 *
 * Works with TWO directory structures:
 *   A) Root Directory = (blank) → repo root is /app/
 *      Station at: /app/prosalonpos-station/
 *      Server at:  /app/prosalonpos-server/
 *
 *   B) Root Directory = /prosalonpos-server → /app/ IS the server
 *      Station at: NOT available (skip frontend build)
 *
 * Usage (in Railway):
 *   Build command: npm install && node scripts/build-railway.js
 *   Start command: node src/server.js
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var publicDir = join(serverRoot, 'public');

// Try to find station folder — could be sibling (no root dir) or not exist (root dir set)
var stationRoot = join(serverRoot, '..', 'prosalonpos-station');

function run(cmd, cwd) {
  console.log('[build-railway] Running: ' + cmd);
  console.log('[build-railway]      in: ' + cwd);
  execSync(cmd, { cwd: cwd, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ProSalonPOS — Railway Build (S91)      ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log('[build-railway] Server root: ' + serverRoot);
console.log('[build-railway] Station root: ' + stationRoot);
console.log('[build-railway] Station exists: ' + existsSync(stationRoot));

// Step 1: Generate Prisma client
console.log('[build-railway] Step 1: Prisma generate...');
run('npx prisma generate', serverRoot);

// Step 2: Push schema to database (create/update tables)
console.log('[build-railway] Step 2: Prisma db push...');
run('npx prisma db push --skip-generate', serverRoot);

// Step 3: Build frontend (if station folder exists alongside server)
if (existsSync(stationRoot)) {
  console.log('[build-railway] Step 3: Installing frontend dependencies...');
  run('npm install', stationRoot);

  console.log('[build-railway] Step 4: Building frontend...');
  run('npx vite build', stationRoot);

  // Step 5: Copy built frontend to server's public/ folder
  var distDir = join(stationRoot, 'dist');
  if (existsSync(distDir)) {
    if (existsSync(publicDir)) rmSync(publicDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    cpSync(distDir, publicDir, { recursive: true });
    console.log('[build-railway] Step 5: Frontend copied to public/');
  } else {
    console.error('[build-railway] ❌ Frontend dist/ not found after build!');
    process.exit(1);
  }
} else {
  console.log('[build-railway] ⚠️  No station folder found at: ' + stationRoot);
  console.log('[build-railway] ⚠️  Frontend will NOT be built — API-only mode');
  if (!existsSync(publicDir)) {
    console.log('[build-railway] ⚠️  No public/ folder — server will run API-only');
  }
}

console.log('');
console.log('[build-railway] ✅ Build complete!');
console.log('');
