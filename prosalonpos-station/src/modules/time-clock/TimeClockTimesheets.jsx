import { useState, useMemo } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { useStaffStore } from '../../lib/stores/staffStore';
import PinPopup from '../../components/ui/PinPopup';
import { fmt } from '../../lib/formatUtils';

/**
 * TimeClockTimesheets — Payroll "Timesheets" tab (TD-056, Session 38)
 *
 * Shows punch records for hourly staff. Owner can view daily breakdowns
 * and add/edit missed punches.
 *
 * Props:
 *   clockPunches    — array of { id, staff_id, type:'in'|'out', timestamp }
 *   onAddPunch      — function(staff_id, type, timestamp) — for manual corrections
 *   onDeletePunch   — function(punchId) — remove a bad punch
 */

var AVATAR_COLORS = ['#1E3A5F', '#064E3B', '#7C2D12', '#4C1D95', '#831843', '#1F2937'];
function getInitials(n) { return (n || '').split(' ').filter(function(w) { return w; }).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2); }

export default function TimeClockTimesheets({ clockPunches, onAddPunch, onDeletePunch }) {
  var T = useTheme();
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var [selectedStaff, setSelectedStaff] = useState(null);
  var [showAddPunch, setShowAddPunch] = useState(false);
  var [addPunchType, setAddPunchType] = useState('in');
  var [addPunchHour, setAddPunchHour] = useState('9');
  var [addPunchMin, setAddPunchMin] = useState('00');
  var [addPunchAmPm, setAddPunchAmPm] = useState('AM');

  var allStaff = storeStaff.filter(function(s) { return s.active; });
  var hourlyStaff = allStaff.filter(function(s) { return s.pay_type === 'hourly'; });
  var punches = clockPunches || [];

  // ── Compute summary per hourly tech ──
  var staffSummaries = useMemo(function() {
    return hourlyStaff.map(function(staff) {
      var techPunches = punches.filter(function(p) { return p.staff_id === staff.id; });
      // Group punches by day
      var dayMap = {};
      techPunches.forEach(function(p) {
        var d = new Date(p.timestamp);
        var dayKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        if (!dayMap[dayKey]) dayMap[dayKey] = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), punches: [] };
        dayMap[dayKey].punches.push(p);
      });
      // Calc total hours
      var totalMinutes = 0;
      var daysWorked = 0;
      var days = Object.values(dayMap).sort(function(a, b) { return b.date - a.date; });
      days.forEach(function(day) {
        var dayMins = calcDayMinutes(day.punches);
        if (dayMins > 0) daysWorked++;
        totalMinutes += dayMins;
      });
      // Current status
      var lastPunch = techPunches.length > 0 ? techPunches[techPunches.length - 1] : null;
      var isClockedIn = lastPunch ? lastPunch.type === 'in' : false;
      return {
        staff: staff,
        totalHours: Math.round(totalMinutes / 6) / 10, // 1 decimal
        daysWorked: daysWorked,
        days: days,
        isClockedIn: isClockedIn,
        lastPunch: lastPunch,
        punches: techPunches,
      };
    });
  }, [punches, hourlyStaff]);

  function calcDayMinutes(dayPunches) {
    var sorted = dayPunches.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
    var total = 0;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].type === 'in') {
        var outTs = null;
        if (i + 1 < sorted.length && sorted[i + 1].type === 'out') {
          outTs = sorted[i + 1].timestamp;
        }
        if (outTs) total += (outTs - sorted[i].timestamp) / 60000;
      }
    }
    return total;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var h = d.getHours(); var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function formatDate(d) {
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }

  function formatHrsMin(mins) {
    var h = Math.floor(mins / 60);
    var m = Math.round(mins % 60);
    if (h === 0) return m + 'm';
    return h + 'h ' + m + 'm';
  }

  function handleAddPunchSubmit() {
    if (!selectedStaff || !onAddPunch) return;
    var hour = parseInt(addPunchHour, 10);
    if (addPunchAmPm === 'PM' && hour < 12) hour += 12;
    if (addPunchAmPm === 'AM' && hour === 12) hour = 0;
    var now = new Date();
    var ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, parseInt(addPunchMin, 10)).getTime();
    onAddPunch(selectedStaff.id, addPunchType, ts);
    setShowAddPunch(false);
  }

  // ── DETAIL VIEW — single tech ──
  if (selectedStaff) {
    var summary = staffSummaries.find(function(s) { return s.staff.id === selectedStaff.id; });
    if (!summary) { setSelectedStaff(null); return null; }
    var staffIdx = hourlyStaff.findIndex(function(s) { return s.id === selectedStaff.id; });

    return (
      <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
        <div style={{ maxWidth: 700 }}>
        {/* Back + Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div onClick={function() { setSelectedStaff(null); setShowAddPunch(false); }}
            style={{ fontSize: 13, fontWeight: 600, color: T.primary || T.accent, cursor: 'pointer', padding: '6px 14px', borderRadius: 6, border: '1px solid ' + (T.primary || T.accent), userSelect: 'none' }}>
            ← Back
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: AVATAR_COLORS[staffIdx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            {getInitials(selectedStaff.display_name)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{selectedStaff.display_name}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {fmt(selectedStaff.hourly_rate_cents || 0)}/hr · {summary.totalHours} hrs total · {summary.daysWorked} days
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {/* Add Punch button */}
          <div onClick={function() { setShowAddPunch(!showAddPunch); }}
            style={{ fontSize: 12, fontWeight: 600, color: T.accent, cursor: 'pointer', padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.accent, userSelect: 'none' }}>
            + Add Punch
          </div>
        </div>

        {/* Add Punch Form (inline) */}
        {showAddPunch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Type:</span>
            {['in', 'out'].map(function(t) {
              return (
                <div key={t} onClick={function() { setAddPunchType(t); }}
                  style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none', background: addPunchType === t ? (t === 'in' ? (T.success || '#22C55E') : (T.warning || '#F59E0B')) : T.surface, color: addPunchType === t ? (t === 'in' ? '#fff' : '#000') : T.text, border: '1px solid ' + T.border }}>
                  {t === 'in' ? 'Clock In' : 'Clock Out'}
                </div>
              );
            })}
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, marginLeft: 8 }}>Time:</span>
            {/* Hour picker */}
            <select value={addPunchHour} onChange={function(e) { setAddPunchHour(e.target.value); }}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + T.border, background: T.surface, color: T.text, fontSize: 12 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(function(h) {
                return <option key={h} value={h}>{h}</option>;
              })}
            </select>
            <span style={{ color: T.textMuted }}>:</span>
            <select value={addPunchMin} onChange={function(e) { setAddPunchMin(e.target.value); }}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + T.border, background: T.surface, color: T.text, fontSize: 12 }}>
              {['00','15','30','45'].map(function(m) {
                return <option key={m} value={m}>{m}</option>;
              })}
            </select>
            <select value={addPunchAmPm} onChange={function(e) { setAddPunchAmPm(e.target.value); }}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + T.border, background: T.surface, color: T.text, fontSize: 12 }}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
            <div onClick={handleAddPunchSubmit}
              style={{ padding: '5px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: T.primary || T.accent, color: '#fff', border: 'none', userSelect: 'none', marginLeft: 4 }}>
              Save
            </div>
          </div>
        )}

        {/* Day-by-day breakdown */}
        {summary.days.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            No punches recorded
          </div>
        ) : (
          summary.days.map(function(day) {
            var dayMins = calcDayMinutes(day.punches);
            var sorted = day.punches.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
            return (
              <div key={day.date.getTime()} style={{ marginBottom: 12, background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, overflow: 'hidden' }}>
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid ' + T.border }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{formatDate(day.date)}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.accent }}>{formatHrsMin(dayMins)}</span>
                </div>
                {/* Punch rows */}
                <div style={{ padding: '6px 16px' }}>
                  {sorted.map(function(punch) {
                    return (
                      <div key={punch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: punch.type === 'in' ? (T.success || '#22C55E') : (T.warning || '#F59E0B') }} />
                        <span style={{ color: T.text, fontWeight: 500, minWidth: 60 }}>
                          {punch.type === 'in' ? 'Clock In' : 'Clock Out'}
                        </span>
                        <span style={{ color: T.textMuted }}>{formatTime(punch.timestamp)}</span>
                        {onDeletePunch && (
                          <span onClick={function() { onDeletePunch(punch.id); }}
                            style={{ marginLeft: 'auto', color: T.danger || '#EF4444', cursor: 'pointer', fontSize: 11, userSelect: 'none' }}>
                            ✕
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    );
  }

  // ── OVERVIEW — all hourly staff ──
  return (
    <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
        Hourly Employee Timesheets
      </div>

      {hourlyStaff.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
          No hourly employees. Set an hourly rate on a staff profile to enable time tracking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffSummaries.map(function(item, idx) {
            var dotColor = item.isClockedIn ? (T.success || '#22C55E') : (T.textMuted || '#6B7280');
            var earnedCents = Math.round(item.totalHours * (item.staff.hourly_rate_cents || 0));
            return (
              <div key={item.staff.id} onClick={function() { setSelectedStaff(item.staff); }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, cursor: 'pointer' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = T.accent || T.primary; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = T.border; }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                  {getInitials(item.staff.display_name)}
                </div>
                {/* Name + pay info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{item.staff.display_name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    {fmt(item.staff.hourly_rate_cents || 0)}/hr
                    {item.staff.commission_bonus_enabled ? ' + Commission' : ''}
                  </div>
                </div>
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: item.isClockedIn ? (T.success || '#22C55E') : T.textMuted }}>
                    {item.isClockedIn ? 'Clocked In' : 'Out'}
                  </span>
                </div>
                {/* Hours + Earnings */}
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.totalHours} hrs</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{item.daysWorked} days · {fmt(earnedCents)}</div>
                </div>
                {/* Arrow */}
                <span style={{ fontSize: 14, color: T.textMuted }}>›</span>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
