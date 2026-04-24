/**
 * checkoutMergeClose.js — Merge + Pay + Close in one atomic call
 * C37: Creates a NEW ticket with all items instead of absorbing into lowest.
 * Old tickets are marked as 'merged' pointing to the new ticket.
 *
 * Endpoint: POST /api/v1/checkout/tickets/merge-and-close
 *
 * Body: {
 *   ticketIds: string[]         — 1+ existing open ticket IDs to merge
 *   payments: [{method, amount_cents, gc_id?, gc_code?}]
 *   closeData: { subtotal_cents, tax_cents, discount_cents, tip_cents, ... }
 *   newItems: [{type, name, price_cents, tech_id, tech_name, ...}]  — optional fresh items not on any ticket
 * }
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { sendPushToStaffList } from '../utils/pushService.js';
import { toDb, dayBounds, formatTicket } from './checkoutHelpers.js';
// cc15: barcode audit log — log an ABSORBED event on the new ticket's
// barcode and a COMBINED event on every source's barcode, then a
// TICKET_PAID on the absorber. Produces a clean timeline for any slip.
import { logSlipEvent, SLIP_EVENT_TYPES, reqContext, itemsSnapshot } from '../utils/slipLog.js';

var router = Router();

router.post('/tickets/merge-and-close', async function(req, res, next) {
  try {
    var ticketIds = req.body.ticketIds || [];
    var payments = req.body.payments || [];
    var closeData = req.body.closeData || {};
    var newItems = req.body.newItems || [];

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length < 1) {
      return res.status(400).json({ error: 'Need at least 1 ticket ID to merge-and-close' });
    }

    var tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds }, salon_id: req.salon_id, status: 'open' },
      include: { items: true, payments: true },
    });

    if (tickets.length === 0) {
      return res.status(400).json({ error: 'No open tickets found for the given IDs' });
    }

    tickets.sort(function(a, b) { return a.ticket_number - b.ticket_number; });
    var numbers = tickets.map(function(t) { return t.ticket_number; });
    var totalDeposit = tickets.reduce(function(sum, t) { return sum + (t.deposit_cents || 0); }, 0);

    // Collect ALL items from all tickets
    var allExistingItems = [];
    tickets.forEach(function(t) {
      (t.items || []).forEach(function(item) {
        allExistingItems.push({
          type: item.type || 'service',
          name: item.name || 'Service',
          price_cents: item.price_cents || 0,
          original_price_cents: item.original_price_cents || item.price_cents || 0,
          tech_id: item.tech_id || null,
          tech_name: item.tech_name || null,
          service_id: item.service_id || null,
          product_id: item.product_id || null,
          color: item.color || null,
          client_id: t.client_id || item.client_id || null,
        });
      });
    });

    // Fresh items from checkout screen
    var freshItems = newItems.map(function(item) {
      return {
        type: item.type || 'service',
        name: item.name || 'Service',
        price_cents: item.price_cents || 0,
        original_price_cents: item.original_price_cents || item.price_cents || 0,
        tech_id: item.tech_id || item.techId || null,
        tech_name: item.tech_name || item.tech || null,
        service_id: item.service_id || item.serviceCatalogId || null,
        product_id: item.product_id || null,
        color: item.color || null,
        client_id: item.client_id || null,
      };
    });

    var combinedItems = allExistingItems.concat(freshItems);

    // cc19: stamp station_id on each merge-close payment row so Reports
    // can break out per-station even when the pay path was merge-and-close.
    var _stationIdMc = req.headers['x-station-id'] || (req.body && req.body.station_id) || null;
    var paymentCreates = payments.map(function(p) {
      return {
        method: p.method || 'credit',
        amount_cents: p.amount_cents || 0,
        gc_id: p.gc_id || null,
        gc_code: p.gc_code || null,
        card_brand: p.card_brand || null,
        last4: p.last4 || null,
        auth_code: p.auth_code || null,
        entry_method: p.entry_method || null,
        processor_txn_id: p.processor_txn_id || null,
        terminal_response: p.terminal_response || null,
        station_id: p.station_id || _stationIdMc,
      };
    });

    // Collect ALL appointment IDs
    var allApptIds = tickets.map(function(t) { return t.appointment_id; }).filter(Boolean);
    var uniqueApptIds = [];
    allApptIds.forEach(function(id) { if (uniqueApptIds.indexOf(id) === -1) uniqueApptIds.push(id); });

    // Get next ticket number
    var bounds = dayBounds();
    var lastTicket = await prisma.ticket.findFirst({
      where: { salon_id: req.salon_id, created_at: { gte: bounds.start, lte: bounds.end } },
      orderBy: { ticket_number: 'desc' },
      select: { ticket_number: true },
    });
    var newTicketNumber = lastTicket ? lastTicket.ticket_number + 1 : 1;

    var displayNum = tickets.length >= 2 ? numbers.join('&') : null;

    // Use first ticket's client, closeData can override
    var clientId = closeData.client_id || null;
    var clientName = closeData.client_name || null;
    if (!clientId) {
      for (var ci = 0; ci < tickets.length; ci++) {
        if (tickets[ci].client_id) { clientId = tickets[ci].client_id; clientName = tickets[ci].client_name; break; }
      }
    }

    var result = await prisma.$transaction(async function(tx) {
      // 1. Create NEW ticket with all combined items + payments.
      // cc15.4: source_appointment_ids carries every source appointment
      // so any original slip can resolve to this closed absorber later
      // (e.g., for reprint by scan). Scalar appointment_id retained for
      // backward-compat + cc15.3 chain-walk fallback on old data.
      var newTicket = await tx.ticket.create({
        data: {
          salon_id: req.salon_id,
          ticket_number: newTicketNumber,
          display_number: displayNum,
          appointment_id: uniqueApptIds[0] || null,
          source_appointment_ids: uniqueApptIds.length > 0 ? uniqueApptIds : null,
          client_id: clientId,
          client_name: clientName,
          status: 'paid',
          subtotal_cents: closeData.subtotal_cents || 0,
          tax_cents: closeData.tax_cents || 0,
          discount_cents: closeData.discount_cents || 0,
          tip_cents: closeData.tip_cents || 0,
          surcharge_cents: closeData.surcharge_cents || 0,
          dual_pricing_cents: closeData.dual_pricing_cents || 0,
          deposit_cents: closeData.deposit_cents != null ? closeData.deposit_cents : totalDeposit,
          pkg_redeemed_cents: closeData.pkg_redeemed_cents || 0,
          total_cents: closeData.total_cents || 0,
          payment_method: closeData.payment_method || null,
          cashier_id: closeData.cashier_id || null,
          cashier_name: closeData.cashier_name || null,
          created_by_id: closeData.created_by_id || null,
          created_by_name: closeData.created_by_name || null,
          edited_by_id: closeData.edited_by_id || null,
          edited_by_name: closeData.edited_by_name || null,
          tip_distributions: toDb(closeData.tip_distributions || null),
          items: { create: combinedItems },
          payments: { create: paymentCreates },
        },
      });

      // 2. Mark ALL old tickets as merged → pointing to new ticket
      for (var i = 0; i < tickets.length; i++) {
        await tx.ticketItem.deleteMany({ where: { ticket_id: tickets[i].id } });
        await tx.ticketPayment.deleteMany({ where: { ticket_id: tickets[i].id } });
        await tx.ticket.update({
          where: { id: tickets[i].id },
          data: { status: 'merged', merged_into: newTicket.id },
        });
      }

      // 3. Mark ALL appointments as checked_out
      for (var k = 0; k < uniqueApptIds.length; k++) {
        await tx.appointment.update({
          where: { id: uniqueApptIds[k] },
          data: { status: 'checked_out', version: { increment: 1 } },
        }).catch(function() {});
        await tx.serviceLine.updateMany({
          where: { appointment_id: uniqueApptIds[k] },
          data: { status: 'checked_out', payment_method: closeData.payment_method || null },
        }).catch(function() {});
      }

      // 4. Re-fetch with items and payments
      return await tx.ticket.findUnique({
        where: { id: newTicket.id },
        include: { items: true, payments: true },
      });
    }, { timeout: 20000 });

    var closedStaffIds = (result.items || []).map(function(it) { return it.tech_id; }).filter(Boolean);
    closedStaffIds = closedStaffIds.filter(function(id, idx, arr) { return arr.indexOf(id) === idx; });
    emit(req, 'ticket:closed', {
      staff_ids: closedStaffIds,
      client_name: result.client_name || 'Walk-in',
      ticket_number: result.ticket_number,
    });
    if (uniqueApptIds.length > 0) {
      emit(req, 'appointment:updated', {
        staff_ids: closedStaffIds,
        client_name: result.client_name || 'Walk-in',
        status: 'checked_out',
      });
    }
    sendPushToStaffList(req.salon_id, closedStaffIds, {
      title: 'Checked Out',
      body: (result.client_name || 'Walk-in') + ' — checked out',
      tag: 'ticket-closed-' + result.id,
    }).catch(function() {});
    // cc15: log COMBINED on each source's barcode + ABSORBED + PAID on
    // the new absorber's barcode (if it has an appointment). Each source
    // barcode's timeline shows where its items went; the absorber's
    // timeline shows who merged in.
    var ctx = reqContext(req);
    for (var li = 0; li < tickets.length; li++) {
      var srcT = tickets[li];
      logSlipEvent({
        ...ctx,
        eventType:     SLIP_EVENT_TYPES.COMBINED,
        appointmentId: srcT.appointment_id,
        ticketId:      srcT.id,
        payload: {
          merged_into:   result.id,
          absorber_ticket_number: result.ticket_number,
        },
      });
    }
    logSlipEvent({
      ...ctx,
      eventType:     SLIP_EVENT_TYPES.TICKET_PAID,
      appointmentId: result.appointment_id,
      ticketId:      result.id,
      payload: {
        ticket_number:  result.ticket_number,
        display_number: result.display_number || null,
        total_cents:    result.total_cents || 0,
        tip_cents:      result.tip_cents || 0,
        payment_method: result.payment_method || null,
        source_ticket_ids: tickets.map(function(t) { return t.id; }),
        items: itemsSnapshot(result.items),
      },
    });
    res.json({ ticket: formatTicket(result) });
  } catch (err) {
    console.error('[merge-and-close] FAILED:', err.message, err.stack);
    next(err);
  }
});

export default router;
