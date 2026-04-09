import { calculateCommission, calculateSimpleCommission } from '../../lib/commissionEngine';

/**
 * Payroll Calculation Engine — extracted from PayrollModule.jsx (Session 109)
 *
 * Commission calculation uses the full rules engine (Session 14 + Session 27):
 *   - Resolution priority: per-tech per-item > per-tech per-category > per-tech flat >
 *     location per-item > location per-category > location flat.
 *   - Tiered revenue thresholds replace flat rate when enabled.
 *   - Retail commission only when retail_commission_enabled is ON (default OFF).
 *   - Falls back to legacy staff.commission_pct when no rules are configured.
 *
 * Three pay types:
 *   Commission — earns commission via rules engine. Daily guarantee compares, tech gets higher.
 *   Hourly — hourly_rate × hours. If commission_bonus_enabled, also earns commission on top (stacked).
 *   Salary — flat salary. If commission_bonus_enabled, also earns commission on top (stacked).
 *
 * Check/bonus split is purely reporting — labels on total earnings, doesn't change what they earn.
 */

export function calculatePaycheck(staff, tickets, hours, cardTips, salonSettings, commissionRules, commissionTiers, services, allPunches) {
  // Get this tech's tickets (exclude voided)
  var techTickets = tickets.filter(function(t) { return t.staff_id === staff.id && !t.voided; });

  // ── Min daily hours for commission gating ──
  // If salon has min_daily_hours_for_commission set, filter out tickets from days
  // where this tech's punch hours are below the threshold.
  var minDailyHrs = parseFloat(salonSettings.min_daily_hours_for_commission) || 0;
  var disqualifiedDays = {};
  if (minDailyHrs > 0 && allPunches && allPunches.length > 0) {
    // Build daily punch hours for this tech
    var techPunches = allPunches.filter(function(p) { return p.staff_id === staff.id; });
    var punchDayMap = {};
    techPunches.forEach(function(p) {
      var ts = typeof p.timestamp === 'number' ? p.timestamp : new Date(p.timestamp).getTime();
      var d = new Date(ts);
      var dayKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      if (!punchDayMap[dayKey]) punchDayMap[dayKey] = [];
      punchDayMap[dayKey].push(p);
    });
    // Check each day
    Object.keys(punchDayMap).forEach(function(dayKey) {
      var dayPunches = punchDayMap[dayKey].sort(function(a, b) {
        var ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
        var tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
        return ta - tb;
      });
      var dayMins = 0;
      for (var i = 0; i < dayPunches.length - 1; i++) {
        if (dayPunches[i].type === 'in' && dayPunches[i + 1].type === 'out') {
          var tIn = typeof dayPunches[i].timestamp === 'number' ? dayPunches[i].timestamp : new Date(dayPunches[i].timestamp).getTime();
          var tOut = typeof dayPunches[i + 1].timestamp === 'number' ? dayPunches[i + 1].timestamp : new Date(dayPunches[i + 1].timestamp).getTime();
          dayMins += (tOut - tIn) / 60000;
        }
      }
      var dayHrs = dayMins / 60;
      if (dayHrs < minDailyHrs) {
        // Map the dayKey back to the YYYY-MM-DD format tickets use
        var parts = dayKey.split('-');
        var normKey = parts[0] + '-' + (parts[1].length === 1 ? '0' + parts[1] : parts[1]) + '-' + (parts[2].length === 1 ? '0' + parts[2] : parts[2]);
        disqualifiedDays[normKey] = true;
        disqualifiedDays[dayKey] = true; // both formats just in case
      }
    });
  }

  // Tickets eligible for commission (after min daily hours filter)
  var commissionTickets = minDailyHrs > 0 ? techTickets.filter(function(t) {
    return !disqualifiedDays[t.date];
  }) : techTickets;

  // Gross sales = sum of all service prices
  var grossSales = 0;
  techTickets.forEach(function(t) {
    (t.services || []).forEach(function(s) { grossSales += s.price_cents; });
  });

  // Days worked (unique dates with tickets)
  var workedDates = {};
  techTickets.forEach(function(t) { if (t.date) workedDates[t.date] = true; });
  var daysWorked = Object.keys(workedDates).length;

  // ── Calculate earnings by type ──
  var hourlyEarnings = 0;
  var salaryEarnings = 0;
  var serviceCommission = 0;
  var productCommission = 0;
  var guaranteeApplied = false;
  var guaranteeAmount = 0;

  // Build service lines for commission engine
  // Session 75: product cost deducted BEFORE commission calculation.
  // Session 30: discount_reduces_commission toggle controls which price goes to commission.
  // OFF (default): commission on full price_cents (discount ignored).
  // ON: commission on (price_cents - discount_cents).
  var discountReduces = !!salonSettings.discount_reduces_commission;
  var totalDiscounts = 0;

  // ── Product cost deductions (calculated first, before commission) ──
  // Look up product_cost_cents from service catalog by name match.
  // Session 75: deducted from service price BEFORE commission is calculated.
  var productDeductions = 0;
  techTickets.forEach(function(t) {
    (t.services || []).forEach(function(s) {
      var catalogEntry = services.find(function(cs) { return cs.name === s.name; });
      if (catalogEntry && catalogEntry.product_cost_cents > 0) {
        productDeductions += catalogEntry.product_cost_cents;
      }
    });
  });

  var serviceLines = [];
  commissionTickets.forEach(function(t) {
    (t.services || []).forEach(function(s) {
      var disc = s.discount_cents || 0;
      totalDiscounts += disc;
      var catalogEntry = services.find(function(cs) { return cs.name === s.name; });
      var prodCost = (catalogEntry && catalogEntry.product_cost_cents > 0) ? catalogEntry.product_cost_cents : 0;
      var commissionablePrice = discountReduces ? (s.price_cents - disc) : s.price_cents;
      commissionablePrice = commissionablePrice - prodCost;
      if (commissionablePrice < 0) commissionablePrice = 0;
      serviceLines.push({
        service_catalog_id: s.service_catalog_id || s.id,
        name: s.name,
        price_cents: commissionablePrice,
        category_ids: s.category_ids,
      });
    });
  });

  // Build product sales for retail commission
  var productSales = [];
  commissionTickets.forEach(function(t) {
    (t.products || []).forEach(function(p) {
      productSales.push({
        product_id: p.product_id || p.id,
        price_cents: p.price_cents,
        category_ids: p.category_ids || [],
      });
    });
  });

  // Use commission rules engine if rules exist, otherwise fall back to legacy flat rate
  var useEngine = commissionRules.length > 0 && salonSettings.commission_enabled;

  // Advanced commission: per-category rates on staff profile override flat commission_pct.
  // When advanced_commission_enabled is ON, look up each service's category in the
  // staff's category_commission_rates map. If a rate is set for that category, use it;
  // otherwise fall back to the flat commission_pct. This is separate from the full
  // commission rules engine (which uses CommissionRule records).
  var advCommEnabled = !!salonSettings.advanced_commission_enabled;
  var staffCatRates = (staff.category_commission_rates && typeof staff.category_commission_rates === 'object') ? staff.category_commission_rates : {};

  // Helper: calculate commission using per-category rates from staff profile
  function calculateAdvancedCategoryCommission() {
    var total = 0;
    serviceLines.forEach(function(sl) {
      // Look up category from service catalog
      var catIds = sl.category_ids;
      if (!catIds || catIds.length === 0) {
        // Try ID match first, fall back to name match for older tickets with null service_id
        var svc = sl.service_catalog_id ? services.find(function(s) { return s.id === sl.service_catalog_id; }) : null;
        if (!svc && sl.name) {
          svc = services.find(function(s) { return s.name === sl.name; });
        }
        catIds = svc ? (svc.category_ids || []) : [];
      }
      // Find the first matching category rate from staff profile
      var pct = staff.commission_pct || 0; // default to flat rate
      for (var ci = 0; ci < catIds.length; ci++) {
        if (staffCatRates[catIds[ci]] !== undefined && staffCatRates[catIds[ci]] !== '') {
          pct = parseInt(staffCatRates[catIds[ci]], 10) || 0;
          break;
        }
      }
      total += Math.round(sl.price_cents * pct / 100);
    });
    return total;
  }

  // Helper: run commission engine or fallback — returns { service, product } split
  function getCommissionSplit() {
    if (useEngine) {
      var result = calculateCommission({
        staff: staff, serviceLines: serviceLines, productSales: productSales,
        rules: commissionRules, tiers: commissionTiers,
        settings: salonSettings, services: services,
      });
      return { service: result.service_commission, product: result.retail_commission };
    }
    // Advanced commission: per-category rates from staff profile
    if (advCommEnabled && Object.keys(staffCatRates).length > 0) {
      return { service: calculateAdvancedCategoryCommission(), product: 0 };
    }
    return { service: calculateSimpleCommission(grossSales, staff.commission_pct), product: 0 };
  }

  // Retail product commission — simple flat % from salon settings (Session 30)
  // This is separate from the rules engine retail commission.
  // retail_commission_pct: 0 = techs earn nothing, 10 = techs get 10% of retail sold.
  var retailCommPct = salonSettings.retail_commission_pct || 0;
  var totalRetailSales = 0;
  productSales.forEach(function(p) { totalRetailSales += p.price_cents; });

  if (staff.pay_type === 'commission') {
    var split = getCommissionSplit();
    serviceCommission = split.service;
    // Use simple retail_commission_pct for product commission (Session 30)
    productCommission = retailCommPct > 0 ? Math.round(totalRetailSales * retailCommPct / 100) : 0;
    var totalCommForGuarantee = serviceCommission + productCommission;
    if (staff.daily_guarantee_cents > 0) {
      guaranteeAmount = daysWorked * staff.daily_guarantee_cents;
      if (guaranteeAmount > totalCommForGuarantee) {
        guaranteeApplied = true;
        serviceCommission = guaranteeAmount;
        productCommission = 0;
      }
    }
  } else if (staff.pay_type === 'hourly') {
    hourlyEarnings = Math.round(hours * (staff.hourly_rate_cents || 0));
    if (staff.commission_bonus_enabled) {
      var split2 = getCommissionSplit();
      serviceCommission = split2.service;
      productCommission = retailCommPct > 0 ? Math.round(totalRetailSales * retailCommPct / 100) : 0;
    }
  } else if (staff.pay_type === 'salary') {
    salaryEarnings = staff.salary_amount_cents || 0;
    if (staff.commission_bonus_enabled) {
      var split3 = getCommissionSplit();
      serviceCommission = split3.service;
      productCommission = retailCommPct > 0 ? Math.round(totalRetailSales * retailCommPct / 100) : 0;
    }
  }

  // Total earnings (product cost already deducted before commission calculation)
  // Session 75: commission is on (sales - product cost), so no separate deduction from pay
  var totalEarnings = hourlyEarnings + salaryEarnings + serviceCommission + productCommission + cardTips;

  // Net pay = total earnings (product cost already factored into commission base)
  var netPay = totalEarnings;

  // Check / bonus split — purely reporting labels on net pay (after product deductions)
  var checkPct = staff.payout_check_pct || 100;
  var bonusPct = staff.payout_bonus_pct || 0;
  var checkAmount = Math.round(netPay * checkPct / 100);
  var bonusAmount = netPay - checkAmount;

  // Build daily breakdown
  var dailyMap = {};
  techTickets.forEach(function(t) {
    if (!dailyMap[t.date]) dailyMap[t.date] = { date: t.date, sales: 0, services: 0, tips: 0 };
    (t.services || []).forEach(function(s) { dailyMap[t.date].sales += s.price_cents; dailyMap[t.date].services++; });
    dailyMap[t.date].tips += t.tip_cents || 0;
  });
  var daily = Object.values(dailyMap).sort(function(a, b) { return a.date < b.date ? -1 : 1; });

  return {
    staff_id: staff.id,
    name: staff.display_name,
    pay_type: staff.pay_type,
    commission_bonus_enabled: !!staff.commission_bonus_enabled,
    commission_pct: staff.commission_pct || 0,
    gross_sales: grossSales,
    retail_sales: totalRetailSales,
    total_discounts: totalDiscounts,
    discount_reduces: discountReduces,
    days_worked: daysWorked,
    hours_worked: hours,
    hourly_earnings: hourlyEarnings,
    salary_earnings: salaryEarnings,
    service_commission: serviceCommission,
    product_commission: productCommission,
    commission_earnings: serviceCommission + productCommission,
    guarantee_applied: guaranteeApplied,
    guarantee_amount: guaranteeAmount,
    card_tips: cardTips,
    product_deductions: productDeductions,
    total_earnings: totalEarnings,
    net_pay: netPay,
    check_pct: checkPct,
    bonus_pct: bonusPct,
    check_amount: checkAmount,
    bonus_amount: bonusAmount,
    daily: daily,
    disqualified_days: Object.keys(disqualifiedDays),
    min_daily_hours: minDailyHrs,
  };
}
