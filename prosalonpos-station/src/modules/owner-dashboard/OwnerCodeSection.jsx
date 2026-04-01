/**
 * OwnerCodeSection.jsx — Owner Code Change UI
 * Session 86
 *
 * Simple flow: tap Change → numpad → Save
 * No old password required (user is already authenticated as owner).
 * Calls PUT /auth/owner-pin to update.
 */
import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { api, isProduction, getPairedSalonId } from '../../lib/apiClient';

export default function OwnerCodeSection() {
  var T = useTheme();
  var [mode, setMode] = useState('view'); // 'view' | 'edit'
  var [pin, setPin] = useState('');
  var [saving, setSaving] = useState(false);
  var [msg, setMsg] = useState('');

  function handleDigit(d) {
    if (pin.length < 8) setPin(pin + d);
  }
  function handleClear() { setPin(''); }
  function handleBack() { setPin(pin.slice(0, -1)); }

  function handleSave() {
    if (pin.length < 2) { setMsg('PIN must be at least 2 digits'); return; }
    setSaving(true);
    setMsg('');
    api.put('/auth/owner-pin', { new_pin: pin, salon_id: getPairedSalonId() })
      .then(function(res) {
        if (res && res.success) {
          setMsg('Owner code updated!');
          setMode('view');
          setPin('');
        } else {
          setMsg('Failed to save — try again');
        }
      })
      .catch(function(err) {
        console.error('[OwnerCode] save error:', err);
        setMsg('Error saving — check server');
      })
      .finally(function() { setSaving(false); });
  }

  var btnStyle = { width: 64, height: 52, borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 20, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',sans-serif" };

  if (mode === 'view') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 13, color: T.textSecondary }}>Owner PIN:</span>
        <span style={{ fontSize: 13, color: T.text, letterSpacing: 4 }}>••••</span>
        <div onClick={function() { setMode('edit'); setPin(''); setMsg(''); }}
          style={{ fontSize: 12, color: T.accent, cursor: 'pointer', fontWeight: 500 }}
          onMouseEnter={function(e) { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={function(e) { e.currentTarget.style.textDecoration = 'none'; }}
        >Change</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: 16, background: T.bg, borderRadius: 10, border: '1px solid ' + T.border }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>Set New Owner PIN</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, minHeight: 32 }}>
        {pin.length === 0
          ? <span style={{ fontSize: 13, color: T.textMuted }}>Enter 2–8 digits</span>
          : <span style={{ fontSize: 20, color: T.text, letterSpacing: 6 }}>{pin.split('').map(function() { return '•'; }).join('')}</span>
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 6, marginBottom: 12 }}>
        {[7,8,9,4,5,6,1,2,3].map(function(d) {
          return <div key={d} onClick={function() { handleDigit(String(d)); }} style={btnStyle}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >{d}</div>;
        })}
        <div onClick={handleClear} style={Object.assign({}, btnStyle, { fontSize: 12, color: T.danger })}>CLR</div>
        <div onClick={function() { handleDigit('0'); }} style={btnStyle}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
        >0</div>
        <div onClick={handleBack} style={Object.assign({}, btnStyle, { fontSize: 14 })}>⌫</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={function() { setMode('view'); setPin(''); setMsg(''); }}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>Cancel</div>
        <div onClick={handleSave}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, background: pin.length >= 2 ? T.primary : T.grid, color: pin.length >= 2 ? '#fff' : T.textMuted, fontSize: 13, fontWeight: 600, cursor: pin.length >= 2 ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}>
          {saving ? 'Saving...' : 'Save'}
        </div>
      </div>
      {msg ? <div style={{ fontSize: 12, color: msg.indexOf('updated') !== -1 ? T.success : T.danger, marginTop: 8 }}>{msg}</div> : null}
    </div>
  );
}
