/**
 * pushService.js — Web Push notification sender
 *
 * Usage:
 *   import { sendPushToStaff, getVapidPublicKey } from '../utils/pushService.js';
 *   await sendPushToStaff(salonId, staffId, { title: '...', body: '...', icon: '...' });
 *
 * VAPID keys from environment:
 *   VAPID_PUBLIC_KEY  — shared with browser for subscription
 *   VAPID_PRIVATE_KEY — server-only, signs push messages
 *   VAPID_SUBJECT     — mailto: or https:// URL identifying the sender
 */
import webpush from 'web-push';
import prisma from '../config/database.js';

// Configure VAPID — reads from env, falls back to empty (push disabled)
var _configured = false;
var _vapidPublic = process.env.VAPID_PUBLIC_KEY || '';
var _vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';
var _vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@prosalonpos.com';

if (_vapidPublic && _vapidPrivate) {
  try {
    webpush.setVapidDetails(_vapidSubject, _vapidPublic, _vapidPrivate);
    _configured = true;
    console.log('[Push] VAPID configured — push notifications enabled');
  } catch (e) {
    console.error('[Push] VAPID configuration failed:', e.message);
  }
} else {
  console.warn('[Push] VAPID keys not set — push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.');
}

export function getVapidPublicKey() {
  return _vapidPublic;
}

export function isPushEnabled() {
  return _configured;
}

/**
 * Send a push notification to all subscriptions for a specific staff member.
 * Silently removes expired/invalid subscriptions.
 *
 * @param {string} salonId
 * @param {string} staffId
 * @param {object} payload — { title, body, icon?, url?, tag? }
 */
export async function sendPushToStaff(salonId, staffId, payload) {
  if (!_configured) return;

  try {
    var subs = await prisma.pushSubscription.findMany({
      where: { salon_id: salonId, staff_id: staffId }
    });

    if (subs.length === 0) return;

    var payloadStr = JSON.stringify(payload);
    var expiredIds = [];

    for (var i = 0; i < subs.length; i++) {
      var sub = subs[i];
      var pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
      };

      try {
        await webpush.sendNotification(pushSub, payloadStr);
      } catch (err) {
        // 410 Gone or 404 = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        } else {
          console.warn('[Push] Failed to send to', sub.endpoint.slice(0, 60), ':', err.statusCode || err.message);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } }
      });
      console.log('[Push] Removed', expiredIds.length, 'expired subscriptions');
    }
  } catch (err) {
    console.error('[Push] sendPushToStaff error:', err.message);
  }
}

/**
 * Send push to multiple staff members at once.
 * Used by appointment events that may involve multiple techs.
 *
 * @param {string} salonId
 * @param {string[]} staffIds
 * @param {object} payload
 */
export async function sendPushToStaffList(salonId, staffIds, payload) {
  if (!_configured || !staffIds || staffIds.length === 0) return;

  // De-duplicate
  var unique = staffIds.filter(function(id, idx, arr) { return arr.indexOf(id) === idx; });
  for (var i = 0; i < unique.length; i++) {
    await sendPushToStaff(salonId, unique[i], payload);
  }
}
