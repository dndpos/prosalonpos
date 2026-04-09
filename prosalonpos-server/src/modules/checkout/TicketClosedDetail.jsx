/**
 * TicketClosedDetail.jsx — Closed Ticket Detail View
 * Extracted from TicketViewer.jsx (Session C9) to stay under 800-line cap.
 *
 * Shows the two-panel detail: left = items/totals/actions, right = tip/void/refund state.
 */
import { useTheme } from '../../lib/ThemeContext';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_STAFF } from './checkoutBridge';
import ReceiptPreview from './ReceiptPreview';
import { fmt } from '../../lib/formatUtils';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';

function timeStr(ts){ if(!ts)return''; const d=new Date(ts); let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+String(m).padStart(2,'0')+' '+ap; }

function Av({name,size=28,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

function ticketTechCount(ticket){
  var ids = new Set();
  ticket.items.forEach(function(it){ if(it.techId) ids.add(it.techId); });
  return ids.size;
}

function hasCreditPayment(ticket){
  return ticket.payments && ticket.payments.some(function(p){ return p.method==='credit'; });
}

export default function TicketClosedDetail({ ticket, pinPopups, onBack, onReopenPin, onDistributeTip, onAddTipStart, onVoidStart, onRefundStart, onReceipt, showReceipt, setShowReceipt, permission, deleteTicket, fetchTickets, fromDate, toDate }){
  var C = useTheme();
  var rbac = useRBAC();

  var groups={};
  ticket.items.forEach(function(it){
    var k=it.techId||'__none__';
    if(!groups[k]) groups[k]={techName:it.tech,items:[]};
    groups[k].items.push(it);
  });
  var techGroups=Object.values(groups);
  var multiTech = ticketTechCount(ticket) > 1;
  var hasTip = ticket.tipCents > 0;
  var undistributed = hasTip && multiTech && !ticket.tipDistributed;

  return(
    <>
    {pinPopups}
    {showReceipt && <ReceiptPreview ticket={ticket} onClose={function(){setShowReceipt(false);}}/>}
    <div style={{width:'100%',height:'100%',display:'flex',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",overflow:'hidden'}}>
      <div style={{width:360,minWidth:360,background:C.chromeDark,borderRight:'1px solid '+C.borderLight,display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'12px 14px',borderBottom:'1px solid '+C.borderLight,flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
          <div onClick={onBack} style={{height:28,padding:'0 12px',background:'#1E3A5F',border:'1px solid #2D5A8E',borderRadius:6,color:'#93C5FD',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4,userSelect:'none'}}
            onMouseEnter={function(e){e.currentTarget.style.background='#244872';}} onMouseLeave={function(e){e.currentTarget.style.background='#1E3A5F';}}>← Back</div>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>Ticket #{ticket.displayNumber||ticket.ticketNumber}</div>
            <div style={{fontSize:11,color:C.textPrimary}}>{timeStr(ticket.closedAt)}{ticket.clientName?' · '+ticket.clientName:''}</div>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
            {undistributed&&!ticket.voided&&<div style={{padding:'3px 8px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>Tip Undistributed</div>}
            {ticket.refunds&&ticket.refunds.length>0&&!ticket.voided&&<div style={{padding:'3px 8px',borderRadius:4,background:'rgba(217,119,6,0.2)',color:C.warning,fontSize:10,fontWeight:600}}>Refund Applied</div>}
            {ticket.voided ? (
              <div style={{padding:'3px 8px',borderRadius:4,background:'rgba(239,68,68,0.2)',color:C.danger,fontSize:11,fontWeight:700}}>VOID</div>
            ) : (
              <div style={{padding:'3px 8px',borderRadius:4,background:'rgba(5,150,105,0.15)',color:C.success,fontSize:11,fontWeight:500}}>Closed</div>
            )}
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'8px 10px'}}>
          {techGroups.map(function(g){return(<div key={g.techName||'none'} style={{marginBottom:10}}>
            {g.techName&&<div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',marginBottom:3}}><Av name={g.techName} size={20} photo={CHECKOUT_STAFF.find(function(s){return s.display_name===g.techName;})?.photo_url}/><span style={{color:C.textPrimary,fontSize:12,fontWeight:600}}>{g.techName}</span></div>}
            {g.items.map(function(it){return(<div key={it.id} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',marginBottom:2,borderRadius:4,background:C.grid}}>
              {it.color&&<div style={{width:4,height:20,borderRadius:2,background:it.color,flexShrink:0}}/>}
              <span style={{color:C.textPrimary,fontSize:12,fontWeight:500,flex:1}}>{it.name}{it.qty>1?' ×'+it.qty:''}</span>
              <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{fmt(it.price_cents*(it.qty||1))}</span>
            </div>);})}
          </div>);})}
          {ticket.discounts?.map(function(d){return(<div key={d.id} style={{display:'flex',alignItems:'center',padding:'4px 6px',marginBottom:2,borderRadius:4,background:'rgba(5,150,105,0.08)'}}>
            <span style={{color:C.success,fontSize:11,flex:1}}>{d.desc}</span>
            <span style={{color:C.success,fontSize:11,fontWeight:500}}>−{fmt(d.type==='flat_total'?d.value:Math.round(ticket.subtotalCents*d.value/100))}</span>
          </div>);})}
        </div>
        <div style={{borderTop:'1px solid '+C.borderLight,padding:'8px 12px',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Subtotal</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(ticket.subtotalCents)}</span></div>
          {ticket.discountCents>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.success,fontSize:11}}>Discounts</span><span style={{color:C.success,fontSize:11}}>−{fmt(ticket.discountCents)}</span></div>}
          {ticket.depositCents>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.blueLight,fontSize:11}}>Deposit</span><span style={{color:C.blueLight,fontSize:11}}>−{fmt(ticket.depositCents)}</span></div>}
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Tax</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(ticket.taxCents)}</span></div>
          {hasTip&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:C.textPrimary,fontSize:11}}>Tip</span><span style={{color:C.textPrimary,fontSize:11}}>{fmt(ticket.tipCents)}</span></div>}
          <div style={{height:1,background:C.borderMedium,margin:'3px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><span style={{color:C.textPrimary,fontSize:14,fontWeight:600}}>Total</span><span style={{color:C.textPrimary,fontSize:18,fontWeight:700}}>{fmt(ticket.totalCents)}</span></div>
          {ticket.payments.map(function(p,i){return(<div key={i} style={{display:'flex',justifyContent:'space-between',marginTop:2}}><span style={{color:C.success,fontSize:11}}>Paid ({p.method})</span><span style={{color:C.success,fontSize:11}}>{fmt(p.amount_cents)}</span></div>);})}
          {ticket.receiptMethod&&ticket.receiptMethod!=='none'&&<div style={{marginTop:6,color:C.textPrimary,fontSize:10}}>Receipt: {ticket.receiptMethod}</div>}
          {ticket.tipAutoRemoved&&<div style={{marginTop:4,color:C.warning,fontSize:10}}>Tip collected outside system (cash/zelle)</div>}
          {ticket.voided&&(
            <div style={{marginTop:6,padding:'6px 8px',background:'rgba(239,68,68,0.08)',borderRadius:4}}>
              <div style={{color:C.danger,fontSize:10,fontWeight:600,marginBottom:2}}>VOIDED</div>
              <div style={{color:C.textPrimary,fontSize:10}}>Reason: {ticket.voidReason}</div>
              <div style={{color:C.textPrimary,fontSize:10}}>By: {ticket.voidedBy} · {timeStr(ticket.voidedAt)}</div>
              {ticket.voidReverseTip!==undefined&&<div style={{color:C.textPrimary,fontSize:10}}>Tip: {ticket.voidReverseTip?'Reversed':'Kept'}</div>}
            </div>
          )}
          {ticket.refunds&&ticket.refunds.length>0&&!ticket.voided&&(
            <div style={{marginTop:6}}>
              {ticket.refunds.map(function(rf,ri){return(
                <div key={ri} style={{padding:'6px 8px',background:'rgba(217,119,6,0.08)',borderRadius:4,marginBottom:4}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:rf.pkgCreditsRestored?'#8B5CF6':C.warning,fontSize:10,fontWeight:600}}>{rf.pkgCreditsRestored?'📦 Pkg Credits Restored':'Refund #'+(ri+1)}</span>
                    {!rf.pkgCreditsRestored&&<span style={{color:C.warning,fontSize:11,fontWeight:600}}>−{fmt(rf.refundTotal_cents)}</span>}
                  </div>
                  {rf.items.map(function(rfi){return <div key={rfi.itemId} style={{color:C.textPrimary,fontSize:10}}>{rfi.name}: −{fmt(rfi.refundAmount_cents)}</div>;})}
                  {rf.refundTax_cents>0&&<div style={{color:C.textPrimary,fontSize:10}}>Tax: −{fmt(rf.refundTax_cents)}</div>}
                  {rf.refundTip&&<div style={{color:C.textPrimary,fontSize:10}}>Tip refunded: −{fmt(rf.tipRefunded_cents)}</div>}
                  <div style={{color:C.textPrimary,fontSize:10}}>Reason: {rf.reasonPreset}{rf.reasonText?' — '+rf.reasonText:''}</div>
                  <div style={{color:C.textPrimary,fontSize:10}}>By: {rf.processedBy} · {timeStr(rf.processedAt)} · {rf.refundMethod}</div>
                </div>
              );})}
            </div>
          )}
        </div>
        <div style={{padding:'8px 12px',borderTop:'1px solid '+C.borderLight,display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
          {ticket.voided ? (
            <div style={{display:'flex',gap:8}}>
              <button onClick={onBack} style={{flex:1,height:40,background:'#3B1C1C',border:'1px solid #7F1D1D',borderRadius:6,color:'#FCA5A5',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
              <button onClick={function(){setShowReceipt(true);}} style={{flex:1,height:40,background:C.grid,border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🧾 Receipt</button>
            </div>
          ) : (
            <>
              <div style={{display:'flex',gap:6}}>
                {(function(){
                  var refundedIds = ticket.refundedItemIds || {};
                  var allItemsRefunded = (ticket.items || []).every(function(it){ return refundedIds[it.id]; });
                  var refundDisabled = ticket.status === 'refunded' || allItemsRefunded;
                  return <button onClick={refundDisabled?undefined:onRefundStart} disabled={refundDisabled} title={refundDisabled?'All items already refunded':''}
                  style={{flex:1,height:36,background:'transparent',border:'1px solid '+(refundDisabled?C.borderMedium:C.warning),borderRadius:6,color:refundDisabled?C.textMuted:C.warning,fontSize:12,fontWeight:500,cursor:refundDisabled?'default':'pointer',fontFamily:'inherit',opacity:refundDisabled?0.5:1}}>Refund</button>;
                })()}
                <button onClick={function(){setShowReceipt(true);}} style={{flex:1,height:36,background:C.grid,border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🧾 Receipt</button>
                <button onClick={onReopenPin} style={{flex:1,height:36,background:C.warning,border:'none',borderRadius:6,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Reopen</button>
              </div>
              <div style={{display:'flex',gap:6}}>
                {(function(){
                  var hasRefunds = ticket.refunds && ticket.refunds.length > 0;
                  var closedDate = ticket.closedAt ? new Date(ticket.closedAt) : null;
                  var today = new Date();
                  var isToday = closedDate && closedDate.getFullYear()===today.getFullYear() && closedDate.getMonth()===today.getMonth() && closedDate.getDate()===today.getDate();
                  var voidDisabled = hasRefunds || !isToday;
                  var voidTip = hasRefunds ? 'Cannot void — refund exists' : !isToday ? 'Cannot void — not today' : '';
                  return(
                    <>
                      <button onClick={onBack} style={{flex:1,height:36,background:'#3B1C1C',border:'1px solid #7F1D1D',borderRadius:6,color:'#FCA5A5',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                      <button onClick={voidDisabled?undefined:onVoidStart} disabled={voidDisabled} title={voidTip}
                        style={{flex:1,height:36,background:'transparent',border:'1px solid '+(voidDisabled?C.borderMedium:C.danger),borderRadius:6,color:voidDisabled?C.textMuted:C.danger,fontSize:12,fontWeight:500,cursor:voidDisabled?'default':'pointer',fontFamily:'inherit',opacity:voidDisabled?0.5:1}}>Void Ticket</button>
                      <button onClick={function(){rbac.requirePermission(ACTIONS.VOID_TICKET,function(){if(confirm('Permanently delete ticket #'+ticket.ticketNumber+'? This cannot be undone.')){deleteTicket(ticket.id).then(function(){onBack();fetchTickets(fromDate,toDate);}).catch(function(e){alert(e.message);});}});}}
                        style={{flex:1,height:36,background:'transparent',border:'1px solid '+C.textMuted,borderRadius:6,color:C.textMuted,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Delete</button>
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
        {ticket.voided ? (
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
                <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{ticket.voidReason}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{color:C.textPrimary,fontSize:12}}>Voided by</span>
                <span style={{color:C.textPrimary,fontSize:12}}>{ticket.voidedBy}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{color:C.textPrimary,fontSize:12}}>Time</span>
                <span style={{color:C.textPrimary,fontSize:12}}>{timeStr(ticket.voidedAt)}</span>
              </div>
              {(ticket.tipCents>0||ticket.voidReverseTip)&&(
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{color:C.textPrimary,fontSize:12}}>Tip</span>
                  <span style={{color:ticket.voidReverseTip?C.danger:C.success,fontSize:12,fontWeight:500}}>{ticket.voidReverseTip?'Reversed':'Kept'}</span>
                </div>
              )}
            </div>
          </div>
        ) : ticket.refunds && ticket.refunds.length > 0 && !hasTip ? (
          <div style={{textAlign:'center',maxWidth:340}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <span style={{fontSize:28}}>↩️</span>
            </div>
            <div style={{color:C.warning,fontSize:16,fontWeight:600,marginBottom:6}}>Refund Applied</div>
            <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5}}>{ticket.refunds.length} refund{ticket.refunds.length!==1?'s':''} processed on this ticket. See details in the left panel.</div>
          </div>
        ) : hasTip && multiTech ? (
          <div style={{textAlign:'center',maxWidth:340,width:'100%',padding:'0 20px'}}>
            <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:16}}>Tip Distribution</div>
            {ticket.tipDistributed && ticket.tipDistributions ? (
              <>
                {ticket.tipDistributions.map(function(d,i){
                  var staff=CHECKOUT_STAFF.find(function(s){return s.id===d.techId;});
                  return(
                    <div key={d.techId} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.chromeDark,border:'1px solid '+C.borderLight,borderRadius:8,marginBottom:6}}>
                      <Av name={d.techName} size={32} index={i} photo={staff?.photo_url}/>
                      <span style={{color:C.textPrimary,fontSize:14,fontWeight:500,flex:1}}>{d.techName}</span>
                      <span style={{color:C.success,fontSize:16,fontWeight:600}}>{fmt(d.amount_cents)}</span>
                    </div>
                  );
                })}
                <div style={{color:C.success,fontSize:12,marginTop:8,marginBottom:16}}>✓ Distributed</div>
                <button onClick={onDistributeTip}
                  style={{height:40,padding:'0 24px',background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                  Edit Distribution
                </button>
              </>
            ) : (
              <>
                <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                  <span style={{fontSize:28}}>💰</span>
                </div>
                <div style={{color:C.warning,fontSize:14,fontWeight:500,marginBottom:4}}>Tip not distributed</div>
                <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5,marginBottom:20}}>{fmt(ticket.tipCents)} needs to be split between {ticketTechCount(ticket)} technicians</div>
                <button onClick={onDistributeTip}
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
            <div style={{color:C.success,fontSize:16,fontWeight:500,marginBottom:4}}>Tip: {fmt(ticket.tipCents)}</div>
            <div style={{color:C.textPrimary,fontSize:12}}>Auto-assigned to {ticket.items.find(function(it){return it.tech;})?.tech||'technician'}</div>
          </div>
        ) : !hasTip && !ticket.tipAutoRemoved && hasCreditPayment(ticket) ? (
          <div style={{textAlign:'center',maxWidth:300}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <span style={{fontSize:28}}>💳</span>
            </div>
            <div style={{color:C.textPrimary,fontSize:16,fontWeight:500,marginBottom:4}}>No tip recorded</div>
            <div style={{color:C.textPrimary,fontSize:12,lineHeight:1.5,marginBottom:20}}>Customer paid by credit card. Add tip from terminal slip.</div>
            <button onClick={onAddTipStart}
              style={{height:44,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              Add Tip
            </button>
            <div style={{color:C.textPrimary,fontSize:11,marginTop:8}}>Requires manager or owner PIN</div>
          </div>
        ) : ticket.tipAutoRemoved ? (
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
