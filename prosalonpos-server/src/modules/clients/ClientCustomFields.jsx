import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Client Custom Fields
 * Session 7 Decision #167, #177, #178
 * Owner-created fields: text, number, dropdown, checkbox
 * Values are optional, inline-editable
 */


export default function ClientCustomFields({ fields = [], values = {}, onChange }) {
  var C = useTheme();
  if (fields.length === 0) return null;

  function handleChange(fieldId, val) {
    if (onChange) onChange(fieldId, val);
  }

  var inputBase = {
    width: '100%', height: 38, background: C.inputBg, border: '1px solid ' + C.inputBorder,
    borderRadius: 6, padding: '0 12px', color: C.textPrimary, fontSize: 13,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: C.textPrimary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, padding: '0 4px' }}>Custom Fields</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fields.filter(function(f) { return f.active; }).map(function(field) {
          var val = values[field.id] || '';

          if (field.field_type === 'checkbox') {
            var checked = val === 'true';
            return (
              <div key={field.id} style={{ padding: '10px 14px', background: C.chromeDark, borderRadius: 8, border: '1px solid ' + C.borderLight, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={function() { handleChange(field.id, checked ? '' : 'true'); }}
                  style={{
                    width: 22, height: 22, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: '2px solid ' + (checked ? C.blue : C.inputBorder),
                    background: checked ? C.blue : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{checked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>✓</span>}</div>
                <span style={{ color: C.textPrimary, fontSize: 13 }}>{field.name}</span>
              </div>
            );
          }

          if (field.field_type === 'dropdown') {
            return (
              <div key={field.id} style={{ padding: '10px 14px', background: C.chromeDark, borderRadius: 8, border: '1px solid ' + C.borderLight }}>
                <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>{field.name}</div>
                <select
                  value={val}
                  onChange={function(e) { handleChange(field.id, e.target.value); }}
                  style={{ ...inputBase, cursor: 'pointer' }}
                >
                  <option value="">— Select —</option>
                  {(field.options || []).map(function(opt) { return <option key={opt} value={opt}>{opt}</option>; })}
                </select>
              </div>
            );
          }

          // text or number
          return (
            <div key={field.id} style={{ padding: '10px 14px', background: C.chromeDark, borderRadius: 8, border: '1px solid ' + C.borderLight }}>
              <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>{field.name}</div>
              <input
                type={field.field_type === 'number' ? 'number' : 'text'}
                value={val}
                onChange={function(e) { handleChange(field.id, e.target.value); }}
                placeholder={'Enter ' + field.name.toLowerCase() + '...'}
                inputMode={field.field_type === 'number' ? 'numeric' : 'text'}
                autoComplete="off"
                autoCapitalize="sentences"
                style={inputBase}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
