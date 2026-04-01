import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { validatePin } from '../../lib/rbac';
import { useStaffStore } from '../../lib/stores/staffStore';

/**
 * PinPopup — PIN entry modal for RBAC
 * Session 93 rewrite — Toast/Simphony style
 *
 * - Silent fire-and-forget: checks immediately at 4+ digits, no debounce
 * - No "Verifying..." spinner — total silence until match or max-length fail
 * - Input is NEVER blocked by API calls
 * - Keyboard + touch numpad both work
 * - No <input> element (kiosk virtual keyboard safety)
 */
export default function PinPopup({ show, title, titleColor, staffList, onSuccess, onCancel }) {
  var T = useTheme();
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [shake, setShake] = useState(false);
  var verifyAnyPin = useStaffStore(function(s) { return s.verifyAnyPin; });
  var storeSource = useStaffStore(function(s) { return s.source; });
  var loggedIn = useRef(false);
  var checkingPins = useRef({});

  // Reset state when popup opens/closes
  useEffect(function() {
    if (show) {
      setDigits('');
      setError('');
      setShake(false);
      loggedIn.current = false;
      checkingPins.current = {};
    }
  }, [show]);

  // ── Keyboard listener ──
  useEffect(function() {
    if (!show) return;
    function onKey(e) {
      if (loggedIn.current) return;
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

  function handleDigitDirect(d) {
    if (loggedIn.current) return;
    setError('');
    setDigits(function(prev) {
      if (prev.length >= 8) return prev;
      return prev + d;
    });
  }

  function handleCancelDirect() {
    setDigits('');
    setError('');
    loggedIn.current = false;
    onCancel();
  }

  // ── Silent fire-and-forget check at 4+ digits ──
  useEffect(function() {
    if (digits.length < 4) return;
    if (loggedIn.current) return;
    if (checkingPins.current[digits]) return;
    checkingPins.current[digits] = true;

    var pinToCheck = digits;

    // Mock mode
    if (storeSource !== 'api') {
      var staff = validatePin(pinToCheck, staffList);
      delete checkingPins.current[pinToCheck];
      if (staff) {
        loggedIn.current = true;
        setDigits('');
        setError('');
        onSuccess(staff);
      } else if (pinToCheck.length >= 8) {
        showError();
      }
      return;
    }

    // API mode — fire and forget
    verifyAnyPin(pinToCheck).then(function(result) {
      delete checkingPins.current[pinToCheck];
      if (loggedIn.current) return;

      if (result.valid && result.staff) {
        loggedIn.current = true;
        setDigits('');
        setError('');
        onSuccess(result.staff);
      } else if (pinToCheck.length >= 8) {
        showError();
      }
      // Otherwise: silence. Wait for more digits.
    }).catch(function(err) {
      delete checkingPins.current[pinToCheck];
      if (pinToCheck.length >= 8) {
        showError();
      }
    });
  }, [digits]);

  if (!show) return null;

  function showError() {
    setError('Invalid PIN');
    setShake(true);
    setTimeout(function() { setDigits(''); setShake(false); setError(''); }, 800);
  }

  function handleBackspace() {
    if (loggedIn.current) return;
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }

  function handleClear() {
    if (loggedIn.current) return;
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

        {/* PIN dots display */}
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
        </div>

        {/* Error message — only at max length */}
        <div style={{ height: 22, textAlign: 'center', fontSize: 13, fontWeight: 500, color: T.danger }}>
          {error || ''}
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
                    else handleDigitDirect(key);
                  }}
                  style={{
                    height: 50, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: T.grid, border: '1px solid ' + T.borderLight,
                    color: isBackspace ? T.danger : (isClear ? T.warning : T.text),
                    fontSize: isAction ? 16 : 20, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
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
