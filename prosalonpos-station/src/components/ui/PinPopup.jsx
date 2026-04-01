import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { validatePin } from '../../lib/rbac';
import { useStaffStore } from '../../lib/stores/staffStore';
import { getPairedSalonId } from '../../lib/apiClient';

/**
 * PinPopup — PIN entry modal for RBAC
 * Session 94 | Local SHA-256 lookup — instant verification
 *
 * - Loads pin table once when popup opens
 * - SHA-256 hash comparison done locally — zero network delay
 * - Exact match only — "00000" won't match "0000"
 * - Wrong PIN: shows "Invalid PIN" after 1.5s of no typing, or immediately at max length
 */

var MAX_PIN = 8;
var MIN_CHECK = 4;
var INVALID_DELAY = 1500;

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
  var [pinTable, setPinTable] = useState(null);
  var verifyAnyPin = useStaffStore(function(s) { return s.verifyAnyPin; });
  var storeSource = useStaffStore(function(s) { return s.source; });
  var loggedIn = useRef(false);
  var invalidTimer = useRef(null);

  // Reset state + load pin table when popup opens
  useEffect(function() {
    if (show) {
      setDigits('');
      setError('');
      setShake(false);
      loggedIn.current = false;
      if (invalidTimer.current) clearTimeout(invalidTimer.current);

      // Load pin table for RBAC popup
      if (storeSource === 'api') {
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
  }, [show, storeSource]);

  // Keyboard listener
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
      if (prev.length >= MAX_PIN) return prev;
      return prev + d;
    });
  }

  function handleCancelDirect() {
    setDigits('');
    setError('');
    loggedIn.current = false;
    if (invalidTimer.current) clearTimeout(invalidTimer.current);
    onCancel();
  }

  // ── Check PIN locally on every keystroke ──
  useEffect(function() {
    if (invalidTimer.current) {
      clearTimeout(invalidTimer.current);
      invalidTimer.current = null;
    }

    if (digits.length < MIN_CHECK) return;
    if (loggedIn.current) return;

    // Mock mode — use old validatePin
    if (storeSource !== 'api') {
      var staff = validatePin(digits, staffList);
      if (staff) {
        loggedIn.current = true;
        setDigits('');
        setError('');
        onSuccess(staff);
      } else if (digits.length >= MAX_PIN) {
        showError();
      } else {
        invalidTimer.current = setTimeout(function() {
          if (!loggedIn.current) showError();
        }, INVALID_DELAY);
      }
      return;
    }

    // API mode — local SHA-256 lookup
    if (!pinTable) {
      // Table not loaded yet — fall back to server call
      verifyAnyPin(digits).then(function(result) {
        if (loggedIn.current) return;
        if (result.valid && result.staff) {
          loggedIn.current = true;
          setDigits('');
          setError('');
          onSuccess(result.staff);
        } else if (digits.length >= MAX_PIN) {
          showError();
        }
      }).catch(function() {
        if (digits.length >= MAX_PIN) showError();
      });
      return;
    }

    sha256(digits).then(function(hash) {
      if (loggedIn.current) return;

      var entry = pinTable[hash];
      if (entry) {
        loggedIn.current = true;
        setDigits('');
        setError('');
        onSuccess(entry);
        return;
      }

      if (digits.length >= MAX_PIN) {
        showError();
      } else {
        invalidTimer.current = setTimeout(function() {
          if (!loggedIn.current) showError();
        }, INVALID_DELAY);
      }
    });
  }, [digits, pinTable]);

  // Cleanup
  useEffect(function() {
    return function() {
      if (invalidTimer.current) clearTimeout(invalidTimer.current);
    };
  }, []);

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

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{titleColor === 'denied' ? '🚫' : '🔒'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>PIN Required</div>
          {title && (
            <div style={{ fontSize: 13, color: titleColor === 'denied' ? T.danger : T.textMuted, marginTop: 4, fontWeight: titleColor === 'denied' ? 600 : 400 }}>{title}</div>
          )}
        </div>

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

        <div style={{ height: 22, textAlign: 'center', fontSize: 13, fontWeight: 500, color: T.danger }}>
          {error || ''}
        </div>

        <div style={{ maxWidth: 260, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 8 }}>
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
                >{key}</div>
              );
            })}
          </div>
        </div>

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
