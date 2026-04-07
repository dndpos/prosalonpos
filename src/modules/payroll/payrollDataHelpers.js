/**
 * payrollDataHelpers.js — Session 85
 * Reshapes ticketStore closed tickets into the payroll format.
 * Calculates hours worked from clock punches and tips from tickets.
 * Extracted from PayrollModule.jsx to stay under 800-line limit.
 */

// Reshape a closed ticket from ticketStore into payroll ticket format.
// CRITICAL: A single ticket can have multiple techs (multi-tech ticket).
// We must split into one payroll entry per tech so each tech gets credit
// for only their services. Tips are split proportionally by service amount.
export function reshapeTicketForPayroll(t) {
  var items = t.items || t.lineItems || [];

  // Date from closedAt or created_at
  var dateStr = '';
  var ts = t.closedAt || t.created_at;
  if (ts) {
    var d = new Date(ts);
    if (!isNaN(d.getTime())) dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var isVoided = t.status === 'voided';
  var totalTip = t.tipCents || t.tip_cents || 0;

  // Build set of refunded item IDs — these are excluded from commission (like voided)
  var refundedItemIds = t.refundedItemIds || {};

  // Group service items by tech (exclude refunded items)
  var techGroups = {};
  items.forEach(function(it) {
    if (it.type !== 'service') return;
    if (refundedItemIds[it.id]) return; // skip refunded items — no commission
    var tid = it.techId || it.tech_id || t.createdBy || t.closedBy || '';
    if (!techGroups[tid]) techGroups[tid] = [];
    techGroups[tid].push(it);
  });

  var techIds = Object.keys(techGroups);

  // If no services or single tech, return one entry (original behavior)
  if (techIds.length <= 1) {
    var staffId = techIds[0] || t.createdBy || t.closedBy || '';
    var services = items.filter(function(it) { return it.type === 'service'; }).map(function(it) {
      return { name: it.name, price_cents: it.price_cents || 0, discount_cents: it.discount_cents || 0, service_catalog_id: it.service_id || it.serviceCatalogId || it.id, category_ids: it.category_ids || [] };
    });
    var products = items.filter(function(it) { return it.type === 'retail'; }).map(function(it) {
      return { product_id: it.product_id || it.id, name: it.name, price_cents: it.price_cents || 0, category_ids: [] };
    });
    return [{
      id: t.id,
      staff_id: staffId,
      date: dateStr,
      voided: isVoided,
      services: services,
      products: products,
      tip_cents: totalTip,
    }];
  }

  // Multi-tech ticket — split into one entry per tech
  // Calculate total service amount for proportional tip split
  var totalSvcCents = items.filter(function(it) { return it.type === 'service'; }).reduce(function(s, it) { return s + (it.price_cents || 0); }, 0);

  // Products go to the first tech (or createdBy)
  var allProducts = items.filter(function(it) { return it.type === 'retail'; });

  return techIds.map(function(tid, idx) {
    var techServices = techGroups[tid].map(function(it) {
      return { name: it.name, price_cents: it.price_cents || 0, discount_cents: it.discount_cents || 0, service_catalog_id: it.service_id || it.serviceCatalogId || it.id, category_ids: it.category_ids || [] };
    });
    var techSvcTotal = techServices.reduce(function(s, sv) { return s + sv.price_cents; }, 0);
    // Tip split proportional to service amount
    var tipShare = totalSvcCents > 0 ? Math.round(totalTip * techSvcTotal / totalSvcCents) : 0;
    // Products only for first tech
    var techProducts = idx === 0 ? allProducts.map(function(it) {
      return { product_id: it.product_id || it.id, name: it.name, price_cents: it.price_cents || 0, category_ids: [] };
    }) : [];

    return {
      id: t.id + '_tech_' + tid,
      staff_id: tid,
      date: dateStr,
      voided: isVoided,
      services: techServices,
      products: techProducts,
      tip_cents: tipShare,
    };
  });
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

// ── Pay Period Calculation ──
// Computes the current pay period date range based on frequency and start day settings.

// Format date as YYYY-MM-DD
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Convert day name to JS day number (0=Sun, 1=Mon, ..., 6=Sat)
function dayNameToNum(name) {
  var map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  return map[(name || 'monday').toLowerCase()] || 1;
}

// Calculate the current pay period { start, end } based on frequency and start day.
// freq: 'weekly' | 'biweekly' | 'bimonthly'
// startDayName: 'monday' | 'tuesday' | ... | 'sunday' (ignored for bimonthly)
export function getCurrentPayPeriod(freq, startDayName) {
  var today = new Date();
  var todayDay = today.getDay(); // 0=Sun ... 6=Sat
  var startDayNum = dayNameToNum(startDayName);

  if (freq === 'bimonthly') {
    // Fixed: 1st-15th or 16th-end of month
    var dayOfMonth = today.getDate();
    var yr = today.getFullYear();
    var mo = today.getMonth();
    if (dayOfMonth <= 15) {
      return { start: ymd(new Date(yr, mo, 1)), end: ymd(new Date(yr, mo, 15)) };
    } else {
      var lastDay = new Date(yr, mo + 1, 0).getDate();
      return { start: ymd(new Date(yr, mo, 16)), end: ymd(new Date(yr, mo, lastDay)) };
    }
  }

  // Weekly or biweekly — find the most recent start day
  var diff = (todayDay - startDayNum + 7) % 7; // days since last start day
  var periodStartDate = new Date(today);
  periodStartDate.setDate(today.getDate() - diff);

  if (freq === 'weekly') {
    var periodEndDate = new Date(periodStartDate);
    periodEndDate.setDate(periodStartDate.getDate() + 6);
    return { start: ymd(periodStartDate), end: ymd(periodEndDate) };
  }

  // Biweekly — need an anchor to know which week we're in
  // Anchor: Jan 1, 2024 was a Monday. Count weeks from there.
  var anchor = new Date(2024, 0, 1);
  var msPerDay = 86400000;
  var daysSinceAnchor = Math.floor((periodStartDate.getTime() - anchor.getTime()) / msPerDay);
  var weeksSinceAnchor = Math.floor(daysSinceAnchor / 7);
  // If odd number of weeks since anchor, we're in week 2 — go back 7 days to get period start
  if (weeksSinceAnchor % 2 !== 0) {
    periodStartDate.setDate(periodStartDate.getDate() - 7);
  }
  var biweekEnd = new Date(periodStartDate);
  biweekEnd.setDate(periodStartDate.getDate() + 13);
  return { start: ymd(periodStartDate), end: ymd(biweekEnd) };
}

/**
 * Step to previous or next pay period from a given period.
 * dir: -1 for previous, +1 for next
 */
export function stepPayPeriod(currentStart, currentEnd, freq, startDayName, dir) {
  var s = new Date(currentStart + 'T12:00:00');
  var e = new Date(currentEnd + 'T12:00:00');

  if (freq === 'bimonthly') {
    var dayOfMonth = s.getDate();
    var yr = s.getFullYear();
    var mo = s.getMonth();
    if (dayOfMonth <= 15) {
      // Currently in 1st-15th
      if (dir === -1) {
        // Go to previous month 16th-end
        var prevMo = mo - 1; var prevYr = yr;
        if (prevMo < 0) { prevMo = 11; prevYr--; }
        var lastDay = new Date(prevYr, prevMo + 1, 0).getDate();
        return { start: ymd(new Date(prevYr, prevMo, 16)), end: ymd(new Date(prevYr, prevMo, lastDay)) };
      } else {
        // Go to same month 16th-end
        var lastDay2 = new Date(yr, mo + 1, 0).getDate();
        return { start: ymd(new Date(yr, mo, 16)), end: ymd(new Date(yr, mo, lastDay2)) };
      }
    } else {
      // Currently in 16th-end
      if (dir === -1) {
        // Go to same month 1st-15th
        return { start: ymd(new Date(yr, mo, 1)), end: ymd(new Date(yr, mo, 15)) };
      } else {
        // Go to next month 1st-15th
        var nextMo = mo + 1; var nextYr = yr;
        if (nextMo > 11) { nextMo = 0; nextYr++; }
        return { start: ymd(new Date(nextYr, nextMo, 1)), end: ymd(new Date(nextYr, nextMo, 15)) };
      }
    }
  }

  // Weekly or biweekly — step by period length in days
  var periodDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  var newStart = new Date(s);
  newStart.setDate(s.getDate() + (dir * periodDays));
  var newEnd = new Date(newStart);
  newEnd.setDate(newStart.getDate() + periodDays - 1);
  return { start: ymd(newStart), end: ymd(newEnd) };
}
