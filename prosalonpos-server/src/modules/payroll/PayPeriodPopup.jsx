import { useTheme } from '../../lib/ThemeContext';
/**
 * PayPeriodPopup.jsx — Pay Period Settings popup
 * Session 100: Extracted from PayrollModule to keep under 800-line limit.
 *
 * Three modes: weekly, biweekly, bi-monthly (bimonthly).
 * Weekly/biweekly: pick start day (Mon–Sun).
 * Bi-monthly: fixed 1st–15th and 16th–end, no day picker.
 */

export default function PayPeriodPopup({ payFrequency, payPeriodStartDay, onUpdateSetting, onClose }) {
  var T = useTheme();

  var DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  function endDay(startDay) {
    var idx = DAY_NAMES.indexOf(startDay);
    var endIdx = (idx + 6) % 7;
    return DAY_NAMES[endIdx].charAt(0).toUpperCase() + DAY_NAMES[endIdx].slice(1);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, border: '1px solid ' + T.border, borderRadius: 12, padding: 28, width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 20 }}>Pay Period Settings</div>

        {/* Frequency selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 8 }}>Pay Frequency</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'weekly', label: 'Weekly', desc: 'Every 7 days' },
              { key: 'biweekly', label: 'Biweekly', desc: 'Every 14 days' },
              { key: 'bimonthly', label: 'Bi-Monthly', desc: '1st–15th & 16th–end' },
            ].map(function(opt) {
              var isActive = payFrequency === opt.key;
              return (
                <div key={opt.key} onClick={function() { onUpdateSetting('pay_frequency', opt.key); }}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: isActive ? '#3B0764' : T.grid,
                    border: isActive ? '2px solid #7C3AED' : '1px solid ' + T.border,
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = isActive ? '#3B0764' : T.grid; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? '#E879F9' : T.text, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: isActive ? '#C084FC' : T.textMuted }}>{opt.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start day — only for weekly and biweekly */}
        {payFrequency !== 'bimonthly' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 8 }}>Period Start Day</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DAY_NAMES.map(function(day) {
                var isActive = payPeriodStartDay === day;
                var short = day.charAt(0).toUpperCase() + day.slice(1, 3);
                return (
                  <div key={day} onClick={function() { onUpdateSetting('pay_period_start_day', day); }}
                    style={{
                      padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: isActive ? '#3B0764' : T.grid,
                      color: isActive ? '#E879F9' : T.text,
                      border: isActive ? '2px solid #7C3AED' : '1px solid ' + T.border,
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = T.gridHover; }}
                    onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = isActive ? '#3B0764' : T.grid; }}
                  >{short}</div>
                );
              })}
            </div>
          </div>
        )}

        {payFrequency === 'bimonthly' && (
          <div style={{ padding: '12px 14px', background: T.grid, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 500, marginBottom: 4 }}>Fixed periods:</div>
            <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
              Period 1: 1st – 15th of each month<br/>
              Period 2: 16th – end of month
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{ padding: '12px 14px', background: T.grid, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            {payFrequency === 'weekly' && ('Every week, ' + payPeriodStartDay.charAt(0).toUpperCase() + payPeriodStartDay.slice(1) + ' to ' + endDay(payPeriodStartDay))}
            {payFrequency === 'biweekly' && ('Every 2 weeks, ' + payPeriodStartDay.charAt(0).toUpperCase() + payPeriodStartDay.slice(1) + ' to ' + endDay(payPeriodStartDay) + ' (2 weeks)')}
            {payFrequency === 'bimonthly' && 'Twice a month: 1st–15th and 16th–end'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={onClose}
            style={{ padding: '10px 24px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          >Done</div>
        </div>
      </div>
    </div>
  );
}
