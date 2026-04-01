import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Loyalty Members
 * Session 11 Decision #229
 * Client loyalty overview: points balance, tier, lifetime total.
 * Tap a client → point transaction history.
 */

import React, { useState, useMemo } from 'react';
import { MOCK_CLIENT_LOYALTY, MOCK_LOYALTY_TRANSACTIONS, MOCK_LOYALTY_TIERS, TIER_COLORS } from './loyaltyBridge';
import { useLoyaltyStore } from '../../lib/stores/loyaltyStore';
import { isProduction } from '../../lib/apiClient';


function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = d.getHours(); var ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  var min = d.getMinutes();
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
}

export default function LoyaltyMembers() {
  var T = useTheme();
  var _isProd = isProduction();
  var storeMembers = useLoyaltyStore(function(s) { return s.members; });
  var members = _isProd ? storeMembers : MOCK_CLIENT_LOYALTY;
  var [searchText, setSearchText] = useState('');
  var [selectedClient, setSelectedClient] = useState(null);

  var filtered = useMemo(function() {
    if (!searchText.trim()) return members;
    var q = searchText.trim().toLowerCase();
    return members.filter(function(m) { return (m.name || '').toLowerCase().indexOf(q) !== -1; });
  }, [members, searchText]);

  var totalPoints = members.reduce(function(s, m) { return s + m.points_balance; }, 0);

  // ── CLIENT DETAIL ──
  if (selectedClient) {
    var cl = selectedClient;
    var txns = MOCK_LOYALTY_TRANSACTIONS.filter(function(t) { return t.client_id === cl.client_id; })
      .sort(function(a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });
    var tierColors = cl.tier_id ? (TIER_COLORS[cl.tier_id] || { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' }) : null;

    // Find next tier
    var nextTier = null;
    if (cl.tier_id) {
      var currentTier = MOCK_LOYALTY_TIERS.find(function(t) { return t.id === cl.tier_id; });
      if (currentTier) {
        var higher = MOCK_LOYALTY_TIERS.filter(function(t) { return t.threshold_points > currentTier.threshold_points; }).sort(function(a, b) { return a.threshold_points - b.threshold_points; });
        if (higher.length > 0) nextTier = higher[0];
      }
    }

    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div onClick={function() { setSelectedClient(null); }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
          >← Back</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{cl.name}</span>
          {tierColors && <span style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: tierColors.bg, color: tierColors.text }}>{cl.tier_name}</span>}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Balance</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.success }}>{cl.points_balance.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Lifetime</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{cl.lifetime_points.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Next tier</div>
            {nextTier ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{nextTier.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{(nextTier.threshold_points - cl.lifetime_points).toLocaleString()} pts away</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>Max tier</div>
            )}
          </div>
        </div>

        {/* Tier progress bar */}
        {nextTier && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textMuted, marginBottom: 4 }}>
              <span>{cl.tier_name}</span>
              <span>{nextTier.name} ({nextTier.threshold_points.toLocaleString()} pts)</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, backgroundColor: T.grid, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, backgroundColor: T.primary, width: Math.min(100, (cl.lifetime_points / nextTier.threshold_points) * 100) + '%', transition: 'width 300ms' }} />
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Point history</div>
        {txns.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No transactions</div>}

        {txns.map(function(txn) {
          var isEarn = txn.points > 0;
          var typeLabel = txn.type === 'earn' ? 'Earned' : txn.type === 'redeem' ? 'Redeemed' : txn.type === 'expire' ? 'Expired' : 'Void reversal';
          var typeColor = txn.type === 'earn' ? T.success : txn.type === 'redeem' ? T.primary : txn.type === 'expire' ? T.warning : T.danger;

          return (
            <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: T.grid, borderRadius: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: typeColor, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{typeLabel}</span>
                  {txn.reward_name && <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, backgroundColor: T.accentBg, color: T.blueLight }}>{txn.reward_name}</span>}
                </div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{txn.note}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{formatDate(txn.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isEarn ? T.success : T.danger }}>
                  {isEarn ? '+' : ''}{txn.points}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Bal: {txn.balance_after.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Members</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{members.length}</div>
        </div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total pts outstanding</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.warning }}>{totalPoints.toLocaleString()}</div>
        </div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avg balance</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{members.length > 0 ? Math.round(totalPoints / members.length).toLocaleString() : 0}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 10 }}>
        <textarea value={searchText} onChange={function(e) { setSearchText(e.target.value); }} rows={1} placeholder="Search by client name..."
          style={{ width: '100%', height: 36, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{filtered.length} member{filtered.length !== 1 ? 's' : ''}</div>

      {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No members found</div>}

      {filtered.map(function(m) {
        var tierColors = m.tier_id ? (TIER_COLORS[m.tier_id] || { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' }) : null;
        return (
          <div key={m.client_id}
            onClick={function() { setSelectedClient(m); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 4, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, backgroundColor: T.accentBg, color: T.blueLight, flexShrink: 0 }}>
              {(m.name || '').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{m.name}</span>
                {tierColors && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, fontWeight: 500, backgroundColor: tierColors.bg, color: tierColors.text }}>{m.tier_name}</span>}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Lifetime: {m.lifetime_points.toLocaleString()} pts</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.success }}>{m.points_balance.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
