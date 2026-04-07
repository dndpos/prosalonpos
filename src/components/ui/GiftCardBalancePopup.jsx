/**
 * GiftCardBalancePopup — Auto-balance popup on gift card scan
 * Session 79 — TD-096
 *
 * Listens for barcode scanner input on non-checkout screens (Calendar, Avatar/PIN).
 * When a scanned code matches a gift card, shows a brief popup with the balance.
 * Auto-dismisses after 5 seconds, or tap to close.
 *
 * Usage (in App.jsx):
 *   <GiftCardBalancePopup giftCards={giftCards} enabled={activePage === 'calendar'} />
 */
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { fmt } from '../../lib/formatUtils';

export default function GiftCardBalancePopup({ giftCards, enabled }) {
  var C = useTheme();
  var [card, setCard] = useState(null);
  var [visible, setVisible] = useState(false);
  var scanBuf = useRef('');
  var scanTimer = useRef(null);
  var dismissTimer = useRef(null);

  useEffect(function() {
    if (!enabled) return;

    function handleKey(e) {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') return;
      if (e.key >= '0' && e.key <= '9') {
        scanBuf.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(function() {
          var code = scanBuf.current;
          scanBuf.current = '';
          if (code.length < 4) return; // too short to be a gift card

          // Try matching against gift card codes
          var codeClean = code.replace(/[^0-9]/g, '');
          var match = (giftCards || []).find(function(gc) {
            var gcClean = (gc.code || '').replace(/[^0-9]/g, '');
            return gcClean === codeClean || gc.code === code;
          });

          if (match) {
            setCard(match);
            setVisible(true);
            // Auto-dismiss after 5 seconds
            clearTimeout(dismissTimer.current);
            dismissTimer.current = setTimeout(function() {
              setVisible(false);
              setTimeout(function() { setCard(null); }, 300);
            }, 5000);
          }
        }, 200);
      }
    }

    window.addEventListener('keydown', handleKey);
    return function() {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(scanTimer.current);
      clearTimeout(dismissTimer.current);
    };
  }, [enabled, giftCards]);

  function handleDismiss() {
    clearTimeout(dismissTimer.current);
    setVisible(false);
    setTimeout(function() { setCard(null); }, 300);
  }

  if (!card) return null;

  var isDepleted = card.status === 'depleted' || card.balance_cents <= 0;
  var statusColor = isDepleted ? C.danger : C.success;
  var statusBg = isDepleted ? C.dangerBg : 'rgba(34,197,94,0.12)';
  var statusLabel = isDepleted ? 'Depleted' : 'Active';

  return (
    <div onClick={handleDismiss}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: visible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background-color 0.3s',
        pointerEvents: visible ? 'auto' : 'none',
      }}>
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{
          backgroundColor: C.surface, border: '1px solid ' + C.border,
          borderRadius: 16, width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s, opacity 0.3s',
        }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎁</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Gift Card Balance</span>
          </div>
          <div onClick={handleDismiss}
            style={{ color: C.textMuted, fontSize: 18, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</div>
        </div>

        {/* Card info */}
        <div style={{ padding: '20px 24px', textAlign: 'center' }}>
          {/* Code */}
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Card Code</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 16 }}>
            {card.code}
          </div>

          {/* Balance */}
          <div style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: 12,
            background: isDepleted ? C.dangerBg : 'rgba(34,197,94,0.08)',
            border: '1px solid ' + (isDepleted ? C.danger + '33' : 'rgba(34,197,94,0.2)'),
          }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Balance</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: isDepleted ? C.danger : C.success }}>
              {fmt(card.balance_cents)}
            </div>
          </div>

          {/* Status + client */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: '4px 12px', borderRadius: 20, background: statusBg, color: statusColor, fontSize: 12, fontWeight: 700 }}>
              {statusLabel}
            </div>
            {card.client_name && (
              <div style={{ padding: '4px 12px', borderRadius: 20, background: C.chrome, color: C.textPrimary, fontSize: 12, fontWeight: 600 }}>
                {card.client_name}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 16px', textAlign: 'center' }}>
          <div onClick={handleDismiss}
            style={{
              display: 'inline-block', padding: '10px 32px', borderRadius: 8,
              background: C.blue, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', userSelect: 'none',
            }}
            onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}>
            OK
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>Auto-closes in 5 seconds</div>
        </div>
      </div>
    </div>
  );
}
