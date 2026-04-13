/**
 * checkoutVoidRefundTip.js — Void, Refund, and Tip routes
 * Extracted from checkout.js (Session C9) to stay under 800-line cap.
 *
 * Void is same-day only. Refund has no time limit. Once refund exists, void disabled.
 * Tip update used for post-payment tip entry (e.g. credit card tip from terminal slip).
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { toDb, fromDb, dayBounds, formatTicket } from './checkoutHelpers.js';

var router = Router();

// ── POST /tickets/:id/void — Void a ticket (same-day only) ──
router.post('/tickets/:id/void', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { items: true, payments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    // Block void if refund already exists
    if (existing.refund_cents > 0 || existing.refund_at) {
      return res.status(400).json({ error: 'Cannot void a ticket that has been refunded' });
    }

    // Same-day check: ticket must have been created today (Eastern time)
    var todayBounds = dayBounds(); // uses Eastern time
    var ticketCreated = new Date(existing.created_at);
    if (ticketCreated < todayBounds.start || ticketCreated > todayBounds.end) {
      return res.status(400).json({ error: 'Void is same-day only. Use refund for older tickets.' });
    }

    var data = req.body;

    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        status: 'voided',
        void_reason: data.void_reason || data.reason || null,
        void_by: data.void_by || data.staff_id || null,
        void_at: new Date(),
        version: { increment: 1 },
      },
      include: { items: true, payments: true },
    });

    emit(req, 'ticket:voided');
    res.json({ ticket: formatTicket(ticket) });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/refund — Refund a ticket (partial or full) ──
router.post('/tickets/:id/refund', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { items: true, payments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    if (existing.status === 'voided') {
      return res.status(400).json({ error: 'Cannot refund a voided ticket' });
    }

    var data = req.body;
    var refundAmount = data.refund_cents || data.amount_cents || 0;

    // Accumulate refund amount (supports multiple partial refunds)
    var totalRefunded = (existing.refund_cents || 0) + refundAmount;

    var newStatus = totalRefunded >= existing.total_cents ? 'refunded' : existing.status;

    var restoredPkgCredits = [];
    if (data.restore_package_credits) {
      // Determine which specific items are being refunded (if per-item refund)
      var refundItemIds = {};
      var refundItemNames = {};
      if (data.refund_items && data.refund_items.length > 0) {
        data.refund_items.forEach(function(ri) {
          if (ri.isPkgRedeemed) {
            refundItemIds[ri.itemId] = true;
            refundItemNames[ri.name] = (refundItemNames[ri.name] || 0) + 1;
          }
        });
      }
      var hasSpecificItems = Object.keys(refundItemNames).length > 0;

      var redemptions = await prisma.packageRedemption.findMany({
        where: { ticket_id: req.params.id },
      });
      // Fallback: also search for tkt- prefixed ticket_ids (legacy bug: redemptions
      // were saved with temp browser ID before quick-close assigned real DB ID)
      if (redemptions.length === 0 && existing.client_id && (existing.pkg_redeemed_cents || 0) > 0) {
        var cpIds = (await prisma.clientPackage.findMany({ where: { client_id: existing.client_id }, select: { id: true } })).map(function(cp) { return cp.id; });
        if (cpIds.length > 0) {
          var allCandidates = (await prisma.packageRedemption.findMany({
            where: { client_package_id: { in: cpIds }, OR: [{ ticket_id: { startsWith: 'tkt-' } }, { ticket_id: null }] },
            orderBy: { redeemed_at: 'desc' },
          }));
          var matchNames = hasSpecificItems ? Object.assign({}, refundItemNames) : {};
          if (!hasSpecificItems) {
            (existing.items || []).forEach(function(it) { matchNames[it.name] = (matchNames[it.name] || 0) + 1; });
          }
          allCandidates.forEach(function(cr) {
            if ((matchNames[cr.service_redeemed_name] || 0) > 0) {
              redemptions.push(cr);
              matchNames[cr.service_redeemed_name]--;
            }
          });
        }
      }

      // If we found redemptions by real ticket_id AND we have specific refund items,
      // filter to only the ones matching refunded item service names
      if (hasSpecificItems && redemptions.length > 0) {
        var scopedRedemptions = [];
        var scopeNames = Object.assign({}, refundItemNames);
        redemptions.forEach(function(r) {
          if ((scopeNames[r.service_redeemed_name] || 0) > 0) {
            scopedRedemptions.push(r);
            scopeNames[r.service_redeemed_name]--;
          }
        });
        redemptions = scopedRedemptions;
      }

      for (var ri = 0; ri < redemptions.length; ri++) {
        var red = redemptions[ri];
        try {
          await prisma.$transaction(async function(tx) {
            await tx.clientPackageItem.update({
              where: { id: red.client_package_item_id },
              data: { remaining: { increment: 1 } },
            });
            await tx.clientPackage.update({
              where: { id: red.client_package_id },
              data: { status: 'active' },
            });
            await tx.packageRedemption.delete({ where: { id: red.id } });
          }, { timeout: 20000 });
          restoredPkgCredits.push({ cpiId: red.client_package_item_id, service: red.service_redeemed_name });
        } catch (pkgErr) {
          console.warn('[Refund] Failed to restore pkg credit:', red.id, pkgErr.message);
        }
      }
    }

    // ── Restore gift card balance if original payment used gift card ──
    var restoredGiftCards = [];
    var refMethod = (data.refund_method || '').toLowerCase();
    var isOriginalMethod = refMethod.indexOf('gift') !== -1 || refMethod.indexOf('original') !== -1 || refMethod === '';
    if (isOriginalMethod || data.refund_method === 'Original payment method') {
      var gcPayments = (existing.payments || []).filter(function(p) { return p.method === 'giftcard' && p.gc_id; });
      for (var gi = 0; gi < gcPayments.length; gi++) {
        var gcp = gcPayments[gi];
        try {
          var gc = await prisma.giftCard.update({ where: { id: gcp.gc_id }, data: { balance_cents: { increment: gcp.amount_cents }, status: 'active' } });
          await prisma.giftCardTransaction.create({ data: { gift_card_id: gcp.gc_id, type: 'refund', amount_cents: gcp.amount_cents, balance_after_cents: gc.balance_cents, ticket_id: req.params.id, staff_id: data.refund_by || null, staff_name: data.refund_by || 'Manager' } });
          restoredGiftCards.push({ gc_id: gcp.gc_id, gc_code: gcp.gc_code, amount_cents: gcp.amount_cents });
          emit(req, 'giftcard:updated');
        } catch (gcErr) {
          console.warn('[Refund] Failed to restore gift card balance:', gcp.gc_id, gcErr.message);
        }
      }
    }

    // Build this refund record
    var refundRecord = {
      id: 'refund-' + Date.now(),
      items: data.refund_items || [],
      reason: data.refund_reason || data.reason || null,
      method: data.refund_method || null,
      by: data.refund_by || data.staff_id || null,
      at: new Date().toISOString(),
      amount_cents: refundAmount,
      tax_cents: data.refund_tax_cents || 0,
      tip_cents: data.tip_refunded_cents || 0,
      pkgCreditsRestored: restoredPkgCredits.length > 0,
      gcRestored: restoredGiftCards.length > 0,
      gcRestoredDetails: restoredGiftCards,
    };

    // Append to existing refund history
    var existingHistory = fromDb(existing.refund_history) || [];
    var updatedHistory = existingHistory.concat([refundRecord]);

    // Determine if ALL items have been refunded
    var allRefundedItemIds = {};
    updatedHistory.forEach(function(rh) {
      (rh.items || []).forEach(function(ri) { allRefundedItemIds[ri.itemId] = true; });
    });
    var allItemsRefunded = (existing.items || []).every(function(it) { return allRefundedItemIds[it.id]; });
    var finalStatus = allItemsRefunded ? 'refunded' : existing.status;

    var ticket;
    try {
      ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: { status: finalStatus, refund_cents: totalRefunded, refund_reason: data.refund_reason || data.reason || existing.refund_reason || null, refund_by: data.refund_by || data.staff_id || null, refund_at: new Date(), refund_history: toDb(updatedHistory), version: { increment: 1 } },
        include: { items: true, payments: true },
      });
    } catch (updateErr) {
      if (updateErr.message && updateErr.message.indexOf('refund_history') !== -1) {
        console.warn('[Refund] refund_history column missing — run: npx prisma migrate deploy && npx prisma generate');
        ticket = await prisma.ticket.update({
          where: { id: req.params.id },
          data: { status: finalStatus, refund_cents: totalRefunded, refund_reason: data.refund_reason || data.reason || existing.refund_reason || null, refund_by: data.refund_by || data.staff_id || null, refund_at: new Date(), version: { increment: 1 } },
          include: { items: true, payments: true },
        });
      } else { throw updateErr; }
    }
    // Inject refund_history so formatTicket works even if Prisma client wasn't regenerated
    ticket.refund_history = updatedHistory;

    var formatted = formatTicket(ticket);

    emit(req, 'ticket:refunded');
    res.json({
      ticket: formatted,
      refund: {
        id: 'refund-' + Date.now(),
        ticket_id: ticket.id,
        amount_cents: refundAmount,
        total_refunded_cents: totalRefunded,
        refunded_at: ticket.refund_at,
        restoredPkgCredits: restoredPkgCredits,
        restoredGiftCards: restoredGiftCards,
      },
    });
  } catch (err) { next(err); }
});

// ── PUT /tickets/:id/tip — Update tip on a closed ticket ──
// Used when tip is entered after payment (e.g. customer display tip entry)
router.put('/tickets/:id/tip', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    var data = req.body;
    var updateData = { version: { increment: 1 } };

    if (data.tip_cents != null) updateData.tip_cents = data.tip_cents;
    if (data.tip_distributions) updateData.tip_distributions = toDb(data.tip_distributions);
    if (data.tipDistributions) updateData.tip_distributions = toDb(data.tipDistributions);

    // Recalculate total if tip changed
    if (data.tip_cents != null) {
      // total = subtotal + tax + tip + surcharge + dual_pricing - discount - deposit
      updateData.total_cents = existing.subtotal_cents + existing.tax_cents +
        data.tip_cents + existing.surcharge_cents + (existing.dual_pricing_cents || 0) -
        existing.discount_cents - existing.deposit_cents;
    }

    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true, payments: true },
    });

    emit(req, 'ticket:tip_updated');
    res.json({ ticket: formatTicket(ticket) });
  } catch (err) { next(err); }
});

export default router;
