import AreaTag from '../../components/ui/AreaTag';
import PinPopup from '../../components/ui/PinPopup';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Ticket Viewer
 * Open tickets (checkboxes, "Go to Checkout") + Closed tickets (view-only, detail, reopen).
 * TD-017: Ticket close/recall. TD-019: Tip distribution. TD-020: Void/refund.
 * Session 35: Void/refund PIN gate replaced with RBAC requirePermission.
 */
import { useState, useEffect } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_SETTINGS, CHECKOUT_STAFF } from './checkoutBridge';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';
import TipDistribution from './TipDistribution';
import TicketClosedDetail from './TicketClosedDetail';
import VoidFlow from './VoidFlow';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import RefundFlow from './RefundFlow';
import DateRangePicker from './DateRangePicker';
import { fmt, fp } from '../../lib/formatUtils';
import { useTicketStore } from '../../lib/stores/ticketStore';

function pad2(n){ return n<10?'0'+n:''+n; }
function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function timeStr(ts){ if(!ts)return''; const d=new Date(ts); let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${pad2(m)} ${ap}`; }
function agoStr(ts){ const m=Math.floor((Date.now()-ts)/60000); if(m<1)return'just now'; if(m<60)return m+'m ago'; return Math.floor(m/60)+'h ago'; }

function Av({name,size=28,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export default function TicketViewer({ openTickets: propOpen, closedTickets: propClosed, onBack, onReopen, onOpenTicketCheckout, onNewSale, onUpdateTicketTips, onAddTicketTip, onVoid, onRefund }){
  var C = useTheme();
  var rbac = useRBAC();
  // Read from store directly — props may be stale during navigation
  var storeOpen = useTicketStore(function(s) { return s.openTickets; });
  var storeClosed = useTicketStore(function(s) { return s.closedTickets; });
  var storeMerged = useTicketStore(function(s) { return s.mergedTickets; });
  var openTickets = storeOpen.length > 0 ? storeOpen : propOpen;
  var closedTickets = storeClosed.length > 0 ? storeClosed : propClosed;
  var mergedTickets = storeMerged || [];
  const [selectedOpen, setSelectedOpen] = useState([]); // ids of selected open tickets
  const [selectedClosedId, setSelectedClosedId] = useState(null);
  const [showReopenPin, setShowReopenPin] = useState(false);

  // Tip distribution on closed tickets
  const [showTipDist, setShowTipDist] = useState(false);
  const [showTipPin, setShowTipPin] = useState(false);

  // Add Tip on closed credit card tickets
  const [showAddTip, setShowAddTip] = useState(false);
  const [addTipInput, setAddTipInput] = useState('');
  const [addTipPending, setAddTipPending] = useState(null); // pending action: 'add_tip'

  // Void/Refund flows (M2-64 through M2-80) — PIN gate now handled by RBAC
  const [showVoidFlow, setShowVoidFlow] = useState(false);
  const [showRefundFlow, setShowRefundFlow] = useState(false);
  const [vrPinStaffName, setVrPinStaffName] = useState('');

  // Closed ticket filter
  const [closedFilter, setClosedFilter] = useState('all'); // all | needs_tip | complete
  const [showReceipt, setShowReceipt] = useState(false);

  // Date range — auto-fetches on mount and whenever dates change
  var _today = todayStr();
  const [fromDate, setFromDate] = useState(_today);
  const [toDate, setToDate] = useState(_today);
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var deleteTicket = useTicketStore(function(s) { return s.deleteTicket; });
  var deleteAllTickets = useTicketStore(function(s) { return s.deleteAllTickets; });
  var isToday = fromDate === _today && toDate === _today;

  // Auto-fetch on mount + whenever date range changes
  useEffect(function() {
    fetchTickets(fromDate, toDate);
  }, [fromDate, toDate]);

  // Date range picker popup
  var [showRangePicker, setShowRangePicker] = useState(false);

  const selectedClosed = closedTickets.find(t=>t.id===selectedClosedId);
  const tipPerm = CHECKOUT_SETTINGS.tip_edit_permission;
  const permission = CHECKOUT_SETTINGS.void_refund_permission || 'manager_owner';

  // Detect credit card tickets needing tip action
  function needsTipAction(ticket){
    if(ticket.tipAutoRemoved) return false;
    // Has tip but multi-tech and not distributed
    if(ticket.tipCents > 0 && ticketTechCount(ticket) > 1 && !ticket.tipDistributed) return 'split_tip';
    return false;
  }

  // Numpad helpers
  const npMode = CHECKOUT_SETTINGS.numpad_mode;
  function npDisplay(raw){ return npMode==='cash_register' ? (!raw?'0.00':(parseInt(raw,10)/100).toFixed(2)) : (raw||'0.00'); }
  function npTap(d,prev){
    if(d==='⌫') return prev.slice(0,-1);
    if(npMode==='cash_register'){ if(d==='.'||d==='00') return prev+'00'; if(!/\d/.test(d)) return prev; return prev+d; }
    if(d==='.'&&prev.includes('.')) return prev; return prev+d;
  }
  function npCents(raw){ return npMode==='cash_register' ? (parseInt(raw,10)||0) : Math.round(parseFloat(raw)*100)||0; }
  function npKeys(){ return npMode==='cash_register' ? ['7','8','9','4','5','6','1','2','3','00','0','⌫'] : ['7','8','9','4','5','6','1','2','3','.','0','⌫']; }

  // Keyboard → numpad bridge for add tip
  useNumpadKeyboard(showAddTip, function(d){ setAddTipInput(function(p){ return npTap(d,p); }); }, function(){ setAddTipInput(function(p){ return npTap('⌫',p); }); }, null, function(){ setShowAddTip(false); setAddTipInput(''); }, [showAddTip]);

  function toggleOpen(id){
    setSelectedOpen(prev=> prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  function handleCheckoutSelected(){
    if(selectedOpen.length===0) return;
    onOpenTicketCheckout(selectedOpen);
  }

  function ticketTotal(ticket){
    return ticket.items.reduce((s,it)=>s+(it.price_cents*(it.qty||1)),0);
  }

  // PIN success for reopen
  function handleReopenPinSuccess(staff) {
    setShowReopenPin(false);
    if (selectedClosed) { onReopen(selectedClosed); setSelectedClosedId(null); }
  }

  // Tip distribution — check PIN if required, then show distribution screen
  function handleDistributeTip(){
    setAddTipPending(null);
    if(tipPerm === 'no_pin'){ setShowTipDist(true); return; }
    setShowTipPin(true);
  }
  // Add Tip on closed credit card ticket — always requires manager/owner PIN
  function handleAddTipStart(){
    setAddTipPending('add_tip');
    setShowTipPin(true);
  }
  function hasCreditPayment(ticket){
    return ticket.payments && ticket.payments.some(function(p){ return p.method==='credit'; });
  }
  // PIN success for tip operations
  function handleTipPinSuccess(staff) {
    setShowTipPin(false);
    if (addTipPending === 'add_tip') { setShowAddTip(true); setAddTipInput(''); }
    else { setShowTipDist(true); }
  }
  // Confirm the added tip amount
  function confirmAddTip(){
    const cents = npCents(addTipInput);
    if(cents <= 0 || !selectedClosed) return;
    const multiTech = ticketTechCount(selectedClosed) > 1;
    if(multiTech){
      // Save tip amount first, then show distribution
      if(onAddTicketTip) onAddTicketTip(selectedClosed.id, cents, null);
      setShowAddTip(false); setAddTipInput('');
      setShowTipDist(true);
    } else {
      // Single tech — auto-assign
      const techId = selectedClosed.items.find(it=>it.techId)?.techId;
      const techName = selectedClosed.items.find(it=>it.techId)?.tech;
      const dists = techId ? [{techId, techName: techName||'Unknown', amount_cents: cents}] : null;
      if(onAddTicketTip) onAddTicketTip(selectedClosed.id, cents, dists);
      setShowAddTip(false); setAddTipInput('');
    }
  }

  // Count unique techs on a ticket
  function ticketTechCount(ticket){
    const ids = new Set();
    ticket.items.forEach(it=>{ if(it.techId) ids.add(it.techId); });
    return ids.size;
  }

  // Void/Refund — RBAC gated (Session 35)
  function handleVoidStart(){
    rbac.requirePermission(ACTIONS.VOID_TICKET, function(staff){
      setVrPinStaffName(staff ? staff.display_name : 'Staff');
      setShowVoidFlow(true);
    });
  }
  function handleRefundStart(){
    rbac.requirePermission(ACTIONS.PROCESS_REFUNDS, function(staff){
      setVrPinStaffName(staff ? staff.display_name : 'Staff');
      setShowRefundFlow(true);
    });
  }

  // ── PIN POPUPS (fixed overlays, must render before early returns) ──
  var pinPopups = (
    <>
      <PinPopup show={showReopenPin} title="Enter manager or owner PIN to reopen this ticket" onSuccess={handleReopenPinSuccess} onCancel={function(){ setShowReopenPin(false); }} />
      <PinPopup show={showTipPin} title={addTipPending==='add_tip' ? 'Enter manager or owner PIN to add a tip' : 'Enter PIN to edit tip distribution'} onSuccess={handleTipPinSuccess} onCancel={function(){ setShowTipPin(false); setAddTipPending(null); }} />
    </>
  );

  // ── VOID FLOW ──
  if(showVoidFlow && selectedClosed){
    return <>{pinPopups}<VoidFlow ticket={selectedClosed} staffName={vrPinStaffName}
      onConfirm={function(data){ if(onVoid) onVoid(selectedClosed.id, data); setShowVoidFlow(false); setSelectedClosedId(null); }}
      onCancel={function(){ setShowVoidFlow(false); }} /></>;
  }

  // ── REFUND FLOW ──
  if(showRefundFlow && selectedClosed){
    return <>{pinPopups}<RefundFlow ticket={selectedClosed} staffName={vrPinStaffName}
      onConfirm={function(data){ if(onRefund){ onRefund(selectedClosed.id, data).then(function(){ setShowRefundFlow(false); setTimeout(function(){ fetchTickets(); }, 500); }).catch(function(){ setShowRefundFlow(false); }); } else { setShowRefundFlow(false); } }}
      onCancel={function(){ setShowRefundFlow(false); }} /></>;
  }

  // ── ADD TIP SCREEN (credit card closed tickets) ──
  if(showAddTip && selectedClosed){
    const ticketBase = selectedClosed.totalCents - (selectedClosed.tipCents||0); // total minus any existing tip
    const presets = CHECKOUT_SETTINGS.tip_presets;
    const tipVal = npCents(addTipInput);
    return(
      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <div style={{width:360,textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Add Tip</div>
          <div style={{color:C.textPrimary,fontSize:13,marginBottom:16}}>Ticket #{selectedClosed.ticketNumber} · {selectedClosed.clientName||'Walk-in'} · {fmt(ticketBase)}</div>
          {/* Preset % buttons */}
          <div style={{display:'grid',gridTemplateColumns:`repeat(${presets.length},1fr)`,gap:6,marginBottom:12}}>
            {presets.map(pct=>{
              const amt=Math.round(ticketBase*pct/100);
              return(
                <div key={pct} onClick={()=>{ if(onAddTicketTip){
                  const multi = ticketTechCount(selectedClosed)>1;
                  if(multi){ onAddTicketTip(selectedClosed.id, amt, null); setShowAddTip(false); setShowTipDist(true); }
                  else { const tId=selectedClosed.items.find(it=>it.techId)?.techId; const tN=selectedClosed.items.find(it=>it.techId)?.tech; onAddTicketTip(selectedClosed.id, amt, tId?[{techId:tId,techName:tN||'Unknown',amount_cents:amt}]:null); setShowAddTip(false); }
                }}}
                  style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'12px 6px',background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:8,cursor:'pointer',fontFamily:'inherit',userSelect:'none'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=C.blueTint;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}>
                  <span style={{color:C.textPrimary,fontSize:16,fontWeight:600}}>{pct}%</span>
                  <span style={{color:C.textPrimary,fontSize:12}}>{fmt(amt)}</span>
                </div>
              );
            })}
          </div>
          {/* Custom amount */}
          <div style={{fontSize:11,color:C.textPrimary,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:6}}>Custom Amount</div>
          <div style={{background:C.grid,borderRadius:8,padding:'12px 16px',marginBottom:10}}>
            <span style={{color:C.textPrimary,fontSize:28,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${npDisplay(addTipInput)}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,maxWidth:280,margin:'0 auto'}}>
            {npKeys().map(d=>(
              <div key={d} onClick={()=>setAddTipInput(prev=>npTap(d,prev))}
                style={{height:50,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:12,maxWidth:280,margin:'12px auto 0'}}>
            <button onClick={()=>{setShowAddTip(false);setAddTipInput('');}} style={{flex:1,height:42,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            <button onClick={confirmAddTip} disabled={tipVal<=0}
              style={{flex:1,height:42,background:tipVal>0?C.blue:'#334155',border:'none',borderRadius:6,color:tipVal>0?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:tipVal>0?'pointer':'default',fontFamily:'inherit'}}>
              Add {tipVal>0?fmt(tipVal):''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TIP DISTRIBUTION SCREEN (from closed ticket) ──
  if(showTipDist && selectedClosed && selectedClosed.tipCents > 0){
    return <TipDistribution
      tipAmount={selectedClosed.tipCents}
      items={selectedClosed.items}
      defaultMode={CHECKOUT_SETTINGS.tip_distribution_mode}
      initialDistributions={selectedClosed.tipDistributions || null}
      canSkip={false}
      onConfirm={function(dists){
        if(onUpdateTicketTips) onUpdateTicketTips(selectedClosed.id, dists);
        setShowTipDist(false);
      }}
      onSkip={function(){ setShowTipDist(false); }}
    />;
  }

  // ── CLOSED TICKET DETAIL (extracted to TicketClosedDetail.jsx, C9) ──
  if(selectedClosed){
    return <TicketClosedDetail
      ticket={selectedClosed} pinPopups={pinPopups}
      onBack={function(){ setSelectedClosedId(null); }}
      onReopenPin={function(){ setShowReopenPin(true); }}
      onDistributeTip={handleDistributeTip}
      onAddTipStart={handleAddTipStart}
      onVoidStart={handleVoidStart}
      onRefundStart={handleRefundStart}
      onReceipt={function(){ setShowReceipt(true); }}
      showReceipt={showReceipt} setShowReceipt={setShowReceipt}
      permission={permission}
      deleteTicket={deleteTicket} fetchTickets={fetchTickets}
      fromDate={fromDate} toDate={toDate}
    />;
  }

  // ── MAIN LIST — open + closed ──
  const sortedOpen = [...openTickets].sort((a,b)=>a.ticketNumber-b.ticketNumber);
  const sortedClosed = [...closedTickets].sort((a,b)=>a.ticketNumber-b.ticketNumber);

  function displayDateShort(str) {
    var p = str.split('-');
    return parseInt(p[1])+'-'+parseInt(p[2])+'-'+p[0];
  }
  function shiftDate(str, days) {
    var d = new Date(str+'T12:00:00');
    d.setDate(d.getDate()+days);
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }
  var isSingleDay = fromDate === toDate;
  var dateLabel = isSingleDay ? displayDateShort(fromDate) : displayDateShort(fromDate)+' — '+displayDateShort(toDate);

  return(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",overflow:'hidden',alignItems:'center',position:'relative'}}>
      <AreaTag id="TK" />
      <div style={{width:'100%',maxWidth:800,display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:C.textMuted}}>{openTickets.length} open · {closedTickets.length} closed</div>
          </div>
          <button onClick={onBack} style={{height:36,padding:'0 16px',background:C.blue,border:'none',borderRadius:7,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Back to Calendar</button>
        </div>
        {/* Date navigator */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <div onClick={function(){ var nf=shiftDate(fromDate,-1); var nt=shiftDate(toDate,-1); setFromDate(nf); setToDate(nt); }}
            style={{width:40,height:40,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:C.chromeDark,border:'1px solid '+C.borderMedium,fontSize:18,color:C.textPrimary,fontWeight:700}}
            onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>‹</div>
          <div onClick={function(){ setShowRangePicker(true); }}
            style={{padding:'8px 20px',borderRadius:8,cursor:'pointer',background:C.chromeDark,border:'2px solid '+C.borderMedium,textAlign:'center',minWidth:160}}
            onMouseEnter={function(e){e.currentTarget.style.borderColor=C.blue;}}
            onMouseLeave={function(e){e.currentTarget.style.borderColor=C.borderMedium;}}>
            <div style={{fontSize:15,fontWeight:700,color:C.textPrimary}}>{dateLabel}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Tap to set range</div>
          </div>
          <div onClick={function(){ var nf=shiftDate(fromDate,1); var nt=shiftDate(toDate,1); setFromDate(nf); setToDate(nt); }}
            style={{width:40,height:40,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:C.chromeDark,border:'1px solid '+C.borderMedium,fontSize:18,color:C.textPrimary,fontWeight:700}}
            onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>›</div>
          <div onClick={function(){ setFromDate(_today); setToDate(_today); }}
            style={{padding:'8px 16px',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',background:isToday?C.blue:C.chromeDark,color:isToday?'#fff':C.blueLight,border:isToday?'none':'2px solid '+C.borderMedium}}
            onMouseEnter={function(e){ if(!isToday) e.currentTarget.style.background=C.gridHover;}}
            onMouseLeave={function(e){ if(!isToday) e.currentTarget.style.background=C.chromeDark;}}>Today</div>
          <div onClick={function(){rbac.requirePermission(ACTIONS.VOID_TICKET,function(){if(confirm('DELETE ALL TICKETS for this salon? This cannot be undone.')){deleteAllTickets().then(function(n){alert('Deleted '+n+' tickets');fetchTickets(fromDate,toDate);}).catch(function(e){alert(e.message);});}});}}
            style={{padding:'8px 12px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',background:C.chromeDark,color:C.danger,border:'1px solid '+C.danger}}
            onMouseEnter={function(e){e.currentTarget.style.background='rgba(239,68,68,0.15)';}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>Delete All</div>
        </div>
      </div>

      {/* Date range picker popup */}
      {showRangePicker && <DateRangePicker fromDate={fromDate} toDate={toDate} onApply={function(f,t){ setFromDate(f); setToDate(t); setShowRangePicker(false); }} onCancel={function(){ setShowRangePicker(false); }} />}

      <div style={{flex:1,overflow:'auto',padding:'8px 16px'}}>
        {/* ── OPEN TICKETS ── */}
        {sortedOpen.length>0&&(
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,marginTop:4}}>
              <div style={{fontSize:13,fontWeight:600,color:C.warning}}>Open — Waiting to Pay</div>
              <div style={{padding:'2px 8px',borderRadius:10,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:11,fontWeight:600}}>{sortedOpen.length}</div>
            </div>
            {sortedOpen.map(ticket=>{
              const checked=selectedOpen.includes(ticket.id);
              const total=ticketTotal(ticket);
              // Group services by tech
              const byTech={};
              ticket.items.forEach(it=>{
                const k=it.tech||'Unknown';
                if(!byTech[k]) byTech[k]=[];
                byTech[k].push(it);
              });
              return(
                <button key={ticket.id} onClick={()=>toggleOpen(ticket.id)}
                  style={{display:'flex',alignItems:'stretch',gap:14,width:'100%',padding:'14px 16px',background:checked?C.blueTint:C.chromeDark,border:checked?`1px solid ${C.blue}`:`1px solid ${C.borderLight}`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:8}}
                  onMouseEnter={e=>{if(!checked){e.currentTarget.style.borderColor=C.blue;}}}
                  onMouseLeave={e=>{if(!checked){e.currentTarget.style.borderColor=C.borderLight;}}}>
                  {/* Checkbox */}
                  <div style={{display:'flex',alignItems:'center',flexShrink:0}}>
                    <div style={{width:24,height:24,borderRadius:4,border:checked?`2px solid ${C.blue}`:`2px solid ${C.borderMedium}`,background:checked?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {checked&&<span style={{color:'#fff',fontSize:14,fontWeight:700}}>✓</span>}
                    </div>
                  </div>
                  {/* Ticket # */}
                  <div style={{width:50,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{width:50,height:50,borderRadius:8,background:'rgba(217,119,6,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{color:C.warning,fontSize:15,fontWeight:700}}>#{ticket.ticketNumber}</span>
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <span style={{color:C.textPrimary,fontSize:16,fontWeight:600}}>{ticket.clientName||'Walk-in'}</span>
                      <span style={{color:C.textPrimary,fontSize:12}}>{agoStr(ticket.createdAt)}</span>
                    </div>
                    {Object.entries(byTech).map(([tech, items])=>(
                      <div key={tech} style={{marginBottom:4}}>
                        <span style={{color:C.blueLight,fontSize:13,fontWeight:600}}>{tech}</span>
                        <span style={{color:C.textPrimary,fontSize:13}}> — {items.map(it=>it.name).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                  {/* Total */}
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',justifyContent:'center',flexShrink:0}}>
                    <div style={{color:C.textPrimary,fontSize:18,fontWeight:700}}>{fmt(total)}</div>
                    {ticket.depositCents>0&&<div style={{color:C.blueLight,fontSize:11,marginTop:2}}>Deposit: {fmt(ticket.depositCents)}</div>}
                  </div>
                </button>
              );
            })}
            {/* Go to Checkout bar */}
            {selectedOpen.length>0&&(
              <div style={{display:'flex',gap:8,marginBottom:12,marginTop:4}}>
                <button onClick={()=>setSelectedOpen([])} style={{height:40,padding:'0 16px',background:'transparent',border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Clear</button>
                <button onClick={handleCheckoutSelected} style={{height:40,padding:'0 16px',background:C.success,border:'none',borderRadius:6,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  Go to Checkout ({selectedOpen.length} ticket{selectedOpen.length!==1?'s':''})
                </button>
              </div>
            )}
          </>
        )}

        {/* ── CLOSED TICKETS ── */}
        {sortedClosed.length>0&&(
          <>
            {/* Header + filter tabs */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,marginTop:sortedOpen.length>0?12:4}}>
              <div style={{fontSize:13,fontWeight:600,color:C.success}}>Closed — Paid</div>
              <div style={{padding:'2px 8px',borderRadius:10,background:'rgba(5,150,105,0.15)',color:C.success,fontSize:11,fontWeight:600}}>{sortedClosed.length}</div>
              <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                {[{id:'all',label:'All'},{id:'needs_tip',label:'Needs Tip'},{id:'complete',label:'Complete'}].map(f=>{
                  const active=closedFilter===f.id;
                  const count=f.id==='needs_tip'?sortedClosed.filter(t=>!!needsTipAction(t)).length:f.id==='complete'?sortedClosed.filter(t=>!needsTipAction(t)).length:sortedClosed.length;
                  return(
                    <button key={f.id} onClick={()=>setClosedFilter(f.id)}
                      style={{height:26,padding:'0 10px',background:active?C.blueTint:'transparent',border:active?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:13,color:active?C.blueLight:C.textMuted,fontSize:11,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}
                      onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor=C.blue;}}
                      onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor=C.borderMedium;}}>
                      {f.label}
                      {f.id==='needs_tip'&&count>0&&<span style={{minWidth:16,height:16,borderRadius:8,background:C.warning,color:'#fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {(()=>{
              const filtered = closedFilter==='needs_tip' ? sortedClosed.filter(t=>!!needsTipAction(t))
                : closedFilter==='complete' ? sortedClosed.filter(t=>!needsTipAction(t))
                : sortedClosed;
              if(filtered.length===0) return(
                <div style={{padding:'30px 20px',textAlign:'center'}}>
                  <div style={{color:C.textPrimary,fontSize:13}}>{closedFilter==='needs_tip'?'All tips are handled ✓':'No completed tickets yet'}</div>
                </div>
              );
              return filtered.map(ticket=>{
                const byTech={};
                ticket.items.forEach(it=>{
                  const k=it.tech||'Unknown';
                  if(!byTech[k]) byTech[k]=[];
                  byTech[k].push(it);
                });
                const tipAction = needsTipAction(ticket);
                const needsAttention = !!tipAction;
                const isVoided = !!ticket.voided;
                const hasRefund = ticket.refunds && ticket.refunds.length > 0;
                const borderColor = isVoided ? 'rgba(239,68,68,0.3)' : needsAttention ? 'rgba(217,119,6,0.4)' : C.borderLight;
                return(
                  <button key={ticket.id} onClick={()=>setSelectedClosedId(ticket.id)}
                    style={{display:'flex',alignItems:'stretch',gap:14,width:'100%',padding:'14px 16px',background:isVoided?'rgba(239,68,68,0.04)':C.chromeDark,border:`1px solid ${borderColor}`,borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:8,opacity:isVoided?0.7:1}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=isVoided?'rgba(239,68,68,0.06)':C.blueTint;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=borderColor;e.currentTarget.style.background=isVoided?'rgba(239,68,68,0.04)':C.chromeDark;}}>
                    <div style={{width:50,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <div style={{width:50,height:50,borderRadius:8,background:isVoided?'rgba(239,68,68,0.12)':C.grid,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{color:isVoided?C.danger:C.textPrimary,fontSize:ticket.displayNumber?12:15,fontWeight:700}}>#{ticket.displayNumber||ticket.ticketNumber}</span>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{color:isVoided?C.textMuted:C.textPrimary,fontSize:16,fontWeight:600,textDecoration:isVoided?'line-through':'none'}}>{ticket.clientName||'Walk-in'}</span>
                        <span style={{color:C.textPrimary,fontSize:12}}>{timeStr(ticket.closedAt)}</span>
                        {isVoided&&<span style={{padding:'2px 6px',borderRadius:4,background:'rgba(239,68,68,0.2)',color:C.danger,fontSize:10,fontWeight:700}}>VOID</span>}
                        {hasRefund&&!isVoided&&(function(){ var isPkgRefund=ticket.refunds[0]&&ticket.refunds[0].pkgCreditsRestored; return <span style={{padding:'2px 6px',borderRadius:4,background:isPkgRefund?'rgba(139,92,246,0.2)':'rgba(217,119,6,0.2)',color:isPkgRefund?'#8B5CF6':C.warning,fontSize:10,fontWeight:600}}>{isPkgRefund?'📦 Pkg Refund':'Refund'}</span>; })()}
                        {tipAction==='split_tip'&&!isVoided&&<span style={{padding:'2px 6px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>💰 Split Tip</span>}
                      </div>
                      {Object.entries(byTech).map(([tech, items])=>(
                        <div key={tech} style={{marginBottom:4}}>
                          <span style={{color:isVoided?C.textMuted:C.blueLight,fontSize:13,fontWeight:600}}>{tech}</span>
                          <span style={{color:C.textPrimary,fontSize:13}}> — {items.map(it=>it.name).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',justifyContent:'center',flexShrink:0}}>
                      <div style={{color:isVoided?C.danger:C.textPrimary,fontSize:18,fontWeight:700,textDecoration:isVoided?'line-through':'none'}}>{fmt(ticket.totalCents)}</div>
                      <div style={{color:isVoided?C.danger:C.success,fontSize:11,fontWeight:500,marginTop:2}}>{isVoided?'Voided':ticket._placeholder?'Saving…':'Paid'}</div>
                      {!isVoided&&ticket.payments&&ticket.payments.length>0&&(function(){
                        var MC={cash:'#22C55E',credit:'#38BDF8',giftcard:'#F59E0B',zelle:'#8B5CF6'};
                        var MN={cash:'Cash',credit:'Credit',giftcard:'Gift Card',zelle:'Zelle'};
                        var seen={};var unique=[];
                        ticket.payments.forEach(function(p){if(!seen[p.method]){seen[p.method]=true;unique.push(p.method);}});
                        var label=unique.map(function(m){return MN[m]||m;}).join(' + ');
                        var color=unique.length===1?(MC[unique[0]]||'#94A3B8'):'#94A3B8';
                        return <div style={{fontSize:10,fontWeight:600,marginTop:2,color:color}}>{label}</div>;
                      })()}
                    </div>
                  </button>
                );
              });
            })()}
          </>
        )}

        {/* ── MERGED TICKETS (grayed out, bottom of list) ── */}
        {mergedTickets.length>0&&(
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,marginTop:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.textMuted}}>Merged</div>
              <div style={{padding:'2px 8px',borderRadius:10,background:C.grid,color:C.textMuted,fontSize:11,fontWeight:600}}>{mergedTickets.length}</div>
            </div>
            {mergedTickets.map(function(ticket){
              var absorberTicket = closedTickets.concat(openTickets).find(function(t){ return t.id === ticket.mergedInto; });
              var absorberNum = absorberTicket ? (absorberTicket.displayNumber || absorberTicket.ticketNumber) : '?';
              return(
                <div key={ticket.id} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'14px 16px',background:C.chromeDark,border:'1px solid '+C.borderLight,borderRadius:10,marginBottom:8,opacity:0.5,cursor:'default'}}>
                  <div style={{width:50,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{width:50,height:50,borderRadius:8,background:C.grid,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{color:C.textMuted,fontSize:15,fontWeight:700}}>#{ticket.ticketNumber}</span>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <span style={{color:C.textMuted,fontSize:14,fontWeight:500}}>{ticket.clientName||'Walk-in'}</span>
                    <div style={{color:C.textMuted,fontSize:12,marginTop:2}}>Merged → #{absorberNum}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {sortedOpen.length===0&&sortedClosed.length===0&&(
          <div style={{padding:'60px 20px',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>🧾</div>
            <div style={{color:C.textPrimary,fontSize:14}}>No tickets yet today</div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
