import { useTheme } from '../../lib/ThemeContext';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import PayeeDetailPopup from './PayeeDetailPopup';
import { printBillChecks, printAllSummary } from './billPayPrintUtils';
import { fmt } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';

/**
 * BillPayModule — Owner Dashboard section
 *
 * Three tabs:
 *   1. Bill Templates — recurring bills (rent, electric, etc.)
 *   2. Write Checks — select bills, fill amounts, print
 *   3. Check History — all checks printed (payroll + bill pay)
 *
 * Uses same check stock + check number sequence as payroll.
 * Keyboard + numpad input for amounts.
 * Print functions extracted to billPayPrintUtils.js (Session 33 split).
 */

var CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Insurance', 'Equipment', 'Advertising', 'Other'];

// ═══════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════
var INITIAL_TEMPLATES = [
  { id: 'bt1', payee: 'Palm Beach Realty LLC', category: 'Rent', amount_cents: 200000, memo: 'Monthly salon rent' },
  { id: 'bt2', payee: 'FPL Electric', category: 'Utilities', amount_cents: 0, memo: 'Electric bill' },
  { id: 'bt3', payee: 'Beauty Wholesale Inc', category: 'Supplies', amount_cents: 0, memo: 'Monthly product order' },
  { id: 'bt4', payee: 'State Farm Insurance', category: 'Insurance', amount_cents: 45000, memo: 'Business insurance' },
];

var INITIAL_HISTORY = [
  { id: 'ch1', check_number: 1001, date: '2026-03-06', payee: 'Maria Gonzalez', category: 'Payroll', amount_cents: 203280, type: 'payroll' },
  { id: 'ch2', check_number: 1002, date: '2026-03-06', payee: 'Ashley Williams', category: 'Payroll', amount_cents: 178880, type: 'payroll' },
  { id: 'ch3', check_number: 1003, date: '2026-03-06', payee: 'James Chen', category: 'Payroll', amount_cents: 126050, type: 'payroll' },
  { id: 'ch4', check_number: 1004, date: '2026-03-06', payee: 'Nicole Johnson', category: 'Payroll', amount_cents: 122185, type: 'payroll' },
  { id: 'ch5', check_number: 1005, date: '2026-03-06', payee: 'David Park', category: 'Payroll', amount_cents: 37040, type: 'payroll' },
  { id: 'ch6', check_number: 1006, date: '2026-03-01', payee: 'Palm Beach Realty LLC', category: 'Rent', amount_cents: 200000, type: 'billpay' },
  { id: 'ch7', check_number: 1007, date: '2026-03-01', payee: 'State Farm Insurance', category: 'Insurance', amount_cents: 45000, type: 'billpay' },
  { id: 'ch8', check_number: 1008, date: '2026-02-28', payee: 'FPL Electric', category: 'Utilities', amount_cents: 31200, type: 'billpay' },
];

function fmtDate(d) { var p = d.split('-'); return p[1] + '/' + p[2] + '/' + p[0]; }
var nextId = 100;
function genId() { return 'bt' + (++nextId); }

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function BillPayModule({ initTab, onInitTabConsumed }) {
  var T = useTheme();
  var MOCK_SALON_SETTINGS = useSettingsStore(function(s) { return s.settings; });
  var [tab, setTab] = useState(initTab === 'history-payroll' ? 'history' : 'write');   // 'templates' | 'write' | 'history'
  var [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  var [history, setHistory] = useState(INITIAL_HISTORY);

  // Template editor state
  var [editingTemplate, setEditingTemplate] = useState(null); // null | template obj | 'new'
  var [editPayee, setEditPayee] = useState('');
  var [editCategory, setEditCategory] = useState('Rent');
  var [editAmountStr, setEditAmountStr] = useState('');
  var [editMemo, setEditMemo] = useState('');

  // Write checks state
  var [writeAmounts, setWriteAmounts] = useState({});   // { templateId: 'raw digits' }
  var [writeSelections, setWriteSelections] = useState({});  // { id: true }
  var [activeWriteId, setActiveWriteId] = useState(null);
  var [oneTimeChecks, setOneTimeChecks] = useState([]);  // [{ id, payee, category, memo, amount_str }]
  var [showOneTimeForm, setShowOneTimeForm] = useState(false);
  var [otPayee, setOtPayee] = useState('');
  var [otCategory, setOtCategory] = useState('Other');
  var [otMemo, setOtMemo] = useState('');
  var [otAmountStr, setOtAmountStr] = useState('');

  // History filter
  var [historyFilter, setHistoryFilter] = useState(initTab === 'history-payroll' ? 'payroll' : 'all'); // 'all' | 'payroll' | 'billpay'
  var [historyDateFrom, setHistoryDateFrom] = useState(new Date().getFullYear() + '-01-01');
  var [historyDateTo, setHistoryDateTo] = useState(new Date().toISOString().slice(0, 10));
  var [expandedPayee, setExpandedPayee] = useState(null); // payee name string when drilled in

  // Consume the initTab after first render so it doesn't stick on re-renders
  useEffect(function() {
    if (initTab && onInitTabConsumed) onInitTabConsumed();
  }, []);

  // Keyboard listener for write checks numpad
  useEffect(function() {
    if (!activeWriteId || tab !== 'write') return;
    function handleKey(e) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        updateWriteAmount(activeWriteId, function(cur) { return cur + e.key; });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        updateWriteAmount(activeWriteId, function(cur) { return cur.slice(0, -1); });
      } else if (e.key === 'Delete') {
        e.preventDefault();
        updateWriteAmount(activeWriteId, function() { return ''; });
      } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        setActiveWriteId(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return function() { window.removeEventListener('keydown', handleKey); };
  }, [activeWriteId, tab]);

  function updateWriteAmount(id, fn) {
    // Check if it's a one-time check
    var isOt = id.startsWith('ot_');
    if (isOt) {
      setOneTimeChecks(function(prev) {
        return prev.map(function(ot) {
          if (ot.id === id) return Object.assign({}, ot, { amount_str: fn(ot.amount_str || '') });
          return ot;
        });
      });
    } else {
      setWriteAmounts(function(prev) {
        var copy = Object.assign({}, prev);
        copy[id] = fn(copy[id] || '');
        return copy;
      });
    }
  }

  // Initialize write amounts from fixed templates
  function initWriteAmounts() {
    var wa = {};
    templates.forEach(function(t) {
      if (t.amount_cents > 0) wa[t.id] = String(t.amount_cents);
    });
    setWriteAmounts(wa);
    setWriteSelections({});
    setActiveWriteId(null);
  }

  // ─── Shared numpad ───
  function renderNumpad(targetId) {
    var KEYS = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
    return (
      <div style={{ flexShrink: 0, width: 170, background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {KEYS.map(function(key) {
            var isAction = key === '⌫' || key === 'C';
            return (
              <div key={key} onClick={function() {
                  if (key === 'C') updateWriteAmount(targetId, function() { return ''; });
                  else if (key === '⌫') updateWriteAmount(targetId, function(c) { return c.slice(0, -1); });
                  else updateWriteAmount(targetId, function(c) { return c + key; });
                }}
                style={{
                  height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: T.grid, border: '1px solid ' + T.border,
                  color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text),
                  fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none', transition: 'background-color 150ms',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
              >{key}</div>
            );
          })}
        </div>
        <div onClick={function() { setActiveWriteId(null); }}
          style={{ width: '100%', height: 32, marginTop: 5, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
        >Done</div>
      </div>
    );
  }

  // ─── Tab button softcolor style ───
  var TAB_COLORS = {
    write:     { bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
    templates: { bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' },
    history:   { bg:'#3D2608', text:'#FBB040', border:'#5C3A10' },
  };
  function tabStyle(id) {
    var active = tab === id;
    var sc = TAB_COLORS[id] || TAB_COLORS.write;
    return {
      padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: active ? 600 : 500, cursor: 'pointer',
      background: sc.bg, color: sc.text,
      border: (active ? '2px' : '1px') + ' solid ' + sc.border, transition: 'background 150ms',
    };
  }

  // ═══════════════════════════════════════
  // TEMPLATES TAB
  // ═══════════════════════════════════════
  function renderTemplates() {
    function openEdit(t) {
      setEditingTemplate(t);
      setEditPayee(t.payee);
      setEditCategory(t.category);
      setEditAmountStr(t.amount_cents > 0 ? String(t.amount_cents) : '');
      setEditMemo(t.memo || '');
    }
    function openNew() {
      setEditingTemplate('new');
      setEditPayee('');
      setEditCategory('Rent');
      setEditAmountStr('');
      setEditMemo('');
    }
    function saveTemplate() {
      var cents = parseInt(editAmountStr, 10) || 0;
      if (!editPayee.trim()) return;
      if (editingTemplate === 'new') {
        setTemplates(function(prev) { return prev.concat([{ id: genId(), payee: editPayee.trim(), category: editCategory, amount_cents: cents, memo: editMemo.trim() }]); });
      } else {
        setTemplates(function(prev) {
          return prev.map(function(t) {
            if (t.id === editingTemplate.id) return Object.assign({}, t, { payee: editPayee.trim(), category: editCategory, amount_cents: cents, memo: editMemo.trim() });
            return t;
          });
        });
      }
      setEditingTemplate(null);
    }
    function deleteTemplate(id) {
      setTemplates(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
      setEditingTemplate(null);
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Recurring Bill Templates</div>
          <div onClick={openNew}
            style={{ padding: '8px 16px', background: T.primary, color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          >+ New Bill</div>
        </div>

        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontSize: 14 }}>No bill templates yet. Click "+ New Bill" to create one.</div>
        )}

        {templates.map(function(t) {
          return (
            <div key={t.id} onClick={function() { openEdit(t); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 6,
                background: T.grid, borderRadius: 8, cursor: 'pointer', transition: 'background 150ms',
                border: '1px solid ' + T.borderLight,
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{t.payee}</div>
                <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{t.category}{t.memo ? ' — ' + t.memo : ''}</div>
              </div>
              <div style={{ color: t.amount_cents > 0 ? T.success : T.warning, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {t.amount_cents > 0 ? fmt(t.amount_cents) : 'Variable'}
              </div>
            </div>
          );
        })}

        {/* Edit / New template modal */}
        {editingTemplate && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={function() { setEditingTemplate(null); }} />
            <div onClick={function(e) { e.stopPropagation(); }}
              style={{ position: 'relative', background: T.surface, borderRadius: 16, padding: 28, border: '1px solid ' + T.borderLight, minWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 20 }}>
                {editingTemplate === 'new' ? 'New Bill Template' : 'Edit Bill Template'}
              </div>

              {/* Payee */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Payee Name</div>
                <input value={editPayee} onChange={function(e) { setEditPayee(e.target.value); }} placeholder="e.g. FPL Electric"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit' }} />
              </div>

              {/* Category */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Category</div>
                <select value={editCategory} onChange={function(e) { setEditCategory(e.target.value); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {CATEGORIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
                </select>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Fixed Amount (leave blank for variable)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>$</span>
                  <input value={editAmountStr ? (parseInt(editAmountStr, 10) / 100).toFixed(2) : ''} readOnly
                    placeholder="Variable"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit' }} />
                </div>
                {/* Inline numpad for amount */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 200, background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(key) {
                        var isAction = key === '⌫' || key === 'C';
                        return (
                          <div key={key} onClick={function() {
                              if (key === 'C') setEditAmountStr('');
                              else if (key === '⌫') setEditAmountStr(function(p) { return p.slice(0, -1); });
                              else setEditAmountStr(function(p) { return p + key; });
                            }}
                            style={{
                              height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: T.grid, border: '1px solid ' + T.border,
                              color: key === '⌫' ? T.danger : (key === 'C' ? T.warning : T.text),
                              fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none', transition: 'background-color 150ms',
                            }}
                            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
                            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
                          >{key}</div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Memo */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Memo</div>
                <input value={editMemo} onChange={function(e) { setEditMemo(e.target.value); }} placeholder="e.g. Monthly rent payment"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit' }} />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {editingTemplate !== 'new' && (
                  <div onClick={function() { deleteTemplate(editingTemplate.id); }}
                    style={{ padding: '10px 20px', background: T.grid, color: T.danger, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 'auto', border: '1px solid ' + T.borderLight }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                  >Delete</div>
                )}
                <div onClick={function() { setEditingTemplate(null); }}
                  style={{ padding: '10px 20px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >Cancel</div>
                <div onClick={saveTemplate}
                  style={{ padding: '10px 20px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: editPayee.trim() ? 1 : 0.5 }}
                  onMouseEnter={function(e) { if (editPayee.trim()) e.currentTarget.style.background = '#1D4FD7'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
                >Save</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // WRITE CHECKS TAB
  // ═══════════════════════════════════════
  function renderWriteChecks() {
    // Build combined list: templates + one-time checks
    var allItems = templates.map(function(t) {
      var raw = writeAmounts[t.id] || '';
      return { id: t.id, payee: t.payee, category: t.category, memo: t.memo, raw: raw, fixed: t.amount_cents > 0 };
    }).concat(oneTimeChecks.map(function(ot) {
      return { id: ot.id, payee: ot.payee, category: ot.category, memo: ot.memo, raw: ot.amount_str || '', fixed: false };
    }));

    var selectedItems = allItems.filter(function(it) { return writeSelections[it.id]; });
    var selectedTotal = selectedItems.reduce(function(sum, it) { return sum + (parseInt(it.raw, 10) || 0); }, 0);
    var selectedCount = selectedItems.length;

    function handlePrint() {
      if (selectedCount === 0) return;
      var checks = selectedItems.filter(function(it) { return (parseInt(it.raw, 10) || 0) > 0; }).map(function(it) {
        return { payee: it.payee, category: it.category, memo: it.memo, amount_cents: parseInt(it.raw, 10) || 0 };
      });
      if (checks.length === 0) return;

      printBillChecks(checks, MOCK_SALON_SETTINGS);

      // Log to history
      var checkNum = MOCK_SALON_SETTINGS.check_next_number || 1001;
      var today = new Date().toISOString().slice(0, 10);
      var newEntries = checks.map(function(ck, i) {
        return { id: 'ch_' + Date.now() + '_' + i, check_number: checkNum + i, date: today, payee: ck.payee, category: ck.category, amount_cents: ck.amount_cents, type: 'billpay' };
      });
      setHistory(function(prev) { return newEntries.concat(prev); });

      // Clear selections and one-time checks
      setWriteSelections({});
      setOneTimeChecks([]);
      setActiveWriteId(null);
    }

    function addOneTime() {
      if (!otPayee.trim()) return;
      var ot = { id: 'ot_' + Date.now(), payee: otPayee.trim(), category: otCategory, memo: otMemo.trim(), amount_str: otAmountStr };
      setOneTimeChecks(function(prev) { return prev.concat([ot]); });
      setShowOneTimeForm(false);
      setOtPayee(''); setOtCategory('Other'); setOtMemo(''); setOtAmountStr('');
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Write Checks</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={initWriteAmounts}
              style={{ padding: '8px 14px', background: T.grid, color: T.text, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >Load Bills</div>
            <div onClick={function() { setShowOneTimeForm(true); }}
              style={{ padding: '8px 14px', background: T.primary, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
            >+ One-Time Check</div>
          </div>
        </div>

        {allItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontSize: 14 }}>Click "Load Bills" to pull in your templates, or "+ One-Time Check" for a quick check.</div>
        )}

        <div style={{ maxHeight: 440, overflow: 'auto', marginBottom: 16 }}>
          {allItems.map(function(it) {
            var isActive = activeWriteId === it.id;
            var isSelected = !!writeSelections[it.id];
            var displayAmt = it.raw ? '$' + (parseInt(it.raw, 10) / 100).toFixed(2) : '';

            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                {/* Checkbox */}
                <div onClick={function() {
                    setWriteSelections(function(prev) { var c = Object.assign({}, prev); c[it.id] = !isSelected; return c; });
                  }}
                  style={{
                    width: 24, height: 24, borderRadius: 4, flexShrink: 0, marginTop: 12, cursor: 'pointer',
                    border: isSelected ? '2px solid ' + T.primary : '2px solid ' + T.borderLight,
                    background: isSelected ? T.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700,
                  }}
                >{isSelected ? '✓' : ''}</div>

                {/* Info */}
                <div style={{ flex: 1, padding: '10px 14px', background: T.grid, borderRadius: 8, border: '1px solid ' + T.borderLight }}>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{it.payee}</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{it.category}{it.memo ? ' — ' + it.memo : ''}</div>
                </div>

                {/* Amount field */}
                <div onClick={function() { setActiveWriteId(isActive ? null : it.id); }}
                  style={{
                    width: 130, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? T.blueTint : T.raised, cursor: 'pointer',
                    border: isActive ? '2px solid ' + T.primary : '1px solid ' + T.borderLight,
                    fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    color: displayAmt ? T.success : T.textMuted,
                  }}
                >{displayAmt || (isActive ? '$0.00' : '—')}</div>

                {/* Numpad */}
                {isActive && renderNumpad(it.id)}
              </div>
            );
          })}
        </div>

        {/* Summary + Print */}
        {allItems.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid ' + T.borderLight, marginBottom: 16 }}>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{selectedCount} check{selectedCount !== 1 ? 's' : ''} selected</span>
              <span style={{ color: T.success, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(selectedTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div onClick={handlePrint}
                style={{ padding: '12px 28px', background: selectedCount > 0 ? T.primary : T.grid, color: selectedCount > 0 ? '#fff' : T.text, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: selectedCount > 0 ? 1 : 0.5 }}
                onMouseEnter={function(e) { if (selectedCount > 0) e.currentTarget.style.background = '#1D4FD7'; }}
                onMouseLeave={function(e) { if (selectedCount > 0) e.currentTarget.style.background = T.primary; }}
              >🖨️ Print {selectedCount} Check{selectedCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {/* One-Time Check Form Modal */}
        {showOneTimeForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={function() { setShowOneTimeForm(false); }} />
            <div onClick={function(e) { e.stopPropagation(); }}
              style={{ position: 'relative', background: T.surface, borderRadius: 16, padding: 28, border: '1px solid ' + T.borderLight, minWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 20 }}>One-Time Check</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Payee Name</div>
                <input value={otPayee} onChange={function(e) { setOtPayee(e.target.value); }} placeholder="Who is this check for?"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Category</div>
                <select value={otCategory} onChange={function(e) { setOtCategory(e.target.value); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {CATEGORIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Memo (optional)</div>
                <input value={otMemo} onChange={function(e) { setOtMemo(e.target.value); }} placeholder="e.g. Plumber repair"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 14, fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <div onClick={function() { setShowOneTimeForm(false); }}
                  style={{ padding: '10px 20px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
                >Cancel</div>
                <div onClick={addOneTime}
                  style={{ padding: '10px 20px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: otPayee.trim() ? 1 : 0.5 }}
                >Add Check</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // CHECK HISTORY TAB
  // ═══════════════════════════════════════
  function renderHistory() {
    var filtered = history;
    if (historyFilter === 'payroll') filtered = filtered.filter(function(h) { return h.type === 'payroll'; });
    if (historyFilter === 'billpay') filtered = filtered.filter(function(h) { return h.type === 'billpay'; });
    if (historyDateFrom) filtered = filtered.filter(function(h) { return h.date >= historyDateFrom; });
    if (historyDateTo) filtered = filtered.filter(function(h) { return h.date <= historyDateTo; });

    var total = filtered.reduce(function(sum, h) { return sum + h.amount_cents; }, 0);

    function filterBtn(id, label) {
      var active = historyFilter === id;
      return (
        <div key={id} onClick={function() { setHistoryFilter(id); }}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: active ? T.primary : T.grid, color: active ? '#fff' : T.text,
            border: active ? 'none' : '1px solid ' + T.borderLight,
          }}
          onMouseEnter={function(e) { if (!active) e.currentTarget.style.background = T.gridHover; }}
          onMouseLeave={function(e) { if (!active) e.currentTarget.style.background = active ? T.primary : T.grid; }}
        >{label}</div>
      );
    }

    var dateInputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', colorScheme: 'dark' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top row: title + type filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Check History</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {filterBtn('all', 'All')}
            {filterBtn('payroll', 'Payroll')}
            {filterBtn('billpay', 'Bill Pay')}
          </div>
        </div>

        {/* Date range row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>From</span>
          <input type="date" value={historyDateFrom} onChange={function(e) { setHistoryDateFrom(e.target.value); }} style={dateInputStyle} />
          <span style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>To</span>
          <input type="date" value={historyDateTo} onChange={function(e) { setHistoryDateTo(e.target.value); }} style={dateInputStyle} />
          {(historyDateFrom || historyDateTo) && (
            <div onClick={function() { setHistoryDateFrom(''); setHistoryDateTo(''); }}
              style={{ padding: '6px 12px', borderRadius: 6, background: T.grid, color: T.danger, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >Clear</div>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ color: T.textMuted, fontSize: 12 }}>{filtered.length} check{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', marginBottom: 4, fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
          <div style={{ width: 70 }}>Check #</div>
          <div style={{ width: 90 }}>Date</div>
          <div style={{ flex: 1 }}>Payee</div>
          <div style={{ width: 100 }}>Category</div>
          <div style={{ width: 100, textAlign: 'right' }}>Amount</div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontSize: 14 }}>No checks found.</div>
          )}
          {filtered.map(function(h) {
            var isPayroll = h.type === 'payroll';
            return (
              <div key={h.id}
                onClick={isPayroll ? function() { setExpandedPayee(h.payee); } : undefined}
                style={{
                  display: 'flex', alignItems: 'center', padding: '10px 14px', marginBottom: 3,
                  background: T.grid, borderRadius: 6, border: '1px solid ' + T.borderLight,
                  cursor: isPayroll ? 'pointer' : 'default', transition: 'background 150ms',
                }}
                onMouseEnter={isPayroll ? function(e) { e.currentTarget.style.background = T.gridHover; } : undefined}
                onMouseLeave={isPayroll ? function(e) { e.currentTarget.style.background = T.grid; } : undefined}
              >
                <div style={{ width: 70, color: T.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>#{h.check_number}</div>
                <div style={{ width: 90, color: T.text, fontSize: 13 }}>{fmtDate(h.date)}</div>
                <div style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: 500 }}>{h.payee}{isPayroll ? ' ›' : ''}</div>
                <div style={{ width: 100 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: h.type === 'payroll' ? T.blueTint : (h.category === 'Rent' ? '#7C3AED20' : T.grid),
                    color: h.type === 'payroll' ? T.primary : (h.category === 'Rent' ? '#A78BFA' : T.text),
                  }}>{h.category}</span>
                </div>
                <div style={{ width: 100, textAlign: 'right', color: T.text, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(h.amount_cents)}</div>
              </div>
            );
          })}
        </div>

        {/* Total + Print All */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 14px 0', borderTop: '1px solid ' + T.borderLight, marginTop: 12, flexShrink: 0 }}>
          <div style={{ width: 120 }} />
          <div onClick={function() { printAllSummary(filtered); }}
            style={{ padding: '8px 20px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >🖨️ Print All Summary</div>
          <div style={{ width: 120, textAlign: 'right', fontSize: 14, fontWeight: 600, color: T.text }}>Total: <span style={{ color: T.success, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span></div>
        </div>

        {/* ─── Payee Detail Popup ─── */}
        {expandedPayee && (
          <PayeeDetailPopup
            payee={expandedPayee}
            history={history}
            dateFrom={historyDateFrom}
            dateTo={historyDateTo}
            onClose={function() { setExpandedPayee(null); }}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════
  return (
    <div style={{position:'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 24px' }}>
        <AreaTag id="BILLPAY" />
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <div onClick={function() { setTab('write'); }} style={tabStyle('write')}>Write Checks</div>
        <div onClick={function() { setTab('templates'); }} style={tabStyle('templates')}>Bill Templates</div>
        <div onClick={function() { setTab('history'); }} style={tabStyle('history')}>Check History</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: tab === 'history' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'templates' && renderTemplates()}
        {tab === 'write' && renderWriteChecks()}
        {tab === 'history' && renderHistory()}
      </div>
    </div>
  );
}
