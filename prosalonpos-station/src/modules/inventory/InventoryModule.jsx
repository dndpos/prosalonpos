import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Inventory Module (Container)
 * Session 13: Inventory with 3 tabs.
 * Renders in OwnerDashboard right panel when sidebar "Inventory" is tapped.
 *
 * Tabs: Products | Suppliers | Settings
 * Products tab gets full space (catalog layout). Others are constrained.
 */

import React, { useState } from 'react';
import InventoryScreen from './InventoryScreen';
import SupplierList from './SupplierList';
import InventorySettings from './InventorySettings';


var TABS = [
  { id: 'products',  label: 'Products',  bg:'#0E2E1E', text:'#6EE7B7', border:'#1A4A30' },
  { id: 'suppliers', label: 'Suppliers', bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' },
  { id: 'settings',  label: 'Settings',  bg:'#182A3A', text:'#7EB8DC', border:'#264460' },
];

export default function InventoryModule({ salonSettings, onSettingsUpdate }) {
  var T = useTheme();
  var [activeTab, setActiveTab] = useState('products');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
        <AreaTag id="INV" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Inventory</span>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {(salonSettings || {}).inventory_enabled !== false ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px' }}>
        {TABS.map(function(tab) {
          var active = activeTab === tab.id;
          return (
            <div key={tab.id} onClick={function() { setActiveTab(tab.id); }}
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

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'products' ? 0 : '4px 20px 20px 20px' }}>
        {activeTab === 'products' && <InventoryScreen />}
        {activeTab === 'suppliers' && <SupplierList />}
        {activeTab === 'settings' && <InventorySettings settings={salonSettings} onUpdate={onSettingsUpdate} />}
      </div>
    </div>
  );
}
