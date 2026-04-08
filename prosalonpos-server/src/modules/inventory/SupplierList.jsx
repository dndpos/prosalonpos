import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Supplier Management
 * Session 13 Decision #255
 * Supplier list with add/edit. Name, contact, phone, email, notes.
 */

import React, { useState } from 'react';
import { useInventoryStore } from '../../lib/stores/inventoryStore';


export default function SupplierList() {
  var T = useTheme();
  var MOCK_SUPPLIERS = useInventoryStore(function(s) { return s.suppliers; });
  var [suppliers, setSuppliers] = useState(MOCK_SUPPLIERS);
  var [editing, setEditing] = useState(null); // null | supplier object | 'new'

  var active = suppliers.filter(function(s) { return s.active; });
  var inactive = suppliers.filter(function(s) { return !s.active; });

  function handleSave(data) {
    if (editing === 'new') {
      var newSup = Object.assign({ id: 'sup-new-' + Date.now(), location_id: 'loc-01', active: true }, data);
      setSuppliers(function(prev) { return prev.concat([newSup]); });
    } else {
      var id = editing.id;
      setSuppliers(function(prev) { return prev.map(function(s) { return s.id === id ? Object.assign({}, s, data) : s; }); });
    }
    setEditing(null);
  }

  function handleToggle(supId) {
    setSuppliers(function(prev) { return prev.map(function(s) { return s.id === supId ? Object.assign({}, s, { active: !s.active }) : s; }); });
  }

  // ── EDIT VIEW ──
  if (editing) {
    var isNew = editing === 'new';
    var initial = isNew ? { name: '', contact_name: '', phone: '', email: '', address: '', notes: '' } : editing;
    return <SupplierForm initial={initial} isNew={isNew} onSave={handleSave} onCancel={function() { setEditing(null); }} />;
  }

  // ── LIST VIEW ──
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Suppliers</div>
        <div onClick={function() { setEditing('new'); }}
          onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          style={{ padding: '8px 16px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms' }}
        >+ Add Supplier</div>
      </div>

      {active.map(function(sup) {
        return (
          <div key={sup.id} onClick={function() { setEditing(sup); }}
            style={{ padding: '12px 14px', background: T.grid, border: '1px solid ' + T.border, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{sup.name}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  {[sup.contact_name, sup.phone, sup.email].filter(Boolean).join(' · ') || 'No contact info'}
                </div>
              </div>
              <div onClick={function(e) { e.stopPropagation(); handleToggle(sup.id); }}
                style={{ fontSize: 12, color: T.danger, cursor: 'pointer', padding: '4px 10px', borderRadius: 4, border: '1px solid ' + T.border }}
                onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >Deactivate</div>
            </div>
            {sup.notes && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>{sup.notes}</div>}
          </div>
        );
      })}

      {inactive.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.textMuted, marginTop: 20, marginBottom: 8 }}>Inactive suppliers</div>
          {inactive.map(function(sup) {
            return (
              <div key={sup.id} style={{ padding: '12px 16px', background: T.grid, border: '1px solid ' + T.border, borderRadius: 8, marginBottom: 6, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: T.textSecondary }}>{sup.name}</div>
                </div>
                <div onClick={function() { handleToggle(sup.id); }}
                  style={{ fontSize: 12, color: T.success, cursor: 'pointer', padding: '4px 10px', borderRadius: 4, border: '1px solid ' + T.border }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Reactivate</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── SUPPLIER FORM ──
function SupplierForm({ initial, isNew, onSave, onCancel }) {
  var T = useTheme();
  var [name, setName] = useState(initial.name || '');
  var [contact, setContact] = useState(initial.contact_name || '');
  var [phone, setPhone] = useState(initial.phone || '');
  var [email, setEmail] = useState(initial.email || '');
  var [address, setAddress] = useState(initial.address || '');
  var [notes, setNotes] = useState(initial.notes || '');

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), contact_name: contact.trim() || null, phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null, notes: notes.trim() || null });
  }

  var fieldStyle = { width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 15, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div onClick={onCancel}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = T.chrome; }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isNew ? 'New Supplier' : 'Edit Supplier'}</span>
      </div>

      {[
        { label: 'Supplier Name', value: name, onChange: setName, required: true, placeholder: 'e.g. Beauty Supply Co' },
        { label: 'Contact Person', value: contact, onChange: setContact, placeholder: 'e.g. John Davis' },
        { label: 'Phone', value: phone, onChange: setPhone, placeholder: '(555) 555-0000' },
        { label: 'Email', value: email, onChange: setEmail, placeholder: 'orders@supplier.com' },
        { label: 'Address', value: address, onChange: setAddress, placeholder: 'Street address' },
      ].map(function(f) {
        return (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>{f.label} {f.required && <span style={{ color: T.danger }}>*</span>}</div>
            <input value={f.value} onChange={function(e) { f.onChange(e.target.value); }} placeholder={f.placeholder} style={fieldStyle} />
          </div>
        );
      })}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Notes</div>
        <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} rows={2} placeholder="Internal notes about this supplier..."
          style={{ width: '100%', height: 56, padding: '10px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div onClick={onCancel}
          style={{ height: 42, padding: '0 18px', borderRadius: 8, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
        >Cancel</div>
        <div onClick={handleSave}
          style={{ height: 42, padding: '0 22px', borderRadius: 8, background: name.trim() ? T.primary : T.grid, color: name.trim() ? '#fff' : T.textMuted, fontSize: 14, fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
          onMouseEnter={function(e) { if (name.trim()) e.currentTarget.style.background = '#1D4ED8'; }}
          onMouseLeave={function(e) { if (name.trim()) e.currentTarget.style.background = T.primary; }}
        >Save</div>
      </div>
    </div>
  );
}
