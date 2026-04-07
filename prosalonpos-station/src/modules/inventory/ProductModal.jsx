import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Product Modal
 * Module 10 — Add/Edit retail product
 * Session 13 Decision #244
 *
 * Clean layout: Name, SKU, 4 value fields (price, cost, stock, threshold)
 * with shared numpad, supplier dropdown, toggles.
 * All numpads: div-based, calculator layout (7-8-9 top).
 * Price/cost: cash register mode.
 */

import React, { useState } from 'react';
import { dollars } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';


// ═══════════════════════════════════════
// NUMPAD — div-based, calculator layout
// ═══════════════════════════════════════
function Numpad({ onKey, onDone, T }) {
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { onKey(key); }}
              style={{ height: 40, borderRadius: 8, background: isAction ? T.border : T.raised, color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text), fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', fontFamily: "'Inter',sans-serif" }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = isAction ? T.border : T.raised; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 40, marginTop: 5, borderRadius: 8, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', fontFamily: "'Inter',sans-serif" }}
        onMouseEnter={function(e) { e.currentTarget.style.background = T.primaryHover; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = T.accent; }}
      >Done</div>
    </div>
  );
}

// ═══════════════════════════════════════
// TAPPABLE VALUE FIELD
// ═══════════════════════════════════════
function ValueField({ label, displayValue, active, onClick, color, small }) {
  var T = useTheme();
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{
        height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid ' + (active ? T.accent : T.border),
        background: active ? T.blueTint : T.dark,
        transition: 'border-color 150ms, background 150ms',
      }}>
        <span style={{ fontSize: small ? 20 : 24, fontWeight: 600, color: color || T.text }}>{displayValue}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════
export default function ProductModal({ product, categories, activeCat, suppliers, onSave, onClose }) {
  var T = useTheme();
  var isEdit = !!product;

  var [name, setName] = useState(isEdit ? product.name : '');
  var [sku, setSku] = useState(isEdit ? (product.sku || '') : '');
  var [priceCents, setPriceCents] = useState(isEdit ? String(product.price_cents || '') : '');
  var [costCents, setCostCents] = useState(isEdit ? String(product.cost_cents || '') : '');
  var [stockQty, setStockQty] = useState(isEdit ? String(product.stock_qty || '0') : '0');
  var [threshold, setThreshold] = useState(isEdit ? String(product.low_stock_qty || '') : '');
  var [supplierId, setSupplierId] = useState(isEdit ? (product.supplier_id || '') : '');
  var [description, setDescription] = useState(isEdit ? (product.description || '') : '');
  var [active, setActive] = useState(isEdit ? product.active : true);
  var [loyaltyEarn, setLoyaltyEarn] = useState(isEdit ? product.loyalty_earn_eligible : true);

  // Which numpad is active: 'price' | 'cost' | 'stock' | 'threshold' | null
  var [activeField, setActiveField] = useState(null);

  function getFieldStr() {
    if (activeField === 'price') return priceCents;
    if (activeField === 'cost') return costCents;
    if (activeField === 'stock') return stockQty;
    if (activeField === 'threshold') return threshold;
    return '';
  }

  function setFieldStr(val) {
    if (activeField === 'price') setPriceCents(val);
    else if (activeField === 'cost') setCostCents(val);
    else if (activeField === 'stock') setStockQty(val);
    else if (activeField === 'threshold') setThreshold(val);
  }

  function handleNumKey(key) {
    var current = getFieldStr();
    if (key === 'C') { setFieldStr(''); return; }
    if (key === '⌫') { setFieldStr(current.slice(0, -1)); return; }
    if (/\d/.test(key)) { setFieldStr(current + key); }
  }

  function toggleField(field) {
    setActiveField(activeField === field ? null : field);
  }

  useNumpadKeyboard(
    !!activeField,
    function(d) { handleNumKey(d); },
    function() { handleNumKey('⌫'); },
    function() { setActiveField(null); },
    function() { setActiveField(null); },
    [activeField, priceCents, costCents, stockQty, threshold]
  );

  function formatCents(raw) {
    if (!raw) return '$0.00';
    var n = parseInt(raw, 10);
    return isNaN(n) ? '$0.00' : '$' + (n / 100).toFixed(2);
  }

  function formatQty(raw) {
    if (!raw) return '0';
    return String(parseInt(raw, 10) || 0);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      sku: sku.trim() || null,
      price_cents: parseInt(priceCents, 10) || 0,
      cost_cents: parseInt(costCents, 10) || 0,
      stock_qty: parseInt(stockQty, 10) || 0,
      low_stock_qty: threshold ? (parseInt(threshold, 10) || null) : null,
      supplier_id: supplierId || null,
      description: description.trim() || null,
      active: active,
      loyalty_earn_eligible: loyaltyEarn,
    });
  }

  var canSave = name.trim().length > 0;
  var activeSuppliers = (suppliers || []).filter(function(s) { return s.active; });

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter',sans-serif", paddingTop: 24, overflowY: 'auto' }}>
        <AreaTag id="INV-PROD" />
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, borderRadius: 12, border: '1px solid ' + T.border, width: 560, maxWidth: '90vw', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', marginBottom: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isEdit ? 'Edit Product' : 'Add Product'}</div>
          <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontSize: 16, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = 'transparent'; }}
          >✕</div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Product Name <span style={{ color: T.danger }}>*</span></div>
          <input value={name} onChange={function(e) { setName(e.target.value); }} placeholder="e.g. Olaplex No. 3"
            style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 16, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* SKU / Barcode */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>SKU / Barcode <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional — for scanner)</span></div>
          <input value={sku} onChange={function(e) { setSku(e.target.value); }} placeholder="Scan or type barcode number"
            style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 16, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }} />
        </div>

        {/* 4 Value Fields: Price | Cost | Stock | Threshold */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <ValueField label="Retail Price" displayValue={formatCents(activeField === 'price' ? priceCents : (priceCents || '0'))} active={activeField === 'price'} onClick={function() { toggleField('price'); }} color={T.success} />
          <ValueField label="Cost Price" displayValue={formatCents(activeField === 'cost' ? costCents : (costCents || '0'))} active={activeField === 'cost'} onClick={function() { toggleField('cost'); }} />
          <ValueField label="Stock Quantity" displayValue={formatQty(activeField === 'stock' ? stockQty : stockQty)} active={activeField === 'stock'} onClick={function() { toggleField('stock'); }} color={parseInt(stockQty || 0, 10) <= parseInt(threshold || 0, 10) && parseInt(threshold || 0, 10) > 0 ? T.danger : T.text} />
          <ValueField label="Low Stock Alert" displayValue={threshold ? formatQty(activeField === 'threshold' ? threshold : threshold) : 'Off'} active={activeField === 'threshold'} onClick={function() { toggleField('threshold'); }} color={T.warning} small={!threshold} />
        </div>

        {/* Numpad — appears when any value field is tapped */}
        {activeField && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 200 }}>
              <Numpad onKey={handleNumKey} onDone={function() { setActiveField(null); }} T={T} />
            </div>
          </div>
        )}

        {/* Supplier */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Supplier <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></div>
          <select value={supplierId} onChange={function(e) { setSupplierId(e.target.value); }}
            style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 15, fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none', boxSizing: 'border-box' }}>
            <option value="">No supplier</option>
            {activeSuppliers.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Description <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></div>
          <textarea value={description} onChange={function(e) { setDescription(e.target.value); }} rows={2} placeholder="Product description..."
            style={{ width: '100%', height: 56, padding: '10px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={function() { setActive(!active); }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: active ? T.success : T.grid, border: '1px solid ' + (active ? T.success : T.border), position: 'relative', transition: 'background 150ms' }}>
              <div style={{ position: 'absolute', top: 2, left: active ? 22 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 150ms' }} />
            </div>
            <span style={{ fontSize: 14, color: T.text }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={function() { setLoyaltyEarn(!loyaltyEarn); }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: loyaltyEarn ? T.success : T.grid, border: '1px solid ' + (loyaltyEarn ? T.success : T.border), position: 'relative', transition: 'background 150ms' }}>
              <div style={{ position: 'absolute', top: 2, left: loyaltyEarn ? 22 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 150ms' }} />
            </div>
            <span style={{ fontSize: 14, color: T.text }}>Earns loyalty points</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <div onClick={onClose}
            style={{ height: 44, padding: '0 20px', borderRadius: 8, border: '1px solid ' + T.border, background: 'transparent', color: T.textSecondary, fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
          <div onClick={handleSave}
            style={{ height: 44, padding: '0 24px', borderRadius: 8, border: 'none', background: canSave ? T.primary : T.grid, color: canSave ? '#fff' : T.textMuted, fontSize: 15, fontWeight: 500, cursor: canSave ? 'pointer' : 'default', display: 'flex', alignItems: 'center', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={function(e) { if (canSave) e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={function(e) { if (canSave) e.currentTarget.style.background = T.primary; }}
          >{isEdit ? 'Save Changes' : 'Add Product'}</div>
        </div>
      </div>
    </div>
  );
}
