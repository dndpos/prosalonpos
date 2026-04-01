import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Interactive Waitlist Panel
 * Tech picker matches Turn panel exactly — same order, same styling.
 * + Check In button to add walk-ins or appointment check-ins.
 * Per Session 1 Decisions #20-25
 */
import { useState, useEffect } from 'react';
import { getWaitColor, AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';

const QUICK_SERVICES=["Women's Cut",'Blowout','Full Color','Highlights','Balayage','Updo','Deep Cond.',"Men's Cut",'Beard Trim','Manicure','Pedicure','Gel Mani','Facial','Waxing'];

function Av({name,size=30,index=0,photo=null}){
  var C = useTheme();
  if(photo)return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

function autoCap(v){return v.replace(/(^|\s)\S/g,c=>c.toUpperCase());}

export default function WaitlistPanel({waitlist, techTurn, onStartWorking, onRemove, onCheckIn}){
  var C = useTheme();
  const[expandedId,setExpandedId]=useState(null);
  const[pendingConfirm,setPendingConfirm]=useState(null);
  const[now,setNow]=useState(Date.now());
  const[showForm,setShowForm]=useState(false);
  const[formName,setFormName]=useState('');
  const[formService,setFormService]=useState(QUICK_SERVICES[0]);
  const[formRequested,setFormRequested]=useState('');
  const[formIsWalkIn,setFormIsWalkIn]=useState(true);
  const[pendingRemove,setPendingRemove]=useState(null);

  useEffect(()=>{const iv=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(iv);},[]);

  function getWaitMin(entry){
    if(!entry.checked_in_at)return entry.wait_min||0;
    return Math.floor((now-entry.checked_in_at)/60000);
  }
  function toggleExpand(id){setExpandedId(prev=>prev===id?null:id);}

  const availableTechs=techTurn.filter(t=>t.status==='available').sort((a,b)=>(a.position||99)-(b.position||99));
  const busyTechs=techTurn.filter(t=>t.status==='busy');

  function handlePickTech(entry,tech){
    if(tech.status==='busy')return;
    if(entry.requested&&tech.name!==entry.requested){
      setPendingConfirm({entry,tech:{id:tech.id,display_name:tech.name,photo_url:tech.photo_url}});
    }else{
      if(onStartWorking)onStartWorking(entry,{id:tech.id,display_name:tech.name,photo_url:tech.photo_url});
      setExpandedId(null);
    }
  }
  function confirmOverride(){
    if(!pendingConfirm)return;
    if(onStartWorking)onStartWorking(pendingConfirm.entry,pendingConfirm.tech);
    setPendingConfirm(null);setExpandedId(null);
  }

  function handleFormSave(){
    if(!formName.trim())return;
    const entry={
      id:'w-'+Date.now(),
      client:formName.trim(),
      service:formService,
      walk_in:formIsWalkIn,
      requested:formRequested||null,
      checked_in_at:Date.now(),
    };
    if(onCheckIn)onCheckIn(entry);
    setFormName('');setFormService(QUICK_SERVICES[0]);setFormRequested('');setFormIsWalkIn(true);setShowForm(false);
  }
  function handleFormCancel(){
    setFormName('');setFormService(QUICK_SERVICES[0]);setFormRequested('');setFormIsWalkIn(true);setShowForm(false);
  }

  const INP={width:'100%',height:38,background:'#283548',border:`1px solid ${C.borderMedium}`,borderRadius:6,padding:'0 10px',color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  const techNames=techTurn.map(t=>t.name).sort();

  return(
    <div>
      {/* CHECK IN BUTTON / FORM */}
      {!showForm?(
        <button onClick={()=>setShowForm(true)} style={{width:'100%',padding:'10px 0',marginBottom:12,background:C.blueTint,border:`1px dashed ${C.blue}`,borderRadius:8,color:C.blueLight,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
          onMouseEnter={e=>e.currentTarget.style.background=C.accentBg}
          onMouseLeave={e=>e.currentTarget.style.background=C.blueTint}>
          + Check In
        </button>
      ):(
        <div style={{marginBottom:12,padding:12,background:C.chromeDark,borderRadius:8,border:`1px solid ${C.borderMedium}`}}>
          <div style={{fontSize:12,fontWeight:600,color:C.textPrimary,marginBottom:10}}>Check In Client</div>
          {/* Name */}
          <input value={formName} onChange={e=>setFormName(autoCap(e.target.value))} placeholder="Client name" autoCapitalize="words" autoComplete="off" style={{...INP,marginBottom:8}}/>
          {/* Service */}
          <select value={formService} onChange={e=>setFormService(e.target.value)} style={{...INP,marginBottom:8,appearance:'auto'}}>
            {QUICK_SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {/* Walk-in / Appointment toggle */}
          <div style={{display:'flex',gap:6,marginBottom:8}}>
            <button onClick={()=>setFormIsWalkIn(true)} style={{flex:1,height:34,background:formIsWalkIn?'rgba(217,151,6,0.2)':'transparent',border:formIsWalkIn?'1px solid rgba(217,151,6,0.5)':`1px solid ${C.borderMedium}`,borderRadius:6,color:formIsWalkIn?C.warning:C.textMuted,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Walk-in</button>
            <button onClick={()=>setFormIsWalkIn(false)} style={{flex:1,height:34,background:!formIsWalkIn?C.accentBg:'transparent',border:!formIsWalkIn?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:6,color:!formIsWalkIn?C.blueLight:C.textMuted,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Appointment</button>
          </div>
          {/* Requested tech (optional) */}
          <select value={formRequested} onChange={e=>setFormRequested(e.target.value)} style={{...INP,marginBottom:10,appearance:'auto'}}>
            <option value="">No tech preference</option>
            {techNames.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          {/* Save / Cancel */}
          <div style={{display:'flex',gap:6}}>
            <button onClick={handleFormCancel} style={{flex:1,height:36,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            <button onClick={handleFormSave} disabled={!formName.trim()} style={{flex:1,height:36,background:formName.trim()?C.blue:'#334155',border:'none',borderRadius:6,color:formName.trim()?'#fff':C.textMuted,fontSize:12,fontWeight:500,cursor:formName.trim()?'pointer':'default',fontFamily:'inherit'}}>Check In</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{fontSize:11,color:C.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>
        <span>Waiting ({waitlist.length})</span>
      </div>

      {waitlist.length===0&&!showForm&&(
        <div style={{padding:'12px 8px',textAlign:'center',color:C.textMuted,fontSize:13}}>No one waiting</div>
      )}

      {waitlist.map((w,wi)=>{
        const waitMin=getWaitMin(w);
        const isExpanded=expandedId===w.id;
        return(
          <div key={w.id} style={{marginBottom:4,borderRadius:6,background:isExpanded?'#253344':C.chromeDark,border:isExpanded?`1px solid ${C.borderMedium}`:'1px solid transparent',overflow:'hidden'}}>
            <div onClick={()=>toggleExpand(w.id)} style={{display:'flex',gap:8,padding:'8px 6px',alignItems:'flex-start',cursor:'pointer'}}>
              <Av name={w.client} size={28} index={wi+10}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:C.textPrimary,fontSize:12,fontWeight:500}}>
                    {w.is_vip&&<span style={{fontSize:9,marginRight:3,verticalAlign:'middle'}}>👑</span>}
                    {w.client}
                    {w.is_vip&&<span style={{fontSize:8,fontWeight:700,color:'#F59E0B',background:'rgba(245,158,11,0.2)',padding:'1px 4px',borderRadius:3,marginLeft:4,verticalAlign:'middle',letterSpacing:'0.03em'}}>VIP</span>}
                  </span>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <span style={{color:'#fff',fontSize:10,fontWeight:500,background:getWaitColor(waitMin),padding:'1px 6px',borderRadius:3}}>{waitMin}m</span>
                    <button onClick={e=>{e.stopPropagation();setPendingRemove(w);}} style={{height:28,width:28,background:'transparent',border:'1px solid rgba(239,68,68,0.4)',borderRadius:6,color:'#FCA5A5',fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.15)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>×</button>
                  </div>
                </div>
                <div style={{fontSize:11,color:C.textPrimary}}>{w.service}</div>
                <div style={{display:'flex',gap:4,marginTop:2}}>
                  <span style={{fontSize:9,color:w.walk_in?C.warning:C.blueLight,background:w.walk_in?'rgba(217,151,6,0.15)':C.accentBg,padding:'1px 5px',borderRadius:3}}>{w.walk_in?'Walk-in':'Appt'}</span>
                  {w.requested&&<span style={{fontSize:9,color:'#FBBF24',background:'rgba(251,191,36,0.15)',padding:'1px 5px',borderRadius:3}}>Req: {w.requested}</span>}
                </div>
              </div>
            </div>
            {isExpanded&&(
              <div style={{padding:'4px 6px 8px'}}>
                <div style={{marginBottom:6}}>
                  <span style={{fontSize:10,color:C.textMuted}}>Start working with:</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,overflow:'auto'}}>
                  {availableTechs.map((tech,ti)=>(
                    <button key={tech.id} onClick={e=>{e.stopPropagation();handlePickTech(w,tech);}}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',background:C.chromeDark,border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left',color:C.textPrimary,fontSize:16,width:'100%'}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.btnBg}
                      onMouseLeave={e=>e.currentTarget.style.background=C.chromeDark}>
                      <div style={{width:46,height:46,borderRadius:'50%',border:'3px solid #22C55E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {tech.photo_url
                          ?<img src={tech.photo_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}}/>
                          :<Av name={tech.name} size={40} index={ti}/>}
                      </div>
                      <span style={{flex:1,fontWeight:500}}>{tech.name}</span>
                      {w.requested&&tech.name===w.requested&&<span style={{fontSize:10,color:'#FBBF24',fontWeight:600}}>Requested</span>}
                    </button>
                  ))}
                  {busyTechs.length>0&&<div style={{fontSize:10,color:C.textMuted,marginTop:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>Busy</div>}
                  {busyTechs.map((tech,ti)=>(
                    <div key={tech.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',borderRadius:8,opacity:0.35}}>
                      <Av name={tech.name} size={34} index={ti+2} photo={tech.photo_url}/>
                      <span style={{color:C.textPrimary,fontSize:14}}>{tech.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {pendingConfirm&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPendingConfirm(null)}>
          <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:380,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 20px 14px'}}>
              <div style={{fontSize:15,fontWeight:600,color:'#FCA5A5',marginBottom:10}}>⚠ Requested Technician Warning</div>
              <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
                <span style={{color:C.blueLight,fontWeight:500}}>{pendingConfirm.entry.client}</span> specifically requested <span style={{color:'#FBBF24',fontWeight:500}}>{pendingConfirm.entry.requested}</span>.
              </div>
              <div style={{fontSize:13,color:C.textPrimary,marginTop:6,lineHeight:'1.6'}}>
                You are assigning them to <span style={{color:C.blueLight,fontWeight:500}}>{pendingConfirm.tech.display_name}</span> instead.
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 20px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
              <button onClick={()=>setPendingConfirm(null)} style={{padding:'8px 16px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>No, Go Back</button>
              <button onClick={confirmOverride} style={{padding:'8px 16px',borderRadius:6,border:'none',background:'#D97706',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Yes, Continue</button>
            </div>
          </div>
        </div>
      )}
      {pendingRemove&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPendingRemove(null)}>
          <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 20px 14px'}}>
              <div style={{fontSize:15,fontWeight:600,color:'#FCA5A5',marginBottom:10}}>Remove from Waitlist?</div>
              <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
                Remove <span style={{color:C.blueLight,fontWeight:500}}>{pendingRemove.client}</span> from the waitlist?
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 20px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
              <button onClick={()=>setPendingRemove(null)} style={{padding:'8px 16px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
              <button onClick={()=>{if(onRemove)onRemove(pendingRemove);setPendingRemove(null);setExpandedId(null);}} style={{padding:'8px 16px',borderRadius:6,border:'none',background:'#EF4444',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
