import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { fmt } from '../../lib/formatUtils';

/**
 * ChangePaymentPopup — Allows changing payment method on a reopened ticket.
 * Shows current payments (cash/credit/zelle only), lets user select which to remove,
 * then apply new payment(s) to cover the balance.
 *
 * Props: ticket (reopened ticket data), payments (original payment records),
 *        ticketId, totalCents, onDone (callback after payment changed), onCancel
 */
export default function ChangePaymentPopup({ ticketId, payments, totalCents, onDone, onCancel }) {
  var C = useTheme();
  var deletePayments = useTicketStore(function(s) { return s.deletePayments; });
  var addPayment = useTicketStore(function(s) { return s.addPayment; });
  var closeTicket = useTicketStore(function(s) { return s.closeTicket; });

  // Only show cash, credit, zelle payments (not gift card, not package)
  var changeablePayments = (payments || []).filter(function(p) {
    var m = (p.method || '').toLowerCase();
    return m === 'cash' || m === 'credit' || m === 'zelle';
  });

  var [selected, setSelected] = useState({});
  var [step, setStep] = useState('select'); // 'select' | 'pay'
  var [newPayments, setNewPayments] = useState([]);
  var [submitting, setSubmitting] = useState(false);
  var [payInput, setPayInput] = useState('');

  var METHODS = [
    { key: 'cash', label: 'Cash', icon: '💵', bg: '#064E3B', border: '#059669', color: '#34D399' },
    { key: 'credit', label: 'Credit', icon: '💳', bg: '#1E3A5F', border: '#2563EB', color: '#60A5FA' },
    { key: 'zelle', label: 'Zelle', icon: '⚡', bg: '#4C1D95', border: '#7C3AED', color: '#A78BFA' },
  ];

  // How much of the selected payments will be removed
  var selectedTotal = 0;
  Object.keys(selected).forEach(function(id) {
    if (selected[id]) {
      var p = changeablePayments.find(function(cp) { return cp.id === id; });
      if (p) selectedTotal += (p.amount_cents || 0);
    }
  });
  var selectedCount = Object.values(selected).filter(Boolean).length;

  // In pay step: balance remaining after new payments
  var newPaidTotal = newPayments.reduce(function(s, p) { return s + p.amount_cents; }, 0);
  var balanceRemaining = totalCents - newPaidTotal;

  function togglePayment(id) {
    setSelected(function(prev) { var n = Object.assign({}, prev); n[id] = !n[id]; return n; });
  }

  function handleRemove() {
    if (submitting) return;
    setSubmitting(true);
    deletePayments(ticketId).then(function() {
      setStep('pay');
      setSubmitting(false);
    }).catch(function(err) {
      console.error('[ChangePayment] Delete failed:', err.message);
      setSubmitting(false);
    });
  }

  function handleAddNewPayment(method) {
    var amt = balanceRemaining;
    if (payInput) {
      var parsed = Math.round(parseFloat(payInput) * 100);
      if (parsed > 0 && parsed <= balanceRemaining) amt = parsed;
    }
    setNewPayments(function(prev) { return prev.concat([{ method: method, amount_cents: amt }]); });
    setPayInput('');
  }

  function handleConfirm() {
    if (submitting || balanceRemaining > 0) return;
    setSubmitting(true);
    // Add each new payment, then close
    var chain = Promise.resolve();
    newPayments.forEach(function(p) {
      chain = chain.then(function() {
        return addPayment(ticketId, { method: p.method, amount_cents: p.amount_cents });
      });
    });
    chain.then(function() {
      var primaryMethod = newPayments.length > 0 ? newPayments[0].method : 'credit';
      return closeTicket(ticketId, { payment_method: primaryMethod, total_cents: totalCents });
    }).then(function() {
      onDone();
    }).catch(function(err) {
      console.error('[ChangePayment] Save failed:', err.message);
      setSubmitting(false);
    });
  }

  var overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
  var card = { width: 440, maxHeight: '80vh', overflow: 'auto', background: C.surface, borderRadius: 14, border: '1px solid ' + C.borderMedium, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', padding: 28 };
  var title = { fontSize: 20, fontWeight: 700, color: C.textPrimary, textAlign: 'center', marginBottom: 4 };
  var subtitle = { fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 24 };

  if (step === 'select') {
    return (
      <div style={overlay} onClick={onCancel}>
        <div style={card} onClick={function(e) { e.stopPropagation(); }}>
          <div style={title}>Change Payment</div>
          <div style={subtitle}>Select payments to remove — balance will be re-applied</div>
          {changeablePayments.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textMuted, padding: 20, fontSize: 14 }}>No changeable payments (cash/credit/zelle) found on this ticket.</div>
          )}
          {changeablePayments.map(function(p) {
            var m = METHODS.find(function(mt) { return mt.key === p.method; }) || METHODS[1];
            var isSelected = !!selected[p.id];
            return (
              <div key={p.id} onClick={function() { togglePayment(p.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 8, background: isSelected ? 'rgba(239,68,68,0.1)' : C.chrome, borderRadius: 10, border: '1px solid ' + (isSelected ? '#EF4444' : C.borderLight), cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, border: '2px solid ' + (isSelected ? '#EF4444' : C.borderMedium), background: isSelected ? '#EF4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700 }}>
                  {isSelected ? '✓' : ''}
                </div>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: isSelected ? '#EF4444' : C.textPrimary }}>{m.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: isSelected ? '#EF4444' : m.color, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount_cents)}</span>
              </div>
            );
          })}
          {selectedCount > 0 && (
            <div style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 13, color: '#EF4444', fontWeight: 600 }}>
              Removing {selectedCount} payment{selectedCount > 1 ? 's' : ''} totaling {fmt(selectedTotal)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <div onClick={onCancel}
              style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + C.borderMedium, borderRadius: 8, color: C.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </div>
            <div onClick={selectedCount > 0 && !submitting ? handleRemove : undefined}
              style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedCount > 0 ? '#EF4444' : C.chrome, borderRadius: 8, color: selectedCount > 0 ? '#fff' : C.textMuted, fontSize: 14, fontWeight: 700, cursor: selectedCount > 0 ? 'pointer' : 'default', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Removing...' : 'Remove & Re-pay'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Apply new payments
  return (
    <div style={overlay}>
      <div style={card} onClick={function(e) { e.stopPropagation(); }}>
        <div style={title}>Apply New Payment</div>
        <div style={subtitle}>Balance: <span style={{ color: balanceRemaining > 0 ? C.warning : '#22C55E', fontWeight: 700 }}>{fmt(balanceRemaining > 0 ? balanceRemaining : 0)}</span> of {fmt(totalCents)}</div>
        {newPayments.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {newPayments.map(function(p, i) {
              var m = METHODS.find(function(mt) { return mt.key === p.method; }) || METHODS[1];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 6, background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)' }}>
                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#22C55E' }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#22C55E' }}>{fmt(p.amount_cents)}</span>
                </div>
              );
            })}
          </div>
        )}
        {balanceRemaining > 0 && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {METHODS.map(function(m) {
                return (
                  <div key={m.key} onClick={function() { handleAddNewPayment(m.key); }}
                    style={{ flex: 1, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: m.bg, border: '1px solid ' + m.border, borderRadius: 10, cursor: 'pointer', transition: 'transform 0.1s' }}>
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: m.color, marginTop: 2 }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginBottom: 4 }}>Tap a method to apply full remaining balance, or enter a split amount:</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <span style={{ color: C.textMuted, fontSize: 14 }}>$</span>
              <input type="text" value={payInput} onChange={function(e) { setPayInput(e.target.value); }}
                placeholder={fmt(balanceRemaining).replace('$', '')}
                style={{ width: 100, padding: '6px 10px', background: C.chrome, border: '1px solid ' + C.borderMedium, borderRadius: 6, color: C.textPrimary, fontSize: 15, fontWeight: 600, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div onClick={onCancel}
            style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + C.borderMedium, borderRadius: 8, color: C.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </div>
          <div onClick={balanceRemaining <= 0 && !submitting ? handleConfirm : undefined}
            style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: balanceRemaining <= 0 ? '#22C55E' : C.chrome, borderRadius: 8, color: balanceRemaining <= 0 ? '#fff' : C.textMuted, fontSize: 14, fontWeight: 700, cursor: balanceRemaining <= 0 ? 'pointer' : 'default', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Saving...' : 'Confirm Payment'}
          </div>
        </div>
      </div>
    </div>
  );
}
