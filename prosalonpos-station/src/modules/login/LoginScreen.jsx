/**
 * LoginScreen.jsx — Staff Login (PIN Entry)
 * Session 94 | Simple: type PIN → hit OK → instant result
 *
 * Flow:
 *   1. Type digits on numpad (or scan badge ID)
 *   2. Press OK button
 *   3. Instant result: access granted or denied
 *   4. No auto-checking, no timers, no background calls
 *
 * Rules:
 *   - div onClick only (no button/input — kiosk virtual keyboard safety)
 *   - Calculator layout: 7-8-9 top
 *   - Max PIN length: 8 digits
 *   - OK button triggers the check — nothing else does
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { login, getPairedSalonId, getPairedSalonName, isBackendAvailable, checkBackend, markBackendAvailable, unpairStation } from '../../lib/apiClient';
import { debugLog } from '../../lib/debugLog';
import DebugLabel from '../../components/debug/DebugLabel';

var MAX_PIN = 8;

// SHA-256 using Web Crypto API (instant, built into every browser)
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
  var [checking, setChecking] = useState(false);
  var [backendUp, setBackendUp] = useState(null);
  var [pinTable, setPinTable] = useState(null);
  var salonName = getPairedSalonName() || 'Your Salon';
  var loggedIn = useRef(false);

  // Load PIN table + check backend on mount
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

  // ── OK button pressed — check PIN ──
  var handleOk = useCallback(function() {
    if (loggedIn.current) return;
    if (checking) return;
    if (digits.length === 0) return;

    setError('');
    setChecking(true);

    // Try local lookup first (instant)
    if (pinTable) {
      sha256(digits).then(function(hash) {
        var entry = pinTable[hash];
        if (entry) {
          // LOCAL MATCH — instant green flash
          loggedIn.current = true;
          setMatched(true);
          setChecking(false);
          debugLog('AUTH', 'Local PIN match: ' + entry.display_name);

          // Fetch JWT in background
          login(digits).then(function(data) {
            if (data.token && data.staff) {
              markBackendAvailable();
              onLogin(data);
            } else {
              loggedIn.current = false;
              setMatched(false);
              showDenied();
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
            showDenied();
          });
        } else {
          // NO LOCAL MATCH — denied
          showDenied();
        }
      });
      return;
    }

    // No pin table — fall back to server call
    login(digits).then(function(data) {
      if (data.token && data.staff) {
        loggedIn.current = true;
        setMatched(true);
        setChecking(false);
        markBackendAvailable();
        debugLog('AUTH', 'Login success: ' + data.staff.display_name);
        onLogin(data);
      } else {
        showDenied();
      }
    }).catch(function(err) {
      if (err.status === 404 && err.data && err.data.code === 'NO_STAFF') {
        unpairStation();
        if (onStaleStation) { onStaleStation(); }
        else { window.location.reload(); }
        return;
      }
      if ((err.message || '').indexOf('fetch') >= 0 || (err.message || '').indexOf('Failed') >= 0) {
        setChecking(false);
        setError('Cannot connect to server');
        setBackendUp(false);
        return;
      }
      showDenied();
    });
  }, [digits, pinTable, checking]);

  function showDenied() {
    setChecking(false);
    setError('Access Denied');
    setTimeout(function() {
      setDigits('');
      setError('');
    }, 1200);
  }

  var handleDigit = useCallback(function(d) {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits(function(prev) {
      if (prev.length >= MAX_PIN) return prev;
      return prev + d;
    });
  }, [checking]);

  var handleBackspace = useCallback(function() {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }, [checking]);

  var handleClear = useCallback(function() {
    if (loggedIn.current || checking) return;
    setError('');
    setDigits('');
  }, [checking]);

  // Keyboard listener
  useEffect(function() {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleOk();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [handleDigit, handleBackspace, handleOk]);

  var rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '⌫'],
  ];

  var dotBorderColor = matched ? '#22C55E' : error ? '#EF4444' : (digits.length > 0 ? '#3B82F6' : '#2A3A50');
  var dotBg = matched ? '#0A2E1A' : error ? '#2A1215' : '#0F1923';

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

        {/* PIN dots display */}
        <div style={{
          height: 48, borderRadius: 8, margin: '0 auto 12px',
          maxWidth: 260,
          background: dotBg,
          border: '2px solid ' + dotBorderColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms, background 150ms',
        }}>
          {digits.length === 0
            ? <span style={{ color: '#64748B', fontSize: 14 }}>Enter PIN</span>
            : <span style={{ fontSize: 22, letterSpacing: 6, color: matched ? '#22C55E' : error ? '#EF4444' : '#E2E8F0', fontWeight: 600 }}>
                {digits.split('').map(function() { return '●'; }).join('')}
              </span>
          }
        </div>

        {/* Status message */}
        <div style={{ height: 24, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          {error && <span style={{ color: '#EF4444' }}>{error}</span>}
          {matched && <span style={{ color: '#22C55E' }}>✓ Welcome</span>}
        </div>

        {/* Server down warning */}
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

        {/* Numpad */}
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

          {/* OK Button */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            <div
              onClick={handleOk}
              style={{
                width: '100%', maxWidth: 244, height: 52, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, fontSize: 18, fontWeight: 700,
                cursor: digits.length === 0 || checking ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                background: digits.length === 0 || checking ? '#1E293B' : '#0D3B2E',
                color: digits.length === 0 || checking ? '#475569' : '#34D399',
                border: '1px solid ' + (digits.length === 0 || checking ? '#2A3A50' : '#065F46'),
                transition: 'background 150ms, color 150ms',
                letterSpacing: 1,
              }}
              onMouseDown={function(e) { if (digits.length > 0 && !checking) e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {checking ? 'Checking...' : 'OK'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#475569', marginTop: 24 }}>
        ProSalonPOS v1.0 · Phase 2
      </div>
    </div>
  );
}
