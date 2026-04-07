#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session V23 — FULL AUTO BUILD
 *
 * Railway settings required:
 *   - Root Directory = BLANK (so both folders are visible)
 *   - Build Command  = cd prosalonpos-server && npm install && node scripts/build-railway.js
 *   - Start Command  = cd prosalonpos-server && node src/server.js
 *
 * This script:
 *   1. Runs prisma generate (Prisma client)
 *   2. Installs frontend dependencies
 *   3. Builds the React frontend (vite build)
 *   4. Copies built files into server's public/ folder
 *
 * Database is NOT reachable during build — prisma db push runs at server startup instead.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var publicDir = join(serverRoot, 'public');

// Find the station folder — could be sibling (../prosalonpos-station) or
// at various Railway/Railpack paths depending on Root Directory setting
var stationRoot = null;
var searchPaths = [
  join(serverRoot, '..', 'prosalonpos-station'),   // sibling (Root Dir = blank)
  join(serverRoot, 'prosalonpos-station'),          // nested inside server
  '/app/prosalonpos-station',                       // Railpack absolute
  '/prosalonpos-station',                           // root level
];

function run(cmd, cwd) {
  console.log('[build] > ' + cmd);
  execSync(cmd, { cwd: cwd || serverRoot, stdio: 'inherit' });
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

// ── Step 2: Find station folder ──
console.log('[build] Step 2: Looking for frontend...');
console.log('[build]    Server root: ' + serverRoot);
console.log('[build]    Parent dir contents: ');
try {
  var parentContents = readdirSync(join(serverRoot, '..'));
  console.log('[build]    ' + parentContents.join(', '));
} catch(e) {
  console.log('[build]    (could not read parent dir)');
}

for (var i = 0; i < searchPaths.length; i++) {
  console.log('[build]    Checking: ' + searchPaths[i]);
  if (existsSync(join(searchPaths[i], 'package.json'))) {
    stationRoot = searchPaths[i];
    console.log('[build]    ✅ Found!');
    break;
  }
}

if (!stationRoot) {
  console.error('[build] ❌ FATAL: prosalonpos-station folder not found in any expected location!');
  console.error('[build]    Searched: ' + searchPaths.join(', '));
  process.exit(1);
}
console.log('[build] ✅ Frontend folder: ' + stationRoot);
console.log('');

// ── Step 3: Install frontend dependencies ──
console.log('[build] Step 3: Installing frontend dependencies...');
run('npm install', stationRoot);
console.log('[build] ✅ Frontend dependencies installed');
console.log('');

// ── Step 4: Build frontend ──
console.log('[build] Step 4: Building React frontend...');
run('npx vite build', stationRoot);
console.log('[build] ✅ Frontend built');
console.log('');

// ── Step 5: Copy dist → public ──
var distDir = join(stationRoot, 'dist');
if (!existsSync(distDir)) {
  console.error('[build] ❌ FATAL: vite build did not produce dist/ folder!');
  process.exit(1);
}

// Clean old public/ if it exists
if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true });
}

console.log('[build] Step 5: Copying built frontend to server/public/...');
cpSync(distDir, publicDir, { recursive: true });
console.log('[build] ✅ Frontend copied to public/');
console.log('');

console.log('╔══════════════════════════════════════════╗');
console.log('║   ✅ BUILD COMPLETE — Ready to start     ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
