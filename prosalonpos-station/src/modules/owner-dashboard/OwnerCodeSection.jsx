/**
 * OwnerCodeSection.jsx — Owner PIN Display & Change UI
 * Session 98
 *
 * View mode: Spaced digit boxes showing masked dots.
 * Edit mode: Digit boxes + numpad → Save.
 * Calls PUT /auth/owner-pin to update.
 */
import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { api, getPairedSalonId } from '../../lib/apiClient';

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
          setMsg('Owner PIN updated!');
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

  // ── Shared styles ──
  var digitBox = {
    width: 36, height: 42, borderRadius: 6,
    border: '1px solid ' + T.border, background: T.raised,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700, color: T.text,
  };
  var emptyBox = Object.assign({}, digitBox, {
    border: '1px dashed ' + T.border, background: 'transparent', color: T.textMuted,
  });
  var numBtn = {
    width: 52, height: 42, borderRadius: 6,
    border: '1px solid ' + T.border, background: T.grid, color: T.text,
    fontSize: 18, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter',sans-serif",
  };

  // ── VIEW MODE ──
  if (mode === 'view') {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>Owner PIN</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map(function(i) {
              return <div key={i} style={digitBox}>•</div>;
            })}
          </div>
          <div onClick={function() { setMode('edit'); setPin(''); setMsg(''); }}
            style={{
              height: 36, padding: '0 14px', borderRadius: 6, marginLeft: 4,
              background: '#0D3B2E', color: '#34D399', border: '1px solid #065F46',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#134D3A'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = '#0D3B2E'; }}
          >Change</div>
        </div>
      </div>
    );
  }

  // ── EDIT MODE ──
  var maxShow = Math.max(pin.length, 4);
  var boxes = [];
  for (var i = 0; i < maxShow; i++) {
    boxes.push(
      <div key={i} style={i < pin.length ? digitBox : emptyBox}>
        {i < pin.length ? '•' : ''}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>Set New Owner PIN</div>

      {/* Digit boxes */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, minHeight: 42 }}>
        {boxes}
        {pin.length > 0 && pin.length < 2 && (
          <span style={{ fontSize: 11, color: T.textMuted, alignSelf: 'center', marginLeft: 6 }}>min 2</span>
        )}
        {pin.length >= 2 && (
          <span style={{ fontSize: 11, color: T.success, alignSelf: 'center', marginLeft: 6 }}>✓</span>
        )}
      </div>

      {/* Numpad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 52px)', gap: 4, marginBottom: 10 }}>
        {[7,8,9,4,5,6,1,2,3].map(function(d) {
          return (
            <div key={d} onClick={function() { handleDigit(String(d)); }} style={numBtn}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >{d}</div>
          );
        })}
        <div onClick={handleClear} style={Object.assign({}, numBtn, { fontSize: 11, color: T.danger })}>CLR</div>
        <div onClick={function() { handleDigit('0'); }} style={numBtn}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
        >0</div>
        <div onClick={handleBack} style={Object.assign({}, numBtn, { fontSize: 13 })}>⌫</div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={function() { setMode('view'); setPin(''); setMsg(''); }}
          style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>Cancel</div>
        <div onClick={handleSave}
          style={{
            height: 32, padding: '0 14px', borderRadius: 6,
            background: pin.length >= 2 ? '#0D3B2E' : T.grid,
            color: pin.length >= 2 ? '#34D399' : T.textMuted,
            border: '1px solid ' + (pin.length >= 2 ? '#065F46' : T.border),
            fontSize: 12, fontWeight: 600,
            cursor: pin.length >= 2 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center',
          }}>
          {saving ? 'Saving...' : 'Save'}
        </div>
      </div>
      {msg ? <div style={{ fontSize: 11, color: msg.indexOf('updated') !== -1 ? T.success : T.danger, marginTop: 6 }}>{msg}</div> : null}
    </div>
  );
}
