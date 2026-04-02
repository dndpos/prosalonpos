import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import PinPopup from '../../components/ui/PinPopup';
import { useStaffStore } from '../../lib/stores/staffStore';

/**
 * TimeClockPopup — TD-056 Time Clock Module (Session 38)
 *
 * Flow:
 *   1. PinPopup appears → staff enters PIN
 *   2. If hourly tech → show "Clock In?" or "Clock Out?" confirmation
 *   3. If owner/manager → show list of all hourly techs with statuses, tap to toggle
 *   4. If non-hourly tech → show "Hourly tracking not enabled" message
 *
 * Props:
 *   show            — boolean
 *   clockPunches    — array of { id, staff_id, type:'in'|'out', timestamp }
 *   onPunch         — function(staff_id, type) — records a punch
 *   onDismiss       — function() — close popup
 */
export default function TimeClockPopup({ show, clockPunches, onPunch, onDismiss }) {
  var T = useTheme();
  var [phase, setPhase] = useState('pin'); // 'pin' | 'confirm' | 'manager_list' | 'not_hourly'
  var [identifiedStaff, setIdentifiedStaff] = useState(null);
  var [selectedTech, setSelectedTech] = useState(null); // for manager flow
  var [confirmTarget, setConfirmTarget] = useState(null); // { staff, isIn, punchType }

  var storeStaff = useStaffStore(function(s) { return s.staff; });

  if (!show) return null;

  var allStaff = storeStaff.filter(function(s) { return s.active; });
  var hourlyStaff = allStaff.filter(function(s) { return s.pay_type === 'hourly'; });

  function getClockStatus(staffId) {
    // Find the most recent punch for this staff member
    var punches = (clockPunches || []).filter(function(p) { return p.staff_id === staffId; });
    if (punches.length === 0) return { isClockedIn: false, lastPunch: null };
    var last = punches[punches.length - 1];
    return { isClockedIn: last.type === 'in', lastPunch: last };
  }

  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function getTodayHours(staffId) {
    var now = new Date();
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var punches = (clockPunches || []).filter(function(p) {
      return p.staff_id === staffId && p.timestamp >= dayStart;
    });
    if (punches.length === 0) return 0;
    var totalMs = 0;
    for (var i = 0; i < punches.length; i++) {
      if (punches[i].type === 'in') {
        var outTime = null;
        if (i + 1 < punches.length && punches[i + 1].type === 'out') {
          outTime = punches[i + 1].timestamp;
        } else if (punches[i].type === 'in' && i === punches.length - 1) {
          outTime = Date.now(); // still clocked in
        }
        if (outTime) totalMs += outTime - punches[i].timestamp;
      }
    }
    return Math.round(totalMs / 60000) / 60; // hours with 1 decimal
  }

  function handlePinSuccess(staff) {
    setIdentifiedStaff(staff);
    var isManager = staff.rbac_role === 'owner' || staff.rbac_role === 'manager';

    if (isManager) {
      // Show the list of hourly employees
      setPhase('manager_list');
    } else if (staff.pay_type === 'hourly') {
      // Show clock in/out confirmation for this tech
      var status = getClockStatus(staff.id);
      setConfirmTarget({
        staff: staff,
        isClockedIn: status.isClockedIn,
        punchType: status.isClockedIn ? 'out' : 'in',
      });
      setPhase('confirm');
    } else {
      // Non-hourly tech
      setPhase('not_hourly');
    }
  }

  function handleConfirm() {
    if (!confirmTarget) return;
    onPunch(confirmTarget.staff.id, confirmTarget.punchType);
    handleClose();
  }

  function handleManagerPickTech(tech) {
    var status = getClockStatus(tech.id);
    setConfirmTarget({
      staff: tech,
      isClockedIn: status.isClockedIn,
      punchType: status.isClockedIn ? 'out' : 'in',
    });
    setSelectedTech(tech);
    setPhase('confirm');
  }

  function handleBackToList() {
    setSelectedTech(null);
    setConfirmTarget(null);
    setPhase('manager_list');
  }

  function handleClose() {
    setPhase('pin');
    setIdentifiedStaff(null);
    setSelectedTech(null);
    setConfirmTarget(null);
    onDismiss();
  }

  // ── PIN PHASE ──
  if (phase === 'pin') {
    return (
      <PinPopup
        show={true}
        title="Clock In / Out"
        staffList={allStaff}
        onSuccess={handlePinSuccess}
        onCancel={handleClose}
      />
    );
  }

  // ── OVERLAY WRAPPER ──
  var overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 300,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '18vh',
  };

  var AVATAR_COLORS = ['#1E3A5F', '#064E3B', '#7C2D12', '#4C1D95', '#831843', '#1F2937', '#0E4429', '#6B21A8'];
  function getInitials(n) { return (n || '').split(' ').filter(function(w) { return w; }).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2); }

  // ── NOT HOURLY ──
  if (phase === 'not_hourly') {
    return (
      <div style={overlay} onClick={handleClose}>
        <div onClick={function(e) { e.stopPropagation(); }}
          style={{ backgroundColor: T.surface, border: '1px solid ' + T.border, borderRadius: 12, width: 380, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 10 }}>
            Hourly Tracking Not Enabled
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 24, lineHeight: '1.5' }}>
            {identifiedStaff ? identifiedStaff.display_name : 'This staff member'} is not set up for hourly pay. Clock in/out is only available for hourly employees.
          </div>
          <div onClick={handleClose}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', border: 'none', userSelect: 'none' }}>
            OK
          </div>
        </div>
      </div>
    );
  }

  // ── CONFIRM CLOCK IN/OUT ──
  if (phase === 'confirm' && confirmTarget) {
    var target = confirmTarget;
    var todayHrs = getTodayHours(target.staff.id);
    var status = getClockStatus(target.staff.id);
    var actionLabel = target.punchType === 'in' ? 'Clock In' : 'Clock Out';
    var actionColor = target.punchType === 'in' ? (T.success || '#22C55E') : (T.warning || '#F59E0B');
    var staffIdx = allStaff.findIndex(function(s) { return s.id === target.staff.id; });

    return (
      <div style={overlay} onClick={handleClose}>
        <div onClick={function(e) { e.stopPropagation(); }}
          style={{ backgroundColor: T.surface, border: '1px solid ' + T.border, borderRadius: 12, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid ' + T.border, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: AVATAR_COLORS[staffIdx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
              {getInitials(target.staff.display_name)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{target.staff.display_name}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                {target.isClockedIn ? 'Currently clocked in' : 'Currently clocked out'}
                {status.lastPunch ? ' · Last: ' + formatTime(status.lastPunch.timestamp) : ''}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: T.text, marginBottom: 8 }}>
              {target.punchType === 'in' ? 'Ready to start your shift?' : 'Ending your shift?'}
            </div>
            {todayHrs > 0 && (
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 4 }}>
                Today: {todayHrs.toFixed(1)} hrs worked
              </div>
            )}
            {identifiedStaff && identifiedStaff.id !== target.staff.id && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, fontStyle: 'italic' }}>
                Clocked {target.punchType === 'in' ? 'in' : 'out'} by {identifiedStaff.display_name}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
            <div onClick={selectedTech ? handleBackToList : handleClose}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: T.chrome, color: T.text, border: '1px solid ' + T.border, userSelect: 'none' }}>
              {selectedTech ? '← Back' : 'Cancel'}
            </div>
            <div onClick={handleConfirm}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: actionColor, color: target.punchType === 'in' ? '#fff' : '#000', border: 'none', userSelect: 'none' }}>
              {actionLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MANAGER LIST — pick hourly tech ──
  if (phase === 'manager_list') {
    return (
      <div style={overlay} onClick={handleClose}>
        <div onClick={function(e) { e.stopPropagation(); }}
          style={{ backgroundColor: T.surface, border: '1px solid ' + T.border, borderRadius: 12, width: 440, maxHeight: '60vh', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + T.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Clock In / Out</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                Managing as {identifiedStaff ? identifiedStaff.display_name : 'Manager'} — tap a tech to clock them in or out
              </div>
            </div>
            <div onClick={handleClose}
              style={{ fontSize: 18, color: T.textMuted, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, userSelect: 'none' }}>
              ✕
            </div>
          </div>

          {/* Tech list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {hourlyStaff.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                No hourly employees found
              </div>
            ) : (
              hourlyStaff.map(function(tech, idx) {
                var status = getClockStatus(tech.id);
                var todayHrs = getTodayHours(tech.id);
                var dotColor = status.isClockedIn ? (T.success || '#22C55E') : (T.textMuted || '#6B7280');
                var statusLabel = status.isClockedIn ? 'Clocked In' : 'Clocked Out';
                return (
                  <div key={tech.id} onClick={function() { handleManagerPickTech(tech); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid ' + T.border }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.raised || T.chrome; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>
                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {getInitials(tech.display_name)}
                    </div>
                    {/* Name + status */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{tech.display_name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                        ${(tech.hourly_rate_cents / 100).toFixed(2)}/hr
                        {todayHrs > 0 ? ' · ' + todayHrs.toFixed(1) + ' hrs today' : ''}
                      </div>
                    </div>
                    {/* Status dot + label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: status.isClockedIn ? (T.success || '#22C55E') : T.textMuted }}>
                        {statusLabel}
                      </span>
                    </div>
                    {/* Last punch time */}
                    {status.lastPunch && (
                      <div style={{ fontSize: 11, color: T.textMuted, minWidth: 60, textAlign: 'right' }}>
                        {formatTime(status.lastPunch.timestamp)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
