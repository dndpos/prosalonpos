/**
 * useCheckoutItems.js — Item, discount, tip, and payment handlers
 * Extracted from CheckoutScreen.jsx (Session C9) to stay under 800-line cap.
 *
 * Manages: add/remove items, price edits, item discounts, ticket discounts,
 * tip, payment methods, membership renew/cancel, combine tickets, buildAndClose.
 */
import { useRef } from 'react';
import { CHECKOUT_STAFF } from './checkoutBridge';
import { numpadToCents } from './checkoutHelpers';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';

export default function useCheckoutItems(opts) {
  var rbac = useRBAC();
  var {
    items, setItems, activeTechId, setActiveTechId,
    discounts, setDiscounts, discountType, setDiscountType, discountValue, setDiscountValue, setShowDiscountForm,
    tipAmount, setTipAmount, tipInput, setTipInput, setShowTipForm, setTipDistributions, setShowTipDist, setTipAutoRemoved,
    tipDistributions, techs,
    payMethod, setPayMethod, payInput, setPayInput, payments, setPayments,
    setGcLookup, setGcCodeInput, setGcError,
    editingId, setEditingId, editPrice, setEditPrice, editMode, setEditMode, editDiscType, setEditDiscType,
    serviceOverrides, setServiceOverrides, itemDiscounts, setItemDiscounts,
    packageRedemptions, applyPackageToItem, removePackageFromItem,
    client, setClient, setDepositCents, setShowClientLookup,
    settings, onCashPayment, totalBeforeTip, canAdjust,
    isReopened, reopenedTicketId, reopenedTicketNumber, alreadyPaidCents, originalPayments, displayNumber,
    appointmentData, onCloseTicket, onDone, nextTicketNumber,
    getPrice, subtotalBefore, allDiscounts, taxAmount, effectiveTotal, itemDiscTotal, pkgRedeemTotal,
    tipAutoRemoved, depositCents,
    membershipBanner, setMembershipBanner, setClientMembership, _memStore,
    confirmRemove, setConfirmRemove,
  } = opts;

  function handleAddItem(item) {
    if (item.type === 'retail') {
      setItems(function(prev) {
        var ex = prev.find(function(i) { return i.id === item.id && i.type === 'retail' && i.techId === (activeTechId || null); });
        if (ex) return prev.map(function(i) { return i === ex ? Object.assign({}, i, { qty: (i.qty || 1) + 1 }) : i; });
        var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
        return prev.concat([Object.assign({}, item, { qty: 1, techId: activeTechId || null, tech: tech ? tech.display_name : null })]);
      });
    } else {
      var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
      var lineId = item.open_price ? (item.id + '-' + Date.now()) : item.id;
      var newItem = Object.assign({}, item, { id: lineId, techId: activeTechId, tech: tech ? tech.display_name : '—' });
      setItems(function(prev) { return prev.concat([newItem]); });
      if (item.open_price && (item.price_cents === 0 || !item.price_cents)) {
        setTimeout(function() { setEditingId(lineId); setEditPrice(''); setEditMode('price'); setEditDiscType('flat'); }, 50);
      }
    }
  }

  function handleAddGiftCard(cents, cardNumber) {
    var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
    setItems(function(prev) { return prev.concat([{ id: 'gc-' + Date.now(), type: 'giftcard', name: 'Gift Card (' + cardNumber + ')', price_cents: cents, techId: activeTechId, tech: tech ? tech.display_name : null, cardNumber: cardNumber }]); });
  }

  function handleSellPackage(pkg, pkgItems) {
    var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
    setItems(function(prev) { return prev.concat([{
      id: 'pkg-sale-' + Date.now(), type: 'package_sale',
      name: '📦 ' + pkg.name, price_cents: pkg.price_cents,
      techId: activeTechId, tech: tech ? tech.display_name : null,
      packageId: pkg.id, packageItems: pkgItems, color: '#8B5CF6',
    }]); });
  }

  function handleSellMembership(plan) {
    var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
    setItems(function(prev) { return prev.concat([{
      id: 'mem-sale-' + Date.now(), type: 'membership_sale',
      name: '🎫 ' + plan.name, price_cents: plan.price_cents,
      techId: activeTechId, tech: tech ? tech.display_name : null,
      planId: plan.id, color: '#EC4899',
    }]); });
  }

  function removeItem(id) {
    if (packageRedemptions[id]) removePackageFromItem(id);
    setItems(function(prev) { return prev.filter(function(i) { return i.id !== id; }); });
    setConfirmRemove(null);
  }

  function handleAddTech(tech) { setActiveTechId(tech.id); }
  function handleClientSelect(c) { setClient(c); setShowClientLookup(false); }

  function startEdit(it) {
    if (!canAdjust) return;
    rbac.requirePermission(ACTIONS.EDIT_PRICES_CHECKOUT, function() {
      setEditingId(it.id); setEditPrice(''); setEditMode('price'); setEditDiscType('flat');
    });
  }

  function switchToDiscountMode() {
    rbac.requirePermission(ACTIONS.APPLY_DISCOUNTS, function() { setEditMode('discount'); });
  }

  function confirmEdit() {
    if (editMode === 'price') {
      var cents = numpadToCents(editPrice, settings.numpad_mode);
      if (cents <= 0) return;
      setServiceOverrides(function(prev) { var o = Object.assign({}, prev); o[editingId] = cents; return o; });
      setEditingId(null); setEditPrice('');
    } else {
      var item = items.find(function(i) { return i.id === editingId; });
      if (!item) return;
      if (editDiscType === 'flat') {
        var off = numpadToCents(editPrice, settings.numpad_mode);
        if (off <= 0) return;
        setItemDiscounts(function(prev) { var o = Object.assign({}, prev); o[editingId] = { type: 'flat', value: off, desc: '$' + (off / 100).toFixed(2) + ' off' }; return o; });
      } else {
        var pct = parseFloat(editPrice);
        if (!pct || pct <= 0) return;
        setItemDiscounts(function(prev) { var o = Object.assign({}, prev); o[editingId] = { type: 'pct', value: pct, desc: pct + '% off' }; return o; });
      }
      setEditingId(null); setEditPrice('');
    }
  }

  function cancelEdit() { setEditingId(null); setEditPrice(''); }

  function applyEditPreset(val) {
    var item = items.find(function(i) { return i.id === editingId; });
    if (!item) return;
    if (editDiscType === 'flat') {
      setItemDiscounts(function(prev) { var o = Object.assign({}, prev); o[editingId] = { type: 'flat', value: val, desc: '$' + (val / 100).toFixed(2) + ' off' }; return o; });
    } else {
      setItemDiscounts(function(prev) { var o = Object.assign({}, prev); o[editingId] = { type: 'pct', value: val, desc: val + '% off' }; return o; });
    }
    setEditingId(null); setEditPrice('');
  }

  function openDiscount() {
    rbac.requirePermission(ACTIONS.APPLY_DISCOUNTS, function() {
      setDiscountType(settings.discount_default_type || 'flat_total'); setDiscountValue(''); setShowDiscountForm(true);
    });
  }

  function applyDiscount() {
    if (discountType === 'flat_total') {
      var cents = numpadToCents(discountValue, settings.numpad_mode);
      if (cents <= 0) return;
      setDiscounts(function(prev) { return prev.concat([{ id: 'd-' + Date.now(), type: 'flat_total', value: cents, desc: '$' + (cents / 100).toFixed(2) + ' off' }]); });
    } else {
      var pct = parseFloat(discountValue);
      if (!pct || pct <= 0) return;
      setDiscounts(function(prev) { return prev.concat([{ id: 'd-' + Date.now(), type: 'pct_total', value: pct, desc: pct + '% off' }]); });
    }
    setShowDiscountForm(false); setDiscountValue('');
  }

  function applyDiscountPreset(val) {
    if (discountType === 'flat_total') {
      setDiscounts(function(prev) { return prev.concat([{ id: 'd-' + Date.now(), type: 'flat_total', value: val, desc: '$' + (val / 100).toFixed(2) + ' off' }]); });
    } else {
      setDiscounts(function(prev) { return prev.concat([{ id: 'd-' + Date.now(), type: 'pct_total', value: val, desc: val + '% off' }]); });
    }
    setShowDiscountForm(false); setDiscountValue('');
  }

  function removeDiscount(id) { setDiscounts(function(prev) { return prev.filter(function(d) { return d.id !== id; }); }); }

  function handlePayAmount() {
    var cents = numpadToCents(payInput, settings.numpad_mode);
    if (cents <= 0) return;
    setPayments(function(prev) { return prev.concat([{ method: payMethod, amount_cents: cents }]); });
    if (payMethod === 'cash' && onCashPayment) onCashPayment(cents);
    setPayMethod(null); setPayInput('');
  }

  function removePayment(idx) { setPayments(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); }); }

  function openTip() { setTipInput(''); setShowTipForm(true); setTipAutoRemoved(false); }
  function applyTipPreset(pct) { setTipAmount(Math.round(totalBeforeTip * pct / 100)); setShowTipForm(false); if (techs.length > 1) setShowTipDist(true); }
  function applyTipCustom() {
    var cents = numpadToCents(tipInput, settings.numpad_mode);
    if (cents <= 0) return;
    setTipAmount(cents); setShowTipForm(false); setTipInput('');
    if (techs.length > 1) setShowTipDist(true);
  }
  function clearTip() { setTipAmount(0); setShowTipForm(false); setTipDistributions(null); }

  async function handleCombine(ticketId) {
    var currentId = appointmentData ? appointmentData.openTicketId : null;
    if (!currentId || !ticketId) return;
    try {
      var mergedTicket = await useTicketStore.getState().mergeTickets([currentId, ticketId]);
      setItems(mergedTicket.items.map(function(it) { return Object.assign({}, it, { type: it.type || 'service' }); }));
      if (mergedTicket.depositCents) setDepositCents(mergedTicket.depositCents || 0);
      if (!client && mergedTicket.client_id) {
        setClient({ id: mergedTicket.client_id, name: mergedTicket.clientName });
      }
    } catch (err) {
      console.warn('[handleCombine] Merge failed:', err.message);
    }
  }

  function buildAndClose(receiptMethod, dists) {
    var now = new Date();
    var ymd = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    var tNum = isReopened ? reopenedTicketNumber : (nextTicketNumber ? nextTicketNumber() : 1);
    var txnId = ymd + '-' + String(tNum).padStart(3, '0');
    var ticket = {
      id: isReopened ? reopenedTicketId : (appointmentData ? appointmentData.openTicketId : null) || ('tkt-' + Date.now()),
      reopenedTicketId: reopenedTicketId || null,
      reopenedPaymentMethod: isReopened && originalPayments.length > 0 ? originalPayments[0].method : null,
      ticketNumber: tNum, txnId: txnId,
      clientName: client ? ((client.first_name || '') + ' ' + (client.last_name || '')).trim() : null,
      client: client,
      items: items.map(function(it) { var p = getPrice(it); return Object.assign({}, it, { price_cents: p, original_price_cents: it.original_price_cents || it.price_cents || p }); }),
      discounts: discounts.slice(), payments: payments.slice(), tipCents: tipAmount,
      itemDiscounts: Object.assign({}, itemDiscounts), itemDiscTotal: itemDiscTotal, pkgRedeemCents: pkgRedeemTotal,
      discountCents: allDiscounts,
      tipDistributions: dists || tipDistributions || null,
      tipDistributed: !!(dists || tipDistributions),
      tipAutoRemoved: tipAutoRemoved,
      subtotalCents: subtotalBefore, depositCents: isReopened ? alreadyPaidCents : depositCents,
      taxCents: taxAmount, totalCents: effectiveTotal, receiptMethod: receiptMethod,
      createdBy: (appointmentData ? appointmentData.createdBy : null) || activeTechId,
      closedAt: Date.now(), closedBy: activeTechId,
      appointmentId: appointmentData ? appointmentData.appointmentId : null,
      allAppointmentIds: appointmentData ? appointmentData.allAppointmentIds : null,
      serviceLineIds: appointmentData ? appointmentData.serviceLineIds : null,
      openTicketIds: appointmentData ? appointmentData.openTicketIds : null,
      displayNumber: displayNumber || null,
      packageRedemptions: Object.keys(packageRedemptions).length > 0 ? packageRedemptions : null,
    };
    if (onCloseTicket) onCloseTicket(ticket);
    onDone();
  }

  function handleMembershipRenew() {
    if (!membershipBanner) return;
    var b = membershipBanner;
    var tech = CHECKOUT_STAFF.find(function(s) { return s.id === activeTechId; });
    setItems(function(prev) { return prev.concat([{ id: 'mem-renew-' + Date.now(), type: 'membership_sale', name: '🎫 ' + b.plan.name + ' (' + b.cycles + ' cycle' + (b.cycles > 1 ? 's' : '') + ')', price_cents: b.totalOwed, techId: activeTechId, tech: tech ? tech.display_name : null, planId: b.plan.id, membershipId: b.membershipId, isRenewal: true, color: '#EC4899' }]); });
    setMembershipBanner(null);
  }

  function handleMembershipCancel() {
    if (!membershipBanner) return;
    rbac.requirePermission(ACTIONS.MANAGE_STAFF, function() {
      _memStore.update(membershipBanner.membershipId, { status: 'cancelled' }).then(function() { setMembershipBanner(null); setClientMembership(null); });
    });
  }

  return {
    handleAddItem: handleAddItem, handleAddGiftCard: handleAddGiftCard,
    handleSellPackage: handleSellPackage, handleSellMembership: handleSellMembership,
    removeItem: removeItem, handleAddTech: handleAddTech, handleClientSelect: handleClientSelect,
    startEdit: startEdit, switchToDiscountMode: switchToDiscountMode,
    confirmEdit: confirmEdit, cancelEdit: cancelEdit, applyEditPreset: applyEditPreset,
    openDiscount: openDiscount, applyDiscount: applyDiscount,
    applyDiscountPreset: applyDiscountPreset, removeDiscount: removeDiscount,
    handlePayAmount: handlePayAmount, removePayment: removePayment,
    openTip: openTip, applyTipPreset: applyTipPreset, applyTipCustom: applyTipCustom, clearTip: clearTip,
    handleCombine: handleCombine, buildAndClose: buildAndClose,
    handleMembershipRenew: handleMembershipRenew, handleMembershipCancel: handleMembershipCancel,
  };
}
