/**
 * checkoutMergeClose.js — Merge + Pay + Close in one atomic call
 * Session C6 | Prevents ticket list flash during multi-ticket checkout
 *
 * Uses ONLY fields proven to exist in the Railway DB (matches /tickets/:id/close).
 * display_number, merged_into, closed_at are in schema but may not be migrated.
 * Tries with merge fields first, retries without on any column error.
 *
 * Endpoint: POST /api/v1/checkout/tickets/merge-and-close
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { toDb, formatTicket } from './checkoutHelpers.js';

var router = Router();

router.post('/tickets/merge-and-close', async function(req, res, next) {
  try {
    var ticketIds = req.body.ticketIds;
    var payments = req.body.payments || [];
    var closeData = req.body.closeData || {};

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length < 2) {
      return res.status(400).json({ error: 'Need 2+ ticket IDs to merge-and-close' });
    }

    var tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds }, salon_id: req.salon_id, status: 'open' },
      include: { items: true, payments: true },
    });

    if (tickets.length < 2) {
      return res.status(400).json({ error: 'Need 2+ open tickets. Found ' + tickets.length });
    }

    tickets.sort(function(a, b) { return a.ticket_number - b.ticket_number; });
    var absorber = tickets[0];
    var absorbed = tickets.slice(1);
    var numbers = tickets.map(function(t) { return t.ticket_number; });
    var displayNum = numbers.join('&');
    var totalDeposit = tickets.reduce(function(sum, t) { return sum + (t.deposit_cents || 0); }, 0);

    var paymentCreates = payments.map(function(p) {
      return {
        method: p.method || 'credit',
        amount_cents: p.amount_cents || 0,
        gc_id: p.gc_id || null,
        gc_code: p.gc_code || null,
      };
    });

    // Build absorber close data — ONLY fields proven to work (matches /tickets/:id/close)
    var absorberUpdate = {
      status: 'paid',
      deposit_cents: closeData.deposit_cents != null ? closeData.deposit_cents : totalDeposit,
      subtotal_cents: closeData.subtotal_cents || 0,
      tax_cents: closeData.tax_cents || 0,
      discount_cents: closeData.discount_cents || 0,
      tip_cents: closeData.tip_cents || 0,
      surcharge_cents: closeData.surcharge_cents || 0,
      total_cents: closeData.total_cents || 0,
      payment_method: closeData.payment_method || null,
      cashier_id: closeData.cashier_id || null,
      version: { increment: 1 },
    };
    if (closeData.tip_distributions) {
      absorberUpdate.tip_distributions = toDb(closeData.tip_distributions);
    }

    // Try full version with merge fields + pkg_redeemed_cents
    var fullUpdate = Object.assign({}, absorberUpdate);
    fullUpdate.display_number = displayNum;
    if (closeData.pkg_redeemed_cents != null) {
      fullUpdate.pkg_redeemed_cents = closeData.pkg_redeemed_cents;
    }

    async function doTransaction(tx, useFullFields) {
      var closeFields = useFullFields ? fullUpdate : absorberUpdate;

      // 1. Stamp client_id on absorber items
      if (absorber.client_id) {
        await tx.ticketItem.updateMany({
          where: { ticket_id: absorber.id },
          data: { client_id: absorber.client_id },
        });
      }

      // 2. Move items from absorbed → absorber
      for (var i = 0; i < absorbed.length; i++) {
        var src = absorbed[i];
        if (src.client_id) {
          await tx.ticketItem.updateMany({
            where: { ticket_id: src.id },
            data: { client_id: src.client_id },
          });
        }
        await tx.ticketItem.updateMany({
          where: { ticket_id: src.id },
          data: { ticket_id: absorber.id },
        });
        // Mark absorbed ticket
        if (useFullFields) {
          await tx.ticket.update({
            where: { id: src.id },
            data: { status: 'merged', merged_into: absorber.id },
          });
        } else {
          await tx.ticket.update({
            where: { id: src.id },
            data: { status: 'paid' },
          });
        }
      }

      // 3. Add payments
      for (var j = 0; j < paymentCreates.length; j++) {
        await tx.ticketPayment.create({
          data: Object.assign({ ticket_id: absorber.id }, paymentCreates[j]),
        });
      }

      // 4. Close absorber
      await tx.ticket.update({
        where: { id: absorber.id },
        data: closeFields,
      });

      // 5. Re-fetch
      return await tx.ticket.findUnique({
        where: { id: absorber.id },
        include: { items: true, payments: true },
      });
    }

    var result;
    try {
      result = await prisma.$transaction(function(tx) {
        return doTransaction(tx, true);
      });
    } catch (err1) {
      console.warn('[merge-and-close] Full attempt failed:', err1.message);
      // Retry with minimal fields
      try {
        result = await prisma.$transaction(function(tx) {
          return doTransaction(tx, false);
        });
      } catch (err2) {
        console.error('[merge-and-close] Minimal attempt also failed:', err2.message);
        throw err2;
      }
    }

    emit(req, 'ticket:closed');
    res.json({ ticket: formatTicket(result) });
  } catch (err) {
    console.error('[merge-and-close] FAILED:', err.message);
    next(err);
  }
});

export default router;
