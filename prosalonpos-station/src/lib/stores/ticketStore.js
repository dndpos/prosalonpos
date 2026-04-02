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
import { debugLog } from '../debugLog';

var useTicketStore = create(function(set, get) {
  return {
    // ─── State ───
    openTickets: [],
    closedTickets: [],
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

      set({ loading: true, error: null });
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
        var closed = tickets.filter(function(t) { return t.status !== 'open'; });

        set({
          openTickets: open,
          closedTickets: closed,
          loading: false,
          source: 'api',
          initialized: true,
        });
        debugLog('STORE', 'ticketStore loaded ' + tickets.length + ' tickets (' + open.length + ' open, ' + closed.length + ' closed)');
      } catch (err) {
        debugLog('ERROR', 'ticketStore fetch failed: ' + err.message);
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
      var data = await api.post('/checkout/tickets/quick-close', ticketData);
      var ticket = data.ticket;
      set(function(s) {
        return { closedTickets: [ticket].concat(s.closedTickets) };
      });
      return ticket;
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
      var data = await api.post('/checkout/tickets/' + ticketId + '/close', closeData);
      set(function(s) {
        return {
          openTickets: s.openTickets.filter(function(t) { return t.id !== ticketId; }),
          closedTickets: [data.ticket].concat(s.closedTickets),
        };
      });
      return data.ticket;
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
      get().fetchTickets();
      return data.refund;
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

    reopenTicket: function(ticketId) {
      set(function(s) {
        var ticket = s.closedTickets.find(function(t) { return t.id === ticketId; });
        if (!ticket || ticket.status === 'voided') return s;
        var reopened = Object.assign({}, ticket, { status: 'open' });
        return {
          closedTickets: s.closedTickets.filter(function(t) { return t.id !== ticketId; }),
          openTickets: s.openTickets.concat([reopened]),
        };
      });
    },

    removeOpenTicket: function(ticketId) {
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
  };
});

export { useTicketStore };
