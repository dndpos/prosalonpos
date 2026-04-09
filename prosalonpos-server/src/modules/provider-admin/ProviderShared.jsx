/**
 * ProviderShared.jsx — Shared helpers and components for Provider Admin Panel
 * Session 54 — extracted from ProviderAdminPanel.jsx
 */

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
export function formatDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  var h = d.getHours(); var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' + h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

export function cents(c) { return '$' + (c / 100).toFixed(2); }

export var STATUS_COLORS = { active: '#10B981', trial: '#3B82F6', suspended: '#F59E0B', cancelled: '#EF4444' };

// ═══════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════
export function InfoRow({ label, children, T }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ fontSize: 13, color: T.textMuted, minWidth: 130 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, textAlign: 'right' }}>{children}</div>
    </div>
  );
}

export function ToggleSwitch({ value, onChange }) {
  return (
    <div onClick={onChange} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#10B981' : '#374151', cursor: 'pointer', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: value ? 20 : 2, transition: 'left 150ms' }} />
    </div>
  );
}

export function EditInput({ value, onChange, width, T }) {
  return (
    <input value={value} onChange={function(e) { onChange(e.target.value); }}
      style={{ background: '#0F1923', color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', width: width || 200, boxSizing: 'border-box' }} />
  );
}
