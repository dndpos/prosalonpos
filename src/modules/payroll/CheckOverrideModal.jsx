import { useTheme } from '../../lib/ThemeContext';
import { useState, useEffect } from 'react';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { printChecks } from '../../lib/checkUtils';
import { fmt } from '../../lib/formatUtils';

/**
 * CheckOverrideModal — Two-step flow before printing checks:
 *   1. "Ask" step: Do you need to change any check amounts?
 *   2. "Override" step: List of selected techs with calculated amounts + numpad override
 *
 * Props:
 *   step           - 'ask' | 'override' | null
 *   setStep        - setter for step
 *   paychecks      - array of paycheck objects
 *   checkSelections - { staff_id: true/false }
 *   onClose        - called to close both this and parent confirm modal
 *   periodStart    - string
 *   periodEnd      - string
 *   periodLabel    - string (formatted period label)
 *   payTypeDisplay - function(staffRec) => string
 */


export default function CheckOverrideModal({ step, setStep, paychecks, checkSelections, onClose, periodStart, periodEnd, periodLabel, payTypeDisplay }) {
  var T = useTheme();
  var MOCK_STAFF = useStaffStore(function(s) { return s.staff; });
  var MOCK_SALON_SETTINGS = useSettingsStore(function(s) { return s.settings; });
  var [overrides, setOverrides] = useState({});         // { staff_id: '1234' raw digits }
  var [activeId, setActiveId] = useState(null);          // staff_id whose numpad is open

  // Keyboard support — owner can type digits, backspace, escape when a field is active
  useEffect(function() {
    if (!activeId || step !== 'override') return;
    function handleKey(e) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setOverrides(function(prev) {
          var copy = Object.assign({}, prev);
          copy[activeId] = (copy[activeId] || '') + e.key;
          return copy;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setOverrides(function(prev) {
          var copy = Object.assign({}, prev);
          copy[activeId] = (copy[activeId] || '').slice(0, -1);
          return copy;
        });
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setOverrides(function(prev) {
          var copy = Object.assign({}, prev);
          copy[activeId] = '';
          return copy;
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveId(null);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        setActiveId(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return function() { window.removeEventListener('keydown', handleKey); };
  }, [activeId, step]);

  var selectedPCs = paychecks.filter(function(pc) { return checkSelections[pc.staff_id]; });

  function doPrint(useOverrides) {
    var adjustedPCs = useOverrides
      ? paychecks.map(function(pc) {
          var ov = overrides[pc.staff_id];
          if (ov && ov.length > 0) {
            return Object.assign({}, pc, { check_amount: parseInt(ov, 10) || 0 });
          }
          return pc;
        })
      : paychecks;

    printChecks({
      paychecks: adjustedPCs,
      selections: checkSelections,
      periodStart: periodStart,
      periodEnd: periodEnd,
      periodLabel: periodLabel,
      staff: MOCK_STAFF,
      salonSettings: MOCK_SALON_SETTINGS,
      payTypeDisplay: payTypeDisplay,
    });
    setStep(null);
    onClose();
  }

  // ─── Ask Step ───
  if (step === 'ask') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{
          position: 'relative', background: T.surface, borderRadius: 16, padding: 32,
          border: '1px solid ' + T.borderLight, minWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 10 }}>Adjust Check Amounts?</div>
          <div style={{ fontSize: 14, color: T.text, marginBottom: 28, lineHeight: 1.5 }}>
            Do you need to change the check amount for anyone before printing?
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <div onClick={function() { setStep(null); onClose(); }}
              style={{ padding: '12px 28px', background: T.grid, color: T.danger, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >Cancel</div>
            <div onClick={function() { doPrint(false); }}
              style={{ padding: '12px 28px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + T.borderLight }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >No, Print Now</div>
            <div onClick={function() { setOverrides({}); setActiveId(null); setStep('override'); }}
              style={{ padding: '12px 28px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
            >Yes, Adjust Amounts</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Override Step ───
  if (step === 'override') {
    var NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

    var finalTotal = selectedPCs.reduce(function(sum, pc) {
      var ov = overrides[pc.staff_id];
      return sum + (ov ? (parseInt(ov, 10) || 0) : pc.check_amount);
    }, 0);
    var overrideCount = Object.keys(overrides).filter(function(id) { return overrides[id] && overrides[id].length > 0; }).length;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
        <div onClick={function(e) { e.stopPropagation(); }}
          style={{
            position: 'relative', background: T.surface, borderRadius: 16, padding: 28,
            border: '1px solid ' + T.borderLight, minWidth: 580, maxWidth: 720,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 6 }}>Adjust Check Amounts</div>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 20 }}>
            Tap the empty field next to a name to enter a new amount. Leave blank to use the calculated amount.
          </div>

          <div style={{ maxHeight: 380, overflow: 'auto', marginBottom: 20 }}>
            {selectedPCs.map(function(pc) {
              var staffRec = MOCK_STAFF.find(function(s) { return s.id === pc.staff_id; });
              var isActive = activeId === pc.staff_id;
              var rawVal = overrides[pc.staff_id] || '';
              var displayOverride = rawVal ? '$' + (parseInt(rawVal, 10) / 100).toFixed(2) : '';

              return (
                <div key={pc.staff_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                  {/* Left: name + calculated amount */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: T.grid, borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{staffRec ? staffRec.legal_name : pc.name}</div>
                    </div>
                    <div style={{ color: T.text, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.check_amount)}</div>
                  </div>

                  {/* Arrow */}
                  <div style={{ color: T.text, fontSize: 16, flexShrink: 0, paddingTop: 12 }}>→</div>

                  {/* Override input field (div-based, kiosk safe) */}
                  <div onClick={function() { setActiveId(isActive ? null : pc.staff_id); }}
                    style={{
                      width: 130, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? T.blueTint : T.raised, cursor: 'pointer',
                      border: isActive ? '2px solid ' + T.primary : '1px solid ' + T.borderLight,
                      fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: displayOverride ? T.success : T.textMuted,
                    }}
                  >
                    {displayOverride || (isActive ? '$0.00' : '—')}
                  </div>

                  {/* Numpad — expands to the right when active */}
                  {isActive && (
                    <div style={{ flexShrink: 0, width: 170, background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {NUMPAD_KEYS.map(function(key) {
                          var isAction = key === '⌫' || key === 'C';
                          return (
                            <div key={key} onClick={function() {
                                setOverrides(function(prev) {
                                  var copy = Object.assign({}, prev);
                                  var cur = copy[pc.staff_id] || '';
                                  if (key === 'C') { copy[pc.staff_id] = ''; }
                                  else if (key === '⌫') { copy[pc.staff_id] = cur.slice(0, -1); }
                                  else if (/\d/.test(key)) { copy[pc.staff_id] = cur + key; }
                                  return copy;
                                });
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
                      <div onClick={function() { setActiveId(null); }}
                        style={{ width: '100%', height: 32, marginTop: 5, borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'background-color 150ms' }}
                        onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
                        onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
                      >Done</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary + buttons */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid ' + T.borderLight, marginBottom: 16 }}>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>
                {selectedPCs.length} check{selectedPCs.length !== 1 ? 's' : ''}
                {overrideCount > 0 ? ' (' + overrideCount + ' adjusted)' : ''}
              </span>
              <span style={{ color: T.success, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(finalTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <div onClick={function() { setStep(null); setActiveId(null); onClose(); }}
                style={{ padding: '12px 28px', background: T.grid, color: T.danger, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginRight: 'auto', border: '1px solid ' + T.borderLight }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
              >Cancel</div>
              <div onClick={function() { setStep('ask'); setActiveId(null); }}
                style={{ padding: '12px 28px', background: T.grid, color: T.text, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
              >Back</div>
              <div onClick={function() { doPrint(true); }}
                style={{ padding: '12px 28px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
              >🖨️ Print Checks</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
