import { useTheme } from '../../lib/ThemeContext';
import DebugLabel from '../../components/debug/DebugLabel';
/**
 * Pro Salon POS — Client List
 * Entry screen for the Clients nav tab.
 * Matches BookingFlow search layout: numpad on right, name search on left.
 * Tap a client → opens full profile.
 * Session 7 Decisions #164, #165, #173
 */
import { useState, useMemo, useEffect } from 'react';
import ClientProfileScreen from './ClientProfileScreen';
// Session 88: Mock removed — financials come from API
import { AVATAR_COLORS } from '../../lib/calendarHelpers';
import { useClientStore } from '../../lib/stores/clientStore';
import { fmt, fp } from '../../lib/formatUtils';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';

const F = 'Inter,system-ui,sans-serif';

function getInitials(first, last) {
  return ((first || '')[0] || '') + ((last || '')[0] || '');
}


function autoCap(v) { return v.replace(/(^|\s)\S/g, function(c) { return c.toUpperCase(); }); }


export default function ClientList({ onBack }) {
  var C = useTheme();
  var INP = { width: '100%', height: 38, background: C.inputBg, border: '1px solid ' + C.inputBorder, borderRadius: 6, padding: '0 14px', color: C.textPrimary, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  var BP = { height: 44, padding: '0 24px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
  // Client data from store (API mode) or mock data (mock mode)
  var storeClients = useClientStore(function(s) { return s.clients; });
  var createClientAction = useClientStore(function(s) { return s.createClient; });
  var updateClientAction = useClientStore(function(s) { return s.updateClient; });
  var storeClientsWithDigits = useMemo(function() {
    return storeClients.map(function(c) {
      return Object.assign({}, c, { phoneDigits: (c.phone || '').replace(/\D/g, '') });
    }).sort(function(a, b) { return (a.first_name || '').localeCompare(b.first_name || ''); });
  }, [storeClients]);
  var [localClients, setLocalClients] = useState([]);
  // Merge store + locally-created clients (local ones are temporary until store refetches)
  var clients = useMemo(function() {
    var ids = {};
    storeClientsWithDigits.forEach(function(c) { ids[c.id] = true; });
    var extras = localClients.filter(function(c) { return !ids[c.id]; });
    return storeClientsWithDigits.concat(extras).sort(function(a, b) { return (a.first_name || '').localeCompare(b.first_name || ''); });
  }, [storeClientsWithDigits, localClients]);
  var [phoneDigits, setPhoneDigits] = useState('');
  var [nameQuery, setNameQuery] = useState('');
  var [selectedClient, setSelectedClient] = useState(null);
  var [showNewForm, setShowNewForm] = useState(false);
  var [newFirst, setNewFirst] = useState('');
  var [newLast, setNewLast] = useState('');
  var [newEmail, setNewEmail] = useState('');

  // Numpad functions
  function padTap(d) { if (phoneDigits.length >= 10) return; setPhoneDigits(function(prev) { return prev + d; }); }
  function padDel() { setPhoneDigits(function(prev) { return prev.slice(0, -1); }); }
  function padClr() { setPhoneDigits(''); setShowNewForm(false); setNewFirst(''); setNewLast(''); setNewEmail(''); }

  // Physical keyboard support — digits, backspace, escape
  // Disabled when typing in search input or new client form
  var isInputFocused = function() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  };
  useNumpadKeyboard(
    !selectedClient && !showNewForm,
    function(digit) { if (!isInputFocused() && phoneDigits.length < 10) setPhoneDigits(function(p) { return p + digit; }); },
    function() { if (!isInputFocused()) setPhoneDigits(function(p) { return p.slice(0, -1); }); },
    null, // no enter action
    function() { if (!isInputFocused()) padClr(); },
    [phoneDigits, showNewForm]
  );

  // Filter clients
  var filtered = useMemo(function() {
    var r = clients.filter(function(c) { return c.active; });
    if (phoneDigits) {
      r = r.filter(function(c) { return c.phoneDigits.includes(phoneDigits); });
    }
    if (nameQuery.trim()) {
      var q = nameQuery.toLowerCase();
      r = r.filter(function(c) { return (c.first_name + ' ' + c.last_name).toLowerCase().includes(q); });
    }
    return r;
  }, [clients, phoneDigits, nameQuery]);

  var noMatch = phoneDigits.length >= 3 && filtered.length === 0;

  function handleSelectClient(c) { setSelectedClient(c); }

  function handleBack() { setSelectedClient(null); }

  function handleUpdateClient(updated) {
    // Update via store (API mode persists to DB, mock mode updates local state)
    updateClientAction(updated.id, updated);
    setSelectedClient(updated);
  }

  function saveNewClient() {
    if (!newFirst.trim() || phoneDigits.length !== 10) return;
    var newClientData = {
      phone: '(' + phoneDigits.slice(0, 3) + ') ' + phoneDigits.slice(3, 6) + '-' + phoneDigits.slice(6, 10),
      first_name: newFirst.trim(), last_name: newLast.trim(),
      email: newEmail.trim(),
    };
    // Create via store (API mode persists to DB, mock mode adds locally)
    var result = createClientAction(newClientData);
    // Handle both sync (mock) and async (API) returns
    if (result && result.then) {
      result.then(function(created) { if (created) setSelectedClient(created); });
    } else if (result) {
      setSelectedClient(result);
    }
    // Also add locally for instant UI (before store refetches)
    var localClient = Object.assign({
      id: 'cli-new-' + Date.now(), phoneDigits: phoneDigits,
      address: '', birthday: '', photo_url: null,
      referral_source: '', store_credit_cents: 0, active: true,
      linked_client_id: null, location_id: 'loc-01', created_at: new Date().toISOString(),
    }, newClientData);
    setLocalClients(function(prev) { return [localClient].concat(prev); });
    setSelectedClient(localClient);
    padClr();
  }

  // ── If a client is selected, show their profile ──
  if (selectedClient) {
    var fresh = clients.find(function(c) { return c.id === selectedClient.id; }) || selectedClient;
    return <ClientProfileScreen client={fresh} onBack={handleBack} onUpdateClient={handleUpdateClient} />;
  }

  // ── Client Search Screen (matches BookingFlow layout) ──
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.chrome, fontFamily: F, overflow: 'hidden', position: 'relative' }}>
      <DebugLabel id="PAGE-CLIENTS" />

      {/* ── Top Bar ── */}
      <div style={{ height: 52, background: C.chromeDark, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, borderBottom: '1px solid ' + C.borderLight, flexShrink: 0 }}>
        {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textPrimary, fontSize: 18, cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}>←</button>}
        <span style={{ color: C.textPrimary, fontSize: 16, fontWeight: 500 }}>Clients</span>
        <span style={{ color: C.textMuted, fontSize: 13 }}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Main area: list on left, numpad on right ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: name search + results ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Name search */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid ' + C.borderLight, flexShrink: 0 }}>
            <input
              value={nameQuery}
              onChange={function(e) { setNameQuery(autoCap(e.target.value)); }}
              placeholder="Search by name..."
              type="text" inputMode="text" autoComplete="off" autoCapitalize="words"
              style={{ ...INP, height: 38 }}
            />
          </div>

          {/* Results list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {filtered.length > 0 && (
              <div style={{ padding: '6px 8px', fontSize: 12, color: C.textMuted }}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</div>
            )}
            {filtered.map(function(c, i) {
              var fin = {};
              var hasBalance = (fin.outstanding_balance_cents || 0) > 0;
              var hasMembership = fin.membership && fin.membership.status === 'active';

              return (
                <div key={c.id} onClick={function() { handleSelectClient(c); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = C.grid; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: AVATAR_COLORS[(c.id || '').charCodeAt(4) % AVATAR_COLORS.length],
                    color: C.textPrimary, fontSize: 11, fontWeight: 500,
                  }}>{getInitials(c.first_name, c.last_name).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: C.textPrimary, fontSize: 13, fontWeight: 500 }}>{c.first_name} {c.last_name}</span>
                      {hasBalance && <span style={{ fontSize: 9, color: C.danger, background: 'rgba(220,38,38,0.15)', padding: '2px 5px', borderRadius: 3, fontWeight: 600 }}>Owes {fmt(fin.outstanding_balance_cents)}</span>}
                      {hasMembership && <span style={{ fontSize: 9, color: C.success, background: 'rgba(5,150,105,0.15)', padding: '2px 5px', borderRadius: 3, fontWeight: 600 }}>{fin.membership.plan}</span>}
                    </div>
                  </div>
                  <div style={{ color: C.textPrimary, fontSize: 12, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fp(c.phoneDigits)}</div>
                </div>
              );
            })}

            {/* No match — new client flow */}
            {noMatch && (
              <div style={{ padding: '16px 8px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '50%', minWidth: 360, maxWidth: 560 }}>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#FCA5A5', marginBottom: 4 }}>Client not found</div>
                  <div style={{ fontSize: 13, color: C.textPrimary }}>
                    {phoneDigits.length === 10
                      ? <>No client matches <span style={{ color: C.textPrimary, fontWeight: 500 }}>{fp(phoneDigits)}</span></>
                      : <>Enter a full 10-digit phone number to search or add a new client</>}
                  </div>
                </div>
                {phoneDigits.length === 10 && !showNewForm && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div onClick={function() { setShowNewForm(true); }}
                      style={{ flex: 1, height: 42, background: '#0E3D3D', border: '1px solid #1A5C5C', borderRadius: 8, color: '#5EEAD4', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'border-color 150ms' }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#5EEAD4'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#1A5C5C'; }}
                    >Add New Client</div>
                    <div onClick={padClr}
                      style={{ flex: 1, height: 42, background: '#1E2554', border: '1px solid #2E3A7A', borderRadius: 8, color: '#A5B4FC', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', transition: 'border-color 150ms' }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#A5B4FC'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#2E3A7A'; }}
                    >Try Different Number</div>
                  </div>
                )}
                {showNewForm && (
                  <div style={{ background: C.chromeDark, borderRadius: 8, padding: 16, border: '1px solid ' + C.borderLight }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>New client — {fp(phoneDigits)}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>Phone and first name are required</div>
                    <label style={{ display: 'block', fontSize: 11, color: C.textPrimary, marginBottom: 4 }}>First name <span style={{ color: C.danger }}>*</span></label>
                    <input value={newFirst} onChange={function(e) { setNewFirst(autoCap(e.target.value)); }} placeholder="First name" type="text" inputMode="text" autoComplete="off" autoCapitalize="words" autoFocus
                      onFocus={function(e) { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                      style={{ ...INP, height: 38, marginBottom: 10 }} />
                    <label style={{ display: 'block', fontSize: 11, color: C.textPrimary, marginBottom: 4 }}>Last name</label>
                    <input value={newLast} onChange={function(e) { setNewLast(autoCap(e.target.value)); }} placeholder="Optional" type="text" inputMode="text" autoComplete="off" autoCapitalize="words"
                      style={{ ...INP, height: 38, marginBottom: 10 }} />
                    <label style={{ display: 'block', fontSize: 11, color: C.textPrimary, marginBottom: 4 }}>Email</label>
                    <input value={newEmail} onChange={function(e) { setNewEmail(e.target.value); }} placeholder="Optional" type="email" inputMode="email" autoComplete="off"
                      style={{ ...INP, height: 38, marginBottom: 14 }} />
                    <button onClick={saveNewClient} disabled={!newFirst.trim() || phoneDigits.length !== 10}
                      style={{ ...BP, width: '100%', height: 40, fontSize: 13, opacity: (!newFirst.trim() || phoneDigits.length !== 10) ? 0.4 : 1 }}>Save & Open Profile</button>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Phone numpad ── */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', padding: 20, flexShrink: 0, borderLeft: '1px solid ' + C.borderLight, background: '#0B1120' }}>
          <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Phone lookup</div>
          <div style={{
            background: phoneDigits.length === 10 ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.05)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', minHeight: 48,
            border: phoneDigits.length === 10 ? '1px solid rgba(5,150,105,0.3)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ color: phoneDigits ? '#F1F5F9' : '#64748B', fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {phoneDigits ? fp(phoneDigits) : '(___) ___-____'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: phoneDigits.length === 10 ? '#6EE7B7' : '#64748B', marginBottom: 12, textAlign: 'center' }}>
            {phoneDigits.length}/10{phoneDigits.length === 10 ? ' ✓' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(function(d) {
              return (
                <div key={d} onClick={function() { padTap(d); }}
                  style={{ background: '#1A2340', border: '1px solid #1E2D45', borderRadius: 8, color: '#F1F5F9', fontSize: 24, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, userSelect: 'none', transition: 'background 150ms' }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#213055'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = '#1A2340'; }}
                >{d}</div>
              );
            })}
            <div onClick={padClr}
              style={{ background: '#1A2340', border: '1px solid #1E2D45', borderRadius: 8, color: C.warning, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, userSelect: 'none', transition: 'background 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#213055'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#1A2340'; }}
            >Clear</div>
            <div onClick={function() { padTap('0'); }}
              style={{ background: '#1A2340', border: '1px solid #1E2D45', borderRadius: 8, color: '#F1F5F9', fontSize: 24, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, userSelect: 'none', transition: 'background 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#213055'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#1A2340'; }}
            >0</div>
            <div onClick={padDel}
              style={{ background: '#1A2340', border: '1px solid #1E2D45', borderRadius: 8, color: C.danger, fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, userSelect: 'none', transition: 'background 150ms' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = '#213055'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = '#1A2340'; }}
            >⌫</div>
          </div>
        </div>
      </div>
    </div>
  );
}
