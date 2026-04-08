import { memo } from 'react';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Appointment Block Renderer
 * Renders colored service line blocks on the calendar grid.
 * Handles grouping, overlap layout, multi-service gradients, drag state.
 */
import { getContrastText, timeToMinutes, formatTimeShort, calcOverlapLayout } from '../../lib/calendarHelpers';

/**
 * Renders all appointment blocks for the visible staff columns.
 * @param {Object} props
 * @param {Array} props.serviceLines - all service line records
 * @param {Array} props.visibleStaff - staff objects shown as columns
 * @param {number} props.colW - column width in px
 * @param {number} props.gridStartMin - grid start in minutes from midnight
 * @param {number} props.ROW_H - row height in px
 * @param {function} props.colLeftPx - function(colIndex) → left px
 * @param {Object|null} props.dragging - current drag state
 * @param {function} props.onBlockStart - (cx, cy, sl) handler
 */
export default memo(function AppointmentBlocks({serviceLines, blockedTimes, visibleStaff, colW, gridStartMin, ROW_H, colLeftPx, dragging, onBlockStart, onBlockClick, autoRequestMode}){
  var C = useTheme();
  if(colW<=0) return null;

  // Group adjacent service lines: same client, same staff, contiguous times
  const grouped=[];
  const used=new Set();
  const sorted=[...serviceLines].sort((a,b)=>a.staff_id.localeCompare(b.staff_id)||a.starts_at-b.starts_at);
  sorted.forEach(sl=>{
    if(used.has(sl.id))return;
    const group=[sl];
    used.add(sl.id);
    let lastEnd=sl.starts_at.getTime()+sl.dur*60000;
    sorted.forEach(other=>{
      if(used.has(other.id)||other.client!==sl.client||other.staff_id!==sl.staff_id)return;
      if(other.starts_at.getTime()===lastEnd){
        group.push(other);
        used.add(other.id);
        lastEnd=other.starts_at.getTime()+other.dur*60000;
      }
    });
    grouped.push(group);
  });

  // Build overlap layout per staff column
  const byStaff={};
  grouped.forEach(group=>{
    const first=group[0];
    const staffIdx=visibleStaff.findIndex(s=>s.id===first.staff_id);
    if(staffIdx===-1)return;
    if(!byStaff[staffIdx])byStaff[staffIdx]=[];
    const totalDur=group.reduce((sum,s)=>sum+s.dur,0);
    const startMin=timeToMinutes(first.starts_at);
    byStaff[staffIdx].push({id:first.id,startMin,endMin:startMin+totalDur});
  });
  const overlapMap={};
  Object.entries(byStaff).forEach(([si,blocks])=>{
    const layout=calcOverlapLayout(blocks);
    layout.forEach((v,id)=>{overlapMap[id]=v;});
  });

  // ── Render blocked time entries (separate from appointments) ──
  var blockedEls=(blockedTimes||[]).map(function(b){
    var staffIdx=visibleStaff.findIndex(function(s){return s.id===b.staff_id;});
    if(staffIdx===-1)return null;
    var topPx=((b.startMin-gridStartMin)/15)*ROW_H;
    var heightPx=Math.max(44,(b.dur/15)*ROW_H);
    var endDate=new Date(b.starts_at.getTime()+b.dur*60000);
    var timeStr=formatTimeShort(b.starts_at.getHours(),b.starts_at.getMinutes())+'–'+formatTimeShort(endDate.getHours(),endDate.getMinutes());
    var showTime=heightPx>54;
    return(<div key={b.id} data-block="1" onClick={function(e){e.stopPropagation();if(onBlockClick)onBlockClick(b);}} style={{position:'absolute',top:topPx+1,left:colLeftPx(staffIdx)+3,width:colW-6,height:heightPx-2,background:'repeating-linear-gradient(45deg, #991B1B 0px, #991B1B 6px, #7F1D1D 6px, #7F1D1D 12px)',borderRadius:6,border:'2px solid #FCA5A5',cursor:'pointer',touchAction:'none',zIndex:4,boxSizing:'border-box',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
      <div style={{color:'#FFF',fontSize:12,fontWeight:700,letterSpacing:'0.05em',textShadow:'0 1px 3px rgba(0,0,0,0.5)',textAlign:'center'}}>BLOCKED</div>
      {showTime&&<div style={{color:'#FCA5A5',fontSize:10,fontWeight:600,textShadow:'0 1px 2px rgba(0,0,0,0.5)',textAlign:'center',marginTop:2}}>{timeStr}</div>}
    </div>);
  });

  var apptEls=grouped.map(group=>{
    const first=group[0];
    const staffIdx=visibleStaff.findIndex(s=>s.id===first.staff_id);
    if(staffIdx===-1)return null;
    const totalDur=group.reduce((sum,s)=>sum+s.dur,0);
    const startMin=timeToMinutes(first.starts_at);
    const topPx=((startMin-gridStartMin)/15)*ROW_H;
    const heightPx=Math.max(44,(totalDur/15)*ROW_H);
    const lastSl=group[group.length-1];
    const endDate=new Date(lastSl.starts_at.getTime()+lastSl.dur*60000);
    const timeStr=`${formatTimeShort(first.starts_at.getHours(),first.starts_at.getMinutes())}–${formatTimeShort(endDate.getHours(),endDate.getMinutes())}`;
    const ol=overlapMap[first.id]||{col:0,totalCols:1};
    const pad=3;
    const gap=1;
    const availW=colW-pad*2;
    const slotW=(availW-(ol.totalCols-1)*gap)/ol.totalCols;
    const blockLeft=colLeftPx(staffIdx)+pad+ol.col*(slotW+gap);
    const blockWidth=slotW;
    const innerH=heightPx-8;
    const isMulti=group.length>1;
    const isDragging=dragging&&group.some(s=>s.id===dragging.slId);
    const isFaded=first.status==='completed'||first.status==='checked_out'||first.status==='cancelled'||first.status==='no_show';

    // For multi-service: build gradient from service colors proportionally
    let bgStyle;
    const isReserved = first.client === 'Reserved' && first.service === 'Reserved';
    if(isReserved){
      // Diagonal hazard stripes — unmistakable blocked slot
      bgStyle='repeating-linear-gradient(135deg, #D97706 0px, #D97706 8px, #92400E 8px, #92400E 16px)';
    } else if(isMulti){
      const stops=[];
      let pct=0;
      group.forEach((s)=>{
        const share=(s.dur/totalDur)*100;
        stops.push(`${s.color} ${pct}%`);
        pct+=share;
        stops.push(`${s.color} ${pct}%`);
      });
      bgStyle=`linear-gradient(180deg, ${stops.join(', ')})`;
    } else {
      bgStyle=first.color;
    }

    // Text color: always white for readability on colored backgrounds
    const textColor='#FFFFFF';
    // How many service lines we can show based on height
    const lineH=14;
    const headerH=16;
    const availH=innerH-headerH-2;
    const maxServiceLines=Math.max(0,Math.floor(availH/lineH));
    const showTime=availH>=(group.length*lineH)+lineH;

    return(
      <div key={first.id} data-block="1" data-sl-id={first.id}
        onMouseDown={(e)=>{e.preventDefault();onBlockStart(e.clientX,e.clientY,first);}}
        onTouchStart={(e)=>{e.preventDefault();const t=e.touches[0];if(t)onBlockStart(t.clientX,t.clientY,first);}}
        style={{
          position:'absolute',
          top:topPx+1,
          left:blockLeft,
          width:blockWidth,
          height:heightPx-2,
          background:bgStyle,
          borderRadius:6,
          padding:'4px 8px',
          overflow:'hidden',
          cursor:isDragging?'grabbing':'pointer',
          touchAction:'none',
          zIndex:isDragging?20:2,
          boxSizing:'border-box',
          display:'flex',
          flexDirection:'column',
          justifyContent:isReserved?'center':'flex-start',
          opacity:isDragging?0.5:1,
          filter:isFaded?'saturate(0.5) brightness(0.75)':'none',
          transition:isDragging?'none':'opacity 0.15s',
          border:isReserved?'2px dashed #FDE68A':'none',
        }}>
        {/* Calculate badge presence for padding */}
        {(function(){
          var PAYMENT_ICONS={cash:'💵',credit:'💳',giftcard:'🎁',zelle:'⚡'};
          var statusBadge=null;
          var confirmBadge=false;
          if(first.payment_method&&PAYMENT_ICONS[first.payment_method]){
            statusBadge=PAYMENT_ICONS[first.payment_method];
          } else if(first.status==='checked_in'){
            statusBadge='🙋';
          } else if(first.status==='in_progress'){
            statusBadge='🔄';
          } else if(first.status==='confirmed'){
            confirmBadge=true;
          }
          var lockBadge=(!autoRequestMode && first.requested)?'🔒':null;
          var onlineBadge=first.source==='online';
          var vipBadge=!!first.is_vip;
          var hasBadge=!!(statusBadge||confirmBadge||lockBadge||onlineBadge||vipBadge);
          var pr=hasBadge?32:0;
          return(<>
            {isReserved ? (<>
              <div style={{color:'#FFF',fontSize:12,fontWeight:700,letterSpacing:'0.05em',textShadow:'0 1px 3px rgba(0,0,0,0.5)',textAlign:'center'}}>RESERVED</div>
              {showTime&&<div style={{color:'#FDE68A',fontSize:10,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:lineH+'px',marginTop:2,textShadow:'0 1px 2px rgba(0,0,0,0.5)',textAlign:'center'}}>{timeStr}</div>}
            </>) : (<>
            {/* Client name row */}
            <div style={{color:textColor,fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:'16px',textShadow:'0 1px 2px rgba(0,0,0,0.4)',paddingRight:pr}}>
              {vipBadge&&<span style={{fontSize:9,marginRight:3,verticalAlign:'middle'}}>👑</span>}
              {first.client}
              {isMulti&&<span style={{marginLeft:4,opacity:0.7,fontSize:10}}>({group.length})</span>}
            </div>
            {/* Badges — top right, stacked */}
            {hasBadge&&<div style={{position:'absolute',top:4,right:4,display:'flex',flexDirection:'column',alignItems:'center',gap:2,zIndex:5,filter:isFaded?'saturate(3.3) brightness(1.43)':'none'}}>
              {vipBadge&&<div style={{lineHeight:1,background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'2px 5px',fontSize:8,fontWeight:700,color:'#F59E0B',letterSpacing:0.5,fontFamily:"'Inter',system-ui,sans-serif"}}>VIP</div>}
              {statusBadge&&<div style={{fontSize:12,lineHeight:1,background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'2px 5px'}}>{statusBadge}</div>}
              {confirmBadge&&<div style={{fontSize:13,lineHeight:1,background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'2px 5px',color:'#FF3B3B',fontWeight:900}}>✓</div>}
              {lockBadge&&<div style={{fontSize:11,lineHeight:1,background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'2px 5px'}}>{lockBadge}</div>}
              {onlineBadge&&<div style={{lineHeight:1,background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'3px 5px',fontSize:8,fontWeight:700,color:'#38BDF8',letterSpacing:0.5,fontFamily:"'Inter',system-ui,sans-serif"}}>OLB</div>}
            </div>}
            {/* Service names */}
            {group.slice(0,maxServiceLines).map(function(s,i){return(
              <div key={s.id} style={{color:textColor,fontSize:11,opacity:0.9,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:lineH+'px',marginTop:i===0?1:0,textShadow:'0 1px 2px rgba(0,0,0,0.4)',paddingRight:pr}}>
                {s.service}
              </div>
            );})}
            {group.length>maxServiceLines&&maxServiceLines>0&&(
              <div style={{color:textColor,fontSize:10,opacity:0.6,lineHeight:lineH+'px',textShadow:'0 1px 2px rgba(0,0,0,0.3)',paddingRight:pr}}>+{group.length-maxServiceLines} more</div>
            )}
            {showTime&&<div style={{color:textColor,fontSize:10,opacity:0.7,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:lineH+'px',marginTop:1,textShadow:'0 1px 2px rgba(0,0,0,0.3)',paddingRight:pr}}>{timeStr}</div>}
            </>)}
          </>);
        })()}
      </div>
    );
  });
  return(<>{blockedEls}{apptEls}</>);
});
