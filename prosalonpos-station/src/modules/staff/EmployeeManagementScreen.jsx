import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
import { useStaffStore } from '../../lib/stores/staffStore';
import { suppressNext } from '../../lib/socket';
/**
 * EmployeeManagementScreen.jsx
 * Module 5 — Staff Management (Owner-facing)
 *
 * Two-panel layout matching Service Catalog:
 *   Left panel  — Active / Deactivated / Deleted tabs + employee lists
 *   Right panel — EmployeeGrid (Active tab) or info panel (Deactivated/Deleted)
 *
 * Session 44: Replaced placeholder with three-tab staff lifecycle management.
 * Rules from Engineering Standards §25 (Session 43).
 */
import { useState } from 'react';
import EmployeeGrid from '../../components/domain/EmployeeGrid';
import EmployeeModal from './EmployeeModal';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';

var ROLE_LABELS = { technician: 'Technician', manager: 'Manager', receptionist: 'Receptionist', owner: 'Owner' };
var ROLE_COLORS = { technician: '#3B82F6', manager: '#F59E0B', receptionist: '#10B981', owner: '#8B5CF6' };

export default function EmployeeManagementScreen({
  employees, setEmployees,
  empColumns, setEmpColumns, empRows, setEmpRows,
  empSlots, setEmpSlots,
  catalogLayout,
  salonSettings,
}) {
  var T = useTheme();
  var toast = useToast();
  var staffActions = useStaffStore();
  var [staffTab, setStaffTab] = useState('active');
  var [editingEmployee, setEditingEmployee] = useState(null);
  var [addSlotIdx, setAddSlotIdx] = useState(null);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [deleteStep, setDeleteStep] = useState(0);
  var [searchText, setSearchText] = useState('');

  // Filter employees by status
  var activeEmps = employees.filter(function(e) { return e.status !== 'deactivated' && e.status !== 'deleted'; });
  var deactivatedEmps = employees.filter(function(e) { return e.status === 'deactivated'; });
  var deletedEmps = employees.filter(function(e) { return e.status === 'deleted'; });

  // Search filter — applies within current tab only
  function filterBySearch(list) {
    if (!searchText.trim()) return list;
    var q = searchText.trim().toLowerCase();
    return list.filter(function(e) {
      return (e.display_name || '').toLowerCase().indexOf(q) !== -1 ||
             (e.legal_name || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  var filteredActive = filterBySearch(activeEmps);
  var filteredDeactivated = filterBySearch(deactivatedEmps);
  var filteredDeleted = filterBySearch(deletedEmps);

  function handleEdit(emp) { setEditingEmployee(emp); }
  function handleAdd(slotIdx) { setAddSlotIdx(slotIdx); }

  // ── Deactivate (soft delete) ──
  function handleDeactivate(empId) {
    staffActions.deactivateStaff(empId);
    setEmpSlots(function(prev) {
      var s = {};
      Object.keys(prev).forEach(function(k) { if (prev[k] !== empId) s[k] = prev[k]; });
      return s;
    });
  }

  // ── Reactivate ──
  function handleReactivate(empId) {
    staffActions.reactivateStaff(empId);
    // Place back into first empty grid slot
    setEmpSlots(function(prev) {
      var slots = { ...prev };
      var cols = empColumns || 4;
      var rows = empRows || 3;
      var total = cols * rows;
      for (var i = 0; i < total; i++) {
        if (!slots[i]) { slots[i] = empId; return slots; }
      }
      // No empty slot — grid is full, they'll still be active but owner needs to expand grid
      return slots;
    });
  }

  // ── Permanent delete (double confirmation) ──
  function startPermanentDelete(emp) { setConfirmDelete(emp); setDeleteStep(1); }
  function confirmFirstDelete() { setDeleteStep(2); }
  function confirmSecondDelete() {
    if (!confirmDelete) return;
    var empId = confirmDelete.id;
    staffActions.deleteStaff(empId);
    setConfirmDelete(null);
    setDeleteStep(0);
  }
  function cancelDelete() { setConfirmDelete(null); setDeleteStep(0); }

  // ── Restore from deleted → deactivated ──
  function handleRestore(empId) {
    staffActions.restoreStaff(empId);
  }

  // ── Save handlers ──
  function handleSaveEdit(data) {
    if (!editingEmployee) return;
    if (data.badge_id) {
      var dup = employees.find(function(e) { return e.id !== editingEmployee.id && e.badge_id === data.badge_id; });
      if (dup) { toast.show('Badge ID "' + data.badge_id + '" is already assigned to ' + dup.display_name + '.', 'error'); return; }
    }
    var updates = {
      display_name: data.display_name, legal_name: data.legal_name,
      role: data.role, badge_id: data.badge_id || editingEmployee.badge_id,
      pay_type: data.pay_type, hourly_rate_cents: data.hourly_rate_cents,
      salary_amount_cents: data.salary_amount_cents, salary_period: data.salary_period,
      commission_pct: data.commission_pct, commission_bonus_enabled: data.commission_bonus_enabled,
      category_commission_rates: data.category_commission_rates,
      daily_guarantee_cents: data.daily_guarantee_cents,
      payout_check_pct: data.payout_check_pct, payout_bonus_pct: data.payout_bonus_pct,
      tech_turn_eligible: data.tech_turn_eligible, show_on_calendar: data.show_on_calendar, active: data.active,
      schedule: data.schedule, assigned_service_ids: data.assigned_service_ids,
      permission_overrides: data.permission_overrides || {},
      rbac_role: data.rbac_role || editingEmployee.rbac_role, permissions: data.permissions,
    };
    if (data.pin) updates.pin = data.pin;
    // Optimistic: close modal immediately, suppress self-originated socket event
    setEditingEmployee(null);
    suppressNext('staff:updated', 3000);
    staffActions.updateStaff(editingEmployee.id, updates).then(function() {
      // Success — store already updated optimistically
    }).catch(function(err) {
      toast.show(err.message || 'Failed to save staff', 'error');
    });
  }

  function handleSaveNew(data) {
    if (data.badge_id) {
      var dup = employees.find(function(e) { return e.badge_id === data.badge_id; });
      if (dup) { toast.show('Badge ID "' + data.badge_id + '" is already assigned to ' + dup.display_name + '.', 'error'); return; }
    }
    var newStaffData = {
      display_name: data.display_name, legal_name: data.legal_name,
      role: data.role, badge_id: data.badge_id || undefined,
      active: true, status: 'active', tech_turn_eligible: data.tech_turn_eligible, show_on_calendar: data.show_on_calendar,
      pin: data.pin || '0000',
      pay_type: data.pay_type, hourly_rate_cents: data.hourly_rate_cents,
      salary_amount_cents: data.salary_amount_cents, salary_period: data.salary_period,
      commission_pct: data.commission_pct, commission_bonus_enabled: data.commission_bonus_enabled,
      category_commission_rates: data.category_commission_rates,
      daily_guarantee_cents: data.daily_guarantee_cents,
      payout_check_pct: data.payout_check_pct || 80, payout_bonus_pct: data.payout_bonus_pct || 20,
      schedule: data.schedule || {}, assigned_service_ids: data.assigned_service_ids || [],
      permission_overrides: data.permission_overrides || {},
      rbac_role: data.rbac_role || 'tech', permissions: data.permissions || {},
    };
    // Optimistic: close the add slot immediately
    var savedSlotIdx = addSlotIdx;
    setAddSlotIdx(null);
    suppressNext('staff:created', 3000);
    staffActions.createStaff(newStaffData).then(function(created) {
      if (savedSlotIdx !== null && created) {
        setEmpSlots(function(prev) { var slots = { ...prev }; slots[savedSlotIdx] = created.id; return slots; });
      }
    }).catch(function(err) {
      toast.show(err.message || 'Failed to create staff', 'error');
    });
  }

  // ── Tab button style ──
  function tabStyle(key) {
    var isActive = staffTab === key;
    return {
      flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600,
      border: '1px solid ' + (isActive ? T.accent : T.border),
      background: isActive ? T.accent : T.chrome,
      color: isActive ? '#FFFFFF' : T.textSecondary,
      borderRadius: 6, cursor: 'pointer', textAlign: 'center',
      fontFamily: "'Inter', sans-serif", outline: 'none',
      transition: 'all 0.15s ease',
    };
  }

  // ── Employee row for deactivated/deleted lists ──
  function renderEmpRow(emp, actions) {
    var staffIdx = employees.indexOf(emp);
    var roleColor = ROLE_COLORS[emp.role] || '#64748B';
    return (
      <div key={emp.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: T.chrome, borderRadius: 8, border: '1px solid ' + T.border,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: AVATAR_COLORS[staffIdx % AVATAR_COLORS.length],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#E2E8F0', fontSize: 13, fontWeight: 500,
        }}>{getInitials(emp.display_name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {emp.display_name}
          </div>
          <div style={{ color: roleColor, fontSize: 11, fontWeight: 500, marginTop: 1 }}>
            {ROLE_LABELS[emp.role] || emp.role}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {actions}
        </div>
      </div>
    );
  }

  // ── Small action button ──
  function actionBtn(label, color, onClick) {
    return (
      <div key={label} onClick={onClick} style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5,
        background: color + '18', color: color, border: '1px solid ' + color + '44',
        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
      }}
        onMouseEnter={function(e) { e.currentTarget.style.background = color + '30'; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = color + '18'; }}
      >{label}</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: T.bg, fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      <AreaTag id="EMP" pos="tr" />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px 16px 16px 24px', gap: 16 }}>

        {/* ═══ Left panel — tabs + lists ═══ */}
        <div style={{
          width: 260, minWidth: 260, overflow: 'auto', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 10,
          border: '1px solid ' + T.border, borderRadius: 8, background: T.surface,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={tabStyle('active')} onClick={function() { setStaffTab('active'); setSearchText(''); }}>
              Active ({activeEmps.length})
            </div>
            <div style={tabStyle('deactivated')} onClick={function() { setStaffTab('deactivated'); setSearchText(''); }}>
              Inactive ({deactivatedEmps.length})
            </div>
            <div style={tabStyle('deleted')} onClick={function() { setStaffTab('deleted'); setSearchText(''); }}>
              Deleted ({deletedEmps.length})
            </div>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchText}
              onChange={function(e) { setSearchText(e.target.value); }}
              placeholder="Search by name..."
              style={{
                width: '100%', padding: '7px 10px 7px 30px', fontSize: 12,
                background: T.chrome, color: T.text, border: '1px solid ' + T.border,
                borderRadius: 6, outline: 'none', boxSizing: 'border-box',
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: T.textSecondary, pointerEvents: 'none' }}>🔍</span>
            {searchText && (
              <span onClick={function() { setSearchText(''); }} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: T.textSecondary, cursor: 'pointer', userSelect: 'none',
              }}>✕</span>
            )}
          </div>

          {/* ── Active tab ── */}
          {staffTab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500, padding: '4px 0', borderBottom: '1px solid ' + T.border, marginBottom: 2 }}>
                Active Staff
              </div>
              {filteredActive.length === 0 && (
                <div style={{ color: T.textSecondary, fontSize: 12, textAlign: 'center', padding: 16 }}>
                  {searchText ? 'No matching staff' : 'No active staff'}
                </div>
              )}
              {filteredActive.map(function(emp) {
                var canDeactivate = true; // all staff can be deactivated
                return renderEmpRow(emp, canDeactivate
                  ? actionBtn('Deactivate', '#F59E0B', function() { handleDeactivate(emp.id); })
                  : null
                );
              })}
            </div>
          )}

          {/* ── Deactivated tab ── */}
          {staffTab === 'deactivated' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500, padding: '4px 0', borderBottom: '1px solid ' + T.border, marginBottom: 2 }}>
                Deactivated — can be reactivated
              </div>
              {filteredDeactivated.length === 0 && (
                <div style={{ color: T.textSecondary, fontSize: 12, textAlign: 'center', padding: 16 }}>
                  {searchText ? 'No matching staff' : 'No deactivated staff'}
                </div>
              )}
              {filteredDeactivated.map(function(emp) {
                return renderEmpRow(emp, [
                  actionBtn('Reactivate', '#059669', function() { handleReactivate(emp.id); }),
                  actionBtn('Delete', '#EF4444', function() { startPermanentDelete(emp); }),
                ]);
              })}
            </div>
          )}

          {/* ── Deleted tab ── */}
          {staffTab === 'deleted' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500, padding: '4px 0', borderBottom: '1px solid ' + T.border, marginBottom: 2 }}>
                Permanently Deleted — read-only archive
              </div>
              {filteredDeleted.length === 0 && (
                <div style={{ color: T.textSecondary, fontSize: 12, textAlign: 'center', padding: 16 }}>
                  {searchText ? 'No matching staff' : 'No deleted staff'}
                </div>
              )}
              {filteredDeleted.map(function(emp) {
                return renderEmpRow(emp,
                  actionBtn('Restore', '#3B82F6', function() { handleRestore(emp.id); })
                );
              })}
              {filteredDeleted.length > 0 && (
                <div style={{ color: T.textSecondary, fontSize: 10, fontStyle: 'italic', padding: '8px 4px', lineHeight: 1.4 }}>
                  Restored staff return to Deactivated status. All historical records are permanently preserved.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ Right panel ═══ */}
        <div style={{
          flex: 1, overflow: 'auto', padding: 16,
          border: '1px solid ' + T.border, borderRadius: 8, background: T.surface,
          display: 'flex', flexDirection: 'column',
        }}>
          {staffTab === 'active' && (
            <EmployeeGrid
              employees={employees}
              empSlots={empSlots}
              empColumns={empColumns}
              empRows={empRows}
              mode="edit"
              onEdit={handleEdit}
              onAdd={handleAdd}
              setEmpSlots={setEmpSlots}
              setEmpColumns={setEmpColumns}
              setEmpRows={setEmpRows}
            />
          )}
          {staffTab === 'deactivated' && (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>👤</div>
              <div style={{ color: T.textSecondary, fontSize: 14, fontWeight: 500 }}>Deactivated Staff</div>
              <div style={{ color: T.textSecondary, fontSize: 12, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
                Deactivated employees are hidden from the calendar, booking flow, checkout, and tech turn rotation. Reactivate anytime to restore full access.
              </div>
            </div>
          )}
          {staffTab === 'deleted' && (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>🗂️</div>
              <div style={{ color: T.textSecondary, fontSize: 14, fontWeight: 500 }}>Deleted Staff Archive</div>
              <div style={{ color: T.textSecondary, fontSize: 12, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
                Permanently deleted employees are kept here for record-keeping. All historical data (tickets, commissions, payroll, tips) is preserved forever.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Double Confirmation Modal ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '18vh', zIndex: 9999,
        }} onClick={cancelDelete}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{
            background: T.surface, border: '1px solid ' + T.border, borderRadius: 12,
            padding: 24, width: 400, maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            {deleteStep === 1 && (
              <div>
                <div style={{ color: '#EF4444', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                  ⚠️ Permanently Delete Employee?
                </div>
                <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                  You are about to permanently delete <span style={{ fontWeight: 700 }}>{confirmDelete.display_name}</span>.
                </div>
                <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>
                  They will be moved to the Deleted tab. Their PIN will be permanently disabled. All historical records will be preserved forever.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <div onClick={cancelDelete} style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                    background: T.chrome, color: T.text, border: '1px solid ' + T.border, cursor: 'pointer',
                  }}>Cancel</div>
                  <div onClick={confirmFirstDelete} style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                    background: '#EF4444', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  }}>Yes, Delete</div>
                </div>
              </div>
            )}
            {deleteStep === 2 && (
              <div>
                <div style={{ color: '#EF4444', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                  ⚠️ Are You Absolutely Sure?
                </div>
                <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                  This will permanently delete <span style={{ fontWeight: 700 }}>{confirmDelete.display_name}</span>.
                </div>
                <div style={{ color: '#F59E0B', fontSize: 12, lineHeight: 1.5, marginBottom: 20, padding: '8px 12px', background: '#F59E0B15', borderRadius: 6, border: '1px solid #F59E0B33' }}>
                  This action cannot be undone from this screen. The staff member can only be restored by an owner from the Deleted tab.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <div onClick={cancelDelete} style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                    background: T.chrome, color: T.text, border: '1px solid ' + T.border, cursor: 'pointer',
                  }}>Cancel</div>
                  <div onClick={confirmSecondDelete} style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                    background: '#DC2626', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  }}>I'm Sure — Delete Permanently</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ── */}
      {editingEmployee !== null && (
        <EmployeeModal
          employee={editingEmployee}
          onSave={handleSaveEdit}
          onClose={function() { setEditingEmployee(null); }}
          catalogLayout={catalogLayout}
          salonSettings={salonSettings}
        />
      )}

      {/* ── Add Staff Modal ── */}
      {addSlotIdx !== null && (
        <EmployeeModal
          onSave={handleSaveNew}
          onClose={function() { setAddSlotIdx(null); }}
          catalogLayout={catalogLayout}
          salonSettings={salonSettings}
        />
      )}
    </div>
  );
}
