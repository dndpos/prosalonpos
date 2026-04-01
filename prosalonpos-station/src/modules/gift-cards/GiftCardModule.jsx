import { useTheme } from '../../lib/ThemeContext';
import DebugLabel from '../../components/debug/DebugLabel';
/**
 * Pro Salon POS — Gift Card Module (Container)
 * Session 10: Gift card management with 2 tabs.
 * Renders in OwnerDashboard right panel when sidebar "Gift cards" is tapped.
 *
 * Tabs: Cards | Settings
 * Gift card creation happens at Checkout only (Decision #209).
 */

import React, { useState } from 'react';
import GiftCardList from './GiftCardList';
import GiftCardSettings from './GiftCardSettings';


var TABS = [
  { id: 'cards',    label: 'Cards',    bg:'#3D1030', text:'#F9A8D4', border:'#6B1A50' },
  { id: 'settings', label: 'Settings', bg:'#182A3A', text:'#7EB8DC', border:'#264460' },
];

export default function GiftCardModule({ salonSettings, onSettingsUpdate }) {
  var T = useTheme();
  var [activeTab, setActiveTab] = useState('cards');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
      <DebugLabel id="PAGE-GIFTCARDS" pos="tr" />
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Gift Cards</span>
      </div>

      {/* ── Tabs (softcolor style) ── */}
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
        {activeTab === 'cards' && <GiftCardList />}
        {activeTab === 'settings' && <GiftCardSettings settings={salonSettings} onUpdate={onSettingsUpdate} />}
      </div>
    </div>
  );
}
