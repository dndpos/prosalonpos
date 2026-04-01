import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
/**
 * Pro Salon POS — Package List (Owner Dashboard)
 * Session 23: Create, edit, deactivate service package templates.
 * Flat price, mixed services, expiration, transferable, refundable toggles.
 * All numpads: div-based, calculator layout (7-8-9 top).
 * All price inputs: cash register mode.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_SERVICE_PACKAGES, MOCK_SERVICE_PACKAGE_ITEMS } from './packageBridge';
import { usePackageStore } from '../../lib/stores/packageStore';
import { isProduction } from '../../lib/apiClient';
import { useServiceStore } from '../../lib/stores/serviceStore';

function dollars(cents) { return '$' + (cents / 100).toFixed(2); }

// ═══════════════════════════════════════
// NUMPAD — div-based, calculator layout
// ═══════════════════════════════════════
function Numpad({ value, onChange, onDone, label }) {
  var T = useTheme();
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

  function handleKey(key) {
    if (key === 'C') { onChange(''); return; }
    if (key === '⌫') { onChange((value || '').slice(0, -1)); return; }
    onChange((value || '') + key);
  }

  return (
    <div style={{ background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10, width: 170 }}>
      {label && <div style={{ color: T.textSecondary, fontSize: 10, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
      <div style={{ background: T.chrome, borderRadius: 6, padding: '6px 10px', marginBottom: 8, textAlign: 'right', fontSize: 16, fontWeight: 600, color: T.text, minHeight: 28, border: '1px solid ' + T.border }}>
        {value ? dollars(parseInt(value, 10) || 0) : '$0.00'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { handleKey(key); }}
              style={{ height: 36, borderRadius: 6, background: T.grid, color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text), fontSize: 16, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', border: '1px solid ' + T.border, transition: 'background-color 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 32, marginTop: 5, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
        onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
        onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
      >Done</div>
    </div>
  );
}

// ═══════════════════════════════════════
// SMALL NUMPAD — for quantity and days
// ═══════════════════════════════════════
function SmallNumpad({ value, onChange, onDone, label }) {
  var T = useTheme();
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

  function handleKey(key) {
    if (key === 'C') { onChange(''); return; }
    if (key === '⌫') { onChange((value || '').slice(0, -1)); return; }
    onChange((value || '') + key);
  }

  return (
    <div style={{ background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10, width: 160 }}>
      {label && <div style={{ color: T.textSecondary, fontSize: 10, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
      <div style={{ background: T.chrome, borderRadius: 6, padding: '6px 10px', marginBottom: 8, textAlign: 'right', fontSize: 14, fontWeight: 600, color: T.text, minHeight: 26, border: '1px solid ' + T.border }}>
        {value || '0'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { handleKey(key); }}
              style={{ height: 32, borderRadius: 6, background: T.grid, color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text), fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', border: '1px solid ' + T.border, transition: 'background-color 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 30, marginTop: 4, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
        onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
        onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
      >Done</div>
    </div>
  );
}

// ═══════════════════════════════════════
// TOGGLE COMPONENT
// ═══════════════════════════════════════
function Toggle({ value, onChange }) {
  var T = useTheme();
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function PackageList({ services: propServices, categories: propCategories }) {
  var T = useTheme();
  var toast = useToast();
  var storeServices = useServiceStore(function(s) { return s.services; });
  var storeCategories = useServiceStore(function(s) { return s.categories; });
  var allServices = propServices || storeServices;
  var allCategories = propCategories || storeCategories;
  var activeServices = useMemo(function() { return allServices.filter(function(s) { return s.active !== false; }); }, [allServices]);

  var _isProd = isProduction();
  var storePackages = usePackageStore(function(s) { return s.packages; });
  var storePackageItems = usePackageStore(function(s) { return s.packageItems; });
  var fetchPackages = usePackageStore(function(s) { return s.fetchPackages; });

  var [packages, setPackages] = useState(_isProd ? [] : MOCK_SERVICE_PACKAGES);
  var [packageItems, setPackageItems] = useState(_isProd ? [] : MOCK_SERVICE_PACKAGE_ITEMS);

  // Fetch and sync in production
  useEffect(function() { if (_isProd) fetchPackages(); }, []);
  useEffect(function() {
    if (_isProd && storePackages.length > 0) setPackages(storePackages);
    if (_isProd && storePackageItems.length > 0) setPackageItems(storePackageItems);
  }, [_isProd, storePackages, storePackageItems]);

  // Edit state
  var [editing, setEditing] = useState(null); // null = list view, object = editing/creating
  var [editItems, setEditItems] = useState([]);
  var [showNumpad, setShowNumpad] = useState(null); // 'price' | 'expDays' | 'qty-{index}'
  var [numpadValue, setNumpadValue] = useState('');
  var [showServicePicker, setShowServicePicker] = useState(false);

  // ═══════════════════════════════════
  // CRUD HANDLERS
  // ═══════════════════════════════════
  function handleCreate() {
    setEditing({
      id: null,
      name: '',
      description: '',
      price_cents: 0,
      expiration_enabled: false,
      expiration_days: null,
      transferable: false,
      refundable: true,
      active: true,
    });
    setEditItems([]);
    setShowNumpad(null);
  }

  function handleEdit(pkg) {
    setEditing({ ...pkg });
    var items = packageItems.filter(function(i) { return i.package_id === pkg.id; }).map(function(i) { return { ...i }; });
    setEditItems(items);
    setShowNumpad(null);
  }

  function handleSave() {
    if (!editing.name.trim()) { toast.show('Package name is required.', 'error'); return; }
    if (editItems.length === 0) { toast.show('Add at least one service to the package.', 'error'); return; }
    if (!editing.price_cents || editing.price_cents <= 0) { toast.show('Package price must be greater than $0.', 'error'); return; }

    if (editing.id) {
      // Update existing
      setPackages(packages.map(function(p) { return p.id === editing.id ? { ...editing, location_id: 'loc-01' } : p; }));
      // Update items
      var kept = packageItems.filter(function(i) { return i.package_id !== editing.id; });
      var updated = editItems.map(function(item, idx) {
        return { ...item, id: item.id || ('pki-new-' + Date.now() + '-' + idx), package_id: editing.id };
      });
      setPackageItems(kept.concat(updated));
    } else {
      // Create new
      var newId = 'pkg-' + Date.now();
      var newPkg = { ...editing, id: newId, location_id: 'loc-01', created_at: new Date().toISOString() };
      setPackages(packages.concat([newPkg]));
      var newItems = editItems.map(function(item, idx) {
        return { ...item, id: 'pki-' + Date.now() + '-' + idx, package_id: newId };
      });
      setPackageItems(packageItems.concat(newItems));
    }
    setEditing(null);
    setEditItems([]);
  }

  function handleToggleActive(pkg) {
    setPackages(packages.map(function(p) { return p.id === pkg.id ? { ...p, active: !p.active } : p; }));
  }

  // ═══════════════════════════════════
  // SERVICE PICKER
  // ═══════════════════════════════════
  function addService(svc) {
    // Check if already in the list
    var exists = editItems.some(function(i) { return i.service_id === svc.id; });
    if (exists) { toast.show(svc.name + ' is already in this package.', 'warning'); return; }
    setEditItems(editItems.concat([{
      id: null,
      package_id: editing ? editing.id : null,
      service_id: svc.id,
      service_name: svc.name,
      quantity: 1,
    }]));
    setShowServicePicker(false);
  }

  function removeService(idx) {
    setEditItems(editItems.filter(function(_, i) { return i !== idx; }));
  }

  function updateItemQuantity(idx, qty) {
    setEditItems(editItems.map(function(item, i) {
      return i === idx ? { ...item, quantity: Math.max(1, parseInt(qty, 10) || 1) } : item;
    }));
  }

  // ═══════════════════════════════════
  // NUMPAD HANDLERS
  // ═══════════════════════════════════
  function openNumpad(field, currentValue) {
    setShowNumpad(field);
    setNumpadValue(String(currentValue || ''));
  }

  function closeNumpad() {
    if (!showNumpad || !editing) { setShowNumpad(null); return; }
    var val = parseInt(numpadValue, 10) || 0;
    if (showNumpad === 'price') {
      setEditing({ ...editing, price_cents: val });
    } else if (showNumpad === 'expDays') {
      setEditing({ ...editing, expiration_days: val || null });
    } else if (showNumpad.startsWith('qty-')) {
      var idx = parseInt(showNumpad.split('-')[1], 10);
      updateItemQuantity(idx, val);
    }
    setShowNumpad(null);
  }

  // ═══════════════════════════════════
  // CATALOG PRICE TOTAL (for comparison)
  // ═══════════════════════════════════
  function catalogTotal(items) {
    var total = 0;
    items.forEach(function(item) {
      var svc = allServices.find(function(s) { return s.id === item.service_id; });
      if (svc) total += (svc.price_cents || 0) * (item.quantity || 1);
    });
    return total;
  }

  // Group services by category for picker (must be before any early returns — React hook rules)
  var servicesByCategory = useMemo(function() {
    var map = {};
    allCategories.filter(function(c) { return c.active !== false; }).forEach(function(cat) {
      map[cat.id] = { name: cat.name, services: [] };
    });
    activeServices.forEach(function(svc) {
      (svc.category_ids || []).forEach(function(catId) {
        if (map[catId]) map[catId].services.push(svc);
      });
    });
    return Object.values(map).filter(function(g) { return g.services.length > 0; });
  }, [allCategories, activeServices]);

  // ═══════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════
  if (!editing) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 16 }}>
          <div onClick={handleCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
          >+ Create Package</div>
        </div>

        {/* Package cards */}
        {packages.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
            No packages yet. Create your first service package.
          </div>
        )}

        {packages.map(function(pkg) {
          var items = packageItems.filter(function(i) { return i.package_id === pkg.id; });
          var catTotal = catalogTotal(items);
          var savings = catTotal - pkg.price_cents;
          var inactive = !pkg.active;

          return (
            <div key={pkg.id} style={{
              backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8,
              padding: '14px 16px', marginBottom: 10,
              opacity: inactive ? 0.5 : 1,
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{pkg.name}</span>
                  {inactive && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: T.grid, color: T.textMuted, fontWeight: 500 }}>INACTIVE</span>}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>{dollars(pkg.price_cents)}</span>
              </div>

              {/* Description */}
              {pkg.description && (
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>{pkg.description}</div>
              )}

              {/* Services list */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {items.map(function(item) {
                  return (
                    <span key={item.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: T.grid, color: T.text, fontWeight: 500 }}>
                      {item.quantity}× {item.service_name}
                    </span>
                  );
                })}
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
                {catTotal > 0 && savings > 0 && (
                  <span style={{ color: T.success }}>Saves {dollars(savings)} vs catalog</span>
                )}
                <span>{pkg.expiration_enabled ? 'Expires in ' + pkg.expiration_days + ' days' : 'No expiration'}</span>
                {pkg.transferable && <span>Transferable</span>}
                <span>{pkg.refundable ? 'Refundable' : 'Non-refundable'}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div onClick={function() { handleEdit(pkg); }}
                  style={{ padding: '5px 14px', borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: T.grid, color: T.text, border: '1px solid ' + T.border, userSelect: 'none' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >Edit</div>
                <div onClick={function() { handleToggleActive(pkg); }}
                  style={{ padding: '5px 14px', borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: T.grid, color: inactive ? T.success : '#F59E0B', border: '1px solid ' + T.border, userSelect: 'none' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >{inactive ? 'Reactivate' : 'Deactivate'}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ═══════════════════════════════════
  // EDIT / CREATE VIEW
  // ═══════════════════════════════════
  var catTotal = catalogTotal(editItems);
  var savings = catTotal - (editing.price_cents || 0);
  var totalSessions = editItems.reduce(function(sum, i) { return sum + (i.quantity || 0); }, 0);

  return (
    <div style={{ maxWidth: 650 }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div onClick={function() { setEditing(null); setEditItems([]); }}
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: T.grid, color: T.text, border: '1px solid ' + T.border, userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
        >← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{editing.id ? 'Edit Package' : 'Create Package'}</span>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 4 }}>Package Name</div>
        <input type="text" value={editing.name}
          onChange={function(e) { setEditing({ ...editing, name: e.target.value }); }}
          placeholder="e.g. Nail Lovers Bundle"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.inputBg, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 4 }}>Description (optional)</div>
        <input type="text" value={editing.description}
          onChange={function(e) { setEditing({ ...editing, description: e.target.value }); }}
          placeholder="Client-facing description"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.inputBg, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Price — value + inline numpad */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 4 }}>Package Price (flat)</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div onClick={function() { openNumpad('price', editing.price_cents); }}
              style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid ' + (showNumpad === 'price' ? T.primary : T.border), background: T.inputBg, color: T.text, fontSize: 16, fontWeight: 600, cursor: 'pointer', minWidth: 100, textAlign: 'right' }}
            >{dollars(editing.price_cents || 0)}</div>
            {catTotal > 0 && (
              <div style={{ fontSize: 11, color: savings > 0 ? T.success : T.textMuted, marginTop: 4 }}>
                {savings > 0 ? 'Saves ' + dollars(savings) + ' vs ' + dollars(catTotal) + ' catalog' : 'Catalog total: ' + dollars(catTotal)}
              </div>
            )}
          </div>
          {showNumpad === 'price' && (
            <Numpad value={numpadValue} onChange={setNumpadValue} onDone={closeNumpad} label="Package Price" />
          )}
        </div>
      </div>

      {/* Services in package */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>
            Services ({totalSessions} session{totalSessions !== 1 ? 's' : ''})
          </div>
          <div onClick={function() { setShowServicePicker(!showServicePicker); }}
            style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: T.primary, color: '#fff', userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
          >+ Add Service</div>
        </div>

        {editItems.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 12, border: '1px dashed ' + T.border, borderRadius: 6 }}>
            No services added yet. Click "+ Add Service" to start.
          </div>
        )}

        {editItems.map(function(item, idx) {
          var svc = allServices.find(function(s) { return s.id === item.service_id; });
          var unitPrice = svc ? svc.price_cents : 0;
          var isQtyActive = showNumpad === 'qty-' + idx;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: T.grid, borderRadius: 6, border: '1px solid ' + (isQtyActive ? T.primary : T.borderLight) }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{item.service_name}</span>
                  <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{dollars(unitPrice)} each</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>Qty:</span>
                  <div onClick={function() { openNumpad('qty-' + idx, item.quantity); }}
                    style={{ padding: '3px 10px', borderRadius: 4, background: T.chrome, border: '1px solid ' + (isQtyActive ? T.primary : T.border), color: T.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 30, textAlign: 'center' }}
                  >{item.quantity}</div>
                </div>
                <div onClick={function() { removeService(idx); }}
                  style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#EF4444', background: 'transparent', userSelect: 'none', fontWeight: 500 }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >✕</div>
              </div>
              {isQtyActive && (
                <SmallNumpad value={numpadValue} onChange={setNumpadValue} onDone={closeNumpad} label="Quantity" />
              )}
            </div>
          );
        })}
      </div>

      {/* Service picker dropdown */}
      {showServicePicker && (
        <div style={{ marginBottom: 12, background: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: 12, maxHeight: 250, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 8 }}>Select a service to add:</div>
          {servicesByCategory.map(function(group) {
            return (
              <div key={group.name} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.name}</div>
                {group.services.map(function(svc) {
                  var alreadyAdded = editItems.some(function(i) { return i.service_id === svc.id; });
                  return (
                    <div key={svc.id}
                      onClick={function() { if (!alreadyAdded) addService(svc); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 5, cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.4 : 1, marginBottom: 2 }}
                      onMouseEnter={function(e) { if (!alreadyAdded) e.currentTarget.style.background = T.grid; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 13, color: T.text }}>{svc.name}</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>{svc.open_price ? 'Open price' : dollars(svc.price_cents)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div onClick={function() { setShowServicePicker(false); }}
            style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, color: T.textMuted, cursor: 'pointer', marginTop: 4 }}
          >Close</div>
        </div>
      )}

      {/* Expiration — inline numpad */}
      <div style={{ background: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '4px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + T.borderLight }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Expiration</div>
            <div style={{ fontSize: 11, color: T.textSecondary }}>Set a time limit for using sessions</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {editing.expiration_enabled && (
              <div onClick={function() { openNumpad('expDays', editing.expiration_days || ''); }}
                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid ' + (showNumpad === 'expDays' ? T.primary : T.border), background: T.inputBg, color: T.text, fontSize: 12, fontWeight: 500, cursor: 'pointer', minWidth: 60, textAlign: 'center' }}
              >{editing.expiration_days || 0} days</div>
            )}
            <Toggle value={editing.expiration_enabled} onChange={function(v) { setEditing({ ...editing, expiration_enabled: v, expiration_days: v ? 365 : null }); }} />
          </div>
        </div>
        {showNumpad === 'expDays' && (
          <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <SmallNumpad value={numpadValue} onChange={setNumpadValue} onDone={closeNumpad} label="Days" />
          </div>
        )}

        {/* Transferable */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + T.borderLight }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Transferable</div>
            <div style={{ fontSize: 11, color: T.textSecondary }}>Allow sessions to be used by someone else</div>
          </div>
          <Toggle value={editing.transferable} onChange={function(v) { setEditing({ ...editing, transferable: v }); }} />
        </div>

        {/* Refundable */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Refundable</div>
            <div style={{ fontSize: 11, color: T.textSecondary }}>Allow pro-rated refund for unused sessions</div>
          </div>
          <Toggle value={editing.refundable} onChange={function(v) { setEditing({ ...editing, refundable: v }); }} />
        </div>
      </div>

      {/* Save / Cancel */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <div onClick={handleSave}
          style={{ padding: '10px 28px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
        >{editing.id ? 'Save Changes' : 'Create Package'}</div>
        <div onClick={function() { setEditing(null); setEditItems([]); }}
          style={{ padding: '10px 28px', borderRadius: 6, background: T.grid, color: T.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.border, userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
        >Cancel</div>
      </div>
    </div>
  );
}
