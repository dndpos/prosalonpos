/**
 * checkoutMergeOpen.js — Merge 2+ open tickets into 1 new OPEN ticket
 * C38: Called when user hits Hold/Print on a checkout with combined tickets.
 * Creates a new open ticket with all items, marks old tickets as merged.
 *
 * Endpoint: POST /api/v1/checkout/tickets/merge-open
 *
 * Body: {
 *   ticketIds: string[]   — 2+ existing open ticket IDs to merge
 * }
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { dayBounds, formatTicket } from './checkoutHelpers.js';
// cc15: log COMBINED on each source + ABSORBED on the new ticket so the
// hold-side merge is as visible as the close-side merge.
import { logSlipEvent, SLIP_EVENT_TYPES, reqContext, itemsSnapshot } from '../utils/slipLog.js';

var router = Router();

router.post('/tickets/merge-open', async function(req, res, next) {
  try {
    var ticketIds = req.body.ticketIds || [];
    // cc15: accept optional newItems (adjustments made in the cashier's
    // session that aren't yet in any source ticket's DB row). Mirrors
    // merge-and-close's shape. Without this, Hold after slip-scan
    // combine loses fresh items the cashier added between loading and
    // holding.
    var newItems = req.body.newItems || [];

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 ticket IDs to merge' });
    }

    var tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds }, salon_id: req.salon_id, status: 'open' },
      include: { items: true },
    });

    if (tickets.length < 2) {
      return res.status(400).json({ error: 'Need 2+ open tickets to merge. Found ' + tickets.length });
    }

    tickets.sort(function(a, b) { return a.ticket_number - b.ticket_number; });
    var numbers = tickets.map(function(t) { return t.ticket_number; });
    var displayNum = numbers.join('&');
    var totalDeposit = tickets.reduce(function(sum, t) { return sum + (t.deposit_cents || 0); }, 0);

    // Collect ALL items from all tickets — keep everything as-is
    var combinedItems = [];
    tickets.forEach(function(t) {
      (t.items || []).forEach(function(item) {
        combinedItems.push({
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
    // cc15: append fresh items from the session (not from any source
    // ticket). Client filters these by !_fromTicket before sending.
    newItems.forEach(function(item) {
      combinedItems.push({
        type: item.type || 'service',
        name: item.name || 'Service',
        price_cents: item.price_cents || 0,
        original_price_cents: item.original_price_cents || item.price_cents || 0,
        tech_id: item.tech_id || item.techId || null,
        tech_name: item.tech_name || item.tech || null,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        color: item.color || null,
        client_id: item.client_id || null,
      });
    });

    // Collect appointment IDs
    var uniqueApptIds = [];
    tickets.forEach(function(t) {
      if (t.appointment_id && uniqueApptIds.indexOf(t.appointment_id) === -1) {
        uniqueApptIds.push(t.appointment_id);
      }
    });

    // Use first ticket's client
    var clientId = null;
    var clientName = null;
    for (var ci = 0; ci < tickets.length; ci++) {
      if (tickets[ci].client_id) { clientId = tickets[ci].client_id; clientName = tickets[ci].client_name; break; }
    }

    // Use first ticket's created_by
    var createdById = null;
    var createdByName = null;
    for (var cb = 0; cb < tickets.length; cb++) {
      if (tickets[cb].created_by_id) { createdById = tickets[cb].created_by_id; createdByName = tickets[cb].created_by_name; break; }
    }

    // Get next ticket number
    var bounds = dayBounds();
    var lastTicket = await prisma.ticket.findFirst({
      where: { salon_id: req.salon_id, created_at: { gte: bounds.start, lte: bounds.end } },
      orderBy: { ticket_number: 'desc' },
      select: { ticket_number: true },
    });
    var newTicketNumber = lastTicket ? lastTicket.ticket_number + 1 : 1;

    var result = await prisma.$transaction(async function(tx) {
      // 1. Create NEW open ticket with all combined items.
      // cc15.4: store ALL source appointment_ids in source_appointment_ids.
      // Scalar appointment_id still holds the first source's id for
      // backward-compat with clients that predate cc15.4 (and for the
      // cc15.3 chain-walk safety net on historical data). New lookups
      // prefer the array so every source slip maps to the absorber.
      var newTicket = await tx.ticket.create({
        data: {
          salon_id: req.salon_id,
          ticket_number: newTicketNumber,
          display_number: displayNum,
          appointment_id: uniqueApptIds[0] || null,
          source_appointment_ids: uniqueApptIds.length > 0 ? uniqueApptIds : null,
          client_id: clientId,
          client_name: clientName,
          status: 'open',
          deposit_cents: totalDeposit,
          created_by_id: createdById,
          created_by_name: createdByName,
          items: { create: combinedItems },
        },
      });

      // 2. Mark ALL old tickets as merged
      for (var i = 0; i < tickets.length; i++) {
        await tx.ticketItem.deleteMany({ where: { ticket_id: tickets[i].id } });
        await tx.ticket.update({
          where: { id: tickets[i].id },
          data: { status: 'merged', merged_into: newTicket.id },
        });
      }

      // 3. Re-fetch with items
      return await tx.ticket.findUnique({
        where: { id: newTicket.id },
        include: { items: true, payments: true },
      });
    }, { timeout: 20000 });

    emit(req, 'ticket:merged');
    // cc15: log the combine on every source barcode + absorbed on the
    // new absorber's barcode.
    var ctx = reqContext(req);
    for (var li = 0; li < tickets.length; li++) {
      var srcT = tickets[li];
      logSlipEvent({
        ...ctx,
        eventType:     SLIP_EVENT_TYPES.COMBINED,
        appointmentId: srcT.appointment_id,
        ticketId:      srcT.id,
        payload: { merged_into: result.id, absorber_ticket_number: result.ticket_number, via: 'hold' },
      });
    }
    logSlipEvent({
      ...ctx,
      eventType:     SLIP_EVENT_TYPES.ABSORBED,
      appointmentId: result.appointment_id,
      ticketId:      result.id,
      payload: {
        ticket_number:  result.ticket_number,
        display_number: result.display_number || null,
        source_ticket_ids: tickets.map(function(t) { return t.id; }),
        items: itemsSnapshot(result.items),
      },
    });
    res.json({ ticket: formatTicket(result) });
  } catch (err) {
    console.error('[merge-open] FAILED:', err.message, err.stack);
    next(err);
  }
});

export default router;
