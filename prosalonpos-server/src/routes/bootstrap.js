/**
 * ProSalonPOS — Bootstrap Route
 * Session 99 | Performance Optimization
 *
 * Single endpoint that returns ALL data needed to hydrate the app on login.
 * Instead of 14 separate API calls (staff, services, categories, settings,
 * service lines, tickets, gift cards, products, loyalty, memberships, etc.),
 * the frontend makes ONE call and gets everything.
 *
 * This eliminates 13 round trips to Railway (~100-300ms each) on every login.
 *
 * Endpoint: GET /api/v1/bootstrap
 * Auth: JWT required (runs after login)
 * Returns: { staff, services, categories, settings, serviceLines, tickets, ... }
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

// ── Helper: get today's date string in Eastern time ──
function todayStr() {
  var now = new Date();
  var str = now.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
  var isEDT = str.indexOf('EDT') >= 0;
  var etOffset = isEDT ? 240 : 300;
  var etNow = new Date(now.getTime() - etOffset * 60000);
  return etNow.getUTCFullYear() + '-' + String(etNow.getUTCMonth() + 1).padStart(2, '0') + '-' + String(etNow.getUTCDate()).padStart(2, '0');
}

function dayBounds(dateStr) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]) - 1;
  var day = parseInt(parts[2]);
  var probe = new Date(Date.UTC(y, m, day, 12, 0, 0));
  var str = probe.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
  var etOffset = str.indexOf('EDT') >= 0 ? 240 : 300;
  var start = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  start.setUTCMinutes(start.getUTCMinutes() + etOffset);
  var end = new Date(Date.UTC(y, m, day, 23, 59, 59, 999));
  end.setUTCMinutes(end.getUTCMinutes() + etOffset);
  return { start: start, end: end };
}

// ── GET / — Full bootstrap payload ──
router.get('/', async function(req, res, next) {
  try {
    var salonId = req.salon_id;
    var today = todayStr();
    var bounds = dayBounds(today);

    // Fire ALL queries in parallel — this is the key performance win.
    // Instead of 14 sequential round trips from frontend → server → DB,
    // we do 1 round trip from frontend → server, then server fires all
    // DB queries simultaneously.
    var [
      staff,
      services,
      categories,
      settingsRecord,
      serviceLines,
      tickets,
      giftCards,
      products,
      loyaltyProgram,
      membershipPlans,
      templates,
      packages,
      salon,
      clients,
    ] = await Promise.all([
      // Staff
      prisma.staff.findMany({
        where: { salon_id: salonId },
        orderBy: { display_name: 'asc' }
      }),

      // Services
      prisma.serviceCatalog.findMany({
        where: { salon_id: salonId },
        orderBy: { name: 'asc' }
      }),

      // Categories
      prisma.serviceCategory.findMany({
        where: { salon_id: salonId },
        orderBy: { position: 'asc' }
      }),

      // Settings
      prisma.salonSettings.findUnique({
        where: { salon_id: salonId }
      }),

      // Today's service lines (calendar)
      prisma.serviceLine.findMany({
        where: {
          appointment: { salon_id: salonId },
          starts_at: { gte: bounds.start, lte: bounds.end },
          status: { not: 'cancelled' }
        },
        orderBy: { starts_at: 'asc' }
      }),

      // Today's tickets
      prisma.ticket.findMany({
        where: {
          salon_id: salonId,
          created_at: { gte: bounds.start, lte: bounds.end }
        },
        include: {
          line_items: true,
          payments: true
        },
        orderBy: { created_at: 'desc' }
      }),

      // Gift cards
      prisma.giftCard.findMany({
        where: { salon_id: salonId },
        orderBy: { created_at: 'desc' }
      }),

      // Products (inventory)
      prisma.product.findMany({
        where: { salon_id: salonId, active: true },
        orderBy: { name: 'asc' }
      }),

      // Loyalty program
      prisma.loyaltyProgram.findFirst({
        where: { salon_id: salonId }
      }),

      // Membership plans
      prisma.membershipPlan.findMany({
        where: { salon_id: salonId, active: true },
        orderBy: { name: 'asc' }
      }),

      // Messaging templates
      prisma.messageTemplate.findMany({
        where: { salon_id: salonId },
        orderBy: { name: 'asc' }
      }),

      // Packages
      prisma.servicePackage.findMany({
        where: { salon_id: salonId, active: true },
        orderBy: { name: 'asc' }
      }),

      // Salon record (for owner_pin_sha256)
      prisma.salon.findUnique({
        where: { id: salonId }
      }),

      // Clients (top 100 by last name)
      prisma.client.findMany({
        where: { salon_id: salonId, active: true },
        orderBy: { last_name: 'asc' },
        take: 100
      }),
    ]);

    // Parse settings (Json field in PostgreSQL, string in SQLite)
    var settings = {};
    if (settingsRecord && settingsRecord.settings) {
      try {
        settings = typeof settingsRecord.settings === 'string'
          ? JSON.parse(settingsRecord.settings)
          : settingsRecord.settings;
      } catch (e) {
        settings = {};
      }
    }
    // Include owner_pin_sha256 for local PIN check (same as settings route)
    if (salon && salon.owner_pin_sha256) settings.owner_pin_sha256 = salon.owner_pin_sha256;

    res.json({
      staff: staff,
      services: services,
      categories: categories,
      settings: settings,
      serviceLines: serviceLines,
      tickets: tickets,
      giftCards: giftCards,
      products: products,
      loyaltyProgram: loyaltyProgram,
      membershipPlans: membershipPlans || [],
      templates: templates,
      packages: packages,
      clients: clients,
      today: today,
    });
  } catch (err) {
    // If bootstrap fails, frontend falls back to individual fetches
    console.error('[bootstrap] Error:', err.message);
    next(err);
  }
});

export default router;
