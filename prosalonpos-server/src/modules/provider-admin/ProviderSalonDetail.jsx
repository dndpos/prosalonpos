/**
 * ProviderSalonDetail.jsx — Salon detail view for Provider Admin Panel
 * Session 65 — wired to real backend API
 *
 * Shows salon info (view/edit), assigned agent selector, feature toggles,
 * support notes, and billing history per salon.
 *
 * API wiring: receives apiMode, saveSalonToApi, toggleFeatureApi, addNoteApi
 * from parent. In 'live' mode, calls API then updates local state.
 * In 'mock' mode, updates local state only (same as before).
 */
import React from 'react';
import { FEATURE_CATALOG, PLAN_TIERS } from '../../lib/providerMockData';
import { formatDate, formatDateTime, cents, STATUS_COLORS, InfoRow, ToggleSwitch, EditInput } from './ProviderShared';

export default function ProviderSalonDetail({
  T, isOwner, user, salon, agents, salonNotes, billingRecords,
  selectedSalonId, setSalons, setSalonNotes, setSelectedSalonId,
  addAudit,
  // Edit state
  editing, setEditing, noteInput, setNoteInput,
  editName, setEditName, editOwnerName, setEditOwnerName,
  editOwnerPhone, setEditOwnerPhone, editOwnerEmail, setEditOwnerEmail,
  editAddress, setEditAddress, editStatus, setEditStatus,
  editPlan, setEditPlan, editStations, setEditStations,
  editRate, setEditRate, setAgents,
  // API wiring (Session 65)
  apiMode, saveSalonToApi, toggleFeatureApi, addNoteApi,
}) {
  if (!salon) return null;

  var sNotes = salonNotes.filter(function(n) { return n.salon_id === selectedSalonId; }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  var sBilling = billingRecords.filter(function(b) { return b.salon_id === selectedSalonId; }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  var salonAgent = agents.find(function(a) { return a.id === salon.assigned_agent_id; });

  function saveSalonEdits() {
    var updates = {
      name: editName, owner_name: editOwnerName, owner_phone: editOwnerPhone,
      owner_email: editOwnerEmail, address1: editAddress,
      status: editStatus, plan_tier: editPlan,
      station_count: parseInt(editStations) || 1,
      processing_rate: parseFloat(editRate) || 2.49,
    };

    // Update local state immediately
    setSalons(function(prev) {
      return prev.map(function(s) {
        if (s.id !== selectedSalonId) return s;
        return Object.assign({}, s, updates, { address: editAddress });
      });
    });
    addAudit('salon_updated', 'Updated salon details: ' + editName, selectedSalonId);
    setEditing(false);

    // Call API in live mode
    if (saveSalonToApi) saveSalonToApi(selectedSalonId, updates);
  }

  function toggleFeature(key) {
    var feats = (salon.features_enabled || []).slice();
    var idx = feats.indexOf(key);
    if (idx >= 0) feats.splice(idx, 1); else feats.push(key);

    // Update local state immediately
    setSalons(function(prev) {
      return prev.map(function(s) {
        if (s.id !== selectedSalonId) return s;
        return Object.assign({}, s, { features_enabled: feats });
      });
    });
    var feat = FEATURE_CATALOG.find(function(f) { return f.key === key; });
    var enabled = (salon.features_enabled || []).indexOf(key) < 0;
    addAudit('feature_toggled', (enabled ? 'Enabled' : 'Disabled') + ' "' + (feat ? feat.label : key) + '" for ' + salon.name, selectedSalonId);

    // Call API in live mode
    if (toggleFeatureApi) toggleFeatureApi(selectedSalonId, feats);
  }

  async function addNote() {
    if (!noteInput.trim()) return;
    var content = noteInput.trim();

    if (apiMode === 'live' && addNoteApi) {
      // Call API first, then add to local state with server response
      var serverNote = await addNoteApi(selectedSalonId, content);
      if (serverNote) {
        setSalonNotes(function(prev) { return [serverNote].concat(prev); });
      }
    } else {
      // Mock mode — add locally
      var note = { id: 'note-' + Date.now(), salon_id: selectedSalonId, agent_id: user.id, agent_name: user.name, content: content, created_at: new Date().toISOString() };
      setSalonNotes(function(prev) { return [note].concat(prev); });
    }
    addAudit('note_added', 'Added support note: "' + content.slice(0, 60) + (content.length > 60 ? '...' : '') + '"', selectedSalonId);
    setNoteInput('');
  }

  function assignAgent(agentId) {
    var updates = { assigned_agent_id: agentId };
    setSalons(function(prev) { return prev.map(function(s) { if (s.id !== selectedSalonId) return s; return Object.assign({}, s, updates); }); });
    if (agentId) {
      var ag = agents.find(function(a) { return a.id === agentId; });
      addAudit('salon_updated', 'Assigned agent ' + (ag ? ag.name : agentId) + ' to ' + salon.name, selectedSalonId);
    } else {
      addAudit('salon_updated', 'Removed agent assignment for ' + salon.name, selectedSalonId);
    }
    if (saveSalonToApi) saveSalonToApi(selectedSalonId, updates);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div onClick={function() { setSelectedSalonId(null); setEditing(false); }} style={{ padding: '6px 14px', background: T.surface, border: '1px solid ' + T.borderLight, borderRadius: 6, fontSize: 13, cursor: 'pointer', color: T.textMuted }}>← Back</div>
        <div style={{ fontSize: 20, fontWeight: 500, flex: 1 }}>{salon.name}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: STATUS_COLORS[salon.status], padding: '4px 12px', borderRadius: 10, textTransform: 'capitalize' }}>{salon.status}</div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Salon Info */}
        <div>
          <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Salon Details</div>
              {!editing
                ? <div onClick={function() { setEditing(true); }} style={{ fontSize: 12, color: '#3B82F6', cursor: 'pointer' }}>Edit</div>
                : <div style={{ display: 'flex', gap: 8 }}>
                    <div onClick={saveSalonEdits} style={{ fontSize: 12, color: '#10B981', cursor: 'pointer', fontWeight: 600 }}>Save</div>
                    <div onClick={function() { setEditing(false); }} style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer' }}>Cancel</div>
                  </div>
              }
            </div>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Salon Name</div><EditInput value={editName} onChange={setEditName} width="100%" T={T} /></div>
                <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Owner Name</div><EditInput value={editOwnerName} onChange={setEditOwnerName} width="100%" T={T} /></div>
                <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Owner Phone</div><EditInput value={editOwnerPhone} onChange={setEditOwnerPhone} width="100%" T={T} /></div>
                <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Owner Email</div><EditInput value={editOwnerEmail} onChange={setEditOwnerEmail} width="100%" T={T} /></div>
                <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Address</div><EditInput value={editAddress} onChange={setEditAddress} width="100%" T={T} /></div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Status</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['active', 'trial', 'suspended', 'cancelled'].map(function(st) {
                        return <div key={st} onClick={function() { setEditStatus(st); }} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: editStatus === st ? STATUS_COLORS[st] : T.chrome, color: editStatus === st ? '#fff' : T.textMuted, border: '1px solid ' + (editStatus === st ? STATUS_COLORS[st] : T.borderLight) }}>{st}</div>;
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Plan</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {Object.keys(PLAN_TIERS).map(function(tier) {
                        return <div key={tier} onClick={function() { setEditPlan(tier); }} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: editPlan === tier ? PLAN_TIERS[tier].color : T.chrome, color: editPlan === tier ? '#fff' : T.textMuted, border: '1px solid ' + (editPlan === tier ? PLAN_TIERS[tier].color : T.borderLight) }}>{tier}</div>;
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Stations</div><EditInput value={editStations} onChange={setEditStations} width={60} T={T} /></div>
                  {isOwner && <div><div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>Processing Rate %</div><EditInput value={editRate} onChange={setEditRate} width={80} T={T} /></div>}
                </div>
              </div>
            ) : (
              <div>
                <InfoRow label="Owner" T={T}>{salon.owner_name || '—'}</InfoRow>
                <InfoRow label="Phone" T={T}>{salon.owner_phone || '—'}</InfoRow>
                <InfoRow label="Email" T={T}>{salon.owner_email || '—'}</InfoRow>
                <InfoRow label="Address" T={T}>{salon.address || salon.address1 || '—'}</InfoRow>
                <InfoRow label="Plan" T={T}><span style={{ color: PLAN_TIERS[salon.plan_tier] ? PLAN_TIERS[salon.plan_tier].color : '#999', fontWeight: 600, textTransform: 'capitalize' }}>{salon.plan_tier}</span></InfoRow>
                <InfoRow label="Stations" T={T}>{salon.station_count}</InfoRow>
                {isOwner && <InfoRow label="Processing Rate" T={T}>{salon.processing_rate}%</InfoRow>}
                {isOwner && <InfoRow label="Monthly Fee" T={T}>{cents(salon.monthly_software_fee_cents || 0)}</InfoRow>}
                <InfoRow label="Salon Code" T={T}><span style={{ fontFamily: 'monospace', fontSize: 12, background: T.chrome, padding: '2px 6px', borderRadius: 4 }}>{salon.salon_code}</span></InfoRow>
                <InfoRow label="License Key" T={T}><span style={{ fontFamily: 'monospace', fontSize: 11, background: T.chrome, padding: '2px 6px', borderRadius: 4 }}>{salon.license_key || '—'}</span></InfoRow>
                <InfoRow label="Signed Up" T={T}>{formatDate(salon.signup_date)}</InfoRow>
                {salon.trial_end_date && <InfoRow label="Trial Ends" T={T}>{formatDate(salon.trial_end_date)}</InfoRow>}
                <InfoRow label="Assigned Agent" T={T}>{isOwner ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div onClick={function() { assignAgent(null); }}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: !salon.assigned_agent_id ? '#374151' : T.chrome, color: !salon.assigned_agent_id ? '#fff' : T.textMuted, border: '1px solid ' + (!salon.assigned_agent_id ? '#374151' : T.borderLight) }}>None</div>
                    {agents.filter(function(a) { return a.active; }).map(function(a) {
                      var isCurrent = salon.assigned_agent_id === a.id;
                      return <div key={a.id} onClick={function() { assignAgent(a.id); }}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: isCurrent ? '#3B82F6' : T.chrome, color: isCurrent ? '#fff' : T.textMuted, border: '1px solid ' + (isCurrent ? '#3B82F6' : T.borderLight) }}>{a.name}</div>;
                    })}
                  </div>
                ) : (salonAgent ? salonAgent.name : <span style={{ color: T.textMuted }}>None</span>)}</InfoRow>
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Support Notes</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input value={noteInput} onChange={function(e) { setNoteInput(e.target.value); }} placeholder="Add a note..."
                onKeyDown={function(e) { if (e.key === 'Enter') addNote(); }}
                style={{ flex: 1, background: '#0F1923', color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit' }} />
              <div onClick={addNote} style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</div>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sNotes.length === 0 && <div style={{ fontSize: 13, color: T.textMuted, padding: 8 }}>No notes yet</div>}
              {sNotes.map(function(note) {
                return <div key={note.id} style={{ padding: '10px 12px', background: T.chrome, borderRadius: 8, border: '1px solid ' + T.borderLight }}>
                  <div style={{ fontSize: 13, color: T.text, marginBottom: 4, lineHeight: 1.4 }}>{note.content}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{note.agent_name} · {formatDateTime(note.created_at)}</div>
                </div>;
              })}
            </div>
          </div>
        </div>

        {/* Right: Feature Toggles + Billing */}
        <div>
          <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Feature Toggles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {FEATURE_CATALOG.map(function(feat) {
                var enabled = (salon.features_enabled || []).indexOf(feat.key) >= 0;
                var isProvider = feat.tier === 'provider';
                return (
                  <div key={feat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + T.borderLight }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.text }}>{feat.label}{isProvider && <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 6 }}>PROVIDER</span>}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{feat.description}</div>
                    </div>
                    <ToggleSwitch value={enabled} onChange={function() { toggleFeature(feat.key); }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing history (owner only) */}
          {isOwner && sBilling.length > 0 && (
            <div style={{ background: T.surface, borderRadius: 10, padding: '16px 20px', border: '1px solid ' + T.borderLight }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Billing History</div>
              {sBilling.map(function(b) {
                var statusColor = b.status === 'paid' ? '#10B981' : (b.status === 'overdue' ? '#EF4444' : '#3B82F6');
                return <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + T.borderLight, fontSize: 13 }}>
                  <div style={{ color: T.textMuted }}>{formatDate(b.date)}</div>
                  <div style={{ fontWeight: 500 }}>{cents(b.amount_cents)}</div>
                  <div style={{ color: statusColor, fontWeight: 600, textTransform: 'capitalize', fontSize: 11 }}>{b.status}</div>
                  <div style={{ color: T.textMuted, fontSize: 11 }}>{b.method}</div>
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
