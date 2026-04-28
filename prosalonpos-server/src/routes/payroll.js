/**
 * ProSalonPOS — Payroll Routes
 * Payroll runs with paychecks, plus commission rule management.
 * All endpoints require JWT authentication.
 *
 * Store expects:
 *   GET  /runs                    → { runs: [...] }
 *   GET  /runs/:id                → { run: {...} }
 *   POST /runs                    → { run: {...} }
 *   PUT  /runs/:id                → { run: {...} }
 *   PUT  /paychecks/:id           → { paycheck: {...} }
 *   GET  /commission-rules        → { rules: [...] }
 *   POST /commission-rules        → { rule: {...} }
 *   PUT  /commission-rules/:id    → { rule: {...} }
 *
 * Payroll data model:
 *   PayrollRun doesn't exist as a Prisma model yet — it's computed.
 *   A "run" is a summary for a date range, built from tickets + clock punches
 *   + commission rules + staff pay profiles.
 *
 *   Since we don't have PayrollRun/Paycheck tables in the schema yet,
 *   this route provides computed payroll data from existing tables.
 *   A future migration will add PayrollRun + Paycheck models for persistence.
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { emit } from '../utils/emit.js';
import { dayBoundsTz } from '../utils/salonTz.js'; // v2.0.6

// SQLite stores JSON as strings
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

var router = Router();

// ════════════════════════════════════════════
// PAYROLL RUNS (computed from tickets + punches)
// ════════════════════════════════════════════

// v2.0.6: easternDayStart/End replaced by salon-tz-aware dayBoundsTz.

/**
 * Compute payroll data for a date range.
 * v2.0.6: bounds computed in salon's tz (was Eastern-only).
 */
async function computePayroll(salonId, periodStart, periodEnd) {
  var startBounds = dayBoundsTz(periodStart, salonId);
  var endBounds = dayBoundsTz(periodEnd, salonId);
  var startDate = startBounds.start;
  var endDate = endBounds.end;

  // Get salon settings (for advanced_commission_enabled)
  var salonSettingsRow = await prisma.salonSettings.findUnique({ where: { salon_id: salonId } });
  var salonSettings = (salonSettingsRow && salonSettingsRow.settings) ? (typeof salonSettingsRow.settings === 'string' ? JSON.parse(salonSettingsRow.settings) : salonSettingsRow.settings) : {};
  var advCommEnabled = !!salonSettings.advanced_commission_enabled;

  // Get service catalog with category links (for per-category commission lookup)
  var serviceCatalog = [];
  if (advCommEnabled) {
    serviceCatalog = await prisma.serviceCatalog.findMany({
      where: { salon_id: salonId },
      select: { id: true, name: true, category_links: { select: { category_id: true } } }
    });
  }

  // Get all staff for this salon
  var staff = await prisma.staff.findMany({
    where: { salon_id: salonId, active: true },
    select: {
      id: true, display_name: true, pay_type: true,
      commission_pct: true, daily_guarantee_cents: true,
      hourly_rate_cents: true, salary_amount_cents: true,
      salary_period: true, payout_check_pct: true, payout_bonus_pct: true,
      category_commission_rates: true,
    }
  });

  // Parse JSON fields from SQLite
  staff.forEach(function(s) {
    s.category_commission_rates = fromDb(s.category_commission_rates);
  });

  // Get closed tickets in the period
  var tickets = await prisma.ticket.findMany({
    where: {
      salon_id: salonId,
      status: { in: ['paid', 'refunded'] },
      created_at: { gte: startDate, lte: endDate },
    },
    include: { items: true }
  });

  // Get clock punches in the period
  var staffIds = staff.map(function(s) { return s.id; });
  var punches = await prisma.clockPunch.findMany({
    where: {
      staff_id: { in: staffIds },
      timestamp: { gte: startDate, lte: endDate },
    },
    orderBy: { timestamp: 'asc' }
  });

  // Build per-staff paycheck summaries
  var paychecks = staff.map(function(s) {
    // Sum service revenue for this tech from ticket items
    // Subtract proportional refund amount from refunded tickets
    var techItems = [];
    var serviceRevenue = 0;
    tickets.forEach(function(t) {
      var ticketItemsForTech = [];
      t.items.forEach(function(item) {
        if (item.tech_id === s.id && item.type === 'service') {
          ticketItemsForTech.push(item);
          techItems.push(item);
        }
      });
      // If ticket was refunded, reduce revenue proportionally
      if (t.refund_cents > 0 && t.subtotal_cents > 0 && ticketItemsForTech.length > 0) {
        var refundRatio = Math.min(t.refund_cents / t.subtotal_cents, 1);
        ticketItemsForTech.forEach(function(item) {
          serviceRevenue += Math.round((item.original_price_cents || item.price_cents) * (1 - refundRatio));
        });
      } else {
        ticketItemsForTech.forEach(function(item) {
          serviceRevenue += item.original_price_cents || item.price_cents;
        });
      }
    });

    // Commission calculation (on net revenue after refunds)
    // ── Min daily hours gating ──
    // If min_daily_hours_for_commission is set, exclude items from days where
    // this tech's punch hours are below the threshold.
    var minDailyHrs = parseFloat(salonSettings.min_daily_hours_for_commission) || 0;
    var commissionItems = techItems;
    var commissionRevenue = serviceRevenue;
    if (minDailyHrs > 0) {
      var staffPunches = punches.filter(function(p) { return p.staff_id === s.id; });
      var punchDayMap = {};
      staffPunches.forEach(function(p) {
        var d = p.timestamp;
        var dayKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        if (!punchDayMap[dayKey]) punchDayMap[dayKey] = [];
        punchDayMap[dayKey].push(p);
      });
      var disqualifiedDays = {};
      Object.keys(punchDayMap).forEach(function(dayKey) {
        var dp = punchDayMap[dayKey].sort(function(a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); });
        var dayMins = 0;
        for (var di = 0; di < dp.length - 1; di++) {
          if (dp[di].type === 'in' && dp[di + 1].type === 'out') {
            dayMins += (dp[di + 1].timestamp.getTime() - dp[di].timestamp.getTime()) / 60000;
          }
        }
        if ((dayMins / 60) < minDailyHrs) disqualifiedDays[dayKey] = true;
      });
      // Filter items: only keep items from tickets on qualifying days
      if (Object.keys(disqualifiedDays).length > 0) {
        commissionItems = techItems.filter(function(item) {
          var ticket = tickets.find(function(tk) { return tk.id === item.ticket_id; });
          if (!ticket) return true;
          var td = ticket.created_at;
          var tdKey = td.getFullYear() + '-' + (td.getMonth() + 1) + '-' + td.getDate();
          return !disqualifiedDays[tdKey];
        });
        commissionRevenue = 0;
        commissionItems.forEach(function(item) {
          var ticket = tickets.find(function(tk) { return tk.id === item.ticket_id; });
          if (ticket && ticket.refund_cents > 0 && ticket.subtotal_cents > 0) {
            var ratio = Math.min(ticket.refund_cents / ticket.subtotal_cents, 1);
            commissionRevenue += Math.round((item.original_price_cents || item.price_cents) * (1 - ratio));
          } else {
            commissionRevenue += item.original_price_cents || item.price_cents;
          }
        });
      }
    }

    // When advanced_commission_enabled is ON, use per-category rates from staff profile.
    // Look up each service item's category, check staff.category_commission_rates for a
    // custom rate, fall back to flat commission_pct for categories without a custom rate.
    var commissionCents = 0;
    var catRates = (s.category_commission_rates && typeof s.category_commission_rates === 'object') ? s.category_commission_rates : {};
    if (advCommEnabled && Object.keys(catRates).length > 0) {
      // Per-item commission using category rates
      commissionItems.forEach(function(item) {
        var priceCents = item.original_price_cents || item.price_cents;
        // Look up category from service catalog — ID match first, name fallback for older tickets
        var catEntry = item.service_id ? serviceCatalog.find(function(sc) { return sc.id === item.service_id; }) : null;
        if (!catEntry && item.name) {
          catEntry = serviceCatalog.find(function(sc) { return sc.name === item.name; });
        }
        var catIds = catEntry ? catEntry.category_links.map(function(cl) { return cl.category_id; }) : [];
        var pct = s.commission_pct || 0; // fallback to flat
        for (var ci = 0; ci < catIds.length; ci++) {
          if (catRates[catIds[ci]] !== undefined && catRates[catIds[ci]] !== '') {
            pct = parseInt(catRates[catIds[ci]], 10) || 0;
            break;
          }
        }
        // Apply refund ratio if ticket was refunded
        var ticket = tickets.find(function(tk) { return tk.id === item.ticket_id; });
        if (ticket && ticket.refund_cents > 0 && ticket.subtotal_cents > 0) {
          var ratio = Math.min(ticket.refund_cents / ticket.subtotal_cents, 1);
          priceCents = Math.round(priceCents * (1 - ratio));
        }
        commissionCents += Math.round(priceCents * pct / 100);
      });
    } else {
      commissionCents = Math.round(commissionRevenue * (s.commission_pct / 100));
    }

    // Hourly calculation (for hourly staff)
    var hourlyPay = 0;
    var totalMinutes = 0;
    if (s.pay_type === 'hourly' && s.hourly_rate_cents) {
      // Get this staff's punches sorted by time
      var punchList = punches.filter(function(p) { return p.staff_id === s.id; })
        .sort(function(a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); });

      // Pair sequential in→out punches to calculate worked segments
      for (var pi = 0; pi < punchList.length - 1; pi++) {
        if (punchList[pi].type === 'in' && punchList[pi + 1].type === 'out') {
          totalMinutes += (punchList[pi + 1].timestamp.getTime() - punchList[pi].timestamp.getTime()) / 60000;
        }
      }

      hourlyPay = Math.round((totalMinutes / 60) * s.hourly_rate_cents);
    }

    // Daily guarantee check
    var guaranteePay = 0;
    if (s.daily_guarantee_cents > 0) {
      // Count distinct working days in period
      var workDays = new Set();
      var techTickets = tickets.filter(function(t) {
        return t.items.some(function(item) { return item.tech_id === s.id; });
      });
      techTickets.forEach(function(t) {
        workDays.add(t.created_at.toISOString().split('T')[0]);
      });
      guaranteePay = workDays.size * s.daily_guarantee_cents;
    }

    // Determine gross pay based on pay type
    var grossCents = 0;
    if (s.pay_type === 'commission') {
      grossCents = Math.max(commissionCents, guaranteePay);
    } else if (s.pay_type === 'hourly') {
      grossCents = hourlyPay + commissionCents; // hourly + optional commission
      grossCents = Math.max(grossCents, guaranteePay);
    } else if (s.pay_type === 'salary') {
      grossCents = s.salary_amount_cents || 0;
      grossCents += commissionCents; // salary + optional commission
    }

    // Payout split
    var checkCents = Math.round(grossCents * (s.payout_check_pct / 100));
    var bonusCents = grossCents - checkCents;

    return {
      id: 'pc-' + s.id,
      staff_id: s.id,
      staff_name: s.display_name,
      pay_type: s.pay_type,
      service_revenue_cents: serviceRevenue,
      commission_pct: s.commission_pct,
      commission_cents: commissionCents,
      hourly_rate_cents: s.hourly_rate_cents || 0,
      hours_worked: Math.round(totalMinutes / 6) / 10, // 1 decimal
      hourly_pay_cents: hourlyPay,
      guarantee_cents: guaranteePay,
      gross_cents: grossCents,
      check_cents: checkCents,
      bonus_cents: bonusCents,
      ticket_count: techItems.length,
    };
  });

  return {
    period_start: periodStart,
    period_end: periodEnd,
    status: 'draft',
    paychecks: paychecks,
    total_gross_cents: paychecks.reduce(function(s, p) { return s + p.gross_cents; }, 0),
    total_check_cents: paychecks.reduce(function(s, p) { return s + p.check_cents; }, 0),
    total_bonus_cents: paychecks.reduce(function(s, p) { return s + p.bonus_cents; }, 0),
  };
}

// ── GET /runs — List recent payroll runs ──
// For now, returns empty until runs are created via POST
// In the future, PayrollRun model will store persisted runs
router.get('/runs', async function(req, res, next) {
  try {
    // No PayrollRun table yet — return empty array
    // The frontend falls back to mock data when this returns empty
    res.json({ runs: [] });
  } catch (err) { next(err); }
});

// ── GET /runs/:id — Get a specific payroll run (by encoded period) ──
// Since we don't persist runs yet, :id is "start_end" format
// e.g., /runs/2026-03-01_2026-03-15
router.get('/runs/:id', async function(req, res, next) {
  try {
    var parts = req.params.id.split('_');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Invalid run ID. Use format: YYYY-MM-DD_YYYY-MM-DD' });
    }

    var run = await computePayroll(req.salon_id, parts[0], parts[1]);
    run.id = req.params.id;
    res.json({ run: run });
  } catch (err) { next(err); }
});

// ── POST /runs — Create (compute) a payroll run ──
// Body: { period_start: 'YYYY-MM-DD', period_end: 'YYYY-MM-DD' }
router.post('/runs', async function(req, res, next) {
  try {
    var d = req.body;
    if (!d.period_start || !d.period_end) {
      return res.status(400).json({ error: 'period_start and period_end are required' });
    }

    var run = await computePayroll(req.salon_id, d.period_start, d.period_end);
    run.id = d.period_start + '_' + d.period_end;
    run.created_at = new Date().toISOString();

    emit(req, 'payroll:created');
    res.status(201).json({ run: run });
  } catch (err) { next(err); }
});

// ── PUT /runs/:id — Update run status (approve, etc.) ──
router.put('/runs/:id', async function(req, res, next) {
  try {
    // Since runs aren't persisted yet, just acknowledge the status change
    var d = req.body;
    emit(req, 'payroll:updated');
    res.json({ run: { id: req.params.id, status: d.status || 'approved' } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// PAYCHECKS (individual adjustments)
// ════════════════════════════════════════════

// ── PUT /paychecks/:id — Update a paycheck (manual adjustments) ──
router.put('/paychecks/:id', async function(req, res, next) {
  try {
    // Since paychecks aren't persisted yet, acknowledge the update
    var d = req.body;
    emit(req, 'payroll:paycheck-updated');
    res.json({ paycheck: Object.assign({ id: req.params.id }, d) });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// COMMISSION RULES (payroll-scoped view)
// Points to the same CommissionRule table as commission.js
// This gives payroll a read/write view for convenience
// ════════════════════════════════════════════

// ── GET /commission-rules — List all commission rules ──
router.get('/commission-rules', async function(req, res, next) {
  try {
    var rules = await prisma.commissionRule.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { created_at: 'asc' }
    });
    res.json({ rules: rules });
  } catch (err) { next(err); }
});

// ── POST /commission-rules — Create commission rule ──
router.post('/commission-rules', async function(req, res, next) {
  try {
    var d = req.body;
    var rule = await prisma.commissionRule.create({
      data: {
        salon_id: req.salon_id,
        staff_id: d.staff_id || null,
        applies_to: d.applies_to || 'service',
        scope: d.scope || 'flat',
        category_id: d.category_id || null,
        service_catalog_id: d.service_catalog_id || null,
        product_id: d.product_id || null,
        percentage: d.percentage || 0,
      }
    });
    emit(req, 'commission:updated');
    res.status(201).json({ rule: rule });
  } catch (err) { next(err); }
});

// ── PUT /commission-rules/:id — Update commission rule ──
router.put('/commission-rules/:id', async function(req, res, next) {
  try {
    var existing = await prisma.commissionRule.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['staff_id', 'applies_to', 'scope', 'category_id',
      'service_catalog_id', 'product_id', 'percentage'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    var rule = await prisma.commissionRule.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'commission:updated');
    res.json({ rule: rule });
  } catch (err) { next(err); }
});

export default router;
