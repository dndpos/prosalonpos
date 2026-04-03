import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Ticket Viewer
 * Open tickets (checkboxes, "Go to Checkout") + Closed tickets (view-only, detail, reopen).
 * TD-017: Ticket close/recall. TD-019: Tip distribution. TD-020: Void/refund.
 * Session 35: Void/refund PIN gate replaced with RBAC requirePermission.
 */
import { useState } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_SETTINGS, CHECKOUT_STAFF } from './checkoutBridge';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';
import TipDistribution from './TipDistribution';
import ReceiptPreview from './ReceiptPreview';
import VoidFlow from './VoidFlow';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import RefundFlow from './RefundFlow';
import { fmt, fp } from '../../lib/formatUtils';

function pad2(n){ return n<10?'0'+n:''+n; }
function timeStr(ts){ if(!ts)return''; const d=new Date(ts); let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${pad2(m)} ${ap}`; }
function agoStr(ts){ const m=Math.floor((Date.now()-ts)/60000); if(m<1)return'just now'; if(m<60)return m+'m ago'; return Math.floor(m/60)+'h ago'; }

function Av({name,size=28,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export default function TicketViewer({ openTickets, closedTickets, onBack, onReopen, onOpenTicketCheckout, onNewSale, onUpdateTicketTips, onAddTicketTip, onVoid, onRefund }){
  var C = useTheme();
  var rbac = useRBAC();
  const [selectedOpen, setSelectedOpen] = useState([]); // ids of selected open tickets
  const [selectedClosedId, setSelectedClosedId] = useState(null);
  const [showReopenPin, setShowReopenPin] = useState(false);
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState(false);

  // Tip distribution on closed tickets
  const [showTipDist, setShowTipDist] = useState(false);
  const [showTipPin, setShowTipPin] = useState(false);
  const [tipPinDigits, setTipPinDigits] = useState('');
  const [tipPinError, setTipPinError] = useState(false);

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

  // PIN check for reopen
  function handlePinTap(d){
    if(pinDigits.length>=8) return;
    const next=pinDigits+d; setPinDigits(next); setPinError(false);
    if(next.length>=2){
      const match=CHECKOUT_STAFF.find(s=>s.pin===next);
      const mockAllowed=!!match&&(permission==='all_staff'||match.id==='s1');
      if(mockAllowed){ onReopen(selectedClosed); setShowReopenPin(false); setPinDigits(''); setSelectedClosedId(null); }
      else if(next.length>=8){ setPinError(true); setTimeout(()=>{setPinDigits('');setPinError(false);},1000); }
    }
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
  function handleTipPinTap(d){
    if(tipPinDigits.length>=4) return;
    const next=tipPinDigits+d; setTipPinDigits(next); setTipPinError(false);
    if(next.length===4){
      const match=CHECKOUT_STAFF.find(s=>s.pin===next);
      // Add Tip always requires manager/owner (mock: s1). Distribute uses tipPerm.
      const perm = addTipPending==='add_tip' ? 'manager_owner' : tipPerm;
      const mockAllowed=!!match&&(perm==='all_staff'||match.id==='s1');
      if(mockAllowed){
        setShowTipPin(false); setTipPinDigits('');
        if(addTipPending==='add_tip'){ setShowAddTip(true); setAddTipInput(''); }
        else { setShowTipDist(true); }
      }
      else { setTipPinError(true); setTimeout(()=>{setTipPinDigits('');setTipPinError(false);},1000); }
    }
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

  // ── VOID FLOW ──
  if(showVoidFlow && selectedClosed){
    return <VoidFlow ticket={selectedClosed} staffName={vrPinStaffName}
      onConfirm={function(data){ if(onVoid) onVoid(selectedClosed.id, data); setShowVoidFlow(false); setSelectedClosedId(null); }}
      onCancel={function(){ setShowVoidFlow(false); }} />;
  }

  // ── REFUND FLOW ──
  if(showRefundFlow && selectedClosed){
    return <RefundFlow ticket={selectedClosed} staffName={vrPinStaffName}
      onConfirm={function(data){ if(onRefund) onRefund(selectedClosed.id, data); setShowRefundFlow(false); setSelectedClosedId(null); }}
      onCancel={function(){ setShowRefundFlow(false); }} />;
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

  // ── TIP EDIT PIN GATE ──
  if(showTipPin){
    const isAddTip = addTipPending==='add_tip';
    const permLabel = isAddTip ? 'manager or owner' : (tipPerm==='all_staff'?'staff':'manager or owner');
    const permAction = isAddTip ? 'add a tip to this ticket' : 'edit tip distribution';
    return(
      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <div style={{width:320,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:6}}>PIN Required</div>
          <div style={{color:C.textPrimary,fontSize:13,marginBottom:24}}>Enter {permLabel} PIN to {permAction}</div>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20}}>
            {[0,1,2,3].map(i=>(<div key={i} style={{width:18,height:18,borderRadius:'50%',background:tipPinError?C.danger:i<tipPinDigits.length?C.blueLight:'transparent',border:tipPinError?`2px solid ${C.danger}`:i<tipPinDigits.length?'2px solid transparent':`2px solid ${C.borderMedium}`,transition:'all 0.15s'}}/>))}
          </div>
          {tipPinError&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>Not authorized — try again</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,maxWidth:260,margin:'0 auto'}}>
            {['7','8','9','4','5','6','1','2','3'].map(d=>(<div key={d} onClick={()=>handleTipPinTap(d)} style={{height:56,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:8,color:C.btnText,fontSize:22,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>))}
            <div onClick={()=>{setTipPinDigits('');setTipPinError(false);}} style={{height:56,background:'#334155',border:'1px solid #475569',borderRadius:8,color:C.warning,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>Clear</div>
            <div onClick={()=>handleTipPinTap('0')} style={{height:56,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:8,color:C.btnText,fontSize:22,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>0</div>
            <div onClick={()=>setTipPinDigits(prev=>prev.slice(0,-1))} style={{height:56,background:'#334155',border:'1px solid #475569',borderRadius:8,color:C.danger,fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>⌫</div>
          </div>
          <button onClick={()=>{setShowTipPin(false);setTipPinDigits('');}} style={{marginTop:20,background:'none',border:'none',color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── REOPEN PIN GATE ──
  if(showReopenPin){
    return(
      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <div style={{width:320,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Manager PIN Required</div>
          <div style={{color:C.textPrimary,fontSize:13,marginBottom:24}}>Enter manager or owner PIN to reopen this ticket</div>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20}}>
            {[0,1,2,3].map(i=>(<div key={i} style={{width:18,height:18,borderRadius:'50%',background:pinError?C.danger:i<pinDigits.length?C.blueLight:'transparent',border:pinError?`2px solid ${C.danger}`:i<pinDigits.length?'2px solid transparent':`2px solid ${C.borderMedium}`,transition:'all 0.15s'}}/>))}
          </div>
          {pinError&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>Not authorized — try again</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,maxWidth:260,margin:'0 auto'}}>
            {['7','8','9','4','5','6','1','2','3'].map(d=>(<div key={d} onClick={()=>handlePinTap(d)} style={{height:56,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:8,color:C.btnText,fontSize:22,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>))}
            <div onClick={()=>{setPinDigits('');setPinError(false);}} style={{height:56,background:'#334155',border:'1px solid #475569',borderRadius:8,color:C.warning,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>Clear</div>
            <div onClick={()=>handlePinTap('0')} style={{height:56,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:8,color:C.btnText,fontSize:22,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>0</div>
            <div onClick={()=>setPinDigits(prev=>prev.slice(0,-1))} style={{height:56,background:'#334155',border:'1px solid #475569',borderRadius:8,color:C.danger,fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>⌫</div>
          </div>
          <button onClick={()=>{setShowReopenPin(false);setPinDigits('');}} style={{marginTop:20,background:'none',border:'none',color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── CLOSED TICKET DETAIL ──
  if(selectedClosed){
    const groups={};
    selectedClosed.items.forEach(it=>{
      const k=it.techId||'__none__';
      if(!groups[k]) groups[k]={techName:it.tech,items:[]};
      groups[k].items.push(it);
    });
    const techGroups=Object.values(groups);
    const multiTech = ticketTechCount(selectedClosed) > 1;
    const hasTip = selectedClosed.tipCents > 0;
    const undistributed = hasTip && multiTech && !selectedClosed.tipDistributed;
    return(
      <>
      {showReceipt && <ReceiptPreview ticket={selectedClosed} onClose={()=>setShowReceipt(false)}/>}
      <div style={{width:'100%',height:'100%',display:'flex',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",overflow:'hidden'}}>
        <div style={{width:360,minWidth:360,background:C.chromeDark,borderRight:`1px solid ${C.borderLight}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setSelectedClosedId(null)} style={{background:'none',border:'none',color:C.textPrimary,fontSize:18,cursor:'pointer',padding:'2px 6px'}}>←</button>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>Ticket #{selectedClosed.ticketNumber}</div>
              <div style={{fontSize:11,color:C.textPrimary}}>{timeStr(selectedClosed.closedAt)}{selectedClosed.clientName?` · ${selectedClosed.clientName}`:''}</div>
            </div>
            <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
              {undistributed&&!selectedClosed.voided&&<div style={{padding:'3px 8px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>Tip Undistributed</div>}
              {selectedClosed.refunds&&selectedClosed.refunds.length>0&&!selectedClosed.voided&&<div style={{padding:'3px 8px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>Refund Applied</div>}
              {selectedClosed.voided ? (
                <div style={{padding:'3px 8px',borderRadius:4,background:'rgba(239,68,68,0.2)',color:C.danger,fontSize:11,fontWeight:700}}>VOID</div>
              ) : (
                <div style={{padding:'3px 8px',borderRadius:4,background:'rgba(5,150,105,0.15)',color:C.success,fontSize:11,fontWeight:500}}>Closed</div>
              )}
            </div>
          </div>
          <div style={{flex:1,overflow:'auto',padding:'8px 10px'}}>
            {techGroups.map(g=>(<div key={g.techName||'none'} style={{marginBottom:10}}>
              {g.techName&&<div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',marginBottom:3}}><Av name={g.techName} size={20} photo={CHECKOUT_STAFF.find(s=>s.display_name===g.techName)?.photo_url}/><span style={{color:C.textPrimary,fontSize:12,fontWeight:600}}>{g.techName}</span></div>}
              {g.items.map(it=>(<div key={it.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',marginBottom:2,borderRadius:4,background:C.grid}}>
                {it.color&&<div style={{width:4,height:20,borderRadius:2,background:it.color,flexShrink:0}}/>}
                <span style={{color:C.textPrimary,fontSize:12,fontWeight:500,flex:1}}>{it.name}{it.qty>1?` ×${it.qty}`:''}</span>
                <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{fmt(it.price_cents*(it.qty||1))}</span>
              </div>))}
            </div>))}
            {selectedClosed.discounts?.map(d=>(<div key={d.id} style={{display:'flex',alignItems:'center',padding:'4px 6px',marginBottom:2,borderRadius:4,background:'rgba(5,150,105,0.08)'}}>
              <span style={{color:C.success,fontSize:11,flex:1}}>{d.desc}</span>
              <span style={{color:C.success,fontSize:11,fontWeight:500}}>−{fmt(d.type==='flat_total'?d.value:Math.round(selectedClosed.subtotalCents*d.value/100))}</span>
            </div>))}
          </div>
          <div style={{borderTop:`1px solid ${C.borderLight}`,padding:'8px 12px',flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Subtotal</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(selectedClosed.subtotalCents)}</span></div>
            {selectedClosed.discountCents>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.success,fontSize:11}}>Discounts</span><span style={{color:C.success,fontSize:11}}>−{fmt(selectedClosed.discountCents)}</span></div>}
            {selectedClosed.depositCents>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.blueLight,fontSize:11}}>Deposit</span><span style={{color:C.blueLight,fontSize:11}}>−{fmt(selectedClosed.depositCents)}</span></div>}
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Tax</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(selectedClosed.taxCents)}</span></div>
            {hasTip&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Tip</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(selectedClosed.tipCents)}</span></div>}
            <div style={{height:1,background:C.borderMedium,margin:'3px 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><span style={{color:C.textPrimary,fontSize:14,fontWeight:600}}>Total</span><span style={{color:C.textPrimary,fontSize:18,fontWeight:700}}>{fmt(selectedClosed.totalCents)}</span></div>
            {selectedClosed.payments.map((p,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',marginTop:2}}><span style={{color:C.success,fontSize:11}}>Paid ({p.method})</span><span style={{color:C.success,fontSize:11}}>{fmt(p.amount_cents)}</span></div>))}
            {selectedClosed.receiptMethod&&selectedClosed.receiptMethod!=='none'&&<div style={{marginTop:6,color:C.textPrimary,fontSize:10}}>Receipt: {selectedClosed.receiptMethod}</div>}
            {selectedClosed.tipAutoRemoved&&<div style={{marginTop:4,color:C.warning,fontSize:10}}>Tip collected outside system (cash/zelle)</div>}
            {selectedClosed.voided&&(
              <div style={{marginTop:6,padding:'6px 8px',background:'rgba(239,68,68,0.08)',borderRadius:4}}>
                <div style={{color:C.danger,fontSize:10,fontWeight:600,marginBottom:2}}>VOIDED</div>
                <div style={{color:C.textPrimary,fontSize:10}}>Reason: {selectedClosed.voidReason}</div>
                <div style={{color:C.textPrimary,fontSize:10}}>By: {selectedClosed.voidedBy} · {timeStr(selectedClosed.voidedAt)}</div>
                {selectedClosed.voidReverseTip!==undefined&&<div style={{color:C.textPrimary,fontSize:10}}>Tip: {selectedClosed.voidReverseTip?'Reversed':'Kept'}</div>}
              </div>
            )}
            {selectedClosed.refunds&&selectedClosed.refunds.length>0&&!selectedClosed.voided&&(
              <div style={{marginTop:6}}>
                {selectedClosed.refunds.map((rf,ri)=>(
                  <div key={ri} style={{padding:'6px 8px',background:'rgba(217,119,6,0.08)',borderRadius:4,marginBottom:4}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                      <span style={{color:C.warning,fontSize:10,fontWeight:600}}>Refund #{ri+1}</span>
                      <span style={{color:C.warning,fontSize:11,fontWeight:600}}>−{fmt(rf.refundTotal_cents)}</span>
                    </div>
                    {rf.items.map(rfi=><div key={rfi.itemId} style={{color:C.textPrimary,fontSize:10}}>{rfi.name}: −{fmt(rfi.refundAmount_cents)}</div>)}
                    {rf.refundTax_cents>0&&<div style={{color:C.textPrimary,fontSize:10}}>Tax: −{fmt(rf.refundTax_cents)}</div>}
                    {rf.refundTip&&<div style={{color:C.textPrimary,fontSize:10}}>Tip refunded: −{fmt(rf.tipRefunded_cents)}</div>}
                    <div style={{color:C.textPrimary,fontSize:10}}>Reason: {rf.reasonPreset}{rf.reasonText?' — '+rf.reasonText:''}</div>
                    <div style={{color:C.textPrimary,fontSize:10}}>By: {rf.processedBy} · {timeStr(rf.processedAt)} · {rf.refundMethod}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{padding:'8px 12px',borderTop:`1px solid ${C.borderLight}`,display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
            {selectedClosed.voided ? (
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setSelectedClosedId(null)} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Back</button>
                <button onClick={()=>setShowReceipt(true)} style={{flex:1,height:40,background:C.grid,border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🧾 Receipt</button>
              </div>
            ) : (
              <>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setSelectedClosedId(null)} style={{flex:1,height:36,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Back</button>
                  <button onClick={()=>setShowReceipt(true)} style={{flex:1,height:36,background:C.grid,border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🧾 Receipt</button>
                  <button onClick={()=>setShowReopenPin(true)} style={{flex:1,height:36,background:C.warning,border:'none',borderRadius:6,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Reopen</button>
                </div>
                <div style={{display:'flex',gap:6}}>
                  {(function(){
                    var hasRefunds = selectedClosed.refunds && selectedClosed.refunds.length > 0;
                    var closedDate = selectedClosed.closedAt ? new Date(selectedClosed.closedAt) : null;
                    var today = new Date();
                    var isToday = closedDate && closedDate.getFullYear()===today.getFullYear() && closedDate.getMonth()===today.getMonth() && closedDate.getDate()===today.getDate();
                    var voidDisabled = hasRefunds || !isToday;
                    var voidTip = hasRefunds ? 'Cannot void — refund exists' : !isToday ? 'Cannot void — not today' : '';
                    return(
                      <>
                        <button onClick={voidDisabled?undefined:handleVoidStart} disabled={voidDisabled} title={voidTip}
                          style={{flex:1,height:36,background:'transparent',border:`1px solid ${voidDisabled?C.borderMedium:C.danger}`,borderRadius:6,color:voidDisabled?C.textMuted:C.danger,fontSize:12,fontWeight:500,cursor:voidDisabled?'default':'pointer',fontFamily:'inherit',opacity:voidDisabled?0.5:1}}>Void Ticket</button>
                        <button onClick={handleRefundStart}
                          style={{flex:1,height:36,background:'transparent',border:`1px solid ${C.warning}`,borderRadius:6,color:C.warning,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Refund</button>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
        {/* Right panel — ticket state display */}
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {selectedClosed.voided ? (
            <div style={{textAlign:'center',maxWidth:340}}>
              <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <span style={{fontSize:36,color:C.danger,fontWeight:700}}>✕</span>
              </div>
              <div style={{color:C.danger,fontSize:22,fontWeight:700,marginBottom:6}}>VOIDED</div>
              <div style={{color:C.textPrimary,fontSize:13,lineHeight:1.6,marginBottom:8}}>
                This ticket has been voided and all payments reversed.
              </div>
              <div style={{background:C.chromeDark,borderRadius:8,padding:'12px 16px',textAlign:'left',marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:C.textPrimary,fontSize:12}}>Reason</span>
                  <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{selectedClosed.voidReason}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:C.textPrimary,fontSize:12}}>Voided by</span>
                  <span style={{color:C.textPrimary,fontSize:12}}>{selectedClosed.voidedBy}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:C.textPrimary,fontSize:12}}>Time</span>
                  <span style={{color:C.textPrimary,fontSize:12}}>{timeStr(selectedClosed.voidedAt)}</span>
                </div>
                {(selectedClosed.tipCents>0||selectedClosed.voidReverseTip)&&(
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:C.textPrimary,fontSize:12}}>Tip</span>
                    <span style={{color:selectedClosed.voidReverseTip?C.danger:C.success,fontSize:12,fontWeight:500}}>{selectedClosed.voidReverseTip?'Reversed':'Kept'}</span>
                  </div>
                )}
              </div>
            </div>
          ) : selectedClosed.refunds && selectedClosed.refunds.length > 0 && !hasTip ? (
            <div style={{textAlign:'center',maxWidth:340}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <span style={{fontSize:28}}>↩️</span>
              </div>
              <div style={{color:C.warning,fontSize:16,fontWeight:600,marginBottom:6}}>Refund Applied</div>
              <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5}}>{selectedClosed.refunds.length} refund{selectedClosed.refunds.length!==1?'s':''} processed on this ticket. See details in the left panel.</div>
            </div>
          ) : hasTip && multiTech ? (
            <div style={{textAlign:'center',maxWidth:340,width:'100%',padding:'0 20px'}}>
              <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:16}}>Tip Distribution</div>
              {selectedClosed.tipDistributed && selectedClosed.tipDistributions ? (
                <>
                  {selectedClosed.tipDistributions.map((d,i)=>{
                    const staff=CHECKOUT_STAFF.find(s=>s.id===d.techId);
                    return(
                      <div key={d.techId} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.chromeDark,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:6}}>
                        <Av name={d.techName} size={32} index={i} photo={staff?.photo_url}/>
                        <span style={{color:C.textPrimary,fontSize:14,fontWeight:500,flex:1}}>{d.techName}</span>
                        <span style={{color:C.success,fontSize:16,fontWeight:600}}>{fmt(d.amount_cents)}</span>
                      </div>
                    );
                  })}
                  <div style={{color:C.success,fontSize:12,marginTop:8,marginBottom:16}}>✓ Distributed</div>
                  <button onClick={handleDistributeTip}
                    style={{height:40,padding:'0 24px',background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                    Edit Distribution
                  </button>
                </>
              ) : (
                <>
                  <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                    <span style={{fontSize:28}}>💰</span>
                  </div>
                  <div style={{color:C.warning,fontSize:14,fontWeight:500,marginBottom:4}}>Tip not distributed</div>
                  <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5,marginBottom:20}}>{fmt(selectedClosed.tipCents)} needs to be split between {ticketTechCount(selectedClosed)} technicians</div>
                  <button onClick={handleDistributeTip}
                    style={{height:44,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    Distribute Tip
                  </button>
                </>
              )}
            </div>
          ) : hasTip && !multiTech ? (
            <div style={{textAlign:'center',maxWidth:300}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(5,150,105,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <span style={{fontSize:28}}>✓</span>
              </div>
              <div style={{color:C.success,fontSize:16,fontWeight:500,marginBottom:4}}>Tip: {fmt(selectedClosed.tipCents)}</div>
              <div style={{color:C.textPrimary,fontSize:12}}>Auto-assigned to {selectedClosed.items.find(it=>it.tech)?.tech||'technician'}</div>
            </div>
          ) : !hasTip && !selectedClosed.tipAutoRemoved && hasCreditPayment(selectedClosed) ? (
            <div style={{textAlign:'center',maxWidth:300}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <span style={{fontSize:28}}>💳</span>
              </div>
              <div style={{color:C.textPrimary,fontSize:16,fontWeight:500,marginBottom:4}}>No tip recorded</div>
              <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5,marginBottom:20}}>Customer paid by credit card. Add tip from terminal slip.</div>
              <button onClick={handleAddTipStart}
                style={{height:44,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                Add Tip
              </button>
              <div style={{color:C.textPrimary,fontSize:11,marginTop:8}}>Requires manager or owner PIN</div>
            </div>
          ) : selectedClosed.tipAutoRemoved ? (
            <div style={{textAlign:'center',maxWidth:300}}>
              <div style={{fontSize:48,marginBottom:12}}>💵</div>
              <div style={{color:C.warning,fontSize:14,fontWeight:500,marginBottom:4}}>Tip collected outside system</div>
              <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5}}>Cash/Zelle — tip goes directly to technician</div>
            </div>
          ) : (
            <div style={{textAlign:'center',maxWidth:300}}>
              <div style={{fontSize:48,marginBottom:12}}>🧾</div>
              <div style={{color:C.textPrimary,fontSize:16,fontWeight:500,marginBottom:6}}>Ticket Detail</div>
              <div style={{color:C.textPrimary,fontSize:13,lineHeight:1.5}}>Reopening requires {permission==='all_staff'?'staff':permission==='manager_owner'?'manager or owner':'owner'} PIN.</div>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── MAIN LIST — open + closed ──
  const sortedOpen = [...openTickets].sort((a,b)=>a.ticketNumber-b.ticketNumber);
  const sortedClosed = [...closedTickets].sort((a,b)=>a.ticketNumber-b.ticketNumber);

  return(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",overflow:'hidden',alignItems:'center',position:'relative'}}>
      <AreaTag id="TK" />
      <div style={{width:'100%',maxWidth:800,display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:600,color:C.textPrimary}}>Today's Tickets</div>
          <div style={{fontSize:12,color:C.textPrimary}}>{openTickets.length} open · {closedTickets.length} closed</div>
        </div>
        <button onClick={onBack} style={{height:36,padding:'0 16px',background:C.blue,border:'none',borderRadius:7,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Back to Calendar</button>
      </div>

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
                        <span style={{color:isVoided?C.danger:C.textPrimary,fontSize:15,fontWeight:700}}>#{ticket.ticketNumber}</span>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{color:isVoided?C.textMuted:C.textPrimary,fontSize:16,fontWeight:600,textDecoration:isVoided?'line-through':'none'}}>{ticket.clientName||'Walk-in'}</span>
                        <span style={{color:C.textPrimary,fontSize:12}}>{timeStr(ticket.closedAt)}</span>
                        {isVoided&&<span style={{padding:'2px 6px',borderRadius:4,background:'rgba(239,68,68,0.2)',color:C.danger,fontSize:10,fontWeight:700}}>VOID</span>}
                        {hasRefund&&!isVoided&&<span style={{padding:'2px 6px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>Refund</span>}
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
                      <div style={{color:isVoided?C.danger:C.success,fontSize:11,fontWeight:500,marginTop:2}}>{isVoided?'Voided':'Paid'}</div>
                    </div>
                  </button>
                );
              });
            })()}
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
