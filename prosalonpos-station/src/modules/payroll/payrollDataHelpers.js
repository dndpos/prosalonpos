/**
 * payrollDataHelpers.js — Session 85
 * Reshapes ticketStore closed tickets into the payroll format.
 * Calculates hours worked from clock punches and tips from tickets.
 * Extracted from PayrollModule.jsx to stay under 800-line limit.
 */

// Reshape a closed ticket from ticketStore into payroll ticket format
export function reshapeTicketForPayroll(t) {
  var items = t.items || t.lineItems || [];
  var services = items.filter(function(it) { return it.type === 'service'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0, discount_cents: it.discount_cents || 0, service_catalog_id: it.serviceCatalogId || it.id, category_ids: it.category_ids || [] };
  });
  var products = items.filter(function(it) { return it.type === 'retail'; }).map(function(it) {
    return { product_id: it.id, name: it.name, price_cents: it.price_cents || 0, category_ids: [] };
  });
  // Determine staff_id from first service item or createdBy
  var firstSvc = items.find(function(it) { return it.type === 'service' && it.techId; });
  var staffId = firstSvc ? firstSvc.techId : (t.createdBy || t.closedBy || '');
  // Date from closedAt
  var dateStr = '';
  var ts = t.closedAt || t.created_at;
  if (ts) {
    var d = new Date(ts);
    if (!isNaN(d.getTime())) dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return {
    id: t.id,
    staff_id: staffId,
    date: dateStr,
    voided: t.status === 'voided',
    services: services,
    products: products,
    tip_cents: t.tipCents || t.tip_cents || 0,
  };
}

// Calculate hours worked per tech from clock punches
export function calculateHoursFromPunches(clockPunches) {
  var hours = {};
  if (!clockPunches || clockPunches.length === 0) return hours;
  // Group punches by staff_id, sort by timestamp
  var byStaff = {};
  clockPunches.forEach(function(p) {
    if (!byStaff[p.staff_id]) byStaff[p.staff_id] = [];
    byStaff[p.staff_id].push(p);
  });
  Object.keys(byStaff).forEach(function(sid) {
    var punches = byStaff[sid].sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    var totalMs = 0;
    for (var i = 0; i < punches.length - 1; i += 2) {
      if (punches[i].type === 'in' && punches[i + 1] && punches[i + 1].type === 'out') {
        totalMs += new Date(punches[i + 1].timestamp) - new Date(punches[i].timestamp);
      }
    }
    hours[sid] = Math.round(totalMs / 3600000 * 10) / 10; // round to 1 decimal
  });
  return hours;
}

// Calculate card tips per tech from payroll tickets
export function calculateTipsFromTickets(payrollTickets, periodStart, periodEnd) {
  var tips = {};
  payrollTickets.forEach(function(t) {
    if (t.voided) return;
    if (t.date < periodStart || t.date > periodEnd) return;
    if (!tips[t.staff_id]) tips[t.staff_id] = 0;
    tips[t.staff_id] += t.tip_cents || 0;
  });
  return tips;
}

// Reshape payroll runs into history format
export function reshapePayrollHistory(payrollRuns) {
  return payrollRuns.filter(function(r) { return r.status === 'completed' || r.status === 'approved'; }).map(function(r) {
    return {
      id: r.id,
      period_start: r.period_start,
      period_end: r.period_end,
      status: r.status,
      total_payout_cents: r.total_payout_cents || 0,
      tech_count: r.tech_count || 0,
      approved_date: r.approved_date || r.period_end,
    };
  });
}
