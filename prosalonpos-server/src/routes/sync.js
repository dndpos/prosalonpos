/**
 * ProSalonPOS — Sync Routes (v2.3.1)
 *
 * V2.3 Offline Mode Phase 3a/3b — full snapshot endpoint.
 *
 * GET /api/v1/sync/snapshot
 *   Returns the current salon's data flattened for the Electron main station's
 *   local SQLite mirror. The mirror polls this every 5 minutes while online so
 *   that when internet drops, peer stations route LAN reads through the main
 *   station (Phase 3b). Phase 3c will add an offline write queue.
 *
 * AUTH: standard authenticate middleware sets req.salon_id from the station
 * JWT. The endpoint is salon-scoped — there is no provider-admin or
 * cross-salon path.
 *
 * SCOPE (3a baseline):
 *   - salon (single row)
 *   - stations (all)
 *   - staff (active only)
 *   - services (active only)
 *   - clients (active only)
 *   - appointments — last 90 days + future (denormalized first-line for v2.3.0 mirror compat)
 *   - tickets — last 90 days
 *   - order_lines — children of returned tickets
 *   - payments — children of returned tickets
 *
 * SCOPE (3b additions — additive, non-breaking for v2.3.0 clients):
 *   - service_lines — full multi-line set per appointment (flat list)
 *   - categories — ServiceCategory rows
 *   - service_category_links — flat junction rows (service_id → category_id)
 *
 * Time fields are emitted as epoch ms (Date#getTime()) so the SQLite mirror
 * can store them as INTEGER. The renderer-side reader will format for
 * display; SQLite never sees an ISO string.
 *
 * BYTE-FOR-BYTE: when the LAN listener (Phase 3b) serves /api/v1/clients,
 * /staff, /services, /appointments, /tickets from the SQLite mirror, the
 * response shapes must match Railway's so the peer's apiClient is unaware
 * of the routing swap. Field naming here mirrors the Railway routes; LAN
 * shapers in localdb.js fill defaults for fields the mirror doesn't track.
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

var NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function epoch(d) {
  if (!d) return null;
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'string') {
    var t = Date.parse(d);
    return isNaN(t) ? null : t;
  }
  return null;
}

function shapeSalon(s) {
  if (!s) return null;
  return {
    id: s.id,
    salon_code: s.salon_code,
    name: s.name,
    timezone: s.timezone || 'America/New_York',
  };
}

function shapeStation(s) {
  return {
    id: s.id,
    label: s.label,
    is_main: !!s.is_main,
    lan_ip: s.lan_ip || null,
    last_seen_at: epoch(s.last_seen),
  };
}

function shapeStaff(s) {
  return {
    id: s.id,
    display_name: s.display_name,
    role: s.role,
    is_active: !!s.active,
    avatar_url: s.photo_url || null,
  };
}

function shapeService(s) {
  return {
    id: s.id,
    name: s.name,
    category: null, // legacy field — kept for v2.3.0 mirror compat
    price_cents: s.price_cents || 0,
    duration_min: s.default_duration_minutes || 0,
    is_active: !!s.active,
    // v2.3.1 (Phase 3b): full fields needed when the LAN /services route
    // serves Railway's response shape from SQLite.
    default_duration_minutes: s.default_duration_minutes || 0,
    calendar_color: s.calendar_color || null,
    online_booking_enabled: s.online_booking_enabled !== false,
    position: s.position || 0,
    description: s.description || '',
    open_price: !!s.open_price,
    requires_room: !!s.requires_room,
    product_cost_cents: s.product_cost_cents || 0,
    active: !!s.active,
  };
}

function shapeClient(c) {
  return {
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone || null,
    email: c.email || null,
    notes: c.notes || null,
    // v2.3.1 (Phase 3b): fields the renderer expects from /api/v1/clients.
    phone_digits: c.phone_digits || null,
    outstanding_balance_cents: c.outstanding_balance_cents || 0,
    promo_opt_out: !!c.promo_opt_out,
    is_vip: !!c.is_vip,
    vip_manual_override: !!c.vip_manual_override,
  };
}

// Appointment row in SQLite mirror is denormalized: we merge the parent
// Appointment with the FIRST service line so the v2.3.0 offline calendar can
// render without a join. v2.3.1 mirror also writes to a separate
// appointment_service_line table (see shapeServiceLine below) so multi-line
// appointments are fully represented. Keep this shape stable so v2.3.0
// stations polling a v2.3.1 server keep working.
function shapeAppointmentWithFirstLine(appt) {
  var firstLine = (appt.service_lines || [])[0] || null;
  return {
    id: appt.id,
    client_id: appt.client_id || null,
    client_name: appt.client_name || null,
    staff_id: firstLine ? firstLine.staff_id : null,
    service_id: firstLine ? firstLine.service_catalog_id : null,
    starts_at: firstLine ? epoch(firstLine.starts_at) : null,
    ends_at: firstLine && firstLine.starts_at && firstLine.duration_minutes
      ? (epoch(firstLine.starts_at) + firstLine.duration_minutes * 60 * 1000)
      : null,
    status: appt.status,
    notes: appt.notes || null,
    booking_group_id: appt.booking_group_id || null,
    requested: !!appt.requested,
    source: appt.source || null,
    walk_in: !!appt.walk_in,
    deposit_cents: appt.deposit_cents || 0,
    deposit_status: appt.deposit_status || null,
    checked_in_at: epoch(appt.checked_in_at),
  };
}

// v2.3.1 (Phase 3b): full service line — one row per ServiceLine record.
// Flat list with appointment_id as the foreign key. Mirror writes these into
// the appointment_service_line table so the LAN /api/v1/appointments route
// can rehydrate Railway's nested-service_lines shape from SQLite.
function shapeServiceLine(sl) {
  return {
    id: sl.id,
    appointment_id: sl.appointment_id,
    service_catalog_id: sl.service_catalog_id || null,
    staff_id: sl.staff_id || null,
    starts_at: epoch(sl.starts_at),
    duration_minutes: sl.duration_minutes || 0,
    calendar_color: sl.calendar_color || null,
    status: sl.status || null,
    client_name: sl.client_name || null,
    service_name: sl.service_name || null,
    price_cents: sl.price_cents || 0,
    position: sl.position || 0,
  };
}

// v2.3.1 (Phase 3b): ServiceCategory rows. Needed offline so the service
// picker UI can group services by category — same as the online flow.
function shapeCategory(c) {
  return {
    id: c.id,
    name: c.name,
    calendar_color: c.calendar_color || null,
    position: c.position || 0,
    is_active: c.active !== false,
  };
}

// v2.3.1 (Phase 3b): junction-table row. Phase 3a stripped category info
// from services because no offline read used it; Phase 3b's
// /api/v1/services route needs to return Railway's `category_ids: [...]`
// shape, so the LAN shaper joins service rows back to these.
function shapeCategoryLink(l) {
  return {
    service_catalog_id: l.service_catalog_id,
    category_id: l.category_id,
    position: l.position || 0,
  };
}

function shapeTicket(t) {
  return {
    id: t.id,
    client_id: t.client_id || null,
    staff_id: t.cashier_id || null,
    cashier_id: t.cashier_id || null,
    status: t.status,
    subtotal_cents: t.subtotal_cents || 0,
    tax_cents: t.tax_cents || 0,
    tip_cents: t.tip_cents || 0,
    total_cents: t.total_cents || 0,
    opened_at: epoch(t.created_at),
    closed_at: epoch(t.updated_at), // best-effort proxy in 3a; 3b adds explicit closed_at if needed
    ticket_number: t.ticket_number || null,
    appointment_id: t.appointment_id || null,
  };
}

function shapeOrderLine(item) {
  return {
    id: item.id,
    ticket_id: item.ticket_id,
    kind: item.type || 'service',
    item_id: item.service_id || item.product_id || null,
    name: item.name,
    qty: 1,
    unit_cents: item.price_cents || 0,
    total_cents: item.price_cents || 0,
  };
}

function shapePayment(p) {
  return {
    id: p.id,
    ticket_id: p.ticket_id,
    method: p.method,
    amount_cents: p.amount_cents || 0,
    paid_at: epoch(p.created_at),
    ref: p.processor_txn_id || p.gc_code || null,
  };
}

router.get('/snapshot', async function (req, res, next) {
  try {
    var salonId = req.salon_id;
    if (!salonId) return res.status(401).json({ error: 'salon scope missing' });

    var t0 = Date.now();
    var sinceDate = new Date(Date.now() - NINETY_DAYS_MS);

    // Run independent queries in parallel — Prisma promises share the pool.
    // v2.3.1: appointments now include ALL service_lines (not just first).
    // Adds categories + service_category_links for offline service picker.
    var [salon, stations, staff, services, categoryLinks, categories, clients, appointments, tickets] = await Promise.all([
      prisma.salon.findUnique({
        where: { id: salonId },
        select: { id: true, salon_code: true, name: true, timezone: true },
      }),
      prisma.station.findMany({
        where: { salon_id: salonId },
        select: { id: true, label: true, is_main: true, lan_ip: true, last_seen: true },
      }),
      prisma.staff.findMany({
        where: { salon_id: salonId, status: { not: 'deleted' } },
        select: { id: true, display_name: true, role: true, active: true, photo_url: true },
      }),
      prisma.serviceCatalog.findMany({
        where: { salon_id: salonId, active: true },
        select: { id: true, name: true, price_cents: true, default_duration_minutes: true, active: true, calendar_color: true, online_booking_enabled: true, position: true, description: true, open_price: true, requires_room: true, product_cost_cents: true },
      }),
      prisma.serviceCatalogCategory.findMany({
        where: { service: { salon_id: salonId } },
        select: { service_catalog_id: true, category_id: true, position: true },
      }),
      prisma.serviceCategory.findMany({
        where: { salon_id: salonId },
        select: { id: true, name: true, calendar_color: true, position: true, active: true },
        orderBy: { position: 'asc' },
      }),
      prisma.client.findMany({
        where: { salon_id: salonId, active: true },
        select: { id: true, first_name: true, last_name: true, phone: true, phone_digits: true, email: true, notes: true, outstanding_balance_cents: true, promo_opt_out: true, is_vip: true, vip_manual_override: true },
      }),
      prisma.appointment.findMany({
        where: {
          salon_id: salonId,
          service_lines: { some: { starts_at: { gte: sinceDate } } },
        },
        select: {
          id: true, client_id: true, client_name: true, status: true, notes: true,
          booking_group_id: true, requested: true, source: true, walk_in: true,
          deposit_cents: true, deposit_status: true, checked_in_at: true,
          service_lines: {
            select: {
              id: true, appointment_id: true, staff_id: true, service_catalog_id: true,
              starts_at: true, duration_minutes: true, calendar_color: true, status: true,
              client_name: true, service_name: true, price_cents: true, position: true,
            },
            orderBy: { position: 'asc' },
          },
        },
      }),
      prisma.ticket.findMany({
        where: { salon_id: salonId, created_at: { gte: sinceDate } },
        select: {
          id: true, client_id: true, cashier_id: true, status: true,
          subtotal_cents: true, tax_cents: true, tip_cents: true, total_cents: true,
          created_at: true, updated_at: true, ticket_number: true, appointment_id: true,
        },
      }),
    ]);

    // Flatten all service_lines from every appointment into one list — one
    // row per ServiceLine record. Phase 3b's LAN /appointments route uses
    // these to rehydrate Railway's nested shape; the calendar route uses
    // them flat (matching Railway's /service-lines endpoint).
    var allServiceLines = [];
    for (var ai = 0; ai < appointments.length; ai++) {
      var lines = appointments[ai].service_lines || [];
      for (var li = 0; li < lines.length; li++) {
        allServiceLines.push(lines[li]);
      }
    }

    var ticketIds = tickets.map(function (t) { return t.id; });
    var [orderLines, payments] = await Promise.all([
      ticketIds.length
        ? prisma.ticketItem.findMany({
            where: { ticket_id: { in: ticketIds } },
            select: { id: true, ticket_id: true, type: true, name: true, price_cents: true, service_id: true, product_id: true },
          })
        : [],
      ticketIds.length
        ? prisma.ticketPayment.findMany({
            where: { ticket_id: { in: ticketIds } },
            select: { id: true, ticket_id: true, method: true, amount_cents: true, processor_txn_id: true, gc_code: true, created_at: true },
          })
        : [],
    ]);

    var payload = {
      salon: shapeSalon(salon),
      stations: stations.map(shapeStation),
      staff: staff.map(shapeStaff),
      services: services.map(shapeService),
      clients: clients.map(shapeClient),
      appointments: appointments.map(shapeAppointmentWithFirstLine),
      tickets: tickets.map(shapeTicket),
      order_lines: orderLines.map(shapeOrderLine),
      payments: payments.map(shapePayment),
      // v2.3.1 (Phase 3b) — additive keys. v2.3.0 mirror writeSnapshot
      // ignores unknown top-level keys, so this is non-breaking.
      service_lines: allServiceLines.map(shapeServiceLine),
      categories: categories.map(shapeCategory),
      service_category_links: categoryLinks.map(shapeCategoryLink),
      _meta: {
        snapshot_at: Date.now(),
        salon_id: salonId,
        duration_ms: Date.now() - t0,
        since: sinceDate.toISOString(),
        schema_version: 2, // bumped from 1 (v2.3.0)
      },
    };

    res.json(payload);
  } catch (err) { next(err); }
});

export default router;
