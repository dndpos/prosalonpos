/**
 * ProSalonPOS — Checkout / Ticket Routes
 * Void is same-day only. Refund has no time limit. Once refund exists, void disabled.
 * Cash/Zelle single-payment auto-removes tip. Split payments keep tip.
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { emit } from '../utils/emit.js';
import { toDb, fromDb, dayBounds, getEasternOffset, formatTicket } from './checkoutHelpers.js';
var router = Router();

// ── ROUTES ──

// ── GET /tickets — List tickets for a date or date range ──
router.get('/tickets', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id };
    if (req.query.start && req.query.end) {
      // Date range query — for reports, payroll, etc.
      // Use dayBounds for each date to get correct Eastern time boundaries
      var rangeBoundsStart = dayBounds(req.query.start);
      var rangeBoundsEnd = dayBounds(req.query.end);
      where.created_at = { gte: rangeBoundsStart.start, lte: rangeBoundsEnd.end };
    } else {
      // Single day (default: today)
      var bounds = dayBounds(req.query.date);
      where.created_at = { gte: bounds.start, lte: bounds.end };
    }
    var tickets = await prisma.ticket.findMany({
      where: where,
      include: { items: true, payments: true },
      orderBy: { ticket_number: 'asc' },
    });
    console.log('[GET /tickets] query:', req.query, '| found:', tickets.length, '| statuses:', tickets.map(function(t){return t.status;}).join(','));
    // Look up package redemptions for tickets with pkg_redeemed_cents > 0
    var ticketIds = tickets.filter(function(t){ return (t.pkg_redeemed_cents || 0) > 0; }).map(function(t){ return t.id; });
    var allPkgRedemptions = {};
    if (ticketIds.length > 0) {
      var redemptions = await prisma.packageRedemption.findMany({ where: { ticket_id: { in: ticketIds } } });
      redemptions.forEach(function(r) {
        if (!allPkgRedemptions[r.ticket_id]) allPkgRedemptions[r.ticket_id] = [];
        allPkgRedemptions[r.ticket_id].push(r);
      });
    }
    res.json({ tickets: tickets.map(function(t) { return formatTicket(t, allPkgRedemptions[t.id] || []); }) });
  } catch (err) { next(err); }
});

// ── GET /next-ticket-number — Get the next sequential ticket number for today ──
router.get('/next-ticket-number', async function(req, res, next) {
  try {
    var bounds = dayBounds();
    var lastTicket = await prisma.ticket.findFirst({
      where: {
        salon_id: req.salon_id,
        created_at: { gte: bounds.start, lte: bounds.end },
      },
      orderBy: { ticket_number: 'desc' },
      select: { ticket_number: true },
    });
    var nextNumber = lastTicket ? lastTicket.ticket_number + 1 : 1;
    res.json({ nextTicketNumber: nextNumber });
  } catch (err) { next(err); }
});

// ── POST /tickets — Create a new open ticket ──
router.post('/tickets', async function(req, res, next) {
  try {
    var data = req.body;
    var bounds = dayBounds();
    // Get next ticket number for today
    var lastTicket = await prisma.ticket.findFirst({
      where: {
        salon_id: req.salon_id,
        created_at: { gte: bounds.start, lte: bounds.end },
      },
      orderBy: { ticket_number: 'desc' },
      select: { ticket_number: true },
    });
    var ticketNumber = lastTicket ? lastTicket.ticket_number + 1 : 1;
    // Build line items from request
    var itemsCreate = (data.lineItems || data.items || []).map(function(item) {
      return {
        type: item.type || 'service',
        name: item.name || 'Service',
        price_cents: item.price_cents || 0,
        original_price_cents: item.original_price_cents || item.price_cents || 0,
        tech_id: item.tech_id || item.techId || null,
        tech_name: item.tech_name || item.tech || null,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        color: item.color || null,
      };
    });
    var ticket = await prisma.ticket.create({
      data: {
        salon_id: req.salon_id,
        ticket_number: ticketNumber,
        appointment_id: data.appointment_id || null,
        client_id: data.client_id || null,
        client_name: data.client_name || null,
        status: 'open',
        deposit_cents: data.deposit_cents || data.depositCents || 0,
        cashier_id: data.cashier_id || null,
        cashier_name: data.cashier_name || null,
        items: { create: itemsCreate },
      },
      include: { items: true, payments: true },
    });
    emit(req, 'ticket:created');
    res.status(201).json({ ticket: formatTicket(ticket) });
  } catch (err) { next(err); }
});

// ── PUT /tickets/:id — Update an open ticket ──
router.put('/tickets/:id', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.status !== 'open') {
      return res.status(400).json({ error: 'Cannot update a ' + existing.status + ' ticket' });
    }
    var data = req.body;
    var updateData = {};
    // Simple fields that can be updated on an open ticket
    var fields = ['client_id', 'client_name', 'appointment_id', 'subtotal_cents',
      'tax_cents', 'discount_cents', 'tip_cents', 'surcharge_cents', 'deposit_cents',
      'total_cents', 'cashier_id', 'cashier_name'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });
    // Handle camelCase aliases from frontend
    if (data.depositCents !== undefined) updateData.deposit_cents = data.depositCents;
    if (data.clientName !== undefined) updateData.client_name = data.clientName;
    updateData.version = { increment: 1 };
    // If new items are provided, replace all items
    if (data.lineItems || data.items) {
      var newItems = data.lineItems || data.items;
      // Delete existing items and create new ones
      await prisma.ticketItem.deleteMany({ where: { ticket_id: req.params.id } });
      if (newItems.length > 0) {
        await prisma.ticketItem.createMany({
          data: newItems.map(function(item) {
            return {
              ticket_id: req.params.id,
              type: item.type || 'service',
              name: item.name || 'Service',
              price_cents: item.price_cents || 0,
              original_price_cents: item.original_price_cents || item.price_cents || 0,
              tech_id: item.tech_id || item.techId || null,
              tech_name: item.tech_name || item.tech || null,
              service_id: item.service_id || null,
              product_id: item.product_id || null,
              color: item.color || null,
            };
          }),
        });
      }
    }
    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true, payments: true },
    });
    emit(req, 'ticket:updated');
    res.json({ ticket: formatTicket(ticket) });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/pay — Add a payment to a ticket ──
router.post('/tickets/:id/pay', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { payments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.status !== 'open') {
      return res.status(400).json({ error: 'Cannot pay a ' + existing.status + ' ticket' });
    }
    var data = req.body;
    var payment = await prisma.ticketPayment.create({
      data: {
        ticket_id: req.params.id,
        method: data.method || 'cash',
        amount_cents: data.amount_cents || 0,
        gc_id: data.gc_id || null,
        gc_code: data.gc_code || null,
      },
    });
    emit(req, 'ticket:payment');
    res.status(201).json({ payment: payment });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/close — Close a ticket (mark as paid) ──
router.post('/tickets/:id/close', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.status !== 'open') {
      return res.status(400).json({ error: 'Ticket is already ' + existing.status });
    }
    var data = req.body;

    var updateData = {
      status: 'paid',
      subtotal_cents: data.subtotal_cents != null ? data.subtotal_cents : existing.subtotal_cents,
      tax_cents: data.tax_cents != null ? data.tax_cents : existing.tax_cents,
      discount_cents: data.discount_cents != null ? data.discount_cents : existing.discount_cents,
      tip_cents: data.tip_cents != null ? data.tip_cents : existing.tip_cents,
      surcharge_cents: data.surcharge_cents != null ? data.surcharge_cents : existing.surcharge_cents,
      deposit_cents: data.deposit_cents != null ? data.deposit_cents : existing.deposit_cents,
      total_cents: data.total_cents != null ? data.total_cents : existing.total_cents,
      payment_method: data.payment_method != null ? data.payment_method : existing.payment_method,
      cashier_id: data.cashier_id || existing.cashier_id,
      cashier_name: data.cashier_name || existing.cashier_name,
      tip_distributions: data.tip_distributions != null || data.tipDistributions != null ? toDb(data.tip_distributions || data.tipDistributions || null) : existing.tip_distributions,
      version: { increment: 1 },
    };

    // Add pkg_redeemed_cents only if provided (resilient if migration not applied)
    if (data.pkg_redeemed_cents != null) {
      updateData.pkg_redeemed_cents = data.pkg_redeemed_cents;
    }

    var ticket;
    try {
      ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: updateData,
        include: { items: true, payments: true },
      });
    } catch (updateErr) {
      console.error('[Close] First attempt failed:', updateErr.message);
      if (updateErr.message.indexOf('pkg_redeemed_cents') >= 0) {
        console.log('[Close] Retrying without pkg_redeemed_cents...');
        delete updateData.pkg_redeemed_cents;
        ticket = await prisma.ticket.update({
          where: { id: req.params.id },
          data: updateData,
          include: { items: true, payments: true },
        });
      } else {
        throw updateErr;
      }
    }

    emit(req, 'ticket:closed');
    res.json({ ticket: formatTicket(ticket) });
  } catch (err) {
    console.error('[Close] FAILED:', err.message);
    next(err);
  }
});

// ── POST /tickets/:id/reopen — Reopen a paid ticket for editing ──
router.post('/tickets/:id/reopen', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { items: true, payments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.status !== 'paid') {
      return res.status(400).json({ error: 'Only paid tickets can be reopened' });
    }

    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status: 'open', version: { increment: 1 } },
      include: { items: true, payments: true },
    });

    emit(req, 'ticket:updated');
    res.json({ ticket: formatTicket(ticket) });
  } catch (err) { next(err); }
});

// ── DELETE /tickets/:id/payments — Remove payments from a reopened ticket ──
router.delete('/tickets/:id/payments', async function(req, res, next) {
  try {
    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { payments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (existing.status !== 'open') return res.status(400).json({ error: 'Can only remove payments from open tickets' });
    await prisma.ticketPayment.deleteMany({ where: { ticket_id: req.params.id } });
    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { payment_method: null, version: { increment: 1 } },
      include: { items: true, payments: true },
    });
    emit(req, 'ticket:updated');
    res.json({ ticket: formatTicket(ticket), deletedCount: existing.payments.length });
  } catch (err) { next(err); }
});

// ── POST /tickets/merge — Merge 2+ open tickets into one ──
router.post('/tickets/merge', async function(req, res, next) {
  try {
    var ticketIds = req.body.ticketIds;
    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length < 2) {
      return res.status(400).json({ error: 'Need 2+ ticket IDs to merge' });
    }

    // Fetch all tickets with items
    var tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds }, salon_id: req.salon_id, status: 'open' },
      include: { items: true, payments: true },
    });

    if (tickets.length < 2) {
      return res.status(400).json({ error: 'Need 2+ open tickets to merge. Found ' + tickets.length });
    }

    // Sort by ticket_number — lowest absorbs
    tickets.sort(function(a, b) { return a.ticket_number - b.ticket_number; });
    var absorber = tickets[0];
    var absorbed = tickets.slice(1);

    // Build display number: '4&6' or '4&6&9'
    var numbers = tickets.map(function(t) { return t.ticket_number; });
    var displayNum = numbers.join('&');

    // Combine deposits
    var totalDeposit = tickets.reduce(function(sum, t) { return sum + (t.deposit_cents || 0); }, 0);

    // Run everything in a transaction
    var result = await prisma.$transaction(async function(tx) {
      // 1. Stamp client_id on absorber's own items
      if (absorber.client_id) {
        await tx.ticketItem.updateMany({
          where: { ticket_id: absorber.id },
          data: { client_id: absorber.client_id },
        });
      }

      // 2. Move items from absorbed tickets to absorber, stamp client_id
      for (var i = 0; i < absorbed.length; i++) {
        var src = absorbed[i];
        // Stamp source client_id on items before moving
        if (src.client_id) {
          await tx.ticketItem.updateMany({
            where: { ticket_id: src.id },
            data: { client_id: src.client_id },
          });
        }
        // Move items to absorber
        await tx.ticketItem.updateMany({
          where: { ticket_id: src.id },
          data: { ticket_id: absorber.id },
        });
        // Mark absorbed ticket
        await tx.ticket.update({
          where: { id: src.id },
          data: { status: 'merged', merged_into: absorber.id },
        });
      }

      // 3. Update absorber: display_number, combined deposit
      await tx.ticket.update({
        where: { id: absorber.id },
        data: { display_number: displayNum, deposit_cents: totalDeposit },
      });

      // 4. Re-fetch absorber with all items
      return await tx.ticket.findUnique({
        where: { id: absorber.id },
        include: { items: true, payments: true },
      });
    });

    emit(req, 'ticket:merged');
    res.json({ ticket: formatTicket(result) });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/void — Void a ticket (same-day only) ──
// Business rule: void same-day only; once refund exists, void is disabled.
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
          });
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
      // total = subtotal + tax + tip + surcharge - discount - deposit
      updateData.total_cents = existing.subtotal_cents + existing.tax_cents +
        data.tip_cents + existing.surcharge_cents -
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

// ── POST /tickets/quick-close — Create + Pay + Close in one call ──
router.post('/tickets/quick-close', async function(req, res, next) {
  try {
    var data = req.body;
    var bounds = dayBounds();

    // Get next ticket number for today
    var lastTicket = await prisma.ticket.findFirst({
      where: {
        salon_id: req.salon_id,
        created_at: { gte: bounds.start, lte: bounds.end },
      },
      orderBy: { ticket_number: 'desc' },
      select: { ticket_number: true },
    });
    var ticketNumber = lastTicket ? lastTicket.ticket_number + 1 : 1;

    // Build line items
    var itemsCreate = (data.items || []).map(function(item) {
      return {
        type: item.type || 'service',
        name: item.name || 'Service',
        price_cents: item.price_cents || 0,
        original_price_cents: item.original_price_cents || item.price_cents || 0,
        tech_id: item.tech_id || item.techId || null,
        tech_name: item.tech_name || item.tech || null,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        color: item.color || null,
      };
    });

    // Build payments
    var paymentsCreate = (data.payments || []).map(function(p) {
      return {
        method: p.method || 'credit',
        amount_cents: p.amount_cents || 0,
        gc_id: p.gc_id || null,
        gc_code: p.gc_code || null,
      };
    });

    // Build ticket data — pkg_redeemed_cents included if available
    var ticketData = {
      salon_id: req.salon_id,
      ticket_number: ticketNumber,
      appointment_id: data.appointment_id || null,
      client_id: data.client_id || null,
      client_name: data.client_name || null,
      status: 'paid',
      subtotal_cents: data.subtotal_cents || 0,
      tax_cents: data.tax_cents || 0,
      discount_cents: data.discount_cents || 0,
      tip_cents: data.tip_cents || 0,
      surcharge_cents: data.surcharge_cents || 0,
      deposit_cents: data.deposit_cents || 0,
      total_cents: data.total_cents || 0,
      payment_method: data.payment_method || null,
      cashier_id: data.cashier_id || null,
      cashier_name: data.cashier_name || null,
      tip_distributions: toDb(data.tip_distributions || null),
      items: { create: itemsCreate },
      payments: { create: paymentsCreate },
    };

    // Add pkg_redeemed_cents only if provided (resilient if migration not applied)
    if (data.pkg_redeemed_cents != null) {
      ticketData.pkg_redeemed_cents = data.pkg_redeemed_cents;
    }

    var ticket;
    try {
      ticket = await prisma.ticket.create({
        data: ticketData,
        include: { items: true, payments: true },
      });
    } catch (createErr) {
      // If create fails due to pkg_redeemed_cents column not existing, retry without it
      console.error('[Quick-Close] First attempt failed:', createErr.message);
      if (createErr.message.indexOf('pkg_redeemed_cents') >= 0) {
        console.log('[Quick-Close] Retrying without pkg_redeemed_cents...');
        delete ticketData.pkg_redeemed_cents;
        ticket = await prisma.ticket.create({
          data: ticketData,
          include: { items: true, payments: true },
        });
      } else {
        throw createErr;
      }
    }

    // Mark appointment + service lines as checked_out (prevents re-checkout from calendar)
    if (data.appointment_id) {
      await prisma.appointment.update({
        where: { id: data.appointment_id },
        data: { status: 'checked_out', version: { increment: 1 } },
      }).catch(function() {}); // non-fatal — frontend also does this
      await prisma.serviceLine.updateMany({
        where: { appointment_id: data.appointment_id },
        data: { status: 'checked_out' },
      }).catch(function() {}); // non-fatal
      emit(req, 'appointment:updated');
    }

    emit(req, 'ticket:closed');
    res.status(201).json({ ticket: formatTicket(ticket) });
  } catch (err) {
    console.error('[Quick-Close] FAILED:', err.message, err.stack);
    next(err);
  }
});

// ── DELETE /tickets/bulk/all — Delete ALL tickets for this salon (owner only) ──
router.delete('/tickets/bulk/all', async function(req, res, next) {
  try {
    if (req.staff_role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can bulk delete tickets' });
    }

    var tickets = await prisma.ticket.findMany({
      where: { salon_id: req.salon_id },
      select: { id: true }
    });
    var ticketIds = tickets.map(function(t) { return t.id; });

    if (ticketIds.length === 0) {
      return res.json({ success: true, deleted: 0 });
    }

    await prisma.ticketPayment.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    await prisma.ticketItem.deleteMany({ where: { ticket_id: { in: ticketIds } } });
    var result = await prisma.ticket.deleteMany({ where: { salon_id: req.salon_id } });

    console.log('[Checkout] Bulk deleted', result.count, 'tickets for salon', req.salon_id);
    emit(req, 'ticket:deleted');
    res.json({ success: true, deleted: result.count });
  } catch (err) { next(err); }
});

// ── DELETE /tickets/:id — Hard delete a ticket (owner only) ──
router.delete('/tickets/:id', async function(req, res, next) {
  try {
    if (req.staff_role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can delete tickets' });
    }

    var existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    await prisma.ticket.delete({ where: { id: req.params.id } });

    console.log('[Checkout] Ticket permanently deleted:', req.params.id, 'by owner');
    emit(req, 'ticket:deleted');
    res.json({ success: true, deleted_id: req.params.id });
  } catch (err) { next(err); }
});

export default router;
