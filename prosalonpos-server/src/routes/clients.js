/**
 * ProSalonPOS — Client Routes
 * CRUD for client records. Phone dedup enforced on create.
 * Search by name or phone digits.
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── GET / — List all clients (with optional search) ──
router.get('/', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id, active: true };
    var q = req.query.q || req.query.search;

    if (q) {
      var digits = q.replace(/\D/g, '');
      where.OR = [
        { first_name: { contains: q, mode: 'insensitive' } },
        { last_name: { contains: q, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) {
        where.OR.push({ phone_digits: { contains: digits } });
      }
    }

    var clients = await prisma.client.findMany({
      where: where,
      orderBy: { last_name: 'asc' },
      take: 100
    });

    res.json({ clients: clients });
  } catch (err) { next(err); }
});

// ── GET /:id — Single client ──
router.get('/:id', async function(req, res, next) {
  try {
    var c = await prisma.client.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!c) return res.status(404).json({ error: 'Client not found' });
    res.json({ client: c });
  } catch (err) { next(err); }
});

// ── POST / — Create client ──
// v2.3.2 (Phase 3c): accepts an optional pre-supplied `id` so offline-queued
// creates replayed by main station carry the same UUID the local SQLite
// mirror already wrote. Prisma's @default(uuid()) only fires when `id` is
// absent. Combined with the X-Client-Op-Id idempotency middleware, a replay
// of the same client_op_id returns the cached response instead of attempting
// a duplicate create. UUID4 shape is enforced server-side.
var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
router.post('/', async function(req, res, next) {
  try {
    var data = req.body;
    var phone_digits = data.phone ? data.phone.replace(/\D/g, '') : null;

    // Phone dedup check
    if (phone_digits && phone_digits.length >= 10) {
      var existing = await prisma.client.findFirst({
        where: { salon_id: req.salon_id, phone_digits: phone_digits, active: true }
      });
      if (existing) {
        return res.status(409).json({
          error: 'A client with this phone number already exists',
          existing_client: { id: existing.id, first_name: existing.first_name, last_name: existing.last_name }
        });
      }
    }

    // v2.3.2: optional pre-supplied id. Validate shape; ignore silently if
    // malformed (legacy clients omit the field entirely, which is fine).
    var createData = {
      salon_id: req.salon_id,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      phone_digits: phone_digits,
      email: data.email || null,
      outstanding_balance_cents: data.outstanding_balance_cents || 0,
      promo_opt_out: data.promo_opt_out || false,
      notes: data.notes || null,
    };
    if (data.id && typeof data.id === 'string' && UUID_V4_RE.test(data.id)) {
      createData.id = data.id;
    }

    var c = await prisma.client.create({ data: createData });

    emit(req, 'client:created');
    res.status(201).json({ client: c });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update client ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.client.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    var data = req.body;
    var updateData = {};
    var fields = ['first_name', 'last_name', 'phone', 'email',
      'outstanding_balance_cents', 'promo_opt_out', 'notes',
      'is_vip', 'vip_manual_override'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });

    // Keep phone_digits in sync
    if (data.phone !== undefined) {
      updateData.phone_digits = data.phone ? data.phone.replace(/\D/g, '') : null;
    }

    updateData.version = { increment: 1 };

    var c = await prisma.client.update({
      where: { id: req.params.id },
      data: updateData
    });

    emit(req, 'client:updated');
    res.json({ client: c });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Soft delete ──
router.delete('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.client.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    var c = await prisma.client.update({
      where: { id: req.params.id },
      data: { active: false, version: { increment: 1 } }
    });
    emit(req, 'client:updated');
    res.json({ client: c });
  } catch (err) { next(err); }
});

export default router;
