/**
 * checkoutMergeClose.js — Merge + Pay + Close in one atomic call
 * Session C6 | Prevents ticket list flash during multi-ticket checkout
 *
 * Endpoint: POST /api/v1/checkout/tickets/merge-and-close
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { toDb, formatTicket } from './checkoutHelpers.js';

var router = Router();

async function runTransaction(tx, absorber, absorbed, paymentCreates, closeData, displayNum, totalDeposit, useMergeFields) {
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
    // Mark absorbed — use merged status if columns exist, otherwise just close
    var absorbedData = useMergeFields
      ? { status: 'merged', merged_into: absorber.id }
      : { status: 'paid' };
    await tx.ticket.update({ where: { id: src.id }, data: absorbedData });
  }

  // 3. Add payments to absorber
  for (var j = 0; j < paymentCreates.length; j++) {
    await tx.ticketPayment.create({
      data: Object.assign({ ticket_id: absorber.id }, paymentCreates[j]),
    });
  }

  // 4. Close absorber as paid
  var updateData = {
    deposit_cents: closeData.deposit_cents != null ? closeData.deposit_cents : totalDeposit,
    status: 'paid',
    subtotal_cents: closeData.subtotal_cents || 0,
    tax_cents: closeData.tax_cents || 0,
    discount_cents: closeData.discount_cents || 0,
    tip_cents: closeData.tip_cents || 0,
    surcharge_cents: closeData.surcharge_cents || 0,
    total_cents: closeData.total_cents || 0,
    payment_method: closeData.payment_method || null,
    cashier_id: closeData.cashier_id || null,
    closed_at: new Date(),
  };
  if (useMergeFields && displayNum) {
    updateData.display_number = displayNum;
  }
  if (closeData.pkg_redeemed_cents != null) {
    updateData.pkg_redeemed_cents = closeData.pkg_redeemed_cents;
  }
  if (closeData.tip_distributions) {
    updateData.tip_distributions = toDb(closeData.tip_distributions);
  }

  await tx.ticket.update({ where: { id: absorber.id }, data: updateData });

  // 5. Re-fetch final state
  return await tx.ticket.findUnique({
    where: { id: absorber.id },
    include: { items: true, payments: true },
  });
}

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

    // Try with merge fields first, fall back without if columns missing
    var result;
    try {
      result = await prisma.$transaction(function(tx) {
        return runTransaction(tx, absorber, absorbed, paymentCreates, closeData, displayNum, totalDeposit, true);
      });
    } catch (firstErr) {
      if (firstErr.message && (firstErr.message.indexOf('display_number') >= 0 || firstErr.message.indexOf('merged_into') >= 0)) {
        console.warn('[merge-and-close] Merge columns missing, retrying without:', firstErr.message);
        result = await prisma.$transaction(function(tx) {
          return runTransaction(tx, absorber, absorbed, paymentCreates, closeData, displayNum, totalDeposit, false);
        });
      } else {
        throw firstErr;
      }
    }

    emit(req, 'ticket:closed');
    res.json({ ticket: formatTicket(result) });
  } catch (err) {
    console.error('[merge-and-close] FAILED:', err.message, err.stack);
    next(err);
  }
});

export default router;
