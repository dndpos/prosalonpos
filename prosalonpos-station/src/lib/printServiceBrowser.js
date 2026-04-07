/**
 * ProSalonPOS — Print Service Browser Fallbacks
 *
 * Browser window.open + window.print fallbacks for receipt printing,
 * tech slips, and drawer summaries when QZ Tray is not available.
 *
 * Extracted from printService.js (V3) to stay under 800-line cap.
 */

function formatMoney(cents) {
  var negative = cents < 0;
  var abs = Math.abs(cents || 0);
  var dollars = Math.floor(abs / 100);
  var c = String(abs % 100);
  if (c.length < 2) c = '0' + c;
  return (negative ? '-' : '') + '$' + dollars + '.' + c;
}

function formatDrawerTime(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

// ═══════════════════════════════════════════════════
// Browser fallback (window.open + window.print)
// ═══════════════════════════════════════════════════

export function printReceiptBrowser(opts) {
  var W = 280;
  var html = '<html><head><title>Receipt</title><style>';
  html += 'body{margin:0;font-family:monospace;font-size:12px;color:#000;}';
  html += '.receipt{width:' + W + 'px;padding:16px;}';
  html += '.row{display:flex;justify-content:space-between;margin-bottom:2px;}';
  html += '.sep{border-top:1px dashed #999;margin:6px 0;}';
  html += '.center{text-align:center;}';
  html += '.bold{font-weight:700;}';
  html += '.big{font-size:16px;font-weight:700;}';
  html += '@media print{@page{margin:4mm;size:80mm auto;}}';
  html += '</style></head><body><div class="receipt">';

  // Header
  html += '<div class="center big" style="margin-bottom:4px">' + (opts.salonName || 'Salon') + '</div>';
  if (opts.salonAddress) html += '<div class="center">' + opts.salonAddress + '</div>';
  if (opts.salonPhone) html += '<div class="center">' + opts.salonPhone + '</div>';
  html += '<div class="sep"></div>';

  // Ticket info
  var now = new Date();
  var dateStr = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
  var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  html += '<div class="row"><span>Ticket #' + (opts.displayNumber || opts.ticketNumber || '') + '</span><span>' + dateStr + ' ' + timeStr + '</span></div>';
  if (opts.clientName) html += '<div>Client: ' + opts.clientName + '</div>';
  if (opts.techName) html += '<div>Tech: ' + opts.techName + '</div>';
  html += '<div class="sep"></div>';

  // Items
  (opts.items || []).forEach(function(item) {
    var name = item.name || 'Item';
    var tech = item.tech ? ' (' + item.tech + ')' : '';
    html += '<div class="row"><span>' + name + tech + '</span><span>' + formatMoney(item.price_cents || 0) + '</span></div>';
  });

  html += '<div class="sep"></div>';

  // Totals
  if (opts.discountCents > 0) {
    html += '<div class="row"><span>Discount</span><span>-' + formatMoney(opts.discountCents) + '</span></div>';
  }
  html += '<div class="row"><span>Subtotal</span><span>' + formatMoney(opts.subtotalCents || 0) + '</span></div>';
  html += '<div class="row"><span>Tax</span><span>' + formatMoney(opts.taxCents || 0) + '</span></div>';
  if (opts.tipCents > 0) {
    html += '<div class="row"><span>Tip</span><span>' + formatMoney(opts.tipCents) + '</span></div>';
  }
  html += '<div class="sep"></div>';
  html += '<div class="row bold" style="font-size:14px"><span>TOTAL</span><span>' + formatMoney(opts.totalCents || 0) + '</span></div>';

  // Payments
  if (opts.payments && opts.payments.length > 0) {
    html += '<div class="sep"></div>';
    opts.payments.forEach(function(p) {
      var method = (p.method || 'Payment');
      method = method.charAt(0).toUpperCase() + method.slice(1);
      html += '<div class="row"><span>' + method + '</span><span>' + formatMoney(p.amount_cents || 0) + '</span></div>';
    });
  }
  if (opts.changeCents > 0) {
    html += '<div class="row"><span>Change</span><span>' + formatMoney(opts.changeCents) + '</span></div>';
  }

  // Footer
  html += '<div class="sep"></div>';
  html += '<div class="center" style="margin-top:8px">Thank you for visiting!</div>';
  if (opts.footerMessage) html += '<div class="center">' + opts.footerMessage + '</div>';

  html += '</div></body></html>';

  var win = window.open('', '_blank', 'width=400,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); win.close(); }, 400);
  }
  return { method: 'browser', success: true };
}

export function printTechSlipBrowser(opts) {
  var html = '<html><head><title>Tech Slip</title><style>';
  html += 'body{margin:0;font-family:monospace;font-size:12px;color:#000;}';
  html += '.slip{width:280px;padding:16px;}';
  html += '.row{display:flex;justify-content:space-between;margin-bottom:2px;}';
  html += '.sep{border-top:1px dashed #999;margin:6px 0;}';
  html += '.center{text-align:center;}';
  html += '.bold{font-weight:700;}';
  html += '@media print{@page{margin:4mm;size:80mm auto;}}';
  html += '</style></head><body><div class="slip">';

  html += '<div class="center bold" style="font-size:18px;margin-bottom:6px">SLIP #' + (opts.slipNumber || '') + '</div>';
  html += '<div class="sep"></div>';
  html += '<div class="bold" style="margin-bottom:6px">' + (opts.techName || 'Staff') + '</div>';
  html += '<div class="sep"></div>';

  var total = 0;
  (opts.items || []).forEach(function(item) {
    var cents = item.price_cents || 0;
    total += cents;
    html += '<div class="row"><span>' + (item.name || 'Service') + '</span><span>' + formatMoney(cents) + '</span></div>';
  });

  html += '<div class="sep"></div>';
  html += '<div class="row bold"><span>Total</span><span>' + formatMoney(total) + '</span></div>';
  if (opts.paymentLabel) {
    html += '<div class="row" style="font-size:11px"><span>Payment</span><span>' + opts.paymentLabel + '</span></div>';
  }

  html += '<div class="sep"></div>';
  html += '<div class="center" style="font-size:11px;margin-top:4px">Salon Ticket #' + (opts.displayNumber || opts.ticketNumber || '') + '</div>';

  html += '</div></body></html>';

  var win = window.open('', '_blank', 'width=400,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); win.close(); }, 400);
  }
  return { method: 'browser', success: true };
}

export function printDrawerSummaryBrowser(opts) {
  var result = opts.result || {};
  var settings = opts.settings || {};
  var salonName = settings.salon_name || 'Salon';
  var diff = result.difference_cents || 0;
  var isShort = diff < 0;
  var isOver = diff > 0;
  var showAmount = settings.cashier_show_short_amount;

  var W = 280;
  var html = '<html><head><title>Drawer Summary</title><style>';
  html += 'body{margin:0;font-family:monospace;font-size:12px;color:#000;}';
  html += '.receipt{width:' + W + 'px;padding:16px;}';
  html += '.center{text-align:center;} .bold{font-weight:700;}';
  html += '.row{display:flex;justify-content:space-between;padding:2px 0;}';
  html += '.divider{border-top:1px dashed #000;margin:6px 0;}';
  html += '.status{text-align:center;padding:8px 0;font-weight:700;font-size:14px;}';
  html += '</style></head><body><div class="receipt">';
  html += '<div class="center bold" style="font-size:14px;">' + salonName + '</div>';
  html += '<div class="center" style="margin-bottom:4px;">CASH DRAWER SUMMARY</div>';
  html += '<div class="divider"></div>';
  html += '<div class="row"><span>Cashier:</span><span class="bold">' + (result.cashier_name || 'Unknown') + '</span></div>';
  html += '<div class="row"><span>Shift start:</span><span>' + formatDrawerTime(result.opened_at) + '</span></div>';
  html += '<div class="row"><span>Shift end:</span><span>' + formatDrawerTime(result.closed_at) + '</span></div>';
  html += '<div class="divider"></div>';
  html += '<div class="row"><span>Starting cash:</span><span>' + formatMoney(result.starting_cents || 0) + '</span></div>';
  html += '<div class="row"><span>Cash payments (' + (result.tx_count || 0) + '):</span><span>' + formatMoney(result.cash_pay_total || 0) + '</span></div>';
  html += '<div class="row bold"><span>Expected total:</span><span>' + formatMoney(result.expected_cents || 0) + '</span></div>';
  html += '<div class="row bold"><span>Cashier reported:</span><span>' + formatMoney(result.reported_cents || 0) + '</span></div>';
  html += '<div class="divider"></div>';

  if (isShort) {
    html += '<div class="status" style="color:#dc2626;">';
    html += '*** DRAWER SHORT ***';
    if (showAmount) html += '<br>' + formatMoney(Math.abs(diff));
    html += '</div>';
  } else if (isOver) {
    html += '<div class="status" style="color:#d97706;">';
    html += '*** DRAWER OVER ***';
    if (showAmount) html += '<br>' + formatMoney(Math.abs(diff));
    html += '</div>';
  } else {
    html += '<div class="status" style="color:#16a34a;">BALANCED</div>';
  }

  var now = new Date();
  html += '<div class="center" style="margin-top:8px;font-size:11px;">';
  html += (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear() + ' ' + formatDrawerTime(now.getTime());
  html += '</div>';
  html += '</div></body></html>';

  var win = window.open('', '_blank', 'width=320,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 400);
  }
  return { method: 'browser', success: true };
}
