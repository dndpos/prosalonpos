/** Pro Salon POS — Checkout Modals (extracted Session 21)
 * Gift Card, Payment Numpad, Discount, Tip, Remove Confirm, Price Edit modals.
 * Receives all state via ctx prop to avoid prop explosion.
 */
import { useTheme } from '../../lib/ThemeContext';
import { useEffect } from 'react';
import { fmt, numpadDisplay, numpadTap, numpadToCents, numpadToFloat, numpadKeys, roundToNickel, cashQuickAmounts } from './checkoutHelpers';
import { useGiftCardStore } from '../../lib/stores/giftCardStore';
import ClientLookupModal from './ClientLookupModal';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import AreaTag from '../../components/ui/AreaTag';

export default function CheckoutModals({ ctx }) {
  var C = useTheme();
  var {
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
  } = ctx;

  // ── Keyboard → numpad bridge for each modal ──
  // Payment numpad
  useNumpadKeyboard(!!payMethod, function(d){ setPayInput(function(p){ return numpadTap(d,p,settings.numpad_mode); }); }, function(){ setPayInput(function(p){ return numpadTap('⌫',p,settings.numpad_mode); }); }, null, function(){ setPayMethod(null); setPayInput(''); }, [payMethod]);
  // Discount numpad
  useNumpadKeyboard(showDiscountForm, function(d){ if(discountType==='flat_total') setDiscountValue(function(p){ return numpadTap(d,p,settings.numpad_mode); }); else setDiscountValue(function(p){ return p+d; }); }, function(){ if(discountType==='flat_total') setDiscountValue(function(p){ return numpadTap('⌫',p,settings.numpad_mode); }); else setDiscountValue(function(p){ return p.slice(0,-1); }); }, null, function(){ setShowDiscountForm(false); }, [showDiscountForm, discountType]);
  // Tip numpad
  useNumpadKeyboard(showTipForm, function(d){ setTipInput(function(p){ return numpadTap(d,p,settings.numpad_mode); }); }, function(){ setTipInput(function(p){ return numpadTap('⌫',p,settings.numpad_mode); }); }, null, function(){ setShowTipForm(false); }, [showTipForm]);
  // Price/discount edit numpad
  useNumpadKeyboard(!!editingId, function(d){ setEditPrice(function(p){ return editDiscType==='pct' ? (/\d/.test(d)?p+d:p) : numpadTap(d,p,settings.numpad_mode); }); }, function(){ setEditPrice(function(p){ return editDiscType==='pct' ? p.slice(0,-1) : numpadTap('⌫',p,settings.numpad_mode); }); }, null, cancelEdit, [editingId, editDiscType]);
  // Gift card lookup keyboard — supports digits AND letters (card codes can be alphanumeric)
  useEffect(function() {
    if (gcLookup !== 'input') return;
    function handleGcKey(e) {
      if (/^[a-zA-Z0-9]$/.test(e.key)) { e.preventDefault(); setGcCodeInput(function(p) { return p + e.key.toUpperCase(); }); setGcError(false); return; }
      if (e.key === 'Backspace') { e.preventDefault(); setGcCodeInput(function(p) { return p.slice(0, -1); }); setGcError(false); return; }
      if (e.key === '-') { e.preventDefault(); setGcCodeInput(function(p) { return p + '-'; }); return; }
      if (e.key === 'Escape') { e.preventDefault(); setGcLookup(null); setGcCodeInput(''); setGcError(false); return; }
    }
    window.addEventListener('keydown', handleGcKey);
    return function() { window.removeEventListener('keydown', handleGcKey); };
  }, [gcLookup]);

  return (
    <>
      {/* ═══ GIFT CARD LOOKUP MODAL ═══ */}
      {gcLookup&&(()=>{
        function gcKeyTap(d){
          if(d==='C'){setGcCodeInput('');setGcError(false);return;}
          if(d==='⌫'){setGcCodeInput(prev=>prev.slice(0,-1));setGcError(false);return;}
          setGcCodeInput(prev=>prev+d);setGcError(false);
        }
        function gcLookupCard(code){
          var search=code||gcCodeInput;
          if(!search||!search.trim()){setGcError(true);return;}
          // Use API lookup instead of local array search
          var lookupFn=useGiftCardStore.getState().lookupGiftCard;
          lookupFn(search.trim()).then(function(card){
            if(!card||card.status==='depleted'||card.balance_cents<=0){setGcError(true);return;}
            if(card.balance_cents>=remaining){
              // Card covers full remaining — add payment and close
              setPayments(prev=>[...prev,{method:'giftcard',amount_cents:remaining,gc_id:card.id,gc_code:card.code,gc_original_balance:card.balance_cents}]);
              setGcLookup(null);setGcCodeInput('');
            } else {
              setGcLookup({card:card,balance:card.balance_cents});
            }
          }).catch(function(err){
            console.warn('[GC Lookup] API error:', err.message);
            setGcError(true);
          });
        }
        function gcUseBalance(){
          var card=gcLookup.card;
          var amt=gcLookup.balance;
          setPayments(prev=>[...prev,{method:'giftcard',amount_cents:amt,gc_id:card.id,gc_code:card.code,gc_original_balance:card.balance_cents}]);
          setGcLookup(null);setGcCodeInput('');
        }
        var isInput=gcLookup==='input';
        var cardFound=!isInput&&gcLookup.card;
        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>{setGcLookup(null);setGcCodeInput('');setGcError(false);}}>
          <div style={{background:C.modalGradient,border:'1px solid '+C.borderMedium,borderRadius:14,width:380,boxShadow:'0 20px 60px rgba(0,0,0,0.5)',padding:24}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:16,textAlign:'center'}}>🎁 Gift Card Payment</div>
            {isInput&&(<>
              <div style={{color:C.textPrimary,fontSize:13,marginBottom:10,textAlign:'center'}}>Enter or scan gift card number</div>
              <div style={{background:C.inputBg,border:'1px solid '+C.inputBorder,borderRadius:8,padding:'12px 16px',marginBottom:4,textAlign:'center',minHeight:24}}>
                <span style={{color:gcCodeInput?C.inputText:'#94A3B8',fontSize:18,fontWeight:500,fontVariantNumeric:'tabular-nums',letterSpacing:1}}>{gcCodeInput||'Card number'}</span>
              </div>
              <div style={{color:C.textPrimary,fontSize:11,marginBottom:12,textAlign:'center'}}>Due: {fmt(remaining)}</div>
              {gcError&&<div style={{color:C.danger,fontSize:13,marginBottom:10,textAlign:'center'}}>Card not found or has zero balance</div>}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:12}}>
                {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(d){
                  var isAction=d==='⌫'||d==='C';
                  return(
                    <div key={d} onClick={function(){gcKeyTap(d);}}
                      style={{height:48,background:isAction?'#334155':C.btnBg,border:isAction?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:d==='C'?C.warning:C.btnText,fontSize:18,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                      onMouseEnter={function(e){e.currentTarget.style.background=isAction?'#475569':'#E2E8F0';}}
                      onMouseLeave={function(e){e.currentTarget.style.background=isAction?'#334155':C.btnBg;}}
                    >{d}</div>
                  );
                })}
              </div>
              <div onClick={function(){if(gcCodeInput.length>=1)gcLookupCard();}}
                style={{width:'100%',height:46,background:gcCodeInput.length>=1?C.blue:'#334155',border:'none',borderRadius:8,color:gcCodeInput.length>=1?'#fff':C.textMuted,fontSize:14,fontWeight:600,cursor:gcCodeInput.length>=1?'pointer':'default',fontFamily:'inherit',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',boxSizing:'border-box'}}>
                Look Up Card
              </div>
              <div onClick={function(){setGcLookup(null);setGcCodeInput('');setGcError(false);}}
                style={{width:'100%',height:40,background:'transparent',border:'1px solid '+C.danger,borderRadius:8,color:C.danger,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',boxSizing:'border-box'}}>
                Cancel
              </div>
            </>)}
            {cardFound&&(<>
              <div style={{background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,padding:16,marginBottom:16,textAlign:'center'}}>
                <div style={{color:C.textPrimary,fontSize:14,fontWeight:500,marginBottom:8,fontVariantNumeric:'tabular-nums',letterSpacing:1}}>{gcLookup.card.code}</div>
                {gcLookup.card.client_name&&<div style={{color:C.textPrimary,fontSize:12,marginBottom:4}}>{gcLookup.card.client_name}</div>}
                <div style={{color:C.warning,fontSize:13,marginBottom:2}}>Balance</div>
                <div style={{color:C.warning,fontSize:24,fontWeight:700}}>{fmt(gcLookup.balance)}</div>
              </div>
              <div onClick={gcUseBalance}
                style={{width:'100%',height:46,background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',boxSizing:'border-box'}}>
                Use {fmt(gcLookup.balance)}
              </div>
              <div onClick={function(){setGcLookup('input');setGcCodeInput('');setGcError(false);}}
                style={{width:'100%',height:40,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:8,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',boxSizing:'border-box'}}>
                Try Different Card
              </div>
            </>)}
          </div>
        </div>);
      })()}

      {/* ═══ PAYMENT NUMPAD MODAL ═══ */}
      {payMethod&&(()=>{
        const isCash = payMethod==='cash';
        const dueCents = (isCash && settings.cash_rounding) ? roundToNickel(remaining) : remaining;
        const wasRounded = isCash && settings.cash_rounding && dueCents !== remaining;
        const quickAmts = isCash ? cashQuickAmounts(dueCents) : [];
        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPayMethod(null)}>
          <div style={{background:C.bg,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Pay — {isCash?'Cash':payMethod==='credit'?'Credit Card':payMethod==='giftcard'?'Gift Card':'Zelle'}</div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
                <div style={{color:C.blueLight,fontSize:14,fontWeight:600}}>Due: {fmt(dueCents)}</div>
                {wasRounded && <div style={{color:C.textMuted,fontSize:10}}>rounded from {fmt(remaining)}</div>}
              </div>
            </div>
            <div style={{padding:16}}>
              <div style={{background:C.chrome,borderRadius:8,padding:'12px 16px',marginBottom:12,textAlign:'center',border:'1px solid '+C.borderMedium}}>
                <span style={{color:C.textPrimary,fontSize:28,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${numpadDisplay(payInput,settings.numpad_mode)}</span>
              </div>
              <div onClick={()=>{setPayments(prev=>[...prev,{method:payMethod,amount_cents:dueCents}]);if(isCash&&onCashPayment)onCashPayment(dueCents);setPayMethod(null);setPayInput('');}}
                style={{width:'100%',height:44,background:C.success,border:'none',borderRadius:6,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:isCash&&quickAmts.length>0?8:10,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>
                Pay in Full — {fmt(dueCents)}
              </div>
              {isCash&&quickAmts.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(quickAmts.length,5)},1fr)`,gap:5,marginBottom:10}}>
                  {quickAmts.map(amt=>(
                    <div key={amt} onClick={()=>{setPayments(prev=>[...prev,{method:'cash',amount_cents:amt}]);if(onCashPayment)onCashPayment(amt);setPayMethod(null);setPayInput('');}}
                      style={{height:44,background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',transition:'background-color 150ms'}}
                      onMouseEnter={e=>{e.currentTarget.style.background=C.gridHover;}}
                      onMouseLeave={e=>{e.currentTarget.style.background=C.chrome;}}>
                      {fmt(amt)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {numpadKeys(settings.numpad_mode).map(d=>(
                  <div key={d} onClick={()=>setPayInput(prev=>numpadTap(d,prev,settings.numpad_mode))}
                    style={{height:50,background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:6,color:d==='⌫'?C.danger:C.textPrimary,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',transition:'background-color 150ms'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.gridHover}
                    onMouseLeave={e=>e.currentTarget.style.background=C.chrome}>{d}</div>
                ))}
              </div>
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <div onClick={()=>setPayMethod(null)} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>Cancel</div>
                {(()=>{const v=numpadToFloat(payInput,settings.numpad_mode);return(
                <div onClick={handlePayAmount}
                  style={{flex:1,height:40,background:v>0?C.blue:C.chrome,border:v>0?'none':'1px solid '+C.borderMedium,borderRadius:6,color:v>0?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:v>0?'pointer':'default',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>
                  Apply {v>0?`$${numpadDisplay(payInput,settings.numpad_mode)}`:''}
                </div>);})()}
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* ═══ DISCOUNT MODAL ═══ */}
      {showDiscountForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowDiscountForm(false)}>
          <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Add Discount</div>
              <div style={{color:C.textMuted,fontSize:12}}>Subtotal: {fmt(subtotalBefore)}</div>
            </div>
            <div style={{padding:16}}>
              <div style={{display:'flex',gap:4,marginBottom:12}}>
                <button onClick={()=>{setDiscountType('flat_total');setDiscountValue('');}} style={{flex:1,height:36,background:discountType==='flat_total'?C.blueTint:'transparent',border:discountType==='flat_total'?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:6,color:discountType==='flat_total'?C.blueLight:C.textMuted,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>$ off</button>
                <button onClick={()=>{setDiscountType('pct_total');setDiscountValue('');}} style={{flex:1,height:36,background:discountType==='pct_total'?C.blueTint:'transparent',border:discountType==='pct_total'?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:6,color:discountType==='pct_total'?C.blueLight:C.textMuted,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>% off</button>
              </div>
              <div style={{background:C.grid,borderRadius:8,padding:'10px 16px',marginBottom:10,textAlign:'center'}}>
                <span style={{color:C.textPrimary,fontSize:26,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>
                  {discountType==='flat_total'?`$${numpadDisplay(discountValue,settings.numpad_mode)}`:`${discountValue||'0'}%`}
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:10}}>
                {discountType==='flat_total'
                  ? (settings.discount_presets_flat_cents||[]).map(c=>(
                    <div key={c} onClick={()=>applyDiscountPreset(c)}
                      style={{height:38,background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.success;e.currentTarget.style.background='rgba(5,150,105,0.1)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}>
                      {fmt(c)}
                    </div>))
                  : (settings.discount_presets_pct||[]).map(p=>(
                    <div key={p} onClick={()=>applyDiscountPreset(p)}
                      style={{height:38,background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.success;e.currentTarget.style.background='rgba(5,150,105,0.1)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}>
                      {p}%
                    </div>))
                }
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                {(discountType==='flat_total'?numpadKeys(settings.numpad_mode):['7','8','9','4','5','6','1','2','3','.','0','⌫']).map(d=>(
                  <div key={d} onClick={()=>{
                    if(discountType==='flat_total') setDiscountValue(prev=>numpadTap(d,prev,settings.numpad_mode));
                    else { if(d==='⌫') setDiscountValue(prev=>prev.slice(0,-1)); else if(d==='.'&&discountValue.includes('.'))return; else setDiscountValue(prev=>prev+d); }
                  }} style={{height:46,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                    onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
                ))}
              </div>
              {(()=>{const hasVal=discountType==='flat_total'?numpadToFloat(discountValue,settings.numpad_mode)>0:(parseFloat(discountValue)||0)>0; return(
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button onClick={()=>{setShowDiscountForm(false);setDiscountValue('');}} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={applyDiscount} disabled={!hasVal}
                  style={{flex:1,height:40,background:hasVal?C.success:'#334155',border:'none',borderRadius:6,color:hasVal?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:hasVal?'pointer':'default',fontFamily:'inherit'}}>Apply</button>
              </div>);})()}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TIP MODAL ═══ */}
      {showTipForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowTipForm(false)}>
          <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Add Tip</div>
              <div style={{color:C.textMuted,fontSize:12}}>Before tip: {fmt(totalBeforeTip)}</div>
            </div>
            <div style={{padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:`repeat(${settings.tip_presets.length},1fr)`,gap:5,marginBottom:10}}>
                {settings.tip_presets.map(pct=>{
                  const amt=Math.round(totalBeforeTip*pct/100);
                  const isActive=tipAmount===amt&&amt>0;
                  return(
                    <div key={pct} onClick={()=>applyTipPreset(pct)}
                      style={{height:52,background:isActive?C.blueTint:C.chromeDark,border:isActive?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:6,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,userSelect:'none'}}
                      onMouseEnter={e=>{if(!isActive){e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=C.blueTint;}}}
                      onMouseLeave={e=>{if(!isActive){e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}}>
                      <span style={{color:isActive?C.blueLight:C.textPrimary,fontSize:15,fontWeight:600}}>{pct}%</span>
                      <span style={{color:isActive?C.blueLight:C.textMuted,fontSize:11}}>{fmt(amt)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5}}>Custom Amount</div>
              <div style={{background:C.grid,borderRadius:8,padding:'10px 16px',marginBottom:10,textAlign:'center'}}>
                <span style={{color:C.textPrimary,fontSize:26,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${numpadDisplay(tipInput,settings.numpad_mode)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                {numpadKeys(settings.numpad_mode).map(d=>(
                  <div key={d} onClick={()=>setTipInput(prev=>numpadTap(d,prev,settings.numpad_mode))}
                    style={{height:46,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                    onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
                ))}
              </div>
              {(()=>{const tipVal=numpadToFloat(tipInput,settings.numpad_mode); return(
              <div style={{display:'flex',gap:6,marginTop:10}}>
                {tipAmount>0?(
                  <button onClick={clearTip} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Remove Tip</button>
                ):(
                  <button onClick={()=>setShowTipForm(false)} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                )}
                <button onClick={applyTipCustom} disabled={tipVal<=0}
                  style={{flex:1,height:40,background:tipVal>0?C.blue:'#334155',border:'none',borderRadius:6,color:tipVal>0?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:tipVal>0?'pointer':'default',fontFamily:'inherit'}}>
                  Apply {tipVal>0?`$${numpadDisplay(tipInput,settings.numpad_mode)}`:''}
                </button>
              </div>);})()}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CLIENT LOOKUP MODAL ═══ */}
      {showClientLookup&&<ClientLookupModal onSelect={handleClientSelect} onClose={()=>setShowClientLookup(false)}/>}

      {/* ═══ REMOVE CONFIRMATION MODAL ═══ */}
      {confirmRemove&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setConfirmRemove(null)}>
          <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`}}><div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Remove Item</div></div>
            <div style={{padding:20}}>
              <div style={{color:C.textPrimary,fontSize:13,lineHeight:1.5,marginBottom:16}}>
                Are you sure you want to remove <span style={{color:C.textPrimary,fontWeight:600}}>{confirmRemove.name}</span> from the ticket?
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmRemove(null)} style={{flex:1,height:42,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>No, Go Back</button>
                <button onClick={()=>removeItem(confirmRemove.id)} style={{flex:1,height:42,background:C.danger,border:'none',borderRadius:6,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Yes, Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PRICE EDIT / PER-ITEM DISCOUNT MODAL ═══ */}
      {editingId&&(()=>{
        const editItem=items.find(i=>i.id===editingId);
        const isDisc=editMode==='discount';
        const basePrice=getPrice(editItem)*(editItem?.qty||1);
        const v=isDisc&&editDiscType==='pct'?parseFloat(editPrice)||0:numpadToFloat(editPrice,settings.numpad_mode);
        const hasVal=v>0;
        const discPresets=editDiscType==='flat'?settings.discount_presets_flat_cents:settings.discount_presets_pct;
        const btnLabel=isDisc?(editDiscType==='flat'?(hasVal?`Apply −$${numpadDisplay(editPrice,settings.numpad_mode)}`:'Apply'):(hasVal?`Apply −${editPrice}%`:'Apply')):(hasVal?`Set Price $${numpadDisplay(editPrice,settings.numpad_mode)}`:'Set Price');
        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={cancelEdit}>
        <AreaTag id="CO-MODAL" />
          <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'12px 20px',borderBottom:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{color:C.textPrimary,fontSize:14,fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{editItem?.name||''}</div>
              <div style={{color:C.textMuted,fontSize:12,marginLeft:8}}>{fmt(basePrice)}</div>
            </div>
            <div style={{display:'flex',margin:'10px 16px 0',background:C.chromeDark,borderRadius:6,padding:2}}>
              {[{id:'price',label:'Change Price'},{id:'discount',label:'Discount'}].map(t=>{
                const act=editMode===t.id;
                return(<button key={t.id} onClick={()=>{if(t.id==='discount'){switchToDiscountMode();}else{setEditMode(t.id);}setEditPrice('');}}
                  style={{flex:1,height:32,background:act?C.blue:'transparent',border:'none',borderRadius:5,color:act?'#fff':C.textMuted,fontSize:12,fontWeight:act?600:400,cursor:'pointer',fontFamily:'inherit'}}>{t.label}</button>);
              })}
            </div>
            <div style={{padding:16}}>
              {isDisc&&(
                <>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {[{id:'flat',label:'$ Off'},{id:'pct',label:'% Off'}].map(t=>{
                      const act=editDiscType===t.id;
                      return(<button key={t.id} onClick={()=>{setEditDiscType(t.id);setEditPrice('');}}
                        style={{flex:1,height:30,background:act?C.blueTint:'transparent',border:act?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:5,color:act?C.blueLight:C.textMuted,fontSize:11,fontWeight:act?600:400,cursor:'pointer',fontFamily:'inherit'}}>{t.label}</button>);
                    })}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(discPresets.length,4)},1fr)`,gap:4,marginBottom:8}}>
                    {discPresets.map(val=>(
                      <div key={val} onClick={()=>applyEditPreset(val)}
                        style={{height:36,background:C.chromeDark,border:`1px solid ${C.borderMedium}`,borderRadius:5,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=C.blueTint;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}>
                        {editDiscType==='flat'?`$${(val/100).toFixed(0)}`:`${val}%`}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{background:C.grid,borderRadius:8,padding:'10px 16px',marginBottom:10,textAlign:'center'}}>
                <span style={{color:C.textPrimary,fontSize:26,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>
                  {isDisc&&editDiscType==='pct'?`${editPrice||'0'}%`:`$${numpadDisplay(editPrice,settings.numpad_mode)}`}
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                {numpadKeys(settings.numpad_mode).map(d=>(
                  <div key={d} onClick={()=>setEditPrice(prev=>isDisc&&editDiscType==='pct'?(d==='⌫'?prev.slice(0,-1):/\d/.test(d)?prev+d:prev):numpadTap(d,prev,settings.numpad_mode))}
                    style={{height:48,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                    onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
                ))}
              </div>
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button onClick={cancelEdit} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={confirmEdit} disabled={!hasVal}
                  style={{flex:1,height:40,background:hasVal?(isDisc?C.success:C.blue):'#334155',border:'none',borderRadius:6,color:hasVal?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:hasVal?'pointer':'default',fontFamily:'inherit'}}>
                  {btnLabel}
                </button>
              </div>
            </div>
          </div>
        </div>);})()}
    </>
  );
}
