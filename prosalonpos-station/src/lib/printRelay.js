/**
 * ProSalonPOS — Print Relay (Socket.io remote printing)
 * Session 79
 *
 * Tablets don't have QZ Tray — they can't print silently.
 * This module lets tablets send print requests through Socket.io
 * to the PC station that has QZ Tray running.
 *
 * Flow:
 *   Tablet → emitSocket('print:request', {...}) → Server → PC station → QZ Tray → Printer
 *
 * If the tablet has QZ Tray (unlikely but possible), it prints locally.
 * If socket is not connected, falls back to browser print popup.
 *
 * Usage:
 *   import { relayPrint } from '../lib/printRelay';
 *   relayPrint('tech_slip', { ticket, settings, staff });
 */

import { isQzReady, getPrinter, printReceipt, printTechSlip, printDrawerSummary } from './printService';
import { emitSocket } from './socket';

/**
 * Smart print — tries local QZ Tray first, then socket relay, then browser popup.
 *
 * @param {string} type - 'receipt' | 'tech_slip' | 'drawer_summary'
 * @param {object} opts - Print options (same format as printReceipt/printTechSlip/printDrawerSummary)
 * @returns {Promise<{method: string, success: boolean}>}
 */
export async function relayPrint(type, opts) {
  // 1. If this device has QZ Tray + a printer, print locally (fast path)
  if (isQzReady() && getPrinter()) {
    console.log('[PrintRelay] QZ Tray available — printing locally:', type);
    if (type === 'receipt') return printReceipt(opts);
    if (type === 'tech_slip') return printTechSlip(opts);
    if (type === 'drawer_summary') return printDrawerSummary(opts);
  }

  // 2. Try socket relay to PC station
  var sent = emitSocket('print:request', { type: type, opts: opts });
  if (sent) {
    console.log('[PrintRelay] Print request relayed via socket:', type);
    return { method: 'relay', success: true };
  }

  // 3. Last resort — browser print popup
  console.log('[PrintRelay] No QZ Tray, no socket — falling back to browser print');
  if (type === 'receipt') return printReceipt(opts);
  if (type === 'tech_slip') return printTechSlip(opts);
  if (type === 'drawer_summary') return printDrawerSummary(opts);

  return { method: 'none', success: false };
}
