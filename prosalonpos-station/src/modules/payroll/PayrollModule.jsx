import { useTheme } from '../../lib/ThemeContext';
import { useState, useMemo, useEffect } from 'react';
import { useCommissionStore } from '../../lib/stores/commissionStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { usePayrollStore } from '../../lib/stores/payrollStore';
import { calculateCommission, calculateSimpleCommission } from '../../lib/commissionEngine';
import { amountToWords, formatCheckDate, printChecks, printTickets } from '../../lib/checkUtils';
import { FEATURES, isFeatureEnabled } from '../../lib/features';
import DebugLabel from '../../components/debug/DebugLabel';
import DateRangePicker from './PayrollDatePicker';
import CheckOverrideModal from './CheckOverrideModal';
import PayrollCheckConfirmModal from './PayrollCheckConfirmModal';
import TimeClockTimesheets from '../time-clock/TimeClockTimesheets';
import { fmt } from '../../lib/formatUtils';
import { reshapeTicketForPayroll, calculateHoursFromPunches, calculateTipsFromTickets, reshapePayrollHistory } from './payrollDataHelpers';

/**
 * Payroll Module — Module 11
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


function fmtShort(cents) { return '$' + Math.round(cents / 100).toLocaleString(); }

var AVATAR_COLORS = ['#1E3A5F', '#064E3B', '#7C2D12', '#4C1D95', '#831843'];
function getInitials(n) { return (n || '').split(' ').filter(function(w) { return w; }).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2); }
function Avatar({ name, size, index }) {
  var T = useTheme();
  size = size || 36; index = index || 0;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: AVATAR_COLORS[index % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text, fontSize: size < 34 ? 11 : 13, fontWeight: 500, flexShrink: 0 }}>{getInitials(name)}</div>
  );
}

var payTypeLabels = { commission: 'Commission', hourly: 'Hourly', salary: 'Salary' };
function payTypeDisplay(staff) {
  var base = payTypeLabels[staff.pay_type] || staff.pay_type;
  if ((staff.pay_type === 'hourly' || staff.pay_type === 'salary') && staff.commission_bonus_enabled) {
    return base + ' + Commission';
  }
  return base;
}

// ═══════════════════════════════════════════
// PAYCHECK CALCULATION — from staff profile
// ═══════════════════════════════════════════
function calculatePaycheck(staff, tickets, hours, cardTips, MOCK_SALON_SETTINGS, MOCK_COMMISSION_RULES, MOCK_COMMISSION_TIERS, MOCK_SERVICES) {
  // Get this tech's tickets (exclude voided)
  var techTickets = tickets.filter(function(t) { return t.staff_id === staff.id && !t.voided; });

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
  var discountReduces = !!MOCK_SALON_SETTINGS.discount_reduces_commission;
  var totalDiscounts = 0;

  // ── Product cost deductions (calculated first, before commission) ──
  // Look up product_cost_cents from service catalog by name match.
  // Session 75: deducted from service price BEFORE commission is calculated.
  var productDeductions = 0;
  techTickets.forEach(function(t) {
    (t.services || []).forEach(function(s) {
      var catalogEntry = MOCK_SERVICES.find(function(cs) { return cs.name === s.name; });
      if (catalogEntry && catalogEntry.product_cost_cents > 0) {
        productDeductions += catalogEntry.product_cost_cents;
      }
    });
  });

  var serviceLines = [];
  techTickets.forEach(function(t) {
    (t.services || []).forEach(function(s) {
      var disc = s.discount_cents || 0;
      totalDiscounts += disc;
      var catalogEntry = MOCK_SERVICES.find(function(cs) { return cs.name === s.name; });
      var prodCost = (catalogEntry && catalogEntry.product_cost_cents > 0) ? catalogEntry.product_cost_cents : 0;
      var commissionablePrice = discountReduces ? (s.price_cents - disc) : s.price_cents;
      commissionablePrice = commissionablePrice - prodCost;
      if (commissionablePrice < 0) commissionablePrice = 0;
      serviceLines.push({
        service_catalog_id: s.service_catalog_id || s.id,
        price_cents: commissionablePrice,
        category_ids: s.category_ids,
      });
    });
  });

  // Build product sales for retail commission
  var productSales = [];
  techTickets.forEach(function(t) {
    (t.products || []).forEach(function(p) {
      productSales.push({
        product_id: p.product_id || p.id,
        price_cents: p.price_cents,
        category_ids: p.category_ids || [],
      });
    });
  });

  // Use commission rules engine if rules exist, otherwise fall back to legacy flat rate
  var useEngine = MOCK_COMMISSION_RULES.length > 0 && MOCK_SALON_SETTINGS.commission_enabled;

  // Helper: run commission engine or fallback — returns { service, product } split
  function getCommissionSplit() {
    if (useEngine) {
      var result = calculateCommission({
        staff: staff, serviceLines: serviceLines, productSales: productSales,
        rules: MOCK_COMMISSION_RULES, tiers: MOCK_COMMISSION_TIERS,
        settings: MOCK_SALON_SETTINGS, services: MOCK_SERVICES,
      });
      return { service: result.service_commission, product: result.retail_commission };
    }
    return { service: calculateSimpleCommission(grossSales, staff.commission_pct), product: 0 };
  }

  // Retail product commission — simple flat % from salon settings (Session 30)
  // This is separate from the rules engine retail commission.
  // retail_commission_pct: 0 = techs earn nothing, 10 = techs get 10% of retail sold.
  var retailCommPct = MOCK_SALON_SETTINGS.retail_commission_pct || 0;
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
  };
}



// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════
export default function PayrollModule({ salonSettings, onNavigate, clockPunches, onAddPunch, onDeletePunch }) {
  var T = useTheme();
  var MOCK_STAFF = useStaffStore(function(s) { return s.staff; });
  var MOCK_SALON_SETTINGS = useSettingsStore(function(s) { return s.settings; });
  var showProdComm = !!MOCK_SALON_SETTINGS.retail_commission_enabled;
  var MOCK_SERVICES = useServiceStore(function(s) { return s.services; });
  var MOCK_COMMISSION_RULES = useCommissionStore(function(s) { return s.rules; });
  var MOCK_COMMISSION_TIERS = useCommissionStore(function(s) { return s.tiers; });

  // Real data from stores
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var payrollRuns = usePayrollStore(function(s) { return s.runs; });
  var fetchPayrollRuns = usePayrollStore(function(s) { return s.fetchRuns; });

  var statusColors = { draft: T.warning, review: T.primaryLight, completed: T.success };
  var [activeTab, setActiveTab] = useState('current');
  var [selectedId, setSelectedId] = useState(null);
  var [runStatus, setRunStatus] = useState('draft');

  // Default period: current biweekly (last 14 days ending yesterday)
  var _defaultPeriod = useMemo(function() {
    var today = new Date();
    var end = new Date(today); end.setDate(end.getDate() - 1);
    var start = new Date(end); start.setDate(start.getDate() - 13);
    function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    return { start: ymd(start), end: ymd(end) };
  }, []);

  var [periodStart, setPeriodStart] = useState(_defaultPeriod.start);
  var [periodEnd, setPeriodEnd] = useState(_defaultPeriod.end);
  var [showDatePicker, setShowDatePicker] = useState(false);
  var [pickStart, setPickStart] = useState(null);
  var [pickEnd, setPickEnd] = useState(null);
  var [leftMonth, setLeftMonth] = useState(null);
  var [rightMonth, setRightMonth] = useState(null);

  // Check printing state
  var [showCheckConfirm, setShowCheckConfirm] = useState(false);
  var [checkSelections, setCheckSelections] = useState({});
  var [checkOverrideStep, setCheckOverrideStep] = useState(null);

  // Fetch real data
  useEffect(function() {
    fetchTickets(periodStart, periodEnd);
    fetchPayrollRuns();
  }, [periodStart, periodEnd]);

  // ── Build payroll tickets from ticketStore ──
  var payrollTickets = useMemo(function() {
    return closedTickets.map(reshapeTicketForPayroll);
  }, [closedTickets]);

  // ── Calculate hours worked from clockPunches for each tech ──
  var hoursWorked = useMemo(function() {
    return calculateHoursFromPunches(clockPunches);
  }, [clockPunches]);

  // ── Calculate card tips from tickets per tech ──
  var cardTips = useMemo(function() {
    return calculateTipsFromTickets(payrollTickets, periodStart, periodEnd);
  }, [payrollTickets, periodStart, periodEnd]);

  // ── Payroll history from payrollStore ──
  var payrollHistory = useMemo(function() {
    return reshapePayrollHistory(payrollRuns);
  }, [payrollRuns]);

  function openDatePicker() {
    var s = new Date(periodStart + 'T00:00');
    var e = new Date(periodEnd + 'T00:00');
    setPickStart(periodStart);
    setPickEnd(periodEnd);
    setLeftMonth({ year: s.getFullYear(), month: s.getMonth() });
    setRightMonth({ year: e.getFullYear(), month: e.getMonth() });
    // If same month, bump right to next month
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      var nm = e.getMonth() + 1;
      var ny = e.getFullYear();
      if (nm > 11) { nm = 0; ny++; }
      setRightMonth({ year: ny, month: nm });
    }
    setShowDatePicker(true);
  }

  function fmtPeriodLabel(start, end) {
    var s = new Date(start + 'T00:00');
    var e = new Date(end + 'T00:00');
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Calculate all paychecks
  var paychecks = useMemo(function() {
    var techs = MOCK_STAFF.filter(function(s) { return s.role === 'technician' && s.active; });
    return techs.map(function(staff) {
      return calculatePaycheck(staff, payrollTickets, hoursWorked[staff.id] || 0, cardTips[staff.id] || 0, MOCK_SALON_SETTINGS, MOCK_COMMISSION_RULES, MOCK_COMMISSION_TIERS, MOCK_SERVICES);
    });
  }, [payrollTickets, hoursWorked, cardTips, MOCK_STAFF, MOCK_SALON_SETTINGS, MOCK_COMMISSION_RULES, MOCK_COMMISSION_TIERS, MOCK_SERVICES]);

  var totalPayout = paychecks.reduce(function(s, p) { return s + p.net_pay; }, 0);
  var totalSales = paychecks.reduce(function(s, p) { return s + p.gross_sales; }, 0);
  var totalSvcComm = paychecks.reduce(function(s, p) { return s + p.service_commission; }, 0);
  var totalProdComm = paychecks.reduce(function(s, p) { return s + p.product_commission; }, 0);
  var totalTips = paychecks.reduce(function(s, p) { return s + p.card_tips; }, 0);
  var totalProductDeductions = paychecks.reduce(function(s, p) { return s + p.product_deductions; }, 0);

  // Column visibility flags
  var anyServiceHasProductCost = MOCK_SERVICES.some(function(s) { return s.product_cost_cents > 0; });
  var showProdCostCol = anyServiceHasProductCost && totalProductDeductions > 0;
  var showProdCommCol = !!MOCK_SALON_SETTINGS.retail_commission_enabled;

  var selectedPaycheck = selectedId ? paychecks.find(function(p) { return p.staff_id === selectedId; }) : null;

  // ══════════════════════════════════
  // PAYCHECK DETAIL
  // ══════════════════════════════════
  var [expandedDay, setExpandedDay] = useState(null);

  if (selectedPaycheck) {
    var pc = selectedPaycheck;
    var staff = MOCK_STAFF.find(function(s) { return s.id === pc.staff_id; });

    // Get this tech's tickets grouped by date for drill-down
    var techTickets = payrollTickets.filter(function(t) { return t.staff_id === pc.staff_id && !t.voided; });

    var COL = { padding: '10px 16px', fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: T.text };
    var COLR = Object.assign({}, COL, { textAlign: 'right' });
    var HDR = { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
    var HDRR = Object.assign({}, HDR, { textAlign: 'right' });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif" }}>
        {/* Header */}
        <div style={{ height: 52, background: T.chromeDark, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, borderBottom: '1px solid ' + T.borderLight, flexShrink: 0 }}>
          <div onClick={function() { setSelectedId(null); setExpandedDay(null); }}
            style={{ padding: '8px 18px', background: T.primary, color: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          >← Back</div>
          <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>{pc.name}</span>
          <span style={{ color: T.text, fontSize: 13 }}>{payTypeDisplay(staff)}</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* Daily table */}
          <table style={{ width: '100%', maxWidth: 700, borderCollapse: 'separate', borderSpacing: '0 2px', margin: '0 auto' }}>
            <thead>
              <tr style={{ background: T.chromeDark }}>
                <th style={HDR}>Date</th>
                <th style={HDRR}>Services</th>
                <th style={HDRR}>Sales</th>
                <th style={HDRR}>Tips</th>
                <th style={HDRR}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pc.daily.map(function(d) {
                var dateLabel = new Date(d.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                var isExpanded = expandedDay === d.date;
                var dayTickets = techTickets.filter(function(t) { return t.date === d.date; });

                var rows = [];
                // Day summary row
                rows.push(
                  <tr key={d.date}
                    onClick={function() { setExpandedDay(isExpanded ? null : d.date); }}
                    style={{ background: isExpanded ? T.gridHover : T.grid, cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                    onMouseLeave={function(e) { if (!isExpanded) e.currentTarget.style.background = T.grid; }}>
                    <td style={Object.assign({}, COL, { fontWeight: 500, borderRadius: '6px 0 0 6px' })}>
                      <span style={{ marginRight: 8, fontSize: 11, color: T.primaryLight }}>{isExpanded ? '▼' : '▶'}</span>
                      {dateLabel}
                    </td>
                    <td style={COLR}>{d.services}</td>
                    <td style={COLR}>{fmt(d.sales)}</td>
                    <td style={COLR}>{d.tips > 0 ? fmt(d.tips) : '—'}</td>
                    <td style={Object.assign({}, COLR, { color: T.success, fontWeight: 600, borderRadius: '0 6px 6px 0' })}>{fmt(d.sales + d.tips)}</td>
                  </tr>
                );

                // Expanded ticket rows
                if (isExpanded) {
                  dayTickets.forEach(function(tkt, ti) {
                    var svcNames = (tkt.services || []).map(function(s) { return s.name; }).join(', ');
                    var svcTotal = 0;
                    (tkt.services || []).forEach(function(s) { svcTotal += s.price_cents; });
                    var isLast = ti === dayTickets.length - 1;
                    rows.push(
                      <tr key={tkt.id} style={{ background: T.chromeDark }}>
                        <td colSpan={2} style={{ padding: '8px 16px 8px 40px', fontSize: 13, color: T.text, borderRadius: isLast ? '0 0 0 6px' : 0 }}>{svcNames}</td>
                        <td style={{ padding: '8px 16px', fontSize: 13, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(svcTotal)}</td>
                        <td style={{ padding: '8px 16px', fontSize: 13, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tkt.tip_cents > 0 ? fmt(tkt.tip_cents) : '—'}</td>
                        <td style={{ padding: '8px 16px', fontSize: 13, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRadius: isLast ? '0 0 6px 0' : 0 }}>{fmt(svcTotal + (tkt.tip_cents || 0))}</td>
                      </tr>
                    );
                  });
                }

                return rows;
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: T.chromeDark }}>
                <td style={Object.assign({}, COL, { fontWeight: 700, borderRadius: '6px 0 0 6px' })}>TOTALS</td>
                <td style={Object.assign({}, COLR, { fontWeight: 700 })}>{pc.daily.reduce(function(s, d) { return s + d.services; }, 0)}</td>
                <td style={Object.assign({}, COLR, { fontWeight: 700 })}>{fmt(pc.gross_sales)}</td>
                <td style={Object.assign({}, COLR, { fontWeight: 700 })}>{fmt(pc.card_tips)}</td>
                <td style={Object.assign({}, COLR, { fontWeight: 700, color: T.success, borderRadius: '0 6px 6px 0' })}>{fmt(pc.gross_sales + pc.card_tips)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Pay math — Session 30 order: Svc Comm > Prod Comm > Tips > Product Deductions > Total Pay */}
          <div style={{ maxWidth: 700, margin: '20px auto 0', background: T.grid, borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
              <span>Sales</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.gross_sales)}</span>
            </div>
            {pc.hourly_earnings > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
                <span>Hourly: {pc.hours_worked}h × {fmt(staff.hourly_rate_cents || 0)}/hr</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.hourly_earnings)}</span>
              </div>
            )}
            {pc.salary_earnings > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
                <span>Salary ({staff.salary_period || 'biweekly'})</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.salary_earnings)}</span>
              </div>
            )}
            {(pc.pay_type === 'commission' || (pc.commission_bonus_enabled && pc.pay_type !== 'commission')) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
                <span>Service Commission{pc.total_discounts > 0 ? (pc.discount_reduces ? ' (on discounted)' : ' (on full price)') : ''}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.service_commission)}</span>
              </div>
            )}
            {pc.total_discounts > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: T.textMuted }}>
                <span>Discounts given: {fmt(pc.total_discounts)}{pc.discount_reduces ? '' : ' — not deducted from commission'}</span>
              </div>
            )}
            {pc.guarantee_applied && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: T.warning }}>
                <span>Daily guarantee applied ({pc.days_worked} days × {fmt(staff.daily_guarantee_cents || 0)}/day)</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.guarantee_amount)}</span>
              </div>
            )}
            {pc.product_commission > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
                <span>Product Commission ({MOCK_SALON_SETTINGS.retail_commission_pct || 0}% × {fmt(pc.retail_sales)})</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.product_commission)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.text }}>
              <span>Tips</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.card_tips)}</span>
            </div>
            {pc.product_deductions > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: T.warning }}>
                <span>Product Cost (deducted before commission)</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>-{fmt(pc.product_deductions)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid ' + T.borderLight, marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Total Pay</span>
              <span style={{ color: T.success, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.net_pay)}</span>
            </div>
            {pc.bonus_pct > 0 && (
              <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 13, color: T.text }}>
                <span>Check ({pc.check_pct}%): {fmt(pc.check_amount)}</span>
                <span>Services ({pc.bonus_pct}%): {fmt(pc.bonus_amount)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // MAIN SCREEN
  // ══════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
      <DebugLabel id="PAGE-PAYROLL" pos="tr" />
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + T.borderLight, background: T.chromeDark, flexShrink: 0, padding: '8px 20px', gap: 6 }}>
        {[{ key: 'current', label: 'Current Run', bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' }, { key: 'history', label: 'Payroll History', bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' }].concat(
          MOCK_STAFF.some(function(s) { return s.active && s.pay_type === 'hourly'; }) ? [{ key: 'timesheets', label: 'Timesheets', bg:'#3D2608', text:'#FBB040', border:'#5C3A10' }] : []
        ).map(function(tab) {
          var isActive = activeTab === tab.key;
          return (
            <div key={tab.key} onClick={function() { setActiveTab(tab.key); }}
              style={{
                padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 500, fontFamily: 'inherit',
                color: tab.text,
                background: tab.bg,
                border: isActive ? '2px solid ' + tab.border : '1px solid ' + tab.border,
                borderRadius: 7, transition: 'all 150ms', userSelect: 'none',
              }}
              onMouseEnter={function(e) { if (!isActive) { e.currentTarget.style.borderWidth = '2px'; } }}
              onMouseLeave={function(e) { if (!isActive) { e.currentTarget.style.borderWidth = '1px'; } }}
            >{tab.label}</div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div onClick={function() {
            printTickets({
              paychecks: paychecks,
              periodLabel: fmtPeriodLabel(periodStart, periodEnd),
              staff: MOCK_STAFF,
              payTypeDisplay: payTypeDisplay,
            });
          }}
          style={{ padding: '8px 20px', background: '#1E2554', color: '#A5B4FC', border: '1px solid #2E3A7A', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 19px'; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = '#1E2554'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.borderColor = '#2E3A7A'; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 20px'; }}
        >🖨️ Print Ticket</div>

        {/* Print Paycheck — PROVIDER-LEVEL GATE: Only visible when
            FEATURES.PROVIDER_PRINT_CHECK is enabled by software provider.
            Phase 2: Wire to provider admin toggle per-salon.
            For mock/demo: always visible (flag default OFF but we show it). */}
        <div style={{ width: 40 }} />
        <div
          onClick={function() {
            // Open confirmation modal with all techs selected
            var sel = {};
            paychecks.forEach(function(pc) { sel[pc.staff_id] = true; });
            setCheckSelections(sel);
            setShowCheckConfirm(true);
          }}
          style={{ padding: '8px 20px', background: '#3D2608', color: '#FBB040', border: '1px solid #5C3A10', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 19px'; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = '#3D2608'; e.currentTarget.style.color = '#FBB040'; e.currentTarget.style.borderColor = '#5C3A10'; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 20px'; }}
        >🖨️ Print Paycheck</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {activeTab === 'current' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Period header — Today + date + action, centered */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <div onClick={function() {
                  var today = new Date();
                  var y = today.getFullYear();
                  var m = String(today.getMonth() + 1).padStart(2, '0');
                  var d = String(today.getDate()).padStart(2, '0');
                  var todayStr = y + '-' + m + '-' + d;
                  setPeriodStart(todayStr);
                  setPeriodEnd(todayStr);
                }}
                style={{ padding: '10px 24px', background: '#0E3D3D', color: '#5EEAD4', border: '1px solid #1A5C5C', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '9px 23px'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#0E3D3D'; e.currentTarget.style.color = '#5EEAD4'; e.currentTarget.style.borderColor = '#1A5C5C'; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '10px 24px'; }}
              >Today</div>
              <div onClick={openDatePicker}
                style={{ padding: '10px 20px', background: T.grid, borderRadius: 8, cursor: 'pointer', userSelect: 'none', border: '1px solid ' + T.borderLight }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}>
                <div style={{ color: T.text, fontSize: 18, fontWeight: 500 }}>{fmtPeriodLabel(periodStart, periodEnd)}</div>
              </div>
              {runStatus === 'draft' && (
                <div onClick={function() { setRunStatus('review'); }}
                  style={{ padding: '10px 24px', background: '#0E2E1E', color: '#6EE7B7', border: '1px solid #1A4A30', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '9px 23px'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#0E2E1E'; e.currentTarget.style.color = '#6EE7B7'; e.currentTarget.style.borderColor = '#1A4A30'; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '10px 24px'; }}
                >Run payroll</div>
              )}
              {runStatus === 'review' && (
                <div onClick={function() { setRunStatus('completed'); }}
                  style={{ padding: '10px 24px', background: T.success, color: '#fff', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Approve & finalize</div>
              )}
              {runStatus === 'completed' && (
                <span style={{ fontSize: 13, color: T.success, padding: '10px 16px' }}>✓ Finalized</span>
              )}
            </div>

            {/* Payroll table — Session 75: new column order SALES > PROD COST > COMMISSION > PROD COMM > TIPS > TOTAL PAY */}
            {(function() {
              var COL = { padding: '12px 16px', fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
              var COLR = Object.assign({}, COL, { textAlign: 'right' });
              var HDR = { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
              var HDRR = Object.assign({}, HDR, { textAlign: 'right' });

              return (
                <table style={{ width: '100%', maxWidth: 1000, borderCollapse: 'separate', borderSpacing: '0 2px' }}>
                  <thead>
                    <tr style={{ background: T.chromeDark }}>
                      <th style={HDR}>Name</th>
                      <th style={HDRR}>Sales</th>
                      {showProdCostCol && <th style={HDRR}>Prod Cost</th>}
                      <th style={HDRR}>Commission</th>
                      {showProdCommCol && <th style={HDRR}>Prod Comm</th>}
                      <th style={HDRR}>Tips</th>
                      <th style={HDRR}>Total Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paychecks.map(function(pc) {
                      return (
                        <tr key={pc.staff_id} onClick={function() { setSelectedId(pc.staff_id); }}
                          style={{ background: T.grid, cursor: 'pointer', transition: 'background 150ms' }}
                          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                          onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}>
                          <td style={Object.assign({}, COL, { color: T.text, fontWeight: 500, borderRadius: '6px 0 0 6px' })}>{pc.name}</td>
                          <td style={Object.assign({}, COLR, { color: T.text })}>{fmt(pc.gross_sales)}</td>
                          {showProdCostCol && <td style={Object.assign({}, COLR, { color: pc.product_deductions > 0 ? T.warning : T.text })}>{pc.product_deductions > 0 ? '-' + fmt(pc.product_deductions) : '—'}</td>}
                          <td style={Object.assign({}, COLR, { color: T.text })}>{fmt(pc.service_commission)}</td>
                          {showProdCommCol && <td style={Object.assign({}, COLR, { color: T.text })}>{pc.product_commission > 0 ? fmt(pc.product_commission) : '—'}</td>}
                          <td style={Object.assign({}, COLR, { color: T.text })}>{fmt(pc.card_tips)}</td>
                          <td style={Object.assign({}, COLR, { color: T.success, fontWeight: 600, borderRadius: '0 6px 6px 0' })}>{fmt(pc.net_pay)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: T.chromeDark }}>
                      <td style={Object.assign({}, COL, { color: T.text, fontWeight: 700, borderRadius: '6px 0 0 6px' })}>TOTALS</td>
                      <td style={Object.assign({}, COLR, { color: T.text, fontWeight: 700 })}>{fmt(totalSales)}</td>
                      {showProdCostCol && <td style={Object.assign({}, COLR, { color: totalProductDeductions > 0 ? T.warning : T.text, fontWeight: 700 })}>{totalProductDeductions > 0 ? '-' + fmt(totalProductDeductions) : '—'}</td>}
                      <td style={Object.assign({}, COLR, { color: T.text, fontWeight: 700 })}>{fmt(totalSvcComm)}</td>
                      {showProdCommCol && <td style={Object.assign({}, COLR, { color: T.text, fontWeight: 700 })}>{totalProdComm > 0 ? fmt(totalProdComm) : '—'}</td>}
                      <td style={Object.assign({}, COLR, { color: T.text, fontWeight: 700 })}>{fmt(totalTips)}</td>
                      <td style={Object.assign({}, COLR, { color: T.success, fontWeight: 700, borderRadius: '0 6px 6px 0' })}>{fmt(totalPayout)}</td>
                    </tr>
                  </tfoot>
                </table>
              );
            })()}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div style={{ fontSize: 12, color: T.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Past payroll runs</div>
            {payrollHistory.map(function(h) {
              var pLabel = new Date(h.period_start + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + new Date(h.period_end + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: T.grid, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background 150ms' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{pLabel}</div>
                    <div style={{ color: T.text, fontSize: 12 }}>{h.tech_count} technicians · Approved {new Date(h.approved_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span style={{ fontSize: 11, color: T.success, background: T.success + '20', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Completed</span>
                  <span style={{ color: T.text, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(h.total_payout_cents)}</span>
                </div>
              );
            })}
            {/* Link to Bill Pay Check History */}
            {onNavigate && (
              <div onClick={function() { onNavigate(); }}
                style={{ display: 'flex', justifyContent: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid ' + T.borderLight }}>
                <div style={{ padding: '8px 20px', background: T.grid, color: T.primaryLight, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >View Check History →</div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'timesheets' && (
          <TimeClockTimesheets
            clockPunches={clockPunches}
            onAddPunch={onAddPunch}
            onDeletePunch={onDeletePunch}
          />
        )}
      </div>
      <DateRangePicker
        show={showDatePicker}
        pickStart={pickStart} pickEnd={pickEnd}
        setPickStart={setPickStart} setPickEnd={setPickEnd}
        leftMonth={leftMonth} rightMonth={rightMonth}
        setLeftMonth={setLeftMonth} setRightMonth={setRightMonth}
        onApply={function(s, e) { setPeriodStart(s); setPeriodEnd(e); setShowDatePicker(false); }}
        onClose={function() { setShowDatePicker(false); }}
      />

      {/* ═══════════════════════════════════════════
          CHECK PRINTING CONFIRMATION MODAL
          Per ProSalonPOS_Check_Printing_Session27.docx §10
          Extracted to PayrollCheckConfirmModal.jsx (Session 33)
          ═══════════════════════════════════════════ */}
      <PayrollCheckConfirmModal
        show={showCheckConfirm}
        paychecks={paychecks}
        checkSelections={checkSelections}
        setCheckSelections={setCheckSelections}
        setCheckOverrideStep={setCheckOverrideStep}
        onClose={function() { setShowCheckConfirm(false); }}
        payTypeDisplay={payTypeDisplay}
        fmt={fmt}
      />

      {/* ─── Check Override Modal ─── */}
      <CheckOverrideModal
        step={checkOverrideStep}
        setStep={setCheckOverrideStep}
        paychecks={paychecks}
        checkSelections={checkSelections}
        onClose={function() { setShowCheckConfirm(false); }}
        periodStart={periodStart}
        periodEnd={periodEnd}
        periodLabel={fmtPeriodLabel(periodStart, periodEnd)}
        payTypeDisplay={payTypeDisplay}
      />
    </div>
  );
}

function StatBox({ label, value, color }) {
  var T = useTheme();
  return (
    <div style={{ background: T.grid, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ color: T.text, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: color || T.text, fontSize: 20, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
