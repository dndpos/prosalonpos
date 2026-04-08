import { useTheme } from '../../lib/ThemeContext';
import { fmt } from '../../lib/formatUtils';

/**
 * PayeeDetailPopup — Shows all checks for a specific payee within a date range.
 * Printable report for 1099 prep.
 *
 * Props:
 *   payee        - payee name string
 *   history      - full check history array
 *   dateFrom     - filter start date string
 *   dateTo       - filter end date string
 *   onClose      - close handler
 */

function fmtDate(d) { var p = d.split('-'); return p[1] + '/' + p[2] + '/' + p[0]; }

export default function PayeeDetailPopup({ payee, history, dateFrom, dateTo, onClose }) {
  var T = useTheme();

  var payeeChecks = history.filter(function(h) {
    if (h.payee !== payee) return false;
    if (dateFrom && h.date < dateFrom) return false;
    if (dateTo && h.date > dateTo) return false;
    return true;
  });
  var payeeTotal = payeeChecks.reduce(function(sum, h) { return sum + h.amount_cents; }, 0);
  var dateRange = (dateFrom ? fmtDate(dateFrom) : 'Start') + ' — ' + (dateTo ? fmtDate(dateTo) : 'Present');

  function printPayeeReport() {
    var L = [];
    L.push('<html><head><title>Check History — ' + payee + '</title>');
    L.push('<style>');
    L.push('body { font-family: Arial, sans-serif; color: #000; padding: 0.5in; }');
    L.push('h1 { font-size: 18px; margin-bottom: 4px; }');
    L.push('.sub { font-size: 12px; color: #666; margin-bottom: 16px; }');
    L.push('table { width: 100%; border-collapse: collapse; }');
    L.push('th { text-align: left; font-size: 11px; text-transform: uppercase; color: #666; padding: 6px 8px; border-bottom: 2px solid #333; }');
    L.push('th:last-child { text-align: right; }');
    L.push('td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }');
    L.push('td:last-child { text-align: right; font-weight: 600; }');
    L.push('.total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 16px; padding-top: 8px; border-top: 2px solid #333; }');
    L.push('@media print { body { margin: 0; } }');
    L.push('</style></head><body>');
    L.push('<h1>Check History — ' + payee + '</h1>');
    L.push('<div class="sub">' + dateRange + ' &bull; ' + payeeChecks.length + ' check' + (payeeChecks.length !== 1 ? 's' : '') + '</div>');
    L.push('<table><tr><th>Check #</th><th>Date</th><th>Category</th><th>Amount</th></tr>');
    payeeChecks.forEach(function(h) {
      L.push('<tr><td>#' + h.check_number + '</td><td>' + fmtDate(h.date) + '</td><td>' + h.category + '</td><td>' + fmt(h.amount_cents) + '</td></tr>');
    });
    L.push('</table>');
    L.push('<div class="total">Total: ' + fmt(payeeTotal) + '</div>');
    L.push('</body></html>');
    var w = window.open('', '_blank');
    w.document.write(L.join('\n'));
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: 'relative', background: T.surface, borderRadius: 16, padding: 28,
          border: '1px solid ' + T.borderLight, minWidth: 520, maxWidth: 640,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 4 }}>{payee}</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>{dateRange} — {payeeChecks.length} check{payeeChecks.length !== 1 ? 's' : ''}</div>

        {/* Header */}
        <div style={{ display: 'flex', padding: '6px 10px', marginBottom: 4, fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div style={{ width: 70 }}>Check #</div>
          <div style={{ width: 90 }}>Date</div>
          <div style={{ flex: 1 }}>Category</div>
          <div style={{ width: 100, textAlign: 'right' }}>Amount</div>
        </div>

        <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 16 }}>
          {payeeChecks.map(function(h) {
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', marginBottom: 3, background: T.grid, borderRadius: 6, border: '1px solid ' + T.borderLight }}>
                <div style={{ width: 70, color: T.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>#{h.check_number}</div>
                <div style={{ width: 90, color: T.text, fontSize: 13 }}>{fmtDate(h.date)}</div>
                <div style={{ flex: 1, color: T.text, fontSize: 13 }}>{h.category}</div>
                <div style={{ width: 100, textAlign: 'right', color: T.text, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(h.amount_cents)}</div>
              </div>
            );
          })}
        </div>

        {/* Total + buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid ' + T.borderLight }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Total: <span style={{ color: T.success, fontVariantNumeric: 'tabular-nums' }}>{fmt(payeeTotal)}</span></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div onClick={onClose}
              style={{ padding: '10px 20px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >Close</div>
            <div onClick={printPayeeReport}
              style={{ padding: '10px 20px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
            >🖨️ Print Report</div>
          </div>
        </div>
      </div>
    </div>
  );
}
