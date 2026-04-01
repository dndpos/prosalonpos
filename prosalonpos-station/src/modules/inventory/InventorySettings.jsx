import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Inventory Settings
 * Session 13 §12 — 5 salon-level settings
 */

import React from 'react';


function Toggle({ value, onChange }) {
  var T = useTheme();
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
    </div>
  );
}

function Row({ label, desc, children }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 2 }}>{desc}</div>}</div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Card({ children }) {
  var T = useTheme();
  return <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>{children}</div>;
}

function BtnGroup({ value, onChange, options }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(function(opt) {
        var active = value === opt.key;
        return (
          <div key={opt.key} onClick={function() { onChange(opt.key); }}
            onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.color = T.text; } }}
            onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textSecondary; } }}
            style={{ padding: '7px 14px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', backgroundColor: active ? T.accent : T.chrome, color: active ? '#fff' : T.textSecondary, border: '1px solid ' + (active ? T.accent : T.border), userSelect: 'none', transition: 'background-color 150ms, color 150ms' }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

export default function InventorySettings({ settings, onUpdate }) {
  var T = useTheme();
  var s = settings || {};

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 14 }}>Inventory settings</div>

      <Card>
        <Row label="Inventory module enabled" desc="Master toggle — when off, inventory features are hidden">
          <Toggle value={!!s.inventory_enabled} onChange={function(v) { onUpdate('inventory_enabled', v); }} />
        </Row>
      </Card>

      {s.inventory_enabled && (
        <>
          <Card>
            <Row label="Purchase orders" desc="Enable structured PO workflow for ordering. When off, only manual stock updates.">
              <Toggle value={!!s.inventory_po_enabled} onChange={function(v) { onUpdate('inventory_po_enabled', v); }} />
            </Row>
          </Card>

          <Card>
            <Row label="Stock adjustment permissions" desc="Who can manually adjust stock quantities">
              <BtnGroup value={s.stock_adjust_permission || 'manager_owner'} onChange={function(v) { onUpdate('stock_adjust_permission', v); }}
                options={[{ key: 'all_staff', label: 'All staff' }, { key: 'manager_owner', label: 'Manager / Owner' }]} />
            </Row>
          </Card>

          <Card>
            <Row label="Retail commission" desc="Staff earns commission on product sales. Rates set in Commission module.">
              <Toggle value={!!s.retail_commission_enabled} onChange={function(v) { onUpdate('retail_commission_enabled', v); }} />
            </Row>
          </Card>

          <Card>
            <Row label="Low stock alerts" desc="Notify owner when products hit their low stock threshold">
              <Toggle value={s.low_stock_alert_enabled !== false} onChange={function(v) { onUpdate('low_stock_alert_enabled', v); }} />
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}
