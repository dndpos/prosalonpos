/**
 * ProSalonPOS — Reports Routes
 * Computed reports from tickets, appointments, and staff data.
 * All endpoints require JWT authentication.
 *
 * Store expects:
 *   GET /daily-summary        → { summary: {...} }
 *   GET /sales                → { sales: [...] }
 *   GET /staff-performance    → { staff: [...] }
 *   GET /service-breakdown    → { services: [...] }
 *   GET /payment-methods      → { methods: [...] }
 *   GET /tips                 → { tips: [...] }
 *
 * All endpoints accept ?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Default: today only
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';

// SQLite stores JSON as strings — parse on read
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

var router = Router();

/**
 * Parse date range from query params.
 * Returns { startDate, endDate } as Date objects.
 */
function parseDateRange(query) {
  var startStr = query.start || new Date().toISOString().split('T')[0];
  var endStr = query.end || startStr;
  return {
    startDate: new Date(startStr + 'T00:00:00.000Z'),
    endDate: new Date(endStr + 'T23:59:59.999Z'),
  };
}

// ── GET /daily-summary — Overview numbers for a date range ──
router.get('/daily-summary', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    // Tickets in range (paid + refunded, not voided)
    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
      },
      include: { items: true, payments: true }
    });

    var totalRevenue = 0;
    var totalTax = 0;
    var totalTips = 0;
    var totalDiscount = 0;
    var totalRefunds = 0;
    var serviceCount = 0;
    var productCount = 0;

    tickets.forEach(function(t) {
      totalRevenue += t.subtotal_cents;
      totalTax += t.tax_cents;
      totalTips += t.tip_cents;
      totalDiscount += t.discount_cents;
      totalRefunds += t.refund_cents;
      t.items.forEach(function(item) {
        if (item.type === 'service') serviceCount++;
        else if (item.type === 'product') productCount++;
      });
    });

    // Appointments in range
    var apptCount = await prisma.appointment.count({
      where: {
        salon_id: req.salon_id,
        created_at: { gte: range.startDate, lte: range.endDate },
      }
    });

    // New clients in range
    var newClients = await prisma.client.count({
      where: {
        salon_id: req.salon_id,
        created_at: { gte: range.startDate, lte: range.endDate },
      }
    });

    var summary = {
      period_start: req.query.start || new Date().toISOString().split('T')[0],
      period_end: req.query.end || req.query.start || new Date().toISOString().split('T')[0],
      ticket_count: tickets.length,
      total_revenue_cents: totalRevenue,
      total_tax_cents: totalTax,
      total_tips_cents: totalTips,
      total_discount_cents: totalDiscount,
      total_refund_cents: totalRefunds,
      net_revenue_cents: totalRevenue - totalRefunds,
      service_count: serviceCount,
      product_count: productCount,
      appointment_count: apptCount,
      new_client_count: newClients,
      avg_ticket_cents: tickets.length > 0 ? Math.round(totalRevenue / tickets.length) : 0,
    };

    res.json({ summary: summary });
  } catch (err) { next(err); }
});

// ── GET /sales — Daily sales breakdown ──
router.get('/sales', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
      },
      orderBy: { created_at: 'asc' }
    });

    // Group by date
    var byDate = {};
    tickets.forEach(function(t) {
      var date = t.created_at.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { date: date, ticket_count: 0, revenue_cents: 0, tax_cents: 0, tip_cents: 0, discount_cents: 0, refund_cents: 0 };
      }
      byDate[date].ticket_count++;
      byDate[date].revenue_cents += t.subtotal_cents;
      byDate[date].tax_cents += t.tax_cents;
      byDate[date].tip_cents += t.tip_cents;
      byDate[date].discount_cents += t.discount_cents;
      byDate[date].refund_cents += t.refund_cents;
    });

    var sales = Object.values(byDate).sort(function(a, b) {
      return a.date.localeCompare(b.date);
    });

    res.json({ sales: sales });
  } catch (err) { next(err); }
});

// ── GET /staff-performance — Revenue and ticket count per tech ──
router.get('/staff-performance', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
      },
      include: { items: true }
    });

    // Get salon staff for names
    var allStaff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id },
      select: { id: true, display_name: true }
    });
    var staffMap = {};
    allStaff.forEach(function(s) { staffMap[s.id] = s.display_name; });

    // Aggregate by tech
    var byTech = {};
    tickets.forEach(function(t) {
      t.items.forEach(function(item) {
        if (!item.tech_id) return;
        if (!byTech[item.tech_id]) {
          byTech[item.tech_id] = {
            staff_id: item.tech_id,
            staff_name: staffMap[item.tech_id] || item.tech_name || 'Unknown',
            service_revenue_cents: 0,
            product_revenue_cents: 0,
            total_revenue_cents: 0,
            service_count: 0,
            product_count: 0,
            ticket_count: 0,
          };
        }
        var entry = byTech[item.tech_id];
        if (item.type === 'service') {
          entry.service_revenue_cents += item.price_cents;
          entry.service_count++;
        } else if (item.type === 'product') {
          entry.product_revenue_cents += item.price_cents;
          entry.product_count++;
        }
        entry.total_revenue_cents += item.price_cents;
      });

      // Count unique tickets per tech
      var techIds = new Set();
      t.items.forEach(function(item) {
        if (item.tech_id) techIds.add(item.tech_id);
      });
      techIds.forEach(function(tid) {
        if (byTech[tid]) byTech[tid].ticket_count++;
      });
    });

    var staff = Object.values(byTech).sort(function(a, b) {
      return b.total_revenue_cents - a.total_revenue_cents;
    });

    res.json({ staff: staff });
  } catch (err) { next(err); }
});

// ── GET /service-breakdown — Revenue by service ──
router.get('/service-breakdown', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
      },
      include: { items: true }
    });

    // Aggregate by service name
    var byService = {};
    tickets.forEach(function(t) {
      t.items.forEach(function(item) {
        if (item.type !== 'service') return;
        var key = item.service_id || item.name;
        if (!byService[key]) {
          byService[key] = {
            service_id: item.service_id,
            service_name: item.name,
            count: 0,
            revenue_cents: 0,
            avg_price_cents: 0,
          };
        }
        byService[key].count++;
        byService[key].revenue_cents += item.price_cents;
      });
    });

    var services = Object.values(byService);
    services.forEach(function(s) {
      s.avg_price_cents = s.count > 0 ? Math.round(s.revenue_cents / s.count) : 0;
    });
    services.sort(function(a, b) { return b.revenue_cents - a.revenue_cents; });

    res.json({ services: services });
  } catch (err) { next(err); }
});

// ── GET /payment-methods — Breakdown by payment method ──
router.get('/payment-methods', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
      },
      include: { payments: true }
    });

    // Aggregate by payment method
    var byMethod = {};
    tickets.forEach(function(t) {
      t.payments.forEach(function(p) {
        if (!byMethod[p.method]) {
          byMethod[p.method] = { method: p.method, count: 0, total_cents: 0 };
        }
        byMethod[p.method].count++;
        byMethod[p.method].total_cents += p.amount_cents;
      });
    });

    var methods = Object.values(byMethod).sort(function(a, b) {
      return b.total_cents - a.total_cents;
    });

    res.json({ methods: methods });
  } catch (err) { next(err); }
});

// ── GET /tips — Tips breakdown by tech ──
router.get('/tips', async function(req, res, next) {
  try {
    var range = parseDateRange(req.query);

    var tickets = await prisma.ticket.findMany({
      where: {
        salon_id: req.salon_id,
        status: { in: ['paid', 'refunded'] },
        created_at: { gte: range.startDate, lte: range.endDate },
        tip_cents: { gt: 0 },
      },
      select: {
        id: true,
        tip_cents: true,
        tip_distributions: true,
        created_at: true,
      }
    });

    // Get staff for names
    var allStaff = await prisma.staff.findMany({
      where: { salon_id: req.salon_id },
      select: { id: true, display_name: true }
    });
    var staffMap = {};
    allStaff.forEach(function(s) { staffMap[s.id] = s.display_name; });

    // Aggregate tips by tech using tip_distributions
    var byTech = {};
    var undistributed = 0;

    tickets.forEach(function(t) {
      var dists = fromDb(t.tip_distributions);
      if (dists && Array.isArray(dists) && dists.length > 0) {
        dists.forEach(function(d) {
          var sid = d.staff_id;
          if (!byTech[sid]) {
            byTech[sid] = {
              staff_id: sid,
              staff_name: staffMap[sid] || d.staff_name || 'Unknown',
              tip_total_cents: 0,
              ticket_count: 0,
            };
          }
          byTech[sid].tip_total_cents += d.amount_cents || 0;
          byTech[sid].ticket_count++;
        });
      } else {
        // No distribution — count as undistributed
        undistributed += t.tip_cents;
      }
    });

    var tips = Object.values(byTech).sort(function(a, b) {
      return b.tip_total_cents - a.tip_total_cents;
    });

    // Add averages
    tips.forEach(function(t) {
      t.avg_tip_cents = t.ticket_count > 0 ? Math.round(t.tip_total_cents / t.ticket_count) : 0;
    });

    res.json({
      tips: tips,
      total_tips_cents: tickets.reduce(function(s, t) { return s + t.tip_cents; }, 0),
      undistributed_cents: undistributed,
    });
  } catch (err) { next(err); }
});

export default router;
