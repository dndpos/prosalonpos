/**
 * ProSalonPOS — Messaging Routes
 * Message templates, send individual/blast, message log.
 * All endpoints require JWT authentication.
 *
 * Store expects:
 *   GET  /templates          → { templates: [...] }
 *   POST /templates          → { template: {...} }
 *   PUT  /templates/:id      → { template: {...} }
 *   DELETE /templates/:id    → { template: {...} }
 *   POST /send               → { message: {...} }
 *   POST /blast              → { sent: N, skipped: N }
 *   GET  /log                → { messages: [...] }
 *
 * Note: Actual SMS/email delivery is Phase 2+ (Twilio/SendGrid).
 * These routes create the database records. The delivery layer
 * will be wired in when the messaging service provider is configured.
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════

// ── GET /templates — List all message templates ──
router.get('/templates', async function(req, res, next) {
  try {
    var templates = await prisma.messageTemplate.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { type: 'asc' }
    });
    res.json({ templates: templates });
  } catch (err) { next(err); }
});

// ── POST /templates — Create a template ──
router.post('/templates', async function(req, res, next) {
  try {
    var d = req.body;
    var template = await prisma.messageTemplate.create({
      data: {
        salon_id: req.salon_id,
        type: d.type,
        channel: d.channel || 'sms',
        subject: d.subject || null,
        body: d.body,
        active: d.active !== false,
      }
    });
    emit(req, 'messaging:template-updated');
    res.status(201).json({ template: template });
  } catch (err) { next(err); }
});

// ── PUT /templates/:id — Update a template ──
router.put('/templates/:id', async function(req, res, next) {
  try {
    var existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['type', 'channel', 'subject', 'body', 'active'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });

    var template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'messaging:template-updated');
    res.json({ template: template });
  } catch (err) { next(err); }
});

// ── DELETE /templates/:id — Delete a template ──
router.delete('/templates/:id', async function(req, res, next) {
  try {
    var existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.messageTemplate.delete({ where: { id: req.params.id } });
    emit(req, 'messaging:template-deleted');
    res.json({ template: existing });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SEND / BLAST
// ════════════════════════════════════════════

// ── POST /send — Send a single message ──
// Body: { client_id, type, channel, to, body, subject? }
router.post('/send', async function(req, res, next) {
  try {
    var d = req.body;

    // Log the message (delivery happens via external service later)
    var entry = await prisma.messageLogEntry.create({
      data: {
        salon_id: req.salon_id,
        client_id: d.client_id || null,
        type: d.type || 'manual',
        channel: d.channel || 'sms',
        to: d.to,
        body: d.body,
        status: 'sent', // Will be updated by delivery webhook later
      }
    });

    emit(req, 'messaging:sent');
    res.status(201).json({ message: entry });
  } catch (err) { next(err); }
});

// ── POST /blast — Send a blast message to multiple clients ──
// Body: { client_ids: [...], type, channel, body, subject? }
router.post('/blast', async function(req, res, next) {
  try {
    var d = req.body;
    var clientIds = d.client_ids || [];

    if (clientIds.length === 0) {
      return res.status(400).json({ error: 'No clients specified' });
    }

    // Look up clients to get their contact info
    var clients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
        salon_id: req.salon_id,
        active: true,
      }
    });

    var sent = 0;
    var skipped = 0;

    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      var channel = d.channel || 'sms';
      var to = channel === 'email' ? client.email : client.phone;

      // Skip clients without the required contact method
      if (!to) {
        skipped++;
        continue;
      }

      // Skip clients who opted out of promos (if this is a promo blast)
      if (d.type === 'promo' && client.promo_opt_out) {
        skipped++;
        continue;
      }

      await prisma.messageLogEntry.create({
        data: {
          salon_id: req.salon_id,
          client_id: client.id,
          type: d.type || 'promo',
          channel: channel,
          to: to,
          body: d.body,
          status: 'sent',
        }
      });
      sent++;
    }

    emit(req, 'messaging:blast-sent');
    res.json({ sent: sent, skipped: skipped, total: clientIds.length });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// MESSAGE LOG
// ════════════════════════════════════════════

// ── GET /log — View message history ──
// Query params: ?start=ISO&end=ISO (optional date range)
//               ?client_id=xxx (optional filter)
//               ?type=promo (optional filter)
router.get('/log', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id };

    if (req.query.start && req.query.end) {
      where.sent_at = {
        gte: new Date(req.query.start),
        lte: new Date(req.query.end),
      };
    }

    if (req.query.client_id) {
      where.client_id = req.query.client_id;
    }

    if (req.query.type) {
      where.type = req.query.type;
    }

    var messages = await prisma.messageLogEntry.findMany({
      where: where,
      orderBy: { sent_at: 'desc' },
      take: 500, // Limit to prevent huge responses
    });

    res.json({ messages: messages });
  } catch (err) { next(err); }
});

export default router;
