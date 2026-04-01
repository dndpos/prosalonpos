import { useTheme } from '../../lib/ThemeContext';
import { ACTIONS, ACTION_META, ROLE_DEFAULTS } from '../../lib/rbac';

/**
 * EmployeePermissionsTab — Session 34
 *
 * Shows all 25 actions grouped by category with checkboxes.
 * Pre-filled from role defaults (salon-customized or hardcoded).
 * Per-employee overrides: if the employee's value differs from role default,
 * it shows an "Override" badge. Can reset individual overrides.
 *
 * Props:
 *   role              — current employee role ('owner'|'manager'|'receptionist'|'tech')
 *   rbacRole          — mapped rbac role key
 *   permissionOverrides — { actionKey: true/false } per-employee overrides
 *   onOverridesChange — function(newOverrides) called when an override changes
 *   salonSettings     — salon settings (for role_permissions customization)
 */

export default function EmployeePermissionsTab({ role, permissionOverrides, onOverridesChange, salonSettings }) {
  var T = useTheme();

  var rbacRole = mapRole(role);
  var overrides = permissionOverrides || {};
  var rolePerms = (salonSettings || {}).role_permissions || {};

  // Get the role default for an action (salon-customized first, then hardcoded)
  function getRoleDefault(actionKey) {
    if (rolePerms[rbacRole] && rolePerms[rbacRole][actionKey] !== undefined) {
      return !!rolePerms[rbacRole][actionKey];
    }
    return !!(ROLE_DEFAULTS[rbacRole] && ROLE_DEFAULTS[rbacRole][actionKey]);
  }

  // Get effective permission — override wins, then role default
  function getEffective(actionKey) {
    if (overrides[actionKey] !== undefined) return !!overrides[actionKey];
    return getRoleDefault(actionKey);
  }

  // Is this action overridden from its role default?
  function isOverridden(actionKey) {
    return overrides[actionKey] !== undefined;
  }

  function toggleAction(actionKey) {
    var current = getEffective(actionKey);
    var roleDefault = getRoleDefault(actionKey);
    var next = Object.assign({}, overrides);

    if (!current === roleDefault) {
      // Toggling back to role default — remove the override
      delete next[actionKey];
    } else {
      // Setting an override
      next[actionKey] = !current;
    }
    onOverridesChange(next);
  }

  function resetOverride(actionKey) {
    var next = Object.assign({}, overrides);
    delete next[actionKey];
    onOverridesChange(next);
  }

  // Group actions by category
  var cats = {};
  var catOrder = [];
  Object.keys(ACTIONS).forEach(function(k) {
    var key = ACTIONS[k];
    var meta = ACTION_META[key] || {};
    var cat = meta.category || 'Other';
    if (!cats[cat]) { cats[cat] = []; catOrder.push(cat); }
    cats[cat].push({ key: key, label: meta.label || key });
  });

  var overrideCount = Object.keys(overrides).length;

  return (
    <div>
      <div style={{ color: T.textSecondary, fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>
        Permissions are set by the <span style={{ color: T.accent, fontWeight: 600 }}>{rbacRole.charAt(0).toUpperCase() + rbacRole.slice(1)}</span> role defaults. Toggle any action to override for this employee.
      </div>
      {overrideCount > 0 && (
        <div style={{ fontSize: 11, color: T.warning, marginBottom: 10 }}>{overrideCount} override{overrideCount > 1 ? 's' : ''} from role defaults</div>
      )}

      {(function() {
        var leftCats = ['Checkout', 'Admin'].filter(function(c) { return !!cats[c]; });
        var rightCats = catOrder.filter(function(c) { return leftCats.indexOf(c) === -1; });
        function renderCats(list) {
          return list.map(function(cat) {
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid ' + T.borderLight }}>{cat}</div>
                {cats[cat].map(function(a) {
                  var isOn = getEffective(a.key);
                  var overridden = isOverridden(a.key);
                  return (
                    <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid ' + T.borderLight }}>
                      <div onClick={function() { toggleAction(a.key); }}
                        style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                          background: isOn ? T.primary : 'transparent',
                          border: '2px solid ' + (isOn ? T.primary : T.borderLight),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 150ms',
                        }}>
                        {isOn && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span onClick={function() { toggleAction(a.key); }}
                        style={{ fontSize: 12, color: T.text, flex: 1, cursor: 'pointer', userSelect: 'none' }}>{a.label}</span>
                      {overridden && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: T.warning, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>Override</span>
                          <span onClick={function(e) { e.stopPropagation(); resetOverride(a.key); }}
                            style={{ fontSize: 10, color: T.textMuted, cursor: 'pointer', padding: '1px 4px' }}
                            onMouseEnter={function(e) { e.currentTarget.style.color = T.danger; }}
                            onMouseLeave={function(e) { e.currentTarget.style.color = T.textMuted; }}
                          >✕</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          });
        }
        return (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderCats(leftCats)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>{renderCats(rightCats)}</div>
          </div>
        );
      })()}
    </div>
  );
}

function mapRole(role) {
  if (role === 'owner') return 'owner';
  if (role === 'manager') return 'manager';
  if (role === 'receptionist') return 'receptionist';
  if (role === 'technician') return 'tech';
  return 'tech';
}
