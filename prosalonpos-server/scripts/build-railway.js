#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session 89
 *
 * Railway runs this during deploy. It:
 *   1. Installs + builds the frontend (prosalonpos-station)
 *   2. Copies the built files to server's public/ folder
 *   3. Runs prisma generate for the server
 *
 * Directory structure on Railway:
 *   /app/prosalonpos-station/   — frontend source
 *   /app/prosalonpos-server/    — backend source (this is the deploy root)
 *
 * After build:
 *   /app/prosalonpos-server/public/  — built frontend files
 *   Server serves these via express.static
 *
 * Usage (in Railway):
 *   Build command: node scripts/build-railway.js
 *   Start command: node src/server.js
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var stationRoot = join(serverRoot, '..', 'prosalonpos-station');
var publicDir = join(serverRoot, 'public');

function run(cmd, cwd) {
  console.log('[build-railway] Running: ' + cmd);
  console.log('[build-railway]      in: ' + cwd);
  execSync(cmd, { cwd: cwd, stdio: 'inherit' });
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ProSalonPOS — Railway Build            ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// Step 1: Generate Prisma client
console.log('[build-railway] Step 1: Prisma generate...');
run('npx prisma generate', serverRoot);

// Step 2: Push schema to database (create/update tables)
console.log('[build-railway] Step 2: Prisma db push...');
run('npx prisma db push --skip-generate', serverRoot);

// Step 3: Build frontend (if station folder exists alongside server)
if (existsSync(stationRoot)) {
  console.log('[build-railway] Step 3: Building frontend...');
  run('npm install', stationRoot);
  run('npm run build', stationRoot);

  // Step 4: Copy built frontend to server's public/ folder
  var distDir = join(stationRoot, 'dist');
  if (existsSync(distDir)) {
    if (existsSync(publicDir)) rmSync(publicDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    cpSync(distDir, publicDir, { recursive: true });
    console.log('[build-railway] Step 4: Frontend copied to public/');
  } else {
    console.error('[build-railway] ❌ Frontend dist/ not found after build!');
    process.exit(1);
  }
} else {
  console.log('[build-railway] Step 3: No station folder found — frontend-only deploy or pre-built');
  // Check if public/ already has files (pre-built deploy)
  if (!existsSync(publicDir)) {
    console.log('[build-railway] ⚠️  No public/ folder — server will run API-only');
  }
}

console.log('');
console.log('[build-railway] ✅ Build complete!');
console.log('');
