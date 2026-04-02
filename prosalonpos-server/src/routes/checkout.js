/**
 * ProSalonPOS — Checkout / Ticket Routes
 * Session 57 | Phase 2 — Tickets API
 *
 * All endpoints require JWT authentication.
 * salon_id comes from the JWT token — never from the request.
 *
 * Business rules:
 *   - Ticket numbers are daily sequential (reset each day): 1, 2, 3...
 *   - Void is same-day only
 *   - Refund has no time limit
 *   - Once a refund exists on a ticket, void is disabled
 *   - Surcharges apply to full total including tax and tip
 *   - Cash/Zelle single-payment auto-removes tip (collected outside system)
 *   - Split payments keep tip
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { emit } from '../utils/emit.js';

function toDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'object') return JSON.stringify(val);
  return val;
}
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

var router = Router();

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

/**
 * Get start-of-day and end-of-day boundaries for a date string (YYYY-MM-DD).
 * If no date provided, uses today.
 */
function dayBounds(dateStr) {
  var d;
  if (dateStr) {
    // Parse as local date (not UTC) so "2026-03-29" means midnight local time
    var parts = dateStr.split('-');
    d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    d = new Date();
  }
  var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start: start, end: end };
}

/**
 * Format a ticket from Prisma (with includes) into the shape the frontend expects.
 * The ticketStore expects: id, ticket_number (as ticketNumber), clientName, client,
 * items (as lineItems shape), status, payments, tipDistributions, etc.
 */
function formatTicket(t) {
  return {
    id: t.id,
    ticket_number: t.ticket_number,
    ticketNumber: t.ticket_number,
    appointment_id: t.appointment_id,
    client_id: t.client_id,
    client_name: t.client_name,
    clientName: t.client_name,
    status: t.status,
    subtotal_cents: t.subtotal_cents,
    subtotalCents: t.subtotal_cents || 0,
    tax_cents: t.tax_cents,
    taxCents: t.tax_cents || 0,
    discount_cents: t.discount_cents,
    discountCents: t.discount_cents || 0,
    tip_cents: t.tip_cents,
    tipCents: t.tip_cents || 0,
    surcharge_cents: t.surcharge_cents,
    surchargeCents: t.surcharge_cents || 0,
    deposit_cents: t.deposit_cents,
    depositCents: t.deposit_cents || 0,
    total_cents: t.total_cents,
    totalCents: t.total_cents || 0,
    payment_method: t.payment_method,
    paymentMethod: t.payment_method,
    cashier_id: t.cashier_id,
    cashier_name: t.cashier_name,
    cashierName: t.cashier_name,
    tip_distributions: fromDb(t.tip_distributions),
    tipDistributions: fromDb(t.tip_distributions) || [],
    tipDistributed: !!(t.tip_distributions && (fromDb(t.tip_distributions) || []).length > 0),
    void_reason: t.void_reason,
    voidReason: t.void_reason,
    void_by: t.void_by,
    void_at: t.void_at,
    voidAt: t.void_at ? t.void_at.getTime() : null,
    refund_cents: t.refund_cents,
    refundCents: t.refund_cents || 0,
    refund_reason: t.refund_reason,
    refund_by: t.refund_by,
    refund_at: t.refund_at,
    created_at: t.created_at,
    createdAt: t.created_at ? t.created_at.getTime() : Date.now(),
    closedAt: t.status === 'paid' ? (t.updated_at ? t.updated_at.getTime() : Date.now()) : null,
    updated_at: t.updated_at,
    version: t.version,
    // Items formatted for frontend
    items: (t.items || []).map(function(item) {
      return {
        id: item.id,
        type: item.type,
        name: item.name,
        price_cents: item.price_cents,
        original_price_cents: item.original_price_cents,
        tech_id: item.tech_id,
        techId: item.tech_id,
        tech_name: item.tech_name,
        tech: item.tech_name,
        service_id: item.service_id,
        product_id: item.product_id,
        color: item.color,
      };
    }),
    // Payments
    payments: (t.payments || []).map(function(p) {
      return {
        id: p.id,
        ticket_id: p.ticket_id,
        method: p.method,
        amount_cents: p.amount_cents,
        gc_id: p.gc_id,
        gc_code: p.gc_code,
        created_at: p.created_at,
      };
    }),
  };
}

// ════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════

// ── GET /tickets — List tickets for a date or date range ──
// Query params: ?date=YYYY-MM-DD (single day), or ?start=YYYY-MM-DD&end=YYYY-MM-DD (range)
// If no params, returns today's tickets only.
router.get('/tickets', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id };

    if (req.query.start && req.query.end) {
      // Date range query — for reports, payroll, etc.
      var startParts = req.query.start.split('-');
      var endParts = req.query.end.split('-');
      var rangeStart = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0, 0);
      var rangeEnd = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59, 999);
      where.created_at = { gte: rangeStart, lte: rangeEnd };
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

    res.json({ tickets: tickets.map(formatTicket) });
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
// Used for: adding/removing items, changing client, updating totals before close
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
// Supports split payments — each call adds one payment record.
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
// Receives final totals + tip + payment method summary
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

    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        status: 'paid',
        subtotal_cents: data.subtotal_cents != null ? data.subtotal_cents : existing.subtotal_cents,
        tax_cents: data.tax_cents != null ? data.tax_cents : existing.tax_cents,
        discount_cents: data.discount_cents != null ? data.discount_cents : existing.discount_cents,
        tip_cents: data.tip_cents != null ? data.tip_cents : existing.tip_cents,
        surcharge_cents: data.surcharge_cents != null ? data.surcharge_cents : existing.surcharge_cents,
        deposit_cents: data.deposit_cents != null ? data.deposit_cents : existing.deposit_cents,
        total_cents: data.total_cents != null ? data.total_cents : existing.total_cents,
        payment_method: data.payment_method || null,
        cashier_id: data.cashier_id || existing.cashier_id,
        cashier_name: data.cashier_name || existing.cashier_name,
        tip_distributions: toDb(data.tip_distributions || data.tipDistributions || null),
        version: { increment: 1 },
      },
      include: { items: true, payments: true },
    });

    emit(req, 'ticket:closed');
    res.json({ ticket: formatTicket(ticket) });
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

    // Same-day check: ticket must have been created today
    var today = new Date();
    var ticketDate = new Date(existing.created_at);
    if (ticketDate.getFullYear() !== today.getFullYear() ||
        ticketDate.getMonth() !== today.getMonth() ||
        ticketDate.getDate() !== today.getDate()) {
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
// Business rule: refund has no time limit; once refund exists, void is disabled.
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

    var ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        status: newStatus,
        refund_cents: totalRefunded,
        refund_reason: data.refund_reason || data.reason || existing.refund_reason || null,
        refund_by: data.refund_by || data.staff_id || null,
        refund_at: new Date(),
        version: { increment: 1 },
      },
      include: { items: true, payments: true },
    });

    emit(req, 'ticket:refunded');
    res.json({
      ticket: formatTicket(ticket),
      refund: {
        id: 'refund-' + Date.now(),
        ticket_id: ticket.id,
        amount_cents: refundAmount,
        total_refunded_cents: totalRefunded,
        refunded_at: ticket.refund_at,
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

export default router;
