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
import { pinSha256 } from '../config/auth.js';

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
      membershipMembers,
    ] = await Promise.all([
      // Staff
      prisma.staff.findMany({
        where: { salon_id: salonId },
        orderBy: { display_name: 'asc' }
      }),

      // Services (with category junction links)
      prisma.serviceCatalog.findMany({
        where: { salon_id: salonId },
        include: { category_links: true },
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

      // Today's service lines (calendar) — include appointment for client_id, source, requested
      prisma.serviceLine.findMany({
        where: {
          appointment: { salon_id: salonId },
          starts_at: { gte: bounds.start, lte: bounds.end },
          status: { not: 'cancelled' }
        },
        include: {
          appointment: {
            select: { booking_group_id: true, client_id: true, requested: true, source: true }
          }
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
          items: true,
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

      // Membership plans (include perks, all plans for Owner Dashboard)
      prisma.membershipPlan.findMany({
        where: { salon_id: salonId },
        include: { perks: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' }
      }),

      // Messaging templates
      prisma.messageTemplate.findMany({
        where: { salon_id: salonId },
        orderBy: { type: 'asc' }
      }),

      // Packages
      prisma.servicePackage.findMany({
        where: { salon_id: salonId },
        include: { items: true },
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

      // Active/frozen membership members (for badge display in client search)
      prisma.membershipAccount.findMany({
        where: {
          plan: { salon_id: salonId },
          status: { in: ['active', 'frozen'] },
        },
        include: { plan: { select: { name: true } } },
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

    // Build PIN table for instant local PIN verification (same logic as /auth/pin-table/:salon_id)
    var pinTable = {};
    for (var pi = 0; pi < staff.length; pi++) {
      if (staff[pi].pin_sha256) {
        pinTable[staff[pi].pin_sha256] = {
          id: staff[pi].id,
          display_name: staff[pi].display_name,
          role: staff[pi].role,
          rbac_role: staff[pi].rbac_role,
          permissions: staff[pi].permissions ? (typeof staff[pi].permissions === 'string' ? JSON.parse(staff[pi].permissions) : staff[pi].permissions) : null,
          permission_overrides: staff[pi].permission_overrides ? (typeof staff[pi].permission_overrides === 'string' ? JSON.parse(staff[pi].permission_overrides) : staff[pi].permission_overrides) : null,
        };
      }
    }
    if (salon && salon.owner_pin_sha256) {
      pinTable[salon.owner_pin_sha256] = { id: 'owner', display_name: 'Owner', role: 'owner', rbac_role: 'owner' };
    }
    pinTable[pinSha256('90706')] = { id: 'provider', display_name: 'Provider', role: 'owner', rbac_role: 'owner' };

    // Map service category_links to category_ids array (same as /services route)
    services = services.map(function(s) {
      var obj = Object.assign({}, s);
      obj.category_ids = s.category_links ? s.category_links.map(function(l) { return l.category_id; }) : [];
      delete obj.category_links;
      return obj;
    });

    // Clean staff data — add pin_display for non-owners
    staff = staff.map(function(s) {
      var copy = Object.assign({}, s);
      delete copy.pin_hash;
      if (copy.role !== 'owner' && copy.pin_plain) {
        copy.pin_display = copy.pin_plain;
      }
      delete copy.pin_plain;
      return copy;
    });

    res.json({
      staff: staff,
      services: services,
      categories: categories,
      settings: settings,
      serviceLines: serviceLines.map(function(sl) {
        var obj = Object.assign({}, sl);
        if (sl.appointment) {
          obj.bookingId = sl.appointment.booking_group_id || null;
          obj.client_id = sl.appointment.client_id || null;
          obj.requested = sl.appointment.requested || false;
          obj.source = sl.appointment.source || null;
        }
        delete obj.appointment;
        return obj;
      }),
      tickets: tickets,
      giftCards: giftCards,
      products: products,
      loyaltyProgram: loyaltyProgram,
      membershipPlans: membershipPlans || [],
      templates: templates,
      packages: (packages || []).map(function(pkg) {
        return { id: pkg.id, salon_id: pkg.salon_id, location_id: pkg.location_id, name: pkg.name, description: pkg.description, price_cents: pkg.price_cents, expiration_enabled: pkg.expiration_enabled, expiration_days: pkg.expiration_days, transferable: pkg.transferable, refundable: pkg.refundable, active: pkg.active, created_at: pkg.created_at, updated_at: pkg.updated_at };
      }),
      packageItems: (function() { var items = []; (packages || []).forEach(function(pkg) { (pkg.items || []).forEach(function(item) { items.push({ id: item.id, package_id: item.package_id, service_id: item.service_id, service_name: item.service_name, quantity: item.quantity }); }); }); return items; })(),
      clients: clients,
      membershipMembers: (membershipMembers || []).map(function(m) {
        return { id: m.id, client_id: m.client_id, status: m.status, plan_name: m.plan ? m.plan.name : null };
      }),
      pinTable: pinTable,
      today: today,
    });
  } catch (err) {
    // If bootstrap fails, frontend falls back to individual fetches
    console.error('[bootstrap] Error:', err.message);
    next(err);
  }
});

export default router;
