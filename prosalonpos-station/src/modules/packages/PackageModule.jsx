import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Service Package Module (Container)
 * Session 23: Service packages with 2 tabs.
 * Renders in OwnerDashboard right panel when sidebar "Packages" is tapped.
 *
 * Tabs: Packages | Settings
 */

import React, { useState } from 'react';
import PackageList from './PackageList';

var TABS = [
  { id: 'packages', label: 'Packages', bg:'#3D2608', text:'#FBB040', border:'#5C3A10' },
  { id: 'settings', label: 'Settings', bg:'#182A3A', text:'#7EB8DC', border:'#264460' },
];

export default function PackageModule({ salonSettings, onSettingsUpdate, services, categories }) {
  var T = useTheme();
  var [activeTab, setActiveTab] = useState('packages');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Service Packages</span>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {(salonSettings || {}).packages_enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* ── Tabs (button style) ── */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px' }}>
        {TABS.map(function(tab) {
          var active = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              onClick={function() { setActiveTab(tab.id); }}
              onMouseEnter={function(e) { if (!active) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 17px'; } }}
              onMouseLeave={function(e) { if (!active) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 18px'; } }}
              style={{
                padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: 'pointer', userSelect: 'none',
                backgroundColor: tab.bg,
                color: tab.text,
                border: active ? '2px solid ' + tab.border : '1px solid ' + tab.border,
                transition: 'background-color 150ms, color 150ms',
              }}
            >{tab.label}</div>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 20px 20px' }}>
        {activeTab === 'packages' && <PackageList services={services} categories={categories} />}
        {activeTab === 'settings' && <PackageSettings settings={salonSettings} onUpdate={onSettingsUpdate} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SETTINGS TAB (inline — small)
// ═══════════════════════════════════════
function PackageSettings({ settings, onUpdate }) {
  var T = useTheme();
  var s = settings || {};

  function Toggle({ value, onChange }) {
    return (
      <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
      </div>
    );
  }

  function Row({ label, desc, children }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: T.text }}>{label}</div>
          {desc && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{desc}</div>}
        </div>
        <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '4px 16px' }}>
        <Row label="Packages enabled" desc="Master toggle — disabling hides packages from checkout">
          <Toggle value={s.packages_enabled !== false} onChange={function(v) { if (onUpdate) onUpdate('packages_enabled', v); }} />
        </Row>
      </div>
    </div>
  );
}
