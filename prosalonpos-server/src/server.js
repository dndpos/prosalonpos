/**
 * ProSalonPOS — Backend Server
 * Express + Socket.io entry point.
 * 
 * Runs on port 3001 (configurable via .env PORT).
 * Frontend auto-detects this server via GET /api/health.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Config & middleware
import authenticate from './middleware/authenticate.js';
import errorHandler from './middleware/errorHandler.js';
import { setIO } from './utils/emit.js';
import startupLicenseCheck from './utils/license.js';
import prisma from './config/database.js';
import { bootstrapSalon } from './utils/salonBootstrap.js';

// Routes
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/license.js';
import staffRoutes from './routes/staff.js';
import servicesRoutes from './routes/services.js';
import settingsRoutes from './routes/settings.js';
import clientRoutes from './routes/clients.js';
import appointmentRoutes from './routes/appointments.js';
import checkoutRoutes from './routes/checkout.js';
import giftCardRoutes from './routes/giftcards.js';
import loyaltyRoutes from './routes/loyalty.js';
import membershipRoutes from './routes/memberships.js';
import inventoryRoutes from './routes/inventory.js';
import commissionRoutes from './routes/commission.js';
import timeclockRoutes from './routes/timeclock.js';
import messagingRoutes from './routes/messaging.js';
import payrollRoutes from './routes/payroll.js';
import reportsRoutes from './routes/reports.js';
import providerRoutes from './routes/provider.js';
import packageRoutes from './routes/packages.js';

var PORT = process.env.PORT || 3001;

// ════════════════════════════════════════════
// EXPRESS APP
// ════════════════════════════════════════════

var app = express();

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// CORS — allow frontend on localhost (dev), Railway, or configured domain
app.use(cors({
  origin: function(origin, callback) {
    // Allow: no origin (same-origin / server-rendered), localhost, Railway, or configured domain
    if (!origin) return callback(null, true);
    if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) return callback(null, true);
    if (origin.indexOf('.railway.app') !== -1) return callback(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return callback(null, true);
    // In production with no FRONTEND_URL set, allow all (single-origin deploy)
    callback(null, true);
  },
  credentials: true
}));

// ── Health check (no auth required) ──
// This is how the frontend detects whether the backend is running.
app.get('/api/health', function(req, res) {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Public routes (no auth required) ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/license', licenseRoutes);

// ── Protected routes (JWT required) ──
app.use('/api/v1/staff', authenticate, staffRoutes);
app.use('/api/v1/services', authenticate, servicesRoutes);
app.use('/api/v1/settings', authenticate, settingsRoutes);
app.use('/api/v1/clients', authenticate, clientRoutes);
app.use('/api/v1/appointments', authenticate, appointmentRoutes);
app.use('/api/v1/checkout', authenticate, checkoutRoutes);
app.use('/api/v1/gift-cards', authenticate, giftCardRoutes);
app.use('/api/v1/loyalty', authenticate, loyaltyRoutes);
app.use('/api/v1/memberships', authenticate, membershipRoutes);
app.use('/api/v1/inventory', authenticate, inventoryRoutes);
app.use('/api/v1/commission', authenticate, commissionRoutes);
app.use('/api/v1/timeclock', authenticate, timeclockRoutes);
app.use('/api/v1/messaging', authenticate, messagingRoutes);
app.use('/api/v1/payroll', authenticate, payrollRoutes);
app.use('/api/v1/reports', authenticate, reportsRoutes);
app.use('/api/v1/packages', authenticate, packageRoutes);
app.use('/api/v1/provider', providerRoutes); // Provider auth handled internally (login is public)

// ── Global error handler (must be last middleware) ──
app.use(errorHandler);

// ════════════════════════════════════════════
// STATIC FRONTEND (production / .exe mode)
// ════════════════════════════════════════════
// In dev: Vite serves the frontend on port 5173. This section is skipped.
// In production/.exe: the built frontend (npm run build) is served from here.
// The built files live in a "public" folder next to the server.

var __dirname = dirname(fileURLToPath(import.meta.url));
var staticPath = join(__dirname, '..', 'public');

if (existsSync(staticPath)) {
  console.log('[Static] Serving frontend from:', staticPath);
  // Hashed assets (JS/CSS) — cache for 1 year (filename changes on rebuild)
  app.use('/assets', express.static(join(staticPath, 'assets'), { maxAge: '1y', immutable: true }));
  // Everything else (index.html) — no cache so browser always gets latest
  app.use(express.static(staticPath, { maxAge: 0, etag: false }));

  // SPA fallback — any non-API route serves index.html with no-cache headers
  app.get('*', function(req, res) {
    if (!req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(join(staticPath, 'index.html'));
    }
  });
} else {
  console.log('[Static] No public/ folder found — frontend served separately (dev mode)');
}

// ════════════════════════════════════════════
// HTTP + SOCKET.IO SERVER
// ════════════════════════════════════════════

var httpServer = createServer(app);

var io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Register IO instance for broadcasting
setIO(io);

// ── Socket.io connection handling ──
io.on('connection', function(socket) {
  console.log('[Socket] Client connected:', socket.id);

  // Client joins their salon's room for targeted broadcasts
  socket.on('join-salon', function(salonId) {
    socket.join('salon:' + salonId);
    socket.salonId = salonId;
    console.log('[Socket] ' + socket.id + ' joined salon:' + salonId);
  });

  // Print relay: tablet → PC station with QZ Tray
  socket.on('print:request', function(data) {
    if (socket.salonId) {
      socket.to('salon:' + socket.salonId).emit('print:request', data);
      console.log('[Socket] Print relay:', (data.type || 'unknown'), '→ salon:', socket.salonId);
    }
  });

  socket.on('disconnect', function() {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// ════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════

var isProduction = existsSync(staticPath);
var modeLabel = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';

// Run license check (only enforced in production/SQLite mode)
var licenseResult = startupLicenseCheck();

httpServer.listen(PORT, async function() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   ProSalonPOS Server running on :' + PORT + '    ║');
  console.log('  ║   Mode: ' + modeLabel + '                       ║');
  console.log('  ║   Health: http://localhost:' + PORT + '/api/health ║');
  console.log('  ╚══════════════════════════════════════════╝');

  if (licenseResult.status === 'valid') {
    console.log('  License: ✅ ' + licenseResult.license.salon_name);
  } else if (licenseResult.status === 'dev_mode') {
    console.log('  License: 🔧 Dev mode — license check skipped');
  } else if (licenseResult.status === 'not_found') {
    console.log('  License: ⚠️  Not activated — waiting for license key');
  } else if (licenseResult.status === 'invalid') {
    console.log('  License: ❌ Invalid — hardware mismatch or corrupted');
  }

  console.log('');

  // ── Auto-bootstrap: ensure salon + default data exist ──
  // Runs in ALL modes (dev, cloud, .exe). On a fresh database, creates
  // salon record, default categories, services, settings, and one manager.
  try {
    var salonName = (licenseResult.status === 'valid' && licenseResult.license)
      ? licenseResult.license.salon_name
      : 'My Salon';
    var licKey = (licenseResult.status === 'valid' && licenseResult.license)
      ? licenseResult.license.license_key
      : null;

    var result = await bootstrapSalon(salonName, licKey);

    if (result.created) {
      console.log('[Bootstrap] ✅ New salon created — code: ' + result.salon.salon_code);
      console.log('[Bootstrap]    Owner PIN: 0000 | Manager PIN: 1234');
    } else if (result.seeded) {
      console.log('[Bootstrap] ✅ Default data seeded into existing salon');
    }

    // Auto-remove old owner Staff records (migration cleanup from pre-S86)
    var oldOwners = await prisma.staff.findMany({
      where: { salon_id: result.salon.id, role: 'owner' }
    });
    if (oldOwners.length > 0) {
      await prisma.staff.deleteMany({
        where: { salon_id: result.salon.id, role: 'owner' }
      });
      console.log('[Bootstrap] ✅ Removed ' + oldOwners.length + ' old owner staff record(s)');
    }
  } catch (err) {
    console.error('[Bootstrap] ❌ Auto-bootstrap failed:', err.message);
    console.error(err.stack);
  }
});
