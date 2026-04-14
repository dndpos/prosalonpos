/**
 * ProSalonPOS — SMS Service (Twilio)
 * Thin wrapper around Twilio SDK for sending SMS.
 * To switch providers, replace this file only — all routes call sendSms().
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — Twilio account SID
 *   TWILIO_AUTH_TOKEN     — Twilio auth token
 *   TWILIO_PHONE_NUMBER   — Twilio phone number (e.g. +15551234567)
 *
 * If env vars are missing, messages are logged but not sent (dev mode).
 */

import twilio from 'twilio';

var twilioClient = null;
var twilioFrom = null;
var configured = false;

var sid = process.env.TWILIO_ACCOUNT_SID;
var token = process.env.TWILIO_AUTH_TOKEN;
twilioFrom = process.env.TWILIO_PHONE_NUMBER;

if (sid && token && twilioFrom) {
  try {
    twilioClient = twilio(sid, token);
    configured = true;
    console.log('[smsService] Twilio configured — from:', twilioFrom);
  } catch (err) {
    console.warn('[smsService] Twilio init failed:', err.message);
  }
} else {
  console.log('[smsService] Twilio env vars not set — SMS logged only (dev mode)');
}

/**
 * Send an SMS message.
 * @param {string} to - Phone number (e.g. +15551234567 or (555) 123-4567)
 * @param {string} body - Message content
 * @returns {{ success: boolean, sid?: string, error?: string }}
 */
export async function sendSms(to, body) {
  // Normalize phone number — strip to digits, prepend +1 if needed
  var digits = (to || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  if (digits.length === 11 && digits[0] === '1') digits = '+' + digits;
  else if (digits[0] !== '+') digits = '+' + digits;

  if (digits.length < 12) {
    return { success: false, error: 'Invalid phone number: ' + to };
  }

  if (!configured || !twilioClient) {
    // Dev mode — log but don't send
    console.log('[smsService] DEV — would send to', digits, ':', body.substring(0, 60) + '...');
    return { success: true, sid: 'dev-' + Date.now(), dev: true };
  }

  try {
    var message = await twilioClient.messages.create({
      to: digits,
      from: twilioFrom,
      body: body,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('[smsService] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if Twilio is configured.
 */
export function isConfigured() {
  return configured;
}
