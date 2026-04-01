import { amountToWords, formatCheckDate } from '../../lib/checkUtils';
import { fmt } from '../../lib/formatUtils';

function fmtDate(d) { var p = d.split('-'); return p[1] + '/' + p[2] + '/' + p[0]; }

// ═══════════════════════════════════════
// BILL CHECK PRINTING
// ═══════════════════════════════════════
export function printBillChecks(checks, settings) {
  if (checks.length === 0) return;
  var hOff = settings.check_horizontal_offset || 0;
  var vOff = settings.check_vertical_offset || 0;
  var checkNum = settings.check_next_number || 1001;
  var today = formatCheckDate(new Date().toISOString().slice(0, 10));

  var L = [];
  L.push('<html><head><title>Bill Pay Checks</title>');
  L.push('<style>');
  L.push('* { margin: 0; padding: 0; box-sizing: border-box; }');
  L.push('body { font-family: "Arial", "Helvetica", sans-serif; color: #000; }');
  L.push('@page { size: letter; margin: 0; }');
  L.push('.check-page { width: 8.5in; height: 11in; position: relative; page-break-after: always; }');
  L.push('.check-page:last-child { page-break-after: avoid; }');
  L.push('.check-area { position: relative; width: 8.5in; height: 3.5in; }');
  L.push('.check-field { position: absolute; }');
  L.push('.stub-area { padding: 0.4in 0.6in; font-family: "Courier New", monospace; font-size: 12px; }');
  L.push('.stub-row { display: flex; justify-content: space-between; padding: 3px 0; }');
  L.push('.stub-sep { border-top: 1px dashed #999; margin: 8px 0; }');
  L.push('@media print { body { margin: 0; } }');
  L.push('</style></head><body>');

  checks.forEach(function(ck) {
    var amount = ck.amount_cents;
    var written = amountToWords(amount);

    L.push('<div class="check-page">');
    L.push('<div class="check-area">');
    // Date
    L.push('<div class="check-field" style="top: calc(0.65in + ' + vOff + 'in); right: calc(0.75in - ' + hOff + 'in); font-size: 14px;">' + today + '</div>');
    // Pay to
    L.push('<div class="check-field" style="top: calc(1.25in + ' + vOff + 'in); left: calc(1.2in + ' + hOff + 'in); right: calc(1.2in - ' + hOff + 'in); font-size: 15px; font-weight: bold;">' + ck.payee + ' ****</div>');
    // Amount box
    L.push('<div class="check-field" style="top: calc(1.2in + ' + vOff + 'in); right: calc(0.5in - ' + hOff + 'in); font-size: 15px; font-weight: bold;">$' + (amount / 100).toFixed(2) + '</div>');
    // Written amount
    L.push('<div class="check-field" style="top: calc(1.75in + ' + vOff + 'in); left: calc(0.4in + ' + hOff + 'in); right: calc(0.6in - ' + hOff + 'in); font-size: 12px;">' + written + '</div>');
    // Memo
    L.push('<div class="check-field" style="top: calc(2.55in + ' + vOff + 'in); left: calc(0.6in + ' + hOff + 'in); font-size: 11px;">' + (ck.memo || '') + '</div>');
    // Check number
    L.push('<div class="check-field" style="top: calc(0.35in + ' + vOff + 'in); right: calc(0.5in - ' + hOff + 'in); font-size: 12px;">No. ' + checkNum + '</div>');
    L.push('</div>');

    // Stub
    L.push('<div class="stub-area">');
    L.push('<div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">Bill Payment — Check #' + checkNum + '</div>');
    L.push('<div style="font-size: 11px; margin-bottom: 10px;">Date: ' + today + '</div>');
    L.push('<div class="stub-sep"></div>');
    L.push('<div class="stub-row"><span>Payee:</span><span>' + ck.payee + '</span></div>');
    L.push('<div class="stub-row"><span>Category:</span><span>' + ck.category + '</span></div>');
    if (ck.memo) L.push('<div class="stub-row"><span>Memo:</span><span>' + ck.memo + '</span></div>');
    L.push('<div class="stub-sep"></div>');
    L.push('<div class="stub-row" style="font-weight: bold; font-size: 14px;"><span>Amount:</span><span>' + fmt(amount) + '</span></div>');
    L.push('</div>');

    L.push('</div>');
    checkNum++;
  });

  L.push('</body></html>');
  var w = window.open('', '_blank');
  w.document.write(L.join('\n'));
  w.document.close();
  w.focus();
  w.print();
}

// ═══════════════════════════════════════
// PRINT ALL SUMMARY (1099 Prep)
// ═══════════════════════════════════════
export function printAllSummary(filteredHistory) {
  if (filteredHistory.length === 0) return;

  // Group by payee and sum totals
  var payeeTotals = {};
  filteredHistory.forEach(function(h) {
    if (!payeeTotals[h.payee]) payeeTotals[h.payee] = { payee: h.payee, total_cents: 0, count: 0 };
    payeeTotals[h.payee].total_cents += h.amount_cents;
    payeeTotals[h.payee].count += 1;
  });
  var rows = Object.values(payeeTotals).sort(function(a, b) { return b.total_cents - a.total_cents; });
  var grandTotal = rows.reduce(function(sum, r) { return sum + r.total_cents; }, 0);

  // Determine date range label
  var dates = filteredHistory.map(function(h) { return h.date; }).sort();
  var rangeLabel = dates.length > 0 ? fmtDate(dates[0]) + ' — ' + fmtDate(dates[dates.length - 1]) : '';

  var L = [];
  L.push('<html><head><title>Payee Summary — All</title>');
  L.push('<style>');
  L.push('body { font-family: Arial, sans-serif; color: #000; padding: 0.5in; }');
  L.push('h1 { font-size: 18px; margin-bottom: 4px; }');
  L.push('.sub { font-size: 12px; color: #666; margin-bottom: 16px; }');
  L.push('table { width: 100%; border-collapse: collapse; }');
  L.push('th { text-align: left; font-size: 11px; text-transform: uppercase; color: #666; padding: 6px 8px; border-bottom: 2px solid #333; }');
  L.push('th:last-child, th:nth-child(2) { text-align: right; }');
  L.push('td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }');
  L.push('td:last-child { text-align: right; font-weight: 600; }');
  L.push('td:nth-child(2) { text-align: right; }');
  L.push('.total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 16px; padding-top: 8px; border-top: 2px solid #333; }');
  L.push('@media print { body { margin: 0; } }');
  L.push('</style></head><body>');
  L.push('<h1>Payee Summary</h1>');
  L.push('<div class="sub">' + rangeLabel + ' &bull; ' + rows.length + ' payee' + (rows.length !== 1 ? 's' : '') + ' &bull; ' + filteredHistory.length + ' check' + (filteredHistory.length !== 1 ? 's' : '') + '</div>');
  L.push('<table><tr><th>Payee</th><th>Checks</th><th>Total</th></tr>');
  rows.forEach(function(r) {
    L.push('<tr><td>' + r.payee + '</td><td>' + r.count + '</td><td>' + fmt(r.total_cents) + '</td></tr>');
  });
  L.push('</table>');
  L.push('<div class="total">Grand Total: ' + fmt(grandTotal) + '</div>');
  L.push('</body></html>');
  var w = window.open('', '_blank');
  w.document.write(L.join('\n'));
  w.document.close();
  w.focus();
  w.print();
}
