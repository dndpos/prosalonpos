/**
 * useTicketHandlers — Ticket lifecycle handlers extracted from App.jsx
 * Session 79 — App.jsx split (TD-104)
 * V3: Added checkoutError state (TD-124) for visible error banner on close failure.
 *
 * Handles: close, print & hold, reopen, tips, void, refund
 * Reads from ticketStore and appointmentStore directly.
 */

import { useState } from 'react';
import { useTicketStore } from '../stores/ticketStore';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useMembershipStore } from '../stores/membershipStore';
import { usePackageStore } from '../stores/packageStore';
import { useClientStore } from '../stores/clientStore';
import { useGiftCardStore } from '../stores/giftCardStore';
import { markAvailable as turnMarkAvailable } from '../techTurnBus';

export default function useTicketHandlers() {
  var [checkoutError, setCheckoutError] = useState(null); // {message, ticketNumber, ts}
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
  var storeUpdateTicket = useTicketStore(function(s) { return s.updateTicket; });
  var storeAddOpenTicket = useTicketStore(function(s) { return s.addOpenTicket; });
  var storeVoidTicket = useTicketStore(function(s) { return s.voidTicket; });
  var storeRefundTicket = useTicketStore(function(s) { return s.refundTicket; });
  var storeUpdateServiceLine = useAppointmentStore(function(s) { return s.updateServiceLine; });
  var storeUpdateAppointment = useAppointmentStore(function(s) { return s.updateAppointment; });
  var enrollMember = useMembershipStore(function(s) { return s.enrollMember; });
  var renewMember = useMembershipStore(function(s) { return s.renewMember; });
  var sellPackage = usePackageStore(function(s) { return s.sellPackage; });
  var redeemPackage = usePackageStore(function(s) { return s.redeemPackage; });
  var createGiftCard = useGiftCardStore(function(s) { return s.createGiftCard; });
  var redeemGiftCard = useGiftCardStore(function(s) { return s.redeemGiftCard; });

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
    // Connection 3: mark originating calendar service lines as checked_out (paid)
    if (ticket.serviceLineIds && ticket.serviceLineIds.length > 0) {
      var payMethod = (ticket.payments[0] || {}).method || (ticket.packageRedemptions ? 'package' : null);
      ticket.serviceLineIds.forEach(function(slId) {
        storeUpdateServiceLine(slId, { status: 'checked_out', payment_method: payMethod });
      });
    }
    // Connection 3b: mark parent appointment as checked_out so it can't be re-checked-out
    if (ticket.appointmentId) {
      storeUpdateAppointment(ticket.appointmentId, { status: 'checked_out' }).catch(function(err) {
        console.warn('[handleCloseTicket] Appointment status update failed:', err.message);
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
        enrollMember(ticket.client.id, memItem.planId).then(function(member) {
        }).catch(function(err) {
          console.warn('[handleCloseTicket] Membership enrollment failed:', err.message);
        });
      } else {
        console.warn('[handleCloseTicket] Membership skipped — planId:', memItem.planId, 'client:', ticket.client);
      }
    });

    // Connection 5: Package — sell to client on ticket close
    var pkgItems = (ticket.items || []).filter(function(it) { return it.type === 'package_sale'; });
    pkgItems.forEach(function(pkgItem) {
      if (pkgItem.packageId && ticket.client && ticket.client.id) {
        var techName = pkgItem.tech || null;
        var techId = pkgItem.techId || null;
        sellPackage({
          client_id: ticket.client.id,
          client_name: ticket.clientName || ticket.client.name || ticket.client.display_name || '',
          package_id: pkgItem.packageId,
          price_paid_cents: pkgItem.price_cents || 0,
          sold_by_staff_id: techId,
          sold_by_staff_name: techName,
        }).then(function(cp) {
        }).catch(function(err) {
          console.warn('[handleCloseTicket] Package sell failed:', err.message);
        });
      } else {
        console.warn('[handleCloseTicket] Package skipped — packageId:', pkgItem.packageId, 'client:', ticket.client);
      }
    });

    // Connection 5b: Gift Card — create card record in database when sold at checkout
    var gcItems = (ticket.items || []).filter(function(it) { return it.type === 'giftcard'; });
    // Gift card creation deferred to after DB ticket creation (needs real ticket ID)
    function createGiftCardsForTicket(dbTicketId) {
      if (gcItems.length === 0) return;
      var chain = Promise.resolve();
      gcItems.forEach(function(gcItem) {
        chain = chain.then(function() {
          var cardCode = gcItem.cardNumber || gcItem.code || ('GC-' + Date.now());
          var staffId = gcItem.techId || null;
          var staffName = gcItem.tech || null;
          return createGiftCard({
            code: cardCode,
            type: 'physical',
            amount_cents: gcItem.price_cents || 0,
            initial_amount_cents: gcItem.price_cents || 0,
            client_id: ticket.client ? ticket.client.id : null,
            client_name: ticket.clientName || null,
            purchased_by_client_id: ticket.client ? ticket.client.id : null,
            purchased_by_name: ticket.clientName || null,
            staff_id: staffId,
            staff_name: staffName,
            ticket_id: dbTicketId,
          }).then(function(card) {
          }).catch(function(err) {
            console.warn('[handleCloseTicket] Gift card creation FAILED:', err.message);
          });
        });
      });
    }

    // Connection 5c: Gift Card — deduct balance when gift card used as PAYMENT (TD-134)
    function redeemGiftCardPayments(dbTicketId) {
      var gcPayments = (ticket.payments || []).filter(function(p) { return p.gc_id; });
      if (gcPayments.length === 0) return;
      gcPayments.forEach(function(p) {
        redeemGiftCard(p.gc_id, {
          amount_cents: p.amount_cents || p.amountCents || 0,
          ticket_id: dbTicketId,
          staff_id: null,
          staff_name: null,
        }).catch(function(err) {
          console.warn('[handleCloseTicket] Gift card redeem FAILED:', p.gc_id, err.message);
        });
      });
    }

    // Connection 6: Package redemption — DEFERRED until after DB ticket creation
    // so we have the real DB ticket ID (not temp tkt- prefix).
    // Calls are sequential (not parallel) to prevent remaining-count race conditions.
    function redeemPackagesForTicket(dbTicketId) {
      if (!ticket.packageRedemptions || !ticket.client || !ticket.client.id) return;
      var redemptionEntries = Object.keys(ticket.packageRedemptions);
      if (redemptionEntries.length === 0) return;
      // Build all payloads first
      var payloads = redemptionEntries.map(function(itemId) {
        var red = ticket.packageRedemptions[itemId];
        var ticketItem = (ticket.items || []).find(function(it) { return it.id === itemId; });
        var svcId = ticketItem ? (ticketItem.serviceCatalogId || ticketItem.service_id || null) : null;
        return {
          client_package_id: red.cpkgId,
          client_package_item_id: red.cpiId,
          ticket_id: dbTicketId,
          service_redeemed_id: svcId || red.cpiId,
          service_redeemed_name: ticketItem ? ticketItem.name : (red.pkgServiceName || ''),
          package_service_id: svcId || red.cpiId,
          package_service_name: red.pkgServiceName || '',
          upgrade_difference_cents: red.upgradeDiff || 0,
          staff_id: ticketItem ? ticketItem.techId : null,
          staff_name: ticketItem ? ticketItem.tech : null,
          _pkgName: red.pkgName,
        };
      });
      // Sequential execution — each call waits for previous to finish
      var chain = Promise.resolve();
      payloads.forEach(function(payload) {
        var pkgName = payload._pkgName;
        delete payload._pkgName;
        chain = chain.then(function() {
          return redeemPackage(payload).then(function(result) {
          }).catch(function(err) {
            console.warn('[handleCloseTicket] Package redeem FAILED:', err.message);
          });
        });
      });
      // After all redemptions complete, refresh client's package data
      chain.then(function() {
        var fetchPkgs = usePackageStore.getState().fetchClientPackages;
        if (fetchPkgs && ticket.client && ticket.client.id) {
          fetchPkgs(ticket.client.id);
        }
      });
    }

    // In API mode: save ticket to database
    if (storeSource === 'api') {
      // ── Reopened ticket: update items, add delta payments, close ──
      if (ticket.reopenedTicketId) {
        var reopenId = ticket.reopenedTicketId;
        // Step 1: Update items on the existing ticket
        var updatedItems = (ticket.items || []).map(function(it) {
          return {
            type: it.type || 'service',
            name: it.name || 'Service',
            price_cents: it.price_cents || 0,
            original_price_cents: it.original_price_cents || it.price_cents || 0,
            tech_id: it.techId || null,
            tech_name: it.tech || null,
            service_id: it.service_id || it.serviceCatalogId || null,
            product_id: it.product_id || null,
            color: it.color || null,
          };
        });
        storeUpdateTicket(reopenId, { items: updatedItems }).then(function() {
          // Step 2: Add only NEW delta payments (not the original ones)
          var deltaPayments = ticket.payments || [];
          var payPromises = deltaPayments.map(function(p) {
            return storeAddPayment(reopenId, {
              method: p.method || 'credit',
              amount_cents: p.amount_cents || p.amountCents || 0,
              gc_id: p.gc_id || null,
              gc_code: p.gc_code || null,
            });
          });
          return Promise.all(payPromises);
        }).then(function() {
          // Step 3: Close with updated totals
          var closeData = {
            subtotal_cents: ticket.subtotalCents || 0,
            tax_cents: ticket.taxCents || 0,
            discount_cents: ticket.discountCents || 0,
            tip_cents: ticket.tipCents || 0,
            surcharge_cents: ticket.surchargeCents || 0,
            deposit_cents: ticket.depositCents || 0,
            total_cents: ticket.totalCents || 0,
            payment_method: ticket.reopenedPaymentMethod || (ticket.payments && ticket.payments[0] ? ticket.payments[0].method : (ticket.packageRedemptions ? 'package' : null)),
            pkg_redeemed_cents: ticket.pkgRedeemCents || 0,
            cashier_id: ticket.closedBy || null,
            tip_distributions: ticket.tipDistributions || null,
          };
          return storeCloseTicket(reopenId, closeData);
        }).then(function() {
          redeemPackagesForTicket(reopenId);
          createGiftCardsForTicket(reopenId);
          redeemGiftCardPayments(reopenId);
        }).catch(function(err) {
          console.error('[handleCloseTicket] Reopened close FAILED:', err.message);
          alert('⚠ Reopened ticket save failed: ' + (err.message || 'Server error') + '\n\nCheck server terminal for details.');
          setCheckoutError({ message: 'Checkout failed: ' + (err.message || 'Server error'), ticketNumber: ticket.ticketNumber, ts: Date.now() });
          storeAddClosedTicket(ticket);
        });
        return;
      }

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
            payment_method: (ticket.payments && ticket.payments[0]) ? ticket.payments[0].method : (ticket.packageRedemptions ? 'package' : null),
            pkg_redeemed_cents: ticket.pkgRedeemCents || 0,
            cashier_id: ticket.closedBy || null,
            tip_distributions: ticket.tipDistributions || null,
          };
          return storeCloseTicket(dbTicketId, closeData);
        }).then(function() {
          redeemPackagesForTicket(dbTicketId);
          createGiftCardsForTicket(dbTicketId);
          redeemGiftCardPayments(dbTicketId);
        }).catch(function(err) {
          console.error('[handleCloseTicket] API close FAILED:', err.message);
          alert('⚠ Ticket save failed: ' + (err.message || 'Server error') + '\n\nTicket saved locally only — will disappear on refresh.\nCheck server terminal for details.');
          setCheckoutError({ message: 'Checkout failed: ' + (err.message || 'Server error'), ticketNumber: ticket.ticketNumber, ts: Date.now() });
          storeAddClosedTicket(ticket);
        });
      }

      if (needsCreate) {
        // Walk-in sale from Checkout — use quick-close (one API call, no open→paid flicker)
        // NEVER use quick-close for reopened tickets (S114 rule)
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
          payment_method: (ticket.payments && ticket.payments[0]) ? ticket.payments[0].method : (ticket.packageRedemptions ? 'package' : null),
          pkg_redeemed_cents: ticket.pkgRedeemCents || 0,
          tip_distributions: ticket.tipDistributions || null,
          items: (ticket.items || []).map(function(it) {
            return {
              type: it.type || 'service',
              name: it.name || 'Service',
              price_cents: it.price_cents || 0,
              original_price_cents: it.original_price_cents || it.price_cents || 0,
              tech_id: it.techId || null,
              tech_name: it.tech || null,
              service_id: it.service_id || it.serviceCatalogId || null,
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
          redeemPackagesForTicket(dbTicket.id);
          createGiftCardsForTicket(dbTicket.id);
          redeemGiftCardPayments(dbTicket.id);
        }).catch(function(err) {
          console.error('[handleCloseTicket] Quick-close FAILED:', err.message);
          alert('⚠ Ticket save failed: ' + (err.message || 'Server error') + '\n\nTicket saved locally only — will disappear on refresh.\nCheck server terminal for details.');
          setCheckoutError({ message: 'Checkout failed: ' + (err.message || 'Server error'), ticketNumber: ticket.ticketNumber, ts: Date.now() });
          storeAddClosedTicket(ticket);
        });
      } else {
        // Ticket already exists in DB (came from calendar or merge)
        // Update items first (tech reassignment, price changes, added items)
        var updatedItems = (ticket.items || []).map(function(it) {
          return {
            type: it.type || 'service',
            name: it.name || 'Service',
            price_cents: it.price_cents || 0,
            original_price_cents: it.original_price_cents || it.price_cents || 0,
            tech_id: it.techId || null,
            tech_name: it.tech || null,
            service_id: it.service_id || it.serviceCatalogId || null,
            product_id: it.product_id || null,
            client_id: it.client_id || null,
            color: it.color || null,
          };
        });
        storeUpdateTicket(ticket.id, { items: updatedItems }).then(function() {
          addPaymentsAndClose(ticket.id);
        }).catch(function(err) {
          console.warn('[handleCloseTicket] Item update failed, closing anyway:', err.message);
          addPaymentsAndClose(ticket.id);
        });
      }
    } else {
      // Mock mode: just add to local closed list
      storeAddClosedTicket(ticket);
    }
  }

  function handlePrintHold(holdData) {
    // The ticket was already created when checkout opened (handleCheckout in App.jsx).
    // holdData.id contains the existing openTicketId — do NOT create another ticket.
    // Only create a new ticket if there's no existing ID (edge case: direct checkout without appointment).
    var existingId = holdData.id;
    var isRealId = existingId && !String(existingId).startsWith('hold-') && !String(existingId).startsWith('ot-');

    if (isRealId) {
      // Ticket already exists in DB — update it with latest items (user may have modified in checkout)
      var updateData = {
        items: (holdData.items || []).map(function(it) {
          return {
            type: it.type || 'service',
            name: it.name || 'Service',
            price_cents: it.price_cents || 0,
            original_price_cents: it.original_price_cents || it.price_cents || 0,
            tech_id: it.techId || null,
            tech_name: it.tech || null,
            service_id: it.service_id || it.serviceCatalogId || null,
            product_id: it.product_id || null,
            color: it.color || null,
          };
        }),
      };
      storeUpdateTicket(existingId, updateData).then(function() {
      }).catch(function(err) {
        console.warn('[handlePrintHold] Ticket update failed:', err.message);
      });
    } else {
      // No existing ticket — create one (walk-in or fallback)
      var ticketData = {
        client_id: holdData.client ? holdData.client.id : null,
        client_name: holdData.clientName || null,
        deposit_cents: holdData.depositCents || 0,
        appointment_id: holdData.appointmentId || null,
        lineItems: (holdData.items || []).map(function(it) {
          return {
            type: it.type || 'service',
            name: it.name || 'Service',
            price_cents: it.price_cents || 0,
            original_price_cents: it.original_price_cents || it.price_cents || 0,
            tech_id: it.techId || null,
            tech_name: it.tech || null,
            service_id: it.service_id || it.serviceCatalogId || null,
            product_id: it.product_id || null,
            color: it.color || null,
          };
        }),
      };
      storeCreateTicket(ticketData).then(function(ticket) {
      }).catch(function(err) {
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
    }

    // Connection 2: Print & Hold — tech is done with client, return to available queue
    var staffIds = [];
    (holdData.items || []).forEach(function(item) {
      var id = item.techId || holdData.activeTechId;
      if (id && !staffIds.includes(id)) staffIds.push(id);
    });
    if (staffIds.length > 0) turnMarkAvailable(staffIds);
  }

  async function handleReopenTicket(ticket) {
    var serverTicket = await storeReopenTicket(ticket.id);
    if (!serverTicket) return null;
    // Calculate what was already paid (sum of payment records, excluding tip)
    var originalPayments = serverTicket.payments || ticket.payments || [];
    var alreadyPaid = 0;
    originalPayments.forEach(function(p) {
      alreadyPaid += (p.amount_cents || p.amountCents || 0);
    });
    // Build client object from ticket fields (formatTicket returns flat fields, not nested client)
    var clientId = serverTicket.client_id || ticket.client_id || null;
    var clientName = serverTicket.clientName || ticket.clientName || null;
    var reopenClient = null;
    if (clientId) {
      // Try to find full client from clientStore for phone, VIP, etc.
      var allClients = useClientStore.getState().clients || [];
      var found = allClients.find(function(c) { return c.id === clientId; });
      if (found) {
        reopenClient = found;
      } else {
        // Minimal client object so checkout has client_id for packages/memberships
        var nameParts = (clientName || '').split(' ');
        reopenClient = { id: clientId, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', name: clientName, display_name: clientName };
      }
    }
    return {
      client: reopenClient,
      services: serverTicket.items || ticket.items,
      reopened: true,
      reopenedTicketId: serverTicket.id || ticket.id,
      reopenedTicketNumber: serverTicket.ticketNumber || ticket.ticketNumber,
      alreadyPaidCents: alreadyPaid,
      originalPayments: originalPayments,
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
    }).catch(function(err) {
      console.warn('[handleVoidTicket] API void failed:', err.message);
    });
  }

  function handleRefundTicket(ticketId, data) {
    // Find the ticket to check if it had package redemptions
    var closedTickets = useTicketStore.getState().closedTickets || [];
    var theTicket = closedTickets.find(function(t) { return t.id === ticketId; });
    var hasPkgRedeemed = theTicket && (theTicket.pkgRedeemCents || theTicket.pkg_redeemed_cents || 0) > 0;
    return storeRefundTicket(ticketId, {
      refund_reason: data.reasonText || data.reasonPreset || null,
      refund_by: data.staffName || 'Manager',
      refund_method: data.refundMethod || null,
      refund_cents: data.refundTotal_cents || 0,
      refund_tax_cents: data.refundTax_cents || 0,
      refund_items: data.items || [],
      refund_tip: !!data.refundTip,
      tip_refunded_cents: data.tipRefunded_cents || 0,
      restore_package_credits: hasPkgRedeemed || false,
    }).then(function(refund) {
      // Refresh gift card balances after refund
      var fetchGCs = useGiftCardStore.getState().fetchGiftCards;
      if (fetchGCs) fetchGCs();
      if (refund && refund.restoredPkgCredits && refund.restoredPkgCredits.length > 0) {
        // Refresh client packages in the store
        if (theTicket && (theTicket.client_id || theTicket.clientId)) {
          var fetchPkgs = usePackageStore.getState().fetchClientPackages;
          if (fetchPkgs) fetchPkgs(theTicket.client_id || theTicket.clientId);
        }
      }
      return refund;
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
    checkoutError: checkoutError,
    clearCheckoutError: function() { setCheckoutError(null); },
  };
}
