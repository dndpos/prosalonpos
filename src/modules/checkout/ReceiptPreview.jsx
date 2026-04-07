import { useTheme } from '../../lib/ThemeContext';
/** Pro Salon POS — Receipt Preview. 80mm thermal receipt. Customer vs Store copy toggle. */
import { useState } from 'react';
import { CHECKOUT_SETTINGS, SALON_INFO, CHECKOUT_STAFF } from './checkoutBridge';
import { fmt } from '../../lib/formatUtils';
import { relayPrint } from '../../lib/printRelay';

function pad2(n){ return n<10?'0'+n:''+n; }

export default function ReceiptPreview({ ticket, onClose }){
  var C = useTheme();
  if(!ticket) return null;
  const [copyType, setCopyType] = useState('customer'); // customer | store | tech
  const isStore = copyType==='store';
  const isTech = copyType==='tech';
  const s = CHECKOUT_SETTINGS;
  const salon = SALON_INFO;

  const d = new Date(ticket.closedAt);
  const dateStr = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  let h=d.getHours(), m=d.getMinutes(), ap=h>=12?'PM':'AM'; h=h%12||12;
  const timeStr = `${h}:${pad2(m)} ${ap}`;

  const createdByStaff = ticket.createdBy ? CHECKOUT_STAFF.find(st=>st.id===ticket.createdBy)?.display_name : null;
  const closedByStaff = ticket.closedBy ? CHECKOUT_STAFF.find(st=>st.id===ticket.closedBy)?.display_name : null;

  // Group items by tech
  const techGroupMap = {};
  const retailItems = [];
  (ticket.items||[]).forEach(it=>{
    if(it.type==='retail'){ retailItems.push(it); return; }
    const k = it.techId||'__none__';
    if(!techGroupMap[k]) techGroupMap[k]={ techName:it.tech||'Staff', techId:it.techId, items:[] };
    techGroupMap[k].items.push(it);
  });
  const techGroups = Object.values(techGroupMap);

  // Build per-tech tip map for store copy
  const tipByTech = {};
  if(isStore && ticket.tipDistributions){
    ticket.tipDistributions.forEach(td=>{ tipByTech[td.techId]=td.amount_cents; });
  }

  // Payment labels
  const payLabels = (ticket.payments||[]).map(p=>{
    if(p.method==='credit') return `Credit${p.last4?' ····'+p.last4:''}`;
    if(p.method==='cash') return 'Cash';
    if(p.method==='zelle') return 'Zelle';
    if(p.method==='giftcard') return 'Gift Card';
    return p.method;
  });

  const hasCreditPay = (ticket.payments||[]).some(p=>p.method==='credit');
  const showBlankTipSig = hasCreditPay && (!ticket.tipCents||ticket.tipCents===0) && !ticket.tipAutoRemoved && s.receipt_show_signature;

  const W = 320;
  const base = { color:'#1A1A1A', fontFamily:"'Courier New', Courier, monospace", fontSize:12, lineHeight:1.5 };
  const sep = <div style={{borderTop:'1px dashed #999',margin:'6px 0'}}/>;
  const center = { textAlign:'center' };
  const row = { display:'flex', justifyContent:'space-between' };

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',system-ui,sans-serif"}} onClick={onClose}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}} onClick={e=>e.stopPropagation()}>

        {/* Customer / Store / Tech toggle — softcolor tabs */}
        <div style={{display:'flex',gap:4,background:C.chromeDark,borderRadius:8,padding:3}}>
          {[{id:'customer',label:'Customer',bg:'#1E3A5F',border:'#2D5A8E',text:'#93C5FD'},{id:'store',label:'Store',bg:'#1A332B',border:'#2D5A3E',text:'#6EE7B7'},{id:'tech',label:'Tech Copy',bg:'#2D1B4E',border:'#4C1D95',text:'#C4B5FD'}].map(t=>{
            const active=copyType===t.id;
            return(<button key={t.id} onClick={()=>setCopyType(t.id)}
              style={{height:32,padding:'0 16px',background:active?t.bg:'transparent',border:active?'1px solid '+t.border:'1px solid transparent',borderRadius:6,color:active?t.text:C.textMuted,fontSize:12,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit'}}>{t.label}</button>);
          })}
        </div>

        {/* Tech copy — one slip per tech */}
        {isTech && (
          <div style={{display:'flex',flexDirection:'column',gap:12,maxHeight:'80vh',overflow:'auto'}}>
            {techGroups.map(function(group) {
              // Build payment label (short form)
              var payLabel = payLabels.length > 0 ? payLabels.join(' + ') : 'N/A';
              // Discount reduces commission setting
              var discReduces = s.discount_reduces_commission;
              var totalDiscount = ticket.discountCents || 0;
              var totalServiceCents = (ticket.items||[]).filter(function(i){ return i.type==='service'; }).reduce(function(sum,i){ return sum+(i.price_cents||0); },0);
              // Per-tech services with deduction applied
              var techServiceTotal = 0;
              var techLines = group.items.filter(function(it){ return it.type==='service'; }).map(function(it) {
                var price = it.price_cents || 0;
                // Product cost deduction
                var productCost = it.product_cost_cents || 0;
                var afterDeduct = Math.max(0, price - productCost);
                // If discount reduces commission, apply proportional discount share
                if(discReduces && totalDiscount > 0 && totalServiceCents > 0) {
                  var share = Math.round(totalDiscount * (price / totalServiceCents));
                  afterDeduct = Math.max(0, afterDeduct - share);
                }
                techServiceTotal += afterDeduct;
                return { name: it.name, priceCents: afterDeduct, hasDeduct: productCost > 0 };
              });
              if(techLines.length === 0) return null;
              return (
                <div key={group.techId} style={{width:W,background:'#FEFEF6',borderRadius:4,padding:'16px 18px',boxShadow:'0 4px 20px rgba(0,0,0,0.4)',...base}}>
                  {/* Ticket number */}
                  <div style={{...center,marginBottom:6}}>
                    <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.05em'}}>TICKET #{ticket.displayNumber||ticket.ticketNumber}</div>
                  </div>
                  {sep}
                  {/* Tech name */}
                  <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{group.techName}</div>
                  {sep}
                  {/* Service lines */}
                  {techLines.map(function(line, i) {
                    return (
                      <div key={i} style={{...row,marginBottom:2}}>
                        <span style={{flex:1,marginRight:8}}>{line.name}{line.hasDeduct?' *':''}</span>
                        <span style={{fontVariantNumeric:'tabular-nums'}}>${(line.priceCents/100).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {sep}
                  {/* Total */}
                  <div style={{...row,fontWeight:700,fontSize:13}}>
                    <span>Total</span>
                    <span style={{fontVariantNumeric:'tabular-nums'}}>${(techServiceTotal/100).toFixed(2)}</span>
                  </div>
                  {/* Payment method */}
                  <div style={{...row,marginTop:4,fontSize:11,color:'#555'}}>
                    <span>Payment</span>
                    <span style={{textTransform:'capitalize'}}>{payLabel}</span>
                  </div>
                  {/* Deduction note */}
                  {techLines.some(function(l){ return l.hasDeduct; }) && (
                    <div style={{fontSize:10,color:'#888',marginTop:8}}>* Price shown after product deduction</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Receipt paper — customer or store copy */}
        {!isTech && (
        <div style={{width:W,maxHeight:'80vh',overflow:'auto',background:'#FEFEF6',borderRadius:4,padding:'20px 18px',boxShadow:'0 8px 40px rgba(0,0,0,0.5)',...base}}>

          {/* Salon header */}
          <div style={{...center,marginBottom:8}}>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:'0.02em'}}>{salon.name}</div>
            <div style={{fontSize:11}}>{salon.address_line1}</div>
            <div style={{fontSize:11}}>{salon.address_line2}</div>
            <div style={{fontSize:11}}>{salon.phone}</div>
          </div>

          {sep}

          {/* Ticket info */}
          <div style={{marginBottom:2}}>
            <div style={row}>
              <span>Ticket #{ticket.displayNumber||ticket.ticketNumber}</span>
              <span style={{fontSize:11,color:'#555'}}>TXN {ticket.txnId||'—'}</span>
            </div>
            <div style={row}><span>{dateStr}</span><span>{timeStr}</span></div>
            {ticket.clientName && <div>Client: {ticket.clientName}</div>}
          </div>

          {sep}

          {/* Service line items grouped by tech — store copy adds per-tech tip */}
          {techGroups.map(g=>(
            <div key={g.techId||g.techName} style={{marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>— {g.techName} —</div>
              {g.items.map(it=>{
                const iDiscRaw=ticket.itemDiscounts?.[it.id];
                const isMemberPct = iDiscRaw && iDiscRaw.membership && iDiscRaw.type==='pct' && iDiscRaw.value<100;
                const iDisc=iDiscRaw;
                const base=it.price_cents*(it.qty||1);
                const iDiscAmt=isMemberPct ? Math.round(((ticket.subtotalCents||0) - (ticket.pkgRedeemCents||0)) * iDiscRaw.value / 100) : (iDisc?(iDisc.type==='flat'?Math.min(iDisc.value,base):Math.round(base*iDisc.value/100)):0);
                return(
                <div key={it.id}>
                  <div style={row}>
                    <span style={{flex:1,paddingRight:8}}>{it.name}{it.qty>1?` ×${it.qty}`:''}</span>
                    <span>{fmt(base)}</span>
                  </div>
                  {iDiscAmt>0&&(
                    <div style={{...row,fontSize:10,color:'#888',fontStyle:'italic'}}>
                      <span>  {iDisc.desc||'Discount'}</span>
                      <span>-{fmt(iDiscAmt)}</span>
                    </div>
                  )}
                </div>);
              })}
              {/* Store copy: per-tech tip under their services */}
              {isStore && g.techId && tipByTech[g.techId]!=null && (
                <div style={{...row,fontSize:11,fontStyle:'italic',color:'#555',marginTop:2}}>
                  <span>Tip ({g.techName})</span>
                  <span>{fmt(tipByTech[g.techId])}</span>
                </div>
              )}
            </div>
          ))}

          {/* Retail section */}
          {retailItems.length>0&&(
            <div style={{marginBottom:6}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>— Products —</div>
              {retailItems.map(it=>{
                const iDisc=ticket.itemDiscounts?.[it.id];
                const base=it.price_cents*(it.qty||1);
                const iDiscAmt=iDisc?(iDisc.type==='flat'?Math.min(iDisc.value,base):Math.round(base*iDisc.value/100)):0;
                return(
                <div key={it.id}>
                  <div style={row}>
                    <span style={{flex:1,paddingRight:8}}>{it.name}{it.qty>1?` ×${it.qty}`:''}</span>
                    <span>{fmt(base)}</span>
                  </div>
                  {iDiscAmt>0&&(
                    <div style={{...row,fontSize:10,color:'#888',fontStyle:'italic'}}>
                      <span>  {iDisc.desc||'Discount'}</span>
                      <span>-{fmt(iDiscAmt)}</span>
                    </div>
                  )}
                </div>);
              })}
            </div>
          )}

          {sep}

          {/* Totals */}
          <div style={{marginBottom:2}}>
            <div style={row}><span>Subtotal</span><span>{fmt(ticket.subtotalCents)}</span></div>
            {ticket.discountCents>0 && <div style={row}><span>Discount</span><span>-{fmt(ticket.discountCents)}</span></div>}
            {ticket.pkgRedeemCents>0 && <div style={{...row,color:'#7C3AED'}}><span>Pkg Redeemed</span><span>-{fmt(ticket.pkgRedeemCents)}</span></div>}
            {ticket.depositCents>0 && <div style={row}><span>Deposit applied</span><span>-{fmt(ticket.depositCents)}</span></div>}
            <div style={row}><span>Tax ({s.tax_rate_percentage}%)</span><span>{fmt(ticket.taxCents)}</span></div>
            {s.receipt_show_tip_line && ticket.tipCents>0 && !ticket.tipAutoRemoved && !isStore && (
              <div style={row}><span>Tip</span><span>{fmt(ticket.tipCents)}</span></div>
            )}
            {isStore && ticket.tipCents>0 && !ticket.tipAutoRemoved && (
              <div style={row}><span>Tip (total)</span><span>{fmt(ticket.tipCents)}</span></div>
            )}
            {ticket.tipAutoRemoved && (
              <div style={{fontSize:10,color:'#888',fontStyle:'italic'}}>Tip collected outside system</div>
            )}
            <div style={{borderTop:'1px solid #333',marginTop:4,paddingTop:4}}>
              <div style={{...row,fontWeight:700,fontSize:14}}>
                <span>TOTAL</span><span>{fmt(ticket.totalCents)}</span>
              </div>
            </div>
          </div>

          {/* Payment method(s) — bold like TOTAL */}
          <div style={{marginTop:4,marginBottom:2}}>
            {payLabels.map((label,i)=>(
              <div key={i} style={{...row,fontWeight:700,fontSize:13}}>
                <span>Paid ({label})</span>
                <span>{fmt(ticket.payments[i].amount_cents)}</span>
              </div>
            ))}
          </div>

          {/* Blank tip/signature for credit card with no tip */}
          {showBlankTipSig&&(
            <>
              {sep}
              <div style={{marginTop:4}}>
                <div style={row}><span>Tip:</span><span style={{flex:1,borderBottom:'1px solid #999',marginLeft:12,marginBottom:2}}></span></div>
                <div style={{...row,marginTop:6}}><span>Total:</span><span style={{flex:1,borderBottom:'1px solid #999',marginLeft:12,marginBottom:2}}></span></div>
                <div style={{marginTop:12}}>
                  <div style={{fontSize:11}}>Signature:</div>
                  <div style={{borderBottom:'1px solid #999',height:28,marginTop:4}}></div>
                </div>
              </div>
            </>
          )}

          {sep}

          {/* Footer */}
          {s.receipt_footer_text && (
            <div style={{...center,fontSize:11,whiteSpace:'pre-line',marginBottom:8}}>{s.receipt_footer_text}</div>
          )}

          {/* Created by / Closed by — below footer */}
          <div style={{...center,fontSize:10,color:'#888',marginBottom:8}}>
            {createdByStaff && <div>Created by: {createdByStaff}</div>}
            {closedByStaff && <div>Closed by: {closedByStaff}</div>}
          </div>

          {/* Barcode placeholder + TXN ID */}
          <div style={{...center}}>
            <div style={{width:200,height:48,border:'2px solid #333',borderRadius:2,margin:'0 auto 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{display:'flex',alignItems:'flex-end',gap:1,height:36}}>
                {/* Mock barcode lines */}
                {Array.from({length:40}).map((_,i)=>(
                  <div key={i} style={{width:i%3===0?2:1, height:i%5===0?28:i%3===0?32:36, background:'#333'}}/>
                ))}
              </div>
            </div>
            <div style={{fontSize:10,color:'#888',letterSpacing:'0.05em'}}>{String(ticket.ticketNumber).padStart(8,'0')}</div>
            <div style={{fontSize:9,color:'#aaa',marginTop:2}}>{ticket.txnId||'—'}</div>
          </div>
        </div>

        )}

        {/* Close + Print buttons — softcolor style */}
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose}
            style={{height:40,padding:'0 28px',background:'#3B1C1C',border:'1px solid #7F1D1D',borderRadius:8,color:'#FCA5A5',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',system-ui,sans-serif"}}>
            Close
          </button>
          <button onClick={function(){
            relayPrint('receipt', {
              salonName: SALON_INFO.name || 'Salon',
              salonAddress: SALON_INFO.address,
              salonPhone: SALON_INFO.phone,
              ticketNumber: ticket.ticketNumber,
              displayNumber: ticket.displayNumber || null,
              clientName: ticket.clientName || null,
              techName: ticket.items && ticket.items[0] ? ticket.items[0].tech : null,
              items: (ticket.items || []).map(function(it){ return { name: it.name, price_cents: it.price_cents || 0, tech: it.tech, qty: it.qty || 1 }; }),
              subtotalCents: ticket.subtotalCents || 0,
              discountCents: ticket.discountCents || 0,
              depositCents: ticket.depositCents || 0,
              taxCents: ticket.taxCents || 0,
              tipCents: ticket.tipCents || 0,
              totalCents: ticket.totalCents || 0,
              payments: (ticket.payments || []).map(function(p){ return { method: p.method, amount_cents: p.amount_cents }; }),
            });
          }}
            style={{height:40,padding:'0 28px',background:'#1E3A5F',border:'1px solid #2D5A8E',borderRadius:8,color:'#93C5FD',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',system-ui,sans-serif"}}>
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
}
