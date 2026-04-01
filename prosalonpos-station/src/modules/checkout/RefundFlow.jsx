import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Refund Flow (M2-70 through M2-77, M2-93, M2-94)
 * Item selection → Reason → Refund tip? (yes/no) → Refund method → Confirm → Print receipt?
 * Tax on refunded items is automatically calculated and included.
 */
import { useState, useRef, useEffect } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_SETTINGS, SALON_INFO } from './checkoutBridge';
import { fmt } from '../../lib/formatUtils';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';

function pad2(n){ return n<10?'0'+n:''+n; }
function timeStr(ts){ if(!ts)return''; const d=new Date(ts); let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${pad2(m)} ${ap}`; }
function dateStr(ts){ if(!ts)return''; const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`; }

const STEPS = { ITEMS:'items', REASON:'reason', TIP:'tip', METHOD:'method', CONFIRM:'confirm', PRINT_ASK:'print_ask', RECEIPT:'receipt' };
const REFUND_METHODS = ['Original payment method','Cash','Store credit'];
const TAX_RATE = CHECKOUT_SETTINGS.tax_rate_percentage;
const npMode = CHECKOUT_SETTINGS.numpad_mode;
function npDisplay(raw){ return npMode==='cash_register' ? (!raw?'0.00':(parseInt(raw,10)/100).toFixed(2)) : (raw||'0.00'); }
function npTap(d,prev){
  if(d==='⌫') return prev.slice(0,-1);
  if(npMode==='cash_register'){ if(d==='.'||d==='00') return prev+'00'; if(!/\d/.test(d)) return prev; return prev+d; }
  if(d==='.'&&prev.includes('.')) return prev; return prev+d;
}
function npCents(raw){ return npMode==='cash_register' ? (parseInt(raw,10)||0) : Math.round(parseFloat(raw)*100)||0; }
function npKeys(){ return npMode==='cash_register' ? ['7','8','9','4','5','6','1','2','3','00','0','⌫'] : ['7','8','9','4','5','6','1','2','3','.','0','⌫']; }

export default function RefundFlow({ ticket, staffName, onConfirm, onCancel }){
  var C = useTheme();
  const [step, setStep] = useState(STEPS.ITEMS);
  const [selections, setSelections] = useState({});
  const [editingItemId, setEditingItemId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [tipRefundCents, setTipRefundCents] = useState(null); // null=not decided, 0=keep, positive=amount to refund
  const [showTipNumpad, setShowTipNumpad] = useState(false);
  const [tipInput, setTipInput] = useState('');
  const [refundMethod, setRefundMethod] = useState('Original payment method');
  const [cashAlertDismissed, setCashAlertDismissed] = useState(false);

  // ── Keyboard → numpad bridge ──
  useNumpadKeyboard(!!editingItemId, function(d){ setEditInput(function(p){ return npTap(d,p); }); }, function(){ setEditInput(function(p){ return npTap('⌫',p); }); }, null, function(){ setEditingItemId(null); setEditInput(''); }, [editingItemId]);
  useNumpadKeyboard(showTipNumpad, function(d){ setTipInput(function(p){ return npTap(d,p); }); }, function(){ setTipInput(function(p){ return npTap('⌫',p); }); }, null, function(){ setShowTipNumpad(false); }, [showTipNumpad]);

  const presets = CHECKOUT_SETTINGS.void_reason_presets || ['Wrong client','Duplicate ticket','Rang up incorrectly','Other'];
  const hasTip = (ticket.tipCents || 0) > 0;
  const isOther = selectedPreset === 'Other';
  const reasonValid = selectedPreset && (!isOther || otherText.trim().length > 0);
  const otherRef = useRef(null);
  useEffect(function(){ if(isOther && otherRef.current) otherRef.current.focus(); }, [isOther]);

  function refundItemsTotal(){
    let sum = 0;
    Object.entries(selections).forEach(([id, sel])=>{
      if(!sel.checked) return;
      const item = ticket.items.find(it=>it.id===id);
      if(!item) return;
      sum += sel.customAmount_cents !== null ? sel.customAmount_cents : item.price_cents * (item.qty||1);
    });
    return sum;
  }
  function refundTaxCents(){ return Math.round(refundItemsTotal() * TAX_RATE / 100); }
  function refundGrandTotal(){
    var total = refundItemsTotal() + refundTaxCents();
    if(tipRefundCents > 0) total += tipRefundCents;
    return total;
  }
  function selectedCount(){ return Object.values(selections).filter(s=>s.checked).length; }

  function toggleItem(id){
    setSelections(prev => {
      const cur = prev[id];
      if(cur && cur.checked) return { ...prev, [id]: { ...cur, checked: false } };
      return { ...prev, [id]: { checked: true, customAmount_cents: null } };
    });
  }
  function setCustomAmount(id, cents){
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], checked: true, customAmount_cents: cents } }));
  }
  function clearCustomAmount(id){
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], customAmount_cents: null } }));
  }
  function buildRefItems(){
    return Object.entries(selections).filter(([,s])=>s.checked).map(([id,s])=>{
      const item = ticket.items.find(it=>it.id===id);
      return { itemId:id, name:item?.name||'Unknown', refundAmount_cents: s.customAmount_cents!==null&&s.customAmount_cents!==undefined ? s.customAmount_cents : item.price_cents*(item?.qty||1) };
    });
  }
  // Resolve "Original payment method" to the actual method(s) from ticket
  function displayMethod(){
    if(refundMethod === 'Original payment method'){
      var methods = ticket.payments.map(function(p){ return p.method.charAt(0).toUpperCase() + p.method.slice(1); });
      return [...new Set(methods)].join(' + ');
    }
    return refundMethod;
  }

  function buildResult(){
    return {
      items: buildRefItems(),
      reasonPreset: selectedPreset,
      reasonText: isOther ? otherText.trim() : null,
      refundMethod: displayMethod(),
      refundTip: tipRefundCents > 0,
      tipRefunded_cents: tipRefundCents > 0 ? tipRefundCents : 0,
      refundItemsTotal_cents: refundItemsTotal(),
      refundTax_cents: refundTaxCents(),
      refundTotal_cents: refundGrandTotal(),
    };
  }

  const wrap = { width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:C.chrome, fontFamily:"'Inter',system-ui,sans-serif" };
  const card = { width:460, maxHeight:'90vh', overflow:'auto' };
  const titleS = { fontSize:20, fontWeight:700, color:C.warning, marginBottom:4, textAlign:'center' };
  const sub = { color:C.textMuted, fontSize:13, marginBottom:20, textAlign:'center' };
  const btnRow = { display:'flex', gap:8, marginTop:20 };
  const btnSecondary = { flex:1, height:44, background:'transparent', border:`1px solid ${C.borderMedium}`, borderRadius:8, color:C.textPrimary, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' };
  const btnPrimary = (enabled) => ({ flex:1, height:44, background:enabled?C.warning:'#334155', border:'none', borderRadius:8, color:enabled?'#fff':C.textMuted, fontSize:14, fontWeight:600, cursor:enabled?'pointer':'default', fontFamily:'inherit' });

  // -- CUSTOM AMOUNT NUMPAD --
  if(editingItemId){
    const item = ticket.items.find(it=>it.id===editingItemId);
    const maxCents = item ? item.price_cents*(item.qty||1) : 0;
    const val = npCents(editInput);
    const valid = val > 0 && val <= maxCents;
    return(
      <div style={wrap}><div style={{width:360,textAlign:'center'}}>
        <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Custom Refund Amount</div>
        <div style={{color:C.textMuted,fontSize:13,marginBottom:4}}>{item?.name}</div>
        <div style={{color:C.textMuted,fontSize:12,marginBottom:16}}>Max: {fmt(maxCents)}</div>
        <div style={{background:C.grid,borderRadius:8,padding:'12px 16px',marginBottom:10}}>
          <span style={{color:valid?C.warning:val>maxCents?C.danger:C.textPrimary,fontSize:28,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${npDisplay(editInput)}</span>
        </div>
        {val>maxCents&&<div style={{color:C.danger,fontSize:11,marginBottom:6}}>Cannot exceed {fmt(maxCents)}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,maxWidth:280,margin:'0 auto'}}>
          {npKeys().map(d=>(
            <div key={d} onClick={()=>setEditInput(prev=>npTap(d,prev))}
              style={{height:50,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
              onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
              onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12,maxWidth:280,margin:'12px auto 0'}}>
          <button onClick={()=>{setEditingItemId(null);setEditInput('');}} style={{...btnSecondary,flex:1}}>Cancel</button>
          <button onClick={()=>{ clearCustomAmount(editingItemId); setEditingItemId(null); setEditInput(''); }}
            style={{flex:1,height:44,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:8,color:C.textMuted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Full Price</button>
          <button onClick={()=>{ if(valid){ setCustomAmount(editingItemId,val); setEditingItemId(null); setEditInput(''); }}} disabled={!valid}
            style={{flex:1,height:44,background:valid?C.warning:'#334155',border:'none',borderRadius:8,color:valid?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:valid?'pointer':'default',fontFamily:'inherit'}}>
            Set {valid?fmt(val):''}
          </button>
        </div>
      </div></div>
    );
  }

  // -- STEP: ITEMS --
  if(step === STEPS.ITEMS){
    const itemsTotal = refundItemsTotal();
    const taxAmt = refundTaxCents();
    const count = selectedCount();
    return(
      <div style={wrap}><div style={card}>
        <div style={titleS}>Refund — Ticket #{ticket.ticketNumber}</div>
        <div style={sub}>{ticket.clientName||'Walk-in'} · Total paid: {fmt(ticket.totalCents)}</div>
        <div style={{fontSize:12,fontWeight:600,color:C.textPrimary,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10}}>Select items to refund</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {ticket.items.map(it=>{
            const sel = selections[it.id];
            const checked = sel?.checked;
            const custom = sel?.customAmount_cents;
            const fullPrice = it.price_cents*(it.qty||1);
            const displayAmt = custom !== null && custom !== undefined ? custom : fullPrice;
            return(
              <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:checked?'rgba(217,119,6,0.08)':C.chromeDark,border:checked?'1px solid '+C.warning:'1px solid '+C.borderMedium,borderRadius:8}}>
                <button onClick={()=>toggleItem(it.id)} style={{width:24,height:24,borderRadius:4,border:checked?'2px solid '+C.warning:'2px solid '+C.borderMedium,background:checked?C.warning:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,padding:0}}>
                  {checked&&<span style={{color:'#fff',fontSize:14,fontWeight:700}}>✓</span>}
                </button>
                {it.color&&<div style={{width:4,height:28,borderRadius:2,background:it.color,flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:C.textPrimary,fontSize:13,fontWeight:500}}>{it.name}{it.qty>1?' ×'+it.qty:''}</div>
                  {it.tech&&<div style={{color:C.textMuted,fontSize:11}}>{it.tech}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  {checked && custom !== null && custom !== undefined && (
                    <span style={{color:C.warning,fontSize:11,fontWeight:500}}>Custom</span>
                  )}
                  <span style={{color:checked?C.warning:C.textPrimary,fontSize:14,fontWeight:600}}>{fmt(displayAmt)}</span>
                  {checked&&(
                    <button onClick={()=>{setEditingItemId(it.id);setEditInput('');}}
                      style={{height:28,padding:'0 8px',background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:4,color:C.textMuted,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=C.warning}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.borderMedium}>
                      ✏️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {count>0&&(
          <div style={{marginTop:12,padding:'10px 14px',background:'rgba(217,119,6,0.08)',borderRadius:8}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.textMuted,fontSize:12}}>Items ({count})</span>
              <span style={{color:C.textPrimary,fontSize:13,fontWeight:500}}>{fmt(itemsTotal)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.textMuted,fontSize:12}}>Tax ({TAX_RATE}%)</span>
              <span style={{color:C.textPrimary,fontSize:13,fontWeight:500}}>{fmt(taxAmt)}</span>
            </div>
            <div style={{height:1,background:C.borderMedium,margin:'4px 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:C.warning,fontSize:14,fontWeight:600}}>Refund total</span>
              <span style={{color:C.warning,fontSize:18,fontWeight:700}}>{fmt(itemsTotal + taxAmt)}</span>
            </div>
          </div>
        )}
        <div style={btnRow}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={()=>setStep(STEPS.REASON)} disabled={count===0} style={btnPrimary(count>0)}>Next</button>
        </div>
      </div></div>
    );
  }

  // -- STEP: REASON --
  if(step === STEPS.REASON){
    return(
      <div style={wrap}><div style={card}>
        <div style={titleS}>Refund Reason</div>
        <div style={sub}>{fmt(refundItemsTotal() + refundTaxCents())} refund on Ticket #{ticket.ticketNumber}</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {presets.map(p=>{
            const active = selectedPreset===p;
            return(
              <button key={p} onClick={()=>{ setSelectedPreset(p); if(p!=='Other') setOtherText(''); }}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:active?'rgba(217,119,6,0.1)':C.chromeDark,border:active?'1px solid '+C.warning:'1px solid '+C.borderMedium,borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor=C.warning;}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor=active?C.warning:C.borderMedium;}}>
                <div style={{width:20,height:20,borderRadius:'50%',border:active?'2px solid '+C.warning:'2px solid '+C.borderMedium,background:active?C.warning:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {active&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}
                </div>
                <span style={{color:active?C.warning:C.textPrimary,fontSize:14,fontWeight:active?600:400}}>{p}</span>
              </button>
            );
          })}
        </div>
        {isOther&&(
          <div style={{marginTop:10}}>
            <input ref={otherRef} value={otherText} onChange={e=>setOtherText(e.target.value)} placeholder="Describe the reason..."
              style={{width:'100%',height:40,background:C.chromeDark,border:'1px solid '+C.borderMedium,borderRadius:6,padding:'0 12px',color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.currentTarget.style.borderColor=C.warning}
              onBlur={e=>e.currentTarget.style.borderColor=C.borderMedium}/>
          </div>
        )}
        <div style={btnRow}>
          <button onClick={()=>setStep(STEPS.ITEMS)} style={btnSecondary}>← Back</button>
          <button onClick={()=>setStep(hasTip ? STEPS.TIP : STEPS.METHOD)} disabled={!reasonValid} style={btnPrimary(reasonValid)}>Next</button>
        </div>
      </div></div>
    );
  }

  // -- STEP: REFUND TIP? (M2-94 — full / partial / no) --
  if(step === STEPS.TIP){
    // Partial tip numpad
    if(showTipNumpad){
      const val = npCents(tipInput);
      const maxTip = ticket.tipCents || 0;
      const valid = val > 0 && val <= maxTip;
      return(
        <div style={wrap}><div style={{width:360,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Partial Tip Refund</div>
          <div style={{color:C.textMuted,fontSize:13,marginBottom:16}}>Total tip: {fmt(maxTip)} · Enter amount to refund</div>
          <div style={{background:C.grid,borderRadius:8,padding:'12px 16px',marginBottom:10}}>
            <span style={{color:valid?C.warning:val>maxTip?C.danger:C.textPrimary,fontSize:28,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${npDisplay(tipInput)}</span>
          </div>
          {val>maxTip&&<div style={{color:C.danger,fontSize:11,marginBottom:6}}>Cannot exceed {fmt(maxTip)}</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,maxWidth:280,margin:'0 auto'}}>
            {npKeys().map(d=>(
              <div key={d} onClick={()=>setTipInput(prev=>npTap(d,prev))}
                style={{height:50,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:12,maxWidth:280,margin:'12px auto 0'}}>
            <button onClick={()=>{setShowTipNumpad(false);setTipInput('');}} style={{...btnSecondary,flex:1}}>Cancel</button>
            <button onClick={()=>{ if(valid){ setTipRefundCents(val); setShowTipNumpad(false); setTipInput(''); setStep(STEPS.METHOD); }}} disabled={!valid}
              style={{flex:1,height:44,background:valid?C.warning:'#334155',border:'none',borderRadius:8,color:valid?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:valid?'pointer':'default',fontFamily:'inherit'}}>
              Refund {valid?fmt(val):''}
            </button>
          </div>
        </div></div>
      );
    }
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>💰</span>
        </div>
        <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Refund Tip?</div>
        <div style={{color:C.textMuted,fontSize:13,lineHeight:1.6,marginBottom:24}}>
          This ticket has a <strong style={{color:C.textPrimary}}>{fmt(ticket.tipCents)}</strong> tip. Does the client want their tip refunded?
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>{setTipRefundCents(ticket.tipCents);setStep(STEPS.METHOD);}}
            style={{height:48,padding:'0 24px',background:C.warning,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Full Tip ({fmt(ticket.tipCents)})
          </button>
          <button onClick={()=>{setTipInput('');setShowTipNumpad(true);}}
            style={{height:48,padding:'0 24px',background:C.chromeDark,border:'1px solid '+C.warning,borderRadius:8,color:C.warning,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            Partial Amount
          </button>
          <button onClick={()=>{setTipRefundCents(0);setStep(STEPS.METHOD);}}
            style={{height:48,padding:'0 24px',background:C.chromeDark,border:'1px solid '+C.borderMedium,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            No — Keep Tip
          </button>
        </div>
        <button onClick={()=>setStep(STEPS.REASON)} style={{marginTop:16,background:'none',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline'}}>← Back</button>
      </div></div>
    );
  }

  // -- STEP: METHOD --
  if(step === STEPS.METHOD){
    var origPayments = ticket.payments.map(function(p){ return { method: p.method.charAt(0).toUpperCase() + p.method.slice(1), amount: p.amount_cents }; });
    var methodIcons = { 'Credit':'💳', 'Cash':'💵', 'Zelle':'📱', 'Gift card':'🎁', 'Gift Card':'🎁' };
    var isOriginal = refundMethod === 'Original payment method';
    return(
      <div style={wrap}><div style={card}>
        <div style={titleS}>Refund Method</div>
        <div style={sub}>Refund: {fmt(refundGrandTotal())}</div>
        {/* Original payment — big badge */}
        <button onClick={()=>setRefundMethod('Original payment method')}
          style={{width:'100%',padding:'16px 18px',background:isOriginal?'rgba(217,119,6,0.1)':C.chromeDark,border:isOriginal?'2px solid '+C.warning:'1px solid '+C.borderMedium,borderRadius:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:12}}
          onMouseEnter={e=>{if(!isOriginal)e.currentTarget.style.borderColor=C.warning;}}
          onMouseLeave={e=>{if(!isOriginal)e.currentTarget.style.borderColor=isOriginal?C.warning:C.borderMedium;}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:22,height:22,borderRadius:'50%',border:isOriginal?'2px solid '+C.warning:'2px solid '+C.borderMedium,background:isOriginal?C.warning:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {isOriginal&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}
            </div>
            <span style={{color:isOriginal?C.warning:C.textPrimary,fontSize:15,fontWeight:600}}>Original Payment</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,paddingLeft:32}}>
            {origPayments.map(function(op,i){
              var icon = methodIcons[op.method] || '💰';
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:isOriginal?'rgba(217,119,6,0.08)':'rgba(255,255,255,0.03)',borderRadius:8,border:isOriginal?'1px solid rgba(217,119,6,0.25)':'1px solid '+C.borderLight}}>
                  <span style={{fontSize:22}}>{icon}</span>
                  <span style={{color:C.textPrimary,fontSize:15,fontWeight:600,flex:1}}>{op.method}</span>
                  <span style={{color:isOriginal?C.warning:C.textPrimary,fontSize:15,fontWeight:700}}>{fmt(op.amount)}</span>
                </div>
              );
            })}
          </div>
        </button>
        {/* Override options */}
        <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Or override to</div>
        <div style={{display:'flex',gap:6}}>
          {['Cash','Store credit'].map(function(m){
            var active = refundMethod===m;
            return(
              <button key={m} onClick={()=>setRefundMethod(m)}
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 14px',background:active?'rgba(217,119,6,0.1)':C.chromeDark,border:active?'1px solid '+C.warning:'1px solid '+C.borderMedium,borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.borderColor=C.warning;}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.borderColor=active?C.warning:C.borderMedium;}}>
                <div style={{width:18,height:18,borderRadius:'50%',border:active?'2px solid '+C.warning:'2px solid '+C.borderMedium,background:active?C.warning:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {active&&<div style={{width:7,height:7,borderRadius:'50%',background:'#fff'}}/>}
                </div>
                <span style={{color:active?C.warning:C.textPrimary,fontSize:14,fontWeight:active?600:400}}>{m==='Cash'?'💵':'🏷️'} {m}</span>
              </button>
            );
          })}
        </div>
        <div style={btnRow}>
          <button onClick={()=>setStep(hasTip?STEPS.TIP:STEPS.REASON)} style={btnSecondary}>← Back</button>
          <button onClick={()=>setStep(STEPS.CONFIRM)} style={btnPrimary(true)}>Next</button>
        </div>
      </div></div>
    );
  }

  // -- STEP: CONFIRM --
  if(step === STEPS.CONFIRM){
    const itemsTotal = refundItemsTotal();
    const taxAmt = refundTaxCents();
    const grandTotal = refundGrandTotal();
    const reasonDisplay = isOther ? otherText.trim() : selectedPreset;
    const refItems = buildRefItems();
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>⚠️</span>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:C.warning,marginBottom:6}}>Confirm Refund</div>
        <div style={{color:C.textMuted,fontSize:13,marginBottom:16}}>Ticket #{ticket.ticketNumber} · {ticket.clientName||'Walk-in'}</div>
        <div style={{background:C.chromeDark,borderRadius:8,padding:'14px 16px',marginBottom:16,textAlign:'left'}}>
          {refItems.map(ri=>(
            <div key={ri.itemId} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.textPrimary,fontSize:13}}>{ri.name}</span>
              <span style={{color:C.warning,fontSize:13,fontWeight:600}}>−{fmt(ri.refundAmount_cents)}</span>
            </div>
          ))}
          <div style={{height:1,background:C.borderMedium,margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:C.textMuted,fontSize:12}}>Items subtotal</span>
            <span style={{color:C.textPrimary,fontSize:12}}>−{fmt(itemsTotal)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:C.textMuted,fontSize:12}}>Tax ({TAX_RATE}%)</span>
            <span style={{color:C.textPrimary,fontSize:12}}>−{fmt(taxAmt)}</span>
          </div>
          {tipRefundCents > 0&&(
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.textMuted,fontSize:12}}>Tip refunded{tipRefundCents < ticket.tipCents ? ' (partial)' : ''}</span>
              <span style={{color:C.warning,fontSize:12,fontWeight:500}}>−{fmt(tipRefundCents)}</span>
            </div>
          )}
          <div style={{height:1,background:C.borderMedium,margin:'4px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{color:C.warning,fontSize:14,fontWeight:600}}>Refund total</span>
            <span style={{color:C.warning,fontSize:16,fontWeight:700}}>−{fmt(grandTotal)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:C.textMuted,fontSize:12}}>Reason</span>
            <span style={{color:C.textPrimary,fontSize:12}}>{reasonDisplay}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{color:C.textMuted,fontSize:12}}>Method</span>
            <span style={{color:C.textPrimary,fontSize:12}}>{displayMethod()}</span>
          </div>
        </div>
        <div style={btnRow}>
          <button onClick={()=>setStep(STEPS.METHOD)} style={btnSecondary}>← Back</button>
          <button onClick={()=>setStep(STEPS.PRINT_ASK)} style={btnPrimary(true)}>Process Refund</button>
        </div>
      </div></div>
    );
  }

  // -- STEP: PRINT ASK --
  if(step === STEPS.PRINT_ASK){
    var resolvedMethod = displayMethod();
    var methodLower = resolvedMethod.toLowerCase();
    var isCash = methodLower.indexOf('cash') !== -1;
    var methodIcons = { 'credit':'💳', 'cash':'💵', 'zelle':'📱', 'gift card':'🎁', 'store credit':'🏷️' };
    var icon = '💰';
    Object.keys(methodIcons).forEach(function(k){ if(methodLower.indexOf(k) !== -1) icon = methodIcons[k]; });
    var cashMsg = isCash ? 'Hand ' + fmt(refundGrandTotal()) + ' cash to the client now.' : null;
    // Cash popup — must dismiss before proceeding
    if(isCash && !cashAlertDismissed){
      return(
        <div style={wrap}><div style={{...card,textAlign:'center'}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(217,119,6,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <span style={{fontSize:40}}>💵</span>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:C.warning,marginBottom:8}}>Cash Refund</div>
          <div style={{fontSize:32,fontWeight:700,color:C.textPrimary,marginBottom:12}}>{fmt(refundGrandTotal())}</div>
          <div style={{color:C.textPrimary,fontSize:16,lineHeight:1.6,marginBottom:24}}>{cashMsg}</div>
          <button onClick={()=>setCashAlertDismissed(true)}
            style={{height:52,padding:'0 40px',background:C.warning,border:'none',borderRadius:8,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            Done — Cash Given
          </button>
        </div></div>
      );
    }
    function doConfirm(showReceipt){
      if(showReceipt){ setStep(STEPS.RECEIPT); return; }
      onConfirm(buildResult());
    }
    return(
      <div style={wrap}><div style={{...card,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(217,119,6,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <span style={{fontSize:28}}>✓</span>
        </div>
        <div style={{fontSize:18,fontWeight:600,color:C.warning,marginBottom:6}}>Refund Processed</div>
        <div style={{color:C.textMuted,fontSize:13,marginBottom:12}}>{fmt(refundGrandTotal())} refunded on Ticket #{ticket.ticketNumber}</div>
        {/* Payment method badge — always shown */}
        <div style={{padding:'12px 18px',background:'rgba(217,119,6,0.08)',border:'1px solid '+C.warning,borderRadius:10,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <span style={{fontSize:22}}>{icon}</span>
          <span style={{color:C.warning,fontSize:15,fontWeight:700}}>{fmt(refundGrandTotal())} → {resolvedMethod}</span>
        </div>
        {isCash&&(
          <div style={{color:C.warning,fontSize:12,fontWeight:500,marginBottom:12}}>💵 Cash given to client ✓</div>
        )}
        <div style={{fontSize:14,fontWeight:500,color:C.textPrimary,marginBottom:16}}>Print refund receipt?</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button onClick={()=>doConfirm(true)}
            style={{height:48,padding:'0 28px',background:C.chromeDark,border:'1px solid '+C.borderMedium,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            🧾 View Receipt
          </button>
          <button onClick={()=>doConfirm(false)}
            style={{height:48,padding:'0 28px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            Done
          </button>
        </div>
      </div></div>
    );
  }

  // -- STEP: RECEIPT --
  if(step === STEPS.RECEIPT){
    const now = new Date();
    const refItems = buildRefItems();
    const itemsTotal = refundItemsTotal();
    const taxAmt = refundTaxCents();
    const grandTotal = refundGrandTotal();
    const reasonDisplay = isOther ? otherText.trim() : selectedPreset;
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
          <div style={{textAlign:'center',fontWeight:700,fontSize:16,color:'#B45309',margin:'8px 0'}}>*** REFUND ***</div>
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between'}}><span>Orig Ticket #{ticket.ticketNumber}</span><span>{ticket.txnId}</span></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span>{dateStr(now.getTime())}</span><span>{timeStr(now.getTime())}</span></div>
          {ticket.clientName&&<div>Client: {ticket.clientName}</div>}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{fontWeight:700,marginBottom:4}}>Refunded Items:</div>
          {refItems.map(ri=>(
            <div key={ri.itemId} style={{display:'flex',justifyContent:'space-between'}}>
              <span>{ri.name}</span><span>-{fmt(ri.refundAmount_cents)}</span>
            </div>
          ))}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span>Items Subtotal</span><span>-{fmt(itemsTotal)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span>Tax ({TAX_RATE}%)</span><span>-{fmt(taxAmt)}</span>
          </div>
          {tipRefundCents > 0&&(
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Tip Refunded{tipRefundCents < ticket.tipCents ? ' (partial)' : ''}</span><span>-{fmt(tipRefundCents)}</span>
            </div>
          )}
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:700}}>
            <span>Refund Total</span><span>-{fmt(grandTotal)}</span>
          </div>
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}}/>
          <div>Reason: {reasonDisplay}</div>
          <div>Method: {displayMethod()}</div>
          <div>Processed by: {staffName||'Staff'}</div>
          <div>Processed at: {timeStr(now.getTime())} {dateStr(now.getTime())}</div>
        </div>
        <button onClick={()=>onConfirm(buildResult())}
          style={{width:'100%',height:48,marginTop:12,background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Done
        </button>
      </div></div>
    );
  }

  return null;
}
