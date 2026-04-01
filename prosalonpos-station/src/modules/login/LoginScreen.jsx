/**
 * LoginScreen.jsx — Staff Login (PIN Entry)
 * Session 92 | Non-blocking auto-check: digits appear instantly, API checks in background
 *
 * Flow:
 *   1. Station is paired (salon_id in localStorage)
 *   2. No JWT token exists → LoginScreen appears
 *   3. Staff enters PIN via div-based numpad — digits appear INSTANTLY (no waiting)
 *   4. After a short debounce (300ms), background API check fires
 *   5. As soon as a match is found, login proceeds automatically
 *   6. Typing is NEVER blocked — API calls happen in parallel
 *
 * Rules:
 *   - div onClick only (no <button>/<input> — kiosk virtual keyboard safety)
 *   - Calculator layout: 7-8-9 top
 *   - Max PIN length: 8 digits
 *   - No submit button needed — auto-checks silently
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { login, getPairedSalonName, isBackendAvailable, checkBackend, unpairStation } from '../../lib/apiClient';
import { debugLog } from '../../lib/debugLog';
import DebugLabel from '../../components/debug/DebugLabel';

var MAX_PIN = 8;
var MIN_CHECK = 2;
var DEBOUNCE_MS = 300; // wait 300ms after last keystroke before checking

export default function LoginScreen({ onLogin, onStaleStation }) {
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [checking, setChecking] = useState(false);
  var [backendUp, setBackendUp] = useState(null);
  var salonName = getPairedSalonName() || 'Your Salon';
  var debounceRef = useRef(null);
  var lastChecked = useRef(''); // last PIN string we sent to API
  var loggedIn = useRef(false); // prevent double-login

  // Check backend on mount
  useEffect(function() {
    checkBackend().then(function(up) { setBackendUp(up); });
  }, []);

  var handleDigit = useCallback(function(d) {
    if (loggedIn.current) return;
    setError('');
    setDigits(function(prev) {
      if (prev.length >= MAX_PIN) return prev;
      return prev + d;
    });
  }, []);

  // Debounced background check — never blocks typing
  useEffect(function() {
    if (digits.length < MIN_CHECK) return;
    if (loggedIn.current) return;
    if (backendUp === false) return;

    // Don't re-check same PIN
    if (lastChecked.current === digits) return;

    // Clear any pending check and schedule a new one
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function() {
      if (loggedIn.current) return;
      var pinToCheck = digits;
      lastChecked.current = pinToCheck;
      setChecking(true);

      login(pinToCheck).then(function(data) {
        setChecking(false);
        if (data.token && data.staff) {
          loggedIn.current = true;
          debugLog('AUTH', 'Login success: ' + data.staff.display_name);
          if (onLogin) onLogin(data);
        }
      }).catch(function(err) {
        setChecking(false);

        // Stale salon_id detection
        if (err.status === 404 && err.data && err.data.code === 'NO_STAFF') {
          debugLog('AUTH', 'Stale salon_id — clearing pairing');
          unpairStation();
          if (onStaleStation) {
            onStaleStation();
          } else {
            setError('Station data is outdated. Redirecting...');
            setTimeout(function() { window.location.reload(); }, 1500);
          }
          return;
        }

        // Network error
        if ((err.message || '').indexOf('fetch') >= 0 || (err.message || '').indexOf('Failed') >= 0 || (err.message || '').indexOf('NetworkError') >= 0) {
          setError('Cannot connect to server');
          setBackendUp(false);
          return;
        }

        // Invalid PIN at max length — show error and reset
        if (pinToCheck.length >= MAX_PIN) {
          setError('Invalid PIN');
          setDigits('');
          lastChecked.current = '';
        }
        // Otherwise silently wait for more digits
      });
    }, DEBOUNCE_MS);

    return function() { clearTimeout(debounceRef.current); };
  }, [digits]);

  var handleBackspace = useCallback(function() {
    if (loggedIn.current) return;
    setError('');
    lastChecked.current = '';
    setDigits(function(prev) { return prev.slice(0, -1); });
  }, []);

  var handleClear = useCallback(function() {
    if (loggedIn.current) return;
    setError('');
    lastChecked.current = '';
    setDigits('');
  }, []);

  // Keyboard listener — type PIN with physical keyboard
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

  // Numpad digits (calculator layout: 7-8-9 top)
  var rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '⌫'],
  ];

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #0B1220 0%, #162032 50%, #1A2736 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Pro Salon POS</div>
        <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>{salonName}</div>
      </div>

      {/* Card */}
      <div style={{
        background: '#1A2736', borderRadius: 16, padding: '28px 32px 24px',
        border: '1px solid #2A3A50', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: 320, textAlign: 'center', position: 'relative',
      }}>
        <DebugLabel id="SCREEN-LOGIN" />
        <div style={{ fontSize: 15, fontWeight: 500, color: '#CBD5E1', marginBottom: 24 }}>
          Enter your PIN to sign in
        </div>

        {/* PIN input bar */}
        <div style={{
          height: 48, borderRadius: 8, margin: '0 auto 16px',
          maxWidth: 260,
          background: '#0F1923', border: '1px solid ' + (digits.length > 0 ? '#3B82F6' : '#2A3A50'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 150ms',
        }}>
          {digits.length === 0
            ? <span style={{ color: '#64748B', fontSize: 14 }}>Enter PIN</span>
            : <span style={{ fontSize: 22, letterSpacing: 6, color: '#E2E8F0', fontWeight: 600 }}>
                {digits.split('').map(function() { return '●'; }).join('')}
              </span>
          }
          {checking && <span style={{ fontSize: 12, color: '#3B82F6', marginLeft: 8 }}>•</span>}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            color: '#EF4444', fontSize: 13, marginBottom: 12,
            minHeight: 18,
          }}>{error}</div>
        )}

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
        </div>
      </div>

      {/* Version */}
      <div style={{ fontSize: 11, color: '#475569', marginTop: 24 }}>
        ProSalonPOS v1.0 · Phase 2
      </div>
    </div>
  );
}
