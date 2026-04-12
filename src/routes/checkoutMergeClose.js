/**
 * checkoutMergeClose.js — Merge + Pay + Close in one atomic call
 * Session C6 | C10: fixed closed_at fallback bug + mark all appointments checked_out
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

    // Collect ALL appointment IDs from every ticket being merged
    var allApptIds = tickets.map(function(t) { return t.appointment_id; }).filter(Boolean);
    // Deduplicate
    var uniqueApptIds = [];
    allApptIds.forEach(function(id) { if (uniqueApptIds.indexOf(id) === -1) uniqueApptIds.push(id); });

    var result = await prisma.$transaction(async function(tx) {
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
        // Mark absorbed ticket as merged
        await tx.ticket.update({
          where: { id: src.id },
          data: { status: 'merged', merged_into: absorber.id },
        });
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
      };
      if (displayNum) {
        updateData.display_number = displayNum;
      }
      if (closeData.pkg_redeemed_cents != null) {
        updateData.pkg_redeemed_cents = closeData.pkg_redeemed_cents;
      }
      if (closeData.tip_distributions) {
        updateData.tip_distributions = toDb(closeData.tip_distributions);
      }
      await tx.ticket.update({ where: { id: absorber.id }, data: updateData });

      // 5. Mark ALL appointments as checked_out (both absorber's and absorbed's)
      for (var k = 0; k < uniqueApptIds.length; k++) {
        await tx.appointment.update({
          where: { id: uniqueApptIds[k] },
          data: { status: 'checked_out', version: { increment: 1 } },
        });
        await tx.serviceLine.updateMany({
          where: { appointment_id: uniqueApptIds[k] },
          data: { status: 'checked_out', payment_method: closeData.payment_method || null },
        });
      }

      // 6. Re-fetch final state
      return await tx.ticket.findUnique({
        where: { id: absorber.id },
        include: { items: true, payments: true },
      });
    }, { timeout: 20000 });

    emit(req, 'ticket:closed');
    if (uniqueApptIds.length > 0) {
      emit(req, 'appointment:updated');
    }
    res.json({ ticket: formatTicket(result) });
  } catch (err) {
    console.error('[merge-and-close] FAILED:', err.message, err.stack);
    next(err);
  }
});

export default router;
