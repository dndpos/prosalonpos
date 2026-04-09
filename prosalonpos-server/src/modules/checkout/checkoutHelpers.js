import { fmt, fp } from '../../lib/formatUtils';
/** Pro Salon POS — Checkout Helper Functions (extracted Session 21) */
export { fmt, fp };  // re-export from formatUtils for backward compatibility

export function numpadDisplay(raw, mode){
  if(mode==='cash_register'){
    if(!raw) return '0.00';
    const n = parseInt(raw,10);
    return (n/100).toFixed(2);
  }
  return raw || '0.00';
}
export function numpadTap(d, prev, mode){
  if(d==='⌫') return prev.slice(0,-1);
  if(mode==='cash_register'){
    if(d==='.'||d==='00') return prev+'00';
    if(!/\d/.test(d)) return prev;
    return prev+d;
  }
  if(d==='.'&&prev.includes('.')) return prev;
  return prev+d;
}
export function numpadToCents(raw, mode){
  if(mode==='cash_register'){
    const n=parseInt(raw,10);
    return isNaN(n)?0:n;
  }
  return Math.round(parseFloat(raw)*100)||0;
}
export function numpadToFloat(raw, mode){
  if(mode==='cash_register'){
    const n=parseInt(raw,10);
    return isNaN(n)?0:n/100;
  }
  return parseFloat(raw)||0;
}
export function numpadKeys(mode){
  return mode==='cash_register'
    ? ['7','8','9','4','5','6','1','2','3','00','0','⌫']
    : ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
}
export function roundToNickel(cents){
  return Math.round(cents/5)*5;
}
export function cashQuickAmounts(dueCents){
  var due = dueCents/100;
  if(due <= 0) return [];
  if(due < 5)   return [500,1000,2000,5000,10000];
  if(due < 10)  return [1000,1500,2000,5000,10000];
  if(due < 15)  return [1500,2000,5000,10000];
  if(due < 20)  return [2000,5000,10000];
  if(due < 25)  return [2500,3000,4000,5000,10000];
  if(due < 30)  return [3000,4000,5000,10000];
  if(due < 40)  return [4000,5000,6000,10000];
  if(due < 50)  return [5000,6000,10000];
  if(due < 60)  return [6000,7000,10000];
  if(due < 70)  return [7000,8000,10000];
  if(due < 75)  return [7500,8000,10000];
  if(due < 80)  return [8000,10000];
  if(due < 100) return [10000];
  if(due < 110) return [11000,12000,15000,20000];
  if(due < 120) return [12000,15000,20000];
  if(due < 140) return [14000,15000,20000];
  if(due < 150) return [15000,16000,20000];
  if(due < 160) return [16000,17000,20000];
  if(due < 170) return [17000,18000,20000];
  if(due < 180) return [18000,20000];
  if(due < 200) return [20000];
  return [];
}
