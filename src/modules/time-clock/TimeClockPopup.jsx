import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import PinPopup from '../../components/ui/PinPopup';
import { useStaffStore } from '../../lib/stores/staffStore';
import AreaTag from '../../components/ui/AreaTag';

/**
 * TimeClockPopup — Clock In / Sign In for ALL staff
 *
 * Flow:
 *   1. PinPopup appears → staff enters PIN
 *   2. Any tech → show "Clock In?" or "Clock Out?" / "Sign In?" or "Sign Out?" confirmation
 *   3. If owner/manager → show list of ALL active techs with statuses, tap to toggle
 *
 * Hourly staff: creates clock punch (tracked on timesheet for payroll)
 * Non-hourly staff: creates presence record (turn system only, no timesheet)
 *
 * Props:
 *   show              — boolean
 *   clockPunches      — array of { id, staff_id, type:'in'|'out', timestamp }
 *   presenceRecords   — array of { id, staff_id, status:'in'|'out', timestamp }
 *   onPunch           — function(staff_id, type) — records a clock punch (hourly)
 *   onPresencePunch   — function(staff_id, status) — records presence (non-hourly)
 *   onDismiss         — function() — close popup
 */
export default function TimeClockPopup({ show, clockPunches, presenceRecords, onPunch, onPresencePunch, onDismiss }) {
  var T = useTheme();
  var [phase, setPhase] = useState('pin'); // 'pin' | 'confirm' | 'manager_list'
  var [identifiedStaff, setIdentifiedStaff] = useState(null);
  var [selectedTech, setSelectedTech] = useState(null);
  var [confirmTarget, setConfirmTarget] = useState(null); // { staff, isIn, punchType }

  var storeStaff = useStaffStore(function(s) { return s.staff; });

  if (!show) return null;

  var allStaff = storeStaff.filter(function(s) { return s.active; });

  /** Check if a staff member is currently signed in (via punches OR presence) */
  function getClockStatus(staffId) {
    var staff = allStaff.find(function(s) { return s.id === staffId; });
    var isHourly = staff && staff.pay_type === 'hourly';

    if (isHourly) {
      // Hourly: check clock punches
      var punches = (clockPunches || []).filter(function(p) { return p.staff_id === staffId; });
      if (punches.length === 0) return { isClockedIn: false, lastPunch: null };
      var last = punches[punches.length - 1];
      return { isClockedIn: last.type === 'in', lastPunch: last };
    } else {
      // Non-hourly: check presence records
      var rec = (presenceRecords || []).find(function(r) { return r.staff_id === staffId; });
      if (!rec) return { isClockedIn: false, lastPunch: null };
      return { isClockedIn: rec.status === 'in', lastPunch: { timestamp: rec.timestamp } };
    }
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
          outTime = Date.now();
        }
        if (outTime) totalMs += outTime - punches[i].timestamp;
      }
    }
    return Math.round(totalMs / 60000) / 60;
  }

  /** Get a friendly label for the staff's pay type */
  function getPayLabel(staff) {
    if (staff.pay_type === 'hourly') return '$' + ((staff.hourly_rate_cents || 0) / 100).toFixed(2) + '/hr';
    if (staff.pay_type === 'salary') return 'Salary';
    if (staff.pay_type === 'commission') return 'Commission';
    if (staff.pay_type === 'daily_rate') return 'Daily Rate';
    return staff.pay_type || 'Staff';
  }

  /** Get action labels based on pay type */
  function getActionLabels(staff, punchType) {
    var isHourly = staff.pay_type === 'hourly';
    if (punchType === 'in') {
      return { action: isHourly ? 'Clock In' : 'Sign In', prompt: 'Ready to start your shift?' };
    }
    return { action: isHourly ? 'Clock Out' : 'Sign Out', prompt: 'Ending your shift?' };
  }

  function handlePinSuccess(staff) {
    setIdentifiedStaff(staff);
    var isManager = staff.rbac_role === 'owner' || staff.rbac_role === 'manager';

    if (isManager) {
      // Manager/owner with a real staff ID → show self-clock confirm first
      // Owner PIN (id='owner') or provider (id='provider') → skip to list
      var isRealStaff = staff.id !== 'owner' && staff.id !== 'provider';
      if (isRealStaff) {
        // Find this manager in staffStore to get full data (pay_type, etc.)
        var fullStaff = allStaff.find(function(s) { return s.id === staff.id; });
        if (fullStaff) {
          var status = getClockStatus(fullStaff.id);
          setConfirmTarget({
            staff: fullStaff,
            isClockedIn: status.isClockedIn,
            punchType: status.isClockedIn ? 'out' : 'in',
          });
          setPhase('confirm');
          return;
        }
      }
      setPhase('manager_list');
    } else {
      // Non-manager staff: find full record from staffStore for pay_type
      var fullRecord = allStaff.find(function(s) { return s.id === staff.id; }) || staff;
      var status = getClockStatus(fullRecord.id);
      setConfirmTarget({
        staff: fullRecord,
        isClockedIn: status.isClockedIn,
        punchType: status.isClockedIn ? 'out' : 'in',
      });
      setPhase('confirm');
    }
  }

  function handleConfirm() {
    if (!confirmTarget) return;
    var staff = confirmTarget.staff;
    var isHourly = staff.pay_type === 'hourly';
    if (isHourly) {
      onPunch(staff.id, confirmTarget.punchType);
      if (confirmTarget.punchType === 'out' && onPresencePunch) onPresencePunch(staff.id, 'out');
    } else {
      if (onPresencePunch) onPresencePunch(staff.id, confirmTarget.punchType);
    }
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

  // ── CONFIRM CLOCK IN/OUT or SIGN IN/OUT ──
  if (phase === 'confirm' && confirmTarget) {
    var target = confirmTarget;
    var isHourly = target.staff.pay_type === 'hourly';
    var todayHrs = isHourly ? getTodayHours(target.staff.id) : 0;
    var status = getClockStatus(target.staff.id);
    var labels = getActionLabels(target.staff, target.punchType);
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
                {target.isClockedIn ? (isHourly ? 'Currently clocked in' : 'Currently signed in') : (isHourly ? 'Currently clocked out' : 'Currently signed out')}
                {status.lastPunch ? ' · Last: ' + formatTime(status.lastPunch.timestamp) : ''}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: T.text, marginBottom: 8 }}>
              {labels.prompt}
            </div>
            {isHourly && todayHrs > 0 && (
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 4 }}>
                Today: {todayHrs.toFixed(1)} hrs worked
              </div>
            )}
            {!isHourly && (
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, fontStyle: 'italic' }}>
                {getPayLabel(target.staff)} — sign-in for turn system only
              </div>
            )}
            {identifiedStaff && identifiedStaff.id !== target.staff.id && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, fontStyle: 'italic' }}>
                {target.punchType === 'in' ? 'Signed in' : 'Signed out'} by {identifiedStaff.display_name}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={selectedTech ? handleBackToList : handleClose}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: T.chrome, color: T.text, border: '1px solid ' + T.border, userSelect: 'none' }}>
                {selectedTech ? '← Back' : 'Cancel'}
                </div>
              <div onClick={handleConfirm}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: actionColor, color: target.punchType === 'in' ? '#fff' : '#000', border: 'none', userSelect: 'none' }}>
                {labels.action}
              </div>
            </div>
            {/* Manage Others link — only for managers who came to self-clock (not from manager list) */}
            {!selectedTech && identifiedStaff && (identifiedStaff.rbac_role === 'owner' || identifiedStaff.rbac_role === 'manager') && (
              <div onClick={function() { setConfirmTarget(null); setPhase('manager_list'); }}
                style={{ textAlign: 'center', fontSize: 13, color: T.accent || '#60A5FA', cursor: 'pointer', padding: '4px 0', userSelect: 'none' }}>
                Manage Other Staff →
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MANAGER LIST — pick ANY tech ──
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

          {/* Tech list — ALL active staff */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {allStaff.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                No active employees found
              </div>
            ) : (
              allStaff.map(function(tech, idx) {
                var techStatus = getClockStatus(tech.id);
                var isHourly = tech.pay_type === 'hourly';
                var todayHrs = isHourly ? getTodayHours(tech.id) : 0;
                var dotColor = techStatus.isClockedIn ? (T.success || '#22C55E') : (T.textMuted || '#6B7280');
                var statusLabel = techStatus.isClockedIn ? (isHourly ? 'Clocked In' : 'Signed In') : (isHourly ? 'Clocked Out' : 'Signed Out');
                return (
                  <div key={tech.id} onClick={function() { handleManagerPickTech(tech); }}
                    style={{position:'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid ' + T.border }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.raised || T.chrome; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>
        <AreaTag id="CLOCK" />
                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {getInitials(tech.display_name)}
                    </div>
                    {/* Name + pay info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{tech.display_name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                        {getPayLabel(tech)}
                        {isHourly && todayHrs > 0 ? ' · ' + todayHrs.toFixed(1) + ' hrs today' : ''}
                      </div>
                    </div>
                    {/* Status dot + label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: techStatus.isClockedIn ? (T.success || '#22C55E') : T.textMuted }}>
                        {statusLabel}
                      </span>
                    </div>
                    {/* Last punch time */}
                    {techStatus.lastPunch && (
                      <div style={{ fontSize: 11, color: T.textMuted, minWidth: 60, textAlign: 'right' }}>
                        {formatTime(techStatus.lastPunch.timestamp)}
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
