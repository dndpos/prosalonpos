import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Loyalty Settings
 * Session 11 Decisions #220, #222, #224, #225, #226
 * Program config: flat/tiered, earn rates, expiration, redemption mode.
 */

import React, { useState } from 'react';
import { MOCK_LOYALTY_PROGRAM } from './loyaltyBridge';
import { isProduction } from '../../lib/apiClient';


function Toggle({ value, onChange }) {
  var T = useTheme();
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
    </div>
  );
}

function Card({ children }) {
  var T = useTheme();
  return <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>{children}</div>;
}

function Row({ label, desc, children }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{desc}</div>}</div>
      {children}
    </div>
  );
}

function BtnGroup({ value, onChange, options }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(function(opt) {
        var active = value === opt.key;
        return (
          <div key={opt.key} onClick={function() { onChange(opt.key); }}
            onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
            onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
            style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: active ? T.primary : T.chrome, color: active ? '#fff' : T.textMuted, border: '1px solid ' + (active ? T.primary : T.border), userSelect: 'none', transition: 'background-color 150ms, color 150ms' }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

// Numpad for entering numeric values
function NumpadField({ label, value, suffix, onChange }) {
  var T = useTheme();
  var [editing, setEditing] = useState(false);
  var [str, setStr] = useState(String(value || 0));

  function handleKey(k) {
    if (k === 'C') { setStr(''); return; }
    if (k === '⌫') { setStr(str.slice(0, -1)); return; }
    if (k === '✓') {
      var val = parseFloat(str) || 0;
      onChange(val);
      setEditing(false);
      return;
    }
    if (k === '.' && str.indexOf('.') !== -1) return;
    if (str.length < 6) setStr(str + k);
  }

  if (!editing) {
    return (
      <div onClick={function() { setStr(String(value || 0)); setEditing(true); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.text }}>
        {value}{suffix && <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 400 }}>{suffix}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 90, height: 36, borderRadius: 6, border: '1px solid ' + T.primary, backgroundColor: T.chrome, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: T.text }}>
        {str || '0'}{suffix && <span style={{ fontSize: 13, color: T.textMuted, marginLeft: 4, fontWeight: 400 }}>{suffix}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 44px)', gap: 4 }}>
        {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0','.'].map(function(k) {
          return (
            <div key={k} onClick={function() { handleKey(k); }}
              onMouseEnter={function(e) { if (k !== '✓') e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { if (k !== '✓') e.currentTarget.style.backgroundColor = k === '✓' ? T.primary : T.grid; }}
              style={{
                height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                backgroundColor: k === '✓' ? T.primary : T.grid,
                color: k === '✓' ? '#fff' : k === '⌫' ? T.danger : k === 'C' ? T.textMuted : T.text,
                border: '1px solid ' + (k === '✓' ? T.primary : T.border), transition: 'background-color 150ms',
              }}>{k}</div>
          );
        })}
      </div>
      <div onClick={function() { setEditing(false); }}
        onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
        onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, fontSize: 12, color: T.textMuted, cursor: 'pointer', transition: 'background-color 150ms' }}>Cancel</div>
    </div>
  );
}

export default function LoyaltySettings({ program, onProgramUpdate }) {
  var T = useTheme();
  var _defaultProgram = { enabled: false, points_per_dollar: 1, points_name: 'Points', accrual_method: 'dollar', expiry_months: 0, welcome_bonus: 0 };
  var p = program || (isProduction() ? _defaultProgram : MOCK_LOYALTY_PROGRAM);

  function set(key, val) { onProgramUpdate(key, val); }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 14 }}>Loyalty settings</div>

      <Card>
        <Row label="Loyalty program active" desc="Master toggle for the loyalty module">
          <Toggle value={!!p.active} onChange={function(v) { set('active', v); }} />
        </Row>
      </Card>

      {p.active && (
        <>
          {/* Program type (Decision #222) */}
          <Card>
            <Row label="Program type" desc="Flat = same rules for all. Tiered = levels with different earn rates.">
              <BtnGroup value={p.program_type} onChange={function(v) { set('program_type', v); }} options={[{ key: 'flat', label: 'Flat' }, { key: 'tiered', label: 'Tiered' }]} />
            </Row>
          </Card>

          {/* Tier reset — only for tiered (Decision #224) */}
          {p.program_type === 'tiered' && (
            <Card>
              <Row label="Tier reset" desc="Annual = resets yearly, re-earn each year. Permanent = once earned, kept forever.">
                <BtnGroup value={p.tier_reset || 'permanent'} onChange={function(v) { set('tier_reset', v); }} options={[{ key: 'permanent', label: 'Permanent' }, { key: 'annual', label: 'Annual' }]} />
              </Row>
            </Card>
          )}

          {/* Earn methods (Decision #220) */}
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8, marginTop: 16 }}>Earn methods</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>Choose one or both. Rates shown are base tier rates.</div>

          <Card>
            <Row label="Points per dollar spent" desc="Client earns points based on checkout total of eligible items">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumpadField value={p.earn_per_dollar || 0} suffix=" pts/$" onChange={function(v) { set('earn_per_dollar', v); }} />
                {p.earn_per_dollar ? (
                  <div onClick={function() { set('earn_per_dollar', null); }} style={{ fontSize: 11, color: T.danger, cursor: 'pointer' }}>Disable</div>
                ) : null}
              </div>
            </Row>
          </Card>

          <Card>
            <Row label="Points per visit" desc="Flat bonus per completed checkout regardless of amount">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NumpadField value={p.earn_per_visit || 0} suffix=" pts" onChange={function(v) { set('earn_per_visit', v); }} />
                {p.earn_per_visit ? (
                  <div onClick={function() { set('earn_per_visit', null); }} style={{ fontSize: 11, color: T.danger, cursor: 'pointer' }}>Disable</div>
                ) : null}
              </div>
            </Row>
          </Card>

          {/* Expiration (Decision #225) */}
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8, marginTop: 16 }}>Expiration</div>
          <Card>
            <Row label="Point expiration" desc="Rolling — each batch expires independently from its earn date">
              <BtnGroup value={p.expiration_months == null ? 'never' : 'expires'} onChange={function(v) { set('expiration_months', v === 'never' ? null : 12); }} options={[{ key: 'never', label: 'Never expire' }, { key: 'expires', label: 'Set expiration' }]} />
            </Row>
            {p.expiration_months != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>Expire after</span>
                <NumpadField value={p.expiration_months} suffix=" months" onChange={function(v) { if (v > 0) set('expiration_months', Math.round(v)); }} />
              </div>
            )}
          </Card>

          {/* Redemption mode (Decision #226) */}
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8, marginTop: 16 }}>Redemption</div>
          <Card>
            <Row label="Redemption mode" desc="Manual = staff applies at client request. Auto = system applies best reward.">
              <BtnGroup value={p.redemption_mode} onChange={function(v) { set('redemption_mode', v); }} options={[{ key: 'manual', label: 'Manual' }, { key: 'automatic', label: 'Automatic' }]} />
            </Row>
          </Card>

          {/* Receipt (Decision #229) */}
          <Card>
            <Row label="Show on receipt" desc="Print points earned and balance on checkout receipts">
              <Toggle value={!!p.show_on_receipt} onChange={function(v) { set('show_on_receipt', v); }} />
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}
