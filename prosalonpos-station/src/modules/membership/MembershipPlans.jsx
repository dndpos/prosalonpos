import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
/**
 * Pro Salon POS — Membership Plans
 * Session 96 — Wired to API via direct store subscription (no Proxy bridge).
 * Plan CRUD: name, billing cycle, price, perks (3 types), cancellation,
 * missed payment action, credit rollover, freeze, perk apply mode.
 * All numpads: div-based, calculator layout (7-8-9 top).
 * All price inputs: cash register mode.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import { STATUS_COLORS, cycleName } from './membershipBridge';
import { useMembershipStore } from '../../lib/stores/membershipStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';
import AreaTag from '../../components/ui/AreaTag';


function dollars(cents) { return '$' + (cents / 100).toFixed(2); }

// ═══════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════
function Toggle({ value, onChange }) {
  var T = useTheme();
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? T.success : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (value ? T.success : T.border) }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
    </div>
  );
}

function Card({ children, style }) {
  var T = useTheme();
  return <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '10px 14px', marginBottom: 8, ...style }}>{children}</div>;
}

function Row({ label, desc, children }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{desc}</div>}</div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function StackedRow({ label, desc, children }) {
  var T = useTheme();
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ marginBottom: 5 }}><div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>{desc && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>{desc}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

function BtnGroup({ value, onChange, options }) {
  var T = useTheme();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(function(opt) {
        var active = value === opt.key;
        return (
          <div key={opt.key} onClick={function() { onChange(opt.key); }}
            onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
            onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.border; } }}
            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', backgroundColor: active ? T.primary : T.chrome, color: active ? '#fff' : T.textSecondary, border: '1px solid ' + (active ? T.primary : T.border), userSelect: 'none', transition: 'background-color 150ms, color 150ms' }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// NUMPAD — div-based, calculator layout
// ═══════════════════════════════════════
function Numpad({ onKey, onDone, label }) {
  var T = useTheme();
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  return (
    <div style={{ background: '#0F172A', border: '1px solid #475569', borderRadius: 10, padding: 10, width: 180 }}>
      {label && <div style={{ color:T.text, fontSize: 11, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { onKey(key); }}
              style={{ height: 38, borderRadius: 6, background: isAction ? '#475569' : '#334155', color: key === '⌫' ? '#EF4444' : (key === 'C' ? '#F59E0B' : '#E2E8F0'), fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = isAction ? '#536179' : '#3E4C5E'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = isAction ? '#475569' : '#334155'; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 34, marginTop: 5, borderRadius: 6, background: T.accent, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
        onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = T.accent; }}
      >Done</div>
    </div>
  );
}

// Price display field (cash register mode)
function PriceField({ label, cents, active, onClick }) {
  var T = useTheme();
  return (
    <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
      <div style={{ height: 30, padding: '0 6px', background: '#475569', border: '1px solid ' + (active ? T.accent : '#475569'), borderRadius: '5px 0 0 5px', display: 'flex', alignItems: 'center', color: '#E2E8F0', fontSize: 11, fontWeight: 500 }}>$</div>
      <div style={{ height: 30, padding: '0 8px', background: '#334155', border: '1px solid ' + (active ? T.accent : '#475569'), borderLeft: 'none', borderRadius: '0 5px 5px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 50 }}>
        <span style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600 }}>{(cents / 100).toFixed(2)}</span>
      </div>
    </div>
  );
}

// Number display field
function NumField({ label, value, suffix, active, onClick }) {
  var T = useTheme();
  return (
    <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '4px 10px', borderRadius: 5, border: '1px solid ' + (active ? T.accent : '#475569'), backgroundColor: T.chrome, fontSize: 13, fontWeight: 600, color: T.text, gap: 3 }}>
      {value || 0}{suffix && <span style={{ fontSize: 11, color: T.textSecondary, fontWeight: 400 }}>{suffix}</span>}
    </div>
  );
}


// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function MembershipPlans({ catalogLayout }) {
  var T = useTheme();
  var toast = useToast();
  var MOCK_SERVICES = useServiceStore(function(s) { return s.services; });
  var MOCK_CATEGORIES = useServiceStore(function(s) { return s.categories; });
  var storePlans = useMembershipStore(function(s) { return s.plans; });
  var fetchPlans = useMembershipStore(function(s) { return s.fetchPlans; });
  var storeCreatePlan = useMembershipStore(function(s) { return s.createPlan; });
  var storeUpdatePlan = useMembershipStore(function(s) { return s.updatePlan; });
  var storeDeletePlan = useMembershipStore(function(s) { return s.deletePlan; });
  var storeInitialized = useMembershipStore(function(s) { return s.initialized; });

  // Plans come directly from store — perks are embedded on each plan object
  var plans = storePlans;

  // Fetch on mount
  useEffect(function() { if (!storeInitialized) fetchPlans(); }, []);
  var [editingPlan, setEditingPlan] = useState(null);    // null = list, object = editing
  var [editingPerks, setEditingPerks] = useState([]);     // perks for the plan being edited
  var [originalSnapshot, setOriginalSnapshot] = useState(null); // snapshot for dirty detection
  var [showUnsavedPopup, setShowUnsavedPopup] = useState(false);
  var [activeNumpad, setActiveNumpad] = useState(null);   // which numpad is open
  var [numStr, setNumStr] = useState('');

  // For perk editing
  var [perkNumpad, setPerkNumpad] = useState(null);
  var [perkNumStr, setPerkNumStr] = useState('');

  // Service picker for free_service perk
  var [svcPickerPerkId, setSvcPickerPerkId] = useState(null);
  var [svcPickerCat, setSvcPickerCat] = useState(null);
  var cl = catalogLayout || {};
  var _catList = cl.categories || MOCK_CATEGORIES;
  var _svcList = cl.services || MOCK_SERVICES;

  function handleNumKey(key, setter) {
    setter(function(p) { if (key === 'C') return ''; if (key === '⌫') return p.slice(0, -1); if (/\d/.test(key)) return p + key; return p; });
  }

  // Keyboard support for main numpad
  useNumpadKeyboard(
    !!activeNumpad && !perkNumpad,
    function(d) { handleNumKey(d, setNumStr); },
    function() { handleNumKey('⌫', setNumStr); },
    function() { setActiveNumpad(null); },
    function() { setActiveNumpad(null); setNumStr(''); },
    [activeNumpad, numStr]
  );

  // Keyboard support for perk numpad
  useNumpadKeyboard(
    !!perkNumpad && !activeNumpad,
    function(d) { handleNumKey(d, setPerkNumStr); },
    function() { handleNumKey('⌫', setPerkNumStr); },
    function() { setPerkNumpad(null); },
    function() { setPerkNumpad(null); setPerkNumStr(''); },
    [perkNumpad, perkNumStr]
  );

  function openNumpad(field, currentValue) {
    setActiveNumpad(field);
    setNumStr(String(currentValue || ''));
  }

  function closeNumpad(field, callback) {
    var val = parseInt(numStr, 10) || 0;
    callback(val);
    setActiveNumpad(null);
    setNumStr('');
  }

  function updateEditField(key, val) {
    setEditingPlan(function(prev) { var next = Object.assign({}, prev); next[key] = val; return next; });
  }

  function checkHasChanges() {
    if (!originalSnapshot || !editingPlan) return false;
    var current = JSON.stringify({ plan: editingPlan, perks: editingPerks });
    return current !== originalSnapshot;
  }

  function discardEdits() {
    setEditingPlan(null); setEditingPerks([]); setActiveNumpad(null); setPerkNumpad(null); setShowUnsavedPopup(false); setOriginalSnapshot(null);
  }

  function handleBack() {
    if (checkHasChanges()) { setShowUnsavedPopup(true); } else { discardEdits(); }
  }

  // ── PLAN LIST ──
  if (!editingPlan) {
    var activePlans = plans.filter(function(p) { return p.active; });
    var inactivePlans = plans.filter(function(p) { return !p.active; });

    function newPlan() {
      setEditingPerks([]);
      var np = {
        id: 'mp-new-' + Date.now(),
        location_id: 'loc-01',
        name: '',
        description: '',
        billing_cycle_days: 30,
        price_cents: 0,
        payment_method: 'in_person',
        min_commitment_cycles: null,
        notice_period_days: null,
        missed_payment_action: 'pause',
        missed_payment_threshold: null,
        credit_rollover: false,
        perk_apply_mode: 'auto',
        freeze_allowed: true,
        active: true,
        position: plans.length + 1,
        _isNew: true,
      };
      setOriginalSnapshot(JSON.stringify({ plan: np, perks: [] }));
      setEditingPlan(np);
    }

    function renderPlanCard(plan) {
      var planPerks = plan.perks || [];
      return (
        <div key={plan.id}
          onClick={function() { var perks = (plan.perks || []).map(function(pk) { return Object.assign({}, pk); }); var planCopy = Object.assign({}, plan); setEditingPerks(perks); setEditingPlan(planCopy); setOriginalSnapshot(JSON.stringify({ plan: planCopy, perks: perks })); }}
          style={{ backgroundColor: T.grid, borderRadius: 8, padding: '14px 16px', marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms', border: '1px solid ' + T.border }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3B4A63'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{plan.name || 'Untitled Plan'}</span>
              {!plan.active && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.15)', color:T.text }}>Inactive</span>}
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.success }}>{dollars(plan.price_cents)}<span style={{ fontSize: 11, fontWeight: 400, color: T.textSecondary }}>/{cycleName(plan.billing_cycle_days).toLowerCase()}</span></span>
          </div>
          {plan.description && <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{plan.description}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {planPerks.map(function(pk) {
              var label = '';
              if (pk.type === 'percentage_discount') {
                label = pk.discount_percentage + '% off' + (pk.category_id ? ' ' + (MOCK_CATEGORIES.find(function(c) { return c.id === pk.category_id; }) || {}).name : '') + (pk.service_catalog_id ? ' ' + (MOCK_SERVICES.find(function(s) { return s.id === pk.service_catalog_id; }) || {}).name : '');
                if (!pk.category_id && !pk.service_catalog_id) label = pk.discount_percentage + '% off all';
              } else if (pk.type === 'free_service') {
                var svc = MOCK_SERVICES.find(function(s) { return s.id === pk.service_catalog_id; });
                label = pk.quantity_per_cycle + '× free ' + (svc ? svc.name : '?');
              } else if (pk.type === 'service_credit') {
                label = dollars(pk.credit_amount_cents) + ' credit';
              }
              return (
                <span key={pk.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: 'rgba(139,92,246,0.2)', color: '#E2E8F0' }}>{label}</span>
              );
            })}
            {planPerks.length === 0 && <span style={{ fontSize: 11, color: T.textSecondary }}>No perks configured</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: T.textSecondary }}>
            <span>{plan.payment_method === 'upfront' ? 'Pay upfront' : 'Pay each cycle'}</span>
            {plan.freeze_allowed && <span>· Freeze allowed</span>}
            {plan.credit_rollover && <span>· Credits roll over</span>}
            <span>· {plan.perk_apply_mode === 'auto' ? 'Auto-apply' : 'Manual'}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Membership plans</div>
          <div onClick={newPlan}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
            style={{ padding: '8px 16px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
          >+ New plan</div>
        </div>

        {activePlans.length === 0 && inactivePlans.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: T.textSecondary, fontSize: 13 }}>No plans created yet. Tap "New plan" to get started.</div>
        )}

        {activePlans.map(renderPlanCard)}

        {inactivePlans.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, marginTop: 16, marginBottom: 8 }}>Inactive plans</div>
            {inactivePlans.map(renderPlanCard)}
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // PLAN EDITOR
  // ═══════════════════════════════════════
  var ep = editingPlan;
  var planPerks = editingPerks;

  function savePlan() {
    if (!ep.name.trim()) { toast.show('Plan name is required.', 'error'); return; }
    if (ep.price_cents <= 0) { toast.show('Price must be greater than $0.', 'error'); return; }

    // Build payload — plan fields + perks array
    var payload = {
      name: ep.name,
      description: ep.description || null,
      price_cents: ep.price_cents,
      billing_cycle_days: ep.billing_cycle_days || 30,
      payment_method: ep.payment_method || 'in_person',
      min_commitment_cycles: ep.min_commitment_cycles || null,
      notice_period_days: ep.notice_period_days || null,
      missed_payment_action: ep.missed_payment_action || 'pause',
      missed_payment_threshold: ep.missed_payment_threshold || null,
      credit_rollover: ep.credit_rollover === true,
      perk_apply_mode: ep.perk_apply_mode || 'auto',
      freeze_allowed: ep.freeze_allowed !== false,
      active: ep.active === true ? true : false,
      position: ep.position || 0,
      perks: editingPerks.map(function(pk) {
        return {
          type: pk.type,
          discount_percentage: pk.discount_percentage || null,
          service_catalog_id: pk.service_catalog_id || null,
          category_id: pk.category_id || null,
          credit_amount_cents: pk.credit_amount_cents || null,
          quantity_per_cycle: pk.quantity_per_cycle || null,
        };
      }),
    };

    if (ep._isNew) {
      storeCreatePlan(payload).then(function(plan) {
        toast.show('Plan created', 'success');
      }).catch(function(err) { console.error('[MembershipPlans] Create FAILED:', err); toast.show('Save failed: ' + err.message, 'error'); });
    } else {
      storeUpdatePlan(ep.id, payload).then(function(plan) {
        toast.show('Plan updated', 'success');
      }).catch(function(err) { console.error('[MembershipPlans] Update FAILED:', err); toast.show('Save failed: ' + err.message, 'error'); });
    }
    setEditingPlan(null); setEditingPerks([]); setOriginalSnapshot(null); setShowUnsavedPopup(false);
  }

  function deletePlan() {
    toast.confirm('Delete this plan? This cannot be undone.', function() {
      setEditingPlan(null); setEditingPerks([]); setOriginalSnapshot(null); setShowUnsavedPopup(false);
      storeDeletePlan(ep.id).then(function() {
        toast.show('Plan deleted', 'success');
      }).catch(function(err) { console.error('[MembershipPlans] Delete FAILED:', err); toast.show('Delete failed: ' + err.message, 'error'); });
    });
  }

  // ── PERK MANAGEMENT ──
  function addPerk(type) {
    var newPerk = {
      id: 'pk-local-' + Date.now(),
      plan_id: ep.id,
      type: type,
      discount_percentage: type === 'percentage_discount' ? 10 : null,
      service_catalog_id: null,
      category_id: null,
      credit_amount_cents: type === 'service_credit' ? 2500 : null,
      quantity_per_cycle: type === 'free_service' ? 1 : null,
    };
    setEditingPerks(function(prev) { return prev.concat([newPerk]); });
  }

  function removePerk(perkId) {
    setEditingPerks(function(prev) { return prev.filter(function(pk) { return pk.id !== perkId; }); });
    setPerkNumpad(null);
  }

  function updatePerk(perkId, key, val) {
    setEditingPerks(function(prev) { return prev.map(function(pk) { return pk.id === perkId ? Object.assign({}, pk, (function() { var o = {}; o[key] = val; return o; })()) : pk; }); });
  }

  function renderPerkEditor(pk) {

    if (pk.type === 'percentage_discount') {
      return (
        <div key={pk.id} style={{ backgroundColor: T.grid, borderRadius: 6, padding: '10px 14px', marginBottom: 6, border: '1px solid ' + T.border }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#C4B5FD' }}>Percentage discount</span>
            <div onClick={function() { removePerk(pk.id); }} style={{ fontSize: 11, color: T.danger, cursor: 'pointer' }}>Remove</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <NumField value={perkNumpad === pk.id + '_pct' ? (parseInt(perkNumStr, 10) || 0) : pk.discount_percentage} suffix="%" active={perkNumpad === pk.id + '_pct'}
                onClick={function() { if (perkNumpad === pk.id + '_pct') { setPerkNumpad(null); } else { setPerkNumpad(pk.id + '_pct'); setPerkNumStr(String(pk.discount_percentage || '')); } }} />
              <span style={{ fontSize: 11, color: T.textSecondary }}>off</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: T.textSecondary }}>Applies to:</span>
              <BtnGroup value={!pk.category_id && !pk.service_catalog_id ? 'all' : pk.category_id ? 'category' : 'service'}
                onChange={function(v) {
                  if (v === 'all') { updatePerk(pk.id, 'category_id', null); updatePerk(pk.id, 'service_catalog_id', null); }
                  else if (v === 'category') { updatePerk(pk.id, 'service_catalog_id', null); if (!pk.category_id) updatePerk(pk.id, 'category_id', MOCK_CATEGORIES[0].id); }
                  else { updatePerk(pk.id, 'category_id', null); if (!pk.service_catalog_id) updatePerk(pk.id, 'service_catalog_id', MOCK_SERVICES[0].id); }
                }}
                options={[{ key: 'all', label: 'All services' }, { key: 'category', label: 'Category' }, { key: 'service', label: 'Service' }]}
              />
            </div>
          </div>
          {pk.category_id && (
            <div style={{ marginTop: 6 }}>
              <select value={pk.category_id} onChange={function(e) { updatePerk(pk.id, 'category_id', e.target.value); }}
                style={{ background: T.chrome, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                {MOCK_CATEGORIES.filter(function(c) { return c.active; }).map(function(c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
              </select>
            </div>
          )}
          {pk.service_catalog_id && !pk.category_id && (
            <div style={{ marginTop: 6 }}>
              <select value={pk.service_catalog_id} onChange={function(e) { updatePerk(pk.id, 'service_catalog_id', e.target.value); }}
                style={{ background: T.chrome, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                {MOCK_SERVICES.filter(function(s) { return s.active; }).map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
              </select>
            </div>
          )}
          {perkNumpad === pk.id + '_pct' && (
            <div style={{ marginTop: 8 }}>
              <Numpad label={null} onKey={function(k) { handleNumKey(k, setPerkNumStr); }}
                onDone={function() { updatePerk(pk.id, 'discount_percentage', parseInt(perkNumStr, 10) || 0); setPerkNumpad(null); }} />
            </div>
          )}
        </div>
      );
    }

    if (pk.type === 'free_service') {
      var selectedSvc = MOCK_SERVICES.find(function(s) { return s.id === pk.service_catalog_id; });
      return (
        <div key={pk.id} style={{ backgroundColor: T.grid, borderRadius: 6, padding: '10px 14px', marginBottom: 6, border: '1px solid ' + T.border }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#4ADE80' }}>Free service</span>
            <div onClick={function() { removePerk(pk.id); }} style={{ fontSize: 11, color: T.danger, cursor: 'pointer' }}>Remove</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <NumField value={perkNumpad === pk.id + '_qty' ? (parseInt(perkNumStr, 10) || 0) : pk.quantity_per_cycle} suffix="/cycle" active={perkNumpad === pk.id + '_qty'}
              onClick={function() { if (perkNumpad === pk.id + '_qty') { setPerkNumpad(null); } else { setPerkNumpad(pk.id + '_qty'); setPerkNumStr(String(pk.quantity_per_cycle || '')); } }} />
            <span style={{ fontSize: 11, color: T.textSecondary }}>×</span>
            {selectedSvc ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{selectedSvc.name}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>({dollars(selectedSvc.price_cents)})</span>
                <div onClick={function() { setSvcPickerPerkId(pk.id); setSvcPickerCat(_catList.length > 0 ? _catList[0].id : null); }}
                  style={{ fontSize: 11, color: T.blueLight, cursor: 'pointer', textDecoration: 'underline' }}>Change</div>
              </div>
            ) : (
              <div onClick={function() { setSvcPickerPerkId(pk.id); setSvcPickerCat(_catList.length > 0 ? _catList[0].id : null); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #22C55E', background: 'rgba(34,197,94,0.1)', color: '#4ADE80', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
              >+ Select Service</div>
            )}
          </div>
          {perkNumpad === pk.id + '_qty' && (
            <div style={{ marginTop: 8 }}>
              <Numpad label={null} onKey={function(k) { handleNumKey(k, setPerkNumStr); }}
                onDone={function() { updatePerk(pk.id, 'quantity_per_cycle', parseInt(perkNumStr, 10) || 1); setPerkNumpad(null); }} />
            </div>
          )}
        </div>
      );
    }

    if (pk.type === 'service_credit') {
      return (
        <div key={pk.id} style={{ backgroundColor: T.grid, borderRadius: 6, padding: '10px 14px', marginBottom: 6, border: '1px solid ' + T.border }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#93C5FD' }}>Service credit</span>
            <div onClick={function() { removePerk(pk.id); }} style={{ fontSize: 11, color: T.danger, cursor: 'pointer' }}>Remove</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PriceField cents={perkNumpad === pk.id + '_credit' ? (parseInt(perkNumStr, 10) || 0) : (pk.credit_amount_cents || 0)} active={perkNumpad === pk.id + '_credit'}
              onClick={function() { if (perkNumpad === pk.id + '_credit') { setPerkNumpad(null); } else { setPerkNumpad(pk.id + '_credit'); setPerkNumStr(String(pk.credit_amount_cents || '')); } }} />
            <span style={{ fontSize: 11, color: T.textSecondary }}>per cycle</span>
          </div>
          {perkNumpad === pk.id + '_credit' && (
            <div style={{ marginTop: 8 }}>
              <Numpad label={null} onKey={function(k) { handleNumKey(k, setPerkNumStr); }}
                onDone={function() { updatePerk(pk.id, 'credit_amount_cents', parseInt(perkNumStr, 10) || 0); setPerkNumpad(null); }} />
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  // ── EDITOR RENDER ──
  return (
    <div style={{position:'relative'}}>
      <AreaTag id="MB-PLAN" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div onClick={handleBack}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.borderColor = T.textMuted; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
        >← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{ep._isNew ? 'New plan' : 'Edit plan'}</span>
        <div style={{ flex: 1 }} />
        {!ep._isNew && (
          <div onClick={deletePlan}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#2A2030'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.danger, backgroundColor: T.chrome, color: T.danger, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
          >Delete plan</div>
        )}
        {checkHasChanges() && <span style={{ fontSize: 11, color: T.warning, fontWeight: 500 }}>Unsaved changes</span>}
        <div onClick={savePlan}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = checkHasChanges() ? '#15803D' : '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = checkHasChanges() ? T.success : T.primary; }}
          style={{ padding: checkHasChanges() ? '8px 24px' : '6px 18px', borderRadius: 6, backgroundColor: checkHasChanges() ? T.success : T.primary, color: '#fff', fontSize: checkHasChanges() ? 14 : 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: checkHasChanges() ? '0 0 12px rgba(34,197,94,0.4)' : 'none' }}
        >{checkHasChanges() ? '💾 Save plan' : 'Save plan'}</div>
      </div>

      {/* Unsaved changes popup */}
      {showUnsavedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: T.surface, border: '1px solid ' + T.border, borderRadius: 12, padding: 24, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 12 }}>Unsaved changes</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 20, lineHeight: '1.5' }}>You have unsaved changes to this plan. Would you like to save before leaving?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={discardEdits}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3E4C5E'; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid ' + T.danger, backgroundColor: T.chrome, color: T.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
              >Discard</div>
              <div onClick={function() { setShowUnsavedPopup(false); }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3E4C5E'; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
              >Keep editing</div>
              <div onClick={function() { setShowUnsavedPopup(false); savePlan(); }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#15803D'; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.success; }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: 'none', backgroundColor: T.success, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
              >Save</div>
            </div>
          </div>
        </div>
      )}

      {/* Three-column layout: basics | perks | rules */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* ═══ LEFT: Plan basics + Billing ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Plan basics */}
          <Card>
            <StackedRow label="Plan name">
              <textarea value={ep.name} onChange={function(e) { updateEditField('name', e.target.value); }} rows={1} placeholder="e.g. Silver Membership"
                style={{ width: '100%', height: 34, backgroundColor: T.grid, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', color: T.text, fontSize: 13, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </StackedRow>
            <StackedRow label="Description" desc="Client-facing, shown during signup">
              <textarea value={ep.description || ''} onChange={function(e) { updateEditField('description', e.target.value); }} rows={2} placeholder="Describe the plan and its perks..."
                style={{ width: '100%', height: 50, backgroundColor: T.grid, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', color: T.text, fontSize: 12, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </StackedRow>
            <Row label="Active" desc="Available for new signups">
              <Toggle value={ep.active} onChange={function(v) { updateEditField('active', v); }} />
            </Row>
          </Card>

          {/* Billing */}
          <Card>
            <StackedRow label="Billing cycle">
              <BtnGroup value={ep.billing_cycle_days === 30 ? '30' : ep.billing_cycle_days === 90 ? '90' : ep.billing_cycle_days === 365 ? '365' : 'custom'}
                onChange={function(v) { if (v === 'custom') { openNumpad('cycle_days', ep.billing_cycle_days); updateEditField('billing_cycle_days', ep.billing_cycle_days); } else { updateEditField('billing_cycle_days', parseInt(v, 10)); setActiveNumpad(null); } }}
                options={[{ key: '30', label: 'Monthly' }, { key: '90', label: 'Quarterly' }, { key: '365', label: 'Annual' }, { key: 'custom', label: 'Custom' }]}
              />
            </StackedRow>
            {activeNumpad === 'cycle_days' && (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>Custom interval:</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{numStr || '0'} days</span>
                </div>
                <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                  onDone={function() { closeNumpad('cycle_days', function(v) { updateEditField('billing_cycle_days', v || 30); }); }} />
              </div>
            )}
            <Row label="Price per cycle">
              <PriceField cents={activeNumpad === 'price' ? (parseInt(numStr, 10) || 0) : ep.price_cents} active={activeNumpad === 'price'}
                onClick={function() { if (activeNumpad === 'price') { setActiveNumpad(null); } else { openNumpad('price', ep.price_cents); } }} />
            </Row>
            {activeNumpad === 'price' && (
              <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
                <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                  onDone={function() { closeNumpad('price', function(v) { updateEditField('price_cents', v); }); }} />
              </div>
            )}
            <StackedRow label="Payment method" desc="How members pay">
              <BtnGroup value={ep.payment_method} onChange={function(v) { updateEditField('payment_method', v); }}
                options={[{ key: 'in_person', label: 'Pay each cycle' }, { key: 'upfront', label: 'Pay upfront' }]}
              />
            </StackedRow>
          </Card>

        </div>

        {/* ═══ MIDDLE: Perks list + add buttons ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>Perks</div>
            {planPerks.length === 0 && <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>No perks added yet.</div>}
            {planPerks.map(renderPerkEditor)}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { type: 'percentage_discount', label: '+ % Discount', color: '#A78BFA' },
                { type: 'free_service', label: '+ Free service', color: '#22C55E' },
                { type: 'service_credit', label: '+ Service credit', color: T.blueLight },
              ].map(function(btn) {
                return (
                  <div key={btn.type} onClick={function() { addPerk(btn.type); }}
                    onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3E4C5E'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: btn.color, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
                  >
        {btn.label}</div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ═══ RIGHT: Perk behavior + Cancellation + Missed + Freeze ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Perk behavior */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Perk behavior</div>
            <Row label="Application mode" desc="Auto = system applies perks at checkout. Manual = staff chooses.">
              <BtnGroup value={ep.perk_apply_mode} onChange={function(v) { updateEditField('perk_apply_mode', v); }}
                options={[{ key: 'auto', label: 'Auto-apply' }, { key: 'manual', label: 'Manual' }]}
              />
            </Row>
            <Row label="Credit rollover" desc="Unused credits and free services carry over to next cycle">
              <Toggle value={ep.credit_rollover} onChange={function(v) { updateEditField('credit_rollover', v); }} />
            </Row>
          </Card>

          {/* Cancellation */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Cancellation rules</div>
            <Row label="Minimum commitment" desc="Billing cycles before cancellation allowed. Leave 0 for no minimum.">
              <NumField value={activeNumpad === 'min_commit' ? (parseInt(numStr, 10) || 0) : (ep.min_commitment_cycles || 0)} suffix=" cycles" active={activeNumpad === 'min_commit'}
                onClick={function() { if (activeNumpad === 'min_commit') { setActiveNumpad(null); } else { openNumpad('min_commit', ep.min_commitment_cycles || 0); } }} />
            </Row>
            {activeNumpad === 'min_commit' && (
              <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
                <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                  onDone={function() { closeNumpad('min_commit', function(v) { updateEditField('min_commitment_cycles', v || null); }); }} />
              </div>
            )}
            <Row label="Notice period" desc="Days of advance notice required. Leave 0 for none.">
              <NumField value={activeNumpad === 'notice' ? (parseInt(numStr, 10) || 0) : (ep.notice_period_days || 0)} suffix=" days" active={activeNumpad === 'notice'}
                onClick={function() { if (activeNumpad === 'notice') { setActiveNumpad(null); } else { openNumpad('notice', ep.notice_period_days || 0); } }} />
            </Row>
            {activeNumpad === 'notice' && (
              <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
                <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                  onDone={function() { closeNumpad('notice', function(v) { updateEditField('notice_period_days', v || null); }); }} />
              </div>
            )}
          </Card>

          {/* Missed payment */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Missed payment</div>
            <Row label="Action when payment is missed">
              <BtnGroup value={ep.missed_payment_action} onChange={function(v) { updateEditField('missed_payment_action', v); }}
                options={[{ key: 'pause', label: 'Pause' }, { key: 'cancel', label: 'Cancel' }, { key: 'grace_period', label: 'Grace' }]}
              />
            </Row>
            {ep.missed_payment_action === 'cancel' && (
              <>
                <Row label="Cancel after" desc="Missed payments before auto-cancel">
                  <NumField value={activeNumpad === 'missed_thresh' ? (parseInt(numStr, 10) || 0) : (ep.missed_payment_threshold || 0)} suffix=" missed" active={activeNumpad === 'missed_thresh'}
                    onClick={function() { if (activeNumpad === 'missed_thresh') { setActiveNumpad(null); } else { openNumpad('missed_thresh', ep.missed_payment_threshold || 0); } }} />
                </Row>
                {activeNumpad === 'missed_thresh' && (
                  <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                      onDone={function() { closeNumpad('missed_thresh', function(v) { updateEditField('missed_payment_threshold', v || 1); }); }} />
                  </div>
                )}
              </>
            )}
            {ep.missed_payment_action === 'grace_period' && (
              <>
                <Row label="Grace period" desc="Days past due before fallback action">
                  <NumField value={activeNumpad === 'grace_days' ? (parseInt(numStr, 10) || 0) : (ep.missed_payment_threshold || 0)} suffix=" days" active={activeNumpad === 'grace_days'}
                    onClick={function() { if (activeNumpad === 'grace_days') { setActiveNumpad(null); } else { openNumpad('grace_days', ep.missed_payment_threshold || 0); } }} />
                </Row>
                {activeNumpad === 'grace_days' && (
                  <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <Numpad label={null} onKey={function(k) { handleNumKey(k, setNumStr); }}
                      onDone={function() { closeNumpad('grace_days', function(v) { updateEditField('missed_payment_threshold', v || 7); }); }} />
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Freeze */}
          <Card>
            <Row label="Allow freeze" desc="Members can temporarily pause without cancelling">
              <Toggle value={ep.freeze_allowed} onChange={function(v) { updateEditField('freeze_allowed', v); }} />
            </Row>
          </Card>

        </div>
      </div>

      {/* ── Full-screen Service Picker for Free Service Perk ── */}
      {svcPickerPerkId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1010, background: T.bg || '#0F172A', fontFamily: "'Inter',system-ui,sans-serif", display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 52, background: T.chromeDark || '#162032', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, borderBottom: '1px solid ' + T.borderLight, flexShrink: 0 }}>
            <div onClick={function() { setSvcPickerPerkId(null); }}
              style={{ height: 34, padding: '0 14px', background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
            >Cancel</div>
            <span style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Select Free Service</span>
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 12, gap: 12 }}>
            <div style={{ width: 200, minWidth: 200, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome, flexShrink: 0 }}>
              <CategoryGrid categories={_catList} activeCat={svcPickerCat} onSelect={function(id) { setSvcPickerCat(id); }} catSlots={cl.catSlots || {}} catColumns={cl.catColumns || 2} layout="grid" mode="view" />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 14, border: '1px solid ' + T.border, borderRadius: 8, background: T.chrome }}>
              <ServiceGrid services={_svcList} activeCat={svcPickerCat} svcSlots={cl.svcSlots || {}} svcColumns={cl.svcColumns || 4} svcRows={cl.svcRows || 3} mode="tap"
                onTap={function(svc) {
                  updatePerk(svcPickerPerkId, 'service_catalog_id', svc.id);
                  setSvcPickerPerkId(null);
                }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
