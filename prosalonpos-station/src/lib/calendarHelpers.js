/**
 * Pro Salon POS — Calendar Helper Utilities
 * Shared constants, formatters, layout calculations for CalendarDayView
 * Color tokens: use useTheme() hook — NOT this file.
 */

export function getContrastText(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const [rs,gs,bs]=[r,g,b].map(c=>{const s=c/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
  return(0.2126*rs+0.7152*gs+0.0722*bs)>0.179?'#1A1A1A':'#FFFFFF';
}

export function getWaitColor(min){return min<10?'#059669':min<20?'#D97706':'#DC2626';}

export const today = new Date();
export const Y = today.getFullYear(), M = today.getMonth(), D = today.getDate();

export function timeToMinutes(d){return d.getHours()*60+d.getMinutes();}
export function minutesToTime(min){return new Date(Y,M,D,Math.floor(min/60),min%60);}
export function formatHour(h){return`${h>12?h-12:h===0?12:h}:00 ${h>=12?'PM':'AM'}`;}
export function formatMinLabel(m){return`${m}`;}
export function formatTimeShort(h,m){return`${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')}`;}
export function formatTimeFull(d){const h=d.getHours(),m=d.getMinutes();return`${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
export function getInitials(n){return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
export function snapTo15(min){return Math.round(min/15)*15;}
export const t=(h,m=0)=>new Date(Y,M,D,h,m);

// Find contiguous same-client same-tech service line group containing targetId
export function getGroup(targetId,lines){
  const s=[...lines].sort((a,b)=>a.staff_id.localeCompare(b.staff_id)||a.starts_at-b.starts_at);
  const u=new Set();
  for(const sl of s){if(u.has(sl.id))continue;const g=[sl];u.add(sl.id);let end=sl.starts_at.getTime()+sl.dur*60000;
    for(const o of s){if(u.has(o.id)||o.client!==sl.client||o.staff_id!==sl.staff_id)continue;
      if(o.starts_at.getTime()===end){g.push(o);u.add(o.id);end=o.starts_at.getTime()+o.dur*60000;}}
    if(g.some(x=>x.id===targetId))return g;}
  return[lines.find(x=>x.id===targetId)].filter(Boolean);
}

// Overlap layout: splits overlapping blocks side-by-side within a column
export function calcOverlapLayout(blocks){
  if(!blocks.length)return new Map();
  const sorted=[...blocks].sort((a,b)=>a.startMin-b.startMin||a.endMin-b.endMin);
  const layout=new Map();
  const cols=[];
  sorted.forEach(b=>{
    let placed=false;
    for(let c=0;c<cols.length;c++){
      if(cols[c]<=b.startMin){cols[c]=b.endMin;layout.set(b.id,{col:c});placed=true;break;}
    }
    if(!placed){layout.set(b.id,{col:cols.length});cols.push(b.endMin);}
  });
  // Find connected overlap clusters for correct totalCols
  const adj=new Map();sorted.forEach(b=>adj.set(b.id,[]));
  for(let i=0;i<sorted.length;i++){
    for(let j=i+1;j<sorted.length;j++){
      if(sorted[j].startMin>=sorted[i].endMin)break;
      adj.get(sorted[i].id).push(sorted[j].id);
      adj.get(sorted[j].id).push(sorted[i].id);
    }
  }
  const visited=new Set();
  sorted.forEach(b=>{
    if(visited.has(b.id))return;
    const cluster=[];const q=[b.id];
    while(q.length){const id=q.pop();if(visited.has(id))continue;visited.add(id);cluster.push(id);
      (adj.get(id)||[]).forEach(n=>{if(!visited.has(n))q.push(n);});}
    const maxCol=Math.max(...cluster.map(id=>layout.get(id).col))+1;
    cluster.forEach(id=>{layout.get(id).totalCols=maxCol;});
  });
  return layout;
}

export const AVATAR_COLORS=['#1E3A5F','#064E3B','#7C2D12','#4C1D95','#831843'];

export const ROW_H=28;
export const TIME_COL_W=64;
export const LEFT_PANEL_W=260;
export const COL_MAX_W=180;
export const COL_MIN_W=90;
