import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Membership Module (Container)
 * Session 12: Membership plans with 3 tabs.
 * Renders in OwnerDashboard right panel when sidebar "Membership" is tapped.
 *
 * Tabs: Plans | Members | Settings
 */

import React, { useState } from 'react';
import MembershipPlans from './MembershipPlans';
import MembershipMembers from './MembershipMembers';
import MembershipSettings from './MembershipSettings';


var TABS = [
  { id: 'plans',    label: 'Plans',    bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' },
  { id: 'members',  label: 'Members',  bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
  { id: 'settings', label: 'Settings', bg:'#182A3A', text:'#7EB8DC', border:'#264460' },
];

export default function MembershipModule({ salonSettings, onSettingsUpdate, catalogLayout }) {
  var T = useTheme();
  var [activeTab, setActiveTab] = useState('plans');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
        <AreaTag id="MB" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Memberships</span>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {(salonSettings || {}).membership_enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px' }}>
        {TABS.map(function(tab) {
          var active = activeTab === tab.id;
          return (
            <div key={tab.id} onClick={function() { setActiveTab(tab.id); }}
              onMouseEnter={function(e) { if (!active) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 17px'; } }}
              onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = tab.bg; e.currentTarget.style.color = tab.text; e.currentTarget.style.borderColor = tab.border; e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 18px'; } }}
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

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 20px 20px' }}>
        {activeTab === 'plans' && <MembershipPlans catalogLayout={catalogLayout} />}
        {activeTab === 'members' && <div style={{ maxWidth: 800 }}><MembershipMembers /></div>}
        {activeTab === 'settings' && <div style={{ maxWidth: 800 }}><MembershipSettings settings={salonSettings} onUpdate={onSettingsUpdate} /></div>}
      </div>
    </div>
  );
}
