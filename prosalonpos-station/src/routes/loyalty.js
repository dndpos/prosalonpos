/**
 * ProSalonPOS — Loyalty Routes
 * Session 57 | Phase 2
 *
 * Manages loyalty program settings, tiers, rewards, and point transactions.
 * Points are earned at checkout and redeemed for rewards.
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── GET /program — Get loyalty program with tiers and rewards ──
router.get('/program', async function(req, res, next) {
  try {
    var program = await prisma.loyaltyProgram.findUnique({
      where: { salon_id: req.salon_id },
      include: {
        tiers: { orderBy: { position: 'asc' } },
        rewards: { orderBy: { position: 'asc' } },
      },
    });

    if (!program) {
      // Return null — frontend handles "no program configured" state
      return res.json({ program: null });
    }

    res.json({ program: program });
  } catch (err) { next(err); }
});

// ── PUT /program — Update program settings (or create if missing) ──
router.put('/program', async function(req, res, next) {
  try {
    var data = req.body;

    var program = await prisma.loyaltyProgram.upsert({
      where: { salon_id: req.salon_id },
      create: {
        salon_id: req.salon_id,
        enabled: data.enabled !== false,
        points_per_dollar: data.points_per_dollar || 1,
        points_name: data.points_name || 'points',
      },
      update: {
        enabled: data.enabled !== undefined ? data.enabled : undefined,
        points_per_dollar: data.points_per_dollar !== undefined ? data.points_per_dollar : undefined,
        points_name: data.points_name !== undefined ? data.points_name : undefined,
        version: { increment: 1 },
      },
      include: {
        tiers: { orderBy: { position: 'asc' } },
        rewards: { orderBy: { position: 'asc' } },
      },
    });

    emit(req, 'loyalty:updated');
    res.json({ program: program });
  } catch (err) { next(err); }
});

// ── GET /members — List loyalty accounts (members with points) ──
router.get('/members', async function(req, res, next) {
  try {
    var members = await prisma.loyaltyAccount.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { lifetime_points: 'desc' },
      take: 200,
    });
    res.json({ members: members });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// TIERS
// ════════════════════════════════════════════

// ── POST /tiers — Create a tier ──
router.post('/tiers', async function(req, res, next) {
  try {
    var program = await prisma.loyaltyProgram.findUnique({
      where: { salon_id: req.salon_id },
    });
    if (!program) return res.status(400).json({ error: 'Create a loyalty program first' });

    var data = req.body;
    var tier = await prisma.loyaltyTier.create({
      data: {
        program_id: program.id,
        name: data.name,
        min_points: data.min_points || 0,
        multiplier: data.multiplier || 1.0,
        position: data.position || 0,
      },
    });

    emit(req, 'loyalty:updated');
    res.status(201).json({ tier: tier });
  } catch (err) { next(err); }
});

// ── PUT /tiers/:id — Update a tier ──
router.put('/tiers/:id', async function(req, res, next) {
  try {
    var data = req.body;
    var updateData = {};
    var fields = ['name', 'min_points', 'multiplier', 'position'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });

    var tier = await prisma.loyaltyTier.update({
      where: { id: req.params.id },
      data: updateData,
    });

    emit(req, 'loyalty:updated');
    res.json({ tier: tier });
  } catch (err) { next(err); }
});

// ── DELETE /tiers/:id — Delete a tier ──
router.delete('/tiers/:id', async function(req, res, next) {
  try {
    // Verify tier belongs to this salon's loyalty program
    var tier = await prisma.loyaltyTier.findFirst({
      where: { id: req.params.id },
      include: { program: { select: { salon_id: true } } }
    });
    if (!tier || tier.program.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    await prisma.loyaltyTier.delete({ where: { id: req.params.id } });
    emit(req, 'loyalty:updated');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// REWARDS
// ════════════════════════════════════════════

// ── POST /rewards — Create a reward ──
router.post('/rewards', async function(req, res, next) {
  try {
    var program = await prisma.loyaltyProgram.findUnique({
      where: { salon_id: req.salon_id },
    });
    if (!program) return res.status(400).json({ error: 'Create a loyalty program first' });

    var data = req.body;
    var reward = await prisma.loyaltyReward.create({
      data: {
        program_id: program.id,
        name: data.name,
        points_required: data.points_required || 0,
        type: data.type || 'discount',
        value_cents: data.value_cents || 0,
        active: data.active !== false,
        position: data.position || 0,
      },
    });

    emit(req, 'loyalty:updated');
    res.status(201).json({ reward: reward });
  } catch (err) { next(err); }
});

// ── PUT /rewards/:id — Update a reward ──
router.put('/rewards/:id', async function(req, res, next) {
  try {
    var data = req.body;
    var updateData = {};
    var fields = ['name', 'points_required', 'type', 'value_cents', 'active', 'position'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });

    var reward = await prisma.loyaltyReward.update({
      where: { id: req.params.id },
      data: updateData,
    });

    emit(req, 'loyalty:updated');
    res.json({ reward: reward });
  } catch (err) { next(err); }
});

// ── DELETE /rewards/:id — Delete a reward ──
router.delete('/rewards/:id', async function(req, res, next) {
  try {
    // Verify reward belongs to this salon's loyalty program
    var reward = await prisma.loyaltyReward.findFirst({
      where: { id: req.params.id },
      include: { program: { select: { salon_id: true } } }
    });
    if (!reward || reward.program.salon_id !== req.salon_id) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    await prisma.loyaltyReward.delete({ where: { id: req.params.id } });
    emit(req, 'loyalty:updated');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// POINT TRANSACTIONS
// ════════════════════════════════════════════

// ── POST /earn — Award points to a client ──
router.post('/earn', async function(req, res, next) {
  try {
    var data = req.body;
    var points = data.points || 0;
    if (points <= 0) return res.status(400).json({ error: 'Points must be positive' });

    // Upsert loyalty account
    var account = await prisma.loyaltyAccount.upsert({
      where: { client_id: data.client_id },
      create: {
        salon_id: req.salon_id,
        client_id: data.client_id,
        points_balance: points,
        lifetime_points: points,
      },
      update: {
        points_balance: { increment: points },
        lifetime_points: { increment: points },
        version: { increment: 1 },
      },
    });

    // Log the transaction
    await prisma.loyaltyTransaction.create({
      data: {
        salon_id: req.salon_id,
        client_id: data.client_id,
        type: 'earn',
        points: points,
        description: data.description || null,
        ticket_id: data.ticket_id || null,
      },
    });

    emit(req, 'loyalty:updated');
    res.json({ account: account });
  } catch (err) { next(err); }
});

// ── POST /redeem — Redeem points for a reward ──
router.post('/redeem', async function(req, res, next) {
  try {
    var data = req.body;
    var points = data.points || 0;

    var account = await prisma.loyaltyAccount.findUnique({
      where: { client_id: data.client_id },
    });
    if (!account) return res.status(404).json({ error: 'No loyalty account found' });
    if (account.points_balance < points) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    var updated = await prisma.loyaltyAccount.update({
      where: { client_id: data.client_id },
      data: {
        points_balance: { decrement: points },
        version: { increment: 1 },
      },
    });

    await prisma.loyaltyTransaction.create({
      data: {
        salon_id: req.salon_id,
        client_id: data.client_id,
        type: 'redeem',
        points: -points,
        reward_id: data.reward_id || null,
        description: data.description || null,
      },
    });

    emit(req, 'loyalty:updated');
    res.json({ account: updated });
  } catch (err) { next(err); }
});

export default router;
