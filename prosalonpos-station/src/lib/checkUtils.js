/**
 * Pro Salon POS — Check Printing Utilities
 * 
 * Number-to-words converter for printed paychecks.
 * Converts dollar amounts to written form per standard US business check format.
 * 
 * Examples:
 *   amountToWords(135000) → "One Thousand Three Hundred Fifty and 00/100 Dollars ****"
 *   amountToWords(25075)  → "Two Hundred Fifty and 75/100 Dollars ****"
 *   amountToWords(4500)   → "Forty-Five and 00/100 Dollars ****"
 *   amountToWords(200000) → "Two Thousand and 00/100 Dollars ****"
 * 
 * Reference: ProSalonPOS_Check_Printing_Session27.docx §6
 */

var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/**
 * Convert an integer (0–999) to words.
 */
function chunkToWords(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    var t = TENS[Math.floor(n / 10)];
    var o = ONES[n % 10];
    return o ? t + '-' + o : t;
  }
  // 100–999
  var hundreds = ONES[Math.floor(n / 100)] + ' Hundred';
  var remainder = n % 100;
  if (remainder === 0) return hundreds;
  return hundreds + ' ' + chunkToWords(remainder);
}

/**
 * Convert a whole dollar amount (integer) to words.
 * Supports up to 999,999 (sufficient for salon paychecks).
 */
function dollarsToWords(dollars) {
  if (dollars === 0) return 'Zero';

  var parts = [];

  // Thousands
  var thousands = Math.floor(dollars / 1000);
  if (thousands > 0) {
    parts.push(chunkToWords(thousands) + ' Thousand');
  }

  // Remainder (0–999)
  var remainder = dollars % 1000;
  if (remainder > 0) {
    parts.push(chunkToWords(remainder));
  }

  return parts.join(' ');
}

/**
 * Convert cents amount to written check format.
 * @param {number} cents — amount in cents (e.g., 135000 = $1,350.00)
 * @returns {string} — "One Thousand Three Hundred Fifty and 00/100 Dollars ****"
 */
export function amountToWords(cents) {
  var totalCents = Math.abs(Math.round(cents));
  var dollars = Math.floor(totalCents / 100);
  var remainderCents = totalCents % 100;
  var centsStr = String(remainderCents).padStart(2, '0');
  return dollarsToWords(dollars) + ' and ' + centsStr + '/100 Dollars ****';
}

/**
 * Format a date string (YYYY-MM-DD) to MM/DD/YYYY for check printing.
 */
export function formatCheckDate(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parts[1] + '/' + parts[2] + '/' + parts[0];
}

// ═══════════════════════════════════════════
// CHECK PRINTING — window.open() + window.print()
// Per ProSalonPOS_Check_Printing_Session27.docx
// Check-on-top voucher: check ~3.5" top, pay stub below.
// Absolute CSS positions fields onto pre-printed check stock.
// Horizontal/vertical offsets from salon settings shift all fields.
// ═══════════════════════════════════════════

function fmtCents(cents) { return '$' + (Math.abs(cents) / 100).toFixed(2); }

/**
 * Generate and print paychecks for selected technicians.
 * Opens a new window with one 8.5"×11" page per tech: check on top, pay stub below.
 *
 * @param {Object} opts
 * @param {Array} opts.paychecks — calculated paycheck objects from PayrollModule
 * @param {Object} opts.selections — { staff_id: true/false } from confirmation modal
 * @param {string} opts.periodStart — YYYY-MM-DD
 * @param {string} opts.periodEnd — YYYY-MM-DD
 * @param {string} opts.periodLabel — formatted period string
 * @param {Array} opts.staff — MOCK_STAFF array
 * @param {Object} opts.salonSettings — MOCK_SALON_SETTINGS object
 * @param {Function} opts.payTypeDisplay — function(staffRec) => string
 */
export function printChecks(opts) {
  var paychecks = opts.paychecks;
  var selections = opts.selections;
  var periodStart = opts.periodStart;
  var periodEnd = opts.periodEnd;
  var periodLabel = opts.periodLabel;
  var staffList = opts.staff;
  var settings = opts.salonSettings;
  var payTypeDisplay = opts.payTypeDisplay;

  var selectedPCs = paychecks.filter(function(pc) { return selections[pc.staff_id]; });
  if (selectedPCs.length === 0) return;

  var hOff = settings.check_horizontal_offset || 0;
  var vOff = settings.check_vertical_offset || 0;
  var checkNum = settings.check_next_number || 1001;

  var printDate = formatCheckDate(periodEnd);
  var memoLine = 'Pay period ' + formatCheckDate(periodStart) + ' - ' + formatCheckDate(periodEnd);

  var L = [];
  L.push('<html><head><title>Paychecks</title>');
  L.push('<style>');
  L.push('* { margin: 0; padding: 0; box-sizing: border-box; }');
  L.push('body { font-family: "Arial", "Helvetica", sans-serif; color: #000; }');
  L.push('@page { size: letter; margin: 0; }');
  L.push('.check-page { width: 8.5in; height: 11in; position: relative; page-break-after: always; }');
  L.push('.check-page:last-child { page-break-after: avoid; }');
  L.push('.check-area { position: relative; width: 8.5in; height: 3.5in; }');
  L.push('.check-field { position: absolute; }');
  L.push('.stub-area { padding: 0.3in 0.6in; font-family: "Courier New", monospace; font-size: 11px; max-height: 7.3in; overflow: hidden; }');
  L.push('.stub-area.compact { font-size: 9px; }');
  L.push('.stub-area.compact .stub-title { font-size: 12px; }');
  L.push('.stub-area.compact .stub-sub { font-size: 8px; margin-bottom: 2px; }');
  L.push('.stub-area.compact .stub-sep { margin: 4px 0; }');
  L.push('.stub-area.compact .stub-sep-bold { margin: 4px 0; }');
  L.push('.stub-area.compact .stub-hdr { font-size: 8px; padding: 2px 0; }');
  L.push('.stub-area.compact .stub-day { font-size: 9px; padding: 1px 0; }');
  L.push('.stub-area.compact .stub-row { font-size: 9px; padding: 1px 0; }');
  L.push('.stub-area.compact .stub-total { font-size: 11px; padding: 3px 0; }');
  L.push('.stub-title { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 2px; }');
  L.push('.stub-sub { text-align: center; font-size: 10px; margin-bottom: 4px; }');
  L.push('.stub-sep { border-top: 1px dashed #000; margin: 6px 0; }');
  L.push('.stub-sep-bold { border-top: 2px solid #000; margin: 6px 0; }');
  L.push('.stub-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }');
  L.push('.stub-row.bold { font-weight: bold; }');
  L.push('.stub-hdr { display: flex; font-weight: bold; font-size: 10px; padding: 3px 0; border-bottom: 1px solid #000; margin-bottom: 3px; }');
  L.push('.stub-hdr span { flex: 1; text-align: right; }');
  L.push('.stub-hdr span:first-child { text-align: left; flex: 1.5; }');
  L.push('.stub-day { display: flex; padding: 2px 0; font-size: 11px; }');
  L.push('.stub-day span { flex: 1; text-align: right; }');
  L.push('.stub-day span:first-child { text-align: left; flex: 1.5; }');
  L.push('.stub-total { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; font-weight: bold; }');
  L.push('@media print { body { margin: 0; } }');
  L.push('</style></head><body>');

  selectedPCs.forEach(function(pc) {
    var staffRec = staffList.find(function(s) { return s.id === pc.staff_id; });
    var legalName = staffRec ? staffRec.legal_name : pc.name;
    var checkAmount = pc.check_amount;
    var writtenAmount = amountToWords(checkAmount);

    // ── Check portion (top 3.5") ──
    L.push('<div class="check-page">');
    L.push('<div class="check-area">');

    // Date — top right
    L.push('<div class="check-field" style="top: calc(0.65in + ' + vOff + 'in); right: calc(0.75in - ' + hOff + 'in); font-size: 14px;">' + printDate + '</div>');

    // Pay to the order of — center left
    L.push('<div class="check-field" style="top: calc(1.25in + ' + vOff + 'in); left: calc(1.2in + ' + hOff + 'in); right: calc(1.2in - ' + hOff + 'in); font-size: 15px; font-weight: bold;">' + legalName + ' ****</div>');

    // Numeric amount — right side in box
    L.push('<div class="check-field" style="top: calc(1.20in + ' + vOff + 'in); right: calc(0.55in - ' + hOff + 'in); font-size: 16px; font-weight: bold;">$' + (checkAmount / 100).toFixed(2) + '</div>');

    // Written amount — below payee line
    L.push('<div class="check-field" style="top: calc(1.75in + ' + vOff + 'in); left: calc(0.5in + ' + hOff + 'in); right: calc(0.5in - ' + hOff + 'in); font-size: 12px;">' + writtenAmount + '</div>');

    // Memo — bottom left
    L.push('<div class="check-field" style="top: calc(2.65in + ' + vOff + 'in); left: calc(0.75in + ' + hOff + 'in); font-size: 11px;">' + memoLine + '</div>');

    L.push('</div>');

    // ── Pay stub portion (below perforation) ──
    var stubClass = 'stub-area' + (pc.daily.length > 10 ? ' compact' : '');
    L.push('<div class="' + stubClass + '">');

    L.push('<div class="stub-title">' + settings.salon_name + '</div>');
    L.push('<div class="stub-sub">EARNINGS STATEMENT</div>');
    L.push('<div class="stub-sub">' + legalName + ' · ' + payTypeDisplay(staffRec) + '</div>');
    L.push('<div class="stub-sub">' + periodLabel + '</div>');

    L.push('<div class="stub-sep-bold"></div>');

    // Daily table
    L.push('<div class="stub-hdr"><span>DATE</span><span>SVCS</span><span>SALES</span><span>TIPS</span><span>TOTAL</span></div>');

    var totalDaySales = 0;
    var totalDayTips = 0;
    pc.daily.forEach(function(d) {
      var dateLabel = new Date(d.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      var dayTotal = d.sales + d.tips;
      totalDaySales += d.sales;
      totalDayTips += d.tips;
      L.push('<div class="stub-day"><span>' + dateLabel + '</span><span>' + d.services + '</span><span>' + fmtCents(d.sales) + '</span><span>' + (d.tips > 0 ? fmtCents(d.tips) : '-') + '</span><span>' + fmtCents(dayTotal) + '</span></div>');
    });

    L.push('<div class="stub-sep"></div>');
    L.push('<div class="stub-day" style="font-weight:bold;"><span>TOTALS</span><span>' + pc.daily.reduce(function(s, d) { return s + d.services; }, 0) + '</span><span>' + fmtCents(totalDaySales) + '</span><span>' + fmtCents(totalDayTips) + '</span><span>' + fmtCents(totalDaySales + totalDayTips) + '</span></div>');

    L.push('<div class="stub-sep-bold"></div>');

    // Pay calculation breakdown — Session 30 order: Svc Comm > Prod Comm > Tips > Products > Total
    if (pc.hourly_earnings > 0) {
      L.push('<div class="stub-row"><span>Hourly: ' + pc.hours_worked + 'h × ' + fmtCents(staffRec.hourly_rate_cents || 0) + '</span><span>' + fmtCents(pc.hourly_earnings) + '</span></div>');
    }
    if (pc.salary_earnings > 0) {
      L.push('<div class="stub-row"><span>Salary</span><span>' + fmtCents(pc.salary_earnings) + '</span></div>');
    }
    if (pc.pay_type === 'commission' || (pc.commission_bonus_enabled && pc.pay_type !== 'commission')) {
      L.push('<div class="stub-row"><span>Service Commission</span><span>' + fmtCents(pc.service_commission) + '</span></div>');
    }
    if (pc.guarantee_applied) {
      L.push('<div class="stub-row"><span>* Guarantee (' + pc.days_worked + 'd × ' + fmtCents(staffRec.daily_guarantee_cents || 0) + ')</span><span>' + fmtCents(pc.guarantee_amount) + '</span></div>');
    }
    if (pc.product_commission > 0) {
      L.push('<div class="stub-row"><span>Product Commission</span><span>' + fmtCents(pc.product_commission) + '</span></div>');
    }
    L.push('<div class="stub-row"><span>Tips</span><span>' + fmtCents(pc.card_tips) + '</span></div>');

    if (pc.product_deductions > 0) {
      L.push('<div class="stub-row"><span>Product Cost</span><span>-' + fmtCents(pc.product_deductions) + '</span></div>');
    }

    L.push('<div class="stub-sep-bold"></div>');

    // Net pay (after product deductions)
    L.push('<div class="stub-total"><span>TOTAL PAY</span><span>' + fmtCents(pc.net_pay) + '</span></div>');

    // Check / Services split (only if split exists)
    if (pc.bonus_pct > 0) {
      L.push('<div class="stub-sep"></div>');
      L.push('<div class="stub-row"><span>Check (' + pc.check_pct + '%)</span><span>' + fmtCents(pc.check_amount) + '</span></div>');
      L.push('<div class="stub-row"><span>Services (' + pc.bonus_pct + '%)</span><span>' + fmtCents(pc.bonus_amount) + '</span></div>');
    }

    L.push('<div class="stub-sep-bold"></div>');
    L.push('<div class="stub-row" style="font-size:10px;"><span>Check #' + checkNum + '</span><span>' + settings.salon_name + '</span></div>');

    L.push('</div>'); // end stub-area
    L.push('</div>'); // end check-page

    checkNum++;
  });

  L.push('</body></html>');

  // Update the setting with new next check number
  // (In Phase 2 this persists to database)
  settings.check_next_number = checkNum;

  var w = window.open('', '_blank');
  w.document.write(L.join('\n'));
  w.document.close();
  w.focus();
  w.print();
}


// ═══════════════════════════════════════════
// PRINT TICKETS — receipt-style payroll tickets
// Extracted from PayrollModule for 800-line compliance.
// ═══════════════════════════════════════════

/**
 * Generate and print payroll tickets (receipt style) for all techs.
 *
 * @param {Object} opts
 * @param {Array} opts.paychecks — calculated paycheck objects
 * @param {string} opts.periodLabel — formatted period string
 * @param {Array} opts.staff — MOCK_STAFF array
 * @param {Function} opts.payTypeDisplay — function(staffRec) => string
 */
export function printTickets(opts) {
  var paychecks = opts.paychecks;
  var periodLabel = opts.periodLabel;
  var staffList = opts.staff;
  var payTypeDisplay = opts.payTypeDisplay;

  var L = [];
  L.push('<html><head><title>Payroll</title>');
  L.push('<style>');
  L.push('* { margin: 0; padding: 0; box-sizing: border-box; }');
  L.push('body { font-family: "Courier New", monospace; font-size: 12px; color: #000; }');
  L.push('.receipt { width: 300px; margin: 0 auto; padding: 16px 12px; page-break-after: always; }');
  L.push('.receipt:last-child { page-break-after: avoid; }');
  L.push('.name { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 2px; }');
  L.push('.paytype { text-align: center; font-size: 11px; margin-bottom: 8px; }');
  L.push('.period { text-align: center; font-size: 11px; margin-bottom: 8px; }');
  L.push('.sep { border-top: 1px dashed #000; margin: 8px 0; }');
  L.push('.sep-bold { border-top: 2px solid #000; margin: 8px 0; }');
  L.push('.hdr { display: flex; font-weight: bold; font-size: 11px; padding: 4px 0; border-bottom: 1px solid #000; margin-bottom: 4px; }');
  L.push('.hdr span { flex: 1; text-align: right; }');
  L.push('.hdr span:first-child { text-align: left; flex: 1.5; }');
  L.push('.day { display: flex; padding: 3px 0; font-size: 12px; }');
  L.push('.day span { flex: 1; text-align: right; }');
  L.push('.day span:first-child { text-align: left; flex: 1.5; }');
  L.push('.row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }');
  L.push('.row.bold { font-weight: bold; }');
  L.push('.total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; font-weight: bold; }');
  L.push('@media print { body { margin: 0; } .receipt { padding: 8px; } }');
  L.push('</style></head><body>');

  paychecks.forEach(function(pc) {
    var staffRec = staffList.find(function(s) { return s.id === pc.staff_id; });

    L.push('<div class="receipt">');
    L.push('<div class="name">' + pc.name + '</div>');
    L.push('<div class="paytype">' + payTypeDisplay(staffRec) + '</div>');
    L.push('<div class="period">' + periodLabel + '</div>');

    L.push('<div class="sep-bold"></div>');

    // Daily table
    L.push('<div class="hdr"><span>DATE</span><span>SALES</span><span>TIPS</span><span>TOTAL</span></div>');

    var totalDaySales = 0;
    var totalDayTips = 0;
    pc.daily.forEach(function(d) {
      var dateLabel = new Date(d.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      var dayTotal = d.sales + d.tips;
      totalDaySales += d.sales;
      totalDayTips += d.tips;
      L.push('<div class="day"><span>' + dateLabel + '</span><span>' + fmtCents(d.sales) + '</span><span>' + (d.tips > 0 ? fmtCents(d.tips) : '-') + '</span><span>' + fmtCents(dayTotal) + '</span></div>');
    });

    L.push('<div class="sep"></div>');
    L.push('<div class="day" style="font-weight:bold;"><span>TOTALS</span><span>' + fmtCents(totalDaySales) + '</span><span>' + fmtCents(totalDayTips) + '</span><span>' + fmtCents(totalDaySales + totalDayTips) + '</span></div>');

    L.push('<div class="sep-bold"></div>');

    // Pay calculation — Session 30 order: Svc Comm > Prod Comm > Tips > Products > Total
    if (pc.hourly_earnings > 0) {
      L.push('<div class="row"><span>Hourly ' + pc.hours_worked + 'h × ' + fmtCents(staffRec.hourly_rate_cents || 0) + '</span><span>' + fmtCents(pc.hourly_earnings) + '</span></div>');
    }
    if (pc.salary_earnings > 0) {
      L.push('<div class="row"><span>Salary</span><span>' + fmtCents(pc.salary_earnings) + '</span></div>');
    }
    if (pc.pay_type === 'commission' || (pc.commission_bonus_enabled && pc.pay_type !== 'commission')) {
      L.push('<div class="row"><span>Service Commission</span><span>' + fmtCents(pc.service_commission) + '</span></div>');
    }
    if (pc.guarantee_applied) {
      L.push('<div class="row"><span>* Guarantee (' + pc.days_worked + 'd × ' + fmtCents(staffRec.daily_guarantee_cents || 0) + ')</span><span>' + fmtCents(pc.guarantee_amount) + '</span></div>');
    }
    if (pc.product_commission > 0) {
      L.push('<div class="row"><span>Product Commission</span><span>' + fmtCents(pc.product_commission) + '</span></div>');
    }
    L.push('<div class="row"><span>Tips</span><span>' + fmtCents(pc.card_tips) + '</span></div>');

    if (pc.product_deductions > 0) {
      L.push('<div class="row"><span>Product Cost</span><span>-' + fmtCents(pc.product_deductions) + '</span></div>');
    }

    L.push('<div class="sep-bold"></div>');

    L.push('<div class="total-row"><span>TOTAL PAY</span><span>' + fmtCents(pc.net_pay) + '</span></div>');

    if (pc.bonus_pct > 0) {
      L.push('<div class="sep"></div>');
      L.push('<div class="row"><span>Check</span><span>' + fmtCents(pc.check_amount) + '</span></div>');
      L.push('<div class="row"><span>Services</span><span>' + fmtCents(pc.bonus_amount) + '</span></div>');
    }

    L.push('<div class="sep-bold"></div>');
    L.push('<div style="text-align:center; font-size:10px; margin-top:8px;">Thank you</div>');

    L.push('</div>');
  });

  L.push('</body></html>');
  var w = window.open('', '_blank');
  w.document.write(L.join('\n'));
  w.document.close();
  w.focus();
  w.print();
}
