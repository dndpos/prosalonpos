import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { validatePin } from '../../lib/rbac';
import { useStaffStore } from '../../lib/stores/staffStore';

/**
 * PinPopup — PIN entry modal for RBAC
 * Session 87 rewrite
 *
 * - Input bar (not dots) showing masked bullets
 * - Works with touch numpad, mouse clicks, AND physical keyboard
 * - Supports 2–8 digit PINs, auto-checks after each digit from 2+
 * - No <input> element (kiosk virtual keyboard safety)
 * - Keyboard captured via window keydown listener
 */
export default function PinPopup({ show, title, titleColor, staffList, onSuccess, onCancel }) {
  var T = useTheme();
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [shake, setShake] = useState(false);
  var [checking, setChecking] = useState(false);
  var verifyAnyPin = useStaffStore(function(s) { return s.verifyAnyPin; });
  var storeSource = useStaffStore(function(s) { return s.source; });
  var checkingRef = useRef(false);
  var digitsRef = useRef('');

  // Keep refs in sync for keyboard handler
  digitsRef.current = digits;
  checkingRef.current = checking;

  // ── Keyboard listener — captures physical keyboard input ──
  useEffect(function() {
    if (!show) return;
    function onKey(e) {
      if (checkingRef.current) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitDirect(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setError('');
        setDigits(function(prev) { return prev.slice(0, -1); });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelDirect();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [show]);

  // We need stable references for the keyboard handler
  function handleDigitDirect(d) {
    setError('');
    setDigits(function(prev) {
      if (prev.length >= 8) return prev;
      return prev + d;
    });
  }

  function handleCancelDirect() {
    setDigits('');
    setError('');
    onCancel();
  }

  // ── Auto-check PIN after each digit from 2+ ──
  useEffect(function() {
    if (digits.length < 2) return;
    if (checking) return;
    submitPin(digits);
  }, [digits]);

  if (!show) return null;

  function handleDigit(d) {
    if (checking) return;
    handleDigitDirect(d);
  }

  function submitPin(pin) {
    // Mock mode
    if (storeSource !== 'api') {
      var staff = validatePin(pin, staffList);
      if (staff) {
        setDigits('');
        setError('');
        onSuccess(staff);
      } else if (pin.length >= 8) {
        showError();
      }
      return;
    }

    // API mode
    setChecking(true);
    verifyAnyPin(pin).then(function(result) {
      setChecking(false);
      if (result.valid && result.staff) {
        setDigits('');
        setError('');
        onSuccess(result.staff);
      } else if (pin.length >= 8) {
        showError();
      }
    }).catch(function(err) {
      console.error('[PinPopup] API error:', err);
      setChecking(false);
      if (pin.length >= 8) {
        showError();
      }
    });
  }

  function showError() {
    setError('Invalid PIN');
    setShake(true);
    setTimeout(function() { setDigits(''); setShake(false); }, 500);
  }

  function handleBackspace() {
    if (checking) return;
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }

  function handleClear() {
    if (checking) return;
    setError('');
    setDigits('');
  }

  var KEYS = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={handleCancelDirect}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: 'relative', background: T.surface, borderRadius: 12, padding: 32,
          border: '1px solid ' + T.borderLight, width: 400,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: shake ? 'rbac-shake 0.4s ease' : 'none',
        }}>

        <style>{'@keyframes rbac-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-12px); } 40% { transform: translateX(12px); } 60% { transform: translateX(-8px); } 80% { transform: translateX(8px); } }'}</style>

        {/* Lock icon + title */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{titleColor === 'denied' ? '🚫' : '🔒'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>PIN Required</div>
          {title && (
            <div style={{ fontSize: 13, color: titleColor === 'denied' ? T.danger : T.textMuted, marginTop: 4, fontWeight: titleColor === 'denied' ? 600 : 400 }}>{title}</div>
          )}
        </div>

        {/* PIN input bar */}
        <div style={{
          height: 48, borderRadius: 8, margin: '0 auto 8px',
          maxWidth: 260,
          background: T.bg, border: '1px solid ' + (digits.length > 0 ? T.primary : T.borderLight),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms',
        }}>
          {digits.length === 0
            ? <span style={{ color: T.textMuted, fontSize: 14 }}>Enter PIN</span>
            : <span style={{ fontSize: 22, letterSpacing: 6, color: T.text, fontWeight: 600 }}>
                {digits.split('').map(function() { return '●'; }).join('')}
              </span>
          }
          {checking && <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 8 }}>...</span>}
        </div>

        {/* Error / checking message */}
        <div style={{ height: 22, textAlign: 'center', fontSize: 13, fontWeight: 500, color: checking ? T.textMuted : T.danger }}>
          {checking ? 'Verifying...' : (error || '')}
        </div>

        {/* Numpad grid */}
        <div style={{ maxWidth: 260, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 8 }}>
            {KEYS.map(function(key) {
              var isBackspace = key === '⌫';
              var isClear = key === 'C';
              var isAction = isBackspace || isClear;

              return (
                <div key={key}
                  onClick={function() {
                    if (isClear) handleClear();
                    else if (isBackspace) handleBackspace();
                    else handleDigit(key);
                  }}
                  style={{
                    height: 50, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: T.grid, border: '1px solid ' + T.borderLight,
                    color: isBackspace ? T.danger : (isClear ? T.warning : T.text),
                    fontSize: isAction ? 16 : 20, fontWeight: 500, cursor: checking ? 'default' : 'pointer', userSelect: 'none',
                    transition: 'background 120ms',
                    opacity: checking ? 0.5 : 1,
                  }}
                  onMouseEnter={function(e) { if (!checking) e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >{key}</div>
              );
            })}
          </div>
        </div>

        {/* Cancel button */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div onClick={handleCancelDirect}
            style={{
              height: 38, padding: '0 24px', borderRadius: 8, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: T.text, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', border: '1px solid ' + T.borderLight, userSelect: 'none',
            }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</div>
        </div>
      </div>
    </div>
  );
}
