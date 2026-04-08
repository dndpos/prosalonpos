import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
import { useState, useMemo, useEffect } from 'react';
import { useCommissionStore } from '../../lib/stores/commissionStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { usePayrollStore } from '../../lib/stores/payrollStore';
import { calculatePaycheck } from './payrollCalculator';
import { amountToWords, formatCheckDate, printChecks, printTickets } from '../../lib/checkUtils';
import { FEATURES, isFeatureEnabled } from '../../lib/features';
import DateRangePicker from './PayrollDatePicker';
import CheckOverrideModal from './CheckOverrideModal';
import PayrollCheckConfirmModal from './PayrollCheckConfirmModal';
import PayPeriodPopup from './PayPeriodPopup';
import TimeClockTimesheets from '../time-clock/TimeClockTimesheets';
import { fmt } from '../../lib/formatUtils';
import { reshapeTicketForPayroll, calculateHoursFromPunches, calculateTipsFromTickets, reshapePayrollHistory, getCurrentPayPeriod, stepPayPeriod } from './payrollDataHelpers';
import { api } from '../../lib/apiClient';


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

function StatBox({ label, value, color }) {
  var T = useTheme();
  return (
    <div style={{ background: T.grid, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ color: T.text, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: color || T.text, fontSize: 20, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}


// COMPONENT
export default function PayrollModule({ salonSettings, onNavigate, clockPunches, onAddPunch, onEditPunch, onDeletePunch }) {
  var T = useTheme();
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var settings = useSettingsStore(function(s) { return s.settings; });
  var showProdComm = !!settings.retail_commission_enabled;
  var services = useServiceStore(function(s) { return s.services; });
  var commissionRules = useCommissionStore(function(s) { return s.rules; });
  var commissionTiers = useCommissionStore(function(s) { return s.tiers; });

  // Real data from stores
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var payrollRuns = usePayrollStore(function(s) { return s.runs; });
  var fetchPayrollRuns = usePayrollStore(function(s) { return s.fetchRuns; });

  var statusColors = { draft: T.warning, review: T.primaryLight, completed: T.success };
  var [activeTab, setActiveTab] = useState('current');
  var [selectedId, setSelectedId] = useState(null);

  // Pay period settings
  var [showPayPeriodPopup, setShowPayPeriodPopup] = useState(false);
  var payFrequency = settings.pay_frequency || 'biweekly';
  var payPeriodStartDay = settings.pay_period_start_day || 'monday';
  var updateSettings = useSettingsStore(function(s) { return s.updateSetting; });

  // ── Calculate current pay period from settings ──
  var _defaultPeriod = getCurrentPayPeriod(payFrequency, payPeriodStartDay);

  var [periodStart, setPeriodStart] = useState(_defaultPeriod.start);
  var [periodEnd, setPeriodEnd] = useState(_defaultPeriod.end);

  // When pay period settings change (frequency or start day), recalculate the period
  var _settingsKey = payFrequency + '|' + payPeriodStartDay;
  var [_lastSettingsKey, _setLastSettingsKey] = useState(_settingsKey);
  useEffect(function() {
    if (_settingsKey !== _lastSettingsKey) {
      var newPeriod = getCurrentPayPeriod(payFrequency, payPeriodStartDay);
      setPeriodStart(newPeriod.start);
      setPeriodEnd(newPeriod.end);
      _setLastSettingsKey(_settingsKey);
    }
  }, [_settingsKey]);
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
    var result = [];
    closedTickets.forEach(function(t) {
      var entries = reshapeTicketForPayroll(t);
      entries.forEach(function(e) { result.push(e); });
    });
    return result;
  }, [closedTickets]);

  // ── Fetch clock punches for the PAY PERIOD date range from API ──
  // The clockPunches prop from useTimeClock is today-only (for the popup).
  // Payroll needs the full period range so hourly staff hours are correct.
  // Refetch when clockPunches changes (someone clocked in/out while viewing payroll).
  var [periodPunches, setPeriodPunches] = useState([]);
  var _punchCount = clockPunches ? clockPunches.length : 0;
  useEffect(function() {
    var startISO = periodStart + 'T00:00:00.000Z';
    var endISO = periodEnd + 'T23:59:59.999Z';
    api.get('/timeclock/punches?start=' + encodeURIComponent(startISO) + '&end=' + encodeURIComponent(endISO)).then(function(data) {
      if (data && data.punches) setPeriodPunches(data.punches);
    }).catch(function(err) {
      console.warn('[Payroll] Failed to fetch period punches:', err.message);
      setPeriodPunches([]);
    });
  }, [periodStart, periodEnd, _punchCount]);

  // ── Calculate hours worked from period punches for each tech ──
  var hoursWorked = useMemo(function() {
    return calculateHoursFromPunches(periodPunches);
  }, [periodPunches]);

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
    var sameYear = s.getFullYear() === e.getFullYear();
    var startOpts = sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
    return s.toLocaleDateString('en-US', startOpts) + ' – ' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Calculate all paychecks
  var paychecks = useMemo(function() {
    var payableStaff = storeStaff.filter(function(s) { return s.active && s.role !== 'owner'; });
    return payableStaff.map(function(staff) {
      return calculatePaycheck(staff, payrollTickets, hoursWorked[staff.id] || 0, cardTips[staff.id] || 0, settings, commissionRules, commissionTiers, services, periodPunches);
    });
  }, [payrollTickets, hoursWorked, cardTips, storeStaff, settings, commissionRules, commissionTiers, services, periodPunches]);

  var totalPayout = paychecks.reduce(function(s, p) { return s + p.net_pay; }, 0);
  var totalSales = paychecks.reduce(function(s, p) { return s + p.gross_sales; }, 0);
  var totalSvcComm = paychecks.reduce(function(s, p) { return s + p.service_commission; }, 0);
  var totalProdComm = paychecks.reduce(function(s, p) { return s + p.product_commission; }, 0);
  var totalTips = paychecks.reduce(function(s, p) { return s + p.card_tips; }, 0);
  var totalProductDeductions = paychecks.reduce(function(s, p) { return s + p.product_deductions; }, 0);

  // Column visibility flags
  var anyServiceHasProductCost = services.some(function(s) { return s.product_cost_cents > 0; });
  var showProdCostCol = anyServiceHasProductCost && totalProductDeductions > 0;
  var showProdCommCol = !!settings.retail_commission_enabled;

  var selectedPaycheck = selectedId ? paychecks.find(function(p) { return p.staff_id === selectedId; }) : null;

  // PAYCHECK DETAIL
  var [expandedDay, setExpandedDay] = useState(null);

  if (selectedPaycheck) {
    var pc = selectedPaycheck;
    var staff = storeStaff.find(function(s) { return s.id === pc.staff_id; });

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

          {/* Pay math */}
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
                <span>Product Commission ({settings.retail_commission_pct || 0}% × {fmt(pc.retail_sales)})</span>
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

  // MAIN SCREEN
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
        <AreaTag id="PR" />
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + T.borderLight, background: T.chromeDark, flexShrink: 0, padding: '8px 20px', gap: 6 }}>
        {[{ key: 'current', label: 'Current Period', bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' }, { key: 'history', label: 'Payroll History', bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' }].concat(
          storeStaff.some(function(s) { return s.active && s.pay_type === 'hourly'; }) ? [{ key: 'timesheets', label: 'Timesheets', bg:'#3D2608', text:'#FBB040', border:'#5C3A10' }] : []
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

        {/* Pay Period Settings button */}
        <div onClick={function() { setShowPayPeriodPopup(true); }}
          style={{ padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', color: '#E879F9', background: '#3B0764', border: '1px solid #581C87', borderRadius: 7, transition: 'all 150ms', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 17px'; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 18px'; }}
        >Pay Period</div>

        <div style={{ flex: 1 }} />
        <div onClick={function() {
            printTickets({
              paychecks: paychecks,
              periodLabel: fmtPeriodLabel(periodStart, periodEnd),
              staff: storeStaff,
              payTypeDisplay: payTypeDisplay,
            });
          }}
          style={{ padding: '8px 20px', background: '#1E2554', color: '#A5B4FC', border: '1px solid #2E3A7A', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 19px'; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = '#1E2554'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.borderColor = '#2E3A7A'; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 20px'; }}
        >🖨️ Print Ticket</div>

        <div style={{ width: 40 }} />
        <div
          onClick={function() {
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
            {/* Period header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              <div onClick={function() {
                  var currentPeriod = getCurrentPayPeriod(payFrequency, payPeriodStartDay);
                  setPeriodStart(currentPeriod.start);
                  setPeriodEnd(currentPeriod.end);
                }}
                style={{ padding: '10px 24px', background: '#0E3D3D', color: '#5EEAD4', border: '1px solid #1A5C5C', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#164D4D'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#0E3D3D'; }}
              >Today</div>
              <div onClick={function() {
                  var prev = stepPayPeriod(periodStart, periodEnd, payFrequency, payPeriodStartDay, -1);
                  setPeriodStart(prev.start); setPeriodEnd(prev.end);
                }}
                style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.grid, cursor: 'pointer', fontSize: 20, color: T.text, fontWeight: 600, userSelect: 'none', border: '1px solid ' + T.borderLight }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
              >‹</div>
              <div onClick={openDatePicker}
                style={{ padding: '10px 20px', background: T.grid, borderRadius: 8, cursor: 'pointer', userSelect: 'none', border: '1px solid ' + T.borderLight }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}>
                <div style={{ color: T.text, fontSize: 18, fontWeight: 500 }}>{fmtPeriodLabel(periodStart, periodEnd)}</div>
              </div>
              <div onClick={function() {
                  var next = stepPayPeriod(periodStart, periodEnd, payFrequency, payPeriodStartDay, 1);
                  setPeriodStart(next.start); setPeriodEnd(next.end);
                }}
                style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.grid, cursor: 'pointer', fontSize: 20, color: T.text, fontWeight: 600, userSelect: 'none', border: '1px solid ' + T.borderLight }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
              >›</div>
            </div>

            {/* Payroll table */}
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
            {/* Payroll runs */}
            <div style={{ fontSize: 12, color: T.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Past Payroll Runs</div>
            {payrollHistory.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No payroll runs yet.</div>
            )}
            {payrollHistory.map(function(h) {
              var pLabel = new Date(h.period_start + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + new Date(h.period_end + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: T.grid, borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{pLabel}</div>
                    <div style={{ color: T.text, fontSize: 12 }}>{h.tech_count} technicians · Approved {new Date(h.approved_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span style={{ fontSize: 11, color: T.success, background: T.success + '20', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Completed</span>
                  <span style={{ color: T.text, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(h.total_payout_cents)}</span>
                </div>
              );
            })}

            {/* Payroll check history — inline */}
            <div style={{ fontSize: 12, color: T.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 24, marginBottom: 12 }}>Payroll Check History</div>
            {(function() {
              var checks = payrollRuns.filter(function(r) { return r.checks && r.checks.length > 0; }).reduce(function(all, r) {
                return all.concat(r.checks.map(function(c) { return Object.assign({}, c, { period_start: r.period_start, period_end: r.period_end }); }));
              }, []);
              if (checks.length === 0) return (
                <div style={{ padding: '24px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No payroll checks printed yet.</div>
              );
              return (
                <div>
                  <div style={{ display: 'flex', padding: '6px 14px', marginBottom: 4 }}>
                    <div style={{ width: 70, color: T.textMuted, fontSize: 11, fontWeight: 600 }}>Check #</div>
                    <div style={{ width: 90, color: T.textMuted, fontSize: 11, fontWeight: 600 }}>Date</div>
                    <div style={{ flex: 1, color: T.textMuted, fontSize: 11, fontWeight: 600 }}>Payee</div>
                    <div style={{ width: 100, textAlign: 'right', color: T.textMuted, fontSize: 11, fontWeight: 600 }}>Amount</div>
                  </div>
                  {checks.map(function(c, i) {
                    var dateStr = c.date || c.period_end || '';
                    var dateFmt = dateStr ? (function() { var p = dateStr.split('-'); return p[1] + '/' + p[2] + '/' + p[0]; })() : '';
                    return (
                      <div key={c.id || i} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: T.grid, borderRadius: 6, marginBottom: 3, border: '1px solid ' + T.borderLight }}>
                        <div style={{ width: 70, color: T.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>#{c.check_number || '—'}</div>
                        <div style={{ width: 90, color: T.text, fontSize: 13 }}>{dateFmt}</div>
                        <div style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: 500 }}>{c.payee || c.staff_name || '—'}</div>
                        <div style={{ width: 100, textAlign: 'right', color: T.text, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.amount_cents || 0)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === 'timesheets' && (
          <TimeClockTimesheets
            clockPunches={clockPunches}
            onAddPunch={onAddPunch}
            onEditPunch={onEditPunch}
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

      {showPayPeriodPopup && (
        <PayPeriodPopup
          payFrequency={payFrequency}
          payPeriodStartDay={payPeriodStartDay}
          onUpdateSetting={updateSettings}
          onClose={function() { setShowPayPeriodPopup(false); }}
        />
      )}
    </div>
  );
}
