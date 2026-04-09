import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
/**
 * Pro Salon POS — Membership Members
 * Session 12 Decisions #239, #240, #243
 * Client membership list: status badges, billing history, freeze/cancel actions.
 * Tap a member → detail view with transaction history and actions.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_BILLING_TRANSACTIONS, STATUS_COLORS, TXN_COLORS, cycleName } from './membershipBridge';
import { useMembershipStore } from '../../lib/stores/membershipStore';
import AreaTag from '../../components/ui/AreaTag';


function formatDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function formatDateTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = d.getHours(); var ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  var min = d.getMinutes();
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
}

function dollars(cents) { return '$' + (cents / 100).toFixed(2); }

export default function MembershipMembers() {
  var T = useTheme();
  var toast = useToast();
  var members = useMembershipStore(function(s) { return s.members; }).map(function(m) {
    // Normalize API shape → flat fields used in rendering
    return Object.assign({}, m, {
      client_name: m.client_name || (m.client ? (m.client.first_name + ' ' + (m.client.last_name || '')).trim() : 'Unknown'),
      plan_name: m.plan_name || (m.plan ? m.plan.name : ''),
      next_billing_date: m.next_billing_date || m.next_billing || null,
      current_credit_cents: m.current_credit_cents || 0,
      free_services_remaining: m.free_services_remaining || 0,
      cycles_completed: m.cycles_completed || 0,
      freeze_until: m.freeze_until || m.frozen_at || null,
    });
  });
  var fetchMembers = useMembershipStore(function(s) { return s.fetchMembers; });
  var storeUpdateMember = useMembershipStore(function(s) { return s.updateMember; });
  var storePlans = useMembershipStore(function(s) { return s.plans; });

  useEffect(function() { fetchMembers(); }, []);
  var [searchText, setSearchText] = useState('');
  var [filterStatus, setFilterStatus] = useState('all');
  var [selectedMember, setSelectedMember] = useState(null);
  var [showFreezePopup, setShowFreezePopup] = useState(false);
  var [freezeDateStr, setFreezeDateStr] = useState('');

  var statusFilters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'paused', label: 'Paused' },
    { id: 'frozen', label: 'Frozen' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  var filtered = useMemo(function() {
    var list = members;
    if (filterStatus !== 'all') list = list.filter(function(m) { return m.status === filterStatus; });
    if (searchText.trim()) {
      var q = searchText.trim().toLowerCase();
      list = list.filter(function(m) { return (m.client_name || '').toLowerCase().indexOf(q) !== -1 || (m.plan_name || '').toLowerCase().indexOf(q) !== -1; });
    }
    return list;
  }, [members, searchText, filterStatus]);

  var stats = useMemo(function() {
    var active = members.filter(function(m) { return m.status === 'active'; }).length;
    var frozen = members.filter(function(m) { return m.status === 'frozen'; }).length;
    var totalCredit = members.reduce(function(s, m) { return s + (m.status !== 'cancelled' ? m.current_credit_cents : 0); }, 0);
    var revenue = MOCK_BILLING_TRANSACTIONS.filter(function(t) { return t.type === 'payment'; }).reduce(function(s, t) { return s + t.amount_cents; }, 0);
    return { active: active, frozen: frozen, totalCredit: totalCredit, revenue: revenue };
  }, [members]);

  // Actions — update local state immediately, API in background
  function handleFreeze(memberId, until) {
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(function(prev) { return Object.assign({}, prev, { status: 'frozen', freeze_until: until }); });
    }
    setShowFreezePopup(false);
    setFreezeDateStr('');
    storeUpdateMember(memberId, { status: 'frozen' }).then(function() {
      toast.show('Membership frozen', 'success');
    }).catch(function(err) { toast.show('Failed: ' + err.message, 'error'); });
  }

  function handleUnfreeze(memberId) {
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(function(prev) { return Object.assign({}, prev, { status: 'active', freeze_until: null }); });
    }
    storeUpdateMember(memberId, { status: 'active' }).then(function() {
      toast.show('Membership reactivated', 'success');
    }).catch(function(err) { toast.show('Failed: ' + err.message, 'error'); });
  }

  function handleCancel(memberId) {
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(function(prev) { return Object.assign({}, prev, { status: 'cancelled', cancelled_at: new Date().toISOString() }); });
    }
    storeUpdateMember(memberId, { status: 'cancelled' }).then(function() {
      toast.show('Membership cancelled', 'success');
    }).catch(function(err) { toast.show('Failed: ' + err.message, 'error'); });
  }

  function handleReactivate(memberId) {
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(function(prev) { return Object.assign({}, prev, { status: 'active', cancelled_at: null, freeze_until: null }); });
    }
    storeUpdateMember(memberId, { status: 'active' }).then(function() {
      toast.show('Membership reactivated', 'success');
    }).catch(function(err) { toast.show('Failed: ' + err.message, 'error'); });
  }

  // ── MEMBER DETAIL ──
  if (selectedMember) {
    var cm = selectedMember;
    var plan = cm.plan || storePlans.find(function(p) { return p.id === cm.plan_id; });
    var txns = MOCK_BILLING_TRANSACTIONS.filter(function(t) { return t.membership_id === cm.id; })
      .sort(function(a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });
    var sc = STATUS_COLORS[cm.status] || STATUS_COLORS.active;

    return (
      <div>
        {/* Back + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div onClick={function() { setSelectedMember(null); setShowFreezePopup(false); }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.borderColor = T.textMuted; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 18, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
          >← Back</div>
          <span style={{ fontSize: 24, fontWeight: 600, color: T.text }}>{cm.client_name}</span>
          <span style={{ fontSize: 20, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: sc.bg, color: sc.text }}>{cm.status.charAt(0).toUpperCase() + cm.status.slice(1)}</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Plan</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{cm.plan_name}</div>
            {plan && <div style={{ fontSize: 18, color: T.textSecondary, marginTop: 2 }}>{dollars(plan.price_cents)}/{cycleName(plan.billing_cycle_days).toLowerCase()}</div>}
          </div>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Credit balance</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: cm.current_credit_cents > 0 ? T.success : T.textMuted }}>{dollars(cm.current_credit_cents)}</div>
          </div>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Free services left</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: cm.free_services_remaining > 0 ? T.primary : T.textMuted }}>{cm.free_services_remaining}</div>
          </div>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cycles completed</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: T.text }}>{cm.cycles_completed}</div>
          </div>
        </div>

        {/* Key dates */}
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span style={{ fontSize: 18, color: T.textSecondary }}>Member since </span><span style={{ fontSize: 20, color: T.text }}>{formatDate(cm.started_at)}</span></div>
          {cm.next_billing_date && <div><span style={{ fontSize: 18, color: T.textSecondary }}>Next billing </span><span style={{ fontSize: 20, color: T.text }}>{formatDate(cm.next_billing_date)}</span></div>}
          {cm.freeze_until && <div><span style={{ fontSize: 18, color: T.textSecondary }}>Frozen until </span><span style={{ fontSize: 20, color: T.blueLight }}>{formatDate(cm.freeze_until)}</span></div>}
          {cm.cancelled_at && <div><span style={{ fontSize: 18, color: T.textSecondary }}>Cancelled </span><span style={{ fontSize: 20, color: T.danger }}>{formatDate(cm.cancelled_at)}</span></div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {cm.status === 'active' && (
            <>
              {(plan && plan.freeze_allowed) && (
                <div onClick={function() { setShowFreezePopup(!showFreezePopup); }}
                  onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#2A3A50'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #3B82F6', backgroundColor: T.chrome, color: T.blueLight, fontSize: 20, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
                >Freeze membership</div>
              )}
              <div onClick={function() { toast.confirm('Cancel this membership? Effective at end of current period.', function() { handleCancel(cm.id); }); }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#2A2030'; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid ' + T.danger, backgroundColor: T.chrome, color: T.danger, fontSize: 20, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
              >Cancel membership</div>
            </>
          )}
          {cm.status === 'frozen' && (
            <div onClick={function() { handleUnfreeze(cm.id); }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: T.primary, color: '#fff', fontSize: 20, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            >Unfreeze now</div>
          )}
          {(cm.status === 'paused' || cm.status === 'cancelled') && (
            <div onClick={function() { handleReactivate(cm.id); }}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#16A34A'; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.success; }}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: T.success, color: '#fff', fontSize: 20, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            >Reactivate</div>
          )}
        </div>

        {/* Freeze date popup */}
        {showFreezePopup && (
          <div style={{ backgroundColor: '#0F172A', border: '1px solid ' + T.border, borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 320 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: T.text, marginBottom: 8 }}>Set freeze end date</div>
            <input type="date" value={freezeDateStr} onChange={function(e) { setFreezeDateStr(e.target.value); }}
              style={{ backgroundColor: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 12px', fontSize: 22, fontFamily: 'inherit', marginBottom: 8, width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={function() { if (freezeDateStr) handleFreeze(cm.id, freezeDateStr); }}
                style={{ padding: '7px 16px', borderRadius: 6, backgroundColor: freezeDateStr ? T.primary : T.grid, color: freezeDateStr ? '#fff' : T.textMuted, fontSize: 20, fontWeight: 500, cursor: freezeDateStr ? 'pointer' : 'default' }}
              >Confirm freeze</div>
              <div onClick={function() { setShowFreezePopup(false); setFreezeDateStr(''); }}
                style={{ padding: '7px 16px', borderRadius: 6, backgroundColor: T.grid, border: '1px solid ' + T.border, color: T.textSecondary, fontSize: 20, cursor: 'pointer' }}
              >Cancel</div>
            </div>
          </div>
        )}

        {/* Billing history */}
        <div style={{ fontSize: 22, fontWeight: 600, color: T.text, marginBottom: 10 }}>Billing history</div>
        {txns.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textSecondary, fontSize: 20 }}>No transactions</div>}

        {txns.map(function(txn) {
          var typeColor = TXN_COLORS[txn.type] || T.textMuted;
          var typeLabel = txn.type.charAt(0).toUpperCase() + txn.type.slice(1);
          return (
            <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: T.grid, borderRadius: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: typeColor, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{typeLabel}</div>
                <div style={{ fontSize: 20, color: T.textSecondary, marginTop: 2 }}>{txn.note}</div>
                <div style={{ fontSize: 18, color: T.textSecondary, marginTop: 1 }}>{formatDateTime(txn.created_at)}</div>
              </div>
              {txn.amount_cents !== 0 && (
                <div style={{ fontSize: 22, fontWeight: 600, color: txn.amount_cents > 0 ? T.success : T.danger }}>
                  {txn.amount_cents > 0 ? '+' : ''}{dollars(txn.amount_cents)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Active members</div>
          <div style={{ fontSize: 32, fontWeight: 500, color: T.success }}>{stats.active}</div>
        </div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Frozen</div>
          <div style={{ fontSize: 32, fontWeight: 500, color: T.blueLight }}>{stats.frozen}</div>
        </div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Outstanding credits</div>
          <div style={{ fontSize: 32, fontWeight: 500, color: T.warning }}>{dollars(stats.totalCredit)}</div>
        </div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 20, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total collected</div>
          <div style={{ fontSize: 32, fontWeight: 500, color: T.text }}>{dollars(stats.revenue)}</div>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <textarea value={searchText} onChange={function(e) { setSearchText(e.target.value); }} rows={1} placeholder="Search by client or plan name..."
          style={{ flex: 1, height: 36, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 22, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {statusFilters.map(function(sf) {
          var active = filterStatus === sf.id;
          return (
            <div key={sf.id} onClick={function() { setFilterStatus(sf.id); }}
              onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
              onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.grid; e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.border; } }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 18, fontWeight: 500,
                cursor: 'pointer', userSelect: 'none',
                backgroundColor: active ? T.primary : T.grid,
                color: active ? '#FFFFFF' : T.textSecondary,
                border: '1px solid ' + (active ? T.primary : T.border),
                transition: 'background-color 150ms, color 150ms',
              }}
            >{sf.label}</div>
          );
        })}
      </div>

      <div style={{ fontSize: 22, color: T.textSecondary, marginBottom: 8 }}>{filtered.length} member{filtered.length !== 1 ? 's' : ''}</div>

      {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textSecondary, fontSize: 20 }}>No members found</div>}

      {filtered.map(function(m) {
        var sc = STATUS_COLORS[m.status] || STATUS_COLORS.active;
        return (
          <div key={m.id}
            onClick={function() { setSelectedMember(m); setShowFreezePopup(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 4, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3B4A63'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
        <AreaTag id="MB-MEM" />
            {/* Avatar */}
            <div style={{ width: 36, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 600, backgroundColor: 'rgba(139,92,246,0.2)', color: '#C4B5FD', flexShrink: 0 }}>
              {(m.client_name || '').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{m.client_name}</span>
                <span style={{ fontSize: 18, padding: '1px 6px', borderRadius: 3, fontWeight: 500, backgroundColor: sc.bg, color: sc.text }}>{m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span>
              </div>
              <div style={{ fontSize: 20, color: T.textSecondary, marginTop: 2 }}>{m.plan_name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {m.current_credit_cents > 0 && <div style={{ fontSize: 22, fontWeight: 600, color: T.success }}>{dollars(m.current_credit_cents)}</div>}
              {m.next_billing_date && <div style={{ fontSize: 18, color: T.textSecondary }}>Due {formatDate(m.next_billing_date)}</div>}
              {m.freeze_until && <div style={{ fontSize: 18, color: T.blueLight }}>Until {formatDate(m.freeze_until)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
