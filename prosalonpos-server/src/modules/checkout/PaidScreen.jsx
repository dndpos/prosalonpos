import { useTheme } from '../../lib/ThemeContext';
import { relayPrint } from '../../lib/printRelay';
import { getNextSlipNumber } from '../../lib/techSlipCounter';
/**
 * Pro Salon POS — Paid Screen
 * Shows after payment completes. Receipt options then close ticket.
 * TD-015: Receipt options after payment.
 *
 * Rules:
 * - Owner toggles which customer receipt buttons appear (email/text/print). "No Receipt" always shows.
 * - Email/Text NEVER auto-send. Always pre-fill so tech can confirm with client, then tap Send.
 * - Store/merchant copy auto-prints on ticket close if owner setting is on (separate from customer receipt).
 * - "No Receipt" = no customer receipt. Store copy still prints per its own setting.
 */
import { useState, useEffect } from 'react';
import { CHECKOUT_SETTINGS } from './checkoutBridge';
import { fmt, fp } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';

export default function PaidScreen({ totalCents, clientName, client, payments, changeDue, onCloseTicket, salonSettings, ticket }){
  var C = useTheme();
  const [receiptStep, setReceiptStep] = useState('choose'); // choose | sending | sent
  const [receiptChoice, setReceiptChoice] = useState(null); // email | text | print | none
  const [emailInput, setEmailInput] = useState(client?.email || '');
  const [phoneInput, setPhoneInput] = useState(client?.phone || '');

  const settings = Object.assign({}, CHECKOUT_SETTINGS, salonSettings || {});

  // Auto-close 5 seconds after reaching the "sent/done" screen
  useEffect(function() {
    if (receiptStep !== 'sent') return;
    var timer = setTimeout(function() { handleClose(); }, 5000);
    return function() { clearTimeout(timer); };
  }, [receiptStep]);

  // Auto-close 5 seconds after showing receipt options if nothing is picked
  useEffect(function() {
    if (receiptStep !== 'choose') return;
    var timer = setTimeout(function() {
      if (!receiptChoice) {
        setReceiptChoice('none');
        setReceiptStep('sent');
      }
    }, 5000);
    return function() { clearTimeout(timer); };
  }, [receiptStep, receiptChoice]);

  // Build available customer receipt buttons from owner settings
  const receiptButtons = [];
  if(settings.receipt_email_enabled) receiptButtons.push({id:'email', icon:'📧', label:'Email'});
  if(settings.receipt_text_enabled)  receiptButtons.push({id:'text',  icon:'📱', label:'Text'});
  if(settings.receipt_print_enabled) receiptButtons.push({id:'print', icon:'🖨️', label:'Print'});
  receiptButtons.push({id:'none', icon:'—', label:'No Receipt'});

  function handleReceiptChoice(choice){
    // Toggle — tap same button again to deselect
    if(receiptChoice === choice && (choice === 'email' || choice === 'text')){
      setReceiptChoice(null);
      return;
    }
    setReceiptChoice(choice);
    if(choice === 'none'){
      setReceiptStep('sent');
      return;
    }
    if(choice === 'print'){
      setReceiptStep('sending');
      setTimeout(()=> setReceiptStep('sent'), 800);
      return;
    }
    // Email or Text — just highlight, input shows inline below
  }

  function handleSendReceipt(){
    setReceiptStep('sending');
    setTimeout(()=> setReceiptStep('sent'), 1000);
  }

  useNumpadKeyboard(
    receiptChoice === 'text',
    function(d) { if (phoneInput.length < 10) setPhoneInput(function(p) { return p + d; }); },
    function() { setPhoneInput(function(p) { return p.slice(0, -1); }); },
    function() { if (phoneInput.length === 10) handleSendReceipt(); },
    null,
    [receiptChoice, phoneInput]
  );

  function handleClose(){
    // Store auto-print fires silently on close
    if(settings.store_auto_print_receipt){
      relayPrint('receipt', {
        salonName: settings.salon_name || 'Salon',
        salonAddress: settings.address,
        salonPhone: settings.phone,
        ticketNumber: ticket.ticketNumber || '',
        clientName: ticket.clientName,
        items: (ticket.items||[]).map(function(it){ return { name: it.name, price_cents: it.price_cents||0, tech: it.tech, qty: it.qty||1 }; }),
        subtotalCents: ticket.subtotalCents || 0,
        discountCents: ticket.discountCents || 0,
        taxCents: ticket.taxCents || 0,
        tipCents: ticket.tipCents || 0,
        totalCents: ticket.totalCents || 0,
        payments: ticket.payments || [],
      });
    }
    // Tech copy auto-print — one slip per tech
    if(settings.tech_auto_print_receipt !== false){
      printTechCopiesSilent();
    }
    onCloseTicket(receiptChoice);
  }

  function printTechCopiesSilent(){
    // Group service items by tech
    var byTech = {};
    (ticket.items||[]).filter(function(it){ return it.type==='service'; }).forEach(function(it){
      var key = it.techId || '__none__';
      if(!byTech[key]) byTech[key] = { techName: it.tech||'Staff', items: [] };
      byTech[key].items.push(it);
    });
    var groups = Object.values(byTech);
    if(groups.length === 0) return;

    var discReduces = !!settings.discount_reduces_commission;
    var totalDiscount = ticket.discountCents || 0;
    var totalServiceCents = (ticket.items||[]).filter(function(i){ return i.type==='service'; })
      .reduce(function(sum,i){ return sum+(i.price_cents||0); }, 0);
    var payLabel = (ticket.payments||[]).map(function(p){
      if(p.method==='cash') return 'Cash';
      if(p.method==='credit') return 'Credit';
      if(p.method==='zelle') return 'Zelle';
      if(p.method==='giftcard') return 'Gift Card';
      return p.method;
    }).join(' + ') || 'N/A';

    groups.forEach(function(group){
      var slipItems = group.items.map(function(it){
        var price = it.price_cents || 0;
        var productCost = it.product_cost_cents || 0;
        var after = Math.max(0, price - productCost);
        if(discReduces && totalDiscount > 0 && totalServiceCents > 0){
          var share = Math.round(totalDiscount * (price / totalServiceCents));
          after = Math.max(0, after - share);
        }
        return { name: it.name, price_cents: after };
      });
      relayPrint('tech_slip', {
        ticketNumber: ticket.ticketNumber || '',
        techName: group.techName,
        items: slipItems,
        paymentLabel: payLabel,
      });
    });
  }

  var METHOD_NAMES = { cash: 'Cash', credit: 'Credit Card', giftcard: 'Gift Card', zelle: 'Zelle' };
  const methodLabel = payments.map(function(p) { return METHOD_NAMES[p.method] || p.method; }).join(' + ');

  // Compute gift card remaining balances after payment
  var gcBalanceLines = payments.filter(function(p) { return p.method === 'giftcard' && p.gc_original_balance !== undefined; }).map(function(p) {
    var remaining = p.gc_original_balance - p.amount_cents;
    return { code: p.gc_code, remaining: remaining };
  });

  // ── SENDING state ──
  if(receiptStep === 'sending'){
    return(
      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.modalGradient,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <div style={{textAlign:'center',padding:32,borderRadius:14,border:'1px solid '+C.borderMedium,background:'rgba(30,41,59,0.85)',boxShadow:'0 16px 48px rgba(0,0,0,0.4)',minWidth:320}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <span style={{fontSize:28}}>{receiptChoice==='print'?'🖨️':receiptChoice==='email'?'📧':'📱'}</span>
          </div>
          <div style={{color:C.textPrimary,fontSize:16,fontWeight:500}}>
            {receiptChoice==='print'?'Printing customer receipt…':receiptChoice==='email'?'Sending email…':'Sending text…'}
          </div>
        </div>
      </div>
    );
  }

  // ── SENT / DONE state — show close button ──
  if(receiptStep === 'sent'){
    const receiptMsg = receiptChoice === 'none' ? 'No customer receipt'
      : receiptChoice === 'print' ? 'Customer receipt printed'
      : receiptChoice === 'email' ? `Receipt sent to ${emailInput}`
      : `Receipt sent to ${fp(phoneInput)}`;
    return(
      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.modalGradient,fontFamily:"'Inter',system-ui,sans-serif"}}>
        <div style={{textAlign:'center',maxWidth:380,padding:32,borderRadius:14,border:'1px solid '+C.borderMedium,background:'rgba(30,41,59,0.85)',boxShadow:'0 16px 48px rgba(0,0,0,0.4)'}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(5,150,105,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <span style={{fontSize:36}}>✓</span>
          </div>
          <div style={{color:C.success,fontSize:22,fontWeight:600,marginBottom:4}}>Paid</div>
          <div style={{color:C.textPrimary,fontSize:28,fontWeight:600,marginBottom:4}}>{fmt(totalCents)}</div>
          {clientName && <div style={{color:C.textPrimary,fontSize:16,marginBottom:6}}>{clientName}</div>}
          <div style={{color:C.textPrimary,fontSize:16,fontWeight:500,marginBottom:6}}>{methodLabel}</div>
          {gcBalanceLines.length > 0 && gcBalanceLines.map(function(gc) {
            return <div key={gc.code} style={{color:'#A78BFA',fontSize:14,marginBottom:4}}>Gift Card {gc.code} remaining: {fmt(gc.remaining)}</div>;
          })}
          {changeDue > 0 && <div style={{color:'#6EE7B7',fontSize:18,fontWeight:600,marginBottom:8}}>Change: {fmt(changeDue)}</div>}
          <div style={{color:C.textPrimary,fontSize:13,marginBottom:6}}>{receiptMsg}</div>
          {settings.store_auto_print_receipt && (
            <div style={{color:C.textPrimary,fontSize:11,marginBottom:20}}>Store copy will auto-print</div>
          )}
          <div style={{color:C.textMuted,fontSize:11,marginBottom:8}}>Auto-closing in a moment…</div>
          <button onClick={handleClose}
            style={{height:48,padding:'0 36px',background:C.blue,border:'none',borderRadius:8,color:'#fff',fontSize:15,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            Close Ticket
          </button>
        </div>
      </div>
    );
  }

  // ── CHOOSE receipt method — input appears inline below buttons ──
  const phoneComplete = phoneInput.replace(/\D/g,'').length === 10;
  const emailValid = emailInput.includes('@');
  return(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.modalGradient,fontFamily:"'Inter',system-ui,sans-serif",overflow:'auto'}}>
      <div style={{textAlign:'center',maxWidth:460,padding:32,borderRadius:14,border:'1px solid '+C.borderMedium,background:'rgba(30,41,59,0.85)',boxShadow:'0 16px 48px rgba(0,0,0,0.4)'}}>
        {/* Payment confirmed header */}
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(5,150,105,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <span style={{fontSize:36}}>✓</span>
        </div>
        <div style={{color:C.success,fontSize:22,fontWeight:600,marginBottom:4}}>Paid</div>
        <div style={{color:C.textPrimary,fontSize:28,fontWeight:600,marginBottom:4}}>{fmt(totalCents)}</div>
        {clientName && <div style={{color:C.textPrimary,fontSize:16,marginBottom:6}}>{clientName}</div>}
        <div style={{color:C.textPrimary,fontSize:16,fontWeight:500,marginBottom:6}}>{methodLabel}</div>
        {gcBalanceLines.length > 0 && gcBalanceLines.map(function(gc) {
          return <div key={gc.code} style={{color:'#A78BFA',fontSize:14,marginBottom:4}}>Gift Card {gc.code} remaining: {fmt(gc.remaining)}</div>;
        })}
        {changeDue > 0 && <div style={{color:'#6EE7B7',fontSize:18,fontWeight:600,marginBottom:16}}>Change: {fmt(changeDue)}</div>}

        {/* Receipt option buttons */}
        <div style={{color:C.textPrimary,fontSize:12,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10,marginTop:changeDue>0?0:16}}>Customer Receipt</div>
        <div style={{display:'grid',gridTemplateColumns:`repeat(${receiptButtons.length},1fr)`,gap:8,marginBottom:16}}>
          {receiptButtons.map(opt=>{
            const active = receiptChoice === opt.id;
            return(
              <button key={opt.id} onClick={()=> handleReceiptChoice(opt.id)}
                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'14px 8px',background:active?C.blueTint:C.grid,border:active?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=C.gridHover;}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.grid;}}}>
                <span style={{fontSize:22}}>{opt.icon}</span>
                <span style={{color:active?C.blueLight:C.textPrimary,fontSize:12,fontWeight:active?600:400}}>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inline input area — shows when email or text is selected */}
        {receiptChoice === 'email' && (
          <div style={{position:'relative',marginBottom:16}}>
        <AreaTag id="PAID" />
            <div style={{color:C.textPrimary,fontSize:12,marginBottom:8}}>Confirm email with client</div>
            <div style={{display:'flex',gap:8,maxWidth:360,margin:'0 auto'}}>
              <input value={emailInput} onChange={e=>setEmailInput(e.target.value)} placeholder="client@email.com" type="email"
                style={{flex:1,height:46,background:'#283548',border:`1px solid ${C.borderMedium}`,borderRadius:6,padding:'0 14px',color:C.textPrimary,fontSize:15,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
              <button onClick={handleSendReceipt} disabled={!emailValid}
                style={{height:46,padding:'0 20px',background:emailValid?C.blue:'#334155',border:'none',borderRadius:6,color:emailValid?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:emailValid?'pointer':'default',fontFamily:'inherit'}}>
                Send
              </button>
            </div>
          </div>
        )}

        {receiptChoice === 'text' && (
          <div style={{marginBottom:16}}>
            <div style={{color:C.textPrimary,fontSize:12,marginBottom:8}}>Confirm phone with client</div>
            {/* Phone display */}
            <div style={{background:phoneComplete?'rgba(5,150,105,0.15)':C.grid,borderRadius:8,padding:'10px 16px',marginBottom:10,maxWidth:280,margin:'0 auto 10px',border:phoneComplete?'1px solid rgba(5,150,105,0.3)':'1px solid transparent'}}>
              <span style={{color:phoneInput?C.textPrimary:C.textMuted,fontSize:18,fontWeight:500,fontVariantNumeric:'tabular-nums'}}>{phoneInput?fp(phoneInput):'(___) ___-____'}</span>
            </div>
            {/* Numpad */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,maxWidth:240,margin:'0 auto 12px'}}>
              {['7','8','9','4','5','6','1','2','3'].map(d=>(
                <div key={d} onClick={()=>{if(phoneInput.length<10)setPhoneInput(prev=>prev+d);}}
                  style={{height:48,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:6,color:C.btnText,fontSize:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                  onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
              ))}
              <div onClick={()=>setPhoneInput('')}
                style={{height:48,background:'#334155',border:'1px solid #475569',borderRadius:6,color:C.warning,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>CLR</div>
              <div onClick={()=>{if(phoneInput.length<10)setPhoneInput(prev=>prev+'0');}}
                style={{height:48,background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:6,color:C.btnText,fontSize:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>0</div>
              <div onClick={()=>setPhoneInput(prev=>prev.slice(0,-1))}
                style={{height:48,background:'#334155',border:'1px solid #475569',borderRadius:6,color:C.danger,fontSize:15,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>⌫</div>
            </div>
            {/* Send */}
            <button onClick={handleSendReceipt} disabled={!phoneComplete}
              style={{width:240,height:44,background:phoneComplete?C.blue:'#334155',border:'none',borderRadius:6,color:phoneComplete?'#fff':C.textMuted,fontSize:14,fontWeight:500,cursor:phoneComplete?'pointer':'default',fontFamily:'inherit',margin:'0 auto',display:'block'}}>
              Send Text
            </button>
          </div>
        )}

        {/* Skip shortcut — only show when nothing is selected yet */}
        {!receiptChoice && (
          <button onClick={()=> handleReceiptChoice('none')}
            style={{background:'none',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline',marginTop:4}}>
            Skip — no receipt
          </button>
        )}
      </div>
    </div>
  );
}
