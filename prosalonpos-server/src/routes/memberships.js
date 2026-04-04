/**
 * ProSalonPOS — Membership Routes
 * Session 96 | Full rewrite — schema expanded to match frontend fields
 *
 * Plans define membership options with rich billing/perk/cancellation config.
 * Perks are typed (percentage_discount, free_service, service_credit).
 * Members are clients enrolled in a plan.
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ════════════════════════════════════════════
// PLANS
// ════════════════════════════════════════════

// ── GET /plans — List all plans with perks ──
router.get('/plans', async function(req, res, next) {
  try {
    var plans = await prisma.membershipPlan.findMany({
      where: { salon_id: req.salon_id },
      include: { perks: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
    res.json({ plans: plans });
  } catch (err) { next(err); }
});

// ── POST /plans — Create a plan with perks ──
router.post('/plans', async function(req, res, next) {
  try {
    var d = req.body;
    var plan = await prisma.membershipPlan.create({
      data: {
        salon_id: req.salon_id,
        name: d.name,
        description: d.description || null,
        price_cents: d.price_cents || 0,
        billing_cycle_days: d.billing_cycle_days || 30,
        payment_method: d.payment_method || 'in_person',
        min_commitment_cycles: d.min_commitment_cycles || null,
        notice_period_days: d.notice_period_days || null,
        missed_payment_action: d.missed_payment_action || 'pause',
        missed_payment_threshold: d.missed_payment_threshold || null,
        credit_rollover: d.credit_rollover === true,
        perk_apply_mode: d.perk_apply_mode || 'auto',
        freeze_allowed: d.freeze_allowed !== false,
        active: d.active !== false,
        position: d.position || 0,
        perks: d.perks && d.perks.length > 0 ? {
          create: d.perks.map(function(pk, idx) {
            return {
              type: pk.type || 'percentage_discount',
              discount_percentage: pk.discount_percentage || null,
              service_catalog_id: pk.service_catalog_id || null,
              category_id: pk.category_id || null,
              credit_amount_cents: pk.credit_amount_cents || null,
              quantity_per_cycle: pk.quantity_per_cycle || null,
              position: idx,
            };
          })
        } : undefined,
      },
      include: { perks: { orderBy: { position: 'asc' } } },
    });

    emit(req, 'membership:updated');
    res.status(201).json({ plan: plan });
  } catch (err) { next(err); }
});

// ── PUT /plans/:id — Update a plan + replace perks ──
router.put('/plans/:id', async function(req, res, next) {
  try {
    var existing = await prisma.membershipPlan.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'description', 'price_cents', 'billing_cycle_days',
      'payment_method', 'min_commitment_cycles', 'notice_period_days',
      'missed_payment_action', 'missed_payment_threshold',
      'credit_rollover', 'perk_apply_mode', 'freeze_allowed',
      'active', 'position'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    // If perks array is provided, delete all old perks and recreate
    if (Array.isArray(d.perks)) {
      await prisma.membershipPerk.deleteMany({ where: { plan_id: req.params.id } });
      if (d.perks.length > 0) {
        await prisma.membershipPerk.createMany({
          data: d.perks.map(function(pk, idx) {
            return {
              plan_id: req.params.id,
              type: pk.type || 'percentage_discount',
              discount_percentage: pk.discount_percentage || null,
              service_catalog_id: pk.service_catalog_id || null,
              category_id: pk.category_id || null,
              credit_amount_cents: pk.credit_amount_cents || null,
              quantity_per_cycle: pk.quantity_per_cycle || null,
              position: idx,
            };
          }),
        });
      }
    }

    var plan = await prisma.membershipPlan.update({
      where: { id: req.params.id },
      data: updateData,
      include: { perks: { orderBy: { position: 'asc' } } },
    });

    emit(req, 'membership:updated');
    res.json({ plan: plan });
  } catch (err) { next(err); }
});

// ── DELETE /plans/:id — Delete a plan and its perks ──
router.delete('/plans/:id', async function(req, res, next) {
  try {
    var existing = await prisma.membershipPlan.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    // Perks cascade-delete via schema
    await prisma.membershipPlan.delete({ where: { id: req.params.id } });

    emit(req, 'membership:updated');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════

// ── GET /members — List enrolled members ──
router.get('/members', async function(req, res, next) {
  try {
    var where = { plan: { salon_id: req.salon_id } };
    if (req.query.status) where.status = req.query.status;

    var members = await prisma.membershipAccount.findMany({
      where: where,
      include: { plan: true, client: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    res.json({ members: members });
  } catch (err) { next(err); }
});

// ── GET /members/client/:clientId — Get a client's active membership ──
router.get('/members/client/:clientId', async function(req, res, next) {
  try {
    var membership = await prisma.membershipAccount.findFirst({
      where: {
        client_id: req.params.clientId,
        plan: { salon_id: req.salon_id },
        status: { in: ['active', 'frozen'] },
      },
      include: { plan: { include: { perks: true } } },
    });
    res.json({ membership: membership || null });
  } catch (err) { next(err); }
});

// ── PUT /members/:id/renew — Advance next_billing by one cycle ──
router.put('/members/:id/renew', async function(req, res, next) {
  try {
    var existing = await prisma.membershipAccount.findFirst({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!existing) return res.status(404).json({ error: 'Membership not found' });

    var cycleDays = existing.plan.billing_cycle_days || 30;
    var now = new Date();
    var nextBilling = new Date(now);
    nextBilling.setDate(nextBilling.getDate() + cycleDays);

    // If they owed multiple cycles, advance from today (not from old next_billing)
    var membership = await prisma.membershipAccount.update({
      where: { id: req.params.id },
      data: { next_billing: nextBilling, status: 'active', frozen_at: null, version: { increment: 1 } },
      include: { plan: true, client: true },
    });

    emit(req, 'membership:updated');
    res.json({ member: membership });
  } catch (err) { next(err); }
});

// ── POST /members — Enroll a client in a plan ──
router.post('/members', async function(req, res, next) {
  try {
    var d = req.body;

    var plan = await prisma.membershipPlan.findFirst({
      where: { id: d.plan_id, salon_id: req.salon_id },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    var now = new Date();
    var nextBilling = new Date(now);
    if (plan.billing_cycle_days >= 365) {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    } else {
      nextBilling.setDate(nextBilling.getDate() + plan.billing_cycle_days);
    }

    var membership = await prisma.membershipAccount.create({
      data: {
        plan_id: d.plan_id,
        client_id: d.client_id,
        status: 'active',
        start_date: now,
        next_billing: nextBilling,
      },
      include: { plan: true, client: true },
    });

    emit(req, 'membership:updated');
    res.status(201).json({ member: membership });
  } catch (err) { next(err); }
});

// ── PUT /members/:id — Update membership (freeze, cancel, reactivate) ──
router.put('/members/:id', async function(req, res, next) {
  try {
    var d = req.body;
    var updateData = {};

    if (d.status !== undefined) {
      updateData.status = d.status;
      if (d.status === 'frozen') updateData.frozen_at = new Date();
      if (d.status === 'cancelled') updateData.cancelled_at = new Date();
      if (d.status === 'active') {
        updateData.frozen_at = null;
        updateData.cancelled_at = null;
      }
    }

    if (d.plan_id) updateData.plan_id = d.plan_id;
    if (d.next_billing) updateData.next_billing = new Date(d.next_billing);

    updateData.version = { increment: 1 };

    var membership = await prisma.membershipAccount.update({
      where: { id: req.params.id },
      data: updateData,
      include: { plan: true, client: true },
    });

    emit(req, 'membership:updated');
    res.json({ member: membership });
  } catch (err) { next(err); }
});

export default router;
