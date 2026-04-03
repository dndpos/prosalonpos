/**
 * ProSalonPOS — Gift Card Routes
 * Session 57 | Phase 2
 *
 * Business rules:
 *   - Gift cards never expire
 *   - Partial redemption always allowed
 *   - Code is case-insensitive for lookup
 *   - Digital cards get auto-generated codes
 *   - Balance depleted → status = 'depleted'
 *   - All transactions logged (purchase, reload, redemption)
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── Helper: generate a gift card code ──
function generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
  var parts = [];
  for (var p = 0; p < 2; p++) {
    var seg = '';
    for (var i = 0; i < 4; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(seg);
  }
  return 'GC-' + parts.join('-');
}

// ── GET / — List all gift cards with transactions ──
router.get('/', async function(req, res, next) {
  try {
    var cards = await prisma.giftCard.findMany({
      where: { salon_id: req.salon_id },
      include: { transactions: { orderBy: { created_at: 'desc' } } },
      orderBy: { created_at: 'desc' },
    });
    res.json({ giftCards: cards });
  } catch (err) { next(err); }
});

// ── GET /lookup/:code — Lookup by code (for checkout payment) ──
router.get('/lookup/:code', async function(req, res, next) {
  try {
    var code = req.params.code.toUpperCase();
    var card = await prisma.giftCard.findFirst({
      where: { salon_id: req.salon_id, code: { equals: code, mode: 'insensitive' } },
      include: { transactions: { orderBy: { created_at: 'desc' } } },
    });
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    res.json({ giftCard: card });
  } catch (err) { next(err); }
});

// ── POST / — Create (sell) a new gift card ──
router.post('/', async function(req, res, next) {
  try {
    var data = req.body;
    var code = data.code;

    // Auto-generate code for digital cards if not provided
    if (!code || data.type === 'digital') {
      // Keep generating until unique
      for (var attempts = 0; attempts < 10; attempts++) {
        code = generateCode();
        var exists = await prisma.giftCard.findFirst({
          where: { salon_id: req.salon_id, code: code },
        });
        if (!exists) break;
      }
    }

    var amountCents = data.amount_cents || data.initial_amount_cents || 0;

    var card = await prisma.giftCard.create({
      data: {
        salon_id: req.salon_id,
        code: code,
        type: data.type || 'digital',
        initial_amount_cents: amountCents,
        balance_cents: amountCents,
        status: 'active',
        client_id: data.client_id || null,
        client_name: data.client_name || null,
        purchased_by_client_id: data.purchased_by_client_id || null,
        purchased_by_name: data.purchased_by_name || null,
        transactions: {
          create: {
            type: 'purchase',
            amount_cents: amountCents,
            balance_after_cents: amountCents,
            staff_id: data.staff_id || null,
            staff_name: data.staff_name || null,
          },
        },
      },
      include: { transactions: true },
    });

    emit(req, 'giftcard:created');
    res.status(201).json({ giftCard: card });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update card (assign client, deactivate) ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.giftCard.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Gift card not found' });

    var data = req.body;
    var updateData = {};
    var fields = ['client_id', 'client_name', 'status'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });
    updateData.version = { increment: 1 };

    var card = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: updateData,
      include: { transactions: { orderBy: { created_at: 'desc' } } },
    });

    emit(req, 'giftcard:updated');
    res.json({ giftCard: card });
  } catch (err) { next(err); }
});

// ── POST /:id/redeem — Redeem at checkout ──
router.post('/:id/redeem', async function(req, res, next) {
  try {
    var card = await prisma.giftCard.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    if (card.status !== 'active') {
      return res.status(400).json({ error: 'Gift card is ' + card.status });
    }

    var amount = req.body.amount_cents || 0;
    if (amount > card.balance_cents) {
      amount = card.balance_cents; // partial — use what's available
    }

    var newBalance = card.balance_cents - amount;
    var newStatus = newBalance <= 0 ? 'depleted' : 'active';

    var updated = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: {
        balance_cents: newBalance,
        status: newStatus,
        version: { increment: 1 },
        transactions: {
          create: {
            type: 'redemption',
            amount_cents: -amount,
            balance_after_cents: newBalance,
            staff_id: req.body.staff_id || null,
            staff_name: req.body.staff_name || null,
            ticket_id: req.body.ticket_id || null,
          },
        },
      },
      include: { transactions: { orderBy: { created_at: 'desc' } } },
    });

    emit(req, 'giftcard:redeemed');
    res.json({ giftCard: updated });
  } catch (err) { next(err); }
});

// ── POST /:id/reload — Add money to existing card ──
router.post('/:id/reload', async function(req, res, next) {
  try {
    var card = await prisma.giftCard.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!card) return res.status(404).json({ error: 'Gift card not found' });

    var amount = req.body.amount_cents || 0;
    var newBalance = card.balance_cents + amount;

    var updated = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: {
        balance_cents: newBalance,
        status: 'active', // reactivate if depleted
        version: { increment: 1 },
        transactions: {
          create: {
            type: 'reload',
            amount_cents: amount,
            balance_after_cents: newBalance,
            staff_id: req.body.staff_id || null,
            staff_name: req.body.staff_name || null,
          },
        },
      },
      include: { transactions: { orderBy: { created_at: 'desc' } } },
    });

    emit(req, 'giftcard:reloaded');
    res.json({ giftCard: updated });
  } catch (err) { next(err); }
});

export default router;
