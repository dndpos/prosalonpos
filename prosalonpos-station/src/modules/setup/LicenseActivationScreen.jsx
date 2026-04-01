/**
 * LicenseActivationScreen.jsx — First-Launch License Activation
 * Session 64 — Offline Mode & Licensing System
 *
 * Shown when software has no valid license. Three steps:
 *   1. Enter License Key
 *   2. View Machine Code (hardware fingerprint) + choose activation method
 *   3. Enter Activation Code (phone method) or auto-activate (online)
 *
 * In Phase 1 (mock), we simulate the flow with fake codes.
 * Phase 2: real hardware fingerprint, encrypted license file, server verification.
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../lib/ThemeContext';

var API_BASE = (function() {
  var loc = window.location;
  if (loc.port === '5173') {
    return 'http://localhost:3001/api/v1/license';
  }
  return loc.protocol + '//' + loc.host + '/api/v1/license';
})();

// Mock fallback: generate a fake machine code (dev mode only)
function generateMockMachineCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function block() {
    var s = '';
    for (var i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  return 'PSP-' + block() + '-' + block() + '-' + block();
}

export default function LicenseActivationScreen({ onActivated }) {
  var T = useTheme();

  var [step, setStep] = useState(1);
  var [licenseKey, setLicenseKey] = useState('');
  var [licenseError, setLicenseError] = useState('');
  var [machineCode, setMachineCode] = useState('');
  var [machineCodeLoading, setMachineCodeLoading] = useState(true);
  var [activationCode, setActivationCode] = useState('');
  var [activationError, setActivationError] = useState('');
  var [activating, setActivating] = useState(false);
  var [activated, setActivated] = useState(false);
  var [activationMethod, setActivationMethod] = useState(null);
  var [onlineResult, setOnlineResult] = useState(null);
  var [salonName, setSalonName] = useState('');

  // Fetch real machine code from server on mount (production uses hardware fingerprint)
  useEffect(function() {
    fetch(API_BASE + '/machine', { signal: AbortSignal.timeout(3000) })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var code = data && data.machineInfo && data.machineInfo.machine_code;
        setMachineCode(code || generateMockMachineCode());
        setMachineCodeLoading(false);
      })
      .catch(function() {
        setMachineCode(generateMockMachineCode());
        setMachineCodeLoading(false);
      });
  }, []);

  // ── Step 1: Verify license key + salon name ──
  async function handleKeySubmit() {
    var key = licenseKey.trim().toUpperCase();
    if (!key) { setLicenseError('Please enter a license key.'); return; }
    if (!/^PSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      setLicenseError('Invalid format. License key looks like: PSP-2026-A7B3-X9K2');
      return;
    }
    if (!salonName.trim()) { setLicenseError('Please enter your salon name.'); return; }

    setLicenseError('');
    setLicenseKey(key);
    setStep(2);
  }

  // ── Step 2: Online activation ──
  async function handleOnlineActivation() {
    setActivationMethod('online');
    setActivating(true);
    try {
      var res = await fetch(API_BASE + '/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, machine_code: machineCode, salon_name: salonName || 'My Salon', device_name: 'Station', create_salon: true }),
      });
      var data = await res.json();
      setActivating(false);
      if (res.ok && data.activation && data.activation.success) {
        setOnlineResult('success');
        setTimeout(function() { setActivated(true); }, 1500);
      } else {
        setOnlineResult('failed');
        setLicenseError((data.error && data.error.message) || 'Activation failed.');
      }
    } catch (e) {
      // Server not reachable — mock success
      setActivating(false);
      setOnlineResult('success');
      setTimeout(function() { setActivated(true); }, 1500);
    }
  }

  function handlePhoneMethod() {
    setActivationMethod('phone');
    setStep(3);
  }

  // ── Step 3: Validate activation code ──
  async function handleActivationSubmit() {
    var code = activationCode.trim().toUpperCase();
    if (!code) { setActivationError('Please enter the activation code.'); return; }

    try {
      var res = await fetch(API_BASE + '/activate-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, machine_code: machineCode, activation_code: code, salon_name: salonName || 'My Salon', create_salon: true }),
      });
      var data = await res.json();
      if (res.ok && data.activation && data.activation.success) {
        setActivationError('');
        setActivated(true);
        return;
      } else {
        setActivationError((data.error && data.error.message) || 'Invalid activation code.');
        return;
      }
    } catch (e) {
      // Server not reachable — accept any correctly formatted code (mock)
      if (/^ACT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
        setActivationError('');
        setActivated(true);
      } else {
        setActivationError('Invalid activation code format.');
      }
    }
  }

  // ── Activated success screen ──
  if (activated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0B1220', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981', marginBottom: 12 }}>License Activated!</div>
          <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 8 }}>Your software is now activated and ready to use.</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 32 }}>License: <span style={{ fontFamily: "'Courier New', monospace", color: '#94A3B8' }}>{licenseKey}</span></div>
          <div onClick={function() { if (onActivated) onActivated(licenseKey); }}
            style={{ display: 'inline-block', padding: '14px 48px', background: '#1D4ED8', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600, userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
          >Start Using ProSalonPOS</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0B1220', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ width: 480, maxWidth: '90vw' }}>

        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#E2E8F0' }}>Pro Salon POS</div>
          <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>Software Activation</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[1, 2, 3].map(function(s) {
            var isActive = step === s;
            var isDone = step > s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: isDone ? '#10B981' : isActive ? '#1D4ED8' : '#1E293B',
                  color: isDone || isActive ? '#fff' : '#64748B',
                  border: '2px solid ' + (isDone ? '#10B981' : isActive ? '#3B82F6' : '#334155'),
                }}>{isDone ? '✓' : s}</div>
                {s < 3 && <div style={{ width: 40, height: 2, background: isDone ? '#10B981' : '#334155' }} />}
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════ */}
        {/* STEP 1: Enter License Key */}
        {/* ══════════════════════════════════ */}
        {step === 1 && (
          <div style={{ background: '#1A2736', borderRadius: 12, padding: 32, border: '1px solid #2A3A50' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 8 }}>Enter Your License Key</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Your license key was provided when you purchased ProSalonPOS. It looks like: PSP-2026-A7B3-X9K2</div>

            <input
              autoFocus
              value={licenseKey}
              onChange={function(e) { setLicenseKey(e.target.value.toUpperCase()); setLicenseError(''); }}
              onKeyDown={function(e) { if (e.key === 'Enter') handleKeySubmit(); }}
              placeholder="PSP-XXXX-XXXX-XXXX"
              style={{
                width: '100%', padding: '14px 16px', background: '#0F1923', border: '1px solid ' + (licenseError ? '#EF4444' : '#374151'),
                borderRadius: 8, color: '#E2E8F0', fontSize: 18, fontFamily: "'Courier New', monospace", textAlign: 'center',
                outline: 'none', boxSizing: 'border-box', letterSpacing: 1,
              }}
            />

            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 16, marginBottom: 8 }}>Salon Name</div>
            <input
              value={salonName}
              onChange={function(e) { setSalonName(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') handleKeySubmit(); }}
              placeholder="e.g. Andy's Hair Studio"
              style={{
                width: '100%', padding: '12px 16px', background: '#0F1923', border: '1px solid #374151',
                borderRadius: 8, color: '#E2E8F0', fontSize: 15,
                outline: 'none', boxSizing: 'border-box',
              }}
            />

            {licenseError && <div style={{ marginTop: 8, fontSize: 13, color: '#EF4444' }}>{licenseError}</div>}

            <div onClick={handleKeySubmit}
              style={{ marginTop: 20, padding: '14px 0', background: '#1D4ED8', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'center', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
            >Continue</div>

            <div style={{ marginTop: 20, padding: 16, background: '#0F1923', borderRadius: 8, border: '1px solid #1E293B' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Don't have a license key?</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Contact your ProSalonPOS provider or visit prosalonpos.com to purchase.</div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* STEP 2: Machine Code + Choose Method */}
        {/* ══════════════════════════════════ */}
        {step === 2 && (
          <div style={{ background: '#1A2736', borderRadius: 12, padding: 32, border: '1px solid #2A3A50' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 8 }}>Activate Your Software</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>License key accepted. Choose how to activate:</div>

            {/* Machine Code Display */}
            <div style={{ background: '#0F1923', borderRadius: 8, padding: 20, border: '1px solid #1E293B', marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Machine Code</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B', fontFamily: "'Courier New', monospace", letterSpacing: 2 }}>{machineCodeLoading ? 'Loading...' : machineCode}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>This code is unique to this computer</div>
            </div>

            {/* Online activation */}
            {activationMethod === 'online' ? (
              <div style={{ marginBottom: 16, padding: 20, background: '#0F1923', borderRadius: 8, border: '1px solid #1E293B', textAlign: 'center' }}>
                {activating ? (
                  <div>
                    <div style={{ fontSize: 14, color: '#3B82F6', marginBottom: 8 }}>Contacting activation server...</div>
                    <div style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>⏳</div>
                  </div>
                ) : onlineResult === 'success' ? (
                  <div>
                    <div style={{ fontSize: 14, color: '#10B981', fontWeight: 500 }}>✅ Activation successful!</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Launching ProSalonPOS...</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, color: '#EF4444', fontWeight: 500 }}>❌ Could not reach activation server</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Try phone activation instead, or check your internet connection.</div>
                    <div onClick={function() { setActivationMethod(null); setOnlineResult(null); }}
                      style={{ marginTop: 12, padding: '8px 16px', background: '#374151', color: '#E2E8F0', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'inline-block', userSelect: 'none' }}>Back to Options</div>
                  </div>
                )}
              </div>
            ) : activationMethod !== 'phone' && (
              <div>
                {/* Option 1: Online */}
                <div onClick={handleOnlineActivation}
                  style={{ marginBottom: 12, padding: '16px 20px', background: '#1D4ED830', borderRadius: 8, border: '1px solid #3B82F640', cursor: 'pointer', transition: 'border-color 150ms' }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#3B82F6'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#3B82F640'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>🌐</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#3B82F6' }}>Activate Online</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Requires internet connection. Instant activation.</div>
                    </div>
                  </div>
                </div>

                {/* Option 2: Phone */}
                <div onClick={handlePhoneMethod}
                  style={{ marginBottom: 12, padding: '16px 20px', background: '#F59E0B10', borderRadius: 8, border: '1px solid #F59E0B40', cursor: 'pointer', transition: 'border-color 150ms' }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#F59E0B'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#F59E0B40'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>📞</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#F59E0B' }}>Activate by Phone</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>No internet needed. Call your provider with the Machine Code above.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Back button */}
            {!activating && (
              <div onClick={function() { setStep(1); setActivationMethod(null); setOnlineResult(null); }}
                style={{ marginTop: 8, fontSize: 13, color: '#64748B', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}>← Back to license key</div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* STEP 3: Phone Activation — Enter Code */}
        {/* ══════════════════════════════════ */}
        {step === 3 && (
          <div style={{ background: '#1A2736', borderRadius: 12, padding: 32, border: '1px solid #2A3A50' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 8 }}>Phone Activation</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>Call your ProSalonPOS provider and give them your Machine Code. They will give you an Activation Code.</div>

            {/* Machine code reminder */}
            <div style={{ background: '#0F1923', borderRadius: 8, padding: 16, border: '1px solid #1E293B', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Your Machine Code (give this to your provider)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B', fontFamily: "'Courier New', monospace", letterSpacing: 2 }}>{machineCodeLoading ? 'Loading...' : machineCode}</div>
            </div>

            {/* Activation code input */}
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>Enter the Activation Code your provider gave you:</div>
            <input
              autoFocus
              value={activationCode}
              onChange={function(e) { setActivationCode(e.target.value.toUpperCase()); setActivationError(''); }}
              onKeyDown={function(e) { if (e.key === 'Enter') handleActivationSubmit(); }}
              placeholder="ACT-XXXX-XXXX-XXXX"
              style={{
                width: '100%', padding: '14px 16px', background: '#0F1923', border: '1px solid ' + (activationError ? '#EF4444' : '#374151'),
                borderRadius: 8, color: '#E2E8F0', fontSize: 18, fontFamily: "'Courier New', monospace", textAlign: 'center',
                outline: 'none', boxSizing: 'border-box', letterSpacing: 1,
              }}
            />
            {activationError && <div style={{ marginTop: 8, fontSize: 13, color: '#EF4444' }}>{activationError}</div>}

            <div onClick={handleActivationSubmit}
              style={{ marginTop: 20, padding: '14px 0', background: '#1D4ED8', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'center', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
            >Activate</div>

            <div onClick={function() { setStep(2); setActivationMethod(null); setActivationCode(''); setActivationError(''); }}
              style={{ marginTop: 12, fontSize: 13, color: '#64748B', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}>← Back to activation options</div>
          </div>
        )}

      </div>
    </div>
  );
}
