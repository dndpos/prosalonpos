/**
 * ProviderAgentDetail.jsx — Agent detail view for Provider Admin Panel
 * Session 65 — wired to real backend API
 *
 * Shows agent info (view/edit), role/visibility selectors,
 * and assigned salons list (read-only, clickable to navigate).
 *
 * API wiring: receives apiMode, saveAgentApi from parent.
 */
import React from 'react';
import { formatDate, STATUS_COLORS, InfoRow, ToggleSwitch } from './ProviderShared';

export default function ProviderAgentDetail({
  T, salons, agents, selectedAgentId, setAgents,
  setSelectedAgentId, setSelectedSalonId, setSection,
  addAudit,
  // Edit state
  editingAgent, setEditingAgent,
  editAgName, setEditAgName, editAgEmail, setEditAgEmail,
  editAgPin, setEditAgPin, editAgRole, setEditAgRole,
  editAgVis, setEditAgVis, editAgActive, setEditAgActive,
  // For navigating to salon detail
  setEditing, setNoteInput, setEditName, setEditOwnerName,
  setEditOwnerPhone, setEditOwnerEmail, setEditAddress,
  setEditStatus, setEditPlan, setEditStations, setEditRate,
  // API wiring (Session 65)
  apiMode, saveAgentApi, loadSalonNotes,
}) {
  var ag = agents.find(function(a) { return a.id === selectedAgentId; });
  if (!ag) return null;

  function saveAgent() {
    var updates = { name: editAgName, email: editAgEmail, role: editAgRole, visibility: editAgVis, active: editAgActive };

    // Update local state immediately
    setAgents(function(prev) {
      return prev.map(function(a) {
        if (a.id !== selectedAgentId) return a;
        return Object.assign({}, a, updates, { pin: editAgPin });
      });
    });
    addAudit('agent_updated', 'Updated agent: ' + editAgName + ' (' + editAgRole + ')', null);
    setEditingAgent(false);

    // Call API in live mode (include PIN if changed)
    if (saveAgentApi) {
      var apiUpdates = Object.assign({}, updates);
      if (editAgPin && editAgPin !== '****') apiUpdates.pin = editAgPin;
      saveAgentApi(selectedAgentId, apiUpdates);
    }
  }

  function navigateToSalon(s) {
    setSection('salons');
    setSelectedAgentId(null);
    setSelectedSalonId(s.id);
    setEditing(false);
    setNoteInput('');
    setEditName(s.name);
    setEditOwnerName(s.owner_name || '');
    setEditOwnerPhone(s.owner_phone || '');
    setEditOwnerEmail(s.owner_email || '');
    setEditAddress(s.address || s.address1 || '');
    setEditStatus(s.status);
    setEditPlan(s.plan_tier);
    setEditStations(s.station_count);
    setEditRate(s.processing_rate);
    // Load notes for this salon from API
    if (loadSalonNotes) loadSalonNotes(s.id);
  }

  var assignedSalons = salons.filter(function(s) { return s.assigned_agent_id === ag.id; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div onClick={function() { setSelectedAgentId(null); setEditingAgent(false); }} style={{ padding: '6px 14px', background: T.surface, border: '1px solid ' + T.borderLight, borderRadius: 6, fontSize: 13, cursor: 'pointer', color: T.textMuted }}>← Back</div>
        <div style={{ fontSize: 20, fontWeight: 500, flex: 1 }}>{ag.name}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: ag.role === 'sales' ? '#8B5CF6' : '#3B82F6', padding: '4px 12px', borderRadius: 10, textTransform: 'capitalize' }}>{ag.role}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Agent info */}
        <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Agent Details</div>
            {!editingAgent
              ? <div onClick={function() { setEditingAgent(true); }} style={{ fontSize: 12, color: '#3B82F6', cursor: 'pointer' }}>Edit</div>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={saveAgent} style={{ fontSize: 12, color: '#10B981', cursor: 'pointer', fontWeight: 600 }}>Save</div>
                  <div onClick={function() { setEditingAgent(false); }} style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer' }}>Cancel</div>
                </div>
            }
          </div>
          {editingAgent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Name</div><input value={editAgName} onChange={function(e) { setEditAgName(e.target.value); }} style={{ width: '100%', background: '#0F1923', color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} /></div>
              <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Email</div><input value={editAgEmail} onChange={function(e) { setEditAgEmail(e.target.value); }} style={{ width: '100%', background: '#0F1923', color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} /></div>
              <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>PIN</div><input value={editAgPin} onChange={function(e) { setEditAgPin(e.target.value); }} style={{ width: 100, background: '#0F1923', color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }} /></div>
              <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Role</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['support', 'sales'].map(function(r) {
                    return <div key={r} onClick={function() { setEditAgRole(r); }} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: editAgRole === r ? (r === 'sales' ? '#8B5CF6' : '#3B82F6') : T.chrome, color: editAgRole === r ? '#fff' : T.textMuted, border: '1px solid ' + (editAgRole === r ? 'transparent' : T.borderLight) }}>{r}</div>;
                  })}
                </div>
              </div>
              <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Salon Visibility</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 'all', l: 'All Salons' }, { v: 'assigned', l: 'Assigned Only' }].map(function(opt) {
                    return <div key={opt.v} onClick={function() { setEditAgVis(opt.v); }} style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: editAgVis === opt.v ? '#10B981' : T.chrome, color: editAgVis === opt.v ? '#fff' : T.textMuted, border: '1px solid ' + (editAgVis === opt.v ? 'transparent' : T.borderLight) }}>{opt.l}</div>;
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, color: T.textMuted }}>Active</div>
                <ToggleSwitch value={editAgActive} onChange={function() { setEditAgActive(!editAgActive); }} />
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Name" T={T}>{ag.name}</InfoRow>
              <InfoRow label="Email" T={T}>{ag.email || '—'}</InfoRow>
              <InfoRow label="PIN" T={T}>{ag.pin || '****'}</InfoRow>
              <InfoRow label="Role" T={T}><span style={{ color: ag.role === 'sales' ? '#8B5CF6' : '#3B82F6', fontWeight: 600, textTransform: 'capitalize' }}>{ag.role}</span></InfoRow>
              <InfoRow label="Visibility" T={T}><span style={{ color: ag.visibility === 'all' ? '#10B981' : '#F59E0B' }}>{ag.visibility === 'all' ? 'All Salons' : 'Assigned Only'}</span></InfoRow>
              <InfoRow label="Status" T={T}><span style={{ color: ag.active ? '#10B981' : '#EF4444' }}>{ag.active ? 'Active' : 'Inactive'}</span></InfoRow>
              <InfoRow label="Created" T={T}>{formatDate(ag.created_at)}</InfoRow>
            </div>
          )}
        </div>

        {/* Right: Assigned salons */}
        <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Assigned Salons</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>To assign or remove salons, go to Salon Management → select a salon → change the assigned agent.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {assignedSalons.length === 0 && (
              <div style={{ padding: '16px 0', fontSize: 13, color: T.textMuted, textAlign: 'center' }}>No salons assigned to this agent</div>
            )}
            {assignedSalons.map(function(s) {
              return <div key={s.id} onClick={function() { navigateToSalon(s); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + T.borderLight, cursor: 'pointer' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.chrome; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >
                <div>
                  <div style={{ fontSize: 13, color: T.text }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{s.owner_name || '—'}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: STATUS_COLORS[s.status], padding: '3px 10px', borderRadius: 10, textTransform: 'capitalize' }}>{s.status}</div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
