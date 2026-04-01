import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Loyalty Tiers
 * Session 11 Decisions #222, #223, #224
 * Tier management: name, threshold, earn multiplier.
 * Only visible when program_type = 'tiered'.
 */

import React, { useState } from 'react';
import { MOCK_LOYALTY_TIERS, TIER_COLORS } from './loyaltyBridge';
import { useLoyaltyStore } from '../../lib/stores/loyaltyStore';
import { isProduction } from '../../lib/apiClient';


export default function LoyaltyTiers({ programType }) {
  var T = useTheme();
  var _isProd = isProduction();
  var storeTiers = useLoyaltyStore(function(s) { return s.tiers; });
  var [tiers, setTiers] = useState(_isProd ? storeTiers : MOCK_LOYALTY_TIERS);
  var [editingId, setEditingId] = useState(null);

  if (programType !== 'tiered') {
    return (
      <div style={{ padding: 30, textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: T.textMuted, marginBottom: 8 }}>Tiers are only available for tiered programs</div>
        <div style={{ fontSize: 14, color: T.textMuted }}>Switch to "Tiered" in Settings to configure tiers</div>
      </div>
    );
  }

  function handleSave(tier) {
    if (tier.id === 'new') {
      var newTier = { ...tier, id: 'lt-' + Date.now(), program_id: 'lp-01', position: tiers.length + 1 };
      setTiers(function(prev) { return prev.concat([newTier]).sort(function(a, b) { return a.threshold_points - b.threshold_points; }); });
    } else {
      setTiers(function(prev) { return prev.map(function(t) { return t.id === tier.id ? tier : t; }).sort(function(a, b) { return a.threshold_points - b.threshold_points; }); });
    }
    setEditingId(null);
  }

  function handleDelete(id) {
    setTiers(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
    setEditingId(null);
  }

  if (editingId) {
    var existing = editingId === 'new' ? null : tiers.find(function(t) { return t.id === editingId; });
    return <TierEditor tier={existing} onSave={handleSave} onDelete={existing ? function() { handleDelete(editingId); } : null} onCancel={function() { setEditingId(null); }} />;
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Loyalty tiers</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Clients auto-promote when lifetime points reach the threshold</div>
        </div>
        <div onClick={function() { setEditingId('new'); }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
          style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.primary, transition: 'background-color 150ms' }}
        >+ Add tier</div>
      </div>

      {tiers.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 15 }}>No tiers configured</div>}

      {tiers.map(function(tier, i) {
        var colors = TIER_COLORS[tier.id] || { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' };
        return (
          <div key={tier.id}
            onClick={function() { setEditingId(tier.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, backgroundColor: colors.bg, color: colors.text, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{tier.name}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
                {tier.threshold_points === 0 ? 'Base tier — everyone starts here' : tier.threshold_points.toLocaleString() + ' lifetime points to reach'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>{tier.earn_multiplier}×</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>earn rate</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tier Editor ──
function TierEditor({ tier, onSave, onDelete, onCancel }) {
  var T = useTheme();
  var isNew = !tier;
  var [name, setName] = useState(tier ? tier.name : '');
  var [threshold, setThreshold] = useState(tier ? String(tier.threshold_points) : '0');
  var [multiplier, setMultiplier] = useState(tier ? String(tier.earn_multiplier) : '1.0');
  var [activeNumpad, setActiveNumpad] = useState(null);

  function handleNumpad(field, k) {
    var getter = field === 'threshold' ? threshold : multiplier;
    var setter = field === 'threshold' ? setThreshold : setMultiplier;
    if (k === 'C') { setter(''); return; }
    if (k === '⌫') { setter(getter.slice(0, -1)); return; }
    if (k === '✓') { setActiveNumpad(null); return; }
    if (k === '.' && getter.indexOf('.') !== -1) return;
    if (getter.length < 8) setter(getter + k);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      id: tier ? tier.id : 'new',
      program_id: tier ? tier.program_id : 'lp-01',
      name: name.trim(),
      threshold_points: parseInt(threshold, 10) || 0,
      earn_multiplier: parseFloat(multiplier) || 1.0,
      position: tier ? tier.position : 0,
    });
  }

  function NumpadBlock({ field }) {
    if (activeNumpad !== field) return null;
    return (
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(4, 44px)', gap: 4, marginTop: 8 }}>
        {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0','.'].map(function(k) {
          var span = {};
          return (
            <div key={k} onClick={function() { handleNumpad(field, k); }}
              onMouseEnter={function(e) { if (k !== '✓') e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { if (k !== '✓') e.currentTarget.style.backgroundColor = T.grid; }}
              style={{
                height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                backgroundColor: k === '✓' ? T.primary : T.grid,
                color: k === '✓' ? '#fff' : k === '⌫' ? T.danger : k === 'C' ? T.textMuted : T.text,
                border: '1px solid ' + (k === '✓' ? T.primary : T.border),
                transition: 'background-color 150ms', ...span,
              }}>{k}</div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div onClick={onCancel}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}>← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isNew ? 'New tier' : 'Edit tier'}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Tier name</div>
        <textarea value={name} onChange={function(e) { setName(e.target.value); }} rows={1}
          placeholder="e.g. Gold"
          style={{ width: '100%', maxWidth: 400, height: 34, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Lifetime points to reach this tier</div>
        <div onClick={function() { setActiveNumpad(activeNumpad === 'threshold' ? null : 'threshold'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: '1px solid ' + (activeNumpad === 'threshold' ? T.primary : T.border), backgroundColor: T.chrome, fontSize: 16, fontWeight: 600, color: T.text, cursor: 'pointer' }}>
          {threshold || '0'} <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 400 }}>pts</span>
        </div>
        <NumpadBlock field="threshold" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Earn rate multiplier</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>Base rate × this number. Example: 1.5× means 50% more points.</div>
        <div onClick={function() { setActiveNumpad(activeNumpad === 'multiplier' ? null : 'multiplier'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 6, border: '1px solid ' + (activeNumpad === 'multiplier' ? T.primary : T.border), backgroundColor: T.chrome, fontSize: 16, fontWeight: 600, color: T.text, cursor: 'pointer' }}>
          {multiplier || '1.0'}×
        </div>
        <NumpadBlock field="multiplier" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div onClick={handleSave}
          onMouseEnter={function(e) { if (name.trim()) e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
          style={{ padding: '10px 24px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 14, fontWeight: 500, cursor: name.trim() ? 'pointer' : 'default', opacity: name.trim() ? 1 : 0.5, border: '1px solid ' + T.primary, transition: 'background-color 150ms' }}>{isNew ? 'Create tier' : 'Save'}</div>
        <div onClick={onCancel}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
          style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}>Cancel</div>
        {onDelete && <div onClick={onDelete}
          style={{ marginLeft: 'auto', padding: '10px 16px', borderRadius: 6, border: '1px solid ' + T.danger, color: T.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Delete</div>}
      </div>
    </div>
  );
}
