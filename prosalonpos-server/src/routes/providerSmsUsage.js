/**
 * ProSalonPOS — Provider SMS Usage Routes (v2.1.5, segment-aware in v2.1.7)
 *
 * Aggregates MessageLogEntry rows per salon for billing visibility.
 * Mounted under /api/v1/provider — requires providerAuth middleware.
 *
 * v2.1.7: Twilio bills per 160-char SEGMENT, not per message. A 161-char text
 * = 2 segments. Unicode (emoji) drops the limit to 70 chars per segment. We
 * compute segments here so the cost matches what Twilio actually charges.
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

// ── Twilio SMS segment math ──
// GSM-7 basic chars: 160 per segment standalone, 153 per segment when concatenated.
// Anything outside GSM-7 (most emojis, many accented chars) → UCS-2 Unicode:
// 70 per segment standalone, 67 per segment when concatenated.
var GSM7_RE = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[~\]|€]*$/;

function smsSegments(body) {
  if (!body) return 1;
  var len = body.length;
  var gsm7 = GSM7_RE.test(body);
  if (gsm7) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

// ── GET /sms-usage?from=YYYY-MM-DD&to=YYYY-MM-DD ──
// Returns per-salon counts of messages sent (sms + email separately) within the
// inclusive UTC date range, multiplied by each salon's sms_rate_cents to give
// the billable amount. Email is shown for visibility but is not billed.
//
// Defaults: current calendar month (server UTC) if from/to omitted.
router.get('/sms-usage', async function(req, res, next) {
  try {
    var now = new Date();
    var from = req.query.from ? new Date(req.query.from + 'T00:00:00.000Z') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    var to   = req.query.to   ? new Date(req.query.to   + 'T23:59:59.999Z') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Invalid from/to date (use YYYY-MM-DD)' });
    }

    // Pull all salons up front so we can show every salon (even ones with 0 messages)
    var salons = await prisma.salon.findMany({
      select: { id: true, name: true, sms_rate_cents: true, status: true, plan_tier: true },
      orderBy: { name: 'asc' },
    });

    // v2.1.7: Need per-row body to compute Twilio segments. Pull all non-failed
    // rows in range. Volume is small enough (per-salon thousands/month at most)
    // that JS-side aggregation is fine. If this ever gets slow, switch to a raw
    // SQL aggregate that counts CEIL(LENGTH(body)/153).
    var rowsRaw = await prisma.messageLogEntry.findMany({
      where: {
        sent_at: { gte: from, lte: to },
        status: { not: 'failed' },
      },
      select: { salon_id: true, channel: true, body: true },
    });

    // Build a map: salon_id -> { sms_messages, sms_segments, email, other }
    var bySalon = {};
    rowsRaw.forEach(function(r) {
      if (!bySalon[r.salon_id]) bySalon[r.salon_id] = { sms_messages: 0, sms_segments: 0, email: 0, other: 0 };
      var ch = (r.channel || '').toLowerCase();
      if (ch === 'sms') {
        bySalon[r.salon_id].sms_messages += 1;
        bySalon[r.salon_id].sms_segments += smsSegments(r.body || '');
      } else if (ch === 'email') {
        bySalon[r.salon_id].email += 1;
      } else {
        bySalon[r.salon_id].other += 1;
      }
    });

    // Stitch results — billing based on SEGMENTS, not message count.
    var rows = salons.map(function(s) {
      var c = bySalon[s.id] || { sms_messages: 0, sms_segments: 0, email: 0, other: 0 };
      var rate = s.sms_rate_cents != null ? s.sms_rate_cents : 2;
      return {
        salon_id: s.id,
        salon_name: s.name,
        status: s.status,
        plan_tier: s.plan_tier,
        sms_rate_cents: rate,
        sms_messages: c.sms_messages,        // count of SMS rows
        sms_segments: c.sms_segments,        // billable units (Twilio)
        email_count: c.email,
        other_count: c.other,
        sms_cost_cents: c.sms_segments * rate,
      };
    });

    var totals = rows.reduce(function(acc, r) {
      acc.sms_messages += r.sms_messages;
      acc.sms_segments += r.sms_segments;
      acc.email_count += r.email_count;
      acc.sms_cost_cents += r.sms_cost_cents;
      return acc;
    }, { sms_messages: 0, sms_segments: 0, email_count: 0, sms_cost_cents: 0 });

    res.json({
      from: from.toISOString().slice(0, 10),
      to:   to.toISOString().slice(0, 10),
      rows: rows,
      totals: totals,
    });
  } catch (err) { next(err); }
});

export default router;
