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
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var stationRoot = join(serverRoot, '..', 'prosalonpos-station');
var publicDir = join(serverRoot, 'public');

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

// ── Step 2: Check station folder exists ──
console.log('[build] Step 2: Looking for frontend at ' + stationRoot);
if (!existsSync(stationRoot)) {
  console.error('[build] ❌ FATAL: prosalonpos-station folder not found!');
  console.error('[build]    Make sure Railway Root Directory is BLANK (not /prosalonpos-server)');
  process.exit(1);
}
console.log('[build] ✅ Frontend folder found');
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
