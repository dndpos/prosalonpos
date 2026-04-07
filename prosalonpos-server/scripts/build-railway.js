#!/usr/bin/env node
/**
 * build-railway.js — Railway Deployment Build Script
 * Session 92 — v4
 *
 * Railway constraints:
 *   - Root Directory = /prosalonpos-server → only this folder is copied to /app/
 *   - Database is NOT reachable during build
 *   - prisma generate runs via "postinstall" in package.json (after npm install)
 *
 * This script just verifies the pre-built frontend exists.
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverRoot = join(__dirname, '..');
var publicDir = join(serverRoot, 'public');

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║   ProSalonPOS — Railway Build (S92v4)    ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// Prisma generate already ran via postinstall — just verify public/ exists
if (existsSync(publicDir)) {
  console.log('[build-railway] ✅ Pre-built frontend found in public/');
} else {
  console.log('[build-railway] ⚠️  No public/ folder — frontend must be pre-built locally');
}

console.log('[build-railway] ✅ Build complete!');
console.log('');
