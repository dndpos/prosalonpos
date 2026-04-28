/**
 * Tech Phone Payroll Data — cc5.12
 *
 * Single endpoint that returns everything the tech phone needs to compute
 * its own pay summary using the EXISTING client-side payrollCalculator.js.
 * No math duplicated on the server — we just gather the inputs.
 *
 * Why this design (Option B from the session C90 analysis):
 *   - One source of truth for payroll math (the client calculator used by
 *     PayrollModule.jsx). Tech phone and owner screen produce identical
 *     numbers by construction.
 *   - No catalog-join risk: product cost, commission rules, tiers, and
 *     categories all come through the bundle so the client can resolve
 *     product_cost_cents by name match exactly as the owner side does.
 *   - Tech authenticates with the existing JWT; staff_id comes from the
 *     token so a compromised client can never request someone else's pay.
 */

import { Router } from 'express';
import prisma from '../config/database.js';
import { formatTicket, dayBounds } from './checkoutHelpers.js';

var router = Router();

// ── GET /my-payroll-data?start=YYYY-MM-DD&end=YYYY-MM-DD ──
router.get('/my-payroll-data', async function(req, res, next) {
  try {
    var staffId = req.staff_id;
    var salonId = req.salon_id;
    if (!staffId || !salonId) return res.status(401).json({ error: 'Auth required' });

    var start = req.query.start;
    var end = req.query.end;
    if (!start || !end) return res.status(400).json({ error: 'start and end required (YYYY-MM-DD)' });

    // Salon-local midnight bounds — use the same dayBounds helper the rest
    // of the checkout routes use so period boundaries line up with tickets.
    var startBounds = dayBounds(start, salonId);
    var endBounds = dayBounds(end, salonId);

    // Staff record (with full pay config)
    var staff = await prisma.staff.findFirst({
      where: { id: staffId, salon_id: salonId },
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Strip sensitive fields before sending to client.
    delete staff.pin_hash;
    delete staff.pin_plain;
    delete staff.pin_sha256;

    // Paid + refunded tickets in range. Tech phone client will reshape via
    // reshapeTicketForPayroll which splits multi-tech tickets per tech and
    // filters to this staff's items only.
    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: salonId,
        created_at: { gte: startBounds.start, lte: endBounds.end },
        status: { in: ['paid', 'refunded'] },
      },
      include: { items: true, payments: true },
    });

    // Clock punches — only this staff's, in range.
    var punches = await prisma.clockPunch.findMany({
      where: {
        staff_id: staffId,
        timestamp: { gte: startBounds.start, lte: endBounds.end },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Service catalog — needed for product_cost_cents lookup during commission
    // calc AND the Sales tab's net-per-item display. Mirror routes/services.js
    // GET / — `category_ids` is a derived array from the join table, NOT a
    // direct column. An invalid `select` here makes the whole endpoint throw
    // (that was the cc5.12.0 bug that left product cost lookup empty and let
    // the Sales tab fall back to showing gross).
    var servicesRaw = await prisma.serviceCatalog.findMany({
      where: { salon_id: salonId },
      include: { category_links: true },
    });
    var services = servicesRaw.map(function(s) {
      var obj = Object.assign({}, s);
      obj.category_ids = (s.category_links || []).map(function(l) { return l.category_id; });
      delete obj.category_links;
      return obj;
    });

    // Salon settings — pay_frequency, commission toggles, discount rules, etc.
    var settingsRow = await prisma.salonSettings.findUnique({ where: { salon_id: salonId } });
    var settings = {};
    if (settingsRow && settingsRow.settings) {
      try {
        settings = typeof settingsRow.settings === 'string'
          ? JSON.parse(settingsRow.settings)
          : settingsRow.settings;
      } catch (e) { settings = {}; }
    }

    // Commission rules + tiers (for the full rules engine path in calculatePaycheck).
    var commissionRules = await prisma.commissionRule.findMany({
      where: { salon_id: salonId },
    });
    var commissionTiers = await prisma.commissionTier.findMany({
      where: { salon_id: salonId },
    });

    var formattedTickets = tickets.map(function(t) { return formatTicket(t); });

    res.json({
      staff: staff,
      tickets: formattedTickets,
      punches: punches.map(function(p) {
        return { id: p.id, staff_id: p.staff_id, type: p.type, timestamp: p.timestamp };
      }),
      services: services,
      settings: settings,
      commissionRules: commissionRules,
      commissionTiers: commissionTiers,
    });
  } catch (err) { next(err); }
});

export default router;
