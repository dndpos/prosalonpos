/**
 * ReportsHelpers.jsx — Helpers extracted from ReportsModule (Session V18)
 * Contains: reshapeTicket, reshapeTicketsByTech, date helpers,
 * ReceiptLine component, CalendarPicker component.
 * IMPORTANT: reshapeTicket and reshapeTicketsByTech are exact copies
 * from the original ReportsModule — do not modify return shapes.
 */
import { useTheme } from '../../lib/ThemeContext';
import { useState } from 'react';

export function reshapeTicket(ticket) {
  var items = ticket.items || ticket.lineItems || [];
  var services = items.filter(function(it) { return it.type === 'service'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0 };
  });
  var products = items.filter(function(it) { return it.type === 'retail'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0 };
  });
  var packageItems = items.filter(function(it) { return it.type === 'package_sale'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0 };
  });
  var membershipItems = items.filter(function(it) { return it.type === 'membership_sale'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0 };
  });
  var giftCardItems = items.filter(function(it) { return it.type === 'giftcard'; }).map(function(it) {
    return { name: it.name, price_cents: it.price_cents || 0 };
  });
  var svcTotal = services.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var prodTotal = products.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var pkgTotal = packageItems.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var memTotal = membershipItems.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var gcTotal = giftCardItems.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var payments = ticket.payments || [];
  var payMethod = ticket.paymentMethod || ticket.payment_method || 'credit';
  if (payments.length > 0) {
    var mt = {}; payments.forEach(function(p) { var m = p.method === 'giftcard' ? 'gift' : (p.method || 'credit'); mt[m] = (mt[m] || 0) + (p.amount_cents || 0); });
    var best = 'credit'; var bestAmt = 0; Object.keys(mt).forEach(function(m) { if (mt[m] > bestAmt) { best = m; bestAmt = mt[m]; } }); payMethod = best;
  }
  // Determine staff_id — first service item's techId, or createdBy
  var staffId = '';
  var firstService = items.find(function(it) { return it.type === 'service' && it.techId; });
  if (firstService) staffId = firstService.techId;
  else staffId = ticket.createdBy || ticket.closedBy || '';
  // Date from closedAt or created_at
  var dateStr = '';
  var _dts = ticket.closedAt || ticket.created_at;
  if (_dts) { var _d = new Date(_dts); if (!isNaN(_d.getTime())) dateStr = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0'); }
  // Pkg credits restored from refund history
  var pkgCreditsRestoredCents = 0;
  (ticket.refunds || []).forEach(function(r) {
    if (r.pkgCreditsRestored) {
      (r.items || []).forEach(function(ri) { if (ri.isPkgRedeemed) pkgCreditsRestoredCents += (ri.refundAmount_cents || 0); });
      if (pkgCreditsRestoredCents === 0) pkgCreditsRestoredCents = r.refundTotal_cents || 0;
    }
  });
  return {
    id: ticket.id,
    staff_id: staffId,
    date: dateStr,
    voided: ticket.status === 'voided',
    refunded: ticket.status === 'refunded',
    refundCents: ticket.refundCents || ticket.refund_cents || 0,
    status: ticket.status,
    services: services,
    products: products,
    packages: packageItems,
    memberships: membershipItems,
    giftCards: giftCardItems,
    tip_cents: ticket.tipCents || ticket.tip_cents || 0,
    payment_method: payMethod,
    payments: payments,
    service_total: svcTotal,
    product_total: prodTotal,
    package_total: pkgTotal,
    membership_total: memTotal,
    gc_total: gcTotal,
    subtotal: svcTotal + prodTotal + pkgTotal + memTotal + gcTotal,
    taxCents: ticket.taxCents || ticket.tax_cents || 0,
    pkgRedeemCents: ticket.pkgRedeemCents || ticket.pkg_redeemed_cents || 0,
    pkgCreditsRestoredCents: pkgCreditsRestoredCents,
  };
}
// For multi-tech tickets, split into one report entry per tech
export function reshapeTicketsByTech(ticket) {
  var items = ticket.items || ticket.lineItems || [];
  var techGroups = {};
  items.forEach(function(it) {
    if (it.type !== 'service') return;
    var tid = it.techId || ticket.createdBy || '';
    if (!techGroups[tid]) techGroups[tid] = [];
    techGroups[tid].push(it);
  });
  var techIds = Object.keys(techGroups);
  // If no tech grouping or single tech, just return the reshaped ticket
  if (techIds.length <= 1) return [reshapeTicket(ticket)];
  // Multiple techs — split the ticket. Retail, packages, memberships, gift cards go to the primary tech (createdBy).
  var products = items.filter(function(it) { return it.type === 'retail'; });
  var packageItems = items.filter(function(it) { return it.type === 'package_sale'; });
  var membershipItems = items.filter(function(it) { return it.type === 'membership_sale'; });
  var giftCardItems = items.filter(function(it) { return it.type === 'giftcard'; });
  var payments = ticket.payments || [];
  var payMethod = ticket.paymentMethod || ticket.payment_method || 'credit';
  if (payments.length > 0) {
    var mt2 = {}; payments.forEach(function(p) { var m = p.method === 'giftcard' ? 'gift' : (p.method || 'credit'); mt2[m] = (mt2[m] || 0) + (p.amount_cents || 0); });
    var best2 = 'credit'; var bestAmt2 = 0; Object.keys(mt2).forEach(function(m) { if (mt2[m] > bestAmt2) { best2 = m; bestAmt2 = mt2[m]; } }); payMethod = best2;
  }
  var dateStr = '';
  var _dts2 = ticket.closedAt || ticket.created_at;
  if (_dts2) { var _d2 = new Date(_dts2); if (!isNaN(_d2.getTime())) dateStr = _d2.getFullYear() + '-' + String(_d2.getMonth() + 1).padStart(2, '0') + '-' + String(_d2.getDate()).padStart(2, '0'); }
  // Split tip proportionally by service amount
  var totalSvc = items.filter(function(it) { return it.type === 'service'; }).reduce(function(s, it) { return s + (it.price_cents || 0); }, 0);
  var totalTip = ticket.tipCents || ticket.tip_cents || 0;
  return techIds.map(function(tid, idx) {
    var svcs = techGroups[tid].map(function(it) { return { name: it.name, price_cents: it.price_cents || 0 }; });
    var svcTotal = svcs.reduce(function(s, v) { return s + v.price_cents; }, 0);
    var prods = idx === 0 ? products.map(function(it) { return { name: it.name, price_cents: it.price_cents || 0 }; }) : [];
    var prodTotal = prods.reduce(function(s, v) { return s + v.price_cents; }, 0);
    var pkgs = idx === 0 ? packageItems.map(function(it) { return { name: it.name, price_cents: it.price_cents || 0 }; }) : [];
    var pkgTotal = pkgs.reduce(function(s, v) { return s + v.price_cents; }, 0);
    var mems = idx === 0 ? membershipItems.map(function(it) { return { name: it.name, price_cents: it.price_cents || 0 }; }) : [];
    var memTotal = mems.reduce(function(s, v) { return s + v.price_cents; }, 0);
    var gcs = idx === 0 ? giftCardItems.map(function(it) { return { name: it.name, price_cents: it.price_cents || 0 }; }) : [];
    var gcTotal = gcs.reduce(function(s, v) { return s + v.price_cents; }, 0);
    var tipShare = totalSvc > 0 ? Math.round(totalTip * svcTotal / totalSvc) : 0;
    return {
      id: ticket.id + '-' + tid,
      staff_id: tid,
      date: dateStr,
      voided: ticket.status === 'voided',
      refunded: ticket.status === 'refunded',
      refundCents: ticket.refundCents || ticket.refund_cents || 0,
      status: ticket.status,
      services: svcs,
      products: prods,
      packages: pkgs,
      memberships: mems,
      giftCards: gcs,
      tip_cents: tipShare,
      payment_method: payMethod,
      payments: idx === 0 ? payments : [],
      service_total: svcTotal,
      product_total: prodTotal,
      package_total: pkgTotal,
      membership_total: memTotal,
      gc_total: gcTotal,
      subtotal: svcTotal + prodTotal + pkgTotal + memTotal + gcTotal,
      taxCents: idx === 0 ? (ticket.taxCents || ticket.tax_cents || 0) : 0,
      pkgRedeemCents: idx === 0 ? (ticket.pkgRedeemCents || ticket.pkg_redeemed_cents || 0) : 0,
      pkgCreditsRestoredCents: idx === 0 ? (function() { var r = 0; (ticket.refunds || []).forEach(function(rf) { if (rf.pkgCreditsRestored) { (rf.items || []).forEach(function(ri) { if (ri.isPkgRedeemed) r += (ri.refundAmount_cents || 0); }); if (r === 0) r = rf.refundTotal_cents || 0; } }); return r; })() : 0,
    };
  });
}
export function shiftDate(dateStr, days) {
  var d = new Date(dateStr + 'T00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export function formatDate(dateStr) {
  var d = new Date(dateStr + 'T00:00');
  return (d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear();
}
export function formatDateLong(dateStr) {
  var d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// ── Receipt line component ──
export function ReceiptLine({ label, value, bold, large, color }) {
  var c = color || (bold ? '#F1F5F9' : '#E2E8F0');
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ fontSize: large ? 14 : 13, color: c, fontWeight: bold ? 600 : 400 }}>{label}</span><span style={{ fontSize: large ? 16 : 13, color: c, fontWeight: bold ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span></div>);
}

// ── Calendar picker component ──
var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function CalendarPicker({ label, value, onChange }) {
  var T = useTheme();
  // Parse selected date or default to today
  var sel = value ? new Date(value + 'T00:00') : new Date();
  var initYear = sel.getFullYear();
  var initMonth = sel.getMonth();

  var [viewYear, setViewYear] = useState(initYear);
  var [viewMonth, setViewMonth] = useState(initMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }
  // Build calendar grid
  var firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  var cells = [];

  // Empty cells before first day
  for (var e = 0; e < firstDay; e++) cells.push(null);
  // Day cells
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);

  // Selected date string for comparison
  var selectedStr = value || '';

  function pickDay(day) {
    var mm = String(viewMonth + 1).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    onChange(viewYear + '-' + mm + '-' + dd);
  }

  var CELL = 40;

  return (
    <div>
      <div style={{ fontSize: 13, color: '#F1F5F9', fontWeight: 500, marginBottom: 10, textAlign: 'center' }}>{label}</div>

      {/* Month/year header with arrows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div onClick={prevMonth}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #475569', borderRadius: 6, color:T.textPrimary, fontSize: 16, cursor: 'pointer', userSelect: 'none' }}
          onMouseEnter={function(ev) { ev.currentTarget.style.background = '#334155'; }}
          onMouseLeave={function(ev) { ev.currentTarget.style.background = 'transparent'; }}>‹</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#F1F5F9' }}>{MONTH_NAMES[viewMonth]} {viewYear}</div>
        <div onClick={nextMonth}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #475569', borderRadius: 6, color:T.textPrimary, fontSize: 16, cursor: 'pointer', userSelect: 'none' }}
          onMouseEnter={function(ev) { ev.currentTarget.style.background = '#334155'; }}
          onMouseLeave={function(ev) { ev.currentTarget.style.background = 'transparent'; }}>›</div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, ' + CELL + 'px)', gap: 2 }}>
        {DAY_HEADERS.map(function(dh) {
          return <div key={dh} style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748B', fontWeight: 500 }}>{dh}</div>;
        })}

        {/* Day cells */}
        {cells.map(function(day, i) {
          if (day === null) return <div key={'e' + i} style={{ height: CELL }} />;
          var mm = String(viewMonth + 1).padStart(2, '0');
          var dd = String(day).padStart(2, '0');
          var dateStr = viewYear + '-' + mm + '-' + dd;
          var isSelected = dateStr === selectedStr;
          var isToday = dateStr === new Date().toISOString().slice(0, 10);

          return (
            <div key={day} onClick={function() { pickDay(day); }}
              style={{
                height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: isSelected ? 600 : 400, cursor: 'pointer', borderRadius: 8, userSelect: 'none',
                background: isSelected ? T.accent : 'transparent',
                color: isSelected ? '#fff' : (isToday ? T.blueLight : '#E2E8F0'),
                border: isToday && !isSelected ? '1px solid #60A5FA' : '1px solid transparent',
                transition: 'background 100ms',
              }}
              onMouseEnter={function(ev) { if (!isSelected) ev.currentTarget.style.background = '#334155'; }}
              onMouseLeave={function(ev) { if (!isSelected) ev.currentTarget.style.background = 'transparent'; }}>
              {day}
            </div>
          );
        })}
      </div>
      {/* Selected date display */}
      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: value ? '#F1F5F9' : '#64748B', fontWeight: 500 }}>
        {value ? (new Date(value + 'T00:00').getMonth() + 1) + '-' + new Date(value + 'T00:00').getDate() + '-' + new Date(value + 'T00:00').getFullYear() : 'Select a date'}
      </div>
    </div>
  );
}
