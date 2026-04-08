import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Tech Turn List Panel
 * Drag-to-reorder with confirmation. Break toggle with confirmation.
 * Per Session 3 Decisions #71-92
 */
import { useState, useRef, useEffect } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import AreaTag from '../../components/ui/AreaTag';

function Av({name,size=32,index=0,photo=null}){
  var C = useTheme();
  if(photo)return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<36?11:14,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export default function TechTurnList({techTurn, onReorder, onBreak, onEndBreak}){
  var C = useTheme();
  const available=techTurn.filter(t=>t.status==='available').sort((a,b)=>(a.position||99)-(b.position||99));
  const busy=techTurn.filter(t=>t.status==='busy');
  const onBreakList=techTurn.filter(t=>t.status==='break');

  const[dragIdx,setDragIdx]=useState(null);
  const[overIdx,setOverIdx]=useState(null);
  const[pendingReorder,setPendingReorder]=useState(null);
  const[confirmBreak,setConfirmBreak]=useState(null);
  const[confirmEndBreak,setConfirmEndBreak]=useState(null);
  const dragRef=useRef(null);
  const rowRefs=useRef([]);

  function startDrag(i,cy){dragRef.current={i,startY:cy,moved:false};setDragIdx(i);}
  function onMove(cy){
    if(!dragRef.current||dragIdx===null)return;
    if(!dragRef.current.moved){if(Math.abs(cy-dragRef.current.startY)<5)return;dragRef.current.moved=true;}
    for(let r=0;r<rowRefs.current.length;r++){
      const el=rowRefs.current[r];if(!el)continue;
      const rect=el.getBoundingClientRect();
      if(cy>=rect.top&&cy<=rect.bottom){setOverIdx(r);return;}
    }
  }
  function endDrag(){
    if(dragRef.current&&dragRef.current.moved&&dragIdx!==null&&overIdx!==null&&dragIdx!==overIdx){
      const reordered=[...available];
      const[moved]=reordered.splice(dragIdx,1);
      reordered.splice(overIdx,0,moved);
      const fromName=available[dragIdx]?.name;
      const toPos=overIdx+1;
      setPendingReorder({reordered:reordered.map((t,i)=>({...t,position:i+1})),fromName,fromPos:dragIdx+1,toPos});
    }
    dragRef.current=null;setDragIdx(null);setOverIdx(null);
  }
  function confirmReorder(){
    if(pendingReorder&&onReorder)onReorder(pendingReorder.reordered);
    setPendingReorder(null);
  }

  useEffect(()=>{
    if(dragIdx===null)return;
    const mm=e=>onMove(e.clientY);const mu=()=>endDrag();
    const tm=e=>{e.preventDefault();const t=e.touches[0];if(t)onMove(t.clientY);};const te=()=>endDrag();
    window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu);
    window.addEventListener('touchmove',tm,{passive:false});window.addEventListener('touchend',te);
    return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);
      window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',te);};
  },[dragIdx,overIdx]);

  let displayOrder=available;
  if(dragIdx!==null&&overIdx!==null&&dragIdx!==overIdx){
    displayOrder=[...available];const[moved]=displayOrder.splice(dragIdx,1);displayOrder.splice(overIdx,0,moved);
  }

  return(
    <div>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',justifyContent:'space-between'}}>
        <span>Available ({available.length})</span>
        {available.length>1&&<span style={{fontSize:10,color:C.textMuted,fontWeight:400,textTransform:'none'}}>drag to reorder</span>}
      </div>
      {available.length===0&&<div style={{padding:'12px 0',fontSize:13,color:C.textMuted}}>All techs are busy</div>}
      {displayOrder.map((tech,i)=>{
        const isDragging=dragIdx!==null&&available[dragIdx]?.id===tech.id;
        const isDropTarget=overIdx===i&&dragIdx!==null&&dragIdx!==i;
        return(
          <div key={tech.id} style={{marginBottom:4}}>
            <div ref={el=>rowRefs.current[i]=el}
              onMouseDown={e=>{e.preventDefault();startDrag(i,e.clientY);}}
              onTouchStart={e=>{const t=e.touches[0];if(t)startDrag(i,t.clientY);}}
              style={{
                display:'flex',alignItems:'center',gap:12,padding:'10px 10px',borderRadius:8,
                background:isDragging?C.grid:isDropTarget?'#2A3A4E':C.chromeDark,
                opacity:isDragging?0.5:1,
                borderTop:isDropTarget?'2px solid #60A5FA':'2px solid transparent',
                cursor:dragIdx!==null?'grabbing':'grab',
                userSelect:'none',touchAction:'none',
              }}>
              <div style={{width:46,height:46,borderRadius:'50%',border:'3px solid #22C55E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Av name={tech.name} size={40} index={i} photo={tech.photo_url}/>
              </div>
              <span style={{color:C.textPrimary,fontSize:16,fontWeight:500,flex:1}}>{tech.name}</span>
              {dragIdx===null&&onBreak&&(
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}
                  onClick={()=>setConfirmBreak(tech.id)}
                  style={{fontSize:11,color:C.textMuted,background:'none',border:`1px solid ${C.borderMedium}`,borderRadius:4,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.color=C.warning;e.currentTarget.style.borderColor=C.warning;}}
                  onMouseLeave={e=>{e.currentTarget.style.color=C.textMuted;e.currentTarget.style.borderColor=C.borderMedium;}}>
                  Break
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* ON BREAK section */}
      {onBreakList.length>0&&(
        <>
          <div style={{fontSize:12,color:C.warning,marginTop:16,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>On Break ({onBreakList.length})</div>
          {onBreakList.map((tech,i)=>(
            <div key={tech.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',marginBottom:4,opacity:0.7}}>
              <Av name={tech.name} size={34} index={i+5} photo={tech.photo_url}/>
              <span style={{color:C.warning,fontSize:14,flex:1}}>{tech.name}</span>
              {onEndBreak&&(
                <button onClick={()=>setConfirmEndBreak(tech.id)} style={{fontSize:11,color:C.success,background:'none',border:`1px solid ${C.success}`,borderRadius:4,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(5,150,105,0.15)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='none';}}>
                  End Break
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* BUSY section */}
      <div style={{fontSize:12,color:C.textMuted,marginTop:16,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Busy ({busy.length})</div>
      {busy.map((tech,i)=>(
        <div key={tech.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',opacity:0.35}}>
          <Av name={tech.name} size={34} index={i+2} photo={tech.photo_url}/><span style={{color:C.textPrimary,fontSize:14}}>{tech.name}</span>
        </div>
      ))}

      {/* CONFIRM REORDER popup */}
      {pendingReorder&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPendingReorder(null)}>
          <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 20px 14px'}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary,marginBottom:10}}>Confirm Position Change</div>
              <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
                Move <span style={{color:C.blueLight,fontWeight:500}}>{pendingReorder.fromName}</span> from position {pendingReorder.fromPos} to position {pendingReorder.toPos}?
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 20px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
              <button onClick={()=>setPendingReorder(null)} style={{padding:'8px 16px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>No, Go Back</button>
              <button onClick={confirmReorder} style={{padding:'8px 16px',borderRadius:6,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Yes, Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BREAK popup */}
      {confirmBreak&&(()=>{
        const tech=techTurn.find(t=>t.id===confirmBreak);
        return(
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setConfirmBreak(null)}>
            <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'20px 20px 14px'}}>
                <div style={{fontSize:15,fontWeight:600,color:C.textPrimary,marginBottom:10}}>Send on Break?</div>
                <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
                  <span style={{color:C.blueLight,fontWeight:500}}>{tech?.name}</span> will be removed from the available queue and placed on break.
                </div>
              </div>
              <div style={{display:'flex',gap:8,padding:'12px 20px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
                <button onClick={()=>setConfirmBreak(null)} style={{padding:'8px 16px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={()=>{onBreak(confirmBreak);setConfirmBreak(null);}} style={{padding:'8px 16px',borderRadius:6,border:'none',background:C.warning,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Yes, Break</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM END BREAK popup */}
      {confirmEndBreak&&(()=>{
        const tech=techTurn.find(t=>t.id===confirmEndBreak);
        return(
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setConfirmEndBreak(null)}>
            <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.5)',position:'relative'}} onClick={e=>e.stopPropagation()}>
              <AreaTag id="TECHTURN" />
              <div style={{padding:'20px 20px 14px'}}>
                <div style={{fontSize:15,fontWeight:600,color:C.textPrimary,marginBottom:10}}>End Break?</div>
                <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
                  <span style={{color:C.blueLight,fontWeight:500}}>{tech?.name}</span> will return to the available queue at the end of the line.
                </div>
              </div>
              <div style={{display:'flex',gap:8,padding:'12px 20px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
                <button onClick={()=>setConfirmEndBreak(null)} style={{padding:'8px 16px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={()=>{onEndBreak(confirmEndBreak);setConfirmEndBreak(null);}} style={{padding:'8px 16px',borderRadius:6,border:'none',background:C.success,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Yes, End Break</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
