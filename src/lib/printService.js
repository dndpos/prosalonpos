/**
 * ProSalonPOS — Print Service (QZ Tray integration)
 *
 * Silent receipt printing via QZ Tray → Epson TM-T20/T20II/T20III, Star TSP100/TSP143 (USB or network).
 * Falls back to browser window.print() if QZ Tray is not running.
 * Browser fallbacks extracted to printServiceBrowser.js (V3).
 *
 * Usage:
 *   import { printReceipt, printTechSlip, getPrinterList, isQzReady } from '../lib/printService';
 *   await printReceipt({ salonName, items, subtotal, tax, total, payments, ticketNumber });
 *
 * Setup:
 *   1. Install QZ Tray on the PC (https://qz.io/download/)
 *   2. QZ Tray runs in system tray
 *   3. Load qz-tray.js via script tag in index.html
 *   4. Call connectQz() once on app start
 */

import { printReceiptBrowser, printTechSlipBrowser, printDrawerSummaryBrowser } from './printServiceBrowser';

// ── Character widths for 80mm thermal paper ──
var LINE_WIDTH = 48;  // Standard font: 48 chars per line
var BOLD_WIDTH = 24;  // Double-width: 24 chars per line

// ── QZ Tray connection state ──
var _qz = null;       // reference to window.qz after script loads
var _connected = false;
var _printerName = null;  // selected printer name
var _connecting = false;

// ── Check if QZ Tray JS is loaded ──
function getQz() {
  if (_qz) return _qz;
  if (typeof window !== 'undefined' && window.qz) {
    _qz = window.qz;
    return _qz;
  }
  return null;
}

// ── Connect to QZ Tray ──
export async function connectQz() {
  var qz = getQz();
  if (!qz) {
    console.warn('[PrintService] QZ Tray JS not loaded. Add <script src="qz-tray.js"> to index.html');
    return false;
  }
  if (_connected) return true;
  if (_connecting) return false;
  _connecting = true;
  try {
    // QZ Tray uses self-signed certs for localhost WebSocket
    qz.security.setCertificatePromise(function(resolve) {
      resolve();  // Accept default cert — fine for localhost
    });
    qz.security.setSignaturePromise(function() {
      return function(resolve) { resolve(); };
    });
    await qz.websocket.connect();
    _connected = true;
    _connecting = false;
    console.log('[PrintService] Connected to QZ Tray');
    return true;
  } catch (err) {
    _connecting = false;
    console.warn('[PrintService] Could not connect to QZ Tray:', err.message || err);
    return false;
  }
}

// ── Disconnect ──
export async function disconnectQz() {
  var qz = getQz();
  if (qz && _connected) {
    try { await qz.websocket.disconnect(); } catch (e) { /* ignore */ }
    _connected = false;
  }
}

// ── Check if QZ Tray is ready ──
export function isQzReady() {
  return _connected && _printerName;
}

// ── Get list of available printers ──
export async function getPrinterList() {
  var qz = getQz();
  if (!qz || !_connected) {
    var ok = await connectQz();
    if (!ok) return [];
  }
  try {
    var printers = await getQz().printers.find();
    return printers || [];
  } catch (err) {
    console.warn('[PrintService] Error listing printers:', err);
    return [];
  }
}

// ── Find receipt printer automatically ──
export async function findEpsonPrinter() {
  var printers = await getPrinterList();
  // Look for common receipt printer names (Epson + Star)
  var keywords = ['epson', 'tm-t20', 'tm-t88', 'tm-t82', 'tm-m30', 'receipt', 'pos', 'star', 'tsp100', 'tsp143', 'sp700', 'mcp31', 'thermal'];
  for (var i = 0; i < printers.length; i++) {
    var name = (printers[i] || '').toLowerCase();
    for (var k = 0; k < keywords.length; k++) {
      if (name.indexOf(keywords[k]) >= 0) {
        return printers[i];
      }
    }
  }
  return null;
}

// ── Set the printer to use ──
export function setPrinter(name) {
  _printerName = name;
  console.log('[PrintService] Printer set to:', name);
}

// ── Get current printer name ──
export function getPrinter() {
  return _printerName;
}

/**
 * Print ESC/POS data to a specific named printer (for multi-printer routing).
 * Falls back to default printer if name not found.
 */
export async function printToNamedPrinter(printerName, escData) {
  var qz = getQz();
  if (!qz || !_connected) return { method: 'none', success: false };
  try {
    var config = qz.configs.create(printerName, { encoding: 'UTF-8' });
    await qz.print(config, escData);
    console.log('[PrintService] Printed to:', printerName);
    return { method: 'qz', success: true };
  } catch (err) {
    console.warn('[PrintService] Print to ' + printerName + ' failed:', err);
    return { method: 'none', success: false };
  }
}

/**
 * Test print — sends a short test receipt to verify printer is working.
 */
export async function printTestPage(printerName) {
  var qz = getQz();
  if (!qz || !_connected) {
    // Browser fallback test
    var win = window.open('', '_blank', 'width=320,height=300');
    if (win) {
      win.document.write('<html><body style="font-family:monospace;font-size:14px;padding:20px;text-align:center;">');
      win.document.write('<b>ProSalonPOS</b><br>Printer Test<br>');
      win.document.write('---------------------------<br>');
      win.document.write('If you can read this,<br>your printer is working!<br>');
      win.document.write('---------------------------<br>');
      win.document.write(new Date().toLocaleString() + '<br><br>');
      win.document.write('</body></html>');
      win.document.close();
      setTimeout(function() { win.print(); }, 400);
    }
    return { method: 'browser', success: true };
  }
  try {
    var data = [];
    data.push(CMD.INIT);
    data.push(CMD.CENTER);
    data.push(CMD.DOUBLE_ON);
    data.push('ProSalonPOS\n');
    data.push(CMD.DOUBLE_OFF);
    data.push('Printer Test\n');
    data.push(CMD.LEFT);
    data.push(dashLine(48) + '\n');
    data.push(CMD.CENTER);
    data.push('If you can read this,\n');
    data.push('your printer is working!\n');
    data.push(CMD.LEFT);
    data.push(dashLine(48) + '\n');
    data.push(CMD.CENTER);
    data.push('Printer: ' + printerName + '\n');
    data.push(new Date().toLocaleString() + '\n');
    data.push(CMD.FEED);
    data.push(CMD.CUT);
    var config = qz.configs.create(printerName, { encoding: 'UTF-8' });
    await qz.print(config, data);
    console.log('[PrintService] Test page printed on:', printerName);
    return { method: 'qz', success: true };
  } catch (err) {
    console.warn('[PrintService] Test print failed on ' + printerName + ':', err);
    return { method: 'none', success: false };
  }
}

// ── Auto-setup: connect + find Epson ──
export async function autoSetup() {
  var ok = await connectQz();
  if (!ok) return { connected: false, printer: null };
  var printer = await findEpsonPrinter();
  if (printer) {
    setPrinter(printer);
  }
  return { connected: true, printer: printer };
}

// ═══════════════════════════════════════════════════
// ESC/POS command helpers
// ═══════════════════════════════════════════════════

var ESC = '\x1B';
var GS = '\x1D';

var CMD = {
  INIT:         ESC + '@',           // Initialize printer
  ALIGN_LEFT:   ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT:  ESC + 'a' + '\x02',
  BOLD_ON:      ESC + 'E' + '\x01',
  BOLD_OFF:     ESC + 'E' + '\x00',
  DOUBLE_ON:    GS + '!' + '\x11',   // Double width + height
  DOUBLE_OFF:   GS + '!' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF:ESC + '-' + '\x00',
  CUT:          GS + 'V' + '\x41' + '\x03',  // Partial cut with feed
  FEED:         ESC + 'd' + '\x03',  // Feed 3 lines
  OPEN_DRAWER:  ESC + 'p' + '\x00' + '\x19' + '\xFA',  // Kick cash drawer
};

// ── Text formatting helpers ──
function padRight(str, len) {
  str = String(str || '');
  while (str.length < len) str += ' ';
  return str.substring(0, len);
}

function padLeft(str, len) {
  str = String(str || '');
  while (str.length < len) str = ' ' + str;
  return str.substring(0, len);
}

function centerText(str, len) {
  str = String(str || '');
  if (str.length >= len) return str.substring(0, len);
  var pad = Math.floor((len - str.length) / 2);
  return padRight(' '.repeat(pad) + str, len);
}

function leftRight(left, right, width) {
  left = String(left || '');
  right = String(right || '');
  var space = width - left.length - right.length;
  if (space < 1) space = 1;
  return left + ' '.repeat(space) + right;
}

function dashLine(width) {
  var line = '';
  for (var i = 0; i < width; i++) line += '-';
  return line;
}

function formatMoney(cents) {
  var negative = cents < 0;
  var abs = Math.abs(cents || 0);
  var dollars = Math.floor(abs / 100);
  var c = String(abs % 100);
  if (c.length < 2) c = '0' + c;
  return (negative ? '-' : '') + '$' + dollars + '.' + c;
}

// ═══════════════════════════════════════════════════
// Receipt builders
// ═══════════════════════════════════════════════════

/**
 * Build ESC/POS data for a checkout receipt
 */
function buildReceiptData(opts) {
  var data = [];
  var W = LINE_WIDTH;

  // Initialize
  data.push(CMD.INIT);

  // ── Salon header ──
  data.push(CMD.ALIGN_CENTER);
  data.push(CMD.BOLD_ON);
  data.push(CMD.DOUBLE_ON);
  data.push((opts.salonName || 'Salon') + '\n');
  data.push(CMD.DOUBLE_OFF);
  data.push(CMD.BOLD_OFF);

  if (opts.salonAddress) data.push(opts.salonAddress + '\n');
  if (opts.salonPhone) data.push(opts.salonPhone + '\n');
  data.push('\n');

  // ── Ticket info ──
  data.push(CMD.ALIGN_LEFT);
  var now = new Date();
  var dateStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
  var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  data.push(leftRight('Ticket #' + (opts.displayNumber || opts.ticketNumber || ''), dateStr + ' ' + timeStr, W) + '\n');

  if (opts.clientName) {
    data.push('Client: ' + opts.clientName + '\n');
  }
  if (opts.techName) {
    data.push('Tech: ' + opts.techName + '\n');
  }

  data.push(dashLine(W) + '\n');

  // ── Line items ──
  var items = opts.items || [];
  items.forEach(function(item) {
    var name = item.name || 'Item';
    var price = formatMoney(item.price_cents || 0);
    var qty = item.qty || 1;
    var techLabel = item.tech ? ' (' + item.tech + ')' : '';

    if (qty > 1) {
      data.push(name + techLabel + '\n');
      data.push(leftRight('  ' + qty + ' x ' + formatMoney(Math.round((item.price_cents || 0) / qty)), price, W) + '\n');
    } else {
      data.push(leftRight(name + techLabel, price, W) + '\n');
    }

    // Product cost deduction
    if (item.product_cost_cents > 0) {
      data.push(leftRight('  - Product cost', '-' + formatMoney(item.product_cost_cents), W) + '\n');
    }
  });

  data.push(dashLine(W) + '\n');

  // ── Totals ──
  if (opts.discountCents > 0) {
    data.push(leftRight('Discount', '-' + formatMoney(opts.discountCents), W) + '\n');
  }
  data.push(leftRight('Subtotal', formatMoney(opts.subtotalCents || 0), W) + '\n');
  data.push(leftRight('Tax', formatMoney(opts.taxCents || 0), W) + '\n');

  if (opts.tipCents > 0) {
    data.push(leftRight('Tip', formatMoney(opts.tipCents), W) + '\n');
  }

  data.push(dashLine(W) + '\n');
  data.push(CMD.BOLD_ON);
  data.push(leftRight('TOTAL', formatMoney(opts.totalCents || 0), W) + '\n');
  data.push(CMD.BOLD_OFF);

  // ── Payments ──
  if (opts.payments && opts.payments.length > 0) {
    data.push('\n');
    opts.payments.forEach(function(p) {
      var method = p.method || 'Payment';
      method = method.charAt(0).toUpperCase() + method.slice(1);
      data.push(leftRight(method, formatMoney(p.amount_cents || 0), W) + '\n');
    });
  }

  // Change
  if (opts.changeCents > 0) {
    data.push(leftRight('Change', formatMoney(opts.changeCents), W) + '\n');
  }

  // ── Footer ──
  data.push('\n');
  data.push(CMD.ALIGN_CENTER);
  data.push('Thank you for visiting!\n');
  if (opts.footerMessage) {
    data.push(opts.footerMessage + '\n');
  }
  data.push('\n\n');

  // Cut paper
  data.push(CMD.FEED);
  data.push(CMD.CUT);

  return data;
}

/**
 * Build ESC/POS data for a tech slip
 */
function buildTechSlipData(opts) {
  var data = [];
  var W = LINE_WIDTH;

  data.push(CMD.INIT);

  // Header — tech slip number (per tech, per day)
  data.push(CMD.ALIGN_CENTER);
  data.push(CMD.DOUBLE_ON);
  data.push('SLIP #' + (opts.slipNumber || '') + '\n');
  data.push(CMD.DOUBLE_OFF);
  data.push(dashLine(W) + '\n');

  // Tech name
  data.push(CMD.ALIGN_LEFT);
  data.push(CMD.BOLD_ON);
  data.push((opts.techName || 'Staff') + '\n');
  data.push(CMD.BOLD_OFF);
  data.push(dashLine(W) + '\n');

  // Services
  var techTotal = 0;
  (opts.items || []).forEach(function(item) {
    var cents = item.price_cents || 0;
    techTotal += cents;
    data.push(leftRight(item.name || 'Service', formatMoney(cents), W) + '\n');
  });

  data.push(dashLine(W) + '\n');
  data.push(CMD.BOLD_ON);
  data.push(leftRight('Total', formatMoney(techTotal), W) + '\n');
  data.push(CMD.BOLD_OFF);

  // Payment method
  if (opts.paymentLabel) {
    data.push(leftRight('Payment', opts.paymentLabel, W) + '\n');
  }

  // Salon ticket reference at bottom
  data.push(dashLine(W) + '\n');
  data.push(CMD.ALIGN_CENTER);
  data.push('Salon Ticket #' + (opts.displayNumber || opts.ticketNumber || '') + '\n');
  data.push(CMD.ALIGN_LEFT);

  data.push('\n');
  data.push(CMD.FEED);
  data.push(CMD.CUT);

  return data;
}

// ═══════════════════════════════════════════════════
// Public print functions
// ═══════════════════════════════════════════════════

/**
 * Print a customer receipt.
 * Tries QZ Tray first, falls back to browser print.
 */
export async function printReceipt(opts) {
  var qz = getQz();

  // Try QZ Tray silent print
  if (qz && _connected && _printerName) {
    try {
      var escData = buildReceiptData(opts);
      var config = qz.configs.create(_printerName, { encoding: 'UTF-8' });
      await qz.print(config, escData);
      console.log('[PrintService] Receipt printed silently via QZ Tray');
      return { method: 'qz', success: true };
    } catch (err) {
      console.warn('[PrintService] QZ Tray print failed, falling back to browser:', err);
    }
  }

  // Fallback: browser print
  return printReceiptBrowser(opts);
}

/**
 * Print tech slip(s).
 * Tries QZ Tray first, falls back to browser print.
 */
export async function printTechSlip(opts) {
  var qz = getQz();

  if (qz && _connected && _printerName) {
    try {
      var escData = buildTechSlipData(opts);
      var config = qz.configs.create(_printerName, { encoding: 'UTF-8' });
      await qz.print(config, escData);
      console.log('[PrintService] Tech slip printed silently via QZ Tray');
      return { method: 'qz', success: true };
    } catch (err) {
      console.warn('[PrintService] QZ Tray tech slip failed, falling back to browser:', err);
    }
  }

  // Fallback: browser print
  return printTechSlipBrowser(opts);
}

/**
 * Open cash drawer (if connected via printer)
 */
export async function openCashDrawer() {
  var qz = getQz();
  if (qz && _connected && _printerName) {
    try {
      var config = qz.configs.create(_printerName);
      await qz.print(config, [CMD.OPEN_DRAWER]);
      console.log('[PrintService] Cash drawer opened');
      return true;
    } catch (err) {
      console.warn('[PrintService] Could not open cash drawer:', err);
      return false;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════
// Drawer Summary Receipt
// ═══════════════════════════════════════════════════

function buildDrawerSummaryData(opts) {
  var W = 48;
  var result = opts.result || {};
  var settings = opts.settings || {};
  var salonName = settings.salon_name || 'Salon';
  var diff = result.difference_cents || 0;
  var isShort = diff < 0;
  var isOver = diff > 0;
  var showAmount = settings.cashier_show_short_amount;

  var lines = [];
  lines.push(CMD.INIT);
  lines.push(CMD.CENTER);
  lines.push(CMD.BOLD_ON);
  lines.push(salonName + '\n');
  lines.push(CMD.BOLD_OFF);
  lines.push('CASH DRAWER SUMMARY\n');
  lines.push(CMD.LEFT);
  lines.push(dashLine(W) + '\n');

  // Cashier + times
  lines.push(leftRight('Cashier:', result.cashier_name || 'Unknown', W) + '\n');
  lines.push(leftRight('Shift start:', formatDrawerTime(result.opened_at), W) + '\n');
  lines.push(leftRight('Shift end:', formatDrawerTime(result.closed_at), W) + '\n');
  lines.push(dashLine(W) + '\n');

  // Amounts
  lines.push(leftRight('Starting cash:', formatMoney(result.starting_cents || 0), W) + '\n');
  lines.push(leftRight('Cash payments (' + (result.tx_count || 0) + '):', formatMoney(result.cash_pay_total || 0), W) + '\n');
  lines.push(CMD.BOLD_ON);
  lines.push(leftRight('Expected total:', formatMoney(result.expected_cents || 0), W) + '\n');
  lines.push(leftRight('Cashier reported:', formatMoney(result.reported_cents || 0), W) + '\n');
  lines.push(CMD.BOLD_OFF);
  lines.push(dashLine(W) + '\n');

  // Status
  if (isShort) {
    lines.push(CMD.BOLD_ON);
    if (showAmount) {
      lines.push(leftRight('*** DRAWER SHORT ***', formatMoney(Math.abs(diff)), W) + '\n');
    } else {
      lines.push(centerText('*** DRAWER SHORT ***', W) + '\n');
    }
    lines.push(CMD.BOLD_OFF);
  } else if (isOver) {
    lines.push(CMD.BOLD_ON);
    if (showAmount) {
      lines.push(leftRight('*** DRAWER OVER ***', formatMoney(Math.abs(diff)), W) + '\n');
    } else {
      lines.push(centerText('*** DRAWER OVER ***', W) + '\n');
    }
    lines.push(CMD.BOLD_OFF);
  } else {
    lines.push(CMD.CENTER);
    lines.push(CMD.BOLD_ON);
    lines.push('BALANCED\n');
    lines.push(CMD.BOLD_OFF);
    lines.push(CMD.LEFT);
  }

  lines.push('\n');
  lines.push(CMD.CENTER);
  var now = new Date();
  lines.push((now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear() + ' ' + formatDrawerTime(now.getTime()) + '\n');
  lines.push(CMD.LEFT);
  lines.push(CMD.FEED);
  lines.push(CMD.CUT);

  return lines;
}

// formatDrawerTime moved to printServiceBrowser.js — keep local copy for ESC/POS drawer summary
function formatDrawerTime(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

// printDrawerSummaryBrowser extracted to printServiceBrowser.js (V3)

/**
 * Print drawer close summary.
 * Tries QZ Tray first, falls back to browser print.
 */
export async function printDrawerSummary(opts) {
  var qz = getQz();

  if (qz && _connected && _printerName) {
    try {
      var escData = buildDrawerSummaryData(opts);
      var config = qz.configs.create(_printerName, { encoding: 'UTF-8' });
      await qz.print(config, escData);
      console.log('[PrintService] Drawer summary printed silently via QZ Tray');
      return { method: 'qz', success: true };
    } catch (err) {
      console.warn('[PrintService] QZ Tray drawer summary failed, falling back to browser:', err);
    }
  }

  return printDrawerSummaryBrowser(opts);
}

// ═══════════════════════════════════════════════════
// Browser fallback (window.open + window.print)
// ═══════════════════════════════════════════════════

// printReceiptBrowser extracted to printServiceBrowser.js (V3)

// printTechSlipBrowser extracted to printServiceBrowser.js (V3)
