import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
/**
 * Pro Salon POS — Client Profile Screen
 * Session 7 Decisions #164-178. Session 35: RBAC wiring for delete_clients.
 * Session 85: Visit history + financials wired to ticketStore in production.
 * 
 * Full profile with inline-editable fields (no edit mode toggle).
 * Save button grayed out until changes are made.
 * Sections: header, standard fields, financials, visit history, notes, custom fields.
 */
import { useState, useMemo } from 'react';
import ClientFinancials from './ClientFinancials';
import ClientNotes from './ClientNotes';
import ClientVisitHistory from './ClientVisitHistory';
import ClientCustomFields from './ClientCustomFields';
import ClientDeleteModal from './ClientDeleteModal';
// Session 88: Mock removed — client details come from API
var MOCK_CLIENT_FINANCIALS = {};
var MOCK_VISIT_HISTORY = {};
var MOCK_CLIENT_NOTES = {};
var MOCK_CUSTOM_FIELDS = [];
var MOCK_CUSTOM_FIELD_VALUES = {};
import { getClientPackages, getClientPackageItems, MOCK_PACKAGE_REDEMPTIONS } from '../packages/packageBridge';
import { AVATAR_COLORS } from '../../lib/calendarHelpers';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useClientStore } from '../../lib/stores/clientStore';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { useStaffStore } from '../../lib/stores/staffStore';
// Session 88: isProduction removed

function getInitials(first, last) {
  return ((first || '')[0] || '') + ((last || '')[0] || '');
}

function formatPhone(digits) {
  if (!digits) return '';
  var d = digits.replace(/\D/g, '');
  if (d.length <= 3) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 10);
}

function formatBirthday(val) {
  if (!val) return '';
  // Accept YYYY-MM-DD or display as-is
  var parts = val.split('-');
  if (parts.length === 3) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }
  return val;
}

function autoCap(v) { return v.replace(/(^|\s)\S/g, function(c) { return c.toUpperCase(); }); }

export default function ClientProfileScreen({ client, onBack, onUpdateClient }) {
  var C = useTheme();
  var toast = useToast();
  var rbac = useRBAC();
  var vipSettings = useSettingsStore(function(s) { return { enabled: s.settings.vip_enabled !== false, discount_type: s.settings.vip_discount_type, discount_amount: s.settings.vip_discount_amount }; });
  // ── Editable fields ──
  var [firstName, setFirstName] = useState(client.first_name || '');
  var [lastName, setLastName] = useState(client.last_name || '');
  var [phone, setPhone] = useState(client.phone || '');
  var [email, setEmail] = useState(client.email || '');
  var [address, setAddress] = useState(client.address || '');
  var [birthday, setBirthday] = useState(client.birthday || '');
  var [referralSource, setReferralSource] = useState(client.referral_source || '');

  // ── Notes state (local mock) ──
  var clientNotes = MOCK_CLIENT_NOTES[client.id] || [];
  var [notes, setNotes] = useState(clientNotes.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); }));

  // ── Custom fields state ──
  var cfValues = MOCK_CUSTOM_FIELD_VALUES[client.id] || {};
  var [customFieldValues, setCustomFieldValues] = useState(cfValues);

  // ── Package data ──
  var clientPackages = useMemo(function() { return getClientPackages(client.id); }, [client.id]);
  var clientPkgItems = useMemo(function() {
    var all = [];
    clientPackages.forEach(function(cp) {
      var items = getClientPackageItems(cp.id);
      items.forEach(function(cpi) { all.push({ ...cpi, packageName: cp.package_name, packageId: cp.id }); });
    });
    return all;
  }, [clientPackages]);

  // ── Delete modal ──
  var [showDeleteModal, setShowDeleteModal] = useState(false);
  var [isActive, setIsActive] = useState(client.active !== false);

  // ── VIP ──
  var isVip = !!client.is_vip;
  var isManualVip = !!client.vip_manual_override;
  var updateClient = useClientStore(function(s) { return s.updateClient; });

  function handleVipToggle() {
    var newManual = !isManualVip;
    var newVip = newManual ? true : false; // When toggling manual off, system will re-evaluate — for mock, just set false
    updateClient(client.id, { is_vip: newManual || isVip, vip_manual_override: newManual });
    if (onUpdateClient) onUpdateClient({ ...client, is_vip: newManual || isVip, vip_manual_override: newManual });
  }

  // ── Active tab ──
  var [activeTab, setActiveTab] = useState('details');

  // ── Detect changes for Save button ──
  var hasChanges = useMemo(function() {
    if (firstName !== (client.first_name || '')) return true;
    if (lastName !== (client.last_name || '')) return true;
    if (phone !== (client.phone || '')) return true;
    if (email !== (client.email || '')) return true;
    if (address !== (client.address || '')) return true;
    if (birthday !== (client.birthday || '')) return true;
    if (referralSource !== (client.referral_source || '')) return true;
    // Check custom fields
    var origCf = MOCK_CUSTOM_FIELD_VALUES[client.id] || {};
    var cfKeys = Object.keys(customFieldValues).concat(Object.keys(origCf));
    for (var k = 0; k < cfKeys.length; k++) {
      if ((customFieldValues[cfKeys[k]] || '') !== (origCf[cfKeys[k]] || '')) return true;
    }
    return false;
  }, [firstName, lastName, phone, email, address, birthday, referralSource, customFieldValues, client]);

  function handleSave() {
    if (!hasChanges) return;
    if (onUpdateClient) {
      onUpdateClient({
        ...client,
        first_name: firstName, last_name: lastName, phone: phone,
        email: email, address: address, birthday: birthday,
        referral_source: referralSource,
      });
    }
    // In Phase 1, just show feedback
    toast.show('Client profile saved!', 'success');
  }

  function handleAddNote(text) {
    var newNote = {
      id: 'cn-' + Date.now(),
      client_id: client.id,
      staff_id: 'staff-01',
      staff_name: 'Maria', // Mock: current logged-in staff
      content: text,
      created_at: new Date().toISOString(),
    };
    setNotes(function(prev) { return [newNote].concat(prev); });
  }

  function handleDeleteNote(noteId) {
    setNotes(function(prev) { return prev.filter(function(n) { return n.id !== noteId; }); });
  }

  function handleCustomFieldChange(fieldId, val) {
    setCustomFieldValues(function(prev) {
      var next = { ...prev };
      next[fieldId] = val;
      return next;
    });
  }

  // ── Data — reads from ticketStore ──
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var staffList = useStaffStore(function(s) { return s.staff; });

  // Build visit history from closed tickets for this client
  var visits = useMemo(function() {
    var clientTickets = closedTickets.filter(function(t) {
      if (t.status === 'voided') return false;
      // Match by client id or client object
      if (t.client && t.client.id === client.id) return true;
      if (t.client_id === client.id) return true;
      return false;
    });
    // Reshape into visit history format
    return clientTickets.map(function(t) {
      var items = t.items || t.lineItems || [];
      var serviceNames = items.filter(function(it) { return it.type === 'service'; }).map(function(it) { return it.name; });
      var totalCents = items.reduce(function(s, it) { return s + (it.price_cents || 0); }, 0);
      var tipCents = t.tipCents || t.tip_cents || 0;
      // Primary tech
      var firstSvc = items.find(function(it) { return it.type === 'service' && it.tech; });
      var techName = firstSvc ? firstSvc.tech : '';
      if (!techName && (t.createdBy || t.closedBy)) {
        var staffMember = staffList.find(function(s) { return s.id === (t.createdBy || t.closedBy); });
        techName = staffMember ? staffMember.display_name : '';
      }
      // Payment method
      var payments = t.payments || [];
      var payLabel = 'Credit Card';
      if (payments.length > 0) {
        var m = payments[0].method || '';
        if (m === 'cash') payLabel = 'Cash';
        else if (m === 'gift' || m === 'giftcard') payLabel = 'Gift Card';
        else if (m === 'zelle') payLabel = 'Zelle';
      }
      // Date
      var dateStr = '';
      var ts = t.closedAt || t.created_at;
      if (ts) {
        var d = new Date(ts);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return {
        id: t.id,
        date: dateStr,
        services: serviceNames,
        tech: techName,
        total_cents: totalCents,
        payment: payLabel,
        tip_cents: tipCents,
        status: 'completed',
      };
    }).sort(function(a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });
  }, [client.id, closedTickets, staffList]);

  // Build financials from closed tickets
  var financials = useMemo(function() {
    var clientTickets = closedTickets.filter(function(t) {
      if (t.status === 'voided') return false;
      if (t.client && t.client.id === client.id) return true;
      if (t.client_id === client.id) return true;
      return false;
    });
    var lifetimeSpend = clientTickets.reduce(function(s, t) {
      var items = t.items || t.lineItems || [];
      return s + items.reduce(function(a, it) { return a + (it.price_cents || 0); }, 0);
    }, 0);
    var lastTicket = clientTickets.length > 0 ? clientTickets[0] : null;
    var lastVisitStr = null;
    if (lastTicket) {
      var ts = lastTicket.closedAt || lastTicket.created_at;
      if (ts) {
        var d = new Date(ts);
        if (!isNaN(d.getTime())) lastVisitStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    return {
      outstanding_balance_cents: client.outstanding_balance_cents || 0,
      gift_cards: [],
      membership: null,
      loyalty_points: client.loyalty_points || 0,
      lifetime_points: client.lifetime_points || 0,
      lifetime_spend_cents: lifetimeSpend,
      visit_count: clientTickets.length,
      last_visit: lastVisitStr,
    };
  }, [client.id, closedTickets]);

  // ── Styles ──
  var inputStyle = {
    width: '100%', height: 40, background: C.inputBg, border: '1px solid ' + C.inputBorder,
    borderRadius: 6, padding: '0 12px', color: C.textPrimary, fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  var fieldLabel = { color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

  var tabs = [
    { id: 'details', label: 'Details' },
    { id: 'visits', label: 'Visits (' + visits.length + ')' },
    { id: 'notes', label: 'Notes (' + notes.length + ')' },
    { id: 'packages', label: 'Packages' + (clientPackages.length > 0 ? ' (' + clientPackages.length + ')' : '') },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.chrome, fontFamily: 'Inter,system-ui,sans-serif', overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <div style={{ height: 52, background: C.chromeDark, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, borderBottom: '1px solid ' + C.borderLight, flexShrink: 0 }}>
        <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0E2E3D', border: '1px solid #1A4A5C', color: '#7EC8E3', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '7px 16px', borderRadius: 6, minHeight: 36, userSelect: 'none', transition: 'background 150ms' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = '#163A4D'; e.currentTarget.style.borderColor = '#2A6A8A'; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = '#0E2E3D'; e.currentTarget.style.borderColor = '#1A4A5C'; }}
        >← Back to Calendar</div>

        <div style={{ flex: 1 }} />

        <div style={{ color: C.textPrimary, fontSize: 15, fontWeight: 600 }}>Client Profile</div>

        <div style={{ flex: 1 }} />

        {/* Deactivated badge */}
        {!isActive && (
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4, background: 'rgba(217,119,6,0.15)', color: C.warning }}>Deactivated</span>
        )}

        {/* Manage button (owner action) */}
        <button onClick={function() { rbac.requirePermission(ACTIONS.DELETE_CLIENTS, function(){ setShowDeleteModal(true); }); }} style={{ height: 34, padding: '0 14px', background: 'transparent', color: C.textMuted, border: '1px solid ' + C.borderMedium, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.warning; e.currentTarget.style.color = C.warning; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.borderMedium; e.currentTarget.style.color = C.textMuted; }}
        >Manage</button>

        {/* Save button — grayed out when no changes */}
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            height: 36, padding: '0 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
            cursor: hasChanges ? 'pointer' : 'default', fontFamily: 'inherit',
            background: hasChanges ? C.blue : C.grid,
            color: hasChanges ? '#fff' : C.textMuted,
            transition: 'background 0.15s, color 0.15s',
          }}
        >Save</button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>

        {/* ── Left column: Profile header + fields ── */}
        <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid ' + C.borderLight, overflow: 'auto', padding: 20 }}>

          {/* Avatar + name + phone */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: AVATAR_COLORS[(client.id || '').charCodeAt(4) % AVATAR_COLORS.length],
                color: C.textPrimary, fontSize: 24, fontWeight: 600,
                border: isVip ? '3px solid #F59E0B' : 'none',
              }}>{getInitials(firstName, lastName).toUpperCase()}</div>
              {isVip && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1, border: '2px solid ' + C.chrome }}>👑</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <div style={{ color: C.textPrimary, fontSize: 18, fontWeight: 600 }}>{firstName} {lastName}</div>
              {isVip && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#F59E0B', letterSpacing: '0.05em' }}>VIP</span>}
            </div>
            <div style={{ color: C.textPrimary, fontSize: 13, marginTop: 2 }}>{formatPhone(phone)}</div>
            {client.created_at && <div style={{ color: C.textMuted, fontSize: 11, marginTop: 6 }}>Client since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>}
            {vipSettings.enabled && (
              <div onClick={handleVipToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: isManualVip ? 'rgba(245,158,11,0.12)' : 'transparent', border: '1px solid ' + (isManualVip ? 'rgba(245,158,11,0.4)' : C.borderLight) }}
                onMouseEnter={function(e) { if (!isManualVip) e.currentTarget.style.background = C.grid; }}
                onMouseLeave={function(e) { if (!isManualVip) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 12, color: isManualVip ? '#F59E0B' : C.textMuted, fontWeight: 500 }}>{isManualVip ? '👑 Manual VIP — ON' : 'Set as VIP manually'}</span>
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={fieldLabel}>First Name *</div>
              <input value={firstName} onChange={function(e) { setFirstName(autoCap(e.target.value)); }} inputMode="text" autoComplete="off" autoCapitalize="words" style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Last Name</div>
              <input value={lastName} onChange={function(e) { setLastName(autoCap(e.target.value)); }} inputMode="text" autoComplete="off" autoCapitalize="words" style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Phone *</div>
              <input value={phone} onChange={function(e) { setPhone(e.target.value); }} inputMode="tel" autoComplete="off" style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Email</div>
              <input value={email} onChange={function(e) { setEmail(e.target.value); }} inputMode="email" autoComplete="off" style={inputStyle} placeholder="email@example.com" />
            </div>
            <div>
              <div style={fieldLabel}>Address</div>
              <input value={address} onChange={function(e) { setAddress(e.target.value); }} inputMode="text" autoComplete="off" autoCapitalize="words" style={inputStyle} placeholder="Street address" />
            </div>
            <div>
              <div style={fieldLabel}>Birthday</div>
              <input type="date" value={birthday} onChange={function(e) { setBirthday(e.target.value); }} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <div style={fieldLabel}>Referral Source</div>
              <input value={referralSource} onChange={function(e) { setReferralSource(e.target.value); }} inputMode="text" autoComplete="off" autoCapitalize="words" style={inputStyle} placeholder="How did they find us?" />
            </div>
          </div>

          {hasChanges && (
            <div style={{ marginTop: 12, color: C.blueLight, fontSize: 11, textAlign: 'center', fontStyle: 'italic' }}>Unsaved changes</div>
          )}
        </div>

        {/* ── Right column: Tabs → Financials, Visits, Notes, Custom fields ── */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Tab bar — styled as buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, padding: '10px 20px', borderBottom: '1px solid ' + C.borderLight }}>
            {tabs.map(function(tab) {
              var isAct = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={function() { setActiveTab(tab.id); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 34, padding: '0 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap',
                    background: isAct ? C.blue : C.raised || '#334155',
                    color: isAct ? '#FFFFFF' : C.textMuted,
                    border: '1px solid ' + (isAct ? C.blue : C.borderMedium),
                  }}
                  onMouseEnter={function(e) { if (!isAct) { e.currentTarget.style.background = '#3E4C5E'; e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.borderColor = C.textMuted; } }}
                  onMouseLeave={function(e) { if (!isAct) { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.borderMedium; } }}
                >{tab.label}</button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {activeTab === 'details' && (
              <>
                <ClientFinancials financials={financials} storeCreditCents={client.store_credit_cents || 0} />
                <ClientCustomFields fields={MOCK_CUSTOM_FIELDS} values={customFieldValues} onChange={handleCustomFieldChange} />
              </>
            )}
            {activeTab === 'visits' && (
              <ClientVisitHistory visits={visits} />
            )}
            {activeTab === 'notes' && (
              <ClientNotes notes={notes} onAddNote={handleAddNote} onDeleteNote={handleDeleteNote} />
            )}
            {activeTab === 'packages' && (
              <div>
                {clientPackages.length === 0 && (
                  <div style={{ padding: 30, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    No active packages for this client.
                  </div>
                )}
                {clientPackages.map(function(cp) {
                  var cpItems = getClientPackageItems(cp.id);
                  var redemptions = MOCK_PACKAGE_REDEMPTIONS.filter(function(r) { return r.client_package_id === cp.id; });
                  var isExpired = cp.expires_at && new Date(cp.expires_at) < new Date();
                  return (
                    <div key={cp.id} style={{ background: C.chrome, border: '1px solid ' + C.border, borderRadius: 8, padding: 16, marginBottom: 12, opacity: isExpired ? 0.5 : 1 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{cp.package_name}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                            Purchased {new Date(cp.purchased_at).toLocaleDateString()} · Sold by {cp.sold_by_staff_name}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>{'$' + (cp.price_paid_cents / 100).toFixed(2)}</div>
                          {isExpired && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 500 }}>EXPIRED</span>}
                          {!isExpired && cp.expires_at && <div style={{ fontSize: 10, color: C.textMuted }}>Expires {new Date(cp.expires_at).toLocaleDateString()}</div>}
                          {!cp.expires_at && <div style={{ fontSize: 10, color: C.textMuted }}>No expiration</div>}
                        </div>
                      </div>

                      {/* Sessions remaining */}
                      <div style={{ marginBottom: 10 }}>
                        {cpItems.map(function(cpi) {
                          var pct = cpi.total_quantity > 0 ? ((cpi.remaining / cpi.total_quantity) * 100) : 0;
                          return (
                            <div key={cpi.id} style={{ marginBottom: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{cpi.service_name}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: cpi.remaining > 0 ? C.primary : C.textMuted }}>
                                  {cpi.remaining} / {cpi.total_quantity} remaining
                                </span>
                              </div>
                              <div style={{ height: 6, background: C.grid, borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: pct + '%', background: cpi.remaining > 0 ? C.primary : C.textMuted, borderRadius: 3, transition: 'width 300ms' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Redemption history */}
                      {redemptions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Usage History</div>
                          {redemptions.map(function(r) {
                            var isUpgrade = !r.isExactMatch && r.service_redeemed_id !== r.package_service_id;
                            return (
                              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid ' + C.borderLight, fontSize: 11 }}>
                                <div>
                                  <span style={{ color: C.text, fontWeight: 500 }}>{r.service_redeemed_name}</span>
                                  {isUpgrade && <span style={{ color: '#8B5CF6', marginLeft: 6 }}>↑ upgrade from {r.package_service_name}</span>}
                                </div>
                                <div style={{ color: C.textMuted }}>
                                  {new Date(r.redeemed_at).toLocaleDateString()} · {r.staff_name}
                                  {r.upgrade_difference_cents > 0 && <span style={{ color: C.primary, marginLeft: 6 }}>+{'$' + (r.upgrade_difference_cents / 100).toFixed(2)}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: C.textMuted }}>
                        {cp.transferable && <span>Transferable</span>}
                        <span>{cp.refundable ? 'Refundable' : 'Non-refundable'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Modal ── */}
      {showDeleteModal && (
        <ClientDeleteModal
          clientName={firstName + ' ' + lastName}
          isActive={isActive}
          onDeactivate={function() { setIsActive(false); setShowDeleteModal(false); }}
          onReactivate={function() { setIsActive(true); setShowDeleteModal(false); }}
          onPermanentDelete={function() { setShowDeleteModal(false); if (onBack) onBack(); }}
          onClose={function() { setShowDeleteModal(false); }}
        />
      )}
    </div>
  );
}
