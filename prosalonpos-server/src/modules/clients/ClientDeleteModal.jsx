import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Client Delete Modal
 * Session 7 Decision #172: Deactivate or permanently delete
 * - Owner only
 * - Deactivate = soft delete, history preserved, reactivatable
 * - Permanent delete = all data removed, cannot undo
 * - Double confirmation for permanent delete
 */
import { useState } from 'react';


export default function ClientDeleteModal({ clientName, isActive, onDeactivate, onReactivate, onPermanentDelete, onClose }) {
  var C = useTheme();
  var [step, setStep] = useState('choose'); // choose | confirm_delete

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: C.chrome, borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', border: '1px solid ' + C.borderMedium, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={function(e) { e.stopPropagation(); }}>

        {step === 'choose' && (
          <>
            <div style={{ color: C.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Manage Client: {clientName}
            </div>
            <div style={{ color: C.textPrimary, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Choose an action for this client record. Only the salon owner can perform these actions.
            </div>

            {/* Deactivate / Reactivate */}
            <button
              onClick={function() { if (isActive) { onDeactivate(); } else { onReactivate(); } }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10,
                background: C.chromeDark, border: '1px solid ' + C.borderMedium, borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.warning; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.borderMedium; }}
            >
              <div style={{ color: C.warning, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {isActive ? 'Deactivate Client' : 'Reactivate Client'}
              </div>
              <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                {isActive
                  ? 'Hides client from search and booking. All history and data preserved. Can be reactivated any time. Phone number stays reserved.'
                  : 'Restores the client to active status. They will appear in search and booking again.'}
              </div>
            </button>

            {/* Permanent delete */}
            <button
              onClick={function() { setStep('confirm_delete'); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 16,
                background: C.chromeDark, border: '1px solid ' + C.borderMedium, borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.danger; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.borderMedium; }}
            >
              <div style={{ color: C.danger, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Permanently Delete</div>
              <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                Removes the client and ALL associated data permanently. Visit history, notes, financial records — everything is deleted. This cannot be undone.
              </div>
            </button>

            <button
              onClick={onClose}
              style={{ width: '100%', height: 40, background: 'transparent', color: C.textPrimary, border: '1px solid ' + C.borderMedium, borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >Cancel</button>
          </>
        )}

        {step === 'confirm_delete' && (
          <>
            <div style={{ color: C.danger, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Are you absolutely sure?
            </div>
            <div style={{ color: C.textPrimary, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
              You are about to permanently delete <span style={{ color: C.textPrimary, fontWeight: 500 }}>{clientName}</span> and all their data:
            </div>
            <ul style={{ color: C.textMuted, fontSize: 12, lineHeight: 2, paddingLeft: 20, marginBottom: 20 }}>
              <li>Visit history</li>
              <li>Notes and preferences</li>
              <li>Financial records and balances</li>
              <li>Custom field data</li>
              <li>Loyalty points and membership</li>
            </ul>
            <div style={{ color: C.danger, fontSize: 12, fontWeight: 500, marginBottom: 20, padding: '10px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)' }}>
              This action cannot be undone. The phone number will be released for reuse.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={function() { setStep('choose'); }}
                style={{ flex: 1, height: 44, background: 'transparent', color: C.textPrimary, border: '1px solid ' + C.borderMedium, borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >Go Back</button>
              <button
                onClick={function() { if (onPermanentDelete) onPermanentDelete(); }}
                style={{ flex: 1, height: 44, background: C.danger, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >Yes, Delete Permanently</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
