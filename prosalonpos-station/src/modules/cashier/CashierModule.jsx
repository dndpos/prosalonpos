/**
 * Pro Salon POS — Cash Drawer Module
 * Session 36: Cashier in/out screen.
 *
 * Flows:
 *   1. Cashier In — PIN (via RBAC) → enter starting amount → Open Drawer
 *   2. During shift — background tracking of cash payments
 *   3. Cashier Out — view status → enter counted amount → Close Drawer → receipt
 *
 * Uses cash register mode numpad (digits shift left through fixed decimal).
 * All price fields use div-based numpad (kiosk-safe, no OS keyboard).
 */
import { useState, useEffect } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { numpadDisplay, numpadTap, numpadToCents, numpadKeys } from '../checkout/checkoutHelpers';
import { fmt } from '../../lib/formatUtils';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import { relayPrint } from '../../lib/printRelay';
import AreaTag from '../../components/ui/AreaTag';

var NUM_MODE = 'cash_register';
var KEYS = numpadKeys(NUM_MODE);


function formatTime(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

function formatDuration(startTs, endTs) {
  var ms = (endTs || Date.now()) - startTs;
  var totalMin = Math.floor(ms / 60000);
  var hrs = Math.floor(totalMin / 60);
  var mins = totalMin % 60;
  if (hrs === 0) return mins + ' min';
  return hrs + 'h ' + mins + 'm';
}

// ═══════════════════════════════════════
// NUMPAD COMPONENT — div-based, kiosk safe
// ═══════════════════════════════════════
function CashierNumpad({ value, onChange, C }) {
  function handleTap(k) {
    onChange(numpadTap(k, value, NUM_MODE));
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      {KEYS.map(function(k) {
        return (
          <div key={k} onClick={function() { handleTap(k); }}
            style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: k === '⌫' ? C.dangerBg : C.grid, border: '1px solid ' + C.borderLight,
              borderRadius: 8, color: k === '⌫' ? C.danger : C.textPrimary,
              fontSize: 18, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
              fontFamily: 'inherit' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = C.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = k === '⌫' ? C.dangerBg : C.grid; }}>
            {k}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// INFO ROW — label + value pair
// ═══════════════════════════════════════
function InfoRow({ label, value, C, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid ' + C.borderLight }}>
      <span style={{ fontSize: 14, color: C.textPrimary }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: color || C.textPrimary }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function CashierModule({ drawerSession, onOpen, onClose, onDismiss, salonSettings }) {
  var C = useTheme();
  var settings = salonSettings || {};

  // ── Local state ──
  var [amountInput, setAmountInput] = useState('');
  var [phase, setPhase] = useState(drawerSession ? 'status' : 'cashin');
  // phase: 'cashin' | 'status' | 'counting' | 'result'
  var [countInput, setCountInput] = useState('');
  var [result, setResult] = useState(null);

  // ── Derived ──
  var displayAmount = '$' + numpadDisplay(amountInput, NUM_MODE);
  var displayCount = '$' + numpadDisplay(countInput, NUM_MODE);

  // ── Keyboard → numpad bridge ──
  useNumpadKeyboard(phase==='cashin', function(d){ setAmountInput(function(p){ return numpadTap(d,p,NUM_MODE); }); }, function(){ setAmountInput(function(p){ return numpadTap('⌫',p,NUM_MODE); }); }, handleOpenDrawer, null, [phase]);
  useNumpadKeyboard(phase==='counting', function(d){ setCountInput(function(p){ return numpadTap(d,p,NUM_MODE); }); }, function(){ setCountInput(function(p){ return numpadTap('⌫',p,NUM_MODE); }); }, handleCloseDrawer, null, [phase]);

  // ── CASH IN ──
  function handleOpenDrawer() {
    var startingCents = numpadToCents(amountInput, NUM_MODE);
    onOpen(startingCents);
    setAmountInput('');
  }

  // ── CASH OUT ──
  function handleStartCashOut() {
    setCountInput('');
    setPhase('counting');
  }

  function handleCloseDrawer() {
    var reportedCents = numpadToCents(countInput, NUM_MODE);
    var cashPayTotal = 0;
    if (drawerSession && drawerSession.cash_payments) {
      drawerSession.cash_payments.forEach(function(p) { cashPayTotal += p.amount_cents; });
    }
    var expectedCents = (drawerSession ? drawerSession.starting_cents : 0) + cashPayTotal;
    var differenceCents = reportedCents - expectedCents;
    var resultData = {
      cashier_name: drawerSession ? drawerSession.cashier_name : 'Unknown',
      opened_at: drawerSession ? drawerSession.opened_at : null,
      closed_at: Date.now(),
      starting_cents: drawerSession ? drawerSession.starting_cents : 0,
      cash_pay_total: cashPayTotal,
      expected_cents: expectedCents,
      reported_cents: reportedCents,
      difference_cents: differenceCents,
      tx_count: drawerSession ? drawerSession.cash_payments.length : 0,
    };
    setResult(resultData);
    setPhase('result');
    onClose(reportedCents);
  }

  // ── Dismiss (return to calendar) ──
  function handleDone() {
    setPhase('cashin');
    setAmountInput('');
    setCountInput('');
    setResult(null);
    if (onDismiss) onDismiss();
  }

  // ═══ RENDER: CASH IN ═══
  if (phase === 'cashin') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onDismiss}>
        <div style={{ backgroundColor: C.surface, border: '1px solid ' + C.border, borderRadius: 14, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}
          onClick={function(e) { e.stopPropagation(); }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Open Cash Drawer</span>
            <div onClick={onDismiss} style={{ color: C.textPrimary, fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</div>
          </div>
          {/* Amount display */}
          <div style={{ padding: '24px 24px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Starting Cash Amount</div>
            <div style={{ background: C.chromeDark, border: '1px solid ' + C.borderMedium, borderRadius: 8, padding: '14px 16px', fontSize: 28, fontWeight: 700, color: C.textPrimary, textAlign: 'right', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
              {displayAmount}
            </div>
          </div>
          {/* Numpad */}
          <div style={{ padding: '12px 24px 16px' }}>
            <CashierNumpad value={amountInput} onChange={setAmountInput} C={C} />
          </div>
          {/* Open button */}
          <div style={{ padding: '0 24px 20px' }}>
            <div onClick={handleOpenDrawer}
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: C.success, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}>
              Open Drawer
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ RENDER: STATUS (drawer open) ═══
  if (phase === 'status') {
    var cashPayTotal = 0;
    if (drawerSession && drawerSession.cash_payments) {
      drawerSession.cash_payments.forEach(function(p) { cashPayTotal += p.amount_cents; });
    }
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onDismiss}>
        <div style={{ backgroundColor: C.surface, border: '1px solid ' + C.border, borderRadius: 14, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}
          onClick={function(e) { e.stopPropagation(); }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Cash Drawer</div>
              <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginTop: 2 }}>● Open</div>
            </div>
            <div onClick={onDismiss} style={{ color: C.textPrimary, fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</div>
          </div>
          {/* Info */}
          <div style={{ padding: '16px 24px' }}>
            <InfoRow label="Cashier" value={drawerSession ? drawerSession.cashier_name : '—'} C={C} bold />
            <InfoRow label="Opened at" value={formatTime(drawerSession ? drawerSession.opened_at : null)} C={C} />
            <InfoRow label="Duration" value={formatDuration(drawerSession ? drawerSession.opened_at : Date.now(), Date.now())} C={C} />
            <InfoRow label="Starting amount" value={fmt(drawerSession ? drawerSession.starting_cents : 0)} C={C} />
            <InfoRow label="Cash transactions" value={drawerSession ? drawerSession.cash_payments.length : 0} C={C} />
            <InfoRow label="Cash collected" value={fmt(cashPayTotal)} C={C} />
          </div>
          {/* Cash Out button */}
          <div style={{ padding: '8px 24px 20px' }}>
            <div onClick={handleStartCashOut}
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: C.blue, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}>
              Cash Out
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ RENDER: COUNTING (cash out numpad) ═══
  if (phase === 'counting') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onDismiss}>
        <div style={{ backgroundColor: C.surface, border: '1px solid ' + C.border, borderRadius: 14, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}
          onClick={function(e) { e.stopPropagation(); }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Cash Out</span>
              <span style={{ fontSize: 12, color: C.textPrimary, marginLeft: 10 }}>{drawerSession ? drawerSession.cashier_name : ''}</span>
            </div>
            <div onClick={function() { setPhase('status'); }} style={{ color: C.textPrimary, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, border: '1px solid ' + C.borderMedium }}>
              ← Back
            </div>
          </div>
          {/* Amount display */}
          <div style={{ padding: '24px 24px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cash Counted in Drawer</div>
            <div style={{ background: C.chromeDark, border: '1px solid ' + C.borderMedium, borderRadius: 8, padding: '14px 16px', fontSize: 28, fontWeight: 700, color: C.textPrimary, textAlign: 'right', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
              {displayCount}
            </div>
          </div>
          {/* Numpad */}
          <div style={{ padding: '12px 24px 16px' }}>
            <CashierNumpad value={countInput} onChange={setCountInput} C={C} />
          </div>
          {/* Close Drawer button */}
          <div style={{ padding: '0 24px 20px' }}>
            <div onClick={handleCloseDrawer}
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: C.danger, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}>
              Close Drawer
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ RENDER: RESULT (cash out summary / receipt) ═══
  if (phase === 'result' && result) {
    var diff = result.difference_cents;
    var isShort = diff < 0;
    var isOver = diff > 0;
    var statusLabel = isShort ? 'Drawer Short' : isOver ? 'Drawer Over' : 'Balanced';
    var statusColor = isShort ? C.danger : isOver ? C.warning : C.success;

    return (
      <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={handleDone}>
        <AreaTag id="CASHIER" />
        <div style={{ backgroundColor: C.surface, border: '1px solid ' + C.border, borderRadius: 14, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}
          onClick={function(e) { e.stopPropagation(); }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Drawer Closed</span>
            <div onClick={handleDone} style={{ color: C.textPrimary, fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</div>
          </div>
          {/* Status badge */}
          <div style={{ padding: '20px 24px 8px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', padding: '8px 24px', borderRadius: 8, background: isShort ? C.dangerBg : isOver ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: statusColor, fontSize: 18, fontWeight: 700 }}>
              {statusLabel}
            </div>
          </div>
          {/* Receipt details */}
          <div style={{ padding: '12px 24px 8px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid ' + C.borderLight, paddingBottom: 8 }}>
              {settings.salon_name || 'Salon'}
            </div>
            <InfoRow label="Cashier" value={result.cashier_name} C={C} bold />
            <InfoRow label="Shift start" value={formatTime(result.opened_at)} C={C} />
            <InfoRow label="Shift end" value={formatTime(result.closed_at)} C={C} />
            <InfoRow label="Duration" value={formatDuration(result.opened_at, result.closed_at)} C={C} />
            <div style={{ height: 8 }} />
            <InfoRow label="Starting cash" value={fmt(result.starting_cents)} C={C} />
            <InfoRow label={'Cash payments (' + result.tx_count + ')'} value={fmt(result.cash_pay_total)} C={C} />
            <InfoRow label="Expected total" value={fmt(result.expected_cents)} C={C} bold />
            <InfoRow label="Cashier reported" value={fmt(result.reported_cents)} C={C} bold />
            {/* Short/Over note */}
            {isShort && (
              <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>Drawer short</span>
                {settings.cashier_show_short_amount && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>{fmt(Math.abs(diff))}</span>
                )}
              </div>
            )}
            {isOver && (
              <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.warning }}>Drawer over</span>
                {settings.cashier_show_short_amount && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.warning }}>{fmt(Math.abs(diff))}</span>
                )}
              </div>
            )}
          </div>
          {/* Actions */}
          <div style={{ padding: '8px 24px 20px', display: 'flex', gap: 8 }}>
            <div onClick={function() { relayPrint('drawer_summary', { result: result, settings: settings }); }}
              style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid ' + C.borderMedium, background: 'transparent', color: C.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blueLight; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.borderMedium; e.currentTarget.style.color = C.textPrimary; }}>
              🖨 Print
            </div>
            <div onClick={handleDone}
              style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: C.blue, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}>
              Done
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
