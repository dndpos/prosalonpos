import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Ticket List Popup
 * Session 110 — TD-113 fix.
 * Shows OPEN tickets at top (click → checkout).
 * Shows CLOSED tickets below with date range filter (click → full Tickets page).
 * Launched from "Tickets" button in CalendarDayView top nav.
 */
import { useState, useEffect } from 'react';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { fmt } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function timeStr(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var h = d.getHours(); var m = d.getMinutes(); var ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + pad2(m) + ' ' + ap;
}

export default function TicketListPopup({ onClose, staffList, onOpenTicketCheckout, onGoToTickets }) {
  var T = useTheme();
  var _today = todayStr();
  var [fromDate, setFromDate] = useState(_today);
  var [toDate, setToDate] = useState(_today);
  var openTickets = useTicketStore(function(s) { return s.openTickets; });
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var loading = useTicketStore(function(s) { return s.loading; });

  useEffect(function() {
    fetchTickets(fromDate, toDate);
  }, [fromDate, toDate]);

  var sortedClosed = closedTickets.slice().sort(function(a, b) {
    var ta = a.closedAt || a.created_at || '';
    var tb = b.closedAt || b.created_at || '';
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  function staffName(id) {
    if (!staffList || !id) return '';
    var s = staffList.find(function(st) { return st.id === id; });
    return s ? (s.display_name || s.first_name || '') : '';
  }

  function ticketTotal(ticket) {
    var items = ticket.items || ticket.lineItems || [];
    return items.reduce(function(sum, it) { return sum + (it.price_cents || 0); }, 0);
  }

  var closedTotal = sortedClosed.reduce(function(sum, t) {
    if ((t.status || 'closed') === 'voided') return sum;
    return sum + ticketTotal(t);
  }, 0);

  function handleOpenClick(ticket) {
    if (onOpenTicketCheckout) {
      onOpenTicketCheckout([ticket.id]);
      onClose();
    }
  }

  function handleClosedClick() {
    if (onGoToTickets) {
      onGoToTickets();
      onClose();
    }
  }

  var inputStyle = {
    height: 34, padding: '0 10px', fontSize: 13, fontWeight: 500,
    color: T.text, background: T.grid,
    border: '2px solid ' + T.borderMedium, borderRadius: 6,
    fontFamily: "'Inter',system-ui,sans-serif", outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }} onClick={onClose}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: T.chrome, border: '1px solid ' + T.borderMedium, borderRadius: 10, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + T.borderLight, flexShrink: 0 }}>
          <AreaTag id="TKTLIST" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Tickets</div>
            <div onClick={onClose} style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer', padding: '4px 10px', borderRadius: 5, border: '1px solid ' + T.borderMedium }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
            >Close</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>From</span>
            <input type="date" value={fromDate} onChange={function(e) { setFromDate(e.target.value); }} style={inputStyle} />
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>To</span>
            <input type="date" value={toDate} onChange={function(e) { setToDate(e.target.value); }} style={inputStyle} />
            <div onClick={function() { setFromDate(_today); setToDate(_today); }}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: T.grid, color: T.blueLight, border: '1px solid ' + T.borderMedium }}
              onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
            >Today</div>
          </div>
        </div>

        {/* Ticket list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 12px' }}>

          {/* ── Open Tickets ── */}
          {openTickets.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 4px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
                Open — Waiting for Payment ({openTickets.length})
              </div>
              {openTickets.map(function(ticket) {
                var items = ticket.items || ticket.lineItems || [];
                var total = ticketTotal(ticket);
                var clientName = ticket.client_name || ticket.clientName || 'Walk-in';
                var tech = staffName(ticket.createdBy);
                var createdTime = timeStr(ticket.created_at);

                return (
                  <div key={ticket.id}
                    onClick={function() { handleOpenClick(ticket); }}
                    style={{ padding: '10px 14px', marginBottom: 4, borderRadius: 6, border: '1px solid #D9770644', background: '#D9770611', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#D9770622'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#D9770611'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{clientName}</span>
                        {tech && <span style={{ fontSize: 11, color: T.textMuted }}>by {tech}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#D9770633', color: '#D97706', fontWeight: 600 }}>OPEN</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>{fmt(total)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      {items.map(function(it, idx) {
                        return (
                          <span key={idx} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: T.grid, color: T.textSecondary, fontWeight: 500 }}>
                            {it.name} {fmt(it.price_cents || 0)}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {createdTime && <span style={{ fontSize: 10, color: T.textMuted }}>{createdTime}</span>}
                      <span style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>Tap to checkout →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Closed Tickets ── */}
          {sortedClosed.length > 0 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 4px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
              Closed ({sortedClosed.length})
            </div>
          )}

          {loading && <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading...</div>}
          {!loading && sortedClosed.length === 0 && openTickets.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No tickets found for this date range.</div>
          )}
          {!loading && sortedClosed.map(function(ticket) {
            var items = ticket.items || ticket.lineItems || [];
            var total = ticketTotal(ticket);
            var clientName = ticket.client_name || ticket.clientName || 'Walk-in';
            var tech = staffName(ticket.createdBy || ticket.closedBy);
            var closedTime = timeStr(ticket.closedAt);
            var status = ticket.status || 'closed';
            var isVoided = status === 'voided';
            var isRefunded = status === 'refunded';
            var statusColor = isVoided ? '#EF4444' : isRefunded ? '#F59E0B' : '#22C55E';
            var statusLabel = isVoided ? 'VOID' : isRefunded ? 'REFUND' : 'CLOSED';

            return (
              <div key={ticket.id}
                onClick={function() { handleClosedClick(); }}
                style={{ padding: '10px 14px', marginBottom: 4, borderRadius: 6, border: '1px solid ' + T.borderMedium, background: T.chromeDark, opacity: isVoided ? 0.5 : 1, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.chromeDark; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{clientName}</span>
                    {tech && <span style={{ fontSize: 11, color: T.textMuted }}>by {tech}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: statusColor + '22', color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isVoided ? T.textMuted : '#22C55E', textDecoration: isVoided ? 'line-through' : 'none' }}>{fmt(total)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {items.map(function(it, idx) {
                    return (
                      <span key={idx} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: T.grid, color: T.textSecondary, fontWeight: 500 }}>
                        {it.name} {fmt(it.price_cents || 0)}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {closedTime && <span style={{ fontSize: 10, color: T.textMuted }}>{closedTime}</span>}
                  {!isVoided && <span style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500 }}>Tap for details →</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid ' + T.borderLight, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: T.textSecondary }}>
            {openTickets.length > 0 && <span style={{ color: '#D97706', fontWeight: 600 }}>{openTickets.length} open</span>}
            {openTickets.length > 0 && sortedClosed.length > 0 && <span> · </span>}
            {sortedClosed.length} closed
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#22C55E' }}>{fmt(closedTotal)}</span>
        </div>
      </div>
    </div>
  );
}
