import { useTheme } from '../../lib/ThemeContext';
import AreaTag from '../../components/ui/AreaTag';
/** Pro Salon POS — Checkout Screen. Module 2. Payment inline on receipt panel. Session 35: RBAC wiring. */
import { useState, useMemo, useEffect, useRef } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import CheckoutTabs from './CheckoutTabs';
import PaidScreen from './PaidScreen';
import TipDistribution from './TipDistribution';
import ClientLookupModal from './ClientLookupModal';
import CheckoutModals from './CheckoutModals';
import CheckoutPinScreen from './CheckoutPinScreen';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import useBarcodeScanner from './useBarcodeScanner';
import useCheckoutDrag from './useCheckoutDrag';
import useCheckoutCalc from './useCheckoutCalc';
import { relayPrint } from '../../lib/printRelay';
import { CHECKOUT_SETTINGS, CHECKOUT_STAFF, MOCK_RETAIL } from './checkoutBridge';
import { MOCK_GIFT_CARDS } from '../gift-cards/giftCardBridge';
import usePackageRedemption from './usePackageRedemption';
import ChangePaymentPopup from './ChangePaymentPopup';
import useMembershipPerks from './useMembershipPerks';
import { useClientStore } from '../../lib/stores/clientStore';
import { useTicketStore } from '../../lib/stores/ticketStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useMembershipStore } from '../../lib/stores/membershipStore';
import { usePackageStore } from '../../lib/stores/packageStore';
import { fmt, fp, numpadDisplay, numpadTap, numpadToCents, numpadToFloat, numpadKeys, cashQuickAmounts } from './checkoutHelpers';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';
function Av({name,size=28,index=0,photo=null}){
  var C = useTheme();
  var INP={height:38,background:'#283548',border:`1px solid ${C.borderMedium}`,borderRadius:6,padding:'0 10px',color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}
const TICKET_W = 300;
export default function CheckoutScreen({ appointmentData, onDone, onCloseTicket, openTickets, nextTicketNumber, catalogLayout, drawerSession, salonSettings, onCashPayment, canProcessPayments, onPrintHold }){
  var C = useTheme();
  var rbac = useRBAC();
  var storeClients = useClientStore(function(s) { return s.clients; });
  var storeServices = useServiceStore(function(s) { return s.services; });
  var canPay = canProcessPayments !== false; // default true
  var storeCloseTicket = useTicketStore(function(s) { return s.closeTicket; });
  function handleCancel() {
    if (isReopened && reopenedTicketId) {
      // Restore ticket to paid status — undo the reopen
      storeCloseTicket(reopenedTicketId, {}).catch(function(err) {
        console.warn('[CheckoutScreen] Cancel-reopen restore failed:', err.message);
      });
    }
    onDone();
  }
  const [depositCents, setDepositCents] = useState(appointmentData?.depositCents || 0);
  var isReopened = !!(appointmentData && appointmentData.reopened);
  var reopenedTicketId = appointmentData?.reopenedTicketId || null;
  var reopenedTicketNumber = appointmentData?.reopenedTicketNumber || null;
  var alreadyPaidCents = appointmentData?.alreadyPaidCents || 0; var originalPayments = appointmentData?.originalPayments || [];
  var displayNumber = appointmentData?.displayNumber || null; const hasCashier = !!appointmentData?.cashierStaff;
  const needsPin = !appointmentData || (appointmentData && !appointmentData.services && !hasCashier && !appointmentData.skipPin);
  const [screen, setScreen] = useState(needsPin ? 'pin' : 'main');
  const [client, setClient] = useState(appointmentData?.client || null);
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinMatch, setPinMatch] = useState(null);
  const initialItems = (appointmentData?.services || []).map(s=>({...s, type: s.type || 'service'}));
  const initialItemIds = useMemo(function(){ var m={}; initialItems.forEach(function(it){m[it.id]=true;}); return m; }, []);
  const [items, setItems] = useState(initialItems);
  const [discounts, setDiscounts] = useState(appointmentData?.originalTicket?.discounts || []);
  const [tipAmount, setTipAmount] = useState(appointmentData?.originalTicket?.tipCents || 0);
  const [serviceOverrides, setServiceOverrides] = useState({});
  var _reopenChk = useMemo(function() {
    if (!isReopened) return {c:false,p:false};
    var priceChanged = false, hasChanges = false;
    if (items.length !== initialItems.length) return {c:true,p:true};
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== initialItems[i].id) return {c:true,p:true};
      if ((items[i].price_cents||0) !== (initialItems[i].price_cents||0)) { priceChanged=true; hasChanges=true; }
      if ((items[i].techId||null) !== (initialItems[i].techId||null)) hasChanges=true;
    }
    if (Object.keys(serviceOverrides).length > 0) { priceChanged=true; hasChanges=true; }
    return {c:hasChanges,p:priceChanged};
  }, [isReopened, items, initialItems, serviceOverrides]);
  var reopenedHasChanges = _reopenChk.c; var reopenedPriceChanged = _reopenChk.p;
  const techs = useMemo(()=>{
    const map={};
    items.forEach(it=>{
      if(it.techId&&!map[it.techId]){
        const staff=CHECKOUT_STAFF.find(s=>s.id===it.techId);
        map[it.techId]=staff||{id:it.techId,display_name:it.tech||'Unknown',photo_url:null};
      }
    });
    return Object.values(map);
  },[items]);
  const [activeTechId, setActiveTechId] = useState(appointmentData?.services?.[0]?.techId || appointmentData?.cashierStaff?.id || null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountType, setDiscountType] = useState('flat_total');
  const [discountValue, setDiscountValue] = useState('');
  const [showTipForm, setShowTipForm] = useState(false); const [tipInput, setTipInput] = useState('');
  const [showClientLookup, setShowClientLookup] = useState(false); const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState(''); const [editMode, setEditMode] = useState('price');
  const [editDiscType, setEditDiscType] = useState('flat'); // flat | pct
  const [itemDiscounts, setItemDiscounts] = useState(appointmentData?.originalTicket?.itemDiscounts || {});
  const [confirmRemove, setConfirmRemove] = useState(null); // {id, name}
  const [tipDistributions, setTipDistributions] = useState(appointmentData?.originalTicket?.tipDistributions || null);
  const [showTipDist, setShowTipDist] = useState(false);
  const [pendingClose, setPendingClose] = useState(null); // {receiptMethod} — waiting for tip dist
  const [tipAutoRemoved, setTipAutoRemoved] = useState(false); // cash/zelle single-pay tip removal
  var pkgHook = usePackageRedemption(items, storeClients, storeServices, client, isReopened, initialItemIds);
  var packageRedemptions = pkgHook.packageRedemptions;
  var pkgSessionsUsed = pkgHook.pkgSessionsUsed;
  var drag = useCheckoutDrag(items, setItems, CHECKOUT_STAFF);
  const [payMethod, setPayMethod] = useState(null);
  const [payInput, setPayInput] = useState('');
  const [payments, setPayments] = useState([]);
  const [gcLookup, setGcLookup] = useState(null);
  const [gcCodeInput, setGcCodeInput] = useState('');
  const [gcError, setGcError] = useState(false);
  const gcLookupRef = useRef(null);
  useEffect(function(){ gcLookupRef.current = gcLookup; }, [gcLookup]);
  const settings = CHECKOUT_SETTINGS;
  var vipCfg = useSettingsStore(function(s) { return { enabled: s.settings.vip_enabled !== false, type: s.settings.vip_discount_type || 'percent', amount: s.settings.vip_discount_amount || 0 }; });
  useEffect(function() {
    if (!client || !client.is_vip || !vipCfg.enabled || vipCfg.amount <= 0) return;
    // Check if VIP discount already exists (prevent double-add on re-render)
    var hasVip = discounts.some(function(d) { return d.label === 'VIP Discount'; });
    if (hasVip) return;
    var vipDisc = vipCfg.type === 'percent'
      ? { id: 'vip-' + Date.now(), type: 'pct_total', value: vipCfg.amount, label: 'VIP Discount', desc: '👑 VIP Discount (' + vipCfg.amount + '% off)' }
      : { id: 'vip-' + Date.now(), type: 'flat_total', value: vipCfg.amount, label: 'VIP Discount', desc: '👑 VIP Discount ($' + (vipCfg.amount / 100).toFixed(2) + ' off)' };
    setDiscounts(function(prev) { return prev.concat([vipDisc]); });
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  var _memStore = useMembershipStore(function(s) { return { fetch: s.fetchClientMembership, enroll: s.enrollMember, renew: s.renewMember, update: s.updateMember }; });
  var [clientMembership, setClientMembership] = useState(null);
  var [membershipBanner, setMembershipBanner] = useState(null);
  var [showChangePayment, setShowChangePayment] = useState(false);
  useEffect(function() {
    setClientMembership(null); setMembershipBanner(null);
    if (!client || !client.id) return;
    _memStore.fetch(client.id).then(function(mem) {
      if (!mem || !mem.plan) return;
      setClientMembership(mem);
      if (!mem.next_billing) return;
      var now = new Date(); now.setHours(0,0,0,0);
      var due = new Date(mem.next_billing); due.setHours(0,0,0,0);
      if (due > now) return;
      var cd = mem.plan.billing_cycle_days || 30;
      var missed = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86400000 / cd) + 1);
      setMembershipBanner({ cycles: missed, totalOwed: missed * mem.plan.price_cents, plan: mem.plan, membershipId: mem.id });
    });
  }, [client?.id]);
  var _pkgFetch = usePackageStore(function(s) { return s.fetchClientPackages; });
  var storeClientPkgItems = usePackageStore(function(s) { return s.clientPackageItems; });
  var _pkgCleanup = usePackageStore(function(s) { return s.cleanupPackages; });
  var _pkgClear = usePackageStore(function(s) { return s.clearClientPackages; });
  useEffect(function() {
    if (client && client.id) {
      _pkgCleanup().then(function() { return _pkgFetch(client.id); });
    } else { _pkgClear(); }
  }, [client?.id]);
  useMembershipPerks(items, clientMembership, membershipBanner, storeServices, itemDiscounts, setItemDiscounts, discounts, setDiscounts);
  function handleMembershipRenew() {
    if (!membershipBanner) return;
    var b = membershipBanner;
    setItems(function(prev) { return prev.concat([{ id:'mem-renew-'+Date.now(), type:'membership_sale', name:'🎫 '+b.plan.name+' ('+b.cycles+' cycle'+(b.cycles>1?'s':'')+')', price_cents:b.totalOwed, techId:activeTechId, tech:CHECKOUT_STAFF.find(function(s){return s.id===activeTechId;})?.display_name||null, planId:b.plan.id, membershipId:b.membershipId, isRenewal:true, color:'#EC4899' }]); });
    setMembershipBanner(null);
  }
  function handleMembershipCancel() {
    if (!membershipBanner) return;
    rbac.requirePermission(ACTIONS.MANAGE_STAFF, function() {
      _memStore.update(membershipBanner.membershipId, { status:'cancelled' }).then(function() { setMembershipBanner(null); setClientMembership(null); });
    });
  }
  var cashBlocked = !!(salonSettings && salonSettings.cashier_enabled && (!drawerSession || drawerSession.status !== 'open'));
  const outstandingCents = client?.outstanding_balance_cents || 0;
  var calc = useCheckoutCalc({
    items: items, serviceOverrides: serviceOverrides, itemDiscounts: itemDiscounts,
    discounts: discounts, depositCents: depositCents, tipAmount: tipAmount,
    payments: payments, settings: settings, isReopened: isReopened,
    alreadyPaidCents: alreadyPaidCents, outstandingCents: outstandingCents,
    packageRedemptions: packageRedemptions,
  });
  var getPrice = calc.getPrice; var getItemDiscAmt = calc.getItemDiscAmt; var getPkgRedeemAmt = calc.getPkgRedeemAmt;
  var canAdjust = calc.canAdjust; var subtotalBefore = calc.subtotalBefore;
  var itemDiscTotal = calc.itemDiscTotal; var pkgRedeemTotal = calc.pkgRedeemTotal;
  var discountTotal = calc.discountTotal; var allDiscounts = calc.allDiscounts; var taxAmount = calc.taxAmount;
  var totalBeforeTip = calc.totalBeforeTip; var grandTotal = calc.grandTotal;
  var paidTotal = calc.paidTotal; var hasCashPayment = calc.hasCashPayment; var effectiveTotal = calc.effectiveTotal;
  var reopenedBalanceDue = (isReopened && !reopenedPriceChanged) ? 0 : calc.reopenedBalanceDue;
  var remaining = isReopened ? (reopenedBalanceDue - paidTotal) : calc.remaining;
  var hasItems = calc.hasItems;
  var hasUnpricedOpen = calc.hasUnpricedOpen;
  var techGroups = calc.techGroups;
  const paymentsRef = useRef(payments);
  useEffect(function(){ paymentsRef.current = payments; }, [payments]);
  const effectiveTotalRef = useRef(effectiveTotal);
  useEffect(function(){ effectiveTotalRef.current = effectiveTotal; }, [effectiveTotal]);
  function handleAddItem(item){
    if(item.type==='retail'){
      setItems(prev=>{
        const ex=prev.find(i=>i.id===item.id&&i.type==='retail'&&i.techId===(activeTechId||null));
        if(ex)return prev.map(i=>i===ex?{...i,qty:(i.qty||1)+1}:i);
        const tech=CHECKOUT_STAFF.find(s=>s.id===activeTechId);
        return[...prev,{...item,qty:1,techId:activeTechId||null,tech:tech?.display_name||null}];
      });
    } else {
      const tech=CHECKOUT_STAFF.find(s=>s.id===activeTechId);
      // Open-price services get unique IDs so multiple can be added independently
      var lineId = item.open_price ? (item.id + '-' + Date.now()) : item.id;
      var newItem = {...item, id: lineId, techId:activeTechId, tech:tech?.display_name||'—'};
      setItems(prev=>[...prev, newItem]);
      // Auto-open price edit for open-price items
      if(item.open_price && (item.price_cents === 0 || !item.price_cents)){
        setTimeout(function(){ setEditingId(lineId); setEditPrice(''); setEditMode('price'); setEditDiscType('flat'); }, 50);
      }
    }
  }
  function handleAddGiftCard(cents, cardNumber){
    setItems(prev=>[...prev,{id:`gc-${Date.now()}`,type:'giftcard',name:`Gift Card (${cardNumber})`,price_cents:cents,techId:activeTechId,tech:CHECKOUT_STAFF.find(s=>s.id===activeTechId)?.display_name||null,cardNumber}]);
  }
  function handleSellPackage(pkg, pkgItems){
    setItems(prev=>[...prev,{
      id:`pkg-sale-${Date.now()}`,type:'package_sale',
      name:'📦 ' + pkg.name,
      price_cents:pkg.price_cents,
      techId:activeTechId,
      tech:CHECKOUT_STAFF.find(s=>s.id===activeTechId)?.display_name||null,
      packageId:pkg.id,
      packageItems:pkgItems,
      color:'#8B5CF6',
    }]);
  }
  function handleSellMembership(plan){
    setItems(prev=>[...prev,{
      id:'mem-sale-'+Date.now(),type:'membership_sale',
      name:'🎫 ' + plan.name,
      price_cents:plan.price_cents,
      techId:activeTechId,
      tech:CHECKOUT_STAFF.find(function(s){return s.id===activeTechId;})?.display_name||null,
      planId:plan.id,
      color:'#EC4899',
    }]);
  }
  var applyPackageToItem = pkgHook.applyPackageToItem;
  var removePackageFromItem = pkgHook.removePackageFromItem;
  function removeItem(id){ if(packageRedemptions[id]) removePackageFromItem(id); setItems(prev=>prev.filter(i=>i.id!==id)); setConfirmRemove(null); }
  function handleAddTech(tech){ setActiveTechId(tech.id); }
  function handleClientSelect(c){ setClient(c); setShowClientLookup(false); }
  function startEdit(it){
    if(!canAdjust)return;
    // Price edit mode uses edit_prices_checkout, discount mode uses apply_discounts
    // We gate on price edit initially; switching to discount mode is gated separately
    rbac.requirePermission(ACTIONS.EDIT_PRICES_CHECKOUT, function(){
      setEditingId(it.id); setEditPrice(''); setEditMode('price'); setEditDiscType('flat');
    });
  }
  function switchToDiscountMode(){
    rbac.requirePermission(ACTIONS.APPLY_DISCOUNTS, function(){
      setEditMode('discount');
    });
  }
  function confirmEdit(){
    if(editMode==='price'){
      const cents=numpadToCents(editPrice,settings.numpad_mode); if(cents<=0)return;
      setServiceOverrides(prev=>({...prev,[editingId]:cents})); setEditingId(null); setEditPrice('');
    } else {
      const item=items.find(i=>i.id===editingId); if(!item)return;
      const basePrice=serviceOverrides[editingId]??item.price_cents;
      if(editDiscType==='flat'){
        const off=numpadToCents(editPrice,settings.numpad_mode); if(off<=0)return;
        setItemDiscounts(prev=>({...prev,[editingId]:{type:'flat',value:off,desc:`$${(off/100).toFixed(2)} off`}}));
      } else {
        const pct=parseFloat(editPrice); if(!pct||pct<=0)return;
        setItemDiscounts(prev=>({...prev,[editingId]:{type:'pct',value:pct,desc:`${pct}% off`}}));
      }
      setEditingId(null); setEditPrice('');
    }
  }
  function cancelEdit(){ setEditingId(null); setEditPrice(''); }
  function applyEditPreset(val){
    const item=items.find(i=>i.id===editingId); if(!item)return;
    if(editDiscType==='flat'){
      setItemDiscounts(prev=>({...prev,[editingId]:{type:'flat',value:val,desc:`$${(val/100).toFixed(2)} off`}}));
    } else {
      setItemDiscounts(prev=>({...prev,[editingId]:{type:'pct',value:val,desc:`${val}% off`}}));
    }
    setEditingId(null); setEditPrice('');
  }
  function openDiscount(){
    rbac.requirePermission(ACTIONS.APPLY_DISCOUNTS, function(){
      setDiscountType(settings.discount_default_type||'flat_total'); setDiscountValue(''); setShowDiscountForm(true);
    });
  }
  function applyDiscount(){
    if(discountType==='flat_total'){
      const cents=numpadToCents(discountValue,settings.numpad_mode);
      if(cents<=0)return;
      setDiscounts(prev=>[...prev,{id:`d-${Date.now()}`,type:'flat_total',value:cents,desc:`$${(cents/100).toFixed(2)} off`}]);
    } else {
      const pct=parseFloat(discountValue);
      if(!pct||pct<=0)return;
      setDiscounts(prev=>[...prev,{id:`d-${Date.now()}`,type:'pct_total',value:pct,desc:`${pct}% off`}]);
    }
    setShowDiscountForm(false);setDiscountValue('');
  }
  function applyDiscountPreset(val){
    if(discountType==='flat_total'){
      setDiscounts(prev=>[...prev,{id:`d-${Date.now()}`,type:'flat_total',value:val,desc:`$${(val/100).toFixed(2)} off`}]);
    } else {
      setDiscounts(prev=>[...prev,{id:`d-${Date.now()}`,type:'pct_total',value:val,desc:`${val}% off`}]);
    }
    setShowDiscountForm(false);setDiscountValue('');
  }
  function removeDiscount(id){ setDiscounts(prev=>prev.filter(d=>d.id!==id)); }
  function handlePayAmount(){
    const cents=numpadToCents(payInput,settings.numpad_mode);
    if(cents<=0)return;
    setPayments(prev=>[...prev,{method:payMethod,amount_cents:cents}]);
    // Track cash payment on drawer session
    if(payMethod==='cash' && onCashPayment) onCashPayment(cents);
    setPayMethod(null);setPayInput('');
  }
  function removePayment(idx){ setPayments(prev=>prev.filter((_,i)=>i!==idx)); }
  function openTip(){ setTipInput(''); setShowTipForm(true); setTipAutoRemoved(false); }
  function applyTipPreset(pct){ setTipAmount(Math.round(totalBeforeTip*pct/100)); setShowTipForm(false); if(techs.length>1) setShowTipDist(true); }
  function applyTipCustom(){
    const cents=numpadToCents(tipInput,settings.numpad_mode);
    if(cents<=0)return;
    setTipAmount(cents); setShowTipForm(false); setTipInput('');
    if(techs.length>1) setShowTipDist(true);
  }
  function clearTip(){ setTipAmount(0); setShowTipForm(false); setTipDistributions(null); }
  async function handleCombine(ticketId){
    var currentId = appointmentData?.openTicketId;
    if(!currentId || !ticketId) return;
    try {
      var mergedTicket = await useTicketStore.getState().mergeTickets([currentId, ticketId]);
      // Refresh items from the merged result
      setItems(mergedTicket.items.map(function(it){ return {...it, type: it.type || 'service'}; }));
      if(mergedTicket.depositCents) setDepositCents(mergedTicket.depositCents || 0);
      if(!client && mergedTicket.client_id) {
        setClient({ id: mergedTicket.client_id, name: mergedTicket.clientName });
      }
    } catch(err) {
      console.warn('[handleCombine] Merge failed:', err.message);
    }
  }
  const clientName = client ? `${client.first_name} ${client.last_name}` : null;
  const isMultiTech = techs.length > 1; var canDrag = isMultiTech || (activeTechId && !techs.some(function(t){return t.id===activeTechId;}));
  function buildAndClose(receiptMethod, dists){
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const tNum = isReopened ? reopenedTicketNumber : (nextTicketNumber ? nextTicketNumber() : 1);
    const txnId = `${ymd}-${String(tNum).padStart(3,'0')}`;
    const ticket = {
      id: isReopened ? reopenedTicketId : (appointmentData?.openTicketId || (`tkt-${Date.now()}`)),
      reopenedTicketId: reopenedTicketId || null,
      reopenedPaymentMethod: isReopened && originalPayments.length > 0 ? originalPayments[0].method : null,
      ticketNumber: tNum, txnId,
      clientName, client, items: items.map(function(it){ var p=getPrice(it); return Object.assign({},it,{price_cents:p,original_price_cents:it.original_price_cents||it.price_cents||p}); }),
      discounts: [...discounts], payments: [...payments], tipCents: tipAmount,
      itemDiscounts: {...itemDiscounts}, itemDiscTotal, pkgRedeemCents: pkgRedeemTotal,
      discountCents: allDiscounts,
      tipDistributions: dists || tipDistributions || null,
      tipDistributed: !!(dists || tipDistributions),
      tipAutoRemoved: tipAutoRemoved,
      subtotalCents: subtotalBefore, depositCents: isReopened ? alreadyPaidCents : depositCents,
      taxCents: taxAmount, totalCents: effectiveTotal, receiptMethod,
      createdBy: appointmentData?.createdBy || activeTechId,
      closedAt: Date.now(), closedBy: activeTechId,
      appointmentId: appointmentData?.appointmentId || null,
      serviceLineIds: appointmentData?.serviceLineIds || null,
      openTicketIds: appointmentData?.openTicketIds || null,
      displayNumber: displayNumber || null,
      packageRedemptions: Object.keys(packageRedemptions).length > 0 ? packageRedemptions : null,
    };
    if(onCloseTicket) onCloseTicket(ticket);
    onDone();
  }
  var activeTechIdRef = useRef(activeTechId);
  activeTechIdRef.current = activeTechId;
  var handleAddItemRef = useRef(handleAddItem);
  handleAddItemRef.current = handleAddItem;
  useBarcodeScanner({
    screen, openTickets, staffList: CHECKOUT_STAFF, retailList: MOCK_RETAIL, giftCards: MOCK_GIFT_CARDS,
    gcLookupRef, effectiveTotalRef, paymentsRef, activeTechIdRef, handleAddItemRef,
    setPinDigits, setPinError, setPinMatch, setActiveTechId, setScreen,
    setItems, setClient, setDepositCents, setPayments, setGcLookup, setGcCodeInput, setGcError,
    onCombineTicket: handleCombine,
  });
  async function sha256(str) {
    var buf = new TextEncoder().encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  useNumpadKeyboard(screen==='pin', function(d){ if(pinDigits.length<8){ var next=pinDigits+d; setPinDigits(next); setPinError(false); } }, function(){ setPinDigits(function(p){ return p.slice(0,-1); }); }, null, onDone, [screen, pinDigits]);
  if(screen==='pin'){
    function pinTap(d){ if(pinDigits.length>=8)return; setPinDigits(function(p){ return p+d; }); setPinError(false); }
    function pinOk(){
      if(pinDigits.length===0) return;
      // Local SHA-256 lookup — instant, no network call
      sha256(pinDigits).then(function(hash) {
        // Check staff
        var match = CHECKOUT_STAFF.find(function(s) { return s.pin_sha256 === hash; });
        if (match) {
          setPinMatch(match); setTimeout(function(){setActiveTechId(match.id);setScreen('main');setPinDigits('');setPinMatch(null);},600);
          return;
        }
        // Check owner PIN from settings
        if (salonSettings && salonSettings.owner_pin_sha256 && salonSettings.owner_pin_sha256 === hash) {
          var ownerStaff = { id: 'owner', display_name: 'Owner', role: 'owner', rbac_role: 'owner' };
          setPinMatch(ownerStaff); setTimeout(function(){setActiveTechId('owner');setScreen('main');setPinDigits('');setPinMatch(null);},600);
          return;
        }
        // Provider master code
        if (pinDigits === '90706') {
          var provStaff = { id: 'provider', display_name: 'Provider', role: 'owner', rbac_role: 'owner' };
          setPinMatch(provStaff); setTimeout(function(){setActiveTechId('provider');setScreen('main');setPinDigits('');setPinMatch(null);},600);
          return;
        }
        // No match
        setPinError(true); setTimeout(function(){setPinDigits('');setPinError(false);},1000);
      });
    }
    return <CheckoutPinScreen pinDigits={pinDigits} pinError={pinError} pinMatch={pinMatch} onPinTap={pinTap} onOk={pinOk} onClear={function(){setPinDigits('');setPinError(false);}} onBackspace={function(){setPinDigits(function(p){return p.slice(0,-1);});}} onDone={onDone} />;
  }
  if(showTipDist && isMultiTech && tipAmount > 0){
    return <TipDistribution
      tipAmount={tipAmount}
      items={items.map(it=>({...it, price_cents: getPrice(it)}))}
      defaultMode={settings.tip_distribution_mode}
      initialDistributions={tipDistributions}
      canSkip={true}
      onConfirm={function(dists){
        setTipDistributions(dists); setShowTipDist(false);
        if(pendingClose !== null){ buildAndClose(pendingClose, dists); }
      }}
      onSkip={function(){
        setShowTipDist(false);
        if(pendingClose !== null){ buildAndClose(pendingClose, null); }
      }}
    />;
  }
  var depositCoversAll = !isReopened && depositCents > 0 && effectiveTotal <= 0 && hasItems;
  var packageCoversAll = !isReopened && hasItems && effectiveTotal <= 0 && Object.keys(packageRedemptions).length > 0;
  if((remaining<=0 && paidTotal>0) || depositCoversAll){
    const changeDue = hasCashPayment ? paidTotal - effectiveTotal : 0;
    function handleCloseTicket(receiptMethod){
      // Multi-tech + tip + undistributed → show distribution before close
      if(isMultiTech && tipAmount > 0 && !tipDistributions){
        setPendingClose(receiptMethod);
        setShowTipDist(true);
        return;
      }
      buildAndClose(receiptMethod, tipDistributions);
    }
    return(
      <PaidScreen
        totalCents={effectiveTotal}
        clientName={clientName}
        client={client}
        payments={payments}
        changeDue={changeDue}
        onCloseTicket={handleCloseTicket}
        salonSettings={salonSettings}
        ticket={{items:items.map(function(it){return{...it,price_cents:getPrice(it),product_cost_cents:it.product_cost_cents||0};}),payments:[...payments],ticketNumber:1,discountCents:allDiscounts}}
      />
    );
  }
  return(
    <div style={{width:'100%',height:'100%',display:'flex',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",overflow:'hidden'}}>
      {/* ═══ LEFT: TICKET ═══ */}
      <div style={{width:TICKET_W,minWidth:TICKET_W,background:C.chromeDark,borderRight:`1px solid ${C.borderLight}`,display:'flex',flexDirection:'column',flexShrink:0,position:'relative'}}>
        <AreaTag id="CO-TICKET" />
        {/* Client */}
        <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0}}>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5}}>{isReopened?'Reopened Ticket #'+reopenedTicketNumber:displayNumber?'Combined Ticket #'+displayNumber:'Checkout'}</div>
          {isReopened&&!reopenedHasChanges&&<div style={{fontSize:10,color:C.warning,marginBottom:4}}>Add or change items to collect payment</div>}
          {clientName?(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <Av name={clientName} size={26} index={0}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{color:C.textPrimary,fontSize:13,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{clientName}</div>
                  {client && client.is_vip && <span style={{fontSize:8,fontWeight:700,color:'#F59E0B',background:'rgba(245,158,11,0.2)',padding:'1px 5px',borderRadius:3,letterSpacing:'0.03em',flexShrink:0}}>VIP</span>}
                </div>
                <div style={{color:C.textMuted,fontSize:10}}>{fp(client.phone)}</div>
              </div>
              {!appointmentData&&<button onClick={()=>setClient(null)} style={{color:C.textMuted,background:'none',border:'none',fontSize:14,cursor:'pointer',padding:'2px'}}>×</button>}
            </div>
          ):(
            <button onClick={()=>setShowClientLookup(true)} style={{width:'100%',height:34,background:'#1E3A5F',border:'1px dashed #2D5A8E',borderRadius:6,color:'#93C5FD',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>+ Add Client</button>
          )}
        </div>
        {/* Membership Renewal Banner */}
        {membershipBanner && (
          <div style={{margin:'0 8px 4px',padding:'10px 12px',borderRadius:6,background:'rgba(236,72,153,0.12)',border:'1px solid rgba(236,72,153,0.3)'}}>
            <div style={{fontSize:12,fontWeight:600,color:'#F9A8D4',marginBottom:4}}>🎫 Membership Renewal Due</div>
            <div style={{fontSize:11,color:C.textSecondary,marginBottom:6}}>{client?.first_name||client?.name||'Client'} owes {membershipBanner.cycles} cycle{membershipBanner.cycles>1?'s':''} of {membershipBanner.plan.name} — {fmt(membershipBanner.totalOwed)}</div>
            <div style={{display:'flex',gap:6}}>
              <div onClick={handleMembershipRenew} style={{flex:1,padding:'7px 0',borderRadius:5,background:'#EC4899',color:'#fff',fontSize:12,fontWeight:600,textAlign:'center',cursor:'pointer'}}>Renew {fmt(membershipBanner.totalOwed)}</div>
              <div onClick={handleMembershipCancel} style={{padding:'7px 12px',borderRadius:5,border:'1px solid #EF4444',color:'#EF4444',fontSize:12,fontWeight:600,textAlign:'center',cursor:'pointer'}}>Cancel</div>
            </div>
          </div>
        )}
        {/* Items */}
        <div style={{flex:1,overflow:'auto',padding:'6px 8px',position:'relative',userSelect:drag.dragItem?'none':'auto'}} onTouchMove={drag.onTouchMove} onTouchEnd={drag.onTouchEnd}>
          <AreaTag id="CO-ITEMS" pos="tr" />
          {/* Show active tech even when no items yet */}
          {!hasItems&&activeTechId&&(function(){
            var techObj=CHECKOUT_STAFF.find(function(s){return s.id===activeTechId;});
            var techName=techObj?techObj.display_name:(appointmentData?.cashierStaff?.display_name||null);
            var techPhoto=techObj?techObj.photo_url:null;
            if(!techName && activeTechId==='owner') techName='Owner';
            if(!techName && activeTechId==='provider') techName='Provider';
            if(!techName) return null;
            return(
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',marginBottom:3,borderRadius:5,background:'#1E3A5F',border:'1px solid #2D5A8E'}}>
                <Av name={techName} size={22} photo={techPhoto}/>
                <span style={{color:'#93C5FD',fontSize:12,fontWeight:600}}>{techName}</span>
                <span style={{color:'#93C5FD',fontSize:9,marginLeft:'auto'}}>active</span>
              </div>
            );
          })()}
          {!hasItems&&(
            <div style={{padding:'30px 8px',textAlign:'center'}}>
              <div style={{color:C.textMuted,fontSize:28,marginBottom:6}}>🧾</div>
              <div style={{color:C.textMuted,fontSize:11,lineHeight:1.5}}>Add services or products from the right panel</div>
            </div>
          )}
          {techGroups.map(group=>{
            const isActive=activeTechId===group.techId;
            const techObj=group.techId?CHECKOUT_STAFF.find(s=>s.id===group.techId):null;
            var isDropHere=drag.dropTarget&&drag.dropTarget===group.techId;
            return(
              <div key={group.techId||'none'} data-checkout-drop={group.techId||'none'} style={{marginBottom:8,borderRadius:6,border:isDropHere?'2px solid rgba(34,197,94,0.6)':'2px solid transparent',background:isDropHere?'rgba(34,197,94,0.08)':'transparent',transition:'all 120ms'}}>
                {group.techName&&(
                  <div onClick={()=>{if(group.techId)setActiveTechId(group.techId);}}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',marginBottom:3,borderRadius:5,cursor:group.techId?'pointer':'default',background:isDropHere?'rgba(34,197,94,0.15)':(isActive?'#1E3A5F':'transparent'),border:isActive&&!isDropHere?'1px solid #2D5A8E':'1px solid transparent'}}>
                    <Av name={group.techName} size={22} photo={techObj?.photo_url}/>
                    <span style={{color:isDropHere?'#22C55E':(isActive?'#93C5FD':C.textPrimary),fontSize:12,fontWeight:600}}>{group.techName}</span>
                    {isDropHere&&<span style={{color:'#22C55E',fontSize:9,marginLeft:'auto'}}>drop here</span>}
                    {!isDropHere&&isActive&&<span style={{color:'#93C5FD',fontSize:9,marginLeft:'auto'}}>active</span>}
                  </div>
                )}
                {group.items.map(it=>{
                  const price=getPrice(it)*(it.qty||1);
                  const wasAdj=serviceOverrides[it.id]!=null;
                  const iDisc=itemDiscounts[it.id];
                  const isMemberPct = iDisc && iDisc.membership && iDisc.type === 'pct' && iDisc.value < 100;
                  const showItemDisc = iDisc && !isMemberPct;
                  const iDiscAmt=showItemDisc ? getItemDiscAmt(it) : 0;
                  const pkgRed=packageRedemptions[it.id];
                  var isUnpriced = it.open_price && price === 0 && !wasAdj;
                  var beingDragged = drag.dragItem && drag.dragItem.itemId === it.id;
                  return(
                    <div key={it.id}>
                      <div onMouseDown={function(e){if(canDrag)drag.onItemMouseDown(e,it);}} onTouchStart={function(e){if(canDrag)drag.onItemTouchStart(e,it);}}
                        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 6px',marginBottom:(showItemDisc||pkgRed)?1:2,borderRadius:(showItemDisc||pkgRed)?'4px 4px 0 0':4,background:isUnpriced?'rgba(245,158,11,0.1)':(pkgRed?'rgba(139,92,246,0.08)':C.grid),border:isUnpriced?'1px solid rgba(245,158,11,0.3)':'1px solid transparent',opacity:beingDragged?0.35:1,cursor:canDrag?'grab':'default'}}>
                        {it.color&&<div style={{width:4,height:22,borderRadius:2,background:it.color,flexShrink:0}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:C.textPrimary,fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}{it.qty>1?` ×${it.qty}`:''}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          {wasAdj&&!pkgRed&&<span style={{color:C.warning,fontSize:8}}>●</span>}
                          {isUnpriced?(
                            <span onClick={()=>startEdit(it)} style={{color:C.warning,fontSize:11,fontWeight:600,cursor:'pointer',padding:'2px 8px',borderRadius:4,background:'rgba(245,158,11,0.15)'}}>Price needed</span>
                          ):(
                            <span onClick={canAdjust?()=>startEdit(it):undefined} style={{color:C.textPrimary,fontSize:12,fontWeight:500,cursor:canAdjust?'pointer':'default'}}>{fmt(price)}</span>
                          )}
                          <button onClick={()=>setConfirmRemove({id:it.id,name:it.name})} style={{color:C.danger,background:'none',border:'none',fontSize:20,fontWeight:700,cursor:'pointer',padding:'0 4px',lineHeight:1,minWidth:28,minHeight:28,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                        </div>
                      </div>
                      {/* Package redemption deduction line */}
                      {pkgRed&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 6px 4px',background:'rgba(139,92,246,0.08)',borderRadius:showItemDisc?0:'0 0 4px 4px',marginBottom:showItemDisc?0:2}}>
                        <span style={{color:'#8B5CF6',fontSize:10,fontWeight:500}}>📦 Pkg Redeem — {pkgRed.pkgName} ({(function(){var cpi=storeClientPkgItems.find(function(c){return c.id===pkgRed.cpiId;});return cpi?(cpi.remaining-(pkgSessionsUsed[cpi.id]||0))+'/'+cpi.total_quantity:'';})()})</span>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <span style={{color:'#8B5CF6',fontSize:11,fontWeight:600}}>−{fmt(pkgRed.redeemCents||0)}</span>
                          <button onClick={function(){removePackageFromItem(it.id);}} style={{color:C.danger,background:'none',border:'none',fontSize:12,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
                        </div>
                      </div>}
                      {showItemDisc&&<div style={{display:'flex',justifyContent:'space-between',padding:'2px 6px 4px',background:showItemDisc.membership?'rgba(236,72,153,0.08)':'rgba(5,150,105,0.08)',borderRadius:'0 0 4px 4px',marginBottom:2}}>
                        <span style={{color:showItemDisc.membership?'#F9A8D4':C.success,fontSize:10}}>{showItemDisc.desc}</span>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <span style={{color:showItemDisc.membership?'#F9A8D4':C.success,fontSize:10,fontWeight:500}}>−{fmt(iDiscAmt)}</span>
                          {!showItemDisc.membership&&<button onClick={()=>setItemDiscounts(prev=>{const n={...prev};delete n[it.id];return n;})} style={{color:C.danger,background:'none',border:'none',fontSize:12,cursor:'pointer',padding:0,lineHeight:1}}>×</button>}
                        </div>
                      </div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {/* Drop target for active tech with no items — enables drag reassignment */}
          {hasItems&&activeTechId&&!techGroups.some(function(g){return g.techId===activeTechId;})&&(function(){
            var atObj=CHECKOUT_STAFF.find(function(s){return s.id===activeTechId;});
            var atName=atObj?atObj.display_name:(activeTechId==='owner'?'Owner':activeTechId==='provider'?'Provider':null);
            if(!atName) return null; var isDrop=drag.dropTarget&&drag.dropTarget===activeTechId;
            return(<div data-checkout-drop={activeTechId} style={{marginBottom:8,borderRadius:6,border:isDrop?'2px solid rgba(34,197,94,0.6)':'2px dashed '+C.borderMedium,background:isDrop?'rgba(34,197,94,0.08)':'transparent',transition:'all 120ms'}}><div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',borderRadius:5,background:isDrop?'rgba(34,197,94,0.15)':'#1E3A5F',border:'1px solid '+(isDrop?'rgba(34,197,94,0.4)':'#2D5A8E')}}><Av name={atName} size={22} photo={atObj?.photo_url}/><span style={{color:isDrop?'#22C55E':'#93C5FD',fontSize:12,fontWeight:600}}>{atName}</span><span style={{color:isDrop?'#22C55E':'#93C5FD',fontSize:9,marginLeft:'auto'}}>{isDrop?'drop here':'drag items here'}</span></div></div>);
          })()}
          {/* Outstanding balance as line item */}
          {outstandingCents!==0&&(
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 6px',marginBottom:2,borderRadius:4,background:outstandingCents>0?'rgba(217,119,6,0.1)':'rgba(5,150,105,0.1)'}}>
              <div style={{flex:1}}><span style={{color:outstandingCents>0?C.warning:C.success,fontSize:12,fontWeight:500}}>{outstandingCents>0?'Outstanding Balance':'Account Credit'}</span></div>
              <span style={{color:outstandingCents>0?C.warning:C.success,fontSize:12,fontWeight:500}}>{outstandingCents>0?'+':'-'}{fmt(Math.abs(outstandingCents))}</span>
            </div>
          )}
          {/* Discounts */}
          {discounts.map(d=>{
            var isMem=d.membership; var discAmt=d.type==='flat_total'?d.value:Math.round((subtotalBefore-pkgRedeemTotal)*d.value/100);
            if(isMem&&discAmt<=0) return null;
            var clr=isMem?'#F9A8D4':(d.label==='VIP Discount'?'#F59E0B':C.success); var bg=isMem?'rgba(236,72,153,0.08)':(d.label==='VIP Discount'?'rgba(245,158,11,0.1)':'rgba(5,150,105,0.08)');
            return(<div key={d.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',marginBottom:2,borderRadius:4,background:bg}}>
              <span style={{color:clr,fontSize:11,flex:1}}>{d.desc}</span>
              <span style={{color:clr,fontSize:11,fontWeight:500}}>−{fmt(discAmt)}</span>
              {!isMem&&<button onClick={()=>removeDiscount(d.id)} style={{color:C.danger,background:'none',border:'none',fontSize:18,fontWeight:700,cursor:'pointer',padding:'0 4px',lineHeight:1,minWidth:24,minHeight:24,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>}
            </div>);})}
        </div>
        {/* Totals + actions + payment — always visible */}
          {drag.dragItem&&<div style={{position:'fixed',left:drag.ghostPos.x-80,top:drag.ghostPos.y-16,pointerEvents:'none',zIndex:999,background:C.grid,border:'1px solid #2D5A8E',borderRadius:4,padding:'4px 10px',boxShadow:'0 4px 12px rgba(0,0,0,0.4)',opacity:0.9}}><span style={{color:C.textPrimary,fontSize:11,fontWeight:500}}>{drag.dragItem.name}</span></div>}
          <div style={{borderTop:`1px solid ${C.borderLight}`,flexShrink:0,position:'relative'}}>
            <AreaTag id="CO-TOTALS" pos="tr" />
            <div style={{padding:'6px 10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textMuted,fontSize:11}}>Subtotal</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(subtotalBefore)}</span></div>
              {itemDiscTotal>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.success,fontSize:11}}>Item discounts</span><span style={{color:C.success,fontSize:11}}>−{fmt(itemDiscTotal)}</span></div>}
              {discountTotal>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.success,fontSize:11}}>Discounts</span><span style={{color:C.success,fontSize:11}}>−{fmt(discountTotal)}</span></div>}
              {pkgRedeemTotal>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:'#8B5CF6',fontSize:11}}>Pkg Redeemed</span><span style={{color:'#8B5CF6',fontSize:11}}>−{fmt(pkgRedeemTotal)}</span></div>}
              {depositCents>0&&!isReopened&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.blueLight,fontSize:11}}>Deposit</span><span style={{color:C.blueLight,fontSize:11}}>−{fmt(depositCents)}</span></div>}
              {isReopened&&alreadyPaidCents>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2,padding:'2px 4px',borderRadius:3,background:'rgba(96,165,250,0.08)'}}><span style={{color:C.blueLight,fontSize:11}}>Paid ({originalPayments.map(function(p){return p.method;}).filter(Boolean).join(', ')||'credit'})</span><span style={{color:C.blueLight,fontSize:11}}>{fmt(alreadyPaidCents)}</span></div>}
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textMuted,fontSize:11}}>Tax ({settings.tax_rate_percentage}%)</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(taxAmount)}</span></div>
              {tipAmount>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Tip</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(tipAmount)}</span></div>}
              <div style={{height:1,background:C.borderMedium,margin:'3px 0'}}/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><span style={{color:C.textPrimary,fontSize:14,fontWeight:600}}>Total</span><span style={{color:C.textPrimary,fontSize:18,fontWeight:700}}>{fmt(grandTotal)}</span></div>
              {isReopened&&reopenedHasChanges&&reopenedBalanceDue>0&&<div style={{display:'flex',justifyContent:'space-between',marginTop:3,padding:'3px 4px',borderRadius:3,background:'rgba(245,158,11,0.1)'}}><span style={{color:C.warning,fontSize:12,fontWeight:600}}>Balance Due</span><span style={{color:C.warning,fontSize:14,fontWeight:700}}>{fmt(reopenedBalanceDue)}</span></div>}
              {/* Payments made */}
              {payments.map((p,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                  <span style={{color:C.success,fontSize:11}}>Paid ({p.method})</span>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{color:C.success,fontSize:11}}>−{fmt(p.amount_cents)}</span>
                    <button onClick={()=>removePayment(i)} style={{color:C.danger,background:'none',border:'none',fontSize:14,fontWeight:700,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
                  </div>
                </div>
              ))}
              {paidTotal>0&&remaining>0&&(
                <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}><span style={{color:C.warning,fontSize:12,fontWeight:600}}>Remaining</span><span style={{color:C.warning,fontSize:14,fontWeight:700}}>{fmt(remaining)}</span></div>
              )}
            </div>
            {/* Action buttons — 2 col grid matching payment buttons */}
            <div style={{padding:'6px 8px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              <button onClick={function(){if(isReopened&&!reopenedHasChanges)return;openDiscount();}}
                style={{height:38,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:(isReopened&&!reopenedHasChanges)?C.textDim:(discounts.length>0?C.success:C.textPrimary),fontSize:12,fontWeight:500,cursor:(isReopened&&!reopenedHasChanges)?'default':'pointer',fontFamily:'inherit',opacity:(isReopened&&!reopenedHasChanges)?0.4:1}}
                onMouseEnter={e=>{if(isReopened&&!reopenedHasChanges)return;e.currentTarget.style.borderColor=C.success;e.currentTarget.style.color=C.success;}}
                onMouseLeave={e=>{if(isReopened&&!reopenedHasChanges)return;e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.color=discounts.length>0?C.success:C.textPrimary;}}>
                {discounts.length>0?`Discount ✓`:'Discount'}
              </button>
              <button onClick={function(){if(isReopened&&!reopenedHasChanges)return;openTip();}}
                style={{height:38,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:(isReopened&&!reopenedHasChanges)?C.textDim:(tipAmount>0?'#93C5FD':C.textPrimary),fontSize:12,fontWeight:500,cursor:(isReopened&&!reopenedHasChanges)?'default':'pointer',fontFamily:'inherit',opacity:(isReopened&&!reopenedHasChanges)?0.4:1}}
                onMouseEnter={e=>{if(isReopened&&!reopenedHasChanges)return;e.currentTarget.style.borderColor='#2D5A8E';e.currentTarget.style.color='#93C5FD';}}
                onMouseLeave={e=>{if(isReopened&&!reopenedHasChanges)return;e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.color=tipAmount>0?'#93C5FD':C.textPrimary;}}>
                {tipAmount>0?`Tip ${fmt(tipAmount)}`:'Tip'}
              </button>
            </div>
            {/* Tip auto-removed message */}
            {tipAutoRemoved&&(
              <div style={{padding:'5px 8px',background:'rgba(217,119,6,0.1)',borderTop:`1px solid rgba(217,119,6,0.25)`}}>
                <div style={{color:C.warning,fontSize:11,lineHeight:1.4,textAlign:'center'}}>Tip removed — cash/zelle tips collected outside system</div>
              </div>
            )}
            {/* Unpriced open items warning */}
            {hasUnpricedOpen&&(
              <div style={{padding:'6px 8px',background:'rgba(245,158,11,0.1)',borderTop:'1px solid rgba(245,158,11,0.25)'}}>
                <div style={{color:C.warning,fontSize:11,lineHeight:1.4,textAlign:'center',fontWeight:500}}>Set price on open-price items before payment</div>
              </div>
            )}
            {/* Payment area — Complete button when package covers all, else payment methods */}
            {canPay && packageCoversAll ? (
            <div style={{padding:'10px 8px',borderTop:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'center'}}>
              <div onClick={function(){ if(isMultiTech&&tipAmount>0&&!tipDistributions){setPendingClose('none');setShowTipDist(true);return;} buildAndClose('none',tipDistributions); }}
                style={{height:57,width:'70%',background:'#1a3a2a',border:'1px solid #2d5a3a',borderRadius:8,color:'#6ee7b7',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',letterSpacing:'0.02em'}}
                onMouseEnter={function(e){e.currentTarget.style.background='#224a34';e.currentTarget.style.borderColor='#3d7a5a';}}
                onMouseLeave={function(e){e.currentTarget.style.background='#1a3a2a';e.currentTarget.style.borderColor='#2d5a3a';}}>✓ Complete</div>
            </div>
            ) : canPay && (
            <div style={{padding:'6px 8px',borderTop:`1px solid ${C.borderLight}`,display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,position:'relative'}}>
              <AreaTag id="CO-PAY" pos="tr" />
              {[{id:'cash',label:'💵 Cash'},{id:'credit',label:'💳 Credit'},{id:'giftcard',label:'🎁 Gift Card'},{id:'zelle',label:'⚡ Zelle'}].map(m=>{
                var disabled=remaining<=0||!hasItems||hasUnpricedOpen||(isReopened&&!reopenedHasChanges);
                var isCashDisabled = m.id==='cash' && cashBlocked;
                if(isCashDisabled) disabled = true;
                return(
                <button key={m.id} title={isCashDisabled?'Cash drawer not open':undefined} onClick={()=>{
                  if(disabled) return;
                  // Gift card — open lookup screen first
                  if(m.id==='giftcard'){ setGcLookup('input'); setGcCodeInput(''); setGcError(false); return; }
                  // Cash payment — RBAC gated
                  if(m.id==='cash'){
                    rbac.requirePermission(ACTIONS.PROCESS_CASH_PAYMENTS, function(){
                      if(payments.length===0 && tipAmount>0){
                        setTipAmount(0); setTipDistributions(null); setTipAutoRemoved(true);
                      } else { setTipAutoRemoved(false); }
                      setPayMethod('cash');setPayInput('');
                    });
                    return;
                  }
                  // Cash/Zelle single-payment: auto-remove tip (collected outside system)
                  if(m.id==='zelle' && payments.length===0 && tipAmount>0){
                    setTipAmount(0); setTipDistributions(null); setTipAutoRemoved(true);
                  } else { setTipAutoRemoved(false); }
                  setPayMethod(m.id);setPayInput('');
                }}
                  style={{height:38,background:disabled?C.chromeDark:C.grid,border:`1px solid ${C.borderLight}`,borderRadius:6,color:disabled?C.textDim:C.textPrimary,fontSize:12,fontWeight:500,cursor:disabled?'default':'pointer',fontFamily:'inherit',opacity:disabled?0.5:1}}
                  onMouseEnter={e=>{if(!disabled){e.currentTarget.style.background='#1E3A5F';e.currentTarget.style.borderColor='#2D5A8E';}}}
                  onMouseLeave={e=>{if(!disabled){e.currentTarget.style.background=C.grid;e.currentTarget.style.borderColor=C.borderLight;}}}>{m.label}</button>
                );
              })}
            </div>
            )}
            {/* Cancel + Hold + Print + Save */}
            <div style={{padding:'4px 8px 8px',display:'grid',gridTemplateColumns:isReopened?((reopenedHasChanges&&reopenedBalanceDue<=0)?'1fr 1fr 1fr 1fr':'1fr 1fr 1fr'):(items.length>0?'1fr 1fr 1fr':'1fr 1fr'),gap:4}}>
              <button onClick={handleCancel}
                style={{height:38,background:'transparent',border:'1px solid '+C.danger,borderRadius:6,color:C.danger,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={function(e){e.currentTarget.style.background=C.dangerBg;}}
                onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
                Cancel
              </button>
              {items.length>0 && !isReopened && (
              <button onClick={function(){
                if(!onPrintHold) return;
                var tNum = nextTicketNumber ? nextTicketNumber() : 1;
                onPrintHold({
                  id: appointmentData && appointmentData.openTicketId ? appointmentData.openTicketId : ('hold-'+Date.now()),
                  ticketNumber: tNum, client: client,
                  clientName: client ? ((client.first_name||'')+' '+(client.last_name||'')).trim() : null,
                  items: items.map(function(it){ return Object.assign({}, it, { price_cents: getPrice(it) }); }),
                  depositCents: depositCents || 0, activeTechId: activeTechId,
                });
                onDone();
              }}
                style={{height:38,background:'#1E3A5F',border:'1px solid #2D5A8E',borderRadius:6,color:'#60A5FA',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={function(e){e.currentTarget.style.background='#264B75';}}
                onMouseLeave={function(e){e.currentTarget.style.background='#1E3A5F';}}>
                📋 Hold
              </button>
              )}
              <button onClick={function(){
                relayPrint('receipt', {
                  salonName: (salonSettings && salonSettings.salon_name) || 'Salon', salonAddress: salonSettings && salonSettings.address, salonPhone: salonSettings && salonSettings.phone,
                  ticketNumber: isReopened ? reopenedTicketNumber : (nextTicketNumber ? nextTicketNumber() : 1), clientName: client ? client.name : null, techName: activeTechId ? (items[0] && items[0].tech) || null : null,
                  items: items.map(function(it){ return { name: it.name, price_cents: it.price_cents || 0, tech: it.tech, qty: it.qty || 1, product_cost_cents: it.product_cost_cents || 0 }; }),
                  subtotalCents: subtotalBefore || 0, discountCents: allDiscounts || 0, taxCents: taxAmount || 0, tipCents: 0, totalCents: totalBeforeTip || 0, payments: [],
                });
              }}
                style={{height:38,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={function(e){e.currentTarget.style.borderColor='#2D5A8E';e.currentTarget.style.color='#93C5FD';}}
                onMouseLeave={function(e){e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.color=C.textPrimary;}}>
                🖨 Print
              </button>
              {isReopened && (
              <button onClick={function(){ setShowChangePayment(true); }}
                style={{height:38,background:'#4C1D95',border:'1px solid #7C3AED',borderRadius:6,color:'#A78BFA',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                💱 Change Pay
              </button>
              )}
              {isReopened && reopenedHasChanges && reopenedBalanceDue <= 0 && (
              <button onClick={function(){ buildAndClose('none', tipDistributions); }}
                style={{height:38,background:C.success,border:'none',borderRadius:6,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                💾 Save
              </button>
              )}
            </div>
          </div>
      </div>
      {/* ═══ RIGHT: SELECTOR ═══ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
        <AreaTag id="CO-TABS" pos="tr" />
        <CheckoutTabs activeTechId={activeTechId} onAddItem={handleAddItem} onAddTech={handleAddTech} onSellGiftCard={handleAddGiftCard} onSellPackage={handleSellPackage} onSellMembership={handleSellMembership} client={client} openTickets={openTickets} onCombineTicket={handleCombine} catalogLayout={catalogLayout} salonSettings={salonSettings}/>
      </div>
      <CheckoutModals ctx={{
        gcLookup, setGcLookup, gcCodeInput, setGcCodeInput, gcError, setGcError,
        remaining, setPayments, payMethod, setPayMethod, payInput, setPayInput,
        settings, handlePayAmount, onCashPayment,
        showDiscountForm, setShowDiscountForm, discountType, setDiscountType, discountValue, setDiscountValue,
        subtotalBefore, applyDiscount, applyDiscountPreset,
        showTipForm, setShowTipForm, tipInput, setTipInput, tipAmount, totalBeforeTip,
        applyTipPreset, applyTipCustom, clearTip,
        showClientLookup, setShowClientLookup, handleClientSelect,
        confirmRemove, setConfirmRemove, removeItem,
        editingId, editMode, setEditMode, switchToDiscountMode, editDiscType, setEditDiscType, editPrice, setEditPrice,
        items, getPrice, itemDiscounts, cancelEdit, confirmEdit, applyEditPreset,
      }}/>
      {showChangePayment && isReopened && <ChangePaymentPopup ticketId={reopenedTicketId} payments={originalPayments} totalCents={alreadyPaidCents} onDone={function(){ setShowChangePayment(false); onDone(); }} onCancel={function(){ setShowChangePayment(false); }} />}
    </div>
  );
}
