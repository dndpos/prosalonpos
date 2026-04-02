import { useTheme } from '../../lib/ThemeContext';
/**
 * EmployeeModal.jsx
 * Module 5 — Add/Edit Employee popup
 *
 * Tabs: Profile | Schedule | Pay | Services | Permissions
 * Profile: display name, legal name, role, PIN (3-col pad), badge card, tech turn, deactivate
 * Schedule: day-of-week toggles with start/end time per day
 * Pay: commission/hourly/salary sub-tabs (delegated to EmployeePayTab)
 * Services: default ALL selected, uncheck what they can't do. Force save on exit.
 * Permissions: void, refund, discount toggles
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';
import EmployeePayTab from './EmployeePayTab';
import EmployeePermissionsTab from './EmployeePermissionsTab';

var ROLE_OPTIONS = [
  { value: 'technician', label: 'Technician' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
];
var DAYS = [
  { key: 'mon', label: 'Monday',    short: 'Mon' },
  { key: 'tue', label: 'Tuesday',   short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday',  short: 'Thu' },
  { key: 'fri', label: 'Friday',    short: 'Fri' },
  { key: 'sat', label: 'Saturday',  short: 'Sat' },
  { key: 'sun', label: 'Sunday',    short: 'Sun' },
];
var TIME_OPTIONS = [];
for (var h = 0; h < 24; h++) {
  for (var mi = 0; mi < 60; mi += 15) {
    var hr12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    var ampm = h >= 12 ? 'PM' : 'AM';
    var lbl = hr12 + ':' + String(mi).padStart(2, '0') + ' ' + ampm;
    TIME_OPTIONS.push({ value: h * 60 + mi, label: lbl });
  }
}
// DEFAULT_SCHEDULE moved inside component as useMemo (Session 48 — wired to settingsStore)

var F = "'Inter', sans-serif";

function payNumpad(onKey, onDone, T) {
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {keys.map(function(key) {
          return (
            <div key={key} onClick={function() { onKey(key); }}
              style={{
                height: 36, borderRadius: 6, border: '1px solid ' + T.border,
                background: T.grid,
                color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text),
                fontSize: 16, fontWeight: 500, cursor: 'pointer',
                fontFamily: F, userSelect: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{
          width: '100%', height: 32, marginTop: 5, borderRadius: 6, border: 'none',
          background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: F, userSelect: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
        onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
      >Done</div>
    </div>
  );
}

export default function EmployeeModal({ employee, onSave, onClose, catalogLayout, salonSettings }) {
  var T = useTheme();
  var isEdit = !!employee;
  var cl = catalogLayout || {};
  var categories = cl.categories || [];
  var services = cl.services || [];
  var activeCategories = categories.filter(function(c) { return c.active; });
  var allActiveServiceIds = services.filter(function(s) { return s.active; }).map(function(s) { return s.id; });

  // Settings: prefer prop, fall back to store (Session 48 — replaces MOCK_SALON_SETTINGS import)
  var storeSettings = useSettingsStore(function(s) { return s.settings; });
  var _ss = salonSettings || storeSettings || {};

  // DEFAULT_SCHEDULE: derive from salon business_hours (moved from module scope → Session 48)
  var DEFAULT_SCHEDULE = useMemo(function() {
    var sched = {};
    var bh = _ss.business_hours || {};
    DAYS.forEach(function(d) {
      var dayHours = bh[d.key];
      if (dayHours) {
        sched[d.key] = { enabled: dayHours.open, start: dayHours.start, end: dayHours.end };
      } else {
        sched[d.key] = { enabled: d.key !== 'sun', start: 540, end: 1140 };
      }
    });
    return sched;
  }, [_ss]);

  // ── Shared styles (dark theme) ──
  var INP = {
    width: '100%', height: 40, padding: '0 14px', borderRadius: 8,
    border: '1px solid ' + T.border, background: T.chrome, color: T.text,
    fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box',
  };
  var SEL = {
    ...INP, cursor: 'pointer',
    WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394A3B8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  };
  var LBL = { display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 };

  // Profile
  var [displayName, setDisplayName] = useState(isEdit ? employee.display_name : '');
  var [legalName, setLegalName] = useState(isEdit ? (employee.legal_name || '') : '');
  var [role, setRole] = useState(isEdit ? employee.role : 'technician');
  var [pin, setPin] = useState('');
  var [showPinPad, setShowPinPad] = useState(false);
  var [badgeId, setBadgeId] = useState(isEdit ? (employee.badge_id || '') : '');
  var [payType, setPayType] = useState(isEdit ? (employee.pay_type || 'commission') : 'commission');
  var [hourlyRate, setHourlyRate] = useState(isEdit ? String(employee.hourly_rate_cents || '') : '');
  var [salaryAmount, setSalaryAmount] = useState(isEdit ? String(employee.salary_amount_cents || '') : '');
  var [salaryPeriod, setSalaryPeriod] = useState(isEdit ? (employee.salary_period || 'biweekly') : (_ss.pay_frequency || 'biweekly'));
  var [commissionPct, setCommissionPct] = useState(isEdit ? String(employee.commission_pct || '') : '');
  var [commissionBonusEnabled, setCommissionBonusEnabled] = useState(isEdit ? !!employee.commission_bonus_enabled : false);
  var [categoryCommRates, setCategoryCommRates] = useState(isEdit ? (employee.category_commission_rates || {}) : {});
  var [dailyGuarantee, setDailyGuarantee] = useState(isEdit ? String(employee.daily_guarantee_cents || '') : '');
  var [payCheckPct, setPayCheckPct] = useState(isEdit ? String(employee.payout_check_pct || '100') : '100');
  var [payBonusPct, setPayBonusPct] = useState(isEdit ? String(employee.payout_bonus_pct || '0') : '0');
  var [techTurnEligible, setTechTurnEligible] = useState(isEdit ? employee.tech_turn_eligible : true);
  var [isActive, setIsActive] = useState(isEdit ? employee.active : true);
  var [showPayNumpad, setShowPayNumpad] = useState(null);

  // Schedule
  var [schedule, setSchedule] = useState(isEdit && employee.schedule ? { ...employee.schedule } : { ...DEFAULT_SCHEDULE });

  // Services — empty array means "all allowed" (default, no exclusions configured yet)
  var _editIds = isEdit ? (employee.assigned_service_ids || []) : [];
  var [assignedServiceIds, setAssignedServiceIds] = useState(
    isEdit ? (_editIds.length > 0 ? _editIds : [].concat(allActiveServiceIds)) : [].concat(allActiveServiceIds)
  );
  var [showServicePicker, setShowServicePicker] = useState(false);
  var [svcActiveCat, setSvcActiveCat] = useState(null);
  var [svcSnapshot, setSvcSnapshot] = useState(null);
  var [showSvcUnsaved, setShowSvcUnsaved] = useState(false);

  // Permissions — per-employee overrides from role defaults
  var [permissionOverrides, setPermissionOverrides] = useState(
    isEdit ? Object.assign({}, employee.permission_overrides || {}) : {}
  );

  // Tab + discard
  var [activeTab, setActiveTab] = useState('profile');
  var [showDiscard, setShowDiscard] = useState(false);
  var [badgeScanning, setBadgeScanning] = useState(false);
  var badgeScanBuf = useRef('');
  var badgeScanTimer = useRef(null);
  useEffect(function(){
    if(!badgeScanning) return;
    function handleKey(e){
      if(e.key>='0'&&e.key<='9'){
        e.preventDefault();
        badgeScanBuf.current+=e.key;
        clearTimeout(badgeScanTimer.current);
        badgeScanTimer.current=setTimeout(function(){
          var code=badgeScanBuf.current;
          badgeScanBuf.current='';
          if(code.length>=4){
            setBadgeId(code);
            setBadgeScanning(false);
          }
        },200);
      }
      if(e.key==='Enter') e.preventDefault();
    }
    window.addEventListener('keydown',handleKey);
    return function(){window.removeEventListener('keydown',handleKey);clearTimeout(badgeScanTimer.current);};
  },[badgeScanning]);

  var hasChanges = isEdit ? (
    displayName !== employee.display_name ||
    legalName !== (employee.legal_name || '') ||
    role !== employee.role ||
    pin.length > 0 ||
    badgeId !== (employee.badge_id || '') ||
    payType !== (employee.pay_type || 'commission') ||
    hourlyRate !== String(employee.hourly_rate_cents || '') ||
    salaryAmount !== String(employee.salary_amount_cents || '') ||
    salaryPeriod !== (employee.salary_period || 'biweekly') ||
    commissionPct !== String(employee.commission_pct || '') ||
    commissionBonusEnabled !== !!employee.commission_bonus_enabled ||
    dailyGuarantee !== String(employee.daily_guarantee_cents || '') ||
    payCheckPct !== String(employee.payout_check_pct || '100') ||
    payBonusPct !== String(employee.payout_bonus_pct || '0') ||
    techTurnEligible !== employee.tech_turn_eligible ||
    isActive !== employee.active ||
    JSON.stringify(schedule) !== JSON.stringify(employee.schedule || DEFAULT_SCHEDULE) ||
    JSON.stringify(assignedServiceIds.sort()) !== JSON.stringify((employee.assigned_service_ids || []).sort()) ||
    JSON.stringify(permissionOverrides) !== JSON.stringify(employee.permission_overrides || {}) ||
    JSON.stringify(categoryCommRates) !== JSON.stringify(employee.category_commission_rates || {})
  ) : displayName.trim().length > 0;

  var canSave = displayName.trim().length > 0;

  function handleClose() { if (hasChanges) setShowDiscard(true); else onClose(); }

  function handleSave() {
    if (!canSave) return;
    onSave({
      display_name: displayName.trim(), legal_name: legalName.trim(), role: role,
      pin: role === 'owner' ? undefined : (pin || undefined), badge_id: badgeId || undefined, pay_type: payType,
      hourly_rate_cents: payType === 'hourly' ? (parseInt(hourlyRate, 10) || 0) : undefined,
      salary_amount_cents: payType === 'salary' ? (parseInt(salaryAmount, 10) || 0) : undefined,
      salary_period: payType === 'salary' ? salaryPeriod : undefined,
      commission_pct: (payType === 'commission' || ((payType === 'hourly' || payType === 'salary') && commissionBonusEnabled)) ? (parseInt(commissionPct, 10) || 0) : undefined,
      commission_bonus_enabled: (payType === 'hourly' || payType === 'salary') ? commissionBonusEnabled : undefined,
      category_commission_rates: categoryCommRates,
      daily_guarantee_cents: payType === 'commission' ? (parseInt(dailyGuarantee, 10) || 0) : undefined,
      payout_check_pct: parseInt(payCheckPct, 10) || 100, payout_bonus_pct: parseInt(payBonusPct, 10) || 0,
      tech_turn_eligible: techTurnEligible, active: isActive, schedule: schedule,
      assigned_service_ids: assignedServiceIds,
      permission_overrides: permissionOverrides,
      rbac_role: role === 'technician' ? 'tech' : role,
    });
  }

  function handlePinKey(key) {
    if (key === '⌫') { setPin(function(p) { return p.slice(0, -1); }); return; }
    if (key === 'C') { setPin(''); return; }
    if (/\d/.test(key) && pin.length < 4) setPin(function(p) { return p + key; });
  }

  // Physical keyboard support when PIN pad is open
  useEffect(function() {
    if (!showPinPad) return;
    function handleKeyDown(e) {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); handlePinKey(e.key); }
      if (e.key === 'Backspace') { e.preventDefault(); handlePinKey('⌫'); }
      if (e.key === 'Escape') { e.preventDefault(); setShowPinPad(false); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return function() { window.removeEventListener('keydown', handleKeyDown); };
  }, [showPinPad, pin]);

  function toggleServiceId(svc) {
    setAssignedServiceIds(function(prev) {
      return prev.includes(svc.id) ? prev.filter(function(x) { return x !== svc.id; }) : [].concat(prev, [svc.id]);
    });
  }

  function updateScheduleDay(dayKey, field, value) {
    setSchedule(function(prev) { var u = { ...prev }; u[dayKey] = { ...u[dayKey], [field]: value }; return u; });
  }

  function openServicePicker() { setSvcSnapshot(JSON.stringify(assignedServiceIds.sort())); setShowServicePicker(true); }
  function closeServicePicker() {
    if (JSON.stringify(assignedServiceIds.sort()) !== svcSnapshot) setShowSvcUnsaved(true);
    else { setShowServicePicker(false); setSvcSnapshot(null); }
  }
  function svcSaveAndClose() { setShowSvcUnsaved(false); setShowServicePicker(false); setSvcSnapshot(null); }
  function svcDiscardAndClose() { if (svcSnapshot) setAssignedServiceIds(JSON.parse(svcSnapshot)); setShowSvcUnsaved(false); setShowServicePicker(false); setSvcSnapshot(null); }

  if (svcActiveCat === null && activeCategories.length > 0) svcActiveCat = activeCategories[0].id;

  var assignedCount = assignedServiceIds.length;
  var totalActive = allActiveServiceIds.length;
  var unassignedCount = totalActive - assignedCount;

  // ── Toggle (consistent with app) ──
  function Toggle({ value, onChange, label }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer' }} onClick={function() { onChange(!value); }}>
        <span style={{ color: T.text, fontSize: 13 }}>{label}</span>
        <div style={{ width: 44, height: 24, borderRadius: 12, background: value ? T.success : T.grid, border: '1px solid ' + (value ? T.success : T.border), position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#FFFFFF', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'left 150ms' }} />
        </div>
      </div>
    );
  }

  // ── Tab button ──
  function TabBtn({ label, active, onClick }) {
    return (
      <div onClick={onClick}
        style={{ height: 34, padding: '0 16px', borderRadius: 6, background: active ? T.primary : T.grid, border: '1px solid ' + (active ? T.primary : T.border), color: active ? '#FFFFFF' : T.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms, color 150ms' }}
        onMouseEnter={function(e) { if (!active) { e.currentTarget.style.background = T.gridHover; e.currentTarget.style.color = T.text; } }}
        onMouseLeave={function(e) { if (!active) { e.currentTarget.style.background = T.grid; e.currentTarget.style.color = T.textMuted; } }}
      >{label}</div>
    );
  }

  // ── FULL SCREEN SERVICE PICKER ──
  if (showServicePicker) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1010, background: T.bg, fontFamily: F, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 52, background: T.bg, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, borderBottom: '1px solid ' + T.border, flexShrink: 0 }}>
          <div onClick={closeServicePicker} style={{ height: 34, padding: '0 14px', background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Back</div>
          <span style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>Assign Services{isEdit ? ' — ' + employee.display_name : ''}</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: T.textSecondary, fontSize: 12 }}>
            {assignedCount === totalActive ? 'All services allowed' : assignedCount + ' of ' + totalActive + ' allowed'}
            {unassignedCount > 0 && <span style={{ color: T.danger, marginLeft: 6 }}>({unassignedCount} excluded)</span>}
          </span>
          <div onClick={svcSaveAndClose} style={{ height: 34, padding: '0 18px', background: T.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }} onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          >Done</div>
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 12, gap: 12 }}>
          <div style={{ width: 200, minWidth: 200, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome, flexShrink: 0 }}>
            <CategoryGrid categories={categories} activeCat={svcActiveCat} onSelect={function(id) { setSvcActiveCat(id); }} catSlots={cl.catSlots || {}} catColumns={cl.catColumns || 2} layout="grid" mode="view" />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14, border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome, display: 'flex', flexDirection: 'column' }}>
            <ServiceGrid services={services} activeCat={svcActiveCat} svcSlots={cl.svcSlots || {}} svcColumns={cl.svcColumns || 4} svcRows={cl.svcRows || 3} mode="multi" onTap={toggleServiceId} selectedIds={assignedServiceIds} />
          </div>
        </div>
        {showSvcUnsaved && (
          <div style={{ position: 'fixed', inset: 0, background: T.overlay, zIndex: 1020, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: T.chrome, borderRadius: 10, border: '1px solid ' + T.border, padding: 24, width: 340, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 500, marginBottom: 16 }}>You have unsaved service changes.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <div onClick={svcDiscardAndClose} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: '1px solid ' + T.border, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Don't Save</div>
                <div onClick={svcSaveAndClose} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: 'none', background: T.primary, color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }} onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
                >Save Changes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN MODAL ──
  return (
    <div onClick={handleClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: T.overlay, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40, paddingBottom: 280, overflowY: 'auto', zIndex: 1000, fontFamily: F }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.modalGradient, borderRadius: 12, border: '1px solid ' + T.border, width: (activeTab === 'pay' || activeTab === 'permissions') ? 800 : 520, maxWidth: '90vw', padding: 24, transition: 'width 0.2s ease', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', position: 'relative' }}>

        {/* Discard confirmation */}
        {showDiscard && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: T.chrome, borderRadius: 10, border: '1px solid ' + T.border, padding: 24, width: 300, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 500, marginBottom: 16 }}>You have unsaved changes. Discard?</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <div onClick={function() { setShowDiscard(false); }} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: '1px solid ' + T.border, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Keep Editing</div>
                <div onClick={onClose} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: 'none', background: T.danger, color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#DC2626'; }} onMouseLeave={function(e) { e.currentTarget.style.background = T.danger; }}
                >Discard</div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isEdit ? 'Edit Staff' : 'Add Staff'}</div>
          <div onClick={handleClose} style={{ width: 30, height: 30, borderRadius: 6, background: 'transparent', color: T.textMuted, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={function(e) { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = 'transparent'; }}
          >✕</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          <TabBtn label="Profile" active={activeTab === 'profile'} onClick={function() { setActiveTab('profile'); }} />
          <TabBtn label="Schedule" active={activeTab === 'schedule'} onClick={function() { setActiveTab('schedule'); }} />
          <TabBtn label="Pay" active={activeTab === 'pay'} onClick={function() { setActiveTab('pay'); }} />
          <TabBtn label="Services" active={activeTab === 'services'} onClick={function() { setActiveTab('services'); }} />
          <TabBtn label="Permissions" active={activeTab === 'permissions'} onClick={function() { setActiveTab('permissions'); }} />
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Display Name <span style={{ color: T.danger }}>*</span></label>
              <input value={displayName} onChange={function(e) { setDisplayName(e.target.value); }}
                onKeyDown={function(e) { if (e.key === 'Enter') e.target.blur(); }}
                placeholder="Name shown on calendar, turn list, etc." autoFocus={!isEdit} style={INP} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Legal Name <span style={{ color: T.textMuted, fontWeight: 400 }}>(payroll only)</span></label>
              <input value={legalName} onChange={function(e) { setLegalName(e.target.value); }}
                onKeyDown={function(e) { if (e.key === 'Enter') e.target.blur(); }}
                placeholder="Full legal name for payroll" style={INP} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Role</label>
              <select value={role} onChange={function(e) { setRole(e.target.value); }} style={SEL}>
                {ROLE_OPTIONS.map(function(o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
              </select>
            </div>

            {/* PIN — clean display: just show the number, tap to change */}
            {role !== 'owner' ? (
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>PIN <span style={{ color: T.textMuted, fontWeight: 400 }}>(4 digits)</span></label>
              <div onClick={function() { setShowPinPad(!showPinPad); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: showPinPad ? T.bg : T.raised, border: '1px solid ' + (showPinPad ? T.primary + '60' : T.border), borderRadius: 6, cursor: 'pointer', transition: 'border 150ms, background 150ms', minHeight: 40 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: T.text, letterSpacing: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  {pin.length > 0 ? pin : (isEdit && employee.pin_display ? employee.pin_display : '----')}
                </span>
                {pin.length === 4 && <span style={{ color: T.success, fontSize: 11, fontWeight: 500 }}>✓</span>}
              </div>
              {showPinPad && (
                <div style={{ background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10, width: 170, marginTop: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(key) {
                      return (
                        <div key={key} onClick={function() { handlePinKey(key); }}
                          style={{ height: 36, borderRadius: 6, background: T.grid, color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text), fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + T.border, transition: 'background-color 150ms' }}
                          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
                          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
                        >{key}</div>
                      );
                    })}
                  </div>
                  <div onClick={function() { setShowPinPad(false); }}
                    style={{ width: '100%', height: 32, marginTop: 5, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
                    onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
                  >Done</div>
                </div>
              )}
            </div>
            ) : (
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>PIN</label>
              <div style={{ padding: '8px 12px', background: T.raised, border: '1px solid ' + T.border, borderRadius: 6, fontSize: 12, color: T.textMuted }}>
                Uses Owner PIN from Salon Information
              </div>
            </div>
            )}

            {/* Badge ID */}
            <div style={{ marginBottom: 14 }}>
              <label style={LBL}>Badge Card</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 40, background: badgeScanning ? T.blueTint : T.raised, border: '1px solid ' + (badgeScanning ? T.primary : T.border), borderRadius: 6, padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 13, color: badgeScanning ? T.blueLight : (badgeId ? T.text : T.textMuted), fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px', transition: 'all 0.15s' }}>
                  {badgeScanning ? 'Scan now...' : (badgeId || 'No badge assigned')}
                </div>
                {!badgeScanning && (
                  <div onClick={function(){ setBadgeScanning(true); }} style={{ height: 40, padding: '0 14px', background: T.primary, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }} onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
                  >{badgeId ? 'Rescan' : 'Scan Card'}</div>
                )}
                {badgeScanning && (
                  <div onClick={function(){ setBadgeScanning(false); badgeScanBuf.current=''; }} style={{ height: 40, padding: '0 14px', background: T.grid, color: T.text, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', border: '1px solid ' + T.border }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }} onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                  >Cancel</div>
                )}
                {!badgeScanning && badgeId && (
                  <div onClick={function(){ setBadgeId(''); }} style={{ height: 40, padding: '0 14px', background: 'transparent', color: T.danger, border: '1px solid ' + T.danger, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}>Clear</div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid ' + T.border, paddingTop: 8 }}>
              <Toggle value={techTurnEligible} onChange={setTechTurnEligible} label="Tech Turn Eligible" />
              {isEdit && <Toggle value={!isActive} onChange={function(v) { setIsActive(!v); }} label="Deactivate Staff" />}
            </div>
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (
          <div>
            <div style={{ color: T.textSecondary, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>Set which days and hours this staff member works.</div>
            {DAYS.map(function(day) {
              var d = schedule[day.key] || { enabled: false, start: 540, end: 1020 };
              return (
                <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid ' + T.borderLight, opacity: d.enabled ? 1 : 0.5 }}>
                  <div onClick={function() { updateScheduleDay(day.key, 'enabled', !d.enabled); }}
                    style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: d.enabled ? T.success : T.grid, border: '1px solid ' + (d.enabled ? T.success : T.border), position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, background: '#FFFFFF', position: 'absolute', top: 2, left: d.enabled ? 20 : 2, transition: 'left 0.15s' }} />
                  </div>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 500, width: 50, flexShrink: 0 }}>{day.short}</span>
                  {d.enabled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <select value={d.start} onChange={function(e) { updateScheduleDay(day.key, 'start', parseInt(e.target.value)); }} style={{ ...SEL, height: 34, fontSize: 12, flex: 1 }}>
                        {TIME_OPTIONS.map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
                      </select>
                      <span style={{ color: T.textMuted, fontSize: 11 }}>to</span>
                      <select value={d.end} onChange={function(e) { updateScheduleDay(day.key, 'end', parseInt(e.target.value)); }} style={{ ...SEL, height: 34, fontSize: 12, flex: 1 }}>
                        {TIME_OPTIONS.map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
                      </select>
                    </div>
                  ) : (
                    <span style={{ color: T.textMuted, fontSize: 12 }}>Off</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAY TAB ── */}
        {activeTab === 'pay' && (
          <EmployeePayTab ctx={{ payType, setPayType, showPayNumpad, setShowPayNumpad, commissionPct, setCommissionPct, dailyGuarantee, setDailyGuarantee, hourlyRate, setHourlyRate, salaryAmount, setSalaryAmount, salaryPeriod, setSalaryPeriod, commissionBonusEnabled, setCommissionBonusEnabled, payCheckPct, setPayCheckPct, payBonusPct, setPayBonusPct, payNumpad, LBL, F, categoryCommRates, setCategoryCommRates, activeCategories, salonSettings }}/>
        )}

        {/* ── SERVICES TAB ── */}
        {activeTab === 'services' && (
          <div>
            <div style={{ color: T.textSecondary, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>All services are allowed by default. Open the selector to uncheck services this employee cannot perform.</div>
            <div style={{ marginBottom: 14 }}>
              {assignedCount === totalActive ? (
                <span style={{ color: T.success, fontSize: 13, fontWeight: 500 }}>All {totalActive} services allowed</span>
              ) : (
                <span style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{assignedCount} of {totalActive} allowed <span style={{ color: T.danger, marginLeft: 6 }}>({unassignedCount} excluded)</span></span>
              )}
            </div>
            <div onClick={openServicePicker}
              style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid ' + T.primary, background: T.accentBg, color: T.blueLight, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(56,189,248,0.15)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.accentBg; }}
            >Open Service Selection</div>
            {unassignedCount > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 6 }}>Excluded services:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allActiveServiceIds.filter(function(id) { return !assignedServiceIds.includes(id); }).map(function(id) {
                    var svc = services.find(function(s) { return s.id === id; });
                    if (!svc) return null;
                    return (
                      <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 12, background: T.dangerBg, border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: '#FCA5A5' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: svc.calendar_color, flexShrink: 0 }} />
                        {svc.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PERMISSIONS TAB ── */}
        {activeTab === 'permissions' && (
          <EmployeePermissionsTab
            role={role}
            permissionOverrides={permissionOverrides}
            onOverridesChange={setPermissionOverrides}
            salonSettings={salonSettings}
          />
        )}

        {/* ── Bottom Buttons ── */}
        <div style={{ marginTop: 20 }}>
          {hasChanges ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <div onClick={handleClose} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: '1px solid ' + T.border, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >Cancel</div>
              <div onClick={handleSave} style={{ height: 36, padding: '0 18px', borderRadius: 6, border: 'none', background: canSave ? T.primary : T.grid, color: canSave ? '#FFFFFF' : T.textMuted, fontSize: 13, fontWeight: 500, cursor: canSave ? 'pointer' : 'default', fontFamily: F, display: 'flex', alignItems: 'center' }}
                onMouseEnter={function(e) { if (canSave) e.currentTarget.style.background = '#1D4FD7'; }} onMouseLeave={function(e) { if (canSave) e.currentTarget.style.background = T.primary; }}
              >{isEdit ? 'Save Changes' : 'Add Staff'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div onClick={onClose} style={{ height: 44, padding: '0 28px', borderRadius: 6, border: '1px solid ' + T.border, background: 'transparent', color: T.text, fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >Close</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
