import { useTheme } from '../../lib/ThemeContext';
/** Pro Salon POS — Client Lookup Modal (C8 redesign: wider, bigger numpad, PIN-pad style). */
import { useState } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_CLIENTS } from './checkoutBridge';
import { fp } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';

function autoCap(v) { return v.replace(/(^|\s)\S/g, function(c) { return c.toUpperCase(); }); }

function Av({ name, size, index }) {
  var C = useTheme();
  return (
    <div style={{ width: size || 34, height: size || 34, borderRadius: '50%', background: AVATAR_COLORS[(index || 0) % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

export default function ClientLookupModal({ onSelect, onClose }) {
  var C = useTheme();
  var [phoneDigits, setPhoneDigits] = useState('');
  var [showNew, setShowNew] = useState(false);
  var [newFirst, setNewFirst] = useState('');
  var [newLast, setNewLast] = useState('');

  // INP style — defined in component scope (was incorrectly inside Av in C7)
  var INP = { height: 42, background: '#283548', border: '1px solid ' + C.borderMedium, borderRadius: 8, padding: '0 14px', color: C.textPrimary, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  var filtered = CHECKOUT_CLIENTS.filter(function(c) { return phoneDigits ? c.phone.includes(phoneDigits) : true; });

  function handleSelect(c) { onSelect(c); }

  useNumpadKeyboard(
    true,
    function(d) { if (phoneDigits.length < 10) setPhoneDigits(function(p) { return p + d; }); },
    function() { setPhoneDigits(function(p) { return p.slice(0, -1); }); },
    null,
    onClose,
    [phoneDigits]
  );

  function handleNewSave() {
    if (!newFirst.trim() || phoneDigits.length !== 10) return;
    onSelect({
      id: 'c-new-' + Date.now(),
      first_name: newFirst.trim(),
      last_name: newLast.trim(),
      phone: phoneDigits,
      outstanding_balance_cents: 0,
    });
  }

  // Numpad button style — PIN-pad sized with softcolor theme
  var numBtnBase = {
    borderRadius: 8, fontSize: 22, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', height: 56, display: 'flex', alignItems: 'center',
    justifyContent: 'center', userSelect: 'none', transition: 'background 0.1s',
  };
  var numBtn = Object.assign({}, numBtnBase, { background: '#334155', border: '1px solid #475569', color: '#E2E8F0' });
  var clrBtn = Object.assign({}, numBtnBase, { background: '#334155', border: '1px solid #475569', color: C.warning, fontSize: 13, fontWeight: 600 });
  var delBtn = Object.assign({}, numBtnBase, { background: '#334155', border: '1px solid #475569', color: C.danger, fontSize: 18, fontWeight: 600 });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <AreaTag id="CO-CLIENT" />
      <div style={{ background: C.chrome, border: '1px solid ' + C.borderMedium, borderRadius: 14, width: 680, maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }} onClick={function(e) { e.stopPropagation(); }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid ' + C.borderLight, flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Look Up Client</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Enter phone number to search</div>
        </div>
        {/* Body: left results + right numpad */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
          {/* Left: results / new client form */}
          <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
            {!showNew ? (
              <>
                {phoneDigits.length >= 3 && filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 14 }}>No client found</div>
                    <div onClick={function() { setShowNew(true); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 42, padding: '0 24px', background: C.blue, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Client</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {phoneDigits ? 'Results (' + filtered.length + ')' : 'Enter phone \u2192'}
                    </div>
                    {filtered.slice(0, 8).map(function(c, i) {
                      return (
                        <div key={c.id} onClick={function() { handleSelect(c); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: C.chromeDark, border: '1px solid ' + C.borderLight, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 4 }}
                          onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.blue; }}
                          onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.borderLight; }}>
                          <Av name={c.first_name + ' ' + c.last_name} size={36} index={i} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: C.textPrimary, fontSize: 15, fontWeight: 600 }}>{c.first_name} {c.last_name}</div>
                            <div style={{ color: C.textMuted, fontSize: 13 }}>{fp(c.phone)}</div>
                          </div>
                          {c.outstanding_balance_cents > 0 && (
                            <div style={{ color: C.warning, fontSize: 11, fontWeight: 600 }}>Bal: ${(c.outstanding_balance_cents / 100).toFixed(2)}</div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <div>
                <div style={{ fontSize: 15, color: C.textPrimary, fontWeight: 600, marginBottom: 14 }}>New Client</div>
                <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 10 }}>Phone: {fp(phoneDigits)}</div>
                <input value={newFirst} onChange={function(e) { setNewFirst(autoCap(e.target.value)); }} placeholder="First name *" autoCapitalize="words" autoComplete="off" style={Object.assign({}, INP, { width: '100%', marginBottom: 8 })} />
                <input value={newLast} onChange={function(e) { setNewLast(autoCap(e.target.value)); }} placeholder="Last name" autoCapitalize="words" autoComplete="off" style={Object.assign({}, INP, { width: '100%', marginBottom: 14 })} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={function() { setShowNew(false); setNewFirst(''); setNewLast(''); }}
                    style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + C.borderMedium, borderRadius: 8, color: C.textPrimary, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Back</div>
                  <div onClick={handleNewSave}
                    style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: newFirst.trim() && phoneDigits.length === 10 ? C.blue : '#334155', border: 'none', borderRadius: 8, color: newFirst.trim() && phoneDigits.length === 10 ? '#fff' : C.textMuted, fontSize: 14, fontWeight: 600, cursor: newFirst.trim() && phoneDigits.length === 10 ? 'pointer' : 'default', fontFamily: 'inherit' }}>Save</div>
                </div>
              </div>
            )}
          </div>
          {/* Right: phone display + numpad */}
          <div style={{ width: 240, borderLeft: '1px solid ' + C.borderLight, padding: '16px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Phone number display */}
            <div style={{ background: phoneDigits.length === 10 ? 'rgba(5,150,105,0.15)' : C.grid, borderRadius: 8, padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, border: phoneDigits.length === 10 ? '1px solid rgba(5,150,105,0.3)' : '1px solid transparent' }}>
              <span style={{ color: phoneDigits ? C.textPrimary : C.textMuted, fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                {phoneDigits ? fp(phoneDigits) : '(___) ___-____'}
              </span>
            </div>
            {/* Numpad — calculator layout (7-8-9 top) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, flex: 1 }}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(function(d) {
                return (
                  <div key={d}
                    onClick={function() { if (phoneDigits.length < 10) setPhoneDigits(function(p) { return p + d; }); }}
                    style={numBtn}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#3E4E63'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#334155'; }}>
                    {d}
                  </div>
                );
              })}
              <div onClick={function() { setPhoneDigits(''); }} style={clrBtn}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#3E4E63'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#334155'; }}>
                CLR
              </div>
              <div onClick={function() { if (phoneDigits.length < 10) setPhoneDigits(function(p) { return p + '0'; }); }}
                style={numBtn}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#3E4E63'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#334155'; }}>
                0
              </div>
              <div onClick={function() { setPhoneDigits(function(p) { return p.slice(0, -1); }); }} style={delBtn}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#3E4E63'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#334155'; }}>
                ⌫
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
