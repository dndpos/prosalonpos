import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Void Flow (M2-64 through M2-69)
 * Reason selection → Reverse tip? → Confirmation → Print void receipt?
 */
import { useState, useRef, useEffect } from 'react';
import { CHECKOUT_SETTINGS, SALON_INFO } from './checkoutBridge';
import { fmt } from '../../lib/formatUtils';

function pad2(n){ return n<10?'0'+n:''+n; }
function timeStr(ts){ if(!ts)return''; const d=new Date(ts); let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${pad2(m)} ${ap}`; }
function dateStr(ts){ if(!ts)return''; const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`; }

const STEPS = { REASON: 'reason', REVERSE_TIP: 'reverse_tip', DEPOSIT: 'deposit', CONFIRM: 'confirm', PRINT_ASK: 'print_ask', RECEIPT: 'receipt' };

export default function VoidFlow({ ticket, staffName, onConfirm, onCancel }){
  var C = useTheme();
  const [step, setStep] = useState(STEPS.REASON);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [reverseTip, setReverseTip] = useState(null); // true/false
  const [depositAction, setDepositAction] = useState(null); // 'refund' | 'forfeit'
  const [cashAlertDismissed, setCashAlertDismissed] = useState(false);
  const otherRef = useRef(null);
  const presets = CHECKOUT_SETTINGS.void_reason_presets || ['Wrong client','Duplicate ticket','Rang up incorrectly','Other'];
  const hasTip = (ticket.tipCents || 0) > 0;
  const hasDeposit = (ticket.depositCents || 0) > 0;
  const isOther = selectedPreset === 'Other';
  const reasonText = isOther ? otherText.trim() : selectedPreset;
  const reasonValid = selectedPreset && (!isOther || otherText.trim().length > 0);

  useEffect(function(){ if(isOther && otherRef.current) otherRef.current.focus(); }, [isOther]);

  function handleNext(){
    if(step === STEPS.REASON){
      if(hasTip){ setStep(STEPS.REVERSE_TIP); }
      else if(hasDeposit){ setReverseTip(false); setStep(STEPS.DEPOSIT); }
      else { setReverseTip(false); setDepositAction(null); setStep(STEPS.CONFIRM); }
    } else if(step === STEPS.REVERSE_TIP){
      if(hasDeposit){ setStep(STEPS.DEPOSIT); }
      else { setDepositAction(null); setStep(STEPS.CONFIRM); }
    } else if(step === STEPS.DEPOSIT){
      setStep(STEPS.CONFIRM);
    } else if(step === STEPS.CONFIRM){
      setStep(STEPS.PRINT_ASK);
    }
  }

  function handleFinalConfirm(showReceipt){
    if(showReceipt){ setStep(STEPS.RECEIPT); return; }
    onConfirm({ reverseTip: !!reverseTip, depositAction: depositAction, reasonPreset: selectedPreset, reasonText: isOther ? otherText.trim() : null });
  }

  function handleReceiptDone(){
    onConfirm({ reverseTip: !!reverseTip, depositAction: depositAction, reasonPreset: selectedPreset, reasonText: isOther ? otherText.trim() : null });
  }

  const wrap = { width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:C.chrome, fontFamily:"'Inter',system-ui,sans-serif" };
  const card = { width:420, maxHeight:'90vh', overflow:'auto' };
  const title = { fontSize:20, fontWeight:700, color:C.danger, marginBottom:4, textAlign:'center' };
  const sub = { color:C.textMuted, fontSize:13, marginBottom:20, textAlign:'center' };
  const btnRow = { display:'flex', gap:8, marginTop:20 };
  const btnSecondary = { flex:1, height:44, background:'transparent', border:`1px solid ${C.borderMedium}`, borderRadius:8, color:C.textPrimary, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' };
  const btnPrimary = (enabled) => ({ flex:1, height:44, background:enabled?C.danger:'#334155', border:'none', borderRadius:8, color:enabled?'#fff':C.textMuted, fontSize:14, fontWeight:600, cursor:enabled?'pointer':'default', fontFamily:'inherit' });

  // ── STEP: REASON ──
  if(step === STEPS.REASON){
    return(
      <div style={wrap}><div style={card}>
        <div style={title}>Void Ticket #{ticket.ticketNumber}</div>
        <div style={sub}>{ticket.clientName||'Walk-in'} · {fmt(ticket.totalCents)}</div>
        <div style={{fontSize:12,fontWeight:600,color:C.textPrimary,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10}}>Reason for void</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {presets.map(p=>{
            const active = selectedPreset===p;
            return(
              <button key={p} onClick={()=>{ setSelectedPreset(p); if(p!=='Other') setOtherText(''); }}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:active?'rgba(239,68,68,0.1)':C.chromeDark,border:active?`1px solid ${C.danger}`:`1px solid ${C.borderMedium}`,borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor=C.danger;}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor=active?C.danger:C.borderMedium;}}>
                <div style={{width:20,height:20,borderRadius:'50%',border:active?`2px solid ${C.danger}`:`2px solid ${C.borderMedium}`,background:active?C.danger:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {active&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}
                </div>
                <span style={{color:active?C.danger:C.textPrimary,fontSize:14,fontWeight:active?600:400}}>{p}</span>
              </button>
            );
          })}
        </div>
        {isOther&&(
          <div style={{marginTop:10}}>
            <input ref={otherRef} value={otherText} onChange={e=>setOtherText(e.target.value)} placeholder="Describe the reason..."
              style={{width:'100%',height:40,background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:6,padding:'0 12px',color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.currentTarget.style.borderColor=C.danger}
              onBlur={e=>e.currentTarget.style.borderColor=C.borderMedium}/>
          </div>
        )}
        <div style={btnRow}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={handleNext} disabled={!reasonValid} style={btnPrimary(reasonValid)}>Next</button>
        </div>
      </div></div>
    );
  }

  // ── STEP: REVERSE TIP ──
  if(step === STEPS.REVERSE_TIP){
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>💰</span>
        </div>
        <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Reverse Tip?</div>
        <div style={{color:C.textMuted,fontSize:13,lineHeight:1.6,marginBottom:24}}>
          This ticket has a <strong style={{color:C.textPrimary}}>{fmt(ticket.tipCents)}</strong> tip.
          {ticket.tipDistributed ? ' It has been distributed to technicians.' : ''}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button onClick={()=>{setReverseTip(true);handleNext();}}
            style={{height:48,padding:'0 28px',background:C.danger,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Yes — Reverse Tip
          </button>
          <button onClick={()=>{setReverseTip(false);handleNext();}}
            style={{height:48,padding:'0 28px',background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            No — Keep Tip
          </button>
        </div>
        <button onClick={()=>setStep(STEPS.REASON)} style={{marginTop:16,background:'none',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>← Back to reason</button>
      </div></div>
    );
  }

  // ── STEP: DEPOSIT (M2-88) ──
  if(step === STEPS.DEPOSIT){
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>💵</span>
        </div>
        <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Deposit Applied</div>
        <div style={{color:C.textMuted,fontSize:13,lineHeight:1.6,marginBottom:24}}>
          This ticket had a <strong style={{color:C.textPrimary}}>{fmt(ticket.depositCents)}</strong> deposit applied. What should happen to it?
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button onClick={()=>{setDepositAction('refund');handleNext();}}
            style={{height:48,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Refund to Client
          </button>
          <button onClick={()=>{setDepositAction('forfeit');handleNext();}}
            style={{height:48,padding:'0 28px',background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            Forfeit Deposit
          </button>
        </div>
        <button onClick={()=>setStep(hasTip?STEPS.REVERSE_TIP:STEPS.REASON)} style={{marginTop:16,background:'none',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>← Back</button>
      </div></div>
    );
  }

  // ── STEP: CONFIRM ──
  if(step === STEPS.CONFIRM){
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>⚠️</span>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:C.danger,marginBottom:6}}>Confirm Void</div>
        <div style={{color:C.textMuted,fontSize:13,lineHeight:1.6,marginBottom:20}}>
          This will void <strong style={{color:C.textPrimary}}>Ticket #{ticket.ticketNumber}</strong> for <strong style={{color:C.textPrimary}}>{ticket.clientName||'Walk-in'}</strong>.
        </div>
        <div style={{background:C.chromeDark,borderRadius:8,padding:'14px 16px',marginBottom:16,textAlign:'left'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{color:C.textMuted,fontSize:12}}>Amount voided</span>
            <span style={{color:C.danger,fontSize:14,fontWeight:600}}>{fmt(ticket.totalCents)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{color:C.textMuted,fontSize:12}}>Reason</span>
            <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{reasonText}</span>
          </div>
          {hasTip&&(
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{color:C.textMuted,fontSize:12}}>Tip ({fmt(ticket.tipCents)})</span>
              <span style={{color:reverseTip?C.danger:C.success,fontSize:12,fontWeight:500}}>{reverseTip?'Reversed':'Kept'}</span>
            </div>
          )}
          {hasDeposit&&(
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:C.textMuted,fontSize:12}}>Deposit ({fmt(ticket.depositCents)})</span>
              <span style={{color:depositAction==='refund'?C.blue:C.warning,fontSize:12,fontWeight:500}}>{depositAction==='refund'?'Refund to client':'Forfeited'}</span>
            </div>
          )}
        </div>
        <div style={{color:C.warning,fontSize:12,marginBottom:16}}>This action cannot be undone.</div>
        <div style={btnRow}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={handleNext} style={btnPrimary(true)}>Void Ticket</button>
        </div>
      </div></div>
    );
  }

  // ── STEP: PRINT ASK ──
  if(step === STEPS.PRINT_ASK){
    var methodIcons = { 'credit':'💳', 'cash':'💵', 'zelle':'📱', 'gift card':'🎁' };
    var hasCash = ticket.payments.some(function(p){ return p.method.toLowerCase() === 'cash'; });
    var cashTotal = ticket.payments.filter(function(p){ return p.method.toLowerCase() === 'cash'; }).reduce(function(s,p){ return s + p.amount_cents; }, 0);
    // Cash popup — must dismiss before proceeding
    if(hasCash && !cashAlertDismissed){
      return(
        <div style={wrap}><div style={{...card,textAlign:'center'}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <span style={{fontSize:40}}>💵</span>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:C.danger,marginBottom:8}}>Cash Refund</div>
          <div style={{fontSize:32,fontWeight:700,color:C.textPrimary,marginBottom:12}}>{fmt(cashTotal)}</div>
          <div style={{color:C.textPrimary,fontSize:16,lineHeight:1.6,marginBottom:24}}>
            Hand <strong>{fmt(cashTotal)}</strong> cash to the client now.
          </div>
          <button onClick={()=>setCashAlertDismissed(true)}
            style={{height:52,padding:'0 40px',background:C.danger,border:'none',borderRadius:8,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            Done — Cash Given
          </button>
        </div></div>
      );
    }
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>✓</span>
        </div>
        <div style={{fontSize:18,fontWeight:600,color:C.danger,marginBottom:6}}>Ticket Voided</div>
        <div style={{color:C.textMuted,fontSize:13,marginBottom:12}}>Ticket #{ticket.ticketNumber} has been voided.</div>
        {/* Payment method badges — one per payment */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
          {ticket.payments.map(function(p,i){
            var m = p.method.toLowerCase();
            var icon = methodIcons[m] || '💰';
            var label = p.method.charAt(0).toUpperCase() + p.method.slice(1);
            var isCashLine = m === 'cash';
            return(
              <div key={i} style={{padding:'10px 16px',background:isCashLine?'rgba(239,68,68,0.08)':'rgba(239,68,68,0.05)',border:'1px solid '+(isCashLine?C.danger:'rgba(239,68,68,0.2)'),borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                <span style={{fontSize:20}}>{icon}</span>
                <span style={{color:isCashLine?C.danger:C.textPrimary,fontSize:15,fontWeight:700}}>{fmt(p.amount_cents)} → {label}</span>
                {isCashLine&&<span style={{color:C.danger,fontSize:11,fontWeight:500}}>✓ Given</span>}
              </div>
            );
          })}
        </div>
        <div style={{fontSize:14,fontWeight:500,color:C.textPrimary,marginBottom:16}}>Print void receipt?</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button onClick={()=>handleFinalConfirm(true)}
            style={{height:48,padding:'0 28px',background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            🧾 View Receipt
          </button>
          <button onClick={()=>handleFinalConfirm(false)}
            style={{height:48,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Done
          </button>
        </div>
      </div></div>
    );
  }

  // ── STEP: VOID RECEIPT PREVIEW ──
  if(step === STEPS.RECEIPT){
    const now = new Date();
    return(
      <div style={wrap}><div style={{width:340,maxHeight:'90vh',overflow:'auto'}}>
        <div style={{background:'#fff',borderRadius:8,padding:'20px 16px',color:'#111',fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.6}}>
          <div style={{textAlign:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:14}}>{SALON_INFO.name}</div>
            <div>{SALON_INFO.address_line1}</div>
            <div>{SALON_INFO.address_line2}</div>
            <div>{SALON_INFO.phone}</div>
          </div>
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{textAlign:'center',fontWeight:700,fontSize:16,color:'#B91C1C',margin:'8px 0'}}>*** VOID ***</div>
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between'}}><span>Ticket #{ticket.ticketNumber}</span><span>{ticket.txnId}</span></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span>{dateStr(ticket.closedAt)}</span><span>{timeStr(ticket.closedAt)}</span></div>
          {ticket.clientName&&<div>Client: {ticket.clientName}</div>}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{fontWeight:700,marginBottom:4}}>Original Items:</div>
          {ticket.items.map(it=>(
            <div key={it.id} style={{display:'flex',justifyContent:'space-between',textDecoration:'line-through',color:'#999'}}>
              <span>{it.name}</span><span>{fmt(it.price_cents*(it.qty||1))}</span>
            </div>
          ))}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:700}}>
            <span>Amount Voided</span><span>{fmt(ticket.totalCents)}</span>
          </div>
          {hasTip&&(
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Tip</span><span>{reverseTip?'REVERSED':'KEPT'} ({fmt(ticket.tipCents)})</span>
            </div>
          )}
          {hasDeposit&&(
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Deposit</span><span>{depositAction==='refund'?'REFUNDED':'FORFEITED'} ({fmt(ticket.depositCents)})</span>
            </div>
          )}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div>Reason: {reasonText}</div>
          <div>Voided by: {staffName||'Staff'}</div>
          <div>Voided at: {timeStr(now.getTime())} {dateStr(now.getTime())}</div>
          {ticket.payments.map((p,i)=>(
            <div key={i}>Refund to: {p.method} — {fmt(p.amount_cents)}</div>
          ))}
        </div>
        <button onClick={handleReceiptDone}
          style={{width:'100%',height:48,marginTop:12,background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Done
        </button>
      </div></div>
    );
  }

  return null;
}
