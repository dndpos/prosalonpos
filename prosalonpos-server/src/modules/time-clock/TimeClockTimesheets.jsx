import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { fmt } from '../../lib/formatUtils';
import { api } from '../../lib/apiClient';
import { getCurrentPayPeriod } from '../payroll/payrollDataHelpers';

/**
 * TimeClockTimesheets — Payroll "Timesheets" tab
 *
 * Self-fetches punches for any date range from the API.
 * Supports viewing, adding, editing, and deleting punches for past dates.
 * Shows audit log of all punch changes.
 *
 * Props:
 *   clockPunches    — today's punches from App.jsx (unused now, kept for compat)
 *   onAddPunch      — function(staff_id, type, timestamp) for manual adds
 *   onEditPunch     — function(punchId, { timestamp?, type? }, changedByName)
 *   onDeletePunch   — function(punchId)
 */

var AVATAR_COLORS = ['#1E3A5F', '#064E3B', '#7C2D12', '#4C1D95', '#831843', '#1F2937'];
function getInitials(n) { return (n || '').split(' ').filter(function(w) { return w; }).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2); }

function toDateStr(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function tsMs(ts) { return typeof ts === 'number' ? ts : new Date(ts).getTime(); }

function formatTime(ts) {
  var d = new Date(tsMs(ts));
  var h = d.getHours(); var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

function formatDateShort(d) {
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

function calcDayMinutes(dayPunches) {
  var sorted = dayPunches.slice().sort(function(a, b) { return tsMs(a.timestamp) - tsMs(b.timestamp); });
  var total = 0;
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].type === 'in' && i + 1 < sorted.length && sorted[i + 1].type === 'out') {
      total += (tsMs(sorted[i + 1].timestamp) - tsMs(sorted[i].timestamp)) / 60000;
    }
  }
  return total;
}

var MINS = ['00','05','10','15','20','25','30','35','40','45','50','55'];
var HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];

function TimeSelect({ hour, min, ampm, onHour, onMin, onAmPm, T }) {
  var ss = { padding: '3px 6px', borderRadius: 4, border: '1px solid ' + T.border, background: T.chrome, color: T.text, fontSize: 12 };
  return (
    <>
      <select value={hour} onChange={function(e) { onHour(e.target.value); }} style={ss}>
        {HOURS.map(function(h) { return <option key={h} value={h}>{h}</option>; })}
      </select>
      <span style={{ color: T.textMuted }}>:</span>
      <select value={min} onChange={function(e) { onMin(e.target.value); }} style={ss}>
        {MINS.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
      </select>
      <select value={ampm} onChange={function(e) { onAmPm(e.target.value); }} style={ss}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </>
  );
}

function TypeToggle({ value, onChange, T }) {
  return ['in', 'out'].map(function(t) {
    var active = value === t;
    return (
      <div key={t} onClick={function() { onChange(t); }}
        style={{ padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
          background: active ? (t === 'in' ? (T.success || '#22C55E') : (T.warning || '#F59E0B')) : T.surface,
          color: active ? (t === 'in' ? '#fff' : '#000') : T.textMuted, border: '1px solid ' + T.border }}>
        {t === 'in' ? 'In' : 'Out'}
      </div>
    );
  });
}

function RangeTab({ label, active, onClick, T }) {
  return (
    <div onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', userSelect: 'none',
      background: active ? (T.primary || T.accent) : T.surface,
      color: active ? '#fff' : T.textMuted,
      border: '1px solid ' + (active ? (T.primary || T.accent) : T.border),
    }}>{label}</div>
  );
}

function buildTs(dateStr, hour, min, ampm) {
  var h = parseInt(hour, 10);
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  var parts = dateStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), h, parseInt(min, 10)).getTime();
}

export default function TimeClockTimesheets({ clockPunches, onAddPunch, onEditPunch, onDeletePunch }) {
  var T = useTheme();
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var settings = useSettingsStore(function(s) { return s.settings; });

  var today = toDateStr(new Date());
  var payFreq = settings.pay_frequency || 'biweekly';
  var payStartDay = settings.pay_period_start_day || 'monday';
  var payPeriod = getCurrentPayPeriod(payFreq, payStartDay);

  var [rangeMode, setRangeMode] = useState('period');
  var [startDate, setStartDate] = useState(payPeriod.start);
  var [endDate, setEndDate] = useState(payPeriod.end);
  var [rangePunches, setRangePunches] = useState([]);
  var [fetchLoading, setFetchLoading] = useState(false);
  var mountedRef = useRef(true);

  var [selectedStaff, setSelectedStaff] = useState(null);
  var [showAddPunch, setShowAddPunch] = useState(false);
  var [editingPunchId, setEditingPunchId] = useState(null);
  var [showAuditLog, setShowAuditLog] = useState(false);
  var [auditLogs, setAuditLogs] = useState([]);
  var [auditLoading, setAuditLoading] = useState(false);
  var [confirmClear, setConfirmClear] = useState(false);

  var [addDate, setAddDate] = useState(today);
  var [addInHour, setAddInHour] = useState('9');
  var [addInMin, setAddInMin] = useState('00');
  var [addInAmPm, setAddInAmPm] = useState('AM');
  var [addOutHour, setAddOutHour] = useState('5');
  var [addOutMin, setAddOutMin] = useState('00');
  var [addOutAmPm, setAddOutAmPm] = useState('PM');

  var [edHour, setEdHour] = useState('9');
  var [edMin, setEdMin] = useState('00');
  var [edAmPm, setEdAmPm] = useState('AM');
  var [edType, setEdType] = useState('in');

  useEffect(function() { mountedRef.current = true; return function() { mountedRef.current = false; }; }, []);

  // ── Fetch punches for selected range ──
  // Uses a version counter so we only auto-fetch on explicit user actions,
  // not on date changes caused by expandRangeToInclude (which would race with saves)
  var [fetchVersion, setFetchVersion] = useState(0);
  var startRef = useRef(startDate);
  var endRef = useRef(endDate);
  startRef.current = startDate;
  endRef.current = endDate;

  var fetchRange = useCallback(function() {
    setFetchLoading(true);
    // Use local timezone midnight so punches at 11pm ET aren't lost
    var sd = startRef.current.split('-'); var ed = endRef.current.split('-');
    var localStart = new Date(parseInt(sd[0]), parseInt(sd[1])-1, parseInt(sd[2]), 0, 0, 0, 0);
    var localEnd = new Date(parseInt(ed[0]), parseInt(ed[1])-1, parseInt(ed[2]), 23, 59, 59, 999);
    var s = localStart.toISOString();
    var e = localEnd.toISOString();
    api.get('/timeclock/punches?start=' + encodeURIComponent(s) + '&end=' + encodeURIComponent(e))
      .then(function(data) {
        if (mountedRef.current && data && data.punches) {
          setRangePunches(function(prev) {
            var tempPunches = prev.filter(function(p) { return typeof p.id === 'string' && p.id.indexOf('temp-') === 0; });
            var serverPunches = data.punches;
            var remaining = tempPunches.filter(function(tp) {
              var tpTs = typeof tp.timestamp === 'number' ? tp.timestamp : new Date(tp.timestamp).getTime();
              return !serverPunches.some(function(sp) {
                var spTs = typeof sp.timestamp === 'number' ? sp.timestamp : new Date(sp.timestamp).getTime();
                return sp.staff_id === tp.staff_id && sp.type === tp.type && Math.abs(spTs - tpTs) < 60000;
              });
            });
            return serverPunches.concat(remaining);
          });
        }
      })
      .catch(function(err) { console.warn('[Timesheets] Fetch failed:', err.message); })
      .finally(function() { if (mountedRef.current) setFetchLoading(false); });
  }, []);

  // Auto-fetch on mount and when user explicitly changes range via buttons
  useEffect(function() { fetchRange(); }, [fetchVersion]);

  // Bump version = trigger a fetch (used by range buttons)
  function triggerFetch() { setFetchVersion(function(v) { return v + 1; }); }

  function setToday() { setRangeMode('today'); setStartDate(today); setEndDate(today); setRangePunches([]); setTimeout(triggerFetch, 50); }
  function setPayPeriod() { setRangeMode('period'); setStartDate(payPeriod.start); setEndDate(payPeriod.end); setRangePunches([]); setTimeout(triggerFetch, 50); }
  function setCustom() {
    setRangeMode('custom');
  }
  function handleStartChange(val) {
    if (!val) return;
    setStartDate(val);
    if (val > endDate) setEndDate(val);
    setRangePunches([]); setTimeout(triggerFetch, 50);
  }
  function handleEndChange(val) {
    if (!val) return;
    setEndDate(val);
    if (val < startDate) setStartDate(val);
    setRangePunches([]); setTimeout(triggerFetch, 50);
  }

  var allStaff = storeStaff.filter(function(s) { return s.active; });
  var hourlyStaff = allStaff.filter(function(s) { return s.pay_type === 'hourly'; });

  var staffSummaries = useMemo(function() {
    return hourlyStaff.map(function(staff) {
      var techPunches = rangePunches.filter(function(p) { return p.staff_id === staff.id; });
      var dayMap = {};
      techPunches.forEach(function(p) {
        var d = new Date(tsMs(p.timestamp));
        var dayKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        if (!dayMap[dayKey]) dayMap[dayKey] = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), punches: [] };
        dayMap[dayKey].punches.push(p);
      });
      var totalMinutes = 0; var daysWorked = 0;
      var days = Object.values(dayMap).sort(function(a, b) { return b.date - a.date; });
      days.forEach(function(day) {
        var dm = calcDayMinutes(day.punches);
        if (dm > 0) daysWorked++;
        totalMinutes += dm;
      });
      var lastPunch = techPunches.length > 0 ? techPunches[techPunches.length - 1] : null;
      return { staff: staff, totalHours: Math.round(totalMinutes / 6) / 10, daysWorked: daysWorked, days: days, isClockedIn: lastPunch ? lastPunch.type === 'in' : false };
    });
  }, [rangePunches, hourlyStaff]);

  function handleAddIn() {
    if (!selectedStaff || !onAddPunch) return;
    var ts = buildTs(addDate, addInHour, addInMin, addInAmPm);
    setRangePunches(function(prev) {
      return prev.concat([{ id: 'temp-in-' + Date.now(), staff_id: selectedStaff.id, type: 'in', timestamp: ts, manual: true }]);
    });
    onAddPunch(selectedStaff.id, 'in', ts);
    expandRangeToInclude(addDate);
    scheduleRefetch();
  }

  function handleAddOut() {
    if (!selectedStaff || !onAddPunch) return;
    var ts = buildTs(addDate, addOutHour, addOutMin, addOutAmPm);
    setRangePunches(function(prev) {
      return prev.concat([{ id: 'temp-out-' + Date.now(), staff_id: selectedStaff.id, type: 'out', timestamp: ts, manual: true }]);
    });
    onAddPunch(selectedStaff.id, 'out', ts);
    expandRangeToInclude(addDate);
    scheduleRefetch();
  }

  function handleAddBoth() {
    if (!selectedStaff || !onAddPunch) return;
    var tsIn = buildTs(addDate, addInHour, addInMin, addInAmPm);
    var tsOut = buildTs(addDate, addOutHour, addOutMin, addOutAmPm);
    setRangePunches(function(prev) {
      return prev.concat([
        { id: 'temp-in-' + Date.now(), staff_id: selectedStaff.id, type: 'in', timestamp: tsIn, manual: true },
        { id: 'temp-out-' + (Date.now() + 1), staff_id: selectedStaff.id, type: 'out', timestamp: tsOut, manual: true },
      ]);
    });
    onAddPunch(selectedStaff.id, 'in', tsIn);
    setTimeout(function() {
      onAddPunch(selectedStaff.id, 'out', tsOut);
      expandRangeToInclude(addDate);
      scheduleRefetch();
    }, 300);
    setShowAddPunch(false);
  }

  // If the added date falls outside the current range, expand to include it
  function expandRangeToInclude(dateStr) {
    var changed = false;
    if (dateStr < startDate) { setStartDate(dateStr); changed = true; }
    if (dateStr > endDate) { setEndDate(dateStr); changed = true; }
    if (changed) setRangeMode('custom');
  }

  // Schedule a refetch after a delay to pick up newly saved punches
  var refetchTimer = useRef(null);
  var refetchTimer2 = useRef(null);
  function scheduleRefetch() {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    if (refetchTimer2.current) clearTimeout(refetchTimer2.current);
    refetchTimer.current = setTimeout(triggerFetch, 1500);
    refetchTimer2.current = setTimeout(triggerFetch, 4000); // safety net
  }

  function startEdit(punch) {
    var d = new Date(tsMs(punch.timestamp));
    var h = d.getHours();
    setEdAmPm(h >= 12 ? 'PM' : 'AM');
    setEdHour(String(h % 12 || 12));
    setEdMin(d.getMinutes() < 10 ? '0' + d.getMinutes() : String(d.getMinutes()));
    setEdType(punch.type);
    setEditingPunchId(punch.id);
  }

  function handleEditSave(punch) {
    if (!onEditPunch) return;
    var origTs = tsMs(punch.timestamp);
    var origDate = new Date(origTs);
    var newTs = buildTs(toDateStr(origDate), edHour, edMin, edAmPm);
    var updates = {};
    if (newTs !== origTs) updates.timestamp = newTs;
    if (edType !== punch.type) updates.type = edType;
    if (Object.keys(updates).length === 0) { setEditingPunchId(null); return; }
    onEditPunch(punch.id, updates);
    setEditingPunchId(null);
    scheduleRefetch();
  }

  function handleDel(id) {
    if (!onDeletePunch) return;
    // Optimistic: remove from local rangePunches immediately
    setRangePunches(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
    onDeletePunch(id);
    scheduleRefetch();
  }

  function handleClearAll() {
    if (!selectedStaff) return;
    // Clear locally immediately
    setRangePunches(function(prev) { return prev.filter(function(p) { return p.staff_id !== selectedStaff.id; }); });
    setConfirmClear(false);
    // Call bulk delete on server
    api.post('/timeclock/punches/bulk-delete', {
      staff_id: selectedStaff.id,
      start: startDate + 'T00:00:00.000Z',
      end: endDate + 'T23:59:59.999Z',
    }).then(function(data) {
      scheduleRefetch();
    }).catch(function(err) {
      console.error('[Timesheets] Clear all failed:', err.message);
      scheduleRefetch();
    });
  }

  // ── Audit log ──
  function loadAuditLog(staffId) {
    setAuditLoading(true);
    var s = startDate + 'T00:00:00.000Z';
    var e = endDate + 'T23:59:59.999Z';
    api.get('/timeclock/audit-log?staff_id=' + staffId + '&start=' + encodeURIComponent(s) + '&end=' + encodeURIComponent(e) + '&limit=100')
      .then(function(data) { if (mountedRef.current && data && data.logs) setAuditLogs(data.logs); })
      .catch(function() {})
      .finally(function() { if (mountedRef.current) setAuditLoading(false); });
  }

  function toggleAudit() {
    if (showAuditLog) { setShowAuditLog(false); return; }
    if (selectedStaff) loadAuditLog(selectedStaff.id);
    setShowAuditLog(true);
  }

  function fmtAudit(log) {
    var who = log.changed_by_name || 'Unknown';
    if (log.action === 'created') {
      var nv = log.new_value || {};
      return who + ' added ' + (nv.type || '?') + ' at ' + (nv.timestamp ? formatTime(nv.timestamp) : '?');
    }
    if (log.action === 'edited') {
      var ov = log.old_value || {}; var nvE = log.new_value || {};
      var ch = [];
      if (ov.type !== nvE.type) ch.push(ov.type + ' → ' + nvE.type);
      if (ov.timestamp !== nvE.timestamp) ch.push(formatTime(ov.timestamp) + ' → ' + formatTime(nvE.timestamp));
      return who + ' edited: ' + (ch.join(', ') || 'no change');
    }
    if (log.action === 'deleted') {
      var ovD = log.old_value || {};
      return who + ' deleted ' + (ovD.type || '?') + ' at ' + (ovD.timestamp ? formatTime(ovD.timestamp) : '?');
    }
    return who + ' ' + log.action;
  }

  // ── Shared date range bar ──
  var dateInputStyle = { padding: '5px 8px', borderRadius: 6, border: '1px solid ' + T.border, background: T.surface, color: T.text, fontSize: 12 };
  function RangeBar() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <RangeTab label="Today" active={rangeMode === 'today'} onClick={setToday} T={T} />
        <RangeTab label="Pay Period" active={rangeMode === 'period'} onClick={setPayPeriod} T={T} />
        <RangeTab label="Custom" active={rangeMode === 'custom'} onClick={setCustom} T={T} />
        {rangeMode === 'custom' && (
          <>
            <input type="date" value={startDate} onChange={function(e) { handleStartChange(e.target.value); }} style={dateInputStyle} />
            <span style={{ color: T.textMuted, fontSize: 12 }}>to</span>
            <input type="date" value={endDate} onChange={function(e) { handleEndChange(e.target.value); }} style={dateInputStyle} />
          </>
        )}
        {fetchLoading && <span style={{ fontSize: 11, color: T.textMuted }}>Loading...</span>}
        <div onClick={triggerFetch} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.grid, color: T.text, border: '1px solid ' + T.border, userSelect: 'none', marginLeft: 'auto' }}>
          ↻ Refresh
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════
  if (selectedStaff) {
    var summary = staffSummaries.find(function(s) { return s.staff.id === selectedStaff.id; });
    if (!summary) { setSelectedStaff(null); return null; }
    var sIdx = hourlyStaff.findIndex(function(s) { return s.id === selectedStaff.id; });

    return (
      <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
        <div style={{ maxWidth: 720 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div onClick={function() { setSelectedStaff(null); setShowAddPunch(false); setShowAuditLog(false); setEditingPunchId(null); }}
              style={{ fontSize: 13, fontWeight: 600, color: T.primary || T.accent, cursor: 'pointer', padding: '6px 14px', borderRadius: 6, border: '1px solid ' + (T.primary || T.accent), userSelect: 'none' }}>
              ← Back
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: AVATAR_COLORS[sIdx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              {getInitials(selectedStaff.display_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{selectedStaff.display_name}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {fmt(selectedStaff.hourly_rate_cents || 0)}/hr · {summary.totalHours} hrs · {summary.daysWorked} days
              </div>
            </div>
            <div onClick={toggleAudit}
              style={{ fontSize: 11, fontWeight: 600, color: showAuditLog ? '#fff' : T.textMuted, cursor: 'pointer', padding: '5px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: showAuditLog ? (T.primary || T.accent) : 'transparent', userSelect: 'none' }}>
              Audit Log
            </div>
            {!confirmClear ? (
              <div onClick={function() { setConfirmClear(true); }}
                style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, cursor: 'pointer', padding: '5px 12px', borderRadius: 6, border: '1px solid ' + T.border, userSelect: 'none' }}>
                Clear All
              </div>
            ) : (
              <div onClick={handleClearAll}
                style={{ fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, border: '1px solid ' + (T.danger || '#EF4444'), background: T.danger || '#EF4444', userSelect: 'none' }}>
                Confirm Clear
              </div>
            )}
            <div onClick={function() { setShowAddPunch(!showAddPunch); setAddDate(today); setConfirmClear(false); }}
              style={{ fontSize: 12, fontWeight: 600, color: T.accent, cursor: 'pointer', padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.accent, userSelect: 'none' }}>
              + Add Punch
            </div>
          </div>

          <RangeBar />

          {/* Audit Log */}
          {showAuditLog && (
            <div style={{ marginBottom: 16, background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, padding: 16, maxHeight: 250, overflow: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Change History</div>
              {auditLoading ? (
                <div style={{ fontSize: 12, color: T.textMuted }}>Loading...</div>
              ) : auditLogs.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted }}>No changes recorded for this period.</div>
              ) : (
                auditLogs.map(function(log) {
                  var ld = new Date(log.created_at);
                  return (
                    <div key={log.id} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 12, borderBottom: '1px solid ' + T.border }}>
                      <span style={{ color: T.textMuted, minWidth: 120, flexShrink: 0 }}>{formatDateShort(ld)} {formatTime(ld.getTime())}</span>
                      <span style={{ color: log.action === 'deleted' ? (T.danger || '#EF4444') : log.action === 'edited' ? (T.warning || '#F59E0B') : (T.success || '#22C55E'), fontWeight: 500, minWidth: 55 }}>{log.action}</span>
                      <span style={{ color: T.text, flex: 1 }}>{fmtAudit(log)}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Add Punch Form */}
          {showAddPunch && (
            <div style={{ marginBottom: 16, background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, padding: '12px 16px' }}>
              {/* Date row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Date:</span>
                <input type="date" value={addDate} onChange={function(e) { setAddDate(e.target.value); }} style={dateInputStyle} />
              </div>
              {/* Clock In row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.success || '#22C55E', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.success || '#22C55E', minWidth: 60 }}>Clock In</span>
                <TimeSelect hour={addInHour} min={addInMin} ampm={addInAmPm} onHour={setAddInHour} onMin={setAddInMin} onAmPm={setAddInAmPm} T={T} />
                <div onClick={handleAddIn}
                  style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.success || '#22C55E', color: '#fff', userSelect: 'none' }}>
                  Save In
                </div>
              </div>
              {/* Clock Out row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.warning || '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.warning || '#F59E0B', minWidth: 60 }}>Clock Out</span>
                <TimeSelect hour={addOutHour} min={addOutMin} ampm={addOutAmPm} onHour={setAddOutHour} onMin={setAddOutMin} onAmPm={setAddOutAmPm} T={T} />
                <div onClick={handleAddOut}
                  style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.warning || '#F59E0B', color: '#000', userSelect: 'none' }}>
                  Save Out
                </div>
              </div>
              {/* Save Both shortcut */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <div onClick={handleAddBoth}
                  style={{ padding: '5px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: T.primary || T.accent, color: '#fff', userSelect: 'none' }}>
                  Save Both
                </div>
              </div>
            </div>
          )}

          {/* Day breakdown */}
          {summary.days.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No punches for this period</div>
          ) : (
            summary.days.map(function(day) {
              var dayMins = calcDayMinutes(day.punches);
              var dayHrs = Math.round(dayMins / 6) / 10;
              var sorted = day.punches.slice().sort(function(a, b) { return tsMs(a.timestamp) - tsMs(b.timestamp); });
              return (
                <div key={day.date.getTime()} style={{ marginBottom: 12, background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid ' + T.border }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{formatDateShort(day.date)}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 12, color: T.textMuted }}>{dayHrs} hrs</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: T.accent }}>{formatHrsMin(dayMins)}</span>
                    </div>
                  </div>
                  <div style={{ padding: '6px 16px' }}>
                    {sorted.map(function(punch) {
                      if (editingPunchId === punch.id) {
                        return (
                          <div key={punch.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', margin: '4px 0', background: T.surface, borderRadius: 6, fontSize: 12 }}>
                            <TypeToggle value={edType} onChange={setEdType} T={T} />
                            <TimeSelect hour={edHour} min={edMin} ampm={edAmPm} onHour={setEdHour} onMin={setEdMin} onAmPm={setEdAmPm} T={T} />
                            <div onClick={function() { handleEditSave(punch); }}
                              style={{ padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.success || '#22C55E', color: '#fff', userSelect: 'none' }}>Save</div>
                            <div onClick={function() { setEditingPunchId(null); }}
                              style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: T.textMuted, userSelect: 'none' }}>Cancel</div>
                          </div>
                        );
                      }
                      return (
                        <div key={punch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: punch.type === 'in' ? (T.success || '#22C55E') : (T.warning || '#F59E0B') }} />
                          <span style={{ color: T.text, fontWeight: 500, minWidth: 60 }}>{punch.type === 'in' ? 'Clock In' : 'Clock Out'}</span>
                          <span onClick={function() { startEdit(punch); }}
                            style={{ color: T.accent || T.primary, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                            {formatTime(punch.timestamp)}
                          </span>
                          {punch.manual && <span style={{ fontSize: 10, color: T.textMuted, fontStyle: 'italic' }}>manual</span>}
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            <span onClick={function() { startEdit(punch); }} style={{ color: T.accent || T.primary, cursor: 'pointer', fontSize: 11, userSelect: 'none' }}>✎</span>
                            {onDeletePunch && (
                              <span onClick={function() { handleDel(punch.id); }} style={{ color: T.danger || '#EF4444', cursor: 'pointer', fontSize: 11, userSelect: 'none' }}>✕</span>
                            )}
                          </span>
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

  // ═══════════════════════════════════
  // OVERVIEW — all hourly staff
  // ═══════════════════════════════════
  return (
    <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 700 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Hourly Employee Timesheets</div>
        <RangeBar />
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
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                    {getInitials(item.staff.display_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{item.staff.display_name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                      {fmt(item.staff.hourly_rate_cents || 0)}/hr{item.staff.commission_bonus_enabled ? ' + Commission' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: item.isClockedIn ? (T.success || '#22C55E') : T.textMuted }}>
                      {item.isClockedIn ? 'Clocked In' : 'Out'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.totalHours} hrs</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{item.daysWorked} days · {fmt(earnedCents)}</div>
                  </div>
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
