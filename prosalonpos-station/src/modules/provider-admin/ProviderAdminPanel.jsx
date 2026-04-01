/**
 * ProviderAdminPanel.jsx — Provider Admin Panel (Micro-frontend #5)
 * Session 65 — WIRED to real backend API
 *
 * Session 54 split: salon detail → ProviderSalonDetail.jsx,
 *   agent detail → ProviderAgentDetail.jsx,
 *   shared components → ProviderShared.jsx
 *
 * Three access levels:
 *   1. Provider Owner (ISO) — full access to everything
 *   2. Sales Agent — salon management + create salons + notes + feature toggles
 *   3. Support Agent — salon management + notes + feature toggles (no create)
 *
 * DATA FLOW (Session 65):
 *   - On login: calls POST /provider/auth/login → gets JWT + user
 *   - After login: fetches salons, agents, billing, audit from API
 *   - All creates/edits/deletes call the API first, then update local state
 *   - If backend is offline: falls back to mock data (same as before)
 *   - A small "Live" or "Mock" badge shows which mode is active
 */
import { useTheme } from '../../lib/ThemeContext';
import React, { useState, useCallback } from 'react';
import {
  PROVIDER_OWNER, MOCK_AGENTS, MOCK_PROVIDER_SALONS, PLAN_TIERS,
  MOCK_BILLING_RECORDS, MOCK_AUDIT_LOG, MOCK_SALON_NOTES,
} from '../../lib/providerMockData';
import { formatDate, formatDateTime, cents, STATUS_COLORS } from './ProviderShared';
import ProviderSalonDetail from './ProviderSalonDetail';
import ProviderAgentDetail from './ProviderAgentDetail';
import ProviderLicenseManager from './ProviderLicenseManager';
import { providerApi, providerLogin, providerLogout, checkProviderBackend } from '../../lib/providerApiClient';

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function ProviderAdminPanel({ onBack }) {
  var T = useTheme();

  // ── State ──
  var [user, setUser] = useState(null);
  var [pinInput, setPinInput] = useState('');
  var [pinError, setPinError] = useState('');
  var [section, setSection] = useState('salons');
  var [selectedSalonId, setSelectedSalonId] = useState(null);
  var [selectedAgentId, setSelectedAgentId] = useState(null);
  var [loading, setLoading] = useState(false);
  var [apiMode, setApiMode] = useState(null); // 'live' or 'mock'

  // ── Data state ──
  var [salons, setSalons] = useState([]);
  var [agents, setAgents] = useState([]);
  var [auditLog, setAuditLog] = useState([]);
  var [salonNotes, setSalonNotes] = useState([]);
  var [billingRecords, setBillingRecords] = useState([]);

  // ── Salon detail edit state ──
  var [noteInput, setNoteInput] = useState('');
  var [editName, setEditName] = useState('');
  var [editOwnerName, setEditOwnerName] = useState('');
  var [editOwnerPhone, setEditOwnerPhone] = useState('');
  var [editOwnerEmail, setEditOwnerEmail] = useState('');
  var [editAddress, setEditAddress] = useState('');
  var [editStatus, setEditStatus] = useState('');
  var [editPlan, setEditPlan] = useState('');
  var [editStations, setEditStations] = useState(1);
  var [editRate, setEditRate] = useState(2.49);
  var [editing, setEditing] = useState(false);

  // ── Agent detail edit state ──
  var [editAgName, setEditAgName] = useState('');
  var [editAgEmail, setEditAgEmail] = useState('');
  var [editAgPin, setEditAgPin] = useState('');
  var [editAgRole, setEditAgRole] = useState('support');
  var [editAgVis, setEditAgVis] = useState('assigned');
  var [editAgActive, setEditAgActive] = useState(true);
  var [editingAgent, setEditingAgent] = useState(false);

  // ── Derived ──
  var isOwner = user && user.role === 'owner';
  var visibleSalons = !user ? [] : (
    isOwner || user.visibility === 'all'
      ? salons
      : salons.filter(function(s) { return (user.assigned_salon_ids || []).indexOf(s.id) !== -1; })
  );
  var selectedSalon = salons.find(function(s) { return s.id === selectedSalonId; });

  // ═══════════════════════════════════════
  // LOAD ALL DATA after login
  // ═══════════════════════════════════════
  var loadAllData = useCallback(async function(mode) {
    if (mode === 'mock') {
      setSalons(MOCK_PROVIDER_SALONS);
      setAgents(MOCK_AGENTS);
      setAuditLog(MOCK_AUDIT_LOG);
      setSalonNotes(MOCK_SALON_NOTES);
      setBillingRecords(MOCK_BILLING_RECORDS);
      return;
    }
    setLoading(true);
    try {
      var sd = await providerApi.get('/salons');
      setSalons(sd.salons || []);
    } catch (e) { setSalons([]); }
    try {
      var ad = await providerApi.get('/agents');
      setAgents(ad.agents || []);
    } catch (e) { setAgents([]); }
    try {
      var aud = await providerApi.get('/audit');
      setAuditLog((aud.entries || []).map(function(e) {
        return Object.assign({}, e, { timestamp: e.created_at });
      }));
    } catch (e) { setAuditLog([]); }
    try {
      var bd = await providerApi.get('/billing');
      setBillingRecords(bd.records || []);
    } catch (e) { setBillingRecords([]); }
    setSalonNotes([]);
    setLoading(false);
  }, []);

  // ═══════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════
  async function tryLogin(pin) {
    if (pin.length < 2) return;
    var backendUp = await checkProviderBackend();
    if (backendUp) {
      try {
        var result = await providerLogin(pin);
        setUser(result.user); setApiMode('live');
        setPinInput(''); setPinError('');
        loadAllData('live');
      } catch (e) {
        setPinError(e.message || 'Invalid PIN'); setPinInput('');
      }
    } else {
      // Mock fallback
      if (PROVIDER_OWNER.pin === pin) {
        setUser(PROVIDER_OWNER); setApiMode('mock');
        setPinInput(''); setPinError(''); loadAllData('mock'); return;
      }
      var match = MOCK_AGENTS.find(function(a) { return a.pin === pin && a.active; });
      if (match) {
        setUser(match); setApiMode('mock');
        setPinInput(''); setPinError(''); loadAllData('mock'); return;
      }
      setPinError('Invalid PIN'); setPinInput('');
    }
  }

  // ═══════════════════════════════════════
  // AUDIT HELPER (local — API creates its own audit entries)
  // ═══════════════════════════════════════
  function addAudit(action, detail, salonId) {
    var entry = { id: 'audit-' + Date.now(), actor_id: user.id, actor_name: user.name, action: action, detail: detail, salon_id: salonId || null, timestamp: new Date().toISOString() };
    setAuditLog(function(prev) { return [entry].concat(prev); });
  }

  // ═══════════════════════════════════════
  // API WRAPPERS — called by child components
  // ═══════════════════════════════════════
  async function saveSalonToApi(salonId, updates) {
    if (apiMode !== 'live') return;
    try {
      var r = await providerApi.put('/salons/' + salonId, updates);
      setSalons(function(prev) { return prev.map(function(s) { return s.id === salonId ? r.salon : s; }); });
    } catch (e) { console.error('Save salon failed:', e); }
  }

  async function toggleFeatureApi(salonId, newFeatures) {
    if (apiMode !== 'live') return;
    try {
      var r = await providerApi.put('/salons/' + salonId + '/features', { features_enabled: newFeatures });
      setSalons(function(prev) { return prev.map(function(s) { return s.id === salonId ? r.salon : s; }); });
    } catch (e) { console.error('Toggle feature failed:', e); }
  }

  async function createSalonApi(data) {
    if (apiMode !== 'live') return null;
    try {
      var r = await providerApi.post('/salons', data);
      setSalons(function(prev) { return prev.concat([r.salon]); });
      return r.salon;
    } catch (e) { console.error('Create salon failed:', e); return null; }
  }

  async function addNoteApi(salonId, content) {
    if (apiMode !== 'live') return null;
    try {
      var r = await providerApi.post('/salons/' + salonId + '/notes', { content: content });
      return r.note;
    } catch (e) { console.error('Add note failed:', e); return null; }
  }

  async function loadSalonNotes(salonId) {
    if (apiMode !== 'live') return;
    try {
      var r = await providerApi.get('/salons/' + salonId + '/notes');
      setSalonNotes(function(prev) {
        var rest = prev.filter(function(n) { return n.salon_id !== salonId; });
        return rest.concat(r.notes || []);
      });
    } catch (e) { console.error('Load notes failed:', e); }
  }

  async function createAgentApi(data) {
    if (apiMode !== 'live') return null;
    try {
      var r = await providerApi.post('/agents', data);
      setAgents(function(prev) { return prev.concat([r.agent]); });
      return r.agent;
    } catch (e) { console.error('Create agent failed:', e); return null; }
  }

  async function saveAgentApi(agentId, updates) {
    if (apiMode !== 'live') return;
    try {
      var r = await providerApi.put('/agents/' + agentId, updates);
      setAgents(function(prev) { return prev.map(function(a) { return a.id === agentId ? r.agent : a; }); });
    } catch (e) { console.error('Save agent failed:', e); }
  }

  // ═══════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════
  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: '#0F1923', fontFamily: "'Inter',system-ui,sans-serif", color: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', width: 320 }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#fff' }}>Pro Salon POS</div>
          <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 32 }}>Provider Admin Panel</div>
          <div style={{ background: '#1A2736', borderRadius: 12, padding: 24, border: '1px solid #2A3A50' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: '#CBD5E1' }}>Enter your PIN</div>
            <input autoFocus value={pinInput}
              onChange={function(e) {
                var val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setPinInput(val); setPinError('');
                if (val.length >= 2) setTimeout(function() { tryLogin(val); }, 100);
              }}
              onKeyDown={function(e) { if (e.key === 'Enter') tryLogin(pinInput); }}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
              inputMode="numeric"
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, minHeight: 48 }}>
              {pinInput.length === 0
                ? [0,1,2,3].map(function(i) {
                    return <div key={i} style={{ width: 40, height: 48, borderRadius: 8, background: '#0F1923', border: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}></div>;
                  })
                : pinInput.split('').map(function(_, i) {
                    return <div key={i} style={{ width: 40, height: 48, borderRadius: 8, background: '#0F1923', border: '1px solid #3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>●</div>;
                  })
              }
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[7,8,9,4,5,6,1,2,3].map(function(n) {
                return <div key={n} onClick={function() { if (pinInput.length < 8) { var next = pinInput + n; setPinInput(next); setPinError(''); if (next.length >= 2) setTimeout(function() { tryLogin(next); }, 100); } }}
                  style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#253347', borderRadius: 8, fontSize: 18, fontWeight: 500, cursor: 'pointer', color: '#E2E8F0', userSelect: 'none' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#2E4058'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#253347'; }}
                >{n}</div>;
              })}
              <div onClick={function() { setPinInput(''); setPinError(''); }}
                style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#253347', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#F59E0B', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#2E4058'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#253347'; }}
              >Clear</div>
              <div onClick={function() { if (pinInput.length < 8) { var next = pinInput + '0'; setPinInput(next); setPinError(''); if (next.length >= 2) setTimeout(function() { tryLogin(next); }, 100); } }}
                style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#253347', borderRadius: 8, fontSize: 18, fontWeight: 500, cursor: 'pointer', color: '#E2E8F0', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#2E4058'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#253347'; }}
              >0</div>
              <div onClick={function() { tryLogin(pinInput); }}
                style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1D4ED8', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
              >Enter</div>
            </div>
            {pinError && <div style={{ marginTop: 12, fontSize: 13, color: '#EF4444' }}>{pinError}</div>}
          </div>
          {onBack && <div onClick={onBack} style={{ marginTop: 20, fontSize: 13, color: '#64748B', cursor: 'pointer' }}>← Back to Staff View</div>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // SIDEBAR SECTIONS
  // ═══════════════════════════════════════
  var SECTIONS = [
    { id: 'salons',   label: 'Salon Management',  icon: '💈', show: true },
    { id: 'licenses', label: 'License Management', icon: '🔑', show: isOwner },
    { id: 'agents',   label: 'Agent Management',   icon: '👥', show: isOwner },
    { id: 'billing',  label: 'Billing',             icon: '💳', show: isOwner },
    { id: 'audit',    label: 'Audit Log',            icon: '📋', show: true },
  ].filter(function(s) { return s.show; });

  // ═══════════════════════════════════════
  // SECTION: SALON LIST
  // ═══════════════════════════════════════
  function renderSalonList() {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>
            Salon Management
            {apiMode && <span style={{ fontSize: 11, marginLeft: 10, padding: '2px 8px', borderRadius: 4, background: apiMode === 'live' ? '#10B98130' : '#F59E0B30', color: apiMode === 'live' ? '#10B981' : '#F59E0B' }}>{apiMode === 'live' ? '● Live' : '● Mock'}</span>}
          </div>
          {(isOwner || user.role === 'sales') && (
            <div onClick={async function() {
              if (apiMode === 'live') {
                var s = await createSalonApi({ name: 'New Salon', plan_tier: 'basic', status: 'trial', station_count: 1, processing_rate: 2.49 });
                if (s) {
                  setSelectedSalonId(s.id); setEditing(true); setNoteInput('');
                  setEditName(s.name); setEditOwnerName(s.owner_name || ''); setEditOwnerPhone(s.owner_phone || '');
                  setEditOwnerEmail(s.owner_email || ''); setEditAddress(s.address1 || '');
                  setEditStatus(s.status); setEditPlan(s.plan_tier); setEditStations(s.station_count); setEditRate(s.processing_rate);
                }
              } else {
                var m = { id: 'salon-' + Date.now(), name: 'New Salon', owner_name: '', owner_phone: '', owner_email: '', address: '', status: 'trial', plan_tier: 'basic', station_count: 1, license_key: 'NEW-' + Date.now().toString(36).toUpperCase(), salon_code: 'NEW' + Date.now().toString(36).toUpperCase().slice(-4), processing_rate: 2.49, monthly_software_fee_cents: 7900, signup_date: new Date().toISOString(), trial_end_date: new Date(Date.now() + 30 * 86400000).toISOString(), assigned_agent_id: isOwner ? null : user.id, features_enabled: PLAN_TIERS.basic.includes.slice() };
                setSalons(function(prev) { return prev.concat([m]); });
                addAudit('salon_created', 'Created salon account: New Salon', m.id);
                setSelectedSalonId(m.id); setEditing(true); setNoteInput(''); setEditName('New Salon'); setEditOwnerName(''); setEditOwnerPhone(''); setEditOwnerEmail(''); setEditAddress(''); setEditStatus('trial'); setEditPlan('basic'); setEditStations(1); setEditRate(2.49);
              }
            }}
              style={{ padding: '10px 20px', background: '#10B981', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#059669'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#10B981'; }}
            >+ New Salon</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {['active', 'trial', 'suspended', 'cancelled'].map(function(st) {
            var count = visibleSalons.filter(function(s) { return s.status === st; }).length;
            return <div key={st} style={{ padding: '8px 16px', background: T.surface, borderRadius: 8, border: '1px solid ' + T.borderLight, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: STATUS_COLORS[st] }}>{count}</div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'capitalize' }}>{st}</div>
            </div>;
          })}
        </div>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>Loading...</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleSalons.map(function(salon) {
            var agent = agents.find(function(a) { return a.id === salon.assigned_agent_id; });
            return (
              <div key={salon.id} onClick={function() {
                setSelectedSalonId(salon.id); setEditing(false); setNoteInput('');
                setEditName(salon.name); setEditOwnerName(salon.owner_name || ''); setEditOwnerPhone(salon.owner_phone || '');
                setEditOwnerEmail(salon.owner_email || ''); setEditAddress(salon.address || salon.address1 || '');
                setEditStatus(salon.status); setEditPlan(salon.plan_tier); setEditStations(salon.station_count); setEditRate(salon.processing_rate);
                if (apiMode === 'live') loadSalonNotes(salon.id);
              }}
                style={{ padding: '14px 18px', background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 150ms' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#3B82F6'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = T.borderLight; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{salon.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{salon.owner_name || 'No owner'} · {salon.station_count} station{salon.station_count > 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {agent && <div style={{ fontSize: 11, color: T.textMuted, background: T.chrome, padding: '3px 8px', borderRadius: 4 }}>{agent.name}</div>}
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: STATUS_COLORS[salon.status], padding: '3px 10px', borderRadius: 10, textTransform: 'capitalize' }}>{salon.status}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: PLAN_TIERS[salon.plan_tier] ? PLAN_TIERS[salon.plan_tier].color : '#999', background: T.chrome, padding: '3px 10px', borderRadius: 10, textTransform: 'capitalize' }}>{salon.plan_tier}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // SECTION: AGENT LIST
  // ═══════════════════════════════════════
  function renderAgentList() {
    if (selectedAgentId) {
      return <ProviderAgentDetail
        T={T} salons={salons} agents={agents}
        selectedAgentId={selectedAgentId} setAgents={setAgents}
        setSelectedAgentId={setSelectedAgentId} setSelectedSalonId={setSelectedSalonId}
        setSection={setSection} addAudit={addAudit}
        editingAgent={editingAgent} setEditingAgent={setEditingAgent}
        editAgName={editAgName} setEditAgName={setEditAgName}
        editAgEmail={editAgEmail} setEditAgEmail={setEditAgEmail}
        editAgPin={editAgPin} setEditAgPin={setEditAgPin}
        editAgRole={editAgRole} setEditAgRole={setEditAgRole}
        editAgVis={editAgVis} setEditAgVis={setEditAgVis}
        editAgActive={editAgActive} setEditAgActive={setEditAgActive}
        setEditing={setEditing} setNoteInput={setNoteInput}
        setEditName={setEditName} setEditOwnerName={setEditOwnerName}
        setEditOwnerPhone={setEditOwnerPhone} setEditOwnerEmail={setEditOwnerEmail}
        setEditAddress={setEditAddress} setEditStatus={setEditStatus}
        setEditPlan={setEditPlan} setEditStations={setEditStations} setEditRate={setEditRate}
        apiMode={apiMode} saveAgentApi={saveAgentApi} loadSalonNotes={loadSalonNotes}
      />;
    }
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>Agent Management</div>
          <div onClick={async function() {
            if (apiMode === 'live') {
              var pin = String(Math.floor(1000 + Math.random() * 9000));
              var a = await createAgentApi({ name: 'New Agent', role: 'support', visibility: 'assigned', pin: pin });
              if (a) { setSelectedAgentId(a.id); setEditingAgent(true); setEditAgName(a.name); setEditAgEmail(a.email || ''); setEditAgPin(pin); setEditAgRole(a.role); setEditAgVis(a.visibility); setEditAgActive(a.active); }
            } else {
              var m = { id: 'agent-' + Date.now(), name: 'New Agent', email: '', pin: String(Math.floor(1000 + Math.random() * 9000)), role: 'support', visibility: 'assigned', assigned_salon_ids: [], active: true, created_at: new Date().toISOString() };
              setAgents(function(prev) { return prev.concat([m]); }); addAudit('agent_created', 'Created agent: New Agent (Support)', null);
              setSelectedAgentId(m.id); setEditingAgent(true); setEditAgName('New Agent'); setEditAgEmail(''); setEditAgPin(m.pin); setEditAgRole('support'); setEditAgVis('assigned'); setEditAgActive(true);
            }
          }}
            style={{ padding: '10px 20px', background: '#10B981', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#059669'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = '#10B981'; }}
          >+ New Agent</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agents.map(function(agent) {
            var assignedCount = salons.filter(function(s) { return s.assigned_agent_id === agent.id; }).length;
            return (
              <div key={agent.id} onClick={function() { setSelectedAgentId(agent.id); setEditingAgent(false); setEditAgName(agent.name); setEditAgEmail(agent.email || ''); setEditAgPin(agent.pin || '****'); setEditAgRole(agent.role); setEditAgVis(agent.visibility); setEditAgActive(agent.active); }}
                style={{ padding: '14px 18px', background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 150ms' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#3B82F6'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = T.borderLight; }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{agent.email || 'No email'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{assignedCount} salon{assignedCount !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: agent.role === 'sales' ? '#8B5CF6' : '#3B82F6', padding: '3px 10px', borderRadius: 10, textTransform: 'capitalize' }}>{agent.role}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: agent.visibility === 'all' ? '#10B981' : '#F59E0B', background: T.chrome, padding: '3px 10px', borderRadius: 10 }}>{agent.visibility === 'all' ? 'All Salons' : 'Assigned Only'}</div>
                  <div style={{ fontSize: 11, color: agent.active ? '#10B981' : '#EF4444', fontWeight: 600 }}>{agent.active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // SECTION: BILLING
  // ═══════════════════════════════════════
  function renderBilling() {
    var totalMonthly = salons.filter(function(s) { return s.status === 'active'; }).reduce(function(sum, s) { return sum + (s.monthly_software_fee_cents || 0); }, 0);
    var overdue = billingRecords.filter(function(b) { return b.status === 'overdue'; });
    var overdueTotal = overdue.reduce(function(sum, b) { return sum + b.amount_cents; }, 0);
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 20 }}>Billing Overview</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#10B981' }}>{cents(totalMonthly)}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Monthly Recurring</div>
          </div>
          <div style={{ padding: '16px 20px', background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: overdue.length > 0 ? '#EF4444' : T.text }}>{cents(overdueTotal)}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Overdue</div>
          </div>
          <div style={{ padding: '16px 20px', background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: T.text }}>{salons.filter(function(s) { return s.status === 'active'; }).length}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Active Salons</div>
          </div>
        </div>
        <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Salon Billing Details</div>
          {salons.map(function(s) {
            var salonBills = billingRecords.filter(function(b) { return b.salon_id === s.id; });
            return (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid ' + T.borderLight }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{s.processing_rate}% rate</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{cents(s.monthly_software_fee_cents || 0)}/mo</div>
                  </div>
                </div>
                {salonBills.map(function(b) {
                  var col = b.status === 'paid' ? '#10B981' : (b.status === 'overdue' ? '#EF4444' : '#3B82F6');
                  return <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 16px', fontSize: 12 }}>
                    <div style={{ color: T.textMuted }}>{formatDate(b.date)}</div>
                    <div>{cents(b.amount_cents)}</div>
                    <div style={{ color: col, fontWeight: 600, textTransform: 'capitalize', minWidth: 60, textAlign: 'right' }}>{b.status}</div>
                  </div>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // SECTION: AUDIT LOG
  // ═══════════════════════════════════════
  function renderAuditLog() {
    var logs = isOwner ? auditLog : auditLog.filter(function(l) { return l.actor_id === user.id; });
    var actionIcons = { feature_toggled: '🔧', note_added: '📝', salon_created: '🏪', salon_updated: '✏️', salon_suspended: '⚠️', agent_created: '👤', agent_updated: '👤' };
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 20 }}>Audit Log{!isOwner && <span style={{ fontSize: 13, color: T.textMuted, marginLeft: 8 }}>(your actions)</span>}</div>
        <div style={{ background: T.surface, borderRadius: 10, border: '1px solid ' + T.borderLight, overflow: 'hidden' }}>
          {logs.map(function(entry) {
            var salon = salons.find(function(s) { return s.id === entry.salon_id; });
            return (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px', borderBottom: '1px solid ' + T.borderLight }}>
                <div style={{ fontSize: 18, marginTop: 2 }}>{actionIcons[entry.action] || '📋'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{entry.detail}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{entry.actor_name}{salon ? ' · ' + salon.name : ''} · {formatDateTime(entry.timestamp || entry.created_at)}</div>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && <div style={{ padding: 20, fontSize: 13, color: T.textMuted, textAlign: 'center' }}>No audit entries</div>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // SECTION ROUTER
  // ═══════════════════════════════════════
  function renderContent() {
    if (section === 'salons') {
      if (selectedSalonId) {
        return <ProviderSalonDetail
          T={T} isOwner={isOwner} user={user} salon={selectedSalon}
          agents={agents} salonNotes={salonNotes} billingRecords={billingRecords}
          selectedSalonId={selectedSalonId} setSalons={setSalons} setSalonNotes={setSalonNotes}
          setSelectedSalonId={setSelectedSalonId} addAudit={addAudit}
          editing={editing} setEditing={setEditing} noteInput={noteInput} setNoteInput={setNoteInput}
          editName={editName} setEditName={setEditName} editOwnerName={editOwnerName} setEditOwnerName={setEditOwnerName}
          editOwnerPhone={editOwnerPhone} setEditOwnerPhone={setEditOwnerPhone} editOwnerEmail={editOwnerEmail} setEditOwnerEmail={setEditOwnerEmail}
          editAddress={editAddress} setEditAddress={setEditAddress} editStatus={editStatus} setEditStatus={setEditStatus}
          editPlan={editPlan} setEditPlan={setEditPlan} editStations={editStations} setEditStations={setEditStations}
          editRate={editRate} setEditRate={setEditRate} setAgents={setAgents}
          apiMode={apiMode} saveSalonToApi={saveSalonToApi} toggleFeatureApi={toggleFeatureApi} addNoteApi={addNoteApi}
        />;
      }
      return renderSalonList();
    }
    if (section === 'licenses' && isOwner) return <ProviderLicenseManager T={T} isOwner={isOwner} addAudit={addAudit} apiMode={apiMode} />;
    if (section === 'agents' && isOwner) return renderAgentList();
    if (section === 'billing' && isOwner) return renderBilling();
    if (section === 'audit') return renderAuditLog();
    return renderSalonList();
  }

  // ═══════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100vh', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
      <div style={{ width: 220, background: '#162032', borderRight: '1px solid ' + T.borderLight, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid ' + T.borderLight, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>Pro Salon POS</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Provider Admin</div>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + T.borderLight }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{user.name}</div>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'capitalize' }}>{user.role === 'owner' ? 'Provider Owner' : user.role + ' Agent'}</div>
        </div>
        <div style={{ flex: 1, padding: '8px 8px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map(function(s) {
            var active = section === s.id;
            return (
              <div key={s.id} onClick={function() { setSection(s.id); setSelectedSalonId(null); setSelectedAgentId(null); }}
                onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#2A3A50'; e.currentTarget.style.borderColor = T.textMuted; } }}
                onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.borderLight; } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                  borderRadius: 6, backgroundColor: active ? T.accentBg : T.chrome,
                  color: active ? T.accent : T.text, border: '1px solid ' + (active ? T.accent + '40' : T.borderLight),
                  transition: 'background-color 150ms, color 150ms, border-color 150ms', userSelect: 'none',
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '12px 8px', borderTop: '1px solid ' + T.borderLight, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div onClick={function() { setUser(null); setSection('salons'); setSelectedSalonId(null); setSelectedAgentId(null); setPinInput(''); providerLogout(); setApiMode(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 6, color: '#F59E0B', border: '1px solid ' + T.borderLight, userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#2A3A50'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
          ><span>🔓</span><span>Log Out</span></div>
          {onBack && (
            <div onClick={onBack}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderRadius: 6, color: T.textMuted, border: '1px solid ' + T.borderLight, userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#2A3A50'; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
            ><span>←</span><span>Back to Station</span></div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {renderContent()}
      </div>
    </div>
  );
}
