import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Gift Card List
 * Session 10 Decisions #213, #215, #218, #219
 * Card list with search by code or client name.
 * Tap a card → transaction history detail view.
 * Balance lookup by code.
 *
 * Renders in OwnerDashboard right panel as a tab of GiftCardModule.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_GIFT_CARDS, MOCK_GC_TRANSACTIONS } from './giftCardBridge';
import { useGiftCardStore } from '../../lib/stores/giftCardStore';
import { isProduction } from '../../lib/apiClient';
import { fmt } from '../../lib/formatUtils';



function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = d.getHours(); var ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  var min = d.getMinutes();
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
}

function formatDateShort(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export default function GiftCardList() {
  var T = useTheme();
  var _isProd = isProduction();
  var storeCards = useGiftCardStore(function(s) { return s.giftCards; });
  var fetchGiftCards = useGiftCardStore(function(s) { return s.fetchGiftCards; });
  var cards = _isProd ? storeCards : MOCK_GIFT_CARDS;

  // Fetch in production
  useEffect(function() { if (_isProd) fetchGiftCards(); }, []);

  var [searchText, setSearchText] = useState('');
  var [filterStatus, setFilterStatus] = useState('all');
  var [selectedCard, setSelectedCard] = useState(null);
  var [lookupCode, setLookupCode] = useState('');
  var [lookupResult, setLookupResult] = useState(null); // null | 'not_found' | card object

  var filtered = useMemo(function() {
    var result = cards;
    if (filterStatus !== 'all') {
      result = result.filter(function(c) { return c.status === filterStatus; });
    }
    if (searchText.trim()) {
      var q = searchText.trim().toLowerCase();
      result = result.filter(function(c) {
        return (c.code || '').toLowerCase().indexOf(q) !== -1 ||
               (c.client_name || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return result;
  }, [cards, searchText, filterStatus]);

  var totalLiability = cards.filter(function(c) { return c.status === 'active'; })
    .reduce(function(sum, c) { return sum + c.balance_cents; }, 0);

  function handleLookup() {
    if (lookupCode.length < 4) return;
    var q = lookupCode.replace(/\D/g, '');
    var found = cards.find(function(c) { return c.code.replace(/\D/g, '') === q; });
    setLookupResult(found || 'not_found');
  }

  function handleClearLookup() {
    setLookupCode('');
    setLookupResult(null);
  }

  // Physical keyboard + barcode scanner support for lookup
  useEffect(function() {
    if (selectedCard) return; // don't listen when detail view is open
    function onKey(e) {
      // Ignore if user is typing in the search textarea
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setLookupCode(function(p) { return p.length < 12 ? p + e.key : p; });
        setLookupResult(null);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setLookupCode(function(p) { return p.slice(0, -1); });
        setLookupResult(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Trigger lookup — same as Check Balance button
        setLookupCode(function(prev) {
          if (prev.length >= 4) {
            var q = prev.replace(/\D/g, '');
            var found = cards.find(function(c) { return c.code.replace(/\D/g, '') === q; });
            setLookupResult(found || 'not_found');
          }
          return prev;
        });
      } else if (e.key === 'Escape') {
        setLookupCode(''); setLookupResult(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [selectedCard, cards]);

  // ── DETAIL VIEW ──
  if (selectedCard) {
    var card = selectedCard;
    var transactions = MOCK_GC_TRANSACTIONS.filter(function(t) { return t.gift_card_id === card.id; })
      .sort(function(a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });

    return <GiftCardDetail card={card} transactions={transactions} onBack={function() { setSelectedCard(null); }} />;
  }

  // ── LIST VIEW ──
  return (
    <div style={{ maxWidth: 600 }}>
      {/* ── Balance Lookup + Stats ── */}
      <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 10 }}>Look up gift card</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left: Code display + stats underneath */}
          <div style={{ flex: 1 }}>
            <div
              onClick={function() {}}
              style={{
                width: '100%', minHeight: 44, backgroundColor: T.grid, border: '1px solid ' + T.border, borderRadius: 6,
                padding: '10px 14px', display: 'flex', alignItems: 'center',
                fontSize: 16, fontWeight: 600, color: lookupCode.length > 0 ? T.text : T.textMuted,
                fontFamily: 'monospace', letterSpacing: 2, boxSizing: 'border-box',
              }}
            >
              {lookupCode.length > 0 ? (
                lookupCode.replace(/(.{4})(?=.)/g, '$1-')
              ) : (
                <span style={{ fontSize: 13, fontWeight: 400, letterSpacing: 0 }}>Enter card number</span>
              )}
              <span style={{ display: lookupCode.length > 0 ? 'inline' : 'none', animation: 'none', marginLeft: 2, color: T.primary }}>|</span>
            </div>

            {/* Lookup result */}
            {lookupResult === 'not_found' && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.danger }}>No gift card found with that code</span>
                <div onClick={handleClearLookup} style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer' }}>Clear</div>
              </div>
            )}

            {lookupResult && lookupResult !== 'not_found' && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'monospace' }}>{lookupResult.code}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: lookupResult.type === 'digital' ? T.accentBg : 'rgba(249,115,22,0.12)', color: lookupResult.type === 'digital' ? T.blueLight : '#FB923C' }}>
                        {lookupResult.type === 'digital' ? 'Digital' : 'Physical'}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: lookupResult.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)', color: lookupResult.status === 'active' ? T.success : T.textMuted }}>
                        {lookupResult.status}
                      </span>
                      {lookupResult.client_name && <span style={{ fontSize: 11, color: T.textMuted }}>{lookupResult.client_name}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: lookupResult.balance_cents > 0 ? T.success : T.textMuted }}>{fmt(lookupResult.balance_cents)}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>of {fmt(lookupResult.initial_amount_cents)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div
                    onClick={function() { setSelectedCard(lookupResult); setLookupResult(null); setLookupCode(''); }}
                    onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
                    onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; }}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.text, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
                  >View details</div>
                  <div onClick={handleClearLookup} style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer' }}>Clear</div>
                </div>
              </div>
            )}

            {/* Stats — fill the empty space under code entry */}
            {!lookupResult && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                <div style={{ backgroundColor: T.grid, borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{cards.length}</div>
                </div>
                <div style={{ backgroundColor: T.grid, borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Active</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.success }}>{cards.filter(function(c) { return c.status === 'active'; }).length}</div>
                </div>
                <div style={{ backgroundColor: T.grid, borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Outstanding</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.warning }}>{fmt(totalLiability)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Numpad */}
          <div style={{ background: T.bg, border: '1px solid ' + T.border, borderRadius: 8, padding: 8, flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 4 }}>
              {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(k) {
                return (
                  <div key={k}
                    onClick={function() {
                      if (k === 'C') { setLookupCode(''); setLookupResult(null); }
                      else if (k === '⌫') { setLookupCode(function(p) { return p.slice(0, -1); }); setLookupResult(null); }
                      else if (lookupCode.length < 12) { setLookupCode(function(p) { return p + k; }); setLookupResult(null); }
                    }}
                    style={{
                      height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, fontSize: k === 'C' ? 12 : k === '⌫' ? 14 : 16, fontWeight: 500, cursor: 'pointer',
                      backgroundColor: T.chrome, color: k === '⌫' ? T.danger : k === 'C' ? T.warning : T.text,
                      border: '1px solid ' + T.border, userSelect: 'none',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
                    onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; }}
                  >{k}</div>
                );
              })}
            </div>
            {/* Check balance button */}
            <div
              onClick={handleLookup}
              onMouseEnter={function(e) { if (lookupCode.length >= 4) e.currentTarget.style.backgroundColor = '#1D4FD7'; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.primary; }}
              style={{
                width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5,
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: lookupCode.length >= 4 ? 'pointer' : 'default',
                backgroundColor: T.primary, color: '#fff', border: '1px solid ' + T.primary,
                opacity: lookupCode.length >= 4 ? 1 : 0.4, userSelect: 'none',
                transition: 'background-color 150ms',
              }}
            >Check balance</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 10 }}>
        <textarea
          value={searchText}
          onChange={function(e) { setSearchText(e.target.value); }}
          rows={1}
          placeholder="Search by code or client name..."
          style={{ width: '100%', height: 36, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 13, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'depleted', label: 'Depleted' }].map(function(opt) {
          var active = filterStatus === opt.key;
          return (
            <div
              key={opt.key}
              onClick={function() { setFilterStatus(opt.key); }}
              onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
              onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
              style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                backgroundColor: active ? T.primary : T.chrome, color: active ? '#fff' : T.textMuted,
                border: '1px solid ' + (active ? T.primary : T.border), userSelect: 'none',
                transition: 'background-color 150ms, color 150ms',
              }}
            >{opt.label}</div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{filtered.length} card{filtered.length !== 1 ? 's' : ''}</div>

      {/* Card rows */}
      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No gift cards found</div>
      )}

      {filtered.map(function(card) {
        return (
          <div
            key={card.id}
            onClick={function() { setSelectedCard(card); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 4, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            {/* Type icon */}
            <div style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, backgroundColor: card.type === 'digital' ? T.accentBg : 'rgba(249,115,22,0.12)', flexShrink: 0 }}>
              {card.type === 'digital' ? '💳' : '🎴'}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'monospace' }}>{card.code}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, fontWeight: 500, backgroundColor: card.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)', color: card.status === 'active' ? T.success : T.textMuted }}>
                  {card.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {card.client_name || 'Standalone'} · {formatDateShort(card.created_at)}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: card.balance_cents > 0 ? T.success : T.textMuted }}>{fmt(card.balance_cents)}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>of {fmt(card.initial_amount_cents)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════
// GIFT CARD DETAIL — with expandable receipt on transactions
// ════════════════════════════════════════════

function GiftCardDetail({ card, transactions, onBack }) {
  var T = useTheme();
  var [expandedTxnId, setExpandedTxnId] = useState(null);

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          onClick={onBack}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = T.gridHover; e.currentTarget.style.borderColor = T.textMuted; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.borderColor = T.border; }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
        >← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Gift card detail</span>
      </div>

      {/* Card info */}
      <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: 'monospace', letterSpacing: 1 }}>{card.code}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: card.type === 'digital' ? T.accentBg : 'rgba(249,115,22,0.12)', color: card.type === 'digital' ? T.blueLight : '#FB923C' }}>
                {card.type === 'digital' ? 'Digital' : 'Physical'}
              </span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: card.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)', color: card.status === 'active' ? T.success : T.textMuted }}>
                {card.status === 'active' ? 'Active' : 'Depleted'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: T.textMuted }}>Balance</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: card.balance_cents > 0 ? T.success : T.textMuted }}>{fmt(card.balance_cents)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
          <div><span style={{ color: T.textMuted }}>Initial amount: </span><span style={{ color: T.text }}>{fmt(card.initial_amount_cents)}</span></div>
          <div><span style={{ color: T.textMuted }}>Created: </span><span style={{ color: T.text }}>{formatDateShort(card.created_at)}</span></div>
          <div><span style={{ color: T.textMuted }}>Linked to: </span><span style={{ color: T.text }}>{card.client_name || 'Standalone (no client)'}</span></div>
          <div><span style={{ color: T.textMuted }}>Purchased by: </span><span style={{ color: T.text }}>{card.purchased_by_name || 'Unknown'}</span></div>
        </div>
      </div>

      {/* Transaction history */}
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Transaction history</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>Tap a redemption to see the original receipt</div>

      {transactions.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No transactions</div>
      )}

      {transactions.map(function(txn) {
        var isCredit = txn.amount_cents > 0;
        var typeLabel = txn.type === 'purchase' ? 'Purchase' : txn.type === 'reload' ? 'Reload' : 'Redemption';
        var typeColor = txn.type === 'purchase' ? T.primary : txn.type === 'reload' ? '#F59E0B' : T.danger;
        var hasReceipt = !!txn.receipt;
        var isExpanded = expandedTxnId === txn.id;

        return (
          <div key={txn.id} style={{ marginBottom: 4 }}>
            {/* Transaction row */}
            <div
              onClick={function() { if (hasReceipt) setExpandedTxnId(isExpanded ? null : txn.id); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                backgroundColor: isExpanded ? '#2A3A50' : T.grid, borderRadius: isExpanded ? '6px 6px 0 0' : 6,
                cursor: hasReceipt ? 'pointer' : 'default', transition: 'background-color 150ms',
              }}
              onMouseEnter={function(e) { if (hasReceipt && !isExpanded) e.currentTarget.style.backgroundColor = T.gridHover; }}
              onMouseLeave={function(e) { if (hasReceipt && !isExpanded) e.currentTarget.style.backgroundColor = T.grid; }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: typeColor, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{typeLabel}</span>
                  {txn.staff_name && <span style={{ fontSize: 11, color: T.textMuted }}>by {txn.staff_name}</span>}
                  {hasReceipt && <span style={{ fontSize: 10, color: T.primary, marginLeft: 4 }}>{isExpanded ? '▾' : '▸'} receipt</span>}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{formatDate(txn.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isCredit ? T.success : T.danger }}>
                  {isCredit ? '+' : '−'}{fmt(txn.amount_cents)}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>Bal: {fmt(txn.balance_after_cents)}</div>
              </div>
            </div>

            {/* Expanded receipt */}
            {isExpanded && txn.receipt && (
              <div style={{ backgroundColor: '#1A2A3E', borderRadius: '0 0 6px 6px', padding: '14px 16px', borderTop: '1px dashed ' + T.border }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Ticket #{txn.receipt.ticket_id}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{txn.receipt.client_name}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{formatDate(txn.created_at)}</div>
                </div>

                {/* Service items */}
                {txn.receipt.items.map(function(item, i) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < txn.receipt.items.length - 1 ? '1px solid rgba(71,85,105,0.4)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, color: T.text }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>Tech: {item.tech}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{fmt(item.price_cents)}</div>
                    </div>
                  );
                })}

                {/* Totals */}
                <div style={{ borderTop: '1px solid ' + T.border, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: T.textMuted }}>Subtotal</span>
                    <span style={{ color: T.text }}>{fmt(txn.receipt.subtotal_cents)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: T.textMuted }}>Tip</span>
                    <span style={{ color: T.text }}>{fmt(txn.receipt.tip_cents)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                    <span style={{ color: T.text }}>Total</span>
                    <span style={{ color: T.text }}>{fmt(txn.receipt.total_cents)}</span>
                  </div>
                </div>

                {/* Payment method */}
                <div style={{ marginTop: 8, padding: '8px 10px', backgroundColor: T.blueTint, borderRadius: 4, fontSize: 11, color: T.textSecondary }}>
                  Paid: {txn.receipt.paid_by}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
