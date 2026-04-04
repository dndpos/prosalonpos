import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Loyalty Rewards
 * Session 11 Decision #221
 * Two types: dollar_discount and free_service.
 * Free service picker uses category tabs → service list (matches booking flow).
 */

import React, { useState } from 'react';
import { MOCK_LOYALTY_REWARDS, MOCK_LOYALTY_TIERS, TIER_COLORS } from './loyaltyBridge';
import { useLoyaltyStore } from '../../lib/stores/loyaltyStore';
import { isProduction } from '../../lib/apiClient';
import { useServiceStore } from '../../lib/stores/serviceStore';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';
import { fmt } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';



export default function LoyaltyRewards({ programType, catalogLayout }) {
  var T = useTheme();
  var _isProd = isProduction();
  var MOCK_SERVICES = useServiceStore(function(s) { return s.services; });
  var MOCK_CATEGORIES = useServiceStore(function(s) { return s.categories; });
  var storeRewards = useLoyaltyStore(function(s) { return s.rewards; });
  var storeTiers = useLoyaltyStore(function(s) { return s.tiers; });
  var [rewards, setRewards] = useState(_isProd ? storeRewards : MOCK_LOYALTY_REWARDS);
  var [editingId, setEditingId] = useState(null);

  function handleSave(reward) {
    if (reward.id === 'new') {
      var newR = { ...reward, id: 'lr-' + Date.now(), program_id: 'lp-01' };
      setRewards(function(prev) { return prev.concat([newR]); });
    } else {
      setRewards(function(prev) { return prev.map(function(r) { return r.id === reward.id ? reward : r; }); });
    }
    setEditingId(null);
  }

  function handleDelete(id) {
    setRewards(function(prev) { return prev.filter(function(r) { return r.id !== id; }); });
    setEditingId(null);
  }

  function handleToggleActive(id) {
    setRewards(function(prev) { return prev.map(function(r) { return r.id === id ? { ...r, active: !r.active } : r; }); });
  }

  if (editingId) {
    var existing = editingId === 'new' ? null : rewards.find(function(r) { return r.id === editingId; });
    return <RewardEditor reward={existing} programType={programType} catalogLayout={catalogLayout} onSave={handleSave} onDelete={existing ? function() { handleDelete(editingId); } : null} onCancel={function() { setEditingId(null); }} />;
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Rewards</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{rewards.filter(function(r) { return r.active; }).length} active reward{rewards.filter(function(r) { return r.active; }).length !== 1 ? 's' : ''}</div>
        </div>
        <div onClick={function() { setEditingId('new'); }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
          style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.primary, transition: 'background-color 150ms' }}
        >+ Add reward</div>
      </div>

      {rewards.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 15 }}>No rewards created</div>}

      {rewards.map(function(r) {
        var tierName = null;
        if (r.tier_id) {
          var tier = storeTiers.find(function(t) { return t.id === r.tier_id; });
          tierName = tier ? tier.name + '+' : null;
        }
        var tierColors = r.tier_id ? (TIER_COLORS[r.tier_id] || { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' }) : null;
        var svcCount = 0;
        var svcLabel = '';
        if (r.service_catalog_ids && r.service_catalog_ids.length > 0) {
          svcCount = r.service_catalog_ids.length;
          if (svcCount === 1) {
            var svc = MOCK_SERVICES.find(function(s) { return s.id === r.service_catalog_ids[0]; });
            svcLabel = 'Free ' + (svc ? svc.name : 'service');
          } else {
            svcLabel = 'Free service (' + svcCount + ' options)';
          }
        } else if (r.service_catalog_id) {
          var svc2 = MOCK_SERVICES.find(function(s) { return s.id === r.service_catalog_id; });
          svcLabel = 'Free ' + (svc2 ? svc2.name : 'service');
        } else {
          svcLabel = 'Free service';
        }

        return (
          <div key={r.id}
            onClick={function() { setEditingId(r.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms', opacity: r.active ? 1 : 0.5 }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, backgroundColor: r.type === 'dollar_discount' ? 'rgba(34,197,94,0.12)' : T.accentBg, flexShrink: 0 }}>
              {r.type === 'dollar_discount' ? '💵' : '✨'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{r.name}</span>
                {tierName && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: tierColors.bg, color: tierColors.text }}>{tierName}</span>}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
                {r.type === 'dollar_discount' ? fmt(r.discount_cents) + ' off' : svcLabel}
                {' · '}{r.point_cost} pts
              </div>
            </div>
            <span
              onClick={function(e) { e.stopPropagation(); handleToggleActive(r.id); }}
              style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', color: r.active ? T.success : T.textMuted, backgroundColor: r.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)', border: '1px solid ' + (r.active ? 'rgba(34,197,94,0.2)' : 'transparent') }}
            >{r.active ? 'Active' : 'Inactive'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════
// REWARD EDITOR
// ════════════════════════════════════════════

function RewardEditor({ reward, programType, catalogLayout, onSave, onDelete, onCancel }) {
  var T = useTheme();
  var isNew = !reward;
  var [name, setName] = useState(reward ? reward.name : '');
  var [type, setType] = useState(reward ? reward.type : 'dollar_discount');
  var [pointCost, setPointCost] = useState(reward ? String(reward.point_cost) : '');
  var [discountStr, setDiscountStr] = useState(reward ? String(reward.discount_cents || '') : '');
  var [serviceIds, setServiceIds] = useState(reward && reward.service_catalog_ids ? reward.service_catalog_ids.slice() : (reward && reward.service_catalog_id ? [reward.service_catalog_id] : []));
  var [tierId, setTierId] = useState(reward ? reward.tier_id : null);
  var [active, setActive] = useState(reward ? reward.active : true);
  var [activeNumpad, setActiveNumpad] = useState(null);
  var [showServicePicker, setShowServicePicker] = useState(false);

  function handleNumpad(field, k) {
    var getter = field === 'points' ? pointCost : discountStr;
    var setter = field === 'points' ? setPointCost : setDiscountStr;
    if (k === 'C') { setter(''); return; }
    if (k === '⌫') { setter(getter.slice(0, -1)); return; }
    if (k === '✓') { setActiveNumpad(null); return; }
    if (getter.length < 7) setter(getter + k);
  }

  function handleSave() {
    if (!name.trim() || !pointCost) return;
    onSave({
      id: reward ? reward.id : 'new',
      name: name.trim(),
      type: type,
      point_cost: parseInt(pointCost, 10) || 0,
      discount_cents: type === 'dollar_discount' ? (parseInt(discountStr, 10) || 0) : null,
      service_catalog_ids: type === 'free_service' ? serviceIds : [],
      service_catalog_id: type === 'free_service' && serviceIds.length > 0 ? serviceIds[0] : null,
      tier_id: tierId,
      active: active,
    });
  }

  function toggleService(svcId) {
    setServiceIds(function(prev) {
      if (prev.indexOf(svcId) !== -1) return prev.filter(function(id) { return id !== svcId; });
      return prev.concat([svcId]);
    });
  }

  function NumpadBlock({ field }) {
    if (activeNumpad !== field) return null;
    return (
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(4, 44px)', gap: 4, marginTop: 8 }}>
        {['7','8','9','⌫','4','5','6','C','1','2','3','✓','0'].map(function(k) {
          var span = k === '0' ? { gridColumn: 'span 3' } : {};
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

  // ── SERVICE PICKER (checkout-style layout) ──
  if (showServicePicker) {
    return (
      <ServicePickerPanel
        selectedIds={serviceIds}
        onToggle={toggleService}
        onDone={function() { setShowServicePicker(false); }}
        catalogLayout={catalogLayout}
      />
    );
  }

  // ── MAIN EDITOR ──
  var selectedSvcNames = serviceIds.map(function(id) { return MOCK_SERVICES.find(function(s) { return s.id === id; }); }).filter(Boolean);

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div onClick={onCancel}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}>← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isNew ? 'New reward' : 'Edit reward'}</span>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Reward name</div>
        <textarea value={name} onChange={function(e) { setName(e.target.value); }} rows={1} placeholder='e.g. "$10 off" or "Free Basic Service"'
          style={{ width: '100%', maxWidth: 400, height: 36, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Type */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Reward type</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ key: 'dollar_discount', label: '💵 Dollar discount' }, { key: 'free_service', label: '✨ Free service' }].map(function(opt) {
            var act = type === opt.key;
            return (
              <div key={opt.key} onClick={function() { setType(opt.key); }}
                onMouseEnter={function(e) { if (!act) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                onMouseLeave={function(e) { if (!act) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
                style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: act ? T.primary : T.chrome, color: act ? '#fff' : T.textMuted, border: '1px solid ' + (act ? T.primary : T.border), userSelect: 'none', transition: 'background-color 150ms' }}
              >{opt.label}</div>
            );
          })}
        </div>
      </div>

      {/* Point cost */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Point cost</div>
        <div onClick={function() { setActiveNumpad(activeNumpad === 'points' ? null : 'points'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: '1px solid ' + (activeNumpad === 'points' ? T.primary : T.border), backgroundColor: T.chrome, fontSize: 16, fontWeight: 600, color: T.text, cursor: 'pointer' }}>
          {pointCost || '0'} <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 400 }}>pts</span>
        </div>
        <NumpadBlock field="points" />
      </div>

      {/* Dollar discount value */}
      {type === 'dollar_discount' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Discount amount (cash register entry)</div>
          <div onClick={function() { setActiveNumpad(activeNumpad === 'discount' ? null : 'discount'); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 6, border: '1px solid ' + (activeNumpad === 'discount' ? T.primary : T.border), backgroundColor: T.chrome, fontSize: 16, fontWeight: 600, color: T.text, cursor: 'pointer' }}>
            ${discountStr ? (parseInt(discountStr, 10) / 100).toFixed(2) : '0.00'}
          </div>
          <NumpadBlock field="discount" />
        </div>
      )}

      {/* Free service — button opens checkout-style picker */}
      {type === 'free_service' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Qualifying services</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 10 }}>Client picks one of these services at checkout when redeeming</div>

          <div
            onClick={function() { setShowServicePicker(true); }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.primary; }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 6, border: '1px solid ' + T.primary, backgroundColor: T.chrome, color: T.primary, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
          >
            Select free services
            {serviceIds.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, backgroundColor: T.primary, color: '#fff', fontSize: 12, fontWeight: 600 }}>{serviceIds.length}</span>
            )}
          </div>

          {/* Selected services list */}
          {selectedSvcNames.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {selectedSvcNames.map(function(svc) {
                return (
                  <div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, backgroundColor: T.grid, border: '1px solid ' + T.border, fontSize: 13, color: T.text }}>
                    {svc.name}
                    <span onClick={function() { toggleService(svc.id); }} style={{ cursor: 'pointer', color: T.danger, fontSize: 14, fontWeight: 600 }}>×</span>
                  </div>
                );
              })}
            </div>
          )}
          {serviceIds.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: T.warning }}>No services selected — tap the button above to pick services</div>
          )}
        </div>
      )}

      {/* Tier restriction */}
      {programType === 'tiered' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>Available to tier (optional)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <div onClick={function() { setTierId(null); }}
              onMouseEnter={function(e) { if (tierId) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; } }}
              onMouseLeave={function(e) { if (tierId) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; } }}
              style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: !tierId ? T.primary : T.chrome, color: !tierId ? '#fff' : T.textMuted, border: '1px solid ' + (!tierId ? T.primary : T.border), userSelect: 'none', transition: 'background-color 150ms' }}
            >All tiers</div>
            {storeTiers.map(function(t) {
              var act = tierId === t.id;
              return (
                <div key={t.id} onClick={function() { setTierId(t.id); }}
                  onMouseEnter={function(e) { if (!act) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; } }}
                  onMouseLeave={function(e) { if (!act) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; } }}
                  style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: act ? T.primary : T.chrome, color: act ? '#fff' : T.textMuted, border: '1px solid ' + (act ? T.primary : T.border), userSelect: 'none', transition: 'background-color 150ms' }}
                >{t.name}+</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div onClick={handleSave}
          onMouseEnter={function(e) { if (name.trim() && pointCost) e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
          style={{ padding: '10px 24px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 14, fontWeight: 500, cursor: name.trim() && pointCost ? 'pointer' : 'default', opacity: name.trim() && pointCost ? 1 : 0.5, border: '1px solid ' + T.primary, transition: 'background-color 150ms' }}
        >{isNew ? 'Create reward' : 'Save'}</div>
        <div onClick={onCancel}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
          style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
        >Cancel</div>
        {onDelete && <div onClick={onDelete} style={{ marginLeft: 'auto', padding: '10px 16px', borderRadius: 6, border: '1px solid ' + T.danger, color: T.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Delete</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// SERVICE PICKER — checkout-style two-panel layout
// Categories left, services right, multi-select with checkmarks
// ════════════════════════════════════════════

function ServicePickerPanel({ selectedIds, onToggle, onDone, catalogLayout }) {
  var T = useTheme();
  var cl = catalogLayout || {};
  var categories = cl.categories || MOCK_CATEGORIES;
  var services = cl.services || MOCK_SERVICES;
  var catColumns = cl.catColumns || 2;
  var svcColumns = cl.svcColumns || 4;
  var svcRows = cl.svcRows || 3;
  var catSlots = cl.catSlots || {};
  var svcSlots = cl.svcSlots || {};

  var activeCats = categories.filter(function(c) { return c.active; }).sort(function(a, b) { return a.position - b.position; });
  var [activeCatId, setActiveCatId] = useState(activeCats.length > 0 ? activeCats[0].id : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <AreaTag id="LY-REW" />
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid ' + T.border, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Select qualifying services</span>
          {selectedIds.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24, padding: '0 8px', borderRadius: 12, backgroundColor: T.primary, color: '#fff', fontSize: 12, fontWeight: 600 }}>{selectedIds.length} selected</span>
          )}
        </div>
        <div
          onClick={onDone}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.primaryHover; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
          style={{ padding: '8px 20px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.primary, transition: 'background-color 150ms' }}
        >Done</div>
      </div>

      {/* Two bordered panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 12, gap: 12 }}>

        {/* Left: Category panel */}
        <div style={{ width: 200, minWidth: 200, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome, flexShrink: 0 }}>
          <CategoryGrid
            categories={categories}
            activeCat={activeCatId}
            onSelect={function(id) { setActiveCatId(id); }}
            catSlots={catSlots}
            catColumns={catColumns}
            layout="grid"
            mode="view"
          />
        </div>

        {/* Right: Service card grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: 14, border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome, display: 'flex', flexDirection: 'column' }}>
          <ServiceGrid
            services={services}
            activeCat={activeCatId}
            svcSlots={svcSlots}
            svcColumns={svcColumns}
            svcRows={svcRows}
            mode="multi"
            selectedIds={selectedIds}
            onTap={function(svc) { onToggle(svc.id); }}
          />
        </div>
      </div>
    </div>
  );
}
