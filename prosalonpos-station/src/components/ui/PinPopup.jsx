import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { validatePin } from '../../lib/rbac';
import { useStaffStore } from '../../lib/stores/staffStore';
import { getPairedSalonId } from '../../lib/apiClient';
import AreaTag from './AreaTag';

/**
 * PinPopup — PIN entry modal for RBAC
 * Session 94 | Simple: type PIN → hit OK → instant result
 *
 * Keyboard support:
 *   0-9 = type digits
 *   Backspace = delete last digit
 *   Enter = OK (submit)
 *   Escape = Cancel
 *
 * Touch: numpad buttons + OK button
 */

var MAX_PIN = 8;

async function sha256(str) {
  var buf = new TextEncoder().encode(str);
  var hash = await crypto.subtle.digest('SHA-256', buf);
  var arr = Array.from(new Uint8Array(hash));
  return arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export default function PinPopup({ show, title, titleColor, staffList, onSuccess, onCancel }) {
  var T = useTheme();
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [shake, setShake] = useState(false);
  var [checking, setChecking] = useState(false);
  var [pinTable, setPinTable] = useState(null);
  var verifyAnyPin = useStaffStore(function(s) { return s.verifyAnyPin; });
  var storeSource = useStaffStore(function(s) { return s.source; });
  var cachedPinTable = useStaffStore(function(s) { return s.pinTable; });
  var loggedIn = useRef(false);
  var digitsRef = useRef('');

  // Keep ref in sync for keyboard handler
  useEffect(function() { digitsRef.current = digits; }, [digits]);

  // Reset state + use cached pin table when popup opens
  useEffect(function() {
    if (show) {
      setDigits('');
      setError('');
      setShake(false);
      setChecking(false);
      loggedIn.current = false;

      if (storeSource === 'api') {
        // Use cached pin table from bootstrap (instant — no network)
        if (cachedPinTable) {
          setPinTable(cachedPinTable);
        } else {
          // Fallback: fetch if bootstrap didn't include it
          var salonId = getPairedSalonId();
          if (salonId) {
            var base = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
            fetch(base + '/api/v1/auth/pin-table/' + salonId)
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.pinTable) setPinTable(data.pinTable);
              })
              .catch(function() {});
          }
        }
      }
    }
  }, [show, storeSource, cachedPinTable]);

  function handleDigitDirect(d) {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits(function(prev) {
      if (prev.length >= MAX_PIN) return prev;
      return prev + d;
    });
  }

  function handleBackspace() {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }

  function handleClear() {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits('');
  }

  function handleCancelDirect() {
    setDigits('');
    setError('');
    loggedIn.current = false;
    onCancel();
  }

  function showDenied() {
    setChecking(false);
    setError('Access Denied');
    setShake(true);
    setTimeout(function() {
      setDigits('');
      setShake(false);
      setError('');
    }, 1000);
  }

  // ── OK button — check PIN ──
  var handleOk = useCallback(function() {
    if (loggedIn.current || checking) return;
    var currentDigits = digitsRef.current;
    if (currentDigits.length === 0) return;

    setError('');
    setChecking(true);

    // Mock mode
    if (storeSource !== 'api') {
      var staff = validatePin(currentDigits, staffList);
      setChecking(false);
      if (staff) {
        loggedIn.current = true;
        setDigits('');
        setError('');
        onSuccess(staff);
      } else {
        showDenied();
      }
      return;
    }

    // API mode — local lookup first
    if (pinTable) {
      sha256(currentDigits).then(function(hash) {
        var entry = pinTable[hash];
        if (entry) {
          loggedIn.current = true;
          setChecking(false);
          setDigits('');
          setError('');
          onSuccess(entry);
        } else {
          showDenied();
        }
      });
      return;
    }

    // No pin table — fall back to server
    verifyAnyPin(currentDigits).then(function(result) {
      if (result.valid && result.staff) {
        loggedIn.current = true;
        setChecking(false);
        setDigits('');
        setError('');
        onSuccess(result.staff);
      } else {
        showDenied();
      }
    }).catch(function() {
      showDenied();
    });
  }, [storeSource, pinTable, staffList, checking]);

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
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelDirect();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleOk();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [show, handleOk]);

  if (!show) return null;

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
        <AreaTag id="PIN-RBAC" />

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
          background: error ? '#2A1215' : T.bg,
          border: '2px solid ' + (error ? T.danger : (digits.length > 0 ? T.primary : T.borderLight)),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms, background 150ms',
        }}>
          {digits.length === 0
            ? <span style={{ color: T.textMuted, fontSize: 14 }}>Enter PIN</span>
            : <span style={{ fontSize: 22, letterSpacing: 6, color: error ? T.danger : T.text, fontWeight: 600 }}>
                {digits.split('').map(function() { return '●'; }).join('')}
              </span>
          }
        </div>

        {/* Status message */}
        <div style={{ height: 24, textAlign: 'center', fontSize: 14, fontWeight: 600, color: T.danger }}>
          {error || ''}
        </div>

        {/* Numpad grid */}
        <div style={{ maxWidth: 260, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 4 }}>
            {KEYS.map(function(key) {
              var isBackspaceKey = key === '⌫';
              var isClear = key === 'C';
              var isAction = isBackspaceKey || isClear;

              return (
                <div key={key}
                  onClick={function() {
                    if (isClear) handleClear();
                    else if (isBackspaceKey) handleBackspace();
                    else handleDigitDirect(key);
                  }}
                  style={{
                    height: 50, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: T.grid, border: '1px solid ' + T.borderLight,
                    color: isBackspaceKey ? T.danger : (isClear ? T.warning : T.text),
                    fontSize: isAction ? 16 : 20, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                >
        {key}</div>
              );
            })}
          </div>

          {/* Cancel + OK buttons — side by side */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div
              onClick={handleCancelDirect}
              style={{
                flex: 1, height: 57, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: '#3B1C1C', color: '#F87171',
                border: '1px solid #5C2626',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                userSelect: 'none', letterSpacing: 0.5,
                transition: 'background 120ms',
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#4C2222'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#3B1C1C'; }}
            >Cancel</div>
            <div
              onClick={handleOk}
              style={{
                flex: 1, height: 57, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: digits.length === 0 || checking ? T.grid : '#1C3B2A',
                color: digits.length === 0 || checking ? T.textMuted : '#4ADE80',
                border: '1px solid ' + (digits.length === 0 || checking ? T.borderLight : '#2D5A3E'),
                fontSize: 14, fontWeight: 700,
                cursor: digits.length === 0 || checking ? 'not-allowed' : 'pointer',
                userSelect: 'none', letterSpacing: 0.5,
                transition: 'background 120ms, color 120ms',
              }}
              onMouseEnter={function(e) { if (digits.length > 0 && !checking) e.currentTarget.style.background = '#245638'; }}
              onMouseLeave={function(e) { if (digits.length > 0 && !checking) e.currentTarget.style.background = '#1C3B2A'; }}
            >{checking ? 'Checking...' : 'OK'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
