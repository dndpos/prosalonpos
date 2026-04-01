import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Gift Card Settings
 * Session 10: 6 owner-configurable settings.
 * Presets, custom amount, reload, online purchase, multi-location.
 *
 * Renders in OwnerDashboard right panel as a tab of GiftCardModule.
 */

import React, { useState } from 'react';
import { fmt } from '../../lib/formatUtils';


function Toggle({ value, onChange }) {
  var T = useTheme();
  return (
    <div
      onClick={function() { onChange(!value); }}
      style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}
    >
      <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
    </div>
  );
}

function Card({ children, style }) {
  var T = useTheme();
  return <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '14px 16px', marginBottom: 10, ...style }}>{children}</div>;
}

function SettingRow({ label, desc, children }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}


export default function GiftCardSettings({ settings, onUpdate }) {
  var T = useTheme();
  var s = settings || {};
  var presets = s.gift_card_presets_cents || [2500, 5000, 10000];

  var [showPresetEditor, setShowPresetEditor] = useState(false);
  var [presetStr, setPresetStr] = useState('');

  function set(key, val) { onUpdate(key, val); }

  function handlePresetKey(k) {
    if (k === 'C') { setPresetStr(''); return; }
    if (k === '⌫') { setPresetStr(presetStr.slice(0, -1)); return; }
    if (k === '✓') {
      var val = parseInt(presetStr, 10);
      if (val > 0) {
        var cents = val; // cash register mode: digits are cents
        if (presets.indexOf(cents) === -1) {
          var next = presets.concat([cents]).sort(function(a, b) { return a - b; });
          set('gift_card_presets_cents', next);
        }
      }
      setPresetStr('');
      setShowPresetEditor(false);
      return;
    }
    if (presetStr.length < 7) setPresetStr(presetStr + k);
  }

  function removePreset(cents) {
    set('gift_card_presets_cents', presets.filter(function(p) { return p !== cents; }));
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 12 }}>Gift card settings</div>

      <Card>
        <SettingRow label="Gift cards enabled" desc="Master toggle for the gift card module">
          <Toggle value={!!s.gift_card_enabled} onChange={function(v) { set('gift_card_enabled', v); }} />
        </SettingRow>
      </Card>

      {s.gift_card_enabled && (
        <>
          {/* Presets (Decision #208) */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 8 }}>Purchase presets</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>Quick-select amounts shown during gift card purchase</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {presets.map(function(cents) {
                return (
                  <div key={cents} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: T.grid, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 500, color: T.text, border: '1px solid ' + T.border }}>
                    {fmt(cents)}
                    <span onClick={function() { removePreset(cents); }} style={{ cursor: 'pointer', color: T.danger, fontSize: 14, fontWeight: 600, marginLeft: 4 }}>×</span>
                  </div>
                );
              })}
              {presets.length === 0 && <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>No presets</span>}
            </div>

            {!showPresetEditor ? (
              <div
                onClick={function() { setShowPresetEditor(true); setPresetStr(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.primary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >+ Add preset</div>
            ) : (
              <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Enter amount (cash register style)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 90, height: 36, borderRadius: 6, border: '1px solid ' + T.primary, backgroundColor: T.chrome, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: T.text }}>
                    ${presetStr ? (parseInt(presetStr, 10) / 100).toFixed(2) : '0.00'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gap: 3 }}>
                    {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0'].map(function(k) {
                      var span = k === '0' ? { gridColumn: 'span 3' } : {};
                      return (
                        <div key={k} onClick={function() { handlePresetKey(k); }} style={{
                          height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4,
                          fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                          backgroundColor: k === '✓' ? T.primary : T.chrome, color: k === '✓' ? '#fff' : k === '⌫' ? T.danger : T.text,
                          border: '1px solid ' + T.border, ...span,
                        }}>{k}</div>
                      );
                    })}
                  </div>
                </div>
                <div onClick={function() { setShowPresetEditor(false); }} style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer', marginTop: 8 }}>Cancel</div>
              </div>
            )}
          </Card>

          <Card>
            <SettingRow label="Custom amount" desc="Allow non-preset amounts during purchase (Decision #208)">
              <Toggle value={!!s.gift_card_custom_amount} onChange={function(v) { set('gift_card_custom_amount', v); }} />
            </SettingRow>
          </Card>

          <Card>
            <SettingRow label="Reload enabled" desc="Allow adding money to existing gift cards (Decision #214)">
              <Toggle value={!!s.gift_card_reload_enabled} onChange={function(v) { set('gift_card_reload_enabled', v); }} />
            </SettingRow>
          </Card>

          <Card>
            <SettingRow label="Online purchase" desc="Allow gift card purchases from your website (Decision #209)">
              <Toggle value={!!s.gift_card_online_purchase} onChange={function(v) { set('gift_card_online_purchase', v); }} />
            </SettingRow>
          </Card>

          <Card>
            <SettingRow label="Valid at all locations" desc="When off, cards only work at purchase location (Decision #217)">
              <Toggle value={!!s.gift_card_multi_location} onChange={function(v) { set('gift_card_multi_location', v); }} />
            </SettingRow>
          </Card>
        </>
      )}
    </div>
  );
}
