/**
 * ServiceModals.jsx
 * Module 4 — Add Category and Add Service popup modals
 * 
 * AddCategoryModal: name + optional color swatch
 * AddServiceModal: name + duration dropdown + price + optional color swatch
 * Color pre-fills from parent category when available.
 */
import { useState } from 'react';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import { useTheme } from '../../lib/ThemeContext';
import { SERVICE_COLORS } from '../../lib/tokens';

// ── Shared modal backdrop ──
function ModalBackdrop({ onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          background: '#1E293B', borderRadius: 12, border: '1px solid #475569',
          width: 460, maxWidth: '90vw', padding: 28,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared color swatch grid ──
function ColorSwatchGrid({ selectedColor, onSelect, label }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 10 }}>
        {label || 'Color'} <span style={{ color: '#64748B', fontWeight: 400 }}>(optional)</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8 }}>
        {SERVICE_COLORS.map(function(c) {
          var isSelected = selectedColor === c.hex;
          return (
            <button
              key={c.hex}
              title={c.name}
              onClick={function() { onSelect(isSelected ? null : c.hex); }}
              style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                background: c.hex, border: isSelected ? '3px solid #FFFFFF' : '2px solid transparent',
                outline: isSelected ? '2px solid #2563EB' : 'none',
                boxSizing: 'border-box', padding: 0,
                transition: 'border 0.15s, outline 0.15s',
              }}
            />
          );
        })}
      </div>
      {selectedColor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: selectedColor }} />
          <span style={{ color: '#E2E8F0', fontSize: 13 }}>
            {SERVICE_COLORS.find(function(c) { return c.hex === selectedColor; })?.name || selectedColor}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Shared button row ──
function ModalButtons({ onClose, onSave, canSave, saveLabel }) {
  var C = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button
        onClick={onClose}
        style={{
          height: 40, padding: '0 20px', borderRadius: 8,
          border: '1px solid ' + C.borderMedium, background: 'transparent',
          color: C.textPrimary, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}
        onMouseEnter={function(e) { e.currentTarget.style.background = C.grid; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
      >Cancel</button>
      <button
        onClick={onSave}
        disabled={!canSave}
        style={{
          height: 40, padding: '0 24px', borderRadius: 8, border: 'none',
          background: canSave ? C.accent : C.grid,
          color: canSave ? '#FFFFFF' : C.textMuted,
          fontSize: 14, fontWeight: 500,
          cursor: canSave ? 'pointer' : 'default',
          fontFamily: "'Inter', sans-serif",
        }}
        onMouseEnter={function(e) { if (canSave) e.currentTarget.style.background = C.accentHover; }}
        onMouseLeave={function(e) { if (canSave) e.currentTarget.style.background = C.accent; }}
      >{saveLabel || 'Save'}</button>
    </div>
  );
}

// ════════════════════════════════════════════
// ADD CATEGORY MODAL
// ════════════════════════════════════════════
export function AddCategoryModal({ onSave, onClose }) {
  var [name, setName] = useState('');
  var [selectedColor, setSelectedColor] = useState(null);
  var [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    onSave(name, selectedColor);
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 24 }}>
        Add Category
      </div>

      {/* Name input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
          Category Name <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <input
          value={name}
          onChange={function(e) { setName(e.target.value); }}
          onKeyDown={function(e) { if (e.key === 'Enter' && name.trim()) handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. Hair, Nails, Color..."
          autoFocus
          style={{
            width: '100%', height: 44, padding: '0 14px', borderRadius: 8,
            border: '1px solid #475569', background: '#334155', color: '#E2E8F0',
            fontSize: 15, fontFamily: "'Inter', sans-serif", outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <ColorSwatchGrid selectedColor={selectedColor} onSelect={setSelectedColor} label="Category Color" />
      <ModalButtons onClose={onClose} onSave={handleSave} canSave={!!name.trim()} />
    </ModalBackdrop>
  );
}

// ════════════════════════════════════════════
// ADD SERVICE MODAL
// ════════════════════════════════════════════

// Duration options (15-min increments)
var DURATION_OPTIONS = [];
for (var i = 15; i <= 300; i += 15) {
  var h = Math.floor(i / 60);
  var m = i % 60;
  var label = i < 60 ? i + ' min' : (m === 0 ? h + ' hr' : h + 'h ' + m + 'm');
  DURATION_OPTIONS.push({ value: i, label: label });
}

export function AddServiceModal({ categoryColor, service, categories, onSave, onClose, onDelete, onToggleActive }) {
  var isEdit = !!service;
  var [name, setName] = useState(isEdit ? service.name : '');
  var [selectedColor, setSelectedColor] = useState(isEdit ? service.calendar_color : categoryColor);
  var [duration, setDuration] = useState(isEdit ? service.default_duration_minutes : 30);
  var [priceDisplay, setPriceDisplay] = useState(isEdit ? String(service.price_cents || '') : '');
  var [costDisplay, setCostDisplay] = useState(isEdit ? String(service.product_cost_cents || '') : '');
  var [openPrice, setOpenPrice] = useState(isEdit ? !!service.open_price : false);
  var [editingName, setEditingName] = useState(!isEdit);
  var [showDiscard, setShowDiscard] = useState(false);
  var [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  var [activeNumpad, setActiveNumpad] = useState(null); // 'price' | 'cost' | null

  // Keyboard → numpad bridge for price and cost fields
  useNumpadKeyboard(activeNumpad === 'price' && !openPrice, function(d){ handleNumpadKey(d, setPriceDisplay); }, function(){ handleNumpadKey('⌫', setPriceDisplay); }, function(){ setActiveNumpad(null); }, function(){ setActiveNumpad(null); }, [activeNumpad, openPrice]);
  useNumpadKeyboard(activeNumpad === 'cost', function(d){ handleNumpadKey(d, setCostDisplay); }, function(){ handleNumpadKey('⌫', setCostDisplay); }, function(){ setActiveNumpad(null); }, function(){ setActiveNumpad(null); }, [activeNumpad]);
  var [selectedCatIds, setSelectedCatIds] = useState(isEdit && service.category_ids ? service.category_ids.slice() : []);

  var canSave = name.trim().length > 0;

  // Track if anything changed
  var catIdsChanged = isEdit && service.category_ids ? (
    selectedCatIds.length !== service.category_ids.length ||
    selectedCatIds.some(function(id) { return !service.category_ids.includes(id); })
  ) : false;
  var hasChanges = isEdit ? (
    name !== service.name ||
    selectedColor !== service.calendar_color ||
    duration !== service.default_duration_minutes ||
    priceDisplay !== String(service.price_cents || '') ||
    costDisplay !== String(service.product_cost_cents || '') ||
    openPrice !== !!service.open_price ||
    catIdsChanged
  ) : (name.trim().length > 0 || priceDisplay.length > 0 || costDisplay.length > 0 || selectedColor !== categoryColor || duration !== 30 || openPrice);

  // Close handler — if changes exist, ask to confirm discard
  function handleClose() {
    if (hasChanges) {
      setShowDiscard(true);
    } else {
      onClose();
    }
  }

  function handleSave() {
    if (!canSave) return;
    var priceCents = openPrice ? 0 : (priceDisplay ? (parseInt(priceDisplay, 10) || 0) : 0);
    var costCents = costDisplay ? (parseInt(costDisplay, 10) || 0) : 0;
    var saveData = { name: name, color: selectedColor, duration: duration, priceCents: priceCents, productCostCents: costCents, openPrice: openPrice };
    if (isEdit && selectedCatIds.length > 0) saveData.categoryIds = selectedCatIds;
    onSave(saveData);
  }

  function handleNumpadKey(key, setter) {
    if (key === 'C') {
      setter('');
    } else if (key === '⌫') {
      setter(function(prev) { return prev.slice(0, -1); });
    } else if (key === '00') {
      setter(function(prev) { return prev + '00'; });
    } else if (/\d/.test(key)) {
      setter(function(prev) { return prev + key; });
    }
  }

  function formatPrice(raw) {
    if (!raw) return '0.00';
    var n = parseInt(raw, 10);
    return isNaN(n) ? '0.00' : (n / 100).toFixed(2);
  }

  var numpadRows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '00'],
  ];

  function renderNumpad(setter) {
    var T = useTheme();
    var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
    return (
      <div style={{ background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10, width: 170 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {keys.map(function(key) {
            return (
              <div key={key} onClick={function() { handleNumpadKey(key, setter); }}
                style={{ height: 36, borderRadius: 6, background: T.grid, color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text), fontSize: 16, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', border: '1px solid ' + T.border, transition: 'background-color 150ms' }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
              >{key}</div>
            );
          })}
        </div>
        <div onClick={function() { setActiveNumpad(null); }}
          style={{ width: '100%', height: 32, marginTop: 5, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
        >Done</div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          background: '#1E293B', borderRadius: 12, border: '1px solid #475569',
          width: 520, maxWidth: '90vw', padding: 28,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        {/* Discard confirmation overlay */}
        {showDiscard && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', borderRadius: 12, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#1E293B', borderRadius: 10, border: '1px solid #475569',
              padding: 24, width: 300, textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ color: '#E2E8F0', fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
                You have unsaved changes. Discard?
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={function() { setShowDiscard(false); }}
                  style={{
                    height: 38, padding: '0 18px', borderRadius: 8,
                    border: '1px solid #475569', background: 'transparent',
                    color: '#E2E8F0', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#334155'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Keep Editing</button>
                <button
                  onClick={onClose}
                  style={{
                    height: 38, padding: '0 18px', borderRadius: 8, border: 'none',
                    background: '#EF4444', color: '#FFFFFF',
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#DC2626'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#EF4444'; }}
                >Discard</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0' }}>
            {isEdit ? 'Edit Service' : 'Add Service'}
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 6, border: 'none',
              background: 'transparent', color: '#64748B', fontSize: 20,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={function(e) { e.currentTarget.style.color = '#E2E8F0'; e.currentTarget.style.background = '#334155'; }}
            onMouseLeave={function(e) { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent'; }}
          >✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
            Service Name <span style={{ color: '#EF4444' }}>*</span>
          </label>
          {editingName ? (
            <input
              value={name}
              onChange={function(e) { setName(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') { e.target.blur(); } if (e.key === 'Escape') { if (isEdit) { setName(service.name); setEditingName(false); } else { handleClose(); } } }}
              onBlur={function() { if (isEdit && name.trim()) setEditingName(false); }}
              placeholder="e.g. Haircut, Manicure, Balayage..."
              autoFocus
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 8,
                border: '1px solid #2563EB', background: '#334155', color: '#E2E8F0',
                fontSize: 15, fontFamily: "'Inter', sans-serif", outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              onClick={function() { setEditingName(true); }}
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 8,
                border: '1px solid #475569', background: '#334155', color: '#E2E8F0',
                fontSize: 15, fontFamily: "'Inter', sans-serif",
                boxSizing: 'border-box', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >{name}</div>
          )}
        </div>

        {/* Duration + Price + Product Cost with collapsible numpads */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {/* Duration */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
              Duration
            </label>
            <select
              value={duration}
              onChange={function(e) { setDuration(parseInt(e.target.value)); }}
              style={{
                width: '100%', height: 44, padding: '0 10px', borderRadius: 8,
                border: '1px solid #475569', background: '#334155', color: '#E2E8F0',
                fontSize: 15, fontFamily: "'Inter', sans-serif", outline: 'none',
                boxSizing: 'border-box', cursor: 'pointer',
                WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394A3B8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              }}
            >
              {DURATION_OPTIONS.map(function(opt) {
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
          </div>

          {/* Price — clickable display (disabled when open price) */}
          <div style={{ flex: 1, opacity: openPrice ? 0.4 : 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
              Price
            </label>
            <div onClick={function() { if (openPrice) return; setActiveNumpad(activeNumpad === 'price' ? null : 'price'); }}
              style={{
                background: openPrice ? '#0F172A' : (activeNumpad === 'price' ? '#0F172A' : '#1E293B'), borderRadius: 8, padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                border: '1px solid ' + (openPrice ? '#475569' : (activeNumpad === 'price' ? '#2563EB' : '#475569')), height: 44, boxSizing: 'border-box',
                cursor: openPrice ? 'default' : 'pointer', transition: 'border 150ms, background 150ms',
              }}>
              {openPrice ? (
                <span style={{ color: '#F59E0B', fontSize: 14, fontWeight: 600 }}>Open</span>
              ) : (
                <>
                  <span style={{ color: '#64748B', fontSize: 16, marginRight: 4 }}>$</span>
                  <span style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 600 }}>
                    {formatPrice(priceDisplay)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Product Cost — clickable display */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
              Product Cost
            </label>
            <div onClick={function() { setActiveNumpad(activeNumpad === 'cost' ? null : 'cost'); }}
              style={{
                background: activeNumpad === 'cost' ? '#0F172A' : '#1E293B', borderRadius: 8, padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                border: '1px solid ' + (activeNumpad === 'cost' ? '#2563EB' : '#475569'), height: 44, boxSizing: 'border-box',
                cursor: 'pointer', transition: 'border 150ms, background 150ms',
              }}>
              <span style={{ color: '#64748B', fontSize: 16, marginRight: 4 }}>$</span>
              <span style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 600 }}>
                {formatPrice(costDisplay)}
              </span>
            </div>
          </div>
        </div>

        {/* Open Price toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0' }}>Open Pricing</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Price entered at checkout instead of fixed</div>
          </div>
          <div onClick={function() { setOpenPrice(!openPrice); if (!openPrice) { setActiveNumpad(activeNumpad === 'price' ? null : activeNumpad); setPriceDisplay(''); } }}
            style={{ width: 44, height: 24, borderRadius: 12, background: openPrice ? '#22C55E' : '#475569', cursor: 'pointer', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: openPrice ? 22 : 2, transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </div>

        {/* Collapsible numpad — aligned exactly under the active field */}
        {activeNumpad && !(openPrice && activeNumpad === 'price') && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* Duration column spacer */}
            <div style={{ flex: 1 }} />
            {/* Price column */}
            <div style={{ flex: 1 }}>
              {activeNumpad === 'price' && renderNumpad(setPriceDisplay)}
            </div>
            {/* Product Cost column */}
            <div style={{ flex: 1 }}>
              {activeNumpad === 'cost' && renderNumpad(setCostDisplay)}
            </div>
          </div>
        )}

        <ColorSwatchGrid selectedColor={selectedColor} onSelect={setSelectedColor} label="Calendar Color" />

        {/* Category assignment (edit mode only) */}
        {isEdit && categories && categories.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 8 }}>
              Categories
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.filter(function(c) { return c.active; }).map(function(cat) {
                var isChecked = selectedCatIds.includes(cat.id);
                return (
                  <div key={cat.id} onClick={function() {
                    setSelectedCatIds(function(prev) {
                      if (isChecked) {
                        if (prev.length <= 1) return prev;
                        return prev.filter(function(id) { return id !== cat.id; });
                      } else {
                        return prev.concat([cat.id]);
                      }
                    });
                  }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                      background: isChecked ? 'rgba(37,99,235,0.15)' : 'transparent',
                      border: '1px solid ' + (isChecked ? '#2563EB' : '#475569'),
                    }}
                    onMouseEnter={function(e) { if (!isChecked) e.currentTarget.style.borderColor = '#64748B'; }}
                    onMouseLeave={function(e) { if (!isChecked) e.currentTarget.style.borderColor = '#475569'; }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 3,
                      border: '1px solid ' + (isChecked ? '#2563EB' : '#475569'),
                      background: isChecked ? '#2563EB' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', flexShrink: 0,
                    }}>{isChecked ? '✓' : ''}</div>
                    {cat.calendar_color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.calendar_color, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: isChecked ? '#E2E8F0' : '#94A3B8' }}>{cat.name}</span>
                  </div>
                );
              })}
            </div>
            {selectedCatIds.length <= 1 && (
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Must belong to at least one category</div>
            )}
          </div>
        )}

        {/* Delete/Deactivate row (edit mode only) */}
        {isEdit && (onDelete || onToggleActive) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {onToggleActive && (
              <button onClick={onToggleActive}
                style={{ height: 36, padding: '0 14px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: service.active ? '#F59E0B' : '#22C55E', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#334155'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >{service.active ? 'Deactivate' : 'Reactivate'}</button>
            )}
            {onDelete && (
              <button onClick={function() { setShowDeleteConfirm(true); }}
                style={{ height: 36, padding: '0 14px', borderRadius: 6, border: '1px solid #DC2626', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >Delete Service</button>
            )}
          </div>
        )}

        {hasChanges ? (
          <ModalButtons onClose={handleClose} onSave={handleSave} canSave={canSave} saveLabel={isEdit ? 'Save Changes' : 'Save'} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                height: 40, padding: '0 20px', borderRadius: 8,
                border: '1px solid #475569', background: 'transparent',
                color: '#E2E8F0', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#334155'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
            >Close</button>
          </div>
        )}

        {/* Delete confirmation overlay */}
        {showDeleteConfirm && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', borderRadius: 12, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#1E293B', borderRadius: 10, border: '1px solid #475569',
              padding: 24, width: 300, textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ color: '#E2E8F0', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                Delete "{name}"?
              </div>
              <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>
                This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={function() { setShowDeleteConfirm(false); }}
                  style={{ height: 38, padding: '0 18px', borderRadius: 8, border: '1px solid #475569', background: 'transparent', color: '#E2E8F0', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#334155'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Cancel</button>
                <button onClick={function() { setShowDeleteConfirm(false); if (onDelete) onDelete(); }}
                  style={{ height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#DC2626'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#EF4444'; }}
                >Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
