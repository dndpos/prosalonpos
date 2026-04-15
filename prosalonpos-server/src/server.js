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
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Config & middleware
import authenticate from './middleware/authenticate.js';
import errorHandler from './middleware/errorHandler.js';
import { setIO } from './utils/emit.js';
import startupLicenseCheck from './utils/license.js';
import prisma from './config/database.js';
import { bootstrapSalon } from './utils/salonBootstrap.js';
import { startReminderScheduler } from './utils/reminderScheduler.js';

// Routes
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/license.js';
import staffRoutes from './routes/staff.js';
import servicesRoutes from './routes/services.js';
import settingsRoutes from './routes/settings.js';
import clientRoutes from './routes/clients.js';
import appointmentRoutes from './routes/appointments.js';
import checkoutRoutes from './routes/checkout.js';
import checkoutMergeCloseRoutes from './routes/checkoutMergeClose.js';
import checkoutMergeOpenRoutes from './routes/checkoutMergeOpen.js';
import checkoutVoidRefundTipRoutes from './routes/checkoutVoidRefundTip.js';
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
import bootstrapRoutes from './routes/bootstrap.js';
import publicRoutes from './routes/public.js';
import printRoutes from './routes/print.js';
import timeOffRoutes from './routes/timeOff.js';
import pushRoutes from './routes/push.js';
import registerTechPortalRoutes from './routes/techPortal.js';

var PORT = process.env.PORT || 3001;

// ════════════════════════════════════════════
// EXPRESS APP
// ════════════════════════════════════════════

var app = express();

// Trust Railway's reverse proxy (fixes express-rate-limit X-Forwarded-For warning)
app.set('trust proxy', 1);

// Gzip compression — reduces response sizes by 60-80% over the wire
app.use(compression());

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,  // frontend serves its own CSP
  crossOriginEmbedderPolicy: false
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Rate limiting — protect login endpoint from brute-force PIN attempts
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 attempts per window per IP
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API rate limiter — generous for normal use, prevents abuse
var apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,            // 300 requests per minute per IP
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// CORS — allow frontend on localhost (dev), Railway, or configured domain
app.use(cors({
  origin: function(origin, callback) {
    // Allow: no origin (same-origin / server-rendered), localhost, Railway, or configured domain
    if (!origin) return callback(null, true);
    if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) return callback(null, true);
    if (origin.indexOf('.railway.app') !== -1) return callback(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return callback(null, true);
    // Reject unknown origins in production when FRONTEND_URL is set
    if (process.env.FRONTEND_URL) return callback(new Error('CORS not allowed'));
    // Allow all only when FRONTEND_URL is not configured (single-origin deploy)
    callback(null, true);
  },
  credentials: true
}));

// ── Health check (no auth required) ──
// This is how the frontend detects whether the backend is running.
app.get('/api/health', function(req, res) {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Request timing — log slow API calls (>500ms target) ──
app.use('/api/', function(req, res, next) {
  var start = Date.now();
  res.on('finish', function() {
    var elapsed = Date.now() - start;
    if (elapsed > 500) {
      console.warn('[SLOW API] ' + req.method + ' ' + req.originalUrl + ' ' + elapsed + 'ms (status: ' + res.statusCode + ')');
    }
  });
  next();
});

// ── Public routes (no auth required) ──
app.use('/api/v1/auth', loginLimiter, authRoutes);
app.use('/api/v1/license', licenseRoutes);
app.use('/api/v1/public', publicRoutes); // Online booking portal — no auth

// ── Protected routes (JWT required) ──
app.use('/api/v1/staff', authenticate, staffRoutes);
app.use('/api/v1/services', authenticate, servicesRoutes);
app.use('/api/v1/settings', authenticate, settingsRoutes);
app.use('/api/v1/clients', authenticate, clientRoutes);
app.use('/api/v1/appointments', authenticate, appointmentRoutes);
app.use('/api/v1/checkout', authenticate, checkoutRoutes);
app.use('/api/v1/checkout', authenticate, checkoutMergeCloseRoutes);
app.use('/api/v1/checkout', authenticate, checkoutMergeOpenRoutes);
app.use('/api/v1/checkout', authenticate, checkoutVoidRefundTipRoutes);
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
app.use('/api/v1/bootstrap', authenticate, bootstrapRoutes);
app.use('/api/v1/provider', providerRoutes); // Provider auth handled internally (login is public)
app.use('/api/v1/print', authenticate, printRoutes);
app.use('/api/v1/time-off', authenticate, timeOffRoutes);
app.use('/api/v1/push', pushRoutes); // vapid-key is public, subscribe/unsubscribe use authenticate middleware inside

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
  // Everything else (index.html, manifest, icons) — no cache so browser always gets latest
  app.use(express.static(staticPath, { maxAge: 0, etag: false, lastModified: false }));

  // Version endpoint — frontend can poll this to detect new deployments
  var BUILD_ID = readdirSync(join(staticPath, 'assets')).find(function(f) { return f.endsWith('.js'); }) || 'unknown';
  app.get('/api/version', function(req, res) {
    res.json({ build: BUILD_ID });
  });

  // Tech portal routes — dynamic per-salon HTML, manifest, and icon
  // Must be registered BEFORE the SPA wildcard fallback
  registerTechPortalRoutes(app);

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

// ── Socket.io connection handling (with station enforcement) ──
io.on('connection', function(socket) {
  console.log('[Socket] Client connected:', socket.id);

  // Client joins their salon's room for targeted broadcasts
  // Also registers an ActiveSession for station enforcement
  socket.on('join-salon', function(data) {
    // Support both old format (string) and new format (object with salon_id + staff_id)
    var salonId = typeof data === 'string' ? data : (data && data.salon_id);
    var staffId = typeof data === 'object' && data ? (data.staff_id || null) : null;
    if (!salonId) return;
    socket.join('salon:' + salonId);
    socket.salonId = salonId;
    console.log('[Socket] ' + socket.id + ' joined salon:' + salonId + (staffId ? ' as ' + staffId : ''));

    // Register active session for this socket connection.
    // No staff_id-based cleanup — same person CAN be logged into multiple stations.
    // Stale sessions are cleaned by the 2-min heartbeat sweep and disconnect handler.
    prisma.activeSession.create({
      data: { salon_id: salonId, socket_id: socket.id, staff_id: staffId, station_label: (typeof data === 'object' && data ? (data.station_label || data.station_id || null) : null) }
    }).then(function() {
      console.log('[Station] Session registered for salon:' + salonId + ' socket:' + socket.id + (staffId ? ' staff:' + staffId : '') + (data.station_label ? ' label:' + data.station_label : ''));
    }).catch(function(err) {
      if (err.code === 'P2002') {
        // Same socket reconnected — just update heartbeat + label
        prisma.activeSession.update({
          where: { socket_id: socket.id },
          data: { last_heartbeat: new Date(), staff_id: staffId, station_label: (typeof data === 'object' && data ? (data.station_label || data.station_id || null) : null) }
        }).catch(function() {});
      } else {
        console.error('[Station] Failed to register session:', err.message);
      }
    });
  });

  // Heartbeat — client sends every 60s to prove it's still alive
  socket.on('heartbeat', function() {
    if (!socket.salonId) return;
    prisma.activeSession.updateMany({
      where: { socket_id: socket.id },
      data: { last_heartbeat: new Date() }
    }).catch(function(err) {
      console.error('[Station] Heartbeat update failed:', err.message);
    });
  });

  // Print relay: tablet/secondary device → station PC with IP printer
  socket.on('print:request', function(data) {
    if (socket.salonId) {
      socket.to('salon:' + socket.salonId).emit('print:request', data);
      console.log('[Socket] Print relay:', (data.type || 'unknown'), '→ salon:', socket.salonId);
    }
  });

  // ── WebRTC Screen Sharing Signaling ──
  // Provider Admin initiates, salon station accepts and shares screen
  socket.on('screen-share-request', function(data) {
    // Provider asks a salon to share screen — forward to all clients in that salon room
    console.log('[ScreenShare] request from', socket.id, '→ salon:', data.salon_id);
    if (data.salon_id) {
      socket.to('salon:' + data.salon_id).emit('screen-share-request', { from: socket.id });
    }
  });
  socket.on('screen-share-accept', function(data) {
    // Salon accepted — tell the provider who asked
    console.log('[ScreenShare] accept from', socket.id, '→', data.to);
    if (data.to) io.to(data.to).emit('screen-share-accept', { from: socket.id });
  });
  socket.on('screen-share-decline', function(data) {
    if (data.to) io.to(data.to).emit('screen-share-decline', {});
  });
  socket.on('screen-share-offer', function(data) {
    console.log('[ScreenShare] offer from', socket.id, '→', data.to);
    if (data.to) io.to(data.to).emit('screen-share-offer', { from: socket.id, offer: data.offer });
  });
  socket.on('screen-share-answer', function(data) {
    console.log('[ScreenShare] answer from', socket.id, '→', data.to);
    if (data.to) io.to(data.to).emit('screen-share-answer', { from: socket.id, answer: data.answer });
  });
  socket.on('screen-share-ice', function(data) {
    if (data.to) io.to(data.to).emit('screen-share-ice', { from: socket.id, candidate: data.candidate });
  });
  socket.on('screen-share-stop', function(data) {
    if (data.to) io.to(data.to).emit('screen-share-stop', {});
    if (data.salon_id) socket.to('salon:' + data.salon_id).emit('screen-share-stop', {});
  });

  socket.on('disconnect', function() {
    console.log('[Socket] Client disconnected:', socket.id);
    // Remove active session on clean disconnect
    prisma.activeSession.deleteMany({
      where: { socket_id: socket.id }
    }).then(function(result) {
      if (result.count > 0) {
        console.log('[Station] Session removed for socket:' + socket.id);
      }
    }).catch(function(err) {
      console.error('[Station] Failed to remove session:', err.message);
    });
  });
});

// ── Stale session cleanup — runs every 2 minutes ──
// Removes sessions that haven't sent a heartbeat in 3+ minutes.
// Handles browser crashes, network drops, and zombie sessions.
setInterval(function() {
  var cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
  prisma.activeSession.deleteMany({
    where: { last_heartbeat: { lt: cutoff } }
  }).then(function(result) {
    if (result.count > 0) {
      console.log('[Station] Cleaned up ' + result.count + ' stale session(s)');
    }
  }).catch(function(err) {
    console.error('[Station] Stale cleanup failed:', err.message);
  });
}, 2 * 60 * 1000); // every 2 minutes

// ── Reminder scheduler — sends appointment reminders at configured times ──
startReminderScheduler();

// ════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════

var isProduction = existsSync(staticPath);
var modeLabel = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';

// Run license check (only enforced in production/SQLite mode)
var licenseResult = startupLicenseCheck();

// ── Ensure database schema is up to date (BEFORE starting server) ──
// On Railway, db push can't run during build (no DB access).
// Run it here before listen() so tables exist before any requests arrive.
try {
  console.log('[Schema] Running prisma db push...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: dirname(fileURLToPath(import.meta.url)) + '/..',
    stdio: 'inherit'
  });
  console.log('[Schema] ✅ Database schema is up to date');
} catch (schemaErr) {
  console.error('[Schema] ❌ prisma db push failed:', schemaErr.message);
}

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

  // ── Warm up Prisma connection pool so first real request isn't slow ──
  try {
    var warmStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DB] Connection pool warmed up in ' + (Date.now() - warmStart) + 'ms');
  } catch (e) {
    console.warn('[DB] Warmup failed:', e.message);
  }

  // ── Clear all active sessions from previous server runs ──
  // On restart, all socket connections are gone. Stale records would
  // permanently block station slots until the 2-minute cleanup fires.
  try {
    var cleared = await prisma.activeSession.deleteMany({});
    if (cleared.count > 0) {
      console.log('[Station] Cleared ' + cleared.count + ' stale session(s) from previous run');
    }
  } catch (e) {
    console.warn('[Station] Session cleanup failed:', e.message);
  }

  // ── Auto-bootstrap: ensure salon + default data exist ──
  // Runs in ALL modes (dev, cloud, .exe). On a fresh database, creates
  // salon record, default categories, services, settings, and one manager.
  console.log('[Bootstrap] Starting bootstrap check...');
  try {
    var salonName = (licenseResult.status === 'valid' && licenseResult.license)
      ? licenseResult.license.salon_name
      : 'My Salon';
    var licKey = (licenseResult.status === 'valid' && licenseResult.license)
      ? licenseResult.license.license_key
      : null;

    var result = await bootstrapSalon(salonName, licKey);

    console.log('[Bootstrap] Salon: "' + result.salon.name + '" | code: ' + result.salon.salon_code + ' | id: ' + result.salon.id);

    if (result.created) {
      console.log('[Bootstrap] ✅ New salon created');
      console.log('[Bootstrap]    Owner PIN: 0000 | Manager PIN: 1234');
    } else if (result.seeded) {
      console.log('[Bootstrap] ✅ Default data seeded into existing salon');
    } else {
      console.log('[Bootstrap] ✅ Existing salon — no changes needed');
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

    // ── Self-heal: populate ServiceCatalogCategory if empty ──
    // Fixes salons bootstrapped before junction table existed.
    // Idempotent — skips if any links already exist for this salon.
    try {
      var salonId = result.salon.id;
      var allServices = await prisma.serviceCatalog.findMany({
        where: { salon_id: salonId, active: true },
        include: { category_links: true }
      });
      var allCategories = await prisma.serviceCategory.findMany({
        where: { salon_id: salonId }
      });

      // Only run if we have services AND categories but zero junction records
      var unlinkedServices = allServices.filter(function(s) {
        return !s.category_links || s.category_links.length === 0;
      });

      if (unlinkedServices.length > 0 && allCategories.length > 0) {
        console.log('[Bootstrap] 🔧 Found ' + unlinkedServices.length + ' services with no category links — auto-linking...');

        // Build category lookup by lowercase name
        var catByName = {};
        allCategories.forEach(function(c) {
          catByName[c.name.toLowerCase().trim()] = c.id;
        });

        // Name-based heuristic matching
        var hairKeywords = ['haircut', 'blowout', 'updo', 'trim', 'shampoo', 'style', 'extension', 'perm', 'keratin', 'straighten'];
        var colorKeywords = ['color', 'highlight', 'balayage', 'ombre', 'toner', 'gloss', 'bleach', 'dye'];
        var nailKeywords = ['manicure', 'pedicure', 'gel', 'acrylic', 'nail', 'shellac', 'dip powder', 'polish'];
        var skinKeywords = ['facial', 'wax', 'microderm', 'peel', 'mask', 'dermaplaning', 'lash', 'brow', 'threading', 'tint'];
        var menKeywords = ["men's", 'beard', 'shave', 'fade', 'lineup', 'taper'];

        function matchCategory(svcName) {
          var lower = svcName.toLowerCase();
          if (catByName['men'] && menKeywords.some(function(k) { return lower.indexOf(k) !== -1; })) return catByName['men'];
          if (catByName['color'] && colorKeywords.some(function(k) { return lower.indexOf(k) !== -1; })) return catByName['color'];
          if (catByName['nails'] && nailKeywords.some(function(k) { return lower.indexOf(k) !== -1; })) return catByName['nails'];
          if (catByName['skin'] && skinKeywords.some(function(k) { return lower.indexOf(k) !== -1; })) return catByName['skin'];
          if (catByName['hair'] && hairKeywords.some(function(k) { return lower.indexOf(k) !== -1; })) return catByName['hair'];
          // Fallback: put in first category so it's visible somewhere
          return allCategories[0].id;
        }

        var linked = 0;
        for (var ui = 0; ui < unlinkedServices.length; ui++) {
          var svc = unlinkedServices[ui];
          var catId = matchCategory(svc.name);
          try {
            await prisma.serviceCatalogCategory.create({
              data: {
                service_catalog_id: svc.id,
                category_id: catId,
                position: ui,
              }
            });
            linked++;
          } catch (linkErr) {
            // Skip duplicates (unique constraint)
            if (linkErr.code !== 'P2002') {
              console.error('[Bootstrap] ⚠️  Link failed for "' + svc.name + '":', linkErr.message);
            }
          }
        }
        console.log('[Bootstrap] ✅ Auto-linked ' + linked + ' services to categories');
      }
    } catch (healErr) {
      console.error('[Bootstrap] ⚠️  Category link self-heal failed:', healErr.message);
    }

  } catch (err) {
    console.error('[Bootstrap] ❌ Auto-bootstrap failed:', err.message);
    console.error(err.stack);
  }

  // ── Diagnostic: count tickets in DB ──
  try {
    var ticketCount = await prisma.ticket.count();
    var paidCount = await prisma.ticket.count({ where: { status: 'paid' } });
    console.log('[Diagnostic] Total tickets in DB:', ticketCount, '| Paid:', paidCount);
  } catch (diagErr) {
    console.error('[Diagnostic] Could not count tickets:', diagErr.message);
  }

  // ── Auto-seed ProviderOwner if none exists ──
  // Ensures provider login works on existing databases.
  // PIN comes from PROVIDER_MASTER_CODE env var (defaults to 90706).
  try {
    var providerCount = await prisma.providerOwner.count();
    if (providerCount === 0) {
      var { hashPin: _hashPin } = await import('./config/auth.js');
      var _masterCode = process.env.PROVIDER_MASTER_CODE || '90706';
      await prisma.providerOwner.create({
        data: {
          id: 'provider-owner-1',
          name: 'Andy Tran',
          email: 'andy@prosalonpos.com',
          pin_hash: _hashPin(_masterCode),
        }
      });
      console.log('[Bootstrap] ✅ Created ProviderOwner (PIN from env or default)');
    }
  } catch (provErr) {
    console.error('[Bootstrap] ⚠️  ProviderOwner seed failed:', provErr.message);
  }
});
