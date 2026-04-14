/**
 * push.js — Push notification subscription routes
 *
 * POST   /subscribe   — Save a push subscription for the authenticated tech
 * DELETE /unsubscribe — Remove a push subscription by endpoint
 * GET    /vapid-key   — Return the public VAPID key (public, no auth needed)
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { getVapidPublicKey, isPushEnabled } from '../utils/pushService.js';
import authenticate from '../middleware/authenticate.js';

var router = Router();

// ── GET /vapid-key — Public endpoint, no auth ──
router.get('/vapid-key', function(req, res) {
  var key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
});

// ── POST /subscribe — Save push subscription (auth required) ──
router.post('/subscribe', authenticate, async function(req, res, next) {
  try {
    if (!isPushEnabled()) {
      return res.status(503).json({ error: 'Push notifications not configured on server' });
    }

    var { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid push subscription — missing endpoint or keys' });
    }

    // Upsert — same endpoint might re-subscribe (e.g. after browser update)
    var existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: endpoint }
    });

    if (existing) {
      // Update keys and staff ownership (in case tech switched phones)
      await prisma.pushSubscription.update({
        where: { endpoint: endpoint },
        data: {
          salon_id: req.salon_id,
          staff_id: req.staff_id,
          keys_p256dh: keys.p256dh,
          keys_auth: keys.auth,
        }
      });
    } else {
      await prisma.pushSubscription.create({
        data: {
          salon_id: req.salon_id,
          staff_id: req.staff_id,
          endpoint: endpoint,
          keys_p256dh: keys.p256dh,
          keys_auth: keys.auth,
        }
      });
    }

    console.log('[Push] Subscription saved for staff', req.staff_id);
    res.json({ success: true });
  } catch (err) {
    // Unique constraint race condition — another request saved the same endpoint
    if (err.code === 'P2002') {
      return res.json({ success: true });
    }
    next(err);
  }
});

// ── DELETE /unsubscribe — Remove push subscription (auth required) ──
router.delete('/unsubscribe', authenticate, async function(req, res, next) {
  try {
    var { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: endpoint, staff_id: req.staff_id }
    });

    console.log('[Push] Subscription removed for staff', req.staff_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
