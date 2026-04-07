/**
 * SalonSettingsShared — Shared form components for SalonSettingsPanel
 * Extracted V3 to keep SalonSettingsPanel under 800-line cap.
 */

export function Card({ children, style, T }) {
  return <div style={{ background: T.surface, borderRadius: 10, padding: '20px 24px', marginBottom: 16, ...style }}>{children}</div>;
}

export function SectionTitle({ children, T }) {
  return <div style={{ fontSize: 20, fontWeight: 500, color: T.text, marginBottom: 16 }}>{children}</div>;
}

export function FieldRow({ label, desc, children, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

export function Toggle({ value, onChange, T }) {
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, background: value ? T.success : T.borderLight, cursor: 'pointer', position: 'relative', transition: 'background 150ms' }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'left 150ms' }} />
    </div>
  );
}

export function Select({ value, options, onChange, T }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value); }} style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', minWidth: 140 }}>
      {options.map(function(o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
    </select>
  );
}

export function Input({ value, onChange, type, style: s, T }) {
  return (
    <input value={value} onChange={function(e) { onChange(e.target.value); }} type={type || 'text'} style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', width: 120, ...s }} />
  );
}

export function handlePriceKey(key, setter) {
  setter(function(p) { if (key === 'C') return ''; if (key === '⌫') return p.slice(0, -1); if (/\d/.test(key)) return p + key; return p; });
}

export function payNumpad(onKey, onDone, T) {
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { onKey(key); }}
              style={{ height: 42, borderRadius: 6, background: isAction ? '#334155' : T.btnBg, border: isAction ? '1px solid #475569' : '1px solid ' + T.btnBorder, color: key === '⌫' ? '#EF4444' : (key === 'C' ? '#F59E0B' : T.btnText), fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = isAction ? '#475569' : '#E2E8F0'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = isAction ? '#334155' : T.btnBg; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 36, marginTop: 6, borderRadius: 6, background: '#38BDF8', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
        onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = '#38BDF8'; }}
      >Done</div>
    </div>
  );
}
