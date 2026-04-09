/**
 * ticketStore.js — Zustand Store for Checkout Tickets
 * Session 88 | Mock data REMOVED — API only
 *
 * KEY CONCEPT: A "ticket" is created when a service is completed and goes to checkout.
 * Open tickets are waiting for payment. Closed tickets are paid.
 *
 * Usage:
 *   import { useTicketStore } from '../lib/stores/ticketStore';
 *   const openTickets = useTicketStore(s => s.openTickets);
 *   const { createTicket, closeTicket, voidTicket } = useTicketStore();
 */

import { create } from 'zustand';
import { api, isBackendAvailable, checkBackend } from '../apiClient';
import { useGiftCardStore } from './giftCardStore';

// Compare two ticket arrays by id + status — avoids unnecessary store updates
function arraysMatch(prev, next) {
  if (prev.length !== next.length) return false;
  for (var i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id || prev[i].status !== next[i].status) return false;
  }
  return true;
}

var useTicketStore = create(function(set, get) {
  // Ticket IDs that have been locally removed (e.g. merged/closed optimistically)
  // but the server transaction may not have committed yet. fetchTickets will
  // filter these out so they don't flash back into the open list.
  var _pendingRemovals = {};

  return {
    // ─── State ───
    openTickets: [],
    closedTickets: [],
    mergedTickets: [],
    loading: false,
    error: null,
    source: 'pending',
    initialized: false,
    nextTicketNumber: 1,

    // ─── Actions ───

    fetchTickets: async function(startDate, endDate) {
      if (isBackendAvailable() === false) {
        set({ initialized: true, source: 'error', error: 'Server not available' });
        return;
      }

      // Silent refresh: only show loading spinner on very first fetch.
      var hasData = get().initialized;
      if (!hasData) {
        set({ loading: true, error: null });
      }
      try {
        var path = '/checkout/tickets';
        if (startDate && endDate) {
          path += '?start=' + startDate + '&end=' + endDate;
        } else if (startDate) {
          path += '?date=' + startDate;
        }
        var data = await api.get(path);
        var tickets = data.tickets || [];

        var open = tickets.filter(function(t) { return t.status === 'open'; });
        var merged = tickets.filter(function(t) { return t.status === 'merged'; });
        var closed = tickets.filter(function(t) { return t.status !== 'open' && t.status !== 'merged'; });

        // Filter out tickets that were locally removed but server hasn't committed yet.
        var now = Date.now();
        var pendingIds = Object.keys(_pendingRemovals);
        if (pendingIds.length > 0) {
          open = open.filter(function(t) {
            if (_pendingRemovals[t.id] && (now - _pendingRemovals[t.id]) < 10000) {
              return false;
            }
            if (_pendingRemovals[t.id]) delete _pendingRemovals[t.id];
            return true;
          });
        }

        // Compare before replacing — skip update if arrays have same IDs+statuses
        var prev = get();
        var sameOpen = arraysMatch(prev.openTickets, open);
        // Preserve optimistic placeholders — server doesn't know about them yet
        var placeholders = prev.closedTickets.filter(function(t) { return t._placeholder; });
        if (placeholders.length > 0) {
          var serverIds = {};
          closed.forEach(function(t) { serverIds[t.id] = true; });
          // Keep placeholders whose real ticket hasn't appeared from the server yet
          placeholders.forEach(function(ph) {
            if (!serverIds[ph.id]) closed.unshift(ph);
          });
        }
        var sameClosed = arraysMatch(prev.closedTickets, closed);
        var sameMerged = arraysMatch(prev.mergedTickets, merged);

        var update = { loading: false, source: 'api', initialized: true };
        if (!sameOpen) update.openTickets = open;
        if (!sameClosed) update.closedTickets = closed;
        if (!sameMerged) update.mergedTickets = merged;
        set(update);
      } catch (err) {
        set({ loading: false, error: err.message, initialized: true, source: 'error' });
      }
    },

    fetchNextTicketNumber: async function() {
      try {
        var data = await api.get('/checkout/next-ticket-number');
        set({ nextTicketNumber: data.nextTicketNumber || 1 });
        return data.nextTicketNumber || 1;
      } catch (err) {
        console.warn('[ticketStore] Next ticket number fetch failed:', err.message);
        return get().nextTicketNumber;
      }
    },

    createTicket: async function(ticketData) {
      var data = await api.post('/checkout/tickets', ticketData);
      var ticket = data.ticket;
      set(function(s) {
        return { openTickets: s.openTickets.concat([ticket]) };
      });
      return ticket;
    },

    quickCloseTicket: async function(ticketData) {
      // Optimistic placeholder — appears instantly in View Tickets while Railway processes
      var placeholderId = 'placeholder-' + Date.now();
      var nowIso = new Date().toISOString();
      var placeholder = {
        id: placeholderId, _placeholder: true, status: 'paid',
        ticket_number: 0, ticketNumber: 0,
        client_name: ticketData.client_name || null, clientName: ticketData.client_name || null,
        subtotal_cents: ticketData.subtotal_cents || 0, subtotalCents: ticketData.subtotal_cents || 0,
        tax_cents: ticketData.tax_cents || 0, taxCents: ticketData.tax_cents || 0,
        discount_cents: ticketData.discount_cents || 0, discountCents: ticketData.discount_cents || 0,
        tip_cents: ticketData.tip_cents || 0, tipCents: ticketData.tip_cents || 0,
        total_cents: ticketData.total_cents || 0, totalCents: ticketData.total_cents || 0,
        payment_method: ticketData.payment_method || null, paymentMethod: ticketData.payment_method || null,
        deposit_cents: ticketData.deposit_cents || 0, depositCents: ticketData.deposit_cents || 0,
        pkg_redeemed_cents: ticketData.pkg_redeemed_cents || 0, pkgRedeemCents: ticketData.pkg_redeemed_cents || 0,
        refunds: [], refundedItemIds: {},
        items: (ticketData.items || []).map(function(it, i) {
          return { id: 'ph-item-' + i, name: it.name, price_cents: it.price_cents, original_price_cents: it.original_price_cents || it.price_cents, tech_name: it.tech_name, tech: it.tech_name, techId: it.tech_id, tech_id: it.tech_id, type: it.type || 'service', color: it.color || null };
        }),
        payments: (ticketData.payments || []).map(function(p, i) {
          return { id: 'ph-pay-' + i, method: p.method, amount_cents: p.amount_cents };
        }),
        created_at: nowIso, createdAt: Date.now(), closedAt: Date.now(),
      };
      set(function(s) {
        return { closedTickets: [placeholder].concat(s.closedTickets) };
      });
      try {
        var data = await api.post('/checkout/tickets/quick-close', ticketData);
        var ticket = data.ticket;
        set(function(s) {
          return { closedTickets: [ticket].concat(s.closedTickets.filter(function(t) { return t.id !== placeholderId; })) };
        });
        return ticket;
      } catch (err) {
        // Remove placeholder on failure — caller's error handler will manage
        set(function(s) {
          return { closedTickets: s.closedTickets.filter(function(t) { return t.id !== placeholderId; }) };
        });
        throw err;
      }
    },

    updateTicket: async function(ticketId, updates) {
      var data = await api.put('/checkout/tickets/' + ticketId, updates);
      set(function(s) {
        return {
          openTickets: s.openTickets.map(function(t) {
            return t.id === ticketId ? data.ticket : t;
          }),
        };
      });
      return data.ticket;
    },

    addPayment: async function(ticketId, paymentData) {
      var data = await api.post('/checkout/tickets/' + ticketId + '/pay', paymentData);
      return data.payment;
    },

    closeTicket: async function(ticketId, closeData) {
      // Optimistic: move ticket from open to closed immediately
      var openTicket = get().openTickets.find(function(t) { return t.id === ticketId; });
      if (openTicket) {
        var placeholder = Object.assign({}, openTicket, { status: 'paid', _placeholder: true,
          total_cents: closeData.total_cents || openTicket.total_cents || 0,
          totalCents: closeData.total_cents || openTicket.totalCents || 0,
          payment_method: closeData.payment_method || null,
          paymentMethod: closeData.payment_method || null,
          tip_cents: closeData.tip_cents || 0,
          tipCents: closeData.tip_cents || 0,
          closedAt: Date.now(),
        });
        set(function(s) {
          return {
            openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
            closedTickets: [placeholder].concat(s.closedTickets),
          };
        });
      }
      try {
        var data = await api.post('/checkout/tickets/' + ticketId + '/close', closeData);
        set(function(s) {
          return {
            openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
            closedTickets: [data.ticket].concat(s.closedTickets.filter(function(t) { return t.id !== ticketId; })),
          };
        });
        return data.ticket;
      } catch (err) {
        // Rollback: move ticket back to open
        if (openTicket) {
          set(function(s) {
            return {
              closedTickets: s.closedTickets.filter(function(t) { return t.id !== ticketId || !t._placeholder; }),
              openTickets: s.openTickets.concat([openTicket]),
            };
          });
        }
        throw err;
      }
    },

    voidTicket: async function(ticketId, voidData) {
      var data = await api.post('/checkout/tickets/' + ticketId + '/void', voidData);
      set(function(s) {
        return {
          openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
          closedTickets: s.closedTickets.map(function(t) {
            return t.id === ticketId ? data.ticket : t;
          }),
        };
      });
      return data.ticket;
    },

    refundTicket: async function(ticketId, refundData) {
      var data = await api.post('/checkout/tickets/' + ticketId + '/refund', refundData);
      if (data.ticket) {
        set(function(s) {
          return {
            closedTickets: s.closedTickets.map(function(t) {
              return t.id === ticketId ? data.ticket : t;
            }),
          };
        });
      }
      // Refresh gift card balances in case refund restored a gift card
      try { useGiftCardStore.getState().fetchGiftCards(); } catch(e) {}
      return data.refund;
    },

    deletePayments: async function(ticketId) {
      var data = await api.del('/checkout/tickets/' + ticketId + '/payments');
      return data;
    },

    updateTip: async function(ticketId, tipData) {
      var data = await api.put('/checkout/tickets/' + ticketId + '/tip', tipData);
      set(function(s) {
        return {
          closedTickets: s.closedTickets.map(function(t) {
            return t.id === ticketId ? data.ticket : t;
          }),
        };
      });
      return data.ticket;
    },

    reopenTicket: async function(ticketId) {
      // Call dedicated reopen endpoint — sets paid→open on server
      try {
        var data = await api.post('/checkout/tickets/' + ticketId + '/reopen');
        var ticket = data.ticket;
        set(function(s) {
          return {
            closedTickets: s.closedTickets.filter(function(t) { return t.id !== ticketId; }),
            openTickets: s.openTickets.concat([ticket]),
          };
        });
        return ticket;
      } catch (err) {
        console.error('[ticketStore] Reopen FAILED:', err.message);
        alert('⚠ Reopen failed: ' + (err.message || 'Server error') + '\n\nCheck server terminal for details.');
        return null;
      }
    },

    mergeTickets: async function(ticketIds, skipStoreUpdate) {
      var data = await api.post('/checkout/tickets/merge', { ticketIds: ticketIds });
      var absorber = data.ticket;
      // Skip store update when caller already removed tickets (e.g. close path)
      if (!skipStoreUpdate) {
        set(function(s) {
          var remaining = s.openTickets.filter(function(t) {
            return !ticketIds.includes(t.id);
          });
          return { openTickets: remaining.concat([absorber]) };
        });
      }
      return absorber;
    },

    mergeAndClose: async function(ticketIds, payments, closeData) {
      // Mark all tickets as pending removal BEFORE the API call.
      var now = Date.now();
      ticketIds.forEach(function(id) { _pendingRemovals[id] = now; });

      // Optimistic: build a placeholder closed ticket from the open tickets being merged
      var openList = get().openTickets;
      var mergedItems = [];
      var placeholderNumber = [];
      ticketIds.forEach(function(id) {
        var t = openList.find(function(ot) { return ot.id === id; });
        if (t) {
          placeholderNumber.push(t.ticket_number || '?');
          (t.items || []).forEach(function(it) { mergedItems.push(it); });
        }
      });
      var placeholderId = 'placeholder-merge-' + now;
      var nowIso = new Date().toISOString();
      var placeholder = {
        id: placeholderId, _placeholder: true, status: 'paid',
        ticket_number: placeholderNumber[0] || 0, ticketNumber: placeholderNumber[0] || 0,
        display_number: placeholderNumber.join('&'), displayNumber: placeholderNumber.join('&'),
        client_name: closeData.client_name || null, clientName: closeData.client_name || null,
        subtotal_cents: closeData.subtotal_cents || 0, subtotalCents: closeData.subtotal_cents || 0,
        tax_cents: closeData.tax_cents || 0, taxCents: closeData.tax_cents || 0,
        discount_cents: closeData.discount_cents || 0, discountCents: closeData.discount_cents || 0,
        tip_cents: closeData.tip_cents || 0, tipCents: closeData.tip_cents || 0,
        total_cents: closeData.total_cents || 0, totalCents: closeData.total_cents || 0,
        payment_method: closeData.payment_method || null, paymentMethod: closeData.payment_method || null,
        deposit_cents: closeData.deposit_cents || 0, depositCents: closeData.deposit_cents || 0,
        pkg_redeemed_cents: closeData.pkg_redeemed_cents || 0, pkgRedeemCents: closeData.pkg_redeemed_cents || 0,
        refunds: [], refundedItemIds: {},
        items: mergedItems,
        payments: (payments || []).map(function(p, i) {
          return { id: 'ph-pay-' + i, method: p.method, amount_cents: p.amount_cents };
        }),
        created_at: nowIso, createdAt: Date.now(), closedAt: Date.now(),
      };
      // Build optimistic merged placeholders for absorbed tickets
      var absorberId = ticketIds[0]; // lowest ticket_number (sorted in App.jsx)
      var absorbedPlaceholders = [];
      ticketIds.slice(1).forEach(function(id) {
        var t = openList.find(function(ot) { return ot.id === id; });
        if (t) {
          absorbedPlaceholders.push({
            id: t.id, _placeholder: true, status: 'merged',
            ticket_number: t.ticket_number, ticketNumber: t.ticket_number,
            mergedInto: absorberId, merged_into: absorberId,
            client_name: t.client_name || t.clientName || null,
            clientName: t.client_name || t.clientName || null,
            total_cents: 0, totalCents: 0, items: [], payments: [],
            created_at: nowIso, createdAt: Date.now(),
          });
        }
      });
      set(function(s) {
        var remaining = s.openTickets.filter(function(t) { return !ticketIds.includes(t.id); });
        return {
          openTickets: remaining,
          closedTickets: [placeholder].concat(s.closedTickets),
          mergedTickets: absorbedPlaceholders.concat(s.mergedTickets),
        };
      });

      try {
        var data = await api.post('/checkout/tickets/merge-and-close', {
          ticketIds: ticketIds,
          payments: payments,
          closeData: closeData,
        });
        var closedTicket = data.ticket;
        ticketIds.forEach(function(id) { delete _pendingRemovals[id]; });
        // Build real merged entries from server response (absorbed tickets are now status=merged in DB)
        var absorbedIds = ticketIds.slice(1);
        set(function(s) {
          return {
            openTickets: s.openTickets.filter(function(t) { return !ticketIds.includes(t.id); }),
            closedTickets: [closedTicket].concat(s.closedTickets.filter(function(t) { return t.id !== placeholderId; })),
            mergedTickets: s.mergedTickets.filter(function(t) { return !t._placeholder || !absorbedIds.includes(t.id); }),
          };
        });
        return closedTicket;
      } catch (err) {
        // Rollback: remove placeholder, restore open tickets, clear pending removals
        var absorbedIds = ticketIds.slice(1);
        ticketIds.forEach(function(id) { delete _pendingRemovals[id]; });
        set(function(s) {
          var restored = [];
          openList.forEach(function(t) { if (ticketIds.includes(t.id)) restored.push(t); });
          return {
            openTickets: s.openTickets.concat(restored),
            closedTickets: s.closedTickets.filter(function(t) { return t.id !== placeholderId; }),
            mergedTickets: s.mergedTickets.filter(function(t) { return !t._placeholder || !absorbedIds.includes(t.id); }),
          };
        });
        throw err;
      }
    },

    removeOpenTicket: function(ticketId) {
      _pendingRemovals[ticketId] = Date.now();
      set(function(s) {
        return {
          openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
        };
      });
    },

    addOpenTicket: function(ticket) {
      set(function(s) {
        // Don't add if already exists
        var exists = s.openTickets.some(function(t) { return t.id === ticket.id; });
        if (exists) return s;
        return {
          openTickets: s.openTickets.concat([ticket]),
        };
      });
    },

    addClosedTicket: function(ticket) {
      set(function(s) {
        return {
          closedTickets: [ticket].concat(s.closedTickets),
        };
      });
    },

    updateClosedTicket: function(ticketId, updates) {
      get().fetchTickets();
    },

    // Admin: permanently delete a single ticket (owner only)
    deleteTicket: async function(ticketId) {
      await api.del('/checkout/tickets/' + ticketId);
      set(function(s) {
        return {
          openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
          closedTickets: s.closedTickets.filter(function(t) { return t.id !== ticketId; }),
        };
      });
    },

    // Admin: delete ALL tickets for this salon (owner only, test cleanup)
    deleteAllTickets: async function() {
      var data = await api.del('/checkout/tickets/bulk/all');
      set({ openTickets: [], closedTickets: [], nextTicketNumber: 1 });
      return data.deleted;
    },
  };
});

export { useTicketStore };
