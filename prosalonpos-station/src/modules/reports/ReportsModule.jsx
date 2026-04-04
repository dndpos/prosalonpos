import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
import { useState, useMemo, useEffect } from 'react';
import { getStaffName, PAYMENT_LABELS, PAYMENT_COLORS } from './reportsUtils';

import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { fmt } from '../../lib/formatUtils';

// Reports Module — Daily closeout report. S85: wired to ticketStore. S111: void/refund tracking.
// Reshape a closed ticket from ticketStore into the report format
function reshapeTicket(ticket) {
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
  var svcTotal = services.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var prodTotal = products.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var pkgTotal = packageItems.reduce(function(s, v) { return s + v.price_cents; }, 0);
  var memTotal = membershipItems.reduce(function(s, v) { return s + v.price_cents; }, 0);

  // Determine primary payment method from payments array
  var payments = ticket.payments || [];
  var payMethod = 'credit';
  if (payments.length > 0) {
    // Use whichever method covers the most amount
    var methodTotals = {};
    payments.forEach(function(p) {
      var m = p.method || 'credit';
      if (m === 'giftcard') m = 'gift';
      methodTotals[m] = (methodTotals[m] || 0) + (p.amount_cents || 0);
    });
    var best = 'credit';
    var bestAmt = 0;
    Object.keys(methodTotals).forEach(function(m) {
      if (methodTotals[m] > bestAmt) { best = m; bestAmt = methodTotals[m]; }
    });
    payMethod = best;
  }

  // Determine staff_id — first service item's techId, or createdBy
  var staffId = '';
  var firstService = items.find(function(it) { return it.type === 'service' && it.techId; });
  if (firstService) staffId = firstService.techId;
  else staffId = ticket.createdBy || ticket.closedBy || '';

  // Date from closedAt (can be timestamp or ISO string)
  var dateStr = '';
  if (ticket.closedAt) {
    var d = new Date(ticket.closedAt);
    if (!isNaN(d.getTime())) {
      dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }
  if (!dateStr && ticket.created_at) {
    var d2 = new Date(ticket.created_at);
    if (!isNaN(d2.getTime())) {
      dateStr = d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0') + '-' + String(d2.getDate()).padStart(2, '0');
    }
  }

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
    tip_cents: ticket.tipCents || ticket.tip_cents || 0,
    payment_method: payMethod,
    service_total: svcTotal,
    product_total: prodTotal,
    package_total: pkgTotal,
    membership_total: memTotal,
    subtotal: svcTotal + prodTotal + pkgTotal + memTotal,
  };
}

// For multi-tech tickets, split into one report entry per tech
function reshapeTicketsByTech(ticket) {
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

  // Multiple techs — split the ticket. Retail, packages, memberships go to the primary tech (createdBy).
  var products = items.filter(function(it) { return it.type === 'retail'; });
  var packageItems = items.filter(function(it) { return it.type === 'package_sale'; });
  var membershipItems = items.filter(function(it) { return it.type === 'membership_sale'; });
  var payments = ticket.payments || [];
  var payMethod = 'credit';
  if (payments.length > 0) {
    var methodTotals = {};
    payments.forEach(function(p) {
      var m = p.method || 'credit';
      if (m === 'giftcard') m = 'gift';
      methodTotals[m] = (methodTotals[m] || 0) + (p.amount_cents || 0);
    });
    var best = 'credit'; var bestAmt = 0;
    Object.keys(methodTotals).forEach(function(m) {
      if (methodTotals[m] > bestAmt) { best = m; bestAmt = methodTotals[m]; }
    });
    payMethod = best;
  }

  var dateStr = '';
  if (ticket.closedAt) {
    var d = new Date(ticket.closedAt);
    if (!isNaN(d.getTime())) dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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
      tip_cents: tipShare,
      payment_method: payMethod,
      service_total: svcTotal,
      product_total: prodTotal,
      package_total: pkgTotal,
      membership_total: memTotal,
      subtotal: svcTotal + prodTotal + pkgTotal + memTotal,
    };
  });
}


// Quick date helpers
function shiftDate(dateStr, days) {
  var d = new Date(dateStr + 'T00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  var d = new Date(dateStr + 'T00:00');
  return (d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear();
}
function formatDateLong(dateStr) {
  var d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

var AVATAR_COLORS = ['#1E3A5F', '#064E3B', '#7C2D12', '#4C1D95', '#831843'];

// Default to today's date
var _todayStr = (function() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();

export default function ReportsModule() {
  var T = useTheme();
  var _settings = useSettingsStore(function(s) { return s.settings; });
  var _rptSalonName = (_settings && _settings.salon_name) || 'Your Salon';
  var _rptSalonAddr1 = (_settings && _settings.salon_address_line1) || '';
  var _rptSalonAddr2 = (_settings && _settings.salon_address_line2) || '';

  // Read from ticketStore — API only
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var ticketSource = useTicketStore(function(s) { return s.source; });

  var [startDate, setStartDate] = useState(_todayStr);
  var [endDate, setEndDate] = useState(_todayStr);
  var [showRangePicker, setShowRangePicker] = useState(false);
  var [pickerStart, setPickerStart] = useState('');
  var [pickerEnd, setPickerEnd] = useState('');
  var [viewTab, setViewTab] = useState('daily'); // 'daily' | 'products'
  var [expandedTech, setExpandedTech] = useState(null); // staff_id or null
  var isRange = startDate !== endDate;

  // Arrow navigation — shift both dates by 1 day together
  function goLeft() {
    setStartDate(function(s) { return shiftDate(s, -1); });
    setEndDate(function(e) { return shiftDate(e, -1); });
  }
  function goRight() {
    setStartDate(function(s) { return shiftDate(s, 1); });
    setEndDate(function(e) { return shiftDate(e, 1); });
  }

  // Open range picker
  function openPicker() {
    setPickerStart(startDate);
    setPickerEnd(endDate);
    setShowRangePicker(true);
  }
  function applyRange() {
    if (pickerStart && pickerEnd) {
      var s = pickerStart <= pickerEnd ? pickerStart : pickerEnd;
      var e = pickerStart <= pickerEnd ? pickerEnd : pickerStart;
      setStartDate(s);
      setEndDate(e);
    }
    setShowRangePicker(false);
  }

  var range = { start: startDate, end: endDate };

  // Fetch tickets when date range changes
  useEffect(function() {
    fetchTickets(startDate, endDate);
  }, [startDate, endDate]);

  // Build report tickets from closed tickets
  var REPORT_TICKETS = useMemo(function() {
    var result = [];
    closedTickets.forEach(function(t) {
      var entries = reshapeTicketsByTech(t);
      entries.forEach(function(e) { result.push(e); });
    });
    return result;
  }, [closedTickets]);

  // Filter tickets for the range — include ALL statuses (paid, voided, refunded)
  var filtered = useMemo(function() {
    return REPORT_TICKETS.filter(function(t) {
      return t.date >= range.start && t.date <= range.end;
    });
  }, [range.start, range.end, REPORT_TICKETS]);

  // Separate by status
  var paidTickets = filtered.filter(function(t) { return !t.voided; });
  var voidedTickets = filtered.filter(function(t) { return t.voided; });

  // ── Compute totals from PAID tickets (gross sales) ──
  var totalServiceSales = 0;
  var totalProductSales = 0;
  var totalPackageSales = 0;
  var totalMembershipSales = 0;
  var totalTips = 0;
  var paymentTotals = { cash: 0, credit: 0, gift: 0, zelle: 0 };
  var ticketCount = paidTickets.length;

  paidTickets.forEach(function(t) {
    totalServiceSales += t.service_total;
    totalProductSales += t.product_total;
    totalPackageSales += (t.package_total || 0);
    totalMembershipSales += (t.membership_total || 0);
    totalTips += t.tip_cents;
    if (paymentTotals[t.payment_method] !== undefined) {
      paymentTotals[t.payment_method] += t.subtotal;
    }
  });

  // ── Void & Refund totals ──
  var totalVoided = 0;
  var voidCount = voidedTickets.length;
  voidedTickets.forEach(function(t) { totalVoided += t.subtotal; });

  var totalRefunded = 0;
  var refundCount = 0;
  paidTickets.forEach(function(t) {
    if (t.refundCents > 0) {
      totalRefunded += t.refundCents;
      refundCount++;
    }
  });

  var totalSales = totalServiceSales + totalProductSales + totalPackageSales + totalMembershipSales;
  var grandTotal = totalSales + totalTips;
  var netTotal = grandTotal - totalVoided - totalRefunded;

  // ── Tech breakdown (paid only) ──
  var techMap = {};
  paidTickets.forEach(function(t) {
    if (!techMap[t.staff_id]) techMap[t.staff_id] = { sales: 0, tips: 0, tickets: 0 };
    techMap[t.staff_id].sales += t.subtotal;
    techMap[t.staff_id].tips += t.tip_cents;
    techMap[t.staff_id].tickets++;
  });
  var techRows = Object.keys(techMap).map(function(sid) {
    return { staff_id: sid, name: getStaffName(sid), sales: techMap[sid].sales, tips: techMap[sid].tips, total: techMap[sid].sales + techMap[sid].tips, tickets: techMap[sid].tickets };
  }).sort(function(a, b) { return b.sales - a.sales; }); // highest sales first

  // ── Product breakdown (paid only) ──
  var productMap = {};
  paidTickets.forEach(function(t) {
    (t.products || []).forEach(function(p) {
      if (!productMap[p.name]) productMap[p.name] = { name: p.name, qty: 0, revenue: 0 };
      productMap[p.name].qty++;
      productMap[p.name].revenue += p.price_cents;
    });
  });
  var productRows = Object.values(productMap).sort(function(a, b) { return b.revenue - a.revenue; });

  // ── Range label ──
  var dateDisplay = isRange
    ? formatDate(startDate) + '  →  ' + formatDate(endDate)
    : formatDate(startDate);

  // ══════════════════════════════════
  // RENDER
  // ══════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
        <AreaTag id="RP" />
      {/* Top bar: date picker centered */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px', borderBottom: '1px solid ' + T.borderLight, background: T.chromeDark, flexShrink: 0, position: 'relative' }}>
        {/* Tab buttons — top left */}
        <div style={{ position: 'absolute', left: 20, display: 'flex', gap: 0 }}>
          {[{ key: 'daily', label: 'Daily Report', bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' }, { key: 'products', label: 'Product Sale', bg:'#3D2608', text:'#FBB040', border:'#5C3A10' }].map(function(tab, i) {
            var isAct = viewTab === tab.key;
            return (
              <div key={tab.key} onClick={function() { setViewTab(tab.key); }}
                style={{
                  height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: isAct ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none',
                  background: tab.bg,
                  color: tab.text,
                  border: (isAct ? '2px' : '1px') + ' solid ' + tab.border,
                  borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
                  borderLeft: i === 0 ? undefined : 'none',
                }}
                onMouseEnter={function(e) { if (!isAct) { e.currentTarget.style.borderWidth = '2px'; } }}
                onMouseLeave={function(e) { if (!isAct) { e.currentTarget.style.borderWidth = '1px'; } }}>{tab.label}</div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Left arrow */}
          <div onClick={goLeft}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.textSecondary, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>‹</div>

          {/* Date display — tap to open range picker */}
          <div onClick={openPicker}
            style={{ padding: '6px 20px', background: T.grid, border: '1px solid ' + T.border, borderRadius: 6, cursor: 'pointer', userSelect: 'none', transition: 'background 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.gridHover; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: T.text, textAlign: 'center', whiteSpace: 'nowrap' }}>{dateDisplay}</div>
            <div style={{ fontSize: 11, color: T.text, textAlign: 'center', marginTop: 2 }}>Tap to set range</div>
          </div>

          {/* Right arrow */}
          <div onClick={goRight}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.textSecondary, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>›</div>

          {/* Today button */}
          <div onClick={function() { setStartDate(DEFAULT_DATE); setEndDate(DEFAULT_DATE); }}
            style={{ height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none', marginLeft: 4 }}
            onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>Today</div>
        </div>

        {/* Print button — top right */}
        <div onClick={function() { window.print(); }}
          style={{ position: 'absolute', right: 20, height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid ' + T.border, borderRadius: 6, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none' }}
          onMouseEnter={function(e) { e.currentTarget.style.background = T.grid; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>🖨️ Print</div>
      </div>

      {/* ── Range picker popup — two visual calendars ── */}
      {showRangePicker && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={function(e) { if (e.target === e.currentTarget) setShowRangePicker(false); }}>
          <div style={{ background: T.surface, borderRadius: 12, padding: 28, border: '1px solid ' + T.border }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: T.text, marginBottom: 20, textAlign: 'center' }}>Select Date Range</div>
            <div style={{ display: 'flex', gap: 32 }}>
              <CalendarPicker label="From" value={pickerStart} onChange={setPickerStart} />
              <CalendarPicker label="To" value={pickerEnd} onChange={setPickerEnd} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <div onClick={function() { setShowRangePicker(false); }}
                style={{ padding: '8px 20px', background: 'transparent', color: T.textSecondary, border: '1px solid ' + T.border, borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Cancel</div>
              <div onClick={applyRange}
                style={{ padding: '8px 20px', background: T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Apply</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAT CARDS ═══ */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 20px 0', flexShrink: 0 }}>
        {[
          { label: 'Gross Sales', value: fmt(totalSales), color: '#22C55E', icon: '💰' },
          { label: 'Voids / Refunds', value: fmt(totalVoided + totalRefunded), color: '#EF4444', icon: '🚫' },
          { label: 'Net Sales', value: fmt(totalSales - totalVoided - totalRefunded), color: '#38BDF8', icon: '📊' },
          { label: 'Tickets', value: String(ticketCount) + (voidCount > 0 ? ' (' + voidCount + ' void)' : ''), color: '#F59E0B', icon: '🎫' },
        ].map(function(card) {
          return (
            <div key={card.label} style={{ flex: 1, background: 'linear-gradient(135deg, ' + card.color + '15, ' + card.color + '08)', border: '1px solid ' + card.color + '30', borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 8, right: 12, fontSize: 22, opacity: 0.3 }}>{card.icon}</div>
              <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color, fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Two-panel layout */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 940 }}>

        {/* ═══ LEFT PANEL: Receipt-style closeout ═══ */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            {/* Receipt header */}
            <div style={{ textAlign: 'center', padding: '24px 24px 18px', background: 'linear-gradient(180deg, #1E293B, #0F172A)', borderBottom: '1px dashed #334155' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.02em' }}>{_rptSalonName}</div>
              {_rptSalonAddr1 && <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>{_rptSalonAddr1}</div>}
              {_rptSalonAddr2 && <div style={{ fontSize: 11, color: '#64748B' }}>{_rptSalonAddr2}</div>}
              <div style={{ display: 'inline-block', marginTop: 10, padding: '3px 14px', background: '#1E293B', borderRadius: 20, border: '1px solid #334155' }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{viewTab === 'products' ? 'PRODUCT SALE REPORT' : 'DAILY REPORT'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 500, marginTop: 8 }}>{dateDisplay}</div>
            </div>

            {viewTab === 'daily' ? (
              <>
                {/* Sales breakdown */}
                <div style={{ padding: '18px 24px', borderBottom: '1px dashed #334155' }}>
                  <ReceiptLine label="Service Sales" value={fmt(totalServiceSales)} />
                  <ReceiptLine label="Product Sales" value={fmt(totalProductSales)} />
                  {totalPackageSales > 0 && <ReceiptLine label="Package Sales" value={fmt(totalPackageSales)} />}
                  {totalMembershipSales > 0 && <ReceiptLine label="Membership Sales" value={fmt(totalMembershipSales)} />}
                  <div style={{ height: 1, background: '#1E293B', margin: '10px 0' }} />
                  <ReceiptLine label="GROSS SALES" value={fmt(totalSales)} bold />
                  <ReceiptLine label="Tips Collected" value={fmt(totalTips)} />
                  <div style={{ height: 1, background: '#1E293B', margin: '10px 0' }} />
                  <ReceiptLine label="GROSS TOTAL" value={fmt(grandTotal)} bold large color="#22C55E" />
                </div>

                {/* Voids & Refunds section */}
                {(totalVoided > 0 || totalRefunded > 0) && (
                  <div style={{ padding: '18px 24px', borderBottom: '1px dashed #334155' }}>
                    <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Voids & Refunds</div>
                    {totalVoided > 0 && <ReceiptLine label={'Voided (' + voidCount + ' ticket' + (voidCount !== 1 ? 's' : '') + ')'} value={'\u2212' + fmt(totalVoided)} color="#EF4444" />}
                    {totalRefunded > 0 && <ReceiptLine label={'Refunded (' + refundCount + ' ticket' + (refundCount !== 1 ? 's' : '') + ')'} value={'\u2212' + fmt(totalRefunded)} color="#F59E0B" />}
                    <div style={{ height: 1, background: '#1E293B', margin: '10px 0' }} />
                    <ReceiptLine label="NET TOTAL" value={fmt(netTotal)} bold large color="#38BDF8" />
                  </div>
                )}

                {/* Payment method breakdown */}
                <div style={{ padding: '18px 24px', borderBottom: '1px dashed #334155' }}>
                  <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Payment Breakdown</div>
                  {['cash', 'credit', 'gift', 'zelle'].map(function(method) {
                    var amount = paymentTotals[method];
                    if (amount === 0) return null;
                    var pct = totalSales > 0 ? Math.round(amount / totalSales * 100) : 0;
                    return (
                      <div key={method} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: '#E2E8F0' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PAYMENT_COLORS[method], marginRight: 8 }} />
                            {PAYMENT_LABELS[method]}
                          </span>
                          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(amount)}</span>
                        </div>
                        <div style={{ height: 6, background: '#1E293B', borderRadius: 3 }}>
                          <div style={{ height: 6, background: PAYMENT_COLORS[method], borderRadius: 3, width: pct + '%', transition: 'width 300ms' }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', textAlign: 'right', marginTop: 2 }}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>

                {/* Stats */}
                <div style={{ padding: '18px 24px' }}>
                  <ReceiptLine label="Total Tickets" value={String(ticketCount)} />
                  <ReceiptLine label="Avg Ticket" value={ticketCount > 0 ? fmt(Math.round(totalSales / ticketCount)) : '$0.00'} />
                  <ReceiptLine label="Days in Range" value={String(new Set(paidTickets.map(function(t) { return t.date; })).size)} />
                </div>
              </>
            ) : (
              <>
                {/* Product sale summary */}
                <div style={{ padding: '18px 24px', borderBottom: '1px dashed #334155' }}>
                  <ReceiptLine label="Total Products Sold" value={String(productRows.reduce(function(s, p) { return s + p.qty; }, 0))} />
                  <ReceiptLine label="Unique Products" value={String(productRows.length)} />
                  <div style={{ height: 1, background: '#1E293B', margin: '10px 0' }} />
                  <ReceiptLine label="PRODUCT REVENUE" value={fmt(totalProductSales)} bold large color="#22C55E" />
                </div>

                {/* Product list on receipt */}
                <div style={{ padding: '18px 24px' }}>
                  <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Items Sold</div>
                  {productRows.length === 0 ? (
                    <div style={{ color: '#64748B', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No products sold</div>
                  ) : (
                    productRows.map(function(p) {
                      return (
                        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                          <span style={{ fontSize: 13, color: '#94A3B8' }}>{p.name} ×{p.qty}</span>
                          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.revenue)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '14px 24px 20px', borderTop: '1px dashed #334155' }}>
              <div style={{ fontSize: 10, color: '#475569' }}>Generated {new Date().toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Pro Salon POS · Report #{range.start.replace(/-/g, '')}</div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL: Tech breakdown / Products ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid #1E293B', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>

            {viewTab === 'daily' ? (
              <>
                {/* Tech header — fixed */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', padding: '14px 20px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #1E293B', background: '#0B1120', flexShrink: 0 }}>
                  <span>Technician</span>
                  <span style={{ textAlign: 'right' }}>Sales</span>
                  <span style={{ textAlign: 'right' }}>Tips</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>

                {/* Tech rows — scrollable */}
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {techRows.map(function(row, i) {
                  var pctOfSales = totalSales > 0 ? Math.round(row.sales / totalSales * 100) : 0;
                  var isExpanded = expandedTech === row.staff_id;
                  var techTickets = isExpanded ? filtered.filter(function(t) { return t.staff_id === row.staff_id; }) : [];
                  var barColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

                  return (
                    <div key={row.staff_id}>
                      <div onClick={function() { setExpandedTech(isExpanded ? null : row.staff_id); }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', padding: '14px 20px', borderBottom: '1px solid #1E293B', alignItems: 'center', cursor: 'pointer', background: isExpanded ? '#1E293B' : 'transparent', transition: 'background 150ms' }}
                        onMouseEnter={function(e) { if (!isExpanded) e.currentTarget.style.background = '#162032'; }}
                        onMouseLeave={function(e) { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 3, height: 36, borderRadius: 2, background: barColor, flexShrink: 0 }} />
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1F5F9', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                            {row.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: '#F1F5F9', fontWeight: 500 }}>{row.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                              <span style={{ fontSize: 11, color: '#64748B' }}>{row.tickets} ticket{row.tickets !== 1 ? 's' : ''}</span>
                              <div style={{ width: 60, height: 4, background: '#1E293B', borderRadius: 2 }}>
                                <div style={{ height: 4, background: barColor, borderRadius: 2, width: pctOfSales + '%', minWidth: pctOfSales > 0 ? 4 : 0 }} />
                              </div>
                              <span style={{ fontSize: 10, color: '#64748B' }}>{pctOfSales}%</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 14, color: '#64748B', marginLeft: 'auto', marginRight: 4 }}>{isExpanded ? '▾' : '▸'}</span>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 14, color: '#E2E8F0', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.sales)}</div>
                        <div style={{ textAlign: 'right', fontSize: 14, color: '#38BDF8', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.tips)}</div>
                        <div style={{ textAlign: 'right', fontSize: 15, color: '#22C55E', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.total)}</div>
                      </div>

                      {/* ── Expanded: ticket detail ── */}
                      {isExpanded && techTickets.length > 0 && (
                        <div style={{ background: '#162032', borderBottom: '1px solid #1E293B', padding: '8px 20px 12px 67px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', padding: '6px 0', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #1E293B' }}>
                            <span>Services</span>
                            <span style={{ textAlign: 'right' }}>Amount</span>
                            <span style={{ textAlign: 'right' }}>Tip</span>
                            <span style={{ textAlign: 'right' }}>Payment</span>
                          </div>
                          {techTickets.map(function(tkt, ti) {
                            var svcNames = tkt.services.map(function(s) { return s.name; }).join(', ');
                            if (tkt.products.length > 0) svcNames += ' + ' + tkt.products.map(function(p) { return p.name; }).join(', ');
                            return (
                              <div key={tkt.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', padding: '8px 0', borderBottom: ti < techTickets.length - 1 ? '1px solid #1E293B' : 'none', alignItems: 'center' }}>
                                <div style={{ fontSize: 12, color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{svcNames}</div>
                                <div style={{ textAlign: 'right', fontSize: 12, color: '#E2E8F0', fontVariantNumeric: 'tabular-nums' }}>{fmt(tkt.subtotal)}</div>
                                <div style={{ textAlign: 'right', fontSize: 12, color: tkt.tip_cents > 0 ? '#38BDF8' : '#475569', fontVariantNumeric: 'tabular-nums' }}>{tkt.tip_cents > 0 ? fmt(tkt.tip_cents) : '—'}</div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: PAYMENT_COLORS[tkt.payment_method] + '20', color: PAYMENT_COLORS[tkt.payment_method], fontWeight: 500 }}>
                                    {PAYMENT_LABELS[tkt.payment_method]}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {/* Tech totals — pinned at bottom */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', padding: '14px 20px', borderTop: '2px solid #334155', background: '#0B1120', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>TOTAL ({techRows.length} tech{techRows.length !== 1 ? 's' : ''})</span>
                  <span style={{ textAlign: 'right', fontSize: 15, color: '#F1F5F9', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalSales)}</span>
                  <span style={{ textAlign: 'right', fontSize: 15, color: '#38BDF8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalTips)}</span>
                  <span style={{ textAlign: 'right', fontSize: 16, color: '#22C55E', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</span>
                </div>
              </>
            ) : (
              <>
                {/* Product header — fixed */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', padding: '14px 20px', fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #1E293B', background: '#0B1120', flexShrink: 0 }}>
                  <span>Product</span>
                  <span style={{ textAlign: 'right' }}>Qty Sold</span>
                  <span style={{ textAlign: 'right' }}>Revenue</span>
                </div>

                {/* Product rows — scrollable */}
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {productRows.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>No products sold in this period</div>
                ) : (
                  productRows.map(function(row, i) {
                    return (
                      <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', padding: '14px 20px', borderBottom: i < productRows.length - 1 ? '1px solid #1E293B' : 'none', alignItems: 'center', transition: 'background 150ms' }}
                        onMouseEnter={function(e) { e.currentTarget.style.background = '#162032'; }}
                        onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ fontSize: 14, color: '#F1F5F9', fontWeight: 500 }}>{row.name}</div>
                        <div style={{ textAlign: 'right', fontSize: 14, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{row.qty}</div>
                        <div style={{ textAlign: 'right', fontSize: 15, color: '#22C55E', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.revenue)}</div>
                      </div>
                    );
                  })
                )}
                </div>

                {/* Product totals — pinned at bottom */}
                {productRows.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', padding: '14px 20px', borderTop: '2px solid #334155', background: '#0B1120', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>TOTAL ({productRows.length} products)</span>
                    <span style={{ textAlign: 'right', fontSize: 15, color: '#F1F5F9', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{productRows.reduce(function(s, p) { return s + p.qty; }, 0)}</span>
                    <span style={{ textAlign: 'right', fontSize: 16, color: '#22C55E', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalProductSales)}</span>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// ── Receipt line component ──
function ReceiptLine({ label, value, bold, large, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: large ? 14 : 13, color: color || (bold ? '#F1F5F9' : '#E2E8F0'), fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: large ? 16 : 13, color: color || (bold ? '#F1F5F9' : '#E2E8F0'), fontWeight: bold ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

// ── Calendar picker component ──
var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ label, value, onChange }) {
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
