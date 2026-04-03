/**
 * ProSalonPOS — Windows Service Installer
 * 
 * Installs the ProSalonPOS server as a Windows Service so it:
 *   - Starts automatically when the PC boots
 *   - Runs silently in the background (no Command Prompt window)
 *   - Restarts automatically if it crashes
 * 
 * Uses the 'node-windows' package to create and manage the service.
 * 
 * Usage:
 *   node scripts/install-service.js          — install the service
 *   node scripts/install-service.js remove   — uninstall the service
 * 
 * The service will be visible in Windows Services (services.msc) as "ProSalonPOS".
 */
import { Service } from 'node-windows';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var serverScript = join(__dirname, '..', 'src', 'server.js');

var svc = new Service({
  name: 'ProSalonPOS',
  description: 'ProSalonPOS Point-of-Sale Server — serves the salon management app on this computer.',
  script: serverScript,

  // Node.js options
  nodeOptions: [],

  // Environment variables for production mode
  env: [
    {
      name: 'PORT',
      value: '3002'
    },
    {
      name: 'DATABASE_URL',
      value: 'file:./prisma/prosalonpos.db'
    },
    {
      name: 'NODE_ENV',
      value: 'production'
    },
    {
      name: 'JWT_SECRET',
      value: 'prosalonpos-' + Date.now() + '-' + Math.random().toString(36).substring(2)
    }
  ],

  // Restart on crash (up to 3 times, then stop)
  maxRestarts: 3,
  maxRetries: 3,
  wait: 2,                  // seconds between restart attempts
  grow: 0.5,                // increase wait by 50% each retry

  // Don't run in "unsafe" mode
  allowServiceLogon: true
});

// ── Command: install or remove ──
var command = process.argv[2] || 'install';

if (command === 'remove' || command === 'uninstall') {
  console.log('');
  console.log('  Removing ProSalonPOS service...');
  console.log('');

  svc.on('uninstall', function() {
    console.log('  ✅ ProSalonPOS service removed successfully.');
    console.log('  The server will no longer start automatically.');
    console.log('');
  });

  svc.on('error', function(err) {
    console.error('  ❌ Error removing service:', err);
  });

  svc.uninstall();

} else {
  console.log('');
  console.log('  Installing ProSalonPOS as a Windows Service...');
  console.log('  Script: ' + serverScript);
  console.log('  Port: 3002');
  console.log('');

  svc.on('install', function() {
    console.log('  ✅ Service installed! Starting...');
    svc.start();
  });

  svc.on('start', function() {
    console.log('  ✅ ProSalonPOS is now running as a Windows Service.');
    console.log('');
    console.log('  The server will start automatically when this PC boots.');
    console.log('  Open Chrome to http://localhost:3002 to use ProSalonPOS.');
    console.log('');
    console.log('  To manage the service:');
    console.log('    - Open "Services" in Windows (services.msc)');
    console.log('    - Find "ProSalonPOS" in the list');
    console.log('    - Right-click to Stop, Start, or Restart');
    console.log('');
  });

  svc.on('alreadyinstalled', function() {
    console.log('  ⚠️  Service is already installed. Starting it...');
    svc.start();
  });

  svc.on('error', function(err) {
    console.error('  ❌ Error installing service:', err);
  });

  svc.install();
}
