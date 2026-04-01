/**
 * ProSalonPOS — Membership Routes
 * Session 57 | Phase 2
 *
 * Plans define membership options (monthly/yearly billing, perks, discounts).
 * Members are clients enrolled in a plan.
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
// PLANS
// ════════════════════════════════════════════

// ── GET /plans — List all plans with perks ──
router.get('/plans', async function(req, res, next) {
  try {
    var plans = await prisma.membershipPlan.findMany({
      where: { salon_id: req.salon_id },
      include: { perks: { orderBy: { position: 'asc' } } },
      orderBy: { created_at: 'asc' },
    });
    var parsed = plans.map(function(p) {
      var copy = Object.assign({}, p);
      copy.included_services = fromDb(copy.included_services);
      return copy;
    });
    res.json({ plans: parsed });
  } catch (err) { next(err); }
});

// ── POST /plans — Create a plan ──
router.post('/plans', async function(req, res, next) {
  try {
    var data = req.body;
    var plan = await prisma.membershipPlan.create({
      data: {
        salon_id: req.salon_id,
        name: data.name,
        description: data.description || null,
        price_cents: data.price_cents || 0,
        billing_interval: data.billing_interval || 'monthly',
        included_services: toDb(data.included_services),
        discount_pct: data.discount_pct || 0,
        active: data.active !== false,
      },
      include: { perks: true },
    });

    emit(req, 'membership:updated');
    res.status(201).json({ plan: plan });
  } catch (err) { next(err); }
});

// ── PUT /plans/:id — Update a plan ──
router.put('/plans/:id', async function(req, res, next) {
  try {
    var existing = await prisma.membershipPlan.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    var data = req.body;
    var updateData = {};
    var fields = ['name', 'description', 'price_cents', 'billing_interval',
      'included_services', 'discount_pct', 'active'];
    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = (f === 'included_services') ? toDb(data[f]) : data[f];
    });
    updateData.version = { increment: 1 };

    var plan = await prisma.membershipPlan.update({
      where: { id: req.params.id },
      data: updateData,
      include: { perks: { orderBy: { position: 'asc' } } },
    });

    emit(req, 'membership:updated');
    res.json({ plan: plan });
  } catch (err) { next(err); }
});

// ── POST /plans/:id/perks — Add a perk to a plan ──
router.post('/plans/:id/perks', async function(req, res, next) {
  try {
    var existing = await prisma.membershipPlan.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    var data = req.body;
    var perk = await prisma.membershipPerk.create({
      data: {
        plan_id: req.params.id,
        name: data.name,
        type: data.type || 'discount',
        value: data.value || 0,
        position: data.position || 0,
      },
    });

    emit(req, 'membership:updated');
    res.status(201).json({ perk: perk });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════

// ── GET /members — List enrolled members ──
router.get('/members', async function(req, res, next) {
  try {
    var where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    // Filter by salon through plan relation
    var members = await prisma.membershipAccount.findMany({
      where: Object.assign({ plan: { salon_id: req.salon_id } }, where),
      include: { plan: true, client: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    res.json({ members: members });
  } catch (err) { next(err); }
});

// ── POST /members — Enroll a client in a plan ──
router.post('/members', async function(req, res, next) {
  try {
    var data = req.body;

    // Verify plan belongs to this salon
    var plan = await prisma.membershipPlan.findFirst({
      where: { id: data.plan_id, salon_id: req.salon_id },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    var now = new Date();
    var nextBilling = new Date(now);
    if (plan.billing_interval === 'yearly') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    } else {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    var membership = await prisma.membershipAccount.create({
      data: {
        plan_id: data.plan_id,
        client_id: data.client_id,
        status: 'active',
        start_date: now,
        next_billing: nextBilling,
      },
      include: { plan: true, client: true },
    });

    emit(req, 'membership:updated');
    res.status(201).json({ membership: membership });
  } catch (err) { next(err); }
});

// ── PUT /members/:id — Update membership (freeze, cancel, reactivate) ──
router.put('/members/:id', async function(req, res, next) {
  try {
    var data = req.body;
    var updateData = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'frozen') updateData.frozen_at = new Date();
      if (data.status === 'cancelled') updateData.cancelled_at = new Date();
      if (data.status === 'active') {
        updateData.frozen_at = null;
        updateData.cancelled_at = null;
      }
    }

    if (data.plan_id) updateData.plan_id = data.plan_id;
    if (data.next_billing) updateData.next_billing = new Date(data.next_billing);

    updateData.version = { increment: 1 };

    var membership = await prisma.membershipAccount.update({
      where: { id: req.params.id },
      data: updateData,
      include: { plan: true, client: true },
    });

    emit(req, 'membership:updated');
    res.json({ membership: membership });
  } catch (err) { next(err); }
});

export default router;
