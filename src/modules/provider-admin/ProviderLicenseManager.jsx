/**
 * ProviderLicenseManager.jsx — License Management for Provider Admin Panel
 * Session 64 — Offline Mode & Licensing System
 *
 * Features:
 *   - Create new license keys (owner only)
 *   - View all licenses with status, activations, salon info
 *   - Offline activation: enter Machine Code → generate Activation Code
 *   - View activation log per license
 *   - Reset activations (owner only)
 *
 * Three activation methods supported:
 *   1. Online (automatic — software phones home)
 *   2. Phone (zero internet — Machine Code → Activation Code over phone)
 *   3. Pre-activated (in-person deployment)
 *
 * License rules:
 *   - One-time purchase, no expiration
 *   - Locked to hardware fingerprint
 *   - 3 activations per key (configurable)
 *   - Activation Code is mathematically tied to Machine Code
 */
import React, { useState, useEffect } from 'react';
import { providerApi } from '../../lib/providerApiClient';

// ═══════════════════════════════════════
// MOCK LICENSE DATA
// ═══════════════════════════════════════
var MOCK_LICENSES = [
  {
    id: 'lic-1',
    license_key: 'PSP-2025-A7B3-X9K2',
    salon_name: 'Glamour Nails & Spa',
    salon_id: 'salon-1',
    hosting_type: 'cloud',       // cloud | self-hosted
    max_activations: 3,
    activations_used: 1,
    status: 'active',            // active | inactive | revoked
    created_at: '2025-06-15T10:00:00Z',
    activations: [
      { machine_code: 'PSP-M1K7-R4D2-W8N5', activation_code: 'ACT-F3J9-L2P6-Q7X1', activated_at: '2025-06-15T10:15:00Z', device_name: 'Front Desk PC' },
    ],
  },
  {
    id: 'lic-2',
    license_key: 'PSP-2025-C3D4-Y5Z6',
    salon_name: 'Bella Hair Studio',
    salon_id: 'salon-2',
    hosting_type: 'cloud',
    max_activations: 3,
    activations_used: 2,
    status: 'active',
    created_at: '2025-09-01T09:00:00Z',
    activations: [
      { machine_code: 'PSP-B2N8-T5K1-H9M3', activation_code: 'ACT-V7W4-Z6C2-D1R8', activated_at: '2025-09-01T09:30:00Z', device_name: 'Front Desk' },
      { machine_code: 'PSP-G4P6-J8F3-S2L7', activation_code: 'ACT-X5Q9-M1K4-N8B3', activated_at: '2025-09-05T14:00:00Z', device_name: 'Station 2' },
    ],
  },
  {
    id: 'lic-3',
    license_key: 'PSP-2026-E5F6-W7V8',
    salon_name: 'Zen Day Spa',
    salon_id: 'salon-3',
    hosting_type: 'self-hosted',
    max_activations: 3,
    activations_used: 1,
    status: 'active',
    created_at: '2026-03-01T09:00:00Z',
    activations: [
      { machine_code: 'PSP-K9L2-N4M7-P1R6', activation_code: 'ACT-T8S5-W3Q1-J6H2', activated_at: '2026-03-01T10:00:00Z', device_name: 'Primary Station' },
    ],
  },
  {
    id: 'lic-4',
    license_key: 'PSP-2025-G7H8-U9T0',
    salon_name: 'Classic Cuts Barbershop',
    salon_id: 'salon-4',
    hosting_type: 'self-hosted',
    max_activations: 3,
    activations_used: 3,
    status: 'active',
    created_at: '2025-04-20T08:00:00Z',
    activations: [
      { machine_code: 'PSP-A1B2-C3D4-E5F6', activation_code: 'ACT-G7H8-I9J0-K1L2', activated_at: '2025-04-20T08:30:00Z', device_name: 'Main PC' },
      { machine_code: 'PSP-M3N4-O5P6-Q7R8', activation_code: 'ACT-S9T0-U1V2-W3X4', activated_at: '2025-08-10T11:00:00Z', device_name: 'Replaced hard drive' },
      { machine_code: 'PSP-Y5Z6-A7B8-C9D0', activation_code: 'ACT-E1F2-G3H4-I5J6', activated_at: '2026-01-22T09:00:00Z', device_name: 'New PC after crash' },
    ],
  },
];

// ═══════════════════════════════════════
// MOCK: generate codes (placeholder — real crypto in Phase 2)
// ═══════════════════════════════════════
function generateLicenseKey() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function block() {
    var s = '';
    for (var i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  return 'PSP-' + new Date().getFullYear() + '-' + block() + '-' + block();
}

function generateActivationCode(machineCode) {
  // In production: cryptographic HMAC tied to machine code + license key
  // For mock: deterministic-looking but fake
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function block(seed) {
    var s = '';
    for (var i = 0; i < 4; i++) {
      var idx = (seed.charCodeAt(i % seed.length) * (i + 7)) % chars.length;
      s += chars[idx];
    }
    return s;
  }
  return 'ACT-' + block(machineCode.slice(4, 8)) + '-' + block(machineCode.slice(9, 13)) + '-' + block(machineCode.slice(14, 18));
}

// ═══════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════
export default function ProviderLicenseManager({ T, isOwner, addAudit, apiMode }) {
  var [licenses, setLicenses] = useState([]);
  var [licLoading, setLicLoading] = useState(false);
  var [selectedLicId, setSelectedLicId] = useState(null);
  var [showCreate, setShowCreate] = useState(false);
  var [createSalonName, setCreateSalonName] = useState('');
  var [createHostingType, setCreateHostingType] = useState('cloud');
  var [showActivate, setShowActivate] = useState(null); // license id
  var [machineCodeInput, setMachineCodeInput] = useState('');
  var [deviceNameInput, setDeviceNameInput] = useState('');
  var [generatedActCode, setGeneratedActCode] = useState('');
  var [confirmReset, setConfirmReset] = useState(null); // license id

  var selectedLic = selectedLicId ? licenses.find(function(l) { return l.id === selectedLicId; }) : null;

  // ── Load licenses on mount ──
  useEffect(function() {
    if (apiMode === 'live') {
      setLicLoading(true);
      providerApi.get('/licenses').then(function(data) {
        setLicenses(data.licenses || []);
        setLicLoading(false);
      }).catch(function(e) {
        console.error('Failed to load licenses:', e);
        setLicenses([]);
        setLicLoading(false);
      });
    } else {
      setLicenses(MOCK_LICENSES);
    }
  }, [apiMode]);

  // ── Create License ──
  async function handleCreate() {
    if (!createSalonName.trim()) return;
    if (apiMode === 'live') {
      try {
        var result = await providerApi.post('/licenses', { salon_name: createSalonName.trim(), hosting_type: createHostingType });
        setLicenses(function(prev) { return [result.license].concat(prev); });
      } catch (e) { console.error('Create license failed:', e); }
    } else {
      var newKey = generateLicenseKey();
      var newLic = { id: 'lic-' + Date.now(), license_key: newKey, salon_name: createSalonName.trim(), salon_id: null, hosting_type: createHostingType, max_activations: 3, activations_used: 0, status: 'active', created_at: new Date().toISOString(), activations: [] };
      setLicenses(function(prev) { return [newLic].concat(prev); });
      addAudit('license_created', 'Created license ' + newKey + ' for ' + createSalonName.trim());
    }
    setCreateSalonName('');
    setCreateHostingType('cloud');
    setShowCreate(false);
  }

  // ── Phone Activation ──
  async function handleGenerateActivation(licId) {
    if (!machineCodeInput.trim() || !deviceNameInput.trim()) return;
    if (apiMode === 'live') {
      try {
        var result = await providerApi.post('/licenses/' + licId + '/activate', { machine_code: machineCodeInput.trim(), device_name: deviceNameInput.trim() });
        setGeneratedActCode(result.activation_code);
        // Reload license to get updated activations
        var updated = await providerApi.get('/licenses/' + licId);
        setLicenses(function(prev) { return prev.map(function(l) { return l.id === licId ? updated.license : l; }); });
      } catch (e) { console.error('Activation failed:', e); }
    } else {
      var code = generateActivationCode(machineCodeInput.trim());
      setGeneratedActCode(code);
      setLicenses(function(prev) {
        return prev.map(function(l) {
          if (l.id !== licId) return l;
          return Object.assign({}, l, { activations_used: l.activations_used + 1, activations: l.activations.concat([{ machine_code: machineCodeInput.trim().toUpperCase(), activation_code: code, activated_at: new Date().toISOString(), device_name: deviceNameInput.trim() }]) });
        });
      });
      addAudit('license_activated', 'Offline activation for ' + licenses.find(function(l) { return l.id === licId; }).salon_name + ' (device: ' + deviceNameInput.trim() + ')');
    }
  }

  // ── Reset Activations ──
  async function handleReset(licId) {
    if (apiMode === 'live') {
      try {
        var result = await providerApi.post('/licenses/' + licId + '/reset', {});
        setLicenses(function(prev) { return prev.map(function(l) { return l.id === licId ? result.license : l; }); });
      } catch (e) { console.error('Reset failed:', e); }
    } else {
      setLicenses(function(prev) {
        return prev.map(function(l) {
          if (l.id !== licId) return l;
          return Object.assign({}, l, { activations_used: 0, activations: [] });
        });
      });
      addAudit('license_reset', 'Reset activations for ' + licenses.find(function(l) { return l.id === licId; }).salon_name);
    }
    setConfirmReset(null);
  }

  // ── Revoke / Reactivate ──
  async function toggleStatus(licId) {
    if (apiMode === 'live') {
      try {
        var result = await providerApi.put('/licenses/' + licId + '/revoke', {});
        setLicenses(function(prev) { return prev.map(function(l) { return l.id === licId ? result.license : l; }); });
      } catch (e) { console.error('Revoke failed:', e); }
    } else {
      setLicenses(function(prev) {
        return prev.map(function(l) {
          if (l.id !== licId) return l;
          var newStatus = l.status === 'revoked' ? 'active' : 'revoked';
          addAudit('license_' + newStatus, (newStatus === 'revoked' ? 'Revoked' : 'Reactivated') + ' license for ' + l.salon_name);
          return Object.assign({}, l, { status: newStatus });
        });
      });
    }
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // ═══════════════════════════════════════
  // LICENSE DETAIL VIEW
  // ═══════════════════════════════════════
  if (selectedLic) {
    var isMaxed = selectedLic.activations_used >= selectedLic.max_activations;
    var isRevoked = selectedLic.status === 'revoked';

    return (
      <div>
        {/* Back button */}
        <div onClick={function() { setSelectedLicId(null); setShowActivate(null); setMachineCodeInput(''); setDeviceNameInput(''); setGeneratedActCode(''); setConfirmReset(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: T.accent, marginBottom: 20, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.accent + '40', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.accentBg; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
        >← Back to Licenses</div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>{selectedLic.salon_name}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>License Detail</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOwner && (
              <div onClick={function() { toggleStatus(selectedLic.id); }}
                style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, userSelect: 'none',
                  background: isRevoked ? '#065F46' : '#7F1D1D', color: '#fff', border: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={function(e) { e.currentTarget.style.opacity = '1'; }}
              >{isRevoked ? 'Reactivate License' : 'Revoke License'}</div>
            )}
          </div>
        </div>

        {/* Info cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'License Key', value: selectedLic.license_key, color: T.accent },
            { label: 'Status', value: selectedLic.status.charAt(0).toUpperCase() + selectedLic.status.slice(1), color: selectedLic.status === 'active' ? '#10B981' : selectedLic.status === 'revoked' ? '#EF4444' : '#94A3B8' },
            { label: 'Hosting', value: selectedLic.hosting_type === 'cloud' ? '☁️ Cloud' : '🏠 Self-Hosted', color: selectedLic.hosting_type === 'cloud' ? '#3B82F6' : '#F59E0B' },
            { label: 'Activations', value: selectedLic.activations_used + ' of ' + selectedLic.max_activations, color: isMaxed ? '#EF4444' : '#10B981' },
          ].map(function(card, i) {
            return (
              <div key={i} style={{ background: '#1A2736', borderRadius: 8, padding: 16, border: '1px solid #2A3A50' }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: card.color, fontFamily: card.label === 'License Key' ? "'Courier New', monospace" : 'inherit' }}>{card.value}</div>
              </div>
            );
          })}
        </div>

        {/* Date info */}
        <div style={{ background: '#1A2736', borderRadius: 8, padding: 16, border: '1px solid #2A3A50', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <span style={{ fontSize: 12, color: T.textMuted }}>Created: </span>
              <span style={{ fontSize: 13, color: T.text }}>{fmtDate(selectedLic.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Offline Activation Panel */}
        {!isRevoked && (
          <div style={{ background: '#1A2736', borderRadius: 8, padding: 20, border: '1px solid #2A3A50', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>📞 Phone Activation (Offline)</div>
              {isMaxed && <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 500 }}>All activations used — reset required</div>}
            </div>

            {isMaxed && !confirmReset ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                This license has used all {selectedLic.max_activations} activations. 
                {isOwner && (
                  <span onClick={function() { setConfirmReset(selectedLic.id); }}
                    style={{ color: '#F59E0B', cursor: 'pointer', marginLeft: 8, textDecoration: 'underline' }}>Reset activations</span>
                )}
              </div>
            ) : confirmReset === selectedLic.id ? (
              <div style={{ background: '#7F1D1D20', padding: 16, borderRadius: 8, border: '1px solid #EF444440' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#EF4444', marginBottom: 12 }}>⚠️ Confirm Reset</div>
                <div style={{ fontSize: 13, color: T.text, marginBottom: 16 }}>This will erase all activation records and reset the count to 0. The customer will need to re-activate their software. Are you sure?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={function() { handleReset(selectedLic.id); }}
                    style={{ padding: '8px 20px', background: '#EF4444', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, userSelect: 'none' }}>Yes, Reset</div>
                  <div onClick={function() { setConfirmReset(null); }}
                    style={{ padding: '8px 20px', background: '#374151', color: T.text, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, userSelect: 'none' }}>Cancel</div>
                </div>
              </div>
            ) : generatedActCode && showActivate === selectedLic.id ? (
              <div>
                <div style={{ background: '#065F4620', padding: 20, borderRadius: 8, border: '1px solid #10B98140', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#10B981', marginBottom: 8, fontWeight: 500 }}>✅ Activation Code Generated</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Read this code to the customer:</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981', fontFamily: "'Courier New', monospace", letterSpacing: 2, margin: '12px 0' }}>{generatedActCode}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>Machine Code: <span style={{ fontFamily: "'Courier New', monospace", color: T.text }}>{machineCodeInput}</span></div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Device: <span style={{ color: T.text }}>{deviceNameInput}</span></div>
                </div>
                <div onClick={function() { setShowActivate(null); setMachineCodeInput(''); setDeviceNameInput(''); setGeneratedActCode(''); }}
                  style={{ marginTop: 12, padding: '8px 16px', background: '#374151', color: T.text, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'center', userSelect: 'none' }}>Done</div>
              </div>
            ) : showActivate === selectedLic.id ? (
              <div>
                <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
                  Ask the customer for their Machine Code (shown on their screen) and a name for this device.
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Machine Code</div>
                    <input
                      value={machineCodeInput}
                      onChange={function(e) { setMachineCodeInput(e.target.value.toUpperCase()); }}
                      placeholder="PSP-XXXX-XXXX-XXXX"
                      style={{ width: '100%', padding: '10px 12px', background: '#0F1923', border: '1px solid #374151', borderRadius: 6, color: T.text, fontSize: 14, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Device Name</div>
                    <input
                      value={deviceNameInput}
                      onChange={function(e) { setDeviceNameInput(e.target.value); }}
                      placeholder="e.g. Front Desk PC"
                      style={{ width: '100%', padding: '10px 12px', background: '#0F1923', border: '1px solid #374151', borderRadius: 6, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={function() { handleGenerateActivation(selectedLic.id); }}
                    style={{ padding: '10px 24px', background: machineCodeInput.trim() && deviceNameInput.trim() ? '#1D4ED8' : '#374151',
                      color: machineCodeInput.trim() && deviceNameInput.trim() ? '#fff' : '#64748B',
                      borderRadius: 6, cursor: machineCodeInput.trim() && deviceNameInput.trim() ? 'pointer' : 'default',
                      fontSize: 13, fontWeight: 600, userSelect: 'none' }}>Generate Activation Code</div>
                  <div onClick={function() { setShowActivate(null); setMachineCodeInput(''); setDeviceNameInput(''); }}
                    style={{ padding: '10px 16px', background: '#374151', color: T.text, borderRadius: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>Cancel</div>
                </div>
              </div>
            ) : (
              <div onClick={function() { setShowActivate(selectedLic.id); }}
                style={{ padding: '10px 20px', background: '#1D4ED8', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'center', userSelect: 'none', maxWidth: 220 }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
              >Start Phone Activation</div>
            )}
          </div>
        )}

        {/* Activation History */}
        <div style={{ background: '#1A2736', borderRadius: 8, padding: 20, border: '1px solid #2A3A50' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16 }}>Activation History</div>

          {selectedLic.activations.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: 20 }}>No activations yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedLic.activations.map(function(act, idx) {
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 140px', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#0F1923', borderRadius: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D4ED830', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: T.accent }}>#{idx + 1}</div>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Machine Code</div>
                      <div style={{ fontSize: 13, fontFamily: "'Courier New', monospace", color: T.text }}>{act.machine_code}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Device</div>
                      <div style={{ fontSize: 13, color: T.text }}>{act.device_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Date</div>
                      <div style={{ fontSize: 12, color: T.text }}>{fmtDateTime(act.activated_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reset button at bottom */}
        {isOwner && selectedLic.activations_used > 0 && !confirmReset && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <span onClick={function() { setConfirmReset(selectedLic.id); }}
              style={{ fontSize: 13, color: '#F59E0B', cursor: 'pointer', userSelect: 'none' }}>Reset Activations ({selectedLic.activations_used} of {selectedLic.max_activations} used)</span>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // LICENSE LIST VIEW
  // ═══════════════════════════════════════
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>License Management</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>{licenses.length} license{licenses.length !== 1 ? 's' : ''} total</div>
        </div>
        {isOwner && !showCreate && (
          <div onClick={function() { setShowCreate(true); }}
            style={{ padding: '8px 20px', background: '#1D4ED8', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
          >+ Create License</div>
        )}
      </div>

      {/* Create License Form */}
      {showCreate && (
        <div style={{ background: '#1A2736', borderRadius: 8, padding: 20, border: '1px solid #3B82F640', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Create New License</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Salon Name</div>
              <input
                autoFocus
                value={createSalonName}
                onChange={function(e) { setCreateSalonName(e.target.value); }}
                placeholder="Enter salon name"
                style={{ width: '100%', padding: '10px 12px', background: '#0F1923', border: '1px solid #374151', borderRadius: 6, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: 180 }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Hosting Type</div>
              <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #374151' }}>
                {['cloud', 'self-hosted'].map(function(ht) {
                  var active = createHostingType === ht;
                  return (
                    <div key={ht} onClick={function() { setCreateHostingType(ht); }}
                      style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                        background: active ? '#1D4ED8' : '#0F1923', color: active ? '#fff' : T.textMuted }}>
                      {ht === 'cloud' ? '☁️ Cloud' : '🏠 Local'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={handleCreate}
              style={{ padding: '10px 24px', background: createSalonName.trim() ? '#1D4ED8' : '#374151', color: createSalonName.trim() ? '#fff' : '#64748B',
                borderRadius: 6, cursor: createSalonName.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, userSelect: 'none' }}>Create License Key</div>
            <div onClick={function() { setShowCreate(false); setCreateSalonName(''); }}
              style={{ padding: '10px 16px', background: '#374151', color: T.text, borderRadius: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>Cancel</div>
          </div>
        </div>
      )}

      {/* License List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {licenses.map(function(lic) {
          var isMaxed = lic.activations_used >= lic.max_activations;
          return (
            <div key={lic.id} onClick={function() { setSelectedLicId(lic.id); }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 100px 100px', gap: 12, alignItems: 'center',
                padding: '14px 20px', background: '#1A2736', borderRadius: 8, border: '1px solid #2A3A50', cursor: 'pointer', transition: 'border-color 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = T.accent + '60'; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#2A3A50'; }}
            >
              {/* Salon + key */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{lic.salon_name}</div>
                <div style={{ fontSize: 12, fontFamily: "'Courier New', monospace", color: T.textMuted, marginTop: 2 }}>{lic.license_key}</div>
              </div>
              {/* Hosting */}
              <div style={{ fontSize: 12, color: lic.hosting_type === 'cloud' ? '#3B82F6' : '#F59E0B' }}>
                {lic.hosting_type === 'cloud' ? '☁️ Cloud' : '🏠 Self-Hosted'}
              </div>
              {/* Activations */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: isMaxed ? '#EF4444' : '#10B981' }}>
                  {lic.activations_used} / {lic.max_activations}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>activations</div>
              </div>
              {/* Status */}
              <div>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                  background: lic.status === 'active' ? '#065F4630' : lic.status === 'revoked' ? '#7F1D1D30' : '#37415130',
                  color: lic.status === 'active' ? '#10B981' : lic.status === 'revoked' ? '#EF4444' : '#94A3B8',
                }}>{lic.status.charAt(0).toUpperCase() + lic.status.slice(1)}</span>
              </div>
              {/* Date */}
              <div style={{ fontSize: 12, color: T.textMuted }}>{fmtDate(lic.created_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
