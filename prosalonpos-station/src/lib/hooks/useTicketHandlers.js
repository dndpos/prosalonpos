/**
 * useTicketHandlers — Ticket lifecycle handlers extracted from App.jsx
 * Session 79 — App.jsx split (TD-104)
 *
 * Handles: close, print & hold, reopen, tips, void, refund
 * Reads from ticketStore and appointmentStore directly.
 */

import { useTicketStore } from '../stores/ticketStore';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useMembershipStore } from '../stores/membershipStore';
import { markAvailable as turnMarkAvailable } from '../techTurnBus';

export default function useTicketHandlers() {
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var storeAddClosedTicket = useTicketStore(function(s) { return s.addClosedTicket; });
  var storeCreateTicket = useTicketStore(function(s) { return s.createTicket; });
  var storeQuickCloseTicket = useTicketStore(function(s) { return s.quickCloseTicket; });
  var storeCloseTicket = useTicketStore(function(s) { return s.closeTicket; });
  var storeAddPayment = useTicketStore(function(s) { return s.addPayment; });
  var storeSource = useTicketStore(function(s) { return s.source; });
  var storeReopenTicket = useTicketStore(function(s) { return s.reopenTicket; });
  var storeUpdateClosedTicket = useTicketStore(function(s) { return s.updateClosedTicket; });
  var storeRemoveOpenTicket = useTicketStore(function(s) { return s.removeOpenTicket; });
  var storeAddOpenTicket = useTicketStore(function(s) { return s.addOpenTicket; });
  var storeVoidTicket = useTicketStore(function(s) { return s.voidTicket; });
  var storeRefundTicket = useTicketStore(function(s) { return s.refundTicket; });
  var storeUpdateServiceLine = useAppointmentStore(function(s) { return s.updateServiceLine; });
  var enrollMember = useMembershipStore(function(s) { return s.enrollMember; });
  var renewMember = useMembershipStore(function(s) { return s.renewMember; });

  function handleCloseTicket(ticket) {
    // Connection 1: mark each tech on this ticket as Available in the turn list
    var staffIds = [];
    (ticket.items || []).forEach(function(item) {
      if (item.techId && !staffIds.includes(item.techId)) {
        staffIds.push(item.techId);
      }
    });
    if (staffIds.length > 0) turnMarkAvailable(staffIds);
    // Remove held/open tickets that were loaded into this checkout
    if (ticket.openTicketIds && ticket.openTicketIds.length > 0) {
      ticket.openTicketIds.forEach(function(tid) {
        storeRemoveOpenTicket(tid);
      });
    }
    // Connection 3: mark originating calendar service lines as completed
    if (ticket.serviceLineIds && ticket.serviceLineIds.length > 0) {
      ticket.serviceLineIds.forEach(function(slId) {
        storeUpdateServiceLine(slId, { status: 'completed', payment_method: (ticket.payments[0] || {}).method || null });
      });
    }

    // Connection 4: Membership — enroll new or renew existing
    var memItems = (ticket.items || []).filter(function(it) { return it.type === 'membership_sale'; });
    memItems.forEach(function(memItem) {
      if (memItem.isRenewal && memItem.membershipId) {
        // Renewal — advance next_billing
        renewMember(memItem.membershipId).catch(function(err) {
          console.warn('[handleCloseTicket] Membership renewal failed:', err.message);
        });
      } else if (memItem.planId && ticket.client && ticket.client.id) {
        // New enrollment
        enrollMember(ticket.client.id, memItem.planId).catch(function(err) {
          console.warn('[handleCloseTicket] Membership enrollment failed:', err.message);
        });
      }
    });

    // In API mode: save ticket to database
    if (storeSource === 'api') {
      var needsCreate = !ticket.id || ticket.id.startsWith('tkt-');

      function addPaymentsAndClose(dbTicketId) {
        // Step 1: Record each payment on the open ticket
        var paymentPromises = (ticket.payments || []).map(function(p) {
          return storeAddPayment(dbTicketId, {
            method: p.method || 'credit',
            amount_cents: p.amount_cents || p.amountCents || 0,
            gc_id: p.gc_id || null,
            gc_code: p.gc_code || null,
          });
        });

        // Step 2: After payments are recorded, close the ticket
        Promise.all(paymentPromises).then(function() {
          var closeData = {
            subtotal_cents: ticket.subtotalCents || 0,
            tax_cents: ticket.taxCents || 0,
            discount_cents: ticket.discountCents || 0,
            tip_cents: ticket.tipCents || 0,
            surcharge_cents: ticket.surchargeCents || 0,
            deposit_cents: ticket.depositCents || 0,
            total_cents: ticket.totalCents || 0,
            payment_method: (ticket.payments && ticket.payments[0]) ? ticket.payments[0].method : null,
            cashier_id: ticket.closedBy || null,
            tip_distributions: ticket.tipDistributions || null,
          };
          return storeCloseTicket(dbTicketId, closeData);
        }).then(function() {
          console.log('[handleCloseTicket] Ticket closed in database:', dbTicketId);
        }).catch(function(err) {
          console.warn('[handleCloseTicket] API close failed, ticket saved locally:', err.message);
          storeAddClosedTicket(ticket);
        });
      }

      if (needsCreate) {
        // Walk-in sale from Checkout — use quick-close (one API call, no open→paid flicker)
        var quickData = {
          client_id: ticket.client ? ticket.client.id : null,
          client_name: ticket.clientName || null,
          appointment_id: ticket.appointmentId || null,
          deposit_cents: ticket.depositCents || 0,
          cashier_id: ticket.closedBy || null,
          cashier_name: ticket.cashierName || null,
          subtotal_cents: ticket.subtotalCents || 0,
          tax_cents: ticket.taxCents || 0,
          discount_cents: ticket.discountCents || 0,
          tip_cents: ticket.tipCents || 0,
          surcharge_cents: ticket.surchargeCents || 0,
          total_cents: ticket.totalCents || 0,
          payment_method: (ticket.payments && ticket.payments[0]) ? ticket.payments[0].method : null,
          tip_distributions: ticket.tipDistributions || null,
          items: (ticket.items || []).map(function(it) {
            return {
              type: it.type || 'service',
              name: it.name || 'Service',
              price_cents: it.price_cents || 0,
              original_price_cents: it.original_price_cents || it.price_cents || 0,
              tech_id: it.techId || null,
              tech_name: it.tech || null,
              service_id: it.service_id || null,
              product_id: it.product_id || null,
              color: it.color || null,
            };
          }),
          payments: (ticket.payments || []).map(function(p) {
            return {
              method: p.method || 'credit',
              amount_cents: p.amount_cents || p.amountCents || 0,
              gc_id: p.gc_id || null,
              gc_code: p.gc_code || null,
            };
          }),
        };
        storeQuickCloseTicket(quickData).then(function(dbTicket) {
          console.log('[handleCloseTicket] Quick-close ticket saved:', dbTicket.id);
        }).catch(function(err) {
          console.warn('[handleCloseTicket] Quick-close failed, saved locally:', err.message);
          storeAddClosedTicket(ticket);
        });
      } else {
        // Ticket already exists in DB (came from calendar appointment)
        addPaymentsAndClose(ticket.id);
      }
    } else {
      // Mock mode: just add to local closed list
      storeAddClosedTicket(ticket);
    }
  }

  function handlePrintHold(holdData) {
    // Save ticket to database so it persists across page navigations
    var ticketData = {
      client_id: holdData.client ? holdData.client.id : null,
      client_name: holdData.clientName || null,
      deposit_cents: holdData.depositCents || 0,
      lineItems: (holdData.items || []).map(function(it) {
        return {
          type: it.type || 'service',
          name: it.name || 'Service',
          price_cents: it.price_cents || 0,
          original_price_cents: it.original_price_cents || it.price_cents || 0,
          tech_id: it.techId || null,
          tech_name: it.tech || null,
          service_id: it.service_id || null,
          product_id: it.product_id || null,
          color: it.color || null,
        };
      }),
    };
    storeCreateTicket(ticketData).then(function(ticket) {
      console.log('[handlePrintHold] Ticket saved to DB:', ticket.id);
    }).catch(function(err) {
      // Fallback: save locally if API fails
      console.warn('[handlePrintHold] DB save failed, keeping local:', err.message);
      var ticket = {
        id: holdData.id || ('hold-' + Date.now()),
        ticketNumber: holdData.ticketNumber || 0,
        client: holdData.client || null,
        clientName: holdData.clientName || null,
        items: holdData.items || [],
        depositCents: holdData.depositCents || 0,
        status: 'open',
        createdAt: Date.now(),
      };
      storeAddOpenTicket(ticket);
    });

    // Connection 2: Print & Hold — tech is done with client, return to available queue
    var staffIds = [];
    (holdData.items || []).forEach(function(item) {
      var id = item.techId || holdData.activeTechId;
      if (id && !staffIds.includes(id)) staffIds.push(id);
    });
    if (staffIds.length > 0) turnMarkAvailable(staffIds);
  }

  function handleReopenTicket(ticket) {
    storeReopenTicket(ticket.id);
    return {
      client: ticket.client,
      services: ticket.items,
      depositCents: ticket.depositCents || 0,
      reopened: true,
      originalTicket: ticket,
    };
  }

  function handleUpdateTicketTips(ticketId, distributions) {
    storeUpdateClosedTicket(ticketId, { tipDistributions: distributions, tipDistributed: true });
  }

  function handleAddTicketTip(ticketId, tipCents, distributions) {
    var ticket = closedTickets.find(function(t) { return t.id === ticketId; });
    var prevTip = ticket ? (ticket.tipCents || 0) : 0;
    var prevTotal = ticket ? (ticket.totalCents || 0) : 0;
    storeUpdateClosedTicket(ticketId, {
      tipCents: tipCents,
      totalCents: (prevTotal - prevTip) + tipCents,
      tipDistributions: distributions,
      tipDistributed: !!distributions,
    });
  }

  function handleVoidTicket(ticketId, data) {
    storeVoidTicket(ticketId, {
      void_reason: data.reasonText || data.reasonPreset || null,
      void_by: data.staffName || 'Manager',
      reverse_tip: !!data.reverseTip,
    }).then(function(ticket) {
      console.log('[handleVoidTicket] Voided in DB:', ticketId);
    }).catch(function(err) {
      console.warn('[handleVoidTicket] API void failed:', err.message);
    });
  }

  function handleRefundTicket(ticketId, data) {
    storeRefundTicket(ticketId, {
      refund_reason: data.reasonText || data.reasonPreset || null,
      refund_by: data.staffName || 'Manager',
      refund_method: data.refundMethod || null,
      refund_cents: data.refundTotal_cents || 0,
      refund_items: data.items || [],
      refund_tip: !!data.refundTip,
      tip_refunded_cents: data.tipRefunded_cents || 0,
    }).then(function(refund) {
      console.log('[handleRefundTicket] Refunded in DB:', ticketId);
    }).catch(function(err) {
      console.warn('[handleRefundTicket] API refund failed:', err.message);
    });
  }

  return {
    handleCloseTicket: handleCloseTicket,
    handlePrintHold: handlePrintHold,
    handleReopenTicket: handleReopenTicket,
    handleUpdateTicketTips: handleUpdateTicketTips,
    handleAddTicketTip: handleAddTicketTip,
    handleVoidTicket: handleVoidTicket,
    handleRefundTicket: handleRefundTicket,
  };
}
