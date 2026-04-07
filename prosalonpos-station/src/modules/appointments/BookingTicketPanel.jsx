/** BookingTicketPanel — Left ticket panel for BookingFlow (Session 73 extract) */
/** Includes drag-and-drop to move services between techs */
import { useState, useRef, useCallback } from 'react';
import { fmt, fp } from '../../lib/formatUtils';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';

function Av({name,size=32,i=0,photo=null}){
  if(photo)return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[i%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size<34?11:13,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

var TICKET_W = 260;
var TAX_RATE = 7.5;

export default function BookingTicketPanel({
  C, staff, bookingClients, setBookingClients, activeTechKey, activeClientIdx,
  setActivePointer, removeService, toggleRequested, clientLabel, salonSettings,
  autoRequestMode, initialHour, initialMin, totalDur, subtotal, taxAmount, total,
  svcCount, handleCancel, handleSave, setNoteDraft, setShowNotePopup, F,
  checkInMode
}){
  // ═══════════════════════════════════════
  // ── DRAG STATE ──
  // ═══════════════════════════════════════
  var [dragItem, setDragItem] = useState(null);      // {cIdx, tIdx, svcIdx, svc}
  var [dropTargetState, setDropTargetState] = useState(null);   // for render only
  var [ghostPos, setGhostPos] = useState({x:0,y:0});
  var holdTimer = useRef(null);
  var isDragging = useRef(false);
  var dragItemRef = useRef(null);    // mirror of dragItem for use in endDrag
  var dropTargetRef = useRef(null);  // mirror of dropTargetState — always current
  var scrollRef = useRef(null);
  var touchStart = useRef({x:0,y:0});

  // ── Start drag (after hold on touch, immediately on mouse) ──
  function beginDrag(cIdx, tIdx, svcIdx, svc, x, y){
    isDragging.current = true;
    var item = {cIdx:cIdx, tIdx:tIdx, svcIdx:svcIdx, svc:svc};
    dragItemRef.current = item;
    setDragItem(item);
    setGhostPos({x:x, y:y});
  }

  // ── Move ghost + hit-test drop zones ──
  function moveGhost(x, y){
    if(!isDragging.current) return;
    setGhostPos({x:x, y:y});
    var els = document.querySelectorAll('[data-drop-zone]');
    var found = null;
    for(var i=0; i<els.length; i++){
      var r = els[i].getBoundingClientRect();
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        var parts = els[i].getAttribute('data-drop-zone').split('-');
        found = {cIdx: parseInt(parts[0]), tIdx: parseInt(parts[1])};
        break;
      }
    }
    dropTargetRef.current = found;
    setDropTargetState(found);
  }

  // ── End drag — uses refs (always current) ──
  function endDrag(){
    if(holdTimer.current){ clearTimeout(holdTimer.current); holdTimer.current = null; }
    if(!isDragging.current){ return; }
    isDragging.current = false;
    var src = dragItemRef.current;
    var dst = dropTargetRef.current;
    if(src && dst){
      var sameTech = src.cIdx === dst.cIdx && src.tIdx === dst.tIdx;
      if(!sameTech){
        moveServiceToTech(src.cIdx, src.tIdx, src.svc, dst.cIdx, dst.tIdx);
      }
    }
    dragItemRef.current = null;
    dropTargetRef.current = null;
    setDragItem(null);
    setDropTargetState(null);
  }

  // ── Move service between techs ──
  function moveServiceToTech(fromCIdx, fromTIdx, svc, toCIdx, toTIdx){
    setBookingClients(function(prev){
      var next = prev.map(function(bc, ci){
        var newTechs = bc.techs.map(function(te, ti){
          // Remove from source
          if(ci === fromCIdx && ti === fromTIdx){
            return Object.assign({}, te, {services: te.services.filter(function(s){ return s.id !== svc.id; })});
          }
          // Add to destination
          if(ci === toCIdx && ti === toTIdx){
            // Don't add duplicate
            var already = te.services.some(function(s){ return s.id === svc.id; });
            if(already) return te;
            return Object.assign({}, te, {services: te.services.concat([svc])});
          }
          return te;
        });
        return Object.assign({}, bc, {techs: newTechs});
      });
      return next;
    });
  }

  // ── Touch handlers — hold to drag (prevents scroll conflict) ──
  function onSvcTouchStart(e, cIdx, tIdx, svcIdx, svc){
    var touch = e.touches[0];
    touchStart.current = {x: touch.clientX, y: touch.clientY};
    holdTimer.current = setTimeout(function(){
      beginDrag(cIdx, tIdx, svcIdx, svc, touch.clientX, touch.clientY);
    }, 350);
  }
  function onSvcTouchMove(e){
    if(holdTimer.current){
      var touch = e.touches[0];
      var dx = Math.abs(touch.clientX - touchStart.current.x);
      var dy = Math.abs(touch.clientY - touchStart.current.y);
      if(dx > 10 || dy > 10){
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
        return;
      }
    }
    if(isDragging.current){
      e.preventDefault();
      var t = e.touches[0];
      moveGhost(t.clientX, t.clientY);
    }
  }
  function onSvcTouchEnd(){
    endDrag();
  }

  // ── Mouse handlers — instant drag (click and move, like calendar grid) ──
  function onSvcMouseDown(e, cIdx, tIdx, svcIdx, svc){
    if(e.button !== 0) return;
    e.preventDefault();
    touchStart.current = {x: e.clientX, y: e.clientY, cIdx:cIdx, tIdx:tIdx, svcIdx:svcIdx, svc:svc, started:false};
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
  }
  function onGlobalMouseMove(e){
    if(!touchStart.current.started){
      // Start drag after 5px movement threshold (avoids accidental drag on click)
      var dx = Math.abs(e.clientX - touchStart.current.x);
      var dy = Math.abs(e.clientY - touchStart.current.y);
      if(dx < 5 && dy < 5) return;
      touchStart.current.started = true;
      beginDrag(touchStart.current.cIdx, touchStart.current.tIdx, touchStart.current.svcIdx, touchStart.current.svc, e.clientX, e.clientY);
    }
    moveGhost(e.clientX, e.clientY);
  }
  function onGlobalMouseUp(){
    window.removeEventListener('mousemove', onGlobalMouseMove);
    window.removeEventListener('mouseup', onGlobalMouseUp);
    if(isDragging.current){
      endDrag();
    }
    touchStart.current = {x:0,y:0};
  }

  // Helper
  function ft(h,m){return (h>12?h-12:h===0?12:h)+':'+String(m).padStart(2,'0')+' '+(h>=12?'PM':'AM');}

  // ═══════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════
  var isMultiClient = bookingClients.length > 1;

  return(
    <div style={{width:TICKET_W,minWidth:TICKET_W,background:C.chromeDark,borderRight:'1px solid '+C.borderLight,display:'flex',flexDirection:'column',flexShrink:0,position:'relative',userSelect:dragItem?'none':'auto'}}>
      {/* Booking header + time */}
      <div style={{padding:'10px 12px',borderBottom:'1px solid '+C.borderLight,flexShrink:0}}>
        <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5}}>{checkInMode?'Check In':'Booking'}</div>
        {!checkInMode&&<div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{ft(initialHour,initialMin)}</span>
          {totalDur>0&&<>
            <span style={{color:C.textMuted,fontSize:11}}>→</span>
            <span style={{color:C.textPrimary,fontSize:12}}>{ft(Math.floor((initialHour*60+initialMin+totalDur)/60),(initialHour*60+initialMin+totalDur)%60)}</span>
            <span style={{color:C.textMuted,fontSize:11}}>·</span>
            <span style={{color:C.textPrimary,fontSize:11}}>{totalDur} min</span>
          </>}
        </div>}
      </div>
      {/* Client → Tech → Services tree */}
      <div ref={scrollRef} style={{flex:1,overflow:'auto',padding:'6px 8px'}}
        onTouchMove={onSvcTouchMove} onTouchEnd={onSvcTouchEnd}>
        {bookingClients.map(function(bc, cIdx){
          return(
            <div key={cIdx} style={{marginBottom:isMultiClient?12:0}}>
              {/* Client header (only show if multi-client) */}
              {isMultiClient&&(
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 6px',marginBottom:4,borderRadius:5,background:C.blueTint,borderBottom:'1px solid '+C.borderLight}}>
                  <Av name={clientLabel(bc,cIdx)} size={22} i={cIdx}/>
                  <span style={{color:C.textPrimary,fontSize:12,fontWeight:600}}>{clientLabel(bc,cIdx)}</span>
                  {bc.client&&bc.client.phone&&<span style={{color:C.textMuted,fontSize:10,marginLeft:'auto'}}>{fp(bc.client.phone)}</span>}
                </div>
              )}
              {/* Single client — show client info */}
              {!isMultiClient&&(
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 6px',marginBottom:6}}>
                  <Av name={clientLabel(bc,cIdx)} size={24} i={0}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>{clientLabel(bc,cIdx)}</div>
                    {bc.client&&bc.client.phone&&<div style={{color:C.textMuted,fontSize:10}}>{fp(bc.client.phone)}</div>}
                  </div>
                </div>
              )}
              {/* Techs for this client */}
              {bc.techs.map(function(te, tIdx){
                var isActive = activeTechKey === cIdx+'-'+tIdx;
                var techObj = staff.find(function(s){ return s.id === te.techId; });
                var firstTechName = bc.techs[0]?.techName;
                var isDropHere = dropTargetState && dropTargetState.cIdx === cIdx && dropTargetState.tIdx === tIdx;
                var isDragSource = dragItem && dragItem.cIdx === cIdx && dragItem.tIdx === tIdx;
                return(
                  <div key={tIdx} data-drop-zone={cIdx+'-'+tIdx} style={{marginBottom:6,marginLeft:isMultiClient?8:0,
                    borderRadius:6,border:isDropHere?'2px solid rgba(34,197,94,0.6)':'2px solid transparent',
                    background:isDropHere?'rgba(34,197,94,0.08)':'transparent',transition:'all 120ms',padding:isDropHere?2:2}}>
                    {/* Tech header */}
                    <div onClick={function(){setActivePointer(cIdx,tIdx);}}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',marginBottom:3,borderRadius:5,cursor:'pointer',
                        background:isDropHere?'rgba(34,197,94,0.15)':isActive?C.blueTint:'transparent',
                        border:isActive&&!isDropHere?'1px solid '+C.blue:'1px solid '+C.borderMedium,
                        transition:'all 120ms'}}>
                      <Av name={te.techName||'?'} size={22} i={staff.indexOf(techObj)} photo={techObj?.photo_url}/>
                      <span style={{color:isDropHere?'#22C55E':isActive?C.blueLight:C.textPrimary,fontSize:12,fontWeight:600}}>{te.techName}</span>
                      {isDropHere&&<span style={{color:'#22C55E',fontSize:9,marginLeft:'auto'}}>drop here</span>}
                      {!isDropHere&&isActive&&<span style={{color:C.blueLight,fontSize:9,marginLeft:'auto'}}>active</span>}
                    </div>
                    {/* Timing label for 2nd tech */}
                    {tIdx>0&&(
                      <div style={{padding:'2px 6px',marginBottom:3}}>
                        <span style={{color:te.timing==='parallel'?C.blueLight:C.warning,fontSize:10,fontWeight:500}}>
                          {te.timing==='parallel'?'⏱ Same time as '+firstTechName:'⏱ After '+firstTechName}
                        </span>
                      </div>
                    )}
                    {/* Requested toggle — hidden in auto-request mode */}
                    {!autoRequestMode && (
                    <div onClick={function(){toggleRequested(cIdx,tIdx);}}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'5px 6px',marginBottom:4,cursor:'pointer',userSelect:'none'}}>
                      <div style={{width:22,height:22,borderRadius:4,border:'2px solid '+(te.requested?C.blue:C.borderMedium),background:te.requested?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {te.requested&&<span style={{color:'#fff',fontSize:14,lineHeight:1}}>✓</span>}
                      </div>
                      <span style={{color:te.requested?C.blueLight:C.textMuted,fontSize:12}}>Requested</span>
                    </div>
                    )}
                    {/* Services — draggable */}
                    {te.services.map(function(svc, svcIdx){
                      var beingDragged = dragItem && dragItem.cIdx===cIdx && dragItem.tIdx===tIdx && dragItem.svc.id===svc.id;
                      return(
                        <div key={svc.id}
                          onTouchStart={function(e){onSvcTouchStart(e,cIdx,tIdx,svcIdx,svc);}}
                          onMouseDown={function(e){onSvcMouseDown(e,cIdx,tIdx,svcIdx,svc);}}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'5px 6px',marginBottom:2,borderRadius:4,background:C.grid,
                            opacity:beingDragged?0.35:1,transition:'opacity 120ms',cursor:'grab',touchAction:'auto'}}>
                          {svc.color&&<div style={{width:4,height:22,borderRadius:2,background:svc.color,flexShrink:0}}/>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{color:C.textPrimary,fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{svc.name}</div>
                            {(!salonSettings || salonSettings.show_service_time !== false) && <div style={{color:C.textMuted,fontSize:10}}>{svc.dur} min</div>}
                          </div>
                          <span style={{color:C.textPrimary,fontSize:12,fontWeight:500,flexShrink:0}}>{fmt(svc.price||0)}</span>
                          <div onClick={function(e){e.stopPropagation();removeService(cIdx,tIdx,svc.id);}} style={{color:C.danger,background:'none',border:'none',fontSize:20,fontWeight:700,cursor:'pointer',padding:'0 4px',lineHeight:1,minWidth:24,minHeight:24,display:'flex',alignItems:'center',justifyContent:'center'}}>×</div>
                        </div>
                      );
                    })}
                    {/* Empty hint for active tech with no services */}
                    {te.services.length===0&&isActive&&(
                      <div style={{padding:'12px 8px',textAlign:'center'}}>
                        <div style={{color:C.textMuted,fontSize:11,lineHeight:1.5}}>Tap services from the right panel</div>
                      </div>
                    )}
                    {/* Extra time for this tech */}
                    {(te.extraTime||0)>0&&(
                      <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 6px',marginBottom:2,borderRadius:4,background:'rgba(217,119,6,0.1)'}}>
                        <span style={{color:C.warning,fontSize:12,fontWeight:500,flex:1}}>Extra time</span>
                        <span style={{color:C.warning,fontSize:12,fontWeight:500}}>+{te.extraTime} min</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Per-client note */}
              {bc.note&&(
                <div onClick={function(){setNoteDraft(bc.note);setShowNotePopup(cIdx);}}
                  style={{margin:'4px 0 0',padding:'5px 6px',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'flex-start',gap:5,background:C.blueTint}}
                  onMouseEnter={function(e){e.currentTarget.style.background=C.accentBg;}}
                  onMouseLeave={function(e){e.currentTarget.style.background=C.blueTint;}}>
                  <span style={{fontSize:11,flexShrink:0,marginTop:1}}>📝</span>
                  <span style={{color:C.textPrimary,fontSize:11,lineHeight:1.4,wordBreak:'break-word',flex:1}}>{bc.note}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Totals */}
      <div style={{borderTop:'1px solid '+C.borderLight,flexShrink:0,padding:'8px 10px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
          <span style={{color:C.textMuted,fontSize:11}}>Subtotal</span>
          <span style={{color:C.textPrimary,fontSize:11}}>{fmt(subtotal)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
          <span style={{color:C.textMuted,fontSize:11}}>Tax ({TAX_RATE}%)</span>
          <span style={{color:C.textPrimary,fontSize:11}}>{fmt(taxAmount)}</span>
        </div>
        <div style={{height:1,background:C.borderMedium,margin:'3px 0'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span style={{color:C.textPrimary,fontSize:14,fontWeight:600}}>Total</span>
          <span style={{color:C.textPrimary,fontSize:18,fontWeight:700}}>{fmt(total)}</span>
        </div>
      </div>
      {/* Cancel + Save */}
      <div style={{padding:'10px 10px',borderTop:'1px solid '+C.borderLight,flexShrink:0,display:'flex',gap:6}}>
        <button onClick={handleCancel} style={{flex:1,height:44,background:'transparent',border:'1px solid '+C.danger,borderRadius:6,color:C.danger,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,boxSizing:'border-box'}}>{checkInMode?'Cancel':'Cancel Booking'}</button>
        <button onClick={handleSave} disabled={svcCount===0}
          style={{flex:1,height:44,background:svcCount===0?C.gridHover:C.success,color:'#fff',border:'1px solid '+(svcCount===0?C.gridHover:C.success),borderRadius:6,fontSize:13,fontWeight:600,cursor:svcCount===0?'not-allowed':'pointer',fontFamily:F,opacity:svcCount===0?0.5:1,boxSizing:'border-box'}}>
          {checkInMode?'Check In':'Save Appointment'}
        </button>
      </div>
      {/* ═══ DRAG GHOST ═══ */}
      {dragItem&&(
        <div style={{position:'fixed',left:ghostPos.x-100,top:ghostPos.y-20,width:200,pointerEvents:'none',zIndex:9999,
          background:C.grid,border:'2px solid '+C.blue,borderRadius:6,padding:'6px 10px',
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',opacity:0.92}}>
          {dragItem.svc.color&&<div style={{width:4,height:16,borderRadius:2,background:dragItem.svc.color,position:'absolute',left:4,top:8}}/>}
          <div style={{color:C.textPrimary,fontSize:12,fontWeight:600,marginLeft:8}}>{dragItem.svc.name}</div>
          <div style={{color:C.textMuted,fontSize:10,marginLeft:8}}>{fmt(dragItem.svc.price||0)}</div>
        </div>
      )}
    </div>
  );
}
