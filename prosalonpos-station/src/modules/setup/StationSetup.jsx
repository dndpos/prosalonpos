/**
 * StationSetup.jsx — One-Time Station Pairing Screen
 * Session 59 | Phase 2B
 *
 * This screen appears only when the station has never been paired to a salon.
 * User enters a salon code (e.g., "LUXE2026"), the app verifies it with the
 * backend, and saves the pairing to localStorage. After that, this screen
 * never appears again unless the station is unpaired from Salon Settings.
 *
 * Flow:
 *   1. App detects no salon_id in localStorage → shows this screen
 *   2. User types salon code
 *   3. App calls GET /api/v1/auth/salon/:code to verify
 *   4. On success → pairStation() saves to localStorage → App reloads into normal mode
 *   5. On failure → shows error message (invalid code, server down, etc.)
 */
import React, { useState, useEffect, useRef } from 'react';
import { verifySalonCode, pairStation, checkBackend } from '../../lib/apiClient';

export default function StationSetup({ onPaired }) {
  var [code, setCode] = useState('');
  var [error, setError] = useState('');
  var [checking, setChecking] = useState(false);
  var [confirmed, setConfirmed] = useState(null); // { id, name, salon_code, status }
  var [backendUp, setBackendUp] = useState(null); // null = checking, true/false
  var inputRef = useRef(null);

  // Check backend on mount
  useEffect(function() {
    checkBackend().then(function(up) { setBackendUp(up); });
  }, []);

  // Auto-focus input
  useEffect(function() {
    if (inputRef.current && backendUp) inputRef.current.focus();
  }, [backendUp]);

  function handleVerify() {
    var trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter a salon code'); return; }
    if (!backendUp) { setError('Server is not running. Start the server first.'); return; }

    setChecking(true);
    setError('');

    verifySalonCode(trimmed).then(function(salon) {
      setChecking(false);
      if (salon.status === 'cancelled') {
        setError('This salon account has been cancelled.');
        return;
      }
      setConfirmed(salon);
    }).catch(function(err) {
      setChecking(false);
      if (err.message && err.message.indexOf('Salon not found') >= 0) {
        setError('Salon code not found. Check the code and try again.');
      } else if (err.message && err.message.indexOf('fetch') >= 0) {
        setError('Cannot connect to server. Make sure the server is running.');
        setBackendUp(false);
      } else {
        setError(err.message || 'Something went wrong');
      }
    });
  }

  function handleConfirm() {
    if (!confirmed) return;
    pairStation(confirmed.id, confirmed.salon_code, confirmed.name);
    if (onPaired) onPaired();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (confirmed) handleConfirm();
      else handleVerify();
    }
  }

  // ─── Render ───
  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #0B1220 0%, #162032 50%, #1A2736 100%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', width: 400 }}>
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Pro Salon POS</div>
          <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>Station Setup</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#1A2736', borderRadius: 16, padding: '32px 28px',
          border: '1px solid #2A3A50', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {/* Server status */}
          {backendUp === false && (
            <div style={{
              background: '#7F1D1D', border: '1px solid #991B1B', borderRadius: 8,
              padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#FCA5A5', textAlign: 'left',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Server not running</div>
              <div style={{ fontSize: 12, color: '#FDA4AF' }}>
                Start the server first: open Command Prompt, go to the server folder, and run <span style={{ fontFamily: 'monospace', background: '#450A0A', padding: '1px 4px', borderRadius: 3 }}>npm run dev</span>
              </div>
            </div>
          )}

          {backendUp === null && (
            <div style={{ padding: '20px 0', fontSize: 14, color: '#94A3B8' }}>
              Checking server connection...
            </div>
          )}

          {backendUp && !confirmed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#CBD5E1', marginBottom: 20 }}>
                Enter your salon code to connect this station
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  ref={inputRef}
                  value={code}
                  onChange={function(e) { setCode(e.target.value.toUpperCase()); setError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. LUXE2026"
                  maxLength={20}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#0F1923', color: '#fff', border: '1px solid ' + (error ? '#EF4444' : '#374151'),
                    borderRadius: 10, padding: '14px 16px', fontSize: 18, fontWeight: 600,
                    fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2,
                    outline: 'none',
                  }}
                  onFocus={function(e) { e.target.style.borderColor = '#3B82F6'; }}
                  onBlur={function(e) { e.target.style.borderColor = error ? '#EF4444' : '#374151'; }}
                />
              </div>

              {error && (
                <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
              )}

              <div
                onClick={checking ? null : handleVerify}
                style={{
                  padding: '12px 0', background: checking ? '#1E3A5F' : '#3B82F6',
                  borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: checking ? 'default' : 'pointer',
                  color: '#fff', userSelect: 'none', transition: 'background 150ms',
                }}
                onMouseEnter={function(e) { if (!checking) e.currentTarget.style.background = '#2563EB'; }}
                onMouseLeave={function(e) { if (!checking) e.currentTarget.style.background = '#3B82F6'; }}
              >
                {checking ? 'Verifying...' : 'Connect'}
              </div>

              <div style={{ fontSize: 12, color: '#64748B', marginTop: 16, lineHeight: 1.5 }}>
                Your salon code was provided when your account was created.
                Contact your provider if you don't have it.
              </div>
            </div>
          )}

          {/* Confirmation step */}
          {confirmed && (
            <div>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#10B981', marginBottom: 4 }}>Salon Found</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{confirmed.name}</div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 4 }}>
                Code: <span style={{ fontFamily: 'monospace', color: '#CBD5E1' }}>{confirmed.salon_code}</span>
              </div>
              {confirmed.status === 'trial' && (
                <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 4 }}>Trial account</div>
              )}
              {confirmed.status === 'suspended' && (
                <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 4 }}>Account suspended — contact your provider</div>
              )}

              <div style={{ fontSize: 14, color: '#94A3B8', margin: '20px 0 16px' }}>
                Connect this station to this salon?
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div
                  onClick={function() { setConfirmed(null); setCode(''); }}
                  style={{
                    flex: 1, padding: '12px 0', background: 'transparent',
                    border: '1px solid #374151', borderRadius: 10, fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', color: '#94A3B8', userSelect: 'none',
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#64748B'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#374151'; }}
                >Back</div>
                <div
                  onClick={handleConfirm}
                  style={{
                    flex: 2, padding: '12px 0', background: '#10B981',
                    borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    color: '#fff', userSelect: 'none',
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#059669'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#10B981'; }}
                >Confirm & Connect</div>
              </div>
            </div>
          )}
        </div>

        {/* Version */}
        <div style={{ fontSize: 11, color: '#475569', marginTop: 24 }}>
          ProSalonPOS v1.0 · Phase 2
        </div>
      </div>
    </div>
  );
}
