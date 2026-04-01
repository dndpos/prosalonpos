/**
 * LoginScreen.jsx — Staff Login (PIN Entry)
 * Session 94 | Instant local PIN verification
 *
 * How it works:
 *   1. Station boots → fetches PIN lookup table from server (one-time)
 *   2. Table maps SHA-256(pin) → staff info
 *   3. On every keystroke, we SHA-256 the current input and look it up locally
 *   4. Match found → instant green flash + login (JWT fetched in background)
 *   5. No match → after 1.5s of no typing, show "Invalid PIN" and clear
 *   6. Exact match only — "00000" will NOT match "0000"
 *
 * Rules:
 *   - div onClick only (no button/input — kiosk virtual keyboard safety)
 *   - Calculator layout: 7-8-9 top
 *   - Max PIN length: 8 digits
 *   - No submit button — auto-recognizes correct PIN
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { login, getPairedSalonId, getPairedSalonName, isBackendAvailable, checkBackend, unpairStation } from '../../lib/apiClient';
import { debugLog } from '../../lib/debugLog';
import DebugLabel from '../../components/debug/DebugLabel';

var MAX_PIN = 8;
var MIN_CHECK = 4;
var INVALID_DELAY = 1500; // ms of no typing before showing "Invalid PIN"

// SHA-256 hash using Web Crypto API (instant, built into every browser)
async function sha256(str) {
  var buf = new TextEncoder().encode(str);
  var hash = await crypto.subtle.digest('SHA-256', buf);
  var arr = Array.from(new Uint8Array(hash));
  return arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export default function LoginScreen({ onLogin, onStaleStation }) {
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [matched, setMatched] = useState(false);
  var [backendUp, setBackendUp] = useState(null);
  var [pinTable, setPinTable] = useState(null);
  var salonName = getPairedSalonName() || 'Your Salon';
  var loggedIn = useRef(false);
  var invalidTimer = useRef(null);

  // Load PIN table on mount (one-time)
  useEffect(function() {
    checkBackend().then(function(up) {
      setBackendUp(up);
      if (!up) return;
      var salonId = getPairedSalonId();
      if (!salonId) return;
      var base = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
      fetch(base + '/api/v1/auth/pin-table/' + salonId)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.pinTable) {
            setPinTable(data.pinTable);
            console.log('[PIN] Loaded pin table with', Object.keys(data.pinTable).length, 'entries');
          }
        })
        .catch(function(err) {
          console.log('[PIN] Failed to load pin table:', err.message);
        });
    });
  }, []);

  // ── Check PIN locally on every keystroke ──
  useEffect(function() {
    if (invalidTimer.current) {
      clearTimeout(invalidTimer.current);
      invalidTimer.current = null;
    }

    if (digits.length < MIN_CHECK) return;
    if (loggedIn.current) return;
    if (!pinTable) return;

    sha256(digits).then(function(hash) {
      if (loggedIn.current) return;

      var entry = pinTable[hash];
      if (entry) {
        // MATCH — instant visual feedback
        loggedIn.current = true;
        setMatched(true);
        setError('');
        debugLog('AUTH', 'Local PIN match: ' + entry.display_name);

        // Fetch JWT in background
        login(digits).then(function(data) {
          if (data.token && data.staff) {
            onLogin(data);
          } else {
            loggedIn.current = false;
            setMatched(false);
            setError('Server error — try again');
            setTimeout(function() { setError(''); setDigits(''); }, 1200);
          }
        }).catch(function(err) {
          if (err.status === 404 && err.data && err.data.code === 'NO_STAFF') {
            unpairStation();
            if (onStaleStation) { onStaleStation(); }
            else { window.location.reload(); }
            return;
          }
          loggedIn.current = false;
          setMatched(false);
          setError('Server error — try again');
          setTimeout(function() { setError(''); setDigits(''); }, 1200);
        });
        return;
      }

      // No match at this length
      if (digits.length >= MAX_PIN) {
        setError('Invalid PIN');
        setTimeout(function() { setDigits(''); setError(''); }, 1000);
      } else {
        invalidTimer.current = setTimeout(function() {
          if (!loggedIn.current) {
            setError('Invalid PIN');
            setTimeout(function() { setDigits(''); setError(''); }, 1000);
          }
        }, INVALID_DELAY);
      }
    });
  }, [digits, pinTable]);

  var handleDigit = useCallback(function(d) {
    if (loggedIn.current) return;
    setError('');
    setDigits(function(prev) {
      if (prev.length >= MAX_PIN) return prev;
      return prev + d;
    });
  }, []);

  var handleBackspace = useCallback(function() {
    if (loggedIn.current) return;
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }, []);

  var handleClear = useCallback(function() {
    if (loggedIn.current) return;
    setError('');
    setDigits('');
  }, []);

  // Keyboard listener
  useEffect(function() {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [handleDigit, handleBackspace]);

  useEffect(function() {
    return function() {
      if (invalidTimer.current) clearTimeout(invalidTimer.current);
    };
  }, []);

  var rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '⌫'],
  ];

  var dotBorderColor = matched ? '#22C55E' : (digits.length > 0 ? '#3B82F6' : '#2A3A50');

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #0B1220 0%, #162032 50%, #1A2736 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Pro Salon POS</div>
        <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>{salonName}</div>
      </div>

      <div style={{
        background: '#1A2736', borderRadius: 16, padding: '28px 32px 24px',
        border: '1px solid #2A3A50', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: 320, textAlign: 'center', position: 'relative',
      }}>
        <DebugLabel id="SCREEN-LOGIN" />
        <div style={{ fontSize: 15, fontWeight: 500, color: '#CBD5E1', marginBottom: 24 }}>
          Enter your PIN to sign in
        </div>

        <div style={{
          height: 48, borderRadius: 8, margin: '0 auto 16px',
          maxWidth: 260,
          background: matched ? '#0A2E1A' : '#0F1923',
          border: '2px solid ' + dotBorderColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms, background 150ms',
        }}>
          {digits.length === 0
            ? <span style={{ color: '#64748B', fontSize: 14 }}>Enter PIN</span>
            : <span style={{ fontSize: 22, letterSpacing: 6, color: matched ? '#22C55E' : '#E2E8F0', fontWeight: 600 }}>
                {digits.split('').map(function() { return '●'; }).join('')}
              </span>
          }
        </div>

        <div style={{ height: 22, marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
          {error && <span style={{ color: '#EF4444' }}>{error}</span>}
          {matched && <span style={{ color: '#22C55E' }}>✓ Welcome</span>}
        </div>

        {backendUp === false && (
          <div style={{
            background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 8,
            padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#FCA5A5', textAlign: 'left',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Server not connected</div>
            <div style={{ color: '#FDA4AF', marginBottom: 6 }}>
              Please start the server and try again.
            </div>
            <div
              onClick={function() {
                setBackendUp(null);
                setError('');
                checkBackend().then(function(up) {
                  setBackendUp(up);
                  if (!up) setError('Still cannot reach server');
                });
              }}
              style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 6,
                background: '#991B1B', color: '#FCA5A5', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, userSelect: 'none',
              }}
            >
              Retry Connection
            </div>
          </div>
        )}

        {backendUp === true && !pinTable && (
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Loading...</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(function(row, ri) {
            return (
              <div key={ri} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {row.map(function(key) {
                  var isAction = key === 'C' || key === '⌫';
                  return (
                    <div
                      key={key}
                      onClick={function() {
                        if (key === 'C') handleClear();
                        else if (key === '⌫') handleBackspace();
                        else handleDigit(key);
                      }}
                      style={{
                        width: 76, height: 56, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        borderRadius: 10, fontSize: isAction ? 16 : 22,
                        fontWeight: isAction ? 500 : 600, cursor: 'pointer',
                        userSelect: 'none',
                        background: isAction ? '#1E293B' : '#0F1923',
                        color: isAction ? '#94A3B8' : '#E2E8F0',
                        border: '1px solid #2A3A50',
                        transition: 'background 100ms, transform 80ms',
                      }}
                      onMouseDown={function(e) { e.currentTarget.style.transform = 'scale(0.96)'; }}
                      onMouseUp={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {key}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#475569', marginTop: 24 }}>
        ProSalonPOS v1.0 · Phase 2
      </div>
    </div>
  );
}
