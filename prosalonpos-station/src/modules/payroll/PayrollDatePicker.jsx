import { useTheme } from '../../lib/ThemeContext';

/**
 * PayrollDatePicker — Dual calendar date range picker for payroll period selection.
 * Extracted from PayrollModule.jsx for 800-line compliance.
 */

var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DateRangePicker({ show, pickStart, pickEnd, setPickStart, setPickEnd, leftMonth, rightMonth, setLeftMonth, setRightMonth, onApply, onClose }) {
  var T = useTheme();
  if (!show || !leftMonth || !rightMonth) return null;

  function toStr(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function handleDayClick(dateStr) {
    if (!pickStart || (pickStart && pickEnd)) {
      setPickStart(dateStr);
      setPickEnd(null);
    } else {
      if (dateStr < pickStart) {
        setPickEnd(pickStart);
        setPickStart(dateStr);
      } else {
        setPickEnd(dateStr);
      }
    }
  }

  function shiftMonth(side, dir) {
    var setter = side === 'left' ? setLeftMonth : setRightMonth;
    var cur = side === 'left' ? leftMonth : rightMonth;
    var nm = cur.month + dir;
    var ny = cur.year;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setter({ year: ny, month: nm });
  }

  function renderCalendar(mo, side) {
    var year = mo.year;
    var month = mo.month;
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var cells = [];
    for (var i = 0; i < firstDay; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div style={{ flex: 1, minWidth: 280 }}>
        {/* Month header with arrows */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
          <div onClick={function() { shiftMonth(side, -1); }}
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.grid, cursor: 'pointer', fontSize: 20, color: T.text, fontWeight: 600, userSelect: 'none' }}>‹</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>{MONTH_NAMES[month]} {year}</div>
          <div onClick={function() { shiftMonth(side, 1); }}
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.grid, cursor: 'pointer', fontSize: 20, color: T.text, fontWeight: 600, userSelect: 'none' }}>›</div>
        </div>

        {/* Day name headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
          {DAY_NAMES.map(function(dn) {
            return <div key={dn} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.text, padding: '6px 0' }}>{dn}</div>;
          })}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map(function(day, idx) {
            if (day === null) return <div key={'e' + idx} />;
            var dateStr = toStr(year, month, day);
            var isStart = dateStr === pickStart;
            var isEnd = dateStr === pickEnd;
            var isInRange = pickStart && pickEnd && dateStr > pickStart && dateStr < pickEnd;
            var isSelected = isStart || isEnd;

            var bg = 'transparent';
            var color = T.text;
            var borderRad = 8;
            if (isSelected) { bg = T.primary; color = '#FFFFFF'; }
            else if (isInRange) { bg = T.primary + '30'; }

            return (
              <div key={dateStr} onClick={function() { handleDayClick(dateStr); }}
                style={{
                  height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: isSelected ? 700 : 500, color: color,
                  background: bg, borderRadius: borderRad, cursor: 'pointer',
                  userSelect: 'none', transition: 'background 100ms',
                }}
                onMouseEnter={function(e) { if (!isSelected && !isInRange) e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { if (!isSelected && !isInRange) e.currentTarget.style.background = 'transparent'; }}
              >{day}</div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      {/* Modal */}
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: 'relative', background: T.surface, borderRadius: 16, padding: 28,
          border: '1px solid ' + T.borderLight, minWidth: 660, maxWidth: 740,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>Select Pay Period</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {pickStart && <span style={{ fontSize: 14, color: T.primaryLight, fontWeight: 500 }}>
              {new Date(pickStart + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {pickEnd ? ' – ' + new Date(pickEnd + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ' – select end date'}
            </span>}
          </div>
        </div>

        {/* Labels */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</div>
        </div>

        {/* Two calendars side by side */}
        <div style={{ display: 'flex', gap: 24 }}>
          {renderCalendar(leftMonth, 'left')}
          <div style={{ width: 1, background: T.borderLight, flexShrink: 0 }} />
          {renderCalendar(rightMonth, 'right')}
        </div>

        {/* Bottom buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <div onClick={onClose}
            style={{ padding: '14px 32px', background: T.grid, color: T.text, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >Cancel</div>
          <div onClick={function() { if (pickStart && pickEnd) onApply(pickStart, pickEnd); }}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
              background: (pickStart && pickEnd) ? T.primary : T.grid,
              color: (pickStart && pickEnd) ? '#FFFFFF' : T.text,
              opacity: (pickStart && pickEnd) ? 1 : 0.5,
            }}
            onMouseEnter={function(e) { if (pickStart && pickEnd) e.currentTarget.style.background = '#1D4FD7'; }}
            onMouseLeave={function(e) { if (pickStart && pickEnd) e.currentTarget.style.background = T.primary; }}
          >Apply</div>
        </div>
      </div>
    </div>
  );
}
