/**
 * useBarcodeScanner — Custom hook for barcode scanner input in checkout.
 * Extracted from CheckoutScreen.jsx (Session 63 split).
 *
 * Listens for rapid digit keypresses (scanner fires < 200ms apart).
 * After digits stop, checks: gift card code, badge ID, ticket barcode, product barcode.
 */
import { useEffect, useRef } from 'react';

export default function useBarcodeScanner({
  screen, openTickets, staffList, retailList, giftCards,
  gcLookupRef, effectiveTotalRef, paymentsRef, activeTechIdRef, handleAddItemRef,
  setPinDigits, setPinError, setPinMatch, setActiveTechId, setScreen,
  setItems, setClient, setDepositCents, setPayments, setGcLookup, setGcCodeInput, setGcError,
  onCombineTicket,
}) {
  var scanBuf = useRef('');
  var scanTimer = useRef(null);

  useEffect(function(){
    function handleKey(e){
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if(e.key==='Enter'){ e.preventDefault(); return; }
      // On PIN screen, completely skip — useNumpadKeyboard handles all digit input.
      // Badge scanning on PIN screen is not needed (user types PIN or taps OK).
      if(screen==='pin') return;
      if(e.key>='0'&&e.key<='9'){
        e.preventDefault();
        scanBuf.current+=e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current=setTimeout(function(){
          var code=scanBuf.current;
          scanBuf.current='';
          if(code.length<2) return;

          // Gift card scan — if gc popup is open, treat as card code
          if(gcLookupRef.current==='input'){
            var gcClean=code.replace(/[^0-9]/g,'');
            var gcCard=giftCards.find(function(c){return c.code.replace(/[^0-9]/g,'')===gcClean||c.code===code;});
            if(gcCard&&gcCard.status!=='depleted'&&gcCard.balance_cents>0){
              var rem=effectiveTotalRef.current-paymentsRef.current.reduce(function(s,p){return s+p.amount_cents;},0);
              if(gcCard.balance_cents>=rem){
                gcCard.balance_cents-=rem;
                if(gcCard.balance_cents<=0) gcCard.status='depleted';
                setPayments(function(prev){return prev.concat([{method:'giftcard',amount_cents:rem,gc_id:gcCard.id,gc_code:gcCard.code}]);});
                setGcLookup(null);setGcCodeInput('');
              } else {
                setGcLookup({card:gcCard,balance:gcCard.balance_cents});
              }
            } else {
              setGcError(true);
            }
            return;
          }

          // Try badge match first (any length)
          var badgeMatch=staffList.find(function(s){return s.badge_id===code;});

          if(screen==='main'){
            if(badgeMatch) return;
            var prodMatch=retailList.find(function(r){return r.barcode===code;});
            if(prodMatch&&activeTechIdRef.current){
              handleAddItemRef.current({id:prodMatch.id,type:'retail',name:prodMatch.name,price_cents:prodMatch.price_cents,cat:prodMatch.cat});
              return;
            }
            var tktNum2=parseInt(code,10);
            var tkt2=openTickets.find(function(t){return t.ticketNumber===tktNum2;});
            if(tkt2 && onCombineTicket) onCombineTicket(tkt2.id);
          }
        },200);
      }
    }
    window.addEventListener('keydown',handleKey);
    return function(){window.removeEventListener('keydown',handleKey);clearTimeout(scanTimer.current);};
  },[screen,openTickets]);
}
