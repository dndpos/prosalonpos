import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Messaging Settings
 * Session 8 Decisions #179–#186, #187
 * 7 message types with per-type toggle + channel selector.
 * Reminder time config, two-way confirmation, automated triggers.
 *
 * Renders in OwnerDashboard right panel.
 * No native inputs — all div-based for kiosk compatibility.
 */

import React, { useState } from 'react';
import { MESSAGE_TYPES, MESSAGE_TYPE_META, CHANNELS } from '../../lib/messagingService';
import { MSG_TYPE_COLORS } from './messagingBridge';


// ── Reusable small components ──

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

function ChannelSelector({ value, onChange }) {
  var T = useTheme();
  var options = [
    { key: 'sms', label: 'SMS' },
    { key: 'email', label: 'Email' },
    { key: 'both', label: 'Both' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(function(opt) {
        var active = value === opt.key;
        return (
          <div
            key={opt.key}
            onClick={function() { onChange(opt.key); }}
            onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
            onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              backgroundColor: active ? T.primary : T.chrome,
              color: active ? '#fff' : T.textMuted,
              border: '1px solid ' + (active ? T.primary : T.border),
              transition: 'background-color 150ms, color 150ms',
              userSelect: 'none',
            }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  var T = useTheme();
  return <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 12, marginTop: 20 }}>{children}</div>;
}

function Card({ children, style }) {
  var T = useTheme();
  return <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '14px 16px', marginBottom: 10, ...style }}>{children}</div>;
}

// ── Reminder time editor (div-based numpad for hours) ──

function ReminderTimesEditor({ times, onChange }) {
  var T = useTheme();
  var [showAdd, setShowAdd] = useState(false);
  var [addStr, setAddStr] = useState('');

  var PRESET_HOURS = [1, 2, 4, 6, 12, 24, 48, 72];

  function removeTime(h) {
    onChange(times.filter(function(t) { return t !== h; }));
  }

  function addTime(h) {
    if (times.indexOf(h) === -1) {
      var next = times.concat([h]).sort(function(a, b) { return b - a; });
      onChange(next);
    }
    setShowAdd(false);
    setAddStr('');
  }

  function handleNumpadKey(key) {
    if (key === 'C') { setAddStr(''); return; }
    if (key === '⌫') { setAddStr(addStr.slice(0, -1)); return; }
    if (key === '✓') {
      var val = parseInt(addStr, 10);
      if (val > 0 && val <= 168) addTime(val);
      return;
    }
    if (addStr.length < 3) setAddStr(addStr + key);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {times.length === 0 && <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>No reminders set</span>}
        {times.map(function(h) {
          return (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: T.grid, borderRadius: 6, padding: '4px 10px', fontSize: 13, color: T.text }}>
              {h}hr before
              <span onClick={function() { removeTime(h); }} style={{ cursor: 'pointer', color: T.danger, fontSize: 14, marginLeft: 4, fontWeight: 600 }}>×</span>
            </div>
          );
        })}
      </div>

      {!showAdd ? (
        <div
          onClick={function() { setShowAdd(true); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.primary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >+ Add reminder time</div>
      ) : (
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Quick presets (hours before)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {PRESET_HOURS.map(function(h) {
              var alreadySet = times.indexOf(h) !== -1;
              return (
                <div
                  key={h}
                  onClick={function() { if (!alreadySet) addTime(h); }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: alreadySet ? 'default' : 'pointer',
                    backgroundColor: alreadySet ? T.border : T.chrome, color: alreadySet ? T.textMuted : T.text,
                    border: '1px solid ' + T.border, opacity: alreadySet ? 0.5 : 1,
                  }}
                >{h}hr</div>
              );
            })}
          </div>

          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Or enter custom hours</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 36, borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: addStr ? T.text : T.textMuted }}>
              {addStr || '0'}<span style={{ fontSize: 12, color: T.textMuted, marginLeft: 4 }}>hr</span>
            </div>
            {/* Mini numpad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gap: 3 }}>
              {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0'].map(function(k) {
                var isAction = k === '⌫' || k === 'C' || k === '✓';
                var span = k === '0' ? { gridColumn: 'span 3' } : {};
                return (
                  <div
                    key={k}
                    onClick={function() { handleNumpadKey(k); }}
                    style={{
                      height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 4, fontSize: isAction ? 13 : 14, fontWeight: 500, cursor: 'pointer',
                      backgroundColor: k === '✓' ? T.primary : T.chrome,
                      color: k === '✓' ? '#fff' : k === '⌫' ? T.danger : T.text,
                      border: '1px solid ' + T.border, userSelect: 'none', ...span,
                    }}
                  >{k}</div>
                );
              })}
            </div>
          </div>

          <div
            onClick={function() { setShowAdd(false); setAddStr(''); }}
            style={{ marginTop: 8, fontSize: 12, color: T.textMuted, cursor: 'pointer' }}
          >Cancel</div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function MessagingSettings({ settings, onUpdate }) {
  var T = useTheme();
  var s = settings || {};

  function set(key, val) { onUpdate(key, val); }

  // Ordered message type keys for display
  var typeKeys = [
    MESSAGE_TYPES.BOOKING_CONFIRM,
    MESSAGE_TYPES.REMINDER,
    MESSAGE_TYPES.CANCEL_CONFIRM,
    MESSAGE_TYPES.NOSHOW,
    MESSAGE_TYPES.RECEIPT,
    MESSAGE_TYPES.WAITLIST,
    MESSAGE_TYPES.PROMOTIONAL,
  ];

  return (
    <div>
      {/* ── Message Type Configuration (Decision #179, #180, #181) ── */}
      <SectionTitle>Message types</SectionTitle>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Toggle each message type on/off and choose delivery channel.</div>

      {typeKeys.map(function(typeKey) {
        var meta = MESSAGE_TYPE_META[typeKey];
        var enabledKey = 'msg_' + typeKey + '_enabled';
        var channelKey = 'msg_' + typeKey + '_channel';
        var enabled = !!s[enabledKey];
        var channel = s[channelKey] || 'sms';
        var color = MSG_TYPE_COLORS[typeKey] || T.textMuted;

        return (
          <Card key={typeKey}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{meta.label}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {meta.category}{meta.optOutable ? ' · Clients can opt out' : ' · Mandatory'}
                </div>
              </div>
              <ChannelSelector value={channel} onChange={function(v) { set(channelKey, v); }} />
              <Toggle value={enabled} onChange={function(v) { set(enabledKey, v); }} />
            </div>
          </Card>
        );
      })}

      {/* ── Reminder Configuration (Decision #183) ── */}
      {s.msg_reminder_enabled && (
        <>
          <SectionTitle>Reminder timing</SectionTitle>
          <Card>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>Send reminders at these times before the appointment. Multiple reminders supported.</div>
            <ReminderTimesEditor
              times={s.msg_reminder_times_hours || [24]}
              onChange={function(v) { set('msg_reminder_times_hours', v); }}
            />
          </Card>
        </>
      )}

      {/* ── Two-Way Confirmation (Decisions #185–#186) ── */}
      <SectionTitle>Confirmation mode</SectionTitle>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>SMS confirmation mode</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>How clients confirm appointments via text</div>
          </div>
          {/* Segmented toggle: one_way / two_way */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'one_way', label: 'One-way' }, { key: 'two_way', label: 'Two-way' }].map(function(opt) {
              var active = s.msg_confirmation_mode === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={function() { set('msg_confirmation_mode', opt.key); }}
                  onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                  onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
                  style={{
                    padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: active ? T.primary : T.chrome,
                    color: active ? '#fff' : T.textMuted,
                    border: '1px solid ' + (active ? T.primary : T.border),
                    userSelect: 'none', transition: 'background-color 150ms, color 150ms',
                  }}
                >{opt.label}</div>
              );
            })}
          </div>
        </div>

        {s.msg_confirmation_mode === 'one_way' && (
          <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 12px', backgroundColor: T.grid, borderRadius: 6 }}>
            Notifications only — staff manually marks appointments as Confirmed.
          </div>
        )}

        {s.msg_confirmation_mode === 'two_way' && (
          <>
            <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 12px', backgroundColor: T.grid, borderRadius: 6, marginBottom: 10 }}>
              Clients can reply Y/N to confirm or cancel. SMS only.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Auto-confirm on reply</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Automatically update status when client replies "Y"</div>
              </div>
              <Toggle value={!!s.msg_two_way_auto_confirm} onChange={function(v) { set('msg_two_way_auto_confirm', v); }} />
            </div>
          </>
        )}
      </Card>

      {/* ── Automated Triggers (Decision #187) ── */}
      <SectionTitle>Automated triggers</SectionTitle>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Promotional messages sent automatically based on client events. Only sent to clients who haven't opted out.</div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Birthday messages</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Send on client's birthday (if on file)</div>
          </div>
          <Toggle value={!!s.msg_birthday_trigger_enabled} onChange={function(v) { set('msg_birthday_trigger_enabled', v); }} />
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.msg_inactivity_trigger_enabled ? 10 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Inactivity messages</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Send when client hasn't visited in a while</div>
          </div>
          <Toggle value={!!s.msg_inactivity_trigger_enabled} onChange={function(v) { set('msg_inactivity_trigger_enabled', v); }} />
        </div>

        {s.msg_inactivity_trigger_enabled && (
          <InactivityDaysEditor
            days={s.msg_inactivity_days || 60}
            onChange={function(v) { set('msg_inactivity_days', v); }}
          />
        )}
      </Card>
    </div>
  );
}

// ── Inactivity days editor with mini numpad ──

function InactivityDaysEditor({ days, onChange }) {
  var T = useTheme();
  var [editing, setEditing] = useState(false);
  var [str, setStr] = useState(String(days));

  function handleKey(k) {
    if (k === 'C') { setStr(''); return; }
    if (k === '⌫') { setStr(str.slice(0, -1)); return; }
    if (k === '✓') {
      var val = parseInt(str, 10);
      if (val > 0 && val <= 365) { onChange(val); setEditing(false); }
      return;
    }
    if (str.length < 3) setStr(str + k);
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>Trigger after</span>
        <div
          onClick={function() { setStr(String(days)); setEditing(true); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: T.text }}
        >
          {days} <span style={{ fontSize: 11, color: T.textMuted }}>days</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>Days since last visit:</span>
      <div style={{ width: 60, height: 32, borderRadius: 6, border: '1px solid ' + T.primary, backgroundColor: T.chrome, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: T.text }}>
        {str || '0'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 32px)', gap: 2 }}>
        {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0'].map(function(k) {
          var span = k === '0' ? { gridColumn: 'span 3' } : {};
          return (
            <div key={k} onClick={function() { handleKey(k); }} style={{
              height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
              backgroundColor: k === '✓' ? T.primary : T.chrome, color: k === '✓' ? '#fff' : k === '⌫' ? T.danger : T.text,
              border: '1px solid ' + T.border, ...span,
            }}>{k}</div>
          );
        })}
      </div>
      <div onClick={function() { setEditing(false); }} style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer' }}>Cancel</div>
    </div>
  );
}
