import { createContext, useContext, useState, useCallback } from 'react';
import { hasPermission, ACTION_META } from './rbac';
import { useStaffStore } from './stores/staffStore';
import PinPopup from '../components/ui/PinPopup';

/**
 * RBACContext — Session 33
 *
 * Two modes of PIN usage:
 *
 * A) OWNER DASHBOARD — "PIN at the door"
 *    Tap Owner → PIN popup → identifies who you are → dashboard remembers.
 *    Sections you can access: unlocked. Sections you can't: show 🔒.
 *    Tap a locked section → PIN popup for override (owner walks over).
 *    Leave dashboard (← Staff View) → session clears.
 *
 * B) STATION ACTIONS — per-action clearance
 *    Salon Settings has clearance_required map per action.
 *    If OFF → no PIN, action works for everyone.
 *    If ON → PIN popup, checks permission.
 *
 * Usage:
 *   var rbac = useRBAC();
 *
 *   // Gate any action (checks clearance_required first)
 *   rbac.requirePermission(ACTIONS.VOID_TICKET, function(staff) { ... });
 *
 *   // Check if action needs clearance (for UI lock icons)
 *   rbac.needsClearance(ACTIONS.PAYROLL)
 *
 *   // Dashboard session
 *   rbac.dashboardUser        — staff record of who PIN'd into Owner Dashboard (or null)
 *   rbac.enterDashboard(cb)   — show PIN popup, on success set dashboardUser + call cb(staff)
 *   rbac.leaveDashboard()     — clear dashboardUser
 *   rbac.dashboardOverride(actionKey, cb) — override for locked section inside dashboard
 */

var RBACCtx = createContext(null);

export function useRBAC() {
  var ctx = useContext(RBACCtx);
  if (!ctx) {
    return {
      requirePermission: function(_action, callback) { callback(null); },
      needsClearance: function() { return false; },
      dashboardUser: null,
      enterDashboard: function(cb) { cb(null); },
      leaveDashboard: function() {},
      dashboardOverride: function(_action, cb) { cb(null); },
    };
  }
  return ctx;
}

export function RBACProvider({ salonSettings, children }) {
  var clearanceMap = (salonSettings || {}).clearance_required || {};
  var rolePermissions = (salonSettings || {}).role_permissions || {};
  var storeStaff = useStaffStore(function(s) { return s.staff; });

  // PIN popup state — single popup, multiple callers
  var [pinRequest, setPinRequest] = useState(null);
  // { mode, actionKey?, actionLabel, callback, denied }
  // mode: 'action' | 'dashboard_enter' | 'dashboard_override'

  // Dashboard session — who PIN'd in at the Owner door
  var [dashboardUser, setDashboardUser] = useState(null);

  // ── needsClearance ──
  var needsClearance = useCallback(function(actionKey) {
    return !!clearanceMap[actionKey];
  }, [clearanceMap]);

  // ── requirePermission — for station actions (checkout, calendar, etc.) ──
  var requirePermission = useCallback(function(actionKey, callback) {
    if (!clearanceMap[actionKey]) {
      callback(null);
      return;
    }
    var meta = ACTION_META[actionKey] || {};
    setPinRequest({
      mode: 'action',
      actionKey: actionKey,
      actionLabel: meta.label || actionKey,
      callback: callback,
      denied: null,
    });
  }, [clearanceMap]);

  // ── enterDashboard — PIN at the Owner door ──
  var enterDashboard = useCallback(function(callback, onCancel) {
    setPinRequest({
      mode: 'dashboard_enter',
      actionKey: null,
      actionLabel: 'Owner Dashboard',
      callback: callback,
      onCancel: onCancel || null,
      denied: null,
    });
  }, []);

  // ── leaveDashboard — clear session on ← Staff View ──
  var leaveDashboard = useCallback(function() {
    setDashboardUser(null);
  }, []);

  // ── dashboardOverride — tap a locked section, someone else enters PIN ──
  var dashboardOverride = useCallback(function(actionKey, callback) {
    var meta = ACTION_META[actionKey] || {};
    setPinRequest({
      mode: 'dashboard_override',
      actionKey: actionKey,
      actionLabel: meta.label || actionKey,
      callback: callback,
      denied: null,
    });
  }, []);

  // ── PIN popup success handler ──
  function handlePinSuccess(staff) {
    if (!pinRequest) return;

    if (pinRequest.mode === 'dashboard_enter') {
      // Anyone with a valid PIN can enter the dashboard — we just need to know who
      var cb = pinRequest.callback;
      setPinRequest(null);
      setDashboardUser(staff);
      cb(staff);

    } else if (pinRequest.mode === 'dashboard_override') {
      // Override for a locked section — must have permission for this specific action
      if (hasPermission(staff, pinRequest.actionKey, rolePermissions)) {
        var cb2 = pinRequest.callback;
        setPinRequest(null);
        cb2(staff);
      } else {
        setPinRequest(Object.assign({}, pinRequest, {
          denied: staff.display_name + ' — Access Denied',
        }));
      }

    } else {
      // Station action — must have permission
      if (hasPermission(staff, pinRequest.actionKey, rolePermissions)) {
        var cb3 = pinRequest.callback;
        setPinRequest(null);
        cb3(staff);
      } else {
        setPinRequest(Object.assign({}, pinRequest, {
          denied: staff.display_name + ' — Access Denied',
        }));
      }
    }
  }

  function handlePinCancel() {
    var req = pinRequest;
    setPinRequest(null);
    if (req && req.onCancel) {
      req.onCancel();
    }
  }

  var ctxValue = {
    requirePermission: requirePermission,
    needsClearance: needsClearance,
    dashboardUser: dashboardUser,
    enterDashboard: enterDashboard,
    leaveDashboard: leaveDashboard,
    dashboardOverride: dashboardOverride,
  };

  return (
    <RBACCtx.Provider value={ctxValue}>
      {children}
      {pinRequest && (
        <PinPopup
          show={true}
          title={pinRequest.denied || pinRequest.actionLabel}
          titleColor={pinRequest.denied ? 'denied' : null}
          staffList={storeStaff}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      )}
    </RBACCtx.Provider>
  );
}

export default RBACCtx;
