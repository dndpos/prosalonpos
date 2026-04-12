/**
 * ProSalonPOS — Commission Routes
 * Commission rules and revenue tiers.
 * All endpoints require JWT authentication.
 *
 * Store expects:
 *   GET  /                → { rules: [...], tiers: [...] }
 *   POST /rules           → { rule: {...} }
 *   PUT  /rules/:id       → { rule: {...} }
 *   DELETE /rules/:id     → 200
 *   POST /tiers           → { tier: {...} }
 *   PUT  /tiers/:id       → { tier: {...} }
 *   DELETE /tiers/:id     → 200
 *
 * Commission resolution priority:
 *   per-tech per-item > per-tech per-category > per-tech flat >
 *   location per-item > location per-category > location flat
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── GET / — Fetch all rules and tiers for this salon ──
router.get('/', async function(req, res, next) {
  try {
    var rules = await prisma.commissionRule.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { created_at: 'asc' }
    });
    var tiers = await prisma.commissionTier.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { position: 'asc' }
    });
    res.json({ rules: rules, tiers: tiers });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// RULES
// ════════════════════════════════════════════

// ── POST /rules — Create a commission rule ──
router.post('/rules', async function(req, res, next) {
  try {
    var d = req.body;
    var rule = await prisma.commissionRule.create({
      data: {
        salon_id: req.salon_id,
        staff_id: d.staff_id || null,
        applies_to: d.applies_to || 'service',
        scope: d.scope || 'flat',
        category_id: d.category_id || null,
        service_catalog_id: d.service_catalog_id || null,
        product_id: d.product_id || null,
        percentage: d.percentage || 0,
      }
    });
    emit(req, 'commission:updated');
    res.status(201).json({ rule: rule });
  } catch (err) { next(err); }
});

// ── PUT /rules/:id — Update a commission rule ──
router.put('/rules/:id', async function(req, res, next) {
  try {
    var existing = await prisma.commissionRule.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['staff_id', 'applies_to', 'scope', 'category_id',
      'service_catalog_id', 'product_id', 'percentage'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    var rule = await prisma.commissionRule.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'commission:updated');
    res.json({ rule: rule });
  } catch (err) { next(err); }
});

// ── DELETE /rules/:id — Delete a commission rule ──
router.delete('/rules/:id', async function(req, res, next) {
  try {
    var existing = await prisma.commissionRule.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    await prisma.commissionRule.delete({ where: { id: req.params.id } });
    emit(req, 'commission:updated');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// TIERS
// ════════════════════════════════════════════

// ── POST /tiers — Create a commission tier ──
router.post('/tiers', async function(req, res, next) {
  try {
    var d = req.body;
    var tier = await prisma.commissionTier.create({
      data: {
        salon_id: req.salon_id,
        staff_id: d.staff_id || null,
        min_revenue_cents: d.min_revenue_cents || 0,
        percentage: d.percentage || 0,
        position: d.position || 0,
      }
    });
    emit(req, 'commission:updated');
    res.status(201).json({ tier: tier });
  } catch (err) { next(err); }
});

// ── PUT /tiers/:id — Update a commission tier ──
router.put('/tiers/:id', async function(req, res, next) {
  try {
    var existing = await prisma.commissionTier.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Tier not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['staff_id', 'min_revenue_cents', 'percentage', 'position'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    var tier = await prisma.commissionTier.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'commission:updated');
    res.json({ tier: tier });
  } catch (err) { next(err); }
});

// ── DELETE /tiers/:id — Delete a commission tier ──
router.delete('/tiers/:id', async function(req, res, next) {
  try {
    var existing = await prisma.commissionTier.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Tier not found' });

    await prisma.commissionTier.delete({ where: { id: req.params.id } });
    emit(req, 'commission:updated');
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
