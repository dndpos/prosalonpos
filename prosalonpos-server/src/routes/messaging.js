/**
 * ProSalonPOS — Messaging Routes
 * Message templates, send individual/blast, message log.
 * All endpoints require JWT authentication.
 *
 * SMS delivery via smsService.js (Twilio). If Twilio env vars
 * are not set, messages are logged with status 'logged' (dev mode).
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';
import { sendSms } from '../utils/smsService.js';

var router = Router();

// ════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════

router.get('/templates', async function(req, res, next) {
  try {
    var templates = await prisma.messageTemplate.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { type: 'asc' }
    });
    var mapped = templates.map(function(t) {
      return {
        id: t.id, name: t.name, type: t.type, channel: t.channel,
        subject: t.subject, content: t.body, active: t.active,
        created_at: t.created_at, updated_at: t.updated_at,
      };
    });
    res.json({ templates: mapped });
  } catch (err) { next(err); }
});

router.post('/templates', async function(req, res, next) {
  try {
    var d = req.body;
    var template = await prisma.messageTemplate.create({
      data: {
        salon_id: req.salon_id,
        name: d.name || '',
        type: d.type,
        channel: d.channel || 'sms',
        subject: d.subject || null,
        body: d.content || d.body || '',
        active: d.active !== false,
      }
    });
    emit(req, 'messaging:template-updated');
    res.status(201).json({ template: {
      id: template.id, name: template.name, type: template.type,
      channel: template.channel, subject: template.subject,
      content: template.body, active: template.active,
    }});
  } catch (err) { next(err); }
});

router.put('/templates/:id', async function(req, res, next) {
  try {
    var existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    var d = req.body;
    var updateData = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.type !== undefined) updateData.type = d.type;
    if (d.channel !== undefined) updateData.channel = d.channel;
    if (d.subject !== undefined) updateData.subject = d.subject;
    if (d.content !== undefined) updateData.body = d.content;
    if (d.body !== undefined) updateData.body = d.body;
    if (d.active !== undefined) updateData.active = d.active;

    var template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'messaging:template-updated');
    res.json({ template: {
      id: template.id, name: template.name, type: template.type,
      channel: template.channel, subject: template.subject,
      content: template.body, active: template.active,
    }});
  } catch (err) { next(err); }
});

router.delete('/templates/:id', async function(req, res, next) {
  try {
    var existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.messageTemplate.delete({ where: { id: req.params.id } });
    emit(req, 'messaging:template-deleted');
    res.json({ template: { id: existing.id } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SEND (single message)
// ════════════════════════════════════════════

router.post('/send', async function(req, res, next) {
  try {
    var d = req.body;
    var channel = d.channel || 'sms';
    var to = d.to || '';
    var body = d.body || '';
    var status = 'logged';

    if (channel === 'sms' && to) {
      var result = await sendSms(to, body);
      status = result.success ? (result.dev ? 'logged' : 'sent') : 'failed';
    }

    var entry = await prisma.messageLogEntry.create({
      data: {
        salon_id: req.salon_id,
        client_id: d.client_id || null,
        type: d.type || 'manual',
        channel: channel,
        to: to,
        body: body,
        status: status,
      }
    });

    emit(req, 'messaging:sent');
    res.status(201).json({ message: entry });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// BLAST (bulk promotional)
// ════════════════════════════════════════════

router.post('/blast', async function(req, res, next) {
  try {
    var d = req.body;
    var clientIds = d.client_ids || [];

    if (clientIds.length === 0) {
      return res.status(400).json({ error: 'No clients specified' });
    }

    var clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, salon_id: req.salon_id, active: true }
    });

    var sent = 0;
    var skipped = 0;
    var failed = 0;

    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      var channel = d.channel || 'sms';
      var to = channel === 'email' ? client.email : client.phone;

      if (!to) { skipped++; continue; }
      if (d.type === 'promotional' && client.promo_opt_out) { skipped++; continue; }

      var resolvedBody = (d.body || '')
        .replace(/\{client_name\}/g, ((client.first_name || '') + ' ' + (client.last_name || '')).trim())
        .replace(/\{salon_name\}/g, d.salon_name || '');

      var status = 'logged';
      if (channel === 'sms' && to) {
        var result = await sendSms(to, resolvedBody);
        status = result.success ? (result.dev ? 'logged' : 'sent') : 'failed';
      }

      if (status === 'failed') { failed++; } else { sent++; }

      await prisma.messageLogEntry.create({
        data: {
          salon_id: req.salon_id, client_id: client.id,
          type: d.type || 'promotional', channel: channel,
          to: to, body: resolvedBody, status: status,
        }
      });
    }

    emit(req, 'messaging:blast-sent');
    res.json({ sent: sent, skipped: skipped, failed: failed, total: clientIds.length });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// MESSAGE LOG
// ════════════════════════════════════════════

router.get('/log', async function(req, res, next) {
  try {
    var where = { salon_id: req.salon_id };

    if (req.query.start && req.query.end) {
      where.sent_at = { gte: new Date(req.query.start), lte: new Date(req.query.end) };
    }
    if (req.query.client_id) where.client_id = req.query.client_id;
    if (req.query.type) where.type = req.query.type;

    var messages = await prisma.messageLogEntry.findMany({
      where: where,
      orderBy: { sent_at: 'desc' },
      take: 500,
    });

    var mapped = messages.map(function(m) {
      return {
        id: m.id, type: m.type, channel: m.channel,
        recipient: m.to, recipientContact: m.to,
        content: m.body, status: m.status,
        sent_at: m.sent_at, client_id: m.client_id,
      };
    });

    res.json({ messages: mapped });
  } catch (err) { next(err); }
});

// ── GET /status — Check if SMS provider is configured ──
router.get('/status', async function(req, res) {
  var hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  res.json({ configured: hasTwilio, provider: hasTwilio ? 'twilio' : 'none' });
});

export default router;
