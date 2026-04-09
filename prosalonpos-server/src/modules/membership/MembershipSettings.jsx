import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Membership Settings
 * Session 12 Decisions #240, #241
 * Salon-level: membership enabled, online signup, multi-location.
 */

import React from 'react';
import AreaTag from '../../components/ui/AreaTag';


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
      <div style={{ flex: 1 }}><div style={{ fontSize: 24, fontWeight: 500, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 20, color: T.textSecondary, marginTop: 3 }}>{desc}</div>}</div>
      {children}
    </div>
  );
}

export default function MembershipSettings({ settings, onUpdate }) {
  var T = useTheme();
  var s = settings || {};

  return (
    <div style={{position:'relative'}}>
        <AreaTag id="MB-SET" />
      <div style={{ fontSize: 28, fontWeight: 600, color: T.text, marginBottom: 14 }}>Membership settings</div>

      <Card>
        <Row label="Membership module enabled" desc="Master toggle — when off, memberships are hidden everywhere">
          <Toggle value={!!s.membership_enabled} onChange={function(v) { onUpdate('membership_enabled', v); }} />
        </Row>
      </Card>

      {s.membership_enabled && (
        <>
          <Card>
            <Row label="Online signup" desc="Allow clients to sign up for memberships through the online booking portal">
              <Toggle value={!!s.membership_online_signup} onChange={function(v) { onUpdate('membership_online_signup', v); }} />
            </Row>
          </Card>

          <Card>
            <Row label="Multi-location memberships" desc="When on, memberships are valid at all salon locations. When off, only at signup location.">
              <Toggle value={!!s.membership_multi_location} onChange={function(v) { onUpdate('membership_multi_location', v); }} />
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}
