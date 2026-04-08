import { useTheme } from '../../lib/ThemeContext';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';

/**
 * PayrollCheckConfirmModal — Check printing confirmation
 * Extracted from PayrollModule (Session 33 split).
 * Per ProSalonPOS_Check_Printing_Session27.docx §10
 *
 * Props:
 *   show            — boolean, whether modal is visible
 *   paychecks       — array of paycheck objects
 *   checkSelections — { staff_id: true/false }
 *   setCheckSelections — setter
 *   setCheckOverrideStep — setter for override flow
 *   onClose         — close handler
 *   payTypeDisplay  — function(staff) => display string
 *   fmt             — function(cents) => formatted string
 */

export default function PayrollCheckConfirmModal({ show, paychecks, checkSelections, setCheckSelections, setCheckOverrideStep, onClose, payTypeDisplay, fmt }) {
  var T = useTheme();
  var MOCK_STAFF = useStaffStore(function(s) { return s.staff; });
  var MOCK_SALON_SETTINGS = useSettingsStore(function(s) { return s.settings; });

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: 'relative', background: T.surface, borderRadius: 16, padding: 28,
          border: '1px solid ' + T.borderLight, minWidth: 520, maxWidth: 600,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 6 }}>Print Paychecks</div>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 20 }}>
          Select technicians to print checks for. Starting check #{MOCK_SALON_SETTINGS.check_next_number}.
        </div>

        {/* Select all / deselect all */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div onClick={function() {
              var sel = {};
              paychecks.forEach(function(pc) { sel[pc.staff_id] = true; });
              setCheckSelections(sel);
            }}
            style={{ padding: '6px 14px', background: T.grid, color: T.text, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, border: '1px solid ' + T.borderLight }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >Select All</div>
          <div onClick={function() { setCheckSelections({}); }}
            style={{ padding: '6px 14px', background: T.grid, color: T.text, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, border: '1px solid ' + T.borderLight }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
          >Deselect All</div>
        </div>

        {/* Tech list with checkboxes */}
        <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 20 }}>
          {paychecks.map(function(pc, idx) {
            var staffRec = MOCK_STAFF.find(function(s) { return s.id === pc.staff_id; });
            var isChecked = !!checkSelections[pc.staff_id];
            return (
              <div key={pc.staff_id}
                onClick={function() {
                  var next = Object.assign({}, checkSelections);
                  next[pc.staff_id] = !isChecked;
                  setCheckSelections(next);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  background: isChecked ? T.blueTint : T.grid, borderRadius: 8, marginBottom: 4,
                  cursor: 'pointer', transition: 'background 150ms',
                  border: isChecked ? '1px solid ' + T.primary : '1px solid transparent',
                }}
                onMouseEnter={function(e) { if (!isChecked) e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { if (!isChecked) e.currentTarget.style.background = T.grid; }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                  border: isChecked ? '2px solid ' + T.primary : '2px solid ' + T.borderLight,
                  background: isChecked ? T.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                }}>{isChecked ? '✓' : ''}</div>
                {/* Name + pay type */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{staffRec ? staffRec.legal_name : pc.name}</div>
                  <div style={{ color: T.text, fontSize: 12 }}>{payTypeDisplay(staffRec)}</div>
                </div>
                {/* Check amount */}
                <div style={{ color: T.success, fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(pc.check_amount)}</div>
              </div>
            );
          })}
        </div>

        {/* Summary + buttons */}
        {(function() {
          var selectedCount = Object.values(checkSelections).filter(Boolean).length;
          var selectedTotal = paychecks.reduce(function(sum, pc) {
            return sum + (checkSelections[pc.staff_id] ? pc.check_amount : 0);
          }, 0);

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid ' + T.borderLight, marginBottom: 16 }}>
                <span style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{selectedCount} check{selectedCount !== 1 ? 's' : ''} selected</span>
                <span style={{ color: T.success, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(selectedTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <div onClick={onClose}
                  style={{ padding: '12px 28px', background: T.grid, color: T.danger, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >Cancel</div>
                <div onClick={function() {
                    if (selectedCount === 0) return;
                    setCheckOverrideStep('ask');
                  }}
                  style={{
                    padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: selectedCount > 0 ? T.primary : T.grid,
                    color: selectedCount > 0 ? '#fff' : T.text,
                    opacity: selectedCount > 0 ? 1 : 0.5,
                  }}
                  onMouseEnter={function(e) { if (selectedCount > 0) e.currentTarget.style.background = '#1D4FD7'; }}
                  onMouseLeave={function(e) { if (selectedCount > 0) e.currentTarget.style.background = T.primary; }}
                >🖨️ Print {selectedCount} Check{selectedCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
