import { useTheme } from '../../lib/ThemeContext';
import { ACTIONS, ACTION_META, ROLE_DEFAULTS } from '../../lib/rbac';

/**
 * RolesAccordion — Session 34
 *
 * Shows 4 role tabs (Owner / Manager / Receptionist / Tech).
 * Each tab lists all 25 actions with checkboxes.
 * These are the role defaults — auto-fill for new staff with that role.
 * Staff profiles can override individual permissions.
 *
 * Props:
 *   salonSettings   — full settings object
 *   onSettingsUpdate — function(key, val) to persist changes
 */

var ROLES = [
  { id: 'owner', label: 'Owner' },
  { id: 'manager', label: 'Manager' },
  { id: 'receptionist', label: 'Receptionist' },
  { id: 'tech', label: 'Tech' },
];

export default function RolesAccordion({ salonSettings, onSettingsUpdate, activeRole, onRoleChange }) {
  var T = useTheme();

  var settings = salonSettings || {};
  var rolePerms = settings.role_permissions || {};

  // Build the full permission map for a role — explicit values from salon settings, fallback to ROLE_DEFAULTS
  function getFullRoleMap(role) {
    var saved = rolePerms[role] || {};
    var defaults = ROLE_DEFAULTS[role] || {};
    var merged = {};
    Object.keys(ACTIONS).forEach(function(k) {
      var key = ACTIONS[k];
      merged[key] = saved[key] !== undefined ? !!saved[key] : !!defaults[key];
    });
    return merged;
  }

  // Get current permission for display
  function getPermission(role, actionKey) {
    var saved = rolePerms[role];
    if (saved && saved[actionKey] !== undefined) {
      return !!saved[actionKey];
    }
    return !!(ROLE_DEFAULTS[role] && ROLE_DEFAULTS[role][actionKey]);
  }

  function togglePermission(role, actionKey) {
    // On first toggle for any role, initialize ALL 25 actions from defaults+overrides
    // so we have explicit values to work with going forward
    var next = {};
    ROLES.forEach(function(r) {
      next[r.id] = getFullRoleMap(r.id);
    });
    // Now flip the one that was clicked
    next[role][actionKey] = !next[role][actionKey];
    onSettingsUpdate('role_permissions', next);
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

  // Count how many are ON for the badge
  var onCount = 0;
  Object.keys(ACTIONS).forEach(function(k) {
    if (getPermission(activeRole, ACTIONS[k])) onCount++;
  });

  return (
    <div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Set default permissions for each role. New staff inherit these automatically. Individual overrides can be set in each staff profile.</div>

      {/* Role tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {ROLES.map(function(r) {
          var isActive = activeRole === r.id;
          // Count ON for this role
          var count = 0;
          Object.keys(ACTIONS).forEach(function(k) { if (getPermission(r.id, ACTIONS[k])) count++; });
          return (
            <div key={r.id} onClick={function() { onRoleChange(r.id); }}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                background: isActive ? T.accentBg : T.grid,
                border: '1px solid ' + (isActive ? T.accent + '60' : T.borderLight),
                color: isActive ? T.accent : T.text,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: 'all 150ms', userSelect: 'none',
              }}
              onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = isActive ? T.accentBg : T.grid; }}
            >
              <div>{r.label}</div>
              <div style={{ fontSize: 11, color: isActive ? T.accent : T.textMuted, marginTop: 2 }}>{count}/{Object.keys(ACTIONS).length}</div>
            </div>
          );
        })}
      </div>

      {/* Action checkboxes grouped by category — two columns */}
      {(function() {
        var leftCats = ['Checkout', 'Admin'].filter(function(c) { return !!cats[c]; });
        var rightCats = catOrder.filter(function(c) { return leftCats.indexOf(c) === -1; });
        function renderCats(list) {
          return list.map(function(cat) {
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid ' + T.borderLight }}>{cat}</div>
                {cats[cat].map(function(a) {
                  var isOn = getPermission(activeRole, a.key);
                  return (
                    <div key={a.key} onClick={function() { togglePermission(activeRole, a.key); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid ' + T.borderLight, cursor: 'pointer', userSelect: 'none' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: isOn ? T.primary : 'transparent',
                        border: '2px solid ' + (isOn ? T.primary : T.borderLight),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 150ms',
                      }}>
                        {isOn && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, color: T.text }}>{a.label}</span>
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
