import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Appointment Detail Popup
 * 
 * Shows when a user clicks an appointment block on the calendar.
 * Displays client info, service details, status, notes, and
 * state machine transition actions per Session 1 Decisions #8-9.
 * 
 * Props:
 *   sl              — the clicked service line object
 *   allServiceLines — full array (to find related services for same client)
 *   staff           — staff array for tech name lookups
 *   onClose         — callback to close the popup
 *   onStatusChange  — callback(sl, newStatus) to transition appointment status
 *   onChangeTech    — callback(serviceLineIds[], newStaffId, timing, remainingOnSource) to reassign tech
 *   onAddTime       — callback(sl, extraMinutes) to extend appointment duration
 */
import { useState } from 'react';
import { useClientStore } from '../../lib/stores/clientStore';

export const STATUS_CONFIG={
  pending:     {label:'Pending Confirmation', bg:'rgba(245,158,11,0.15)', color:'#FBBF24',  dot:'#F59E0B'},
  confirmed:   {label:'Confirmed',   bg:'rgba(56,189,248,0.15)',  color:'#7DD3FC',  dot:'#38BDF8'},
  checked_in:  {label:'Checked In',  bg:'rgba(16,185,129,0.15)', color:'#6EE7B7',  dot:'#10B981'},
  in_progress: {label:'In Progress', bg:'rgba(139,92,246,0.15)', color:'#C4B5FD',  dot:'#8B5CF6'},
  completed:   {label:'Completed',   bg:'rgba(34,197,94,0.15)',  color:'#86EFAC',  dot:'#22C55E'},
  no_show:     {label:'No Show',     bg:'rgba(239,68,68,0.15)',  color:'#FCA5A5',  dot:'#EF4444'},
  cancelled:   {label:'Cancelled',   bg:'rgba(100,116,139,0.15)',color:'#CBD5E1',  dot:'#64748B'},
};

export const ALLOWED_TRANSITIONS={
  pending:     ['confirmed','cancelled'],
  confirmed:   ['checked_in','no_show','cancelled'],
  checked_in:  ['in_progress','cancelled'],
  in_progress: ['completed'],
  completed:   [],
  no_show:     [],
  cancelled:   [],
};

const TRANSITION_LABELS={
  confirmed:'Confirm Appointment', checked_in:'Check In', in_progress:'Start Working',
  completed:'Complete', no_show:'No Show', cancelled:'Cancel Appointment',
};

const TRANSITION_CONFIRM_MSG={
  confirmed:'Mark this appointment as confirmed?',
  checked_in:'Check in this client? This will start the wait timer.',
  in_progress:'Start working on this appointment? It can no longer be cancelled after this.',
  completed:'Mark this appointment as completed? This will move it to checkout.',
  no_show:'Mark this client as a no-show? This cannot be undone.',
  cancelled:'Cancel this appointment? This cannot be undone.',
};

const TRANSITION_STYLES={
  confirmed:   {bg:'#38BDF8',color:'#fff'},
  checked_in:  {bg:'#10B981',color:'#fff'},
  in_progress: {bg:'#8B5CF6',color:'#fff'},
  completed:   {bg:'#22C55E',color:'#fff'},
  no_show:     {bg:'transparent',color:'#FCA5A5',border:'1px solid rgba(239,68,68,0.4)'},
  cancelled:   {bg:'transparent',color:'#CBD5E1',border:'1px solid rgba(100,116,139,0.4)'},
};

const EXTRA_TIME_OPTIONS=[
  {label:'+15 min', minutes:15},
  {label:'+30 min', minutes:30},
  {label:'+45 min', minutes:45},
  {label:'+1 hour', minutes:60},
];

// Service catalog for Add Service popup (matches mockData.js)
const SERVICE_CATEGORIES=[
  {id:'cat-01',name:'Hair'},{id:'cat-02',name:'Nails'},{id:'cat-03',name:'Color'},
  {id:'cat-04',name:'Skin'},{id:'cat-05',name:'Men'},
];
const SERVICE_CATALOG=[
  {id:'svc-01',name:"Women's Haircut",   color:'#EF4444',dur:45, price:5500, cats:['cat-01']},
  {id:'svc-02',name:'Blowout',           color:'#EC4899',dur:30, price:3500, cats:['cat-01']},
  {id:'svc-03',name:'Updo',              color:'#D946EF',dur:60, price:7500, cats:['cat-01']},
  {id:'svc-04',name:'Deep Conditioning',  color:'#F97316',dur:30, price:4000, cats:['cat-01','cat-04']},
  {id:'svc-05',name:'Full Color',        color:'#8B5CF6',dur:90, price:12000,cats:['cat-03']},
  {id:'svc-06',name:'Highlights',        color:'#F59E0B',dur:120,price:15000,cats:['cat-03']},
  {id:'svc-07',name:'Balayage',          color:'#6366F1',dur:150,price:20000,cats:['cat-03']},
  {id:'svc-08',name:'Custom Color',      color:'#FF6B6B',dur:120,price:0,    cats:['cat-03']},
  {id:'svc-09',name:'Manicure',          color:'#06B6D4',dur:30, price:3000, cats:['cat-02']},
  {id:'svc-10',name:'Pedicure',          color:'#14B8A6',dur:45, price:4500, cats:['cat-02']},
  {id:'svc-11',name:'Gel Manicure',      color:'#2DD4BF',dur:45, price:4500, cats:['cat-02']},
  {id:'svc-12',name:'Facial',            color:'#10B981',dur:60, price:8000, cats:['cat-04']},
  {id:'svc-13',name:'Waxing',            color:'#84CC16',dur:15, price:2500, cats:['cat-04']},
  {id:'svc-14',name:"Men's Haircut",     color:'#3B82F6',dur:30, price:3500, cats:['cat-05']},
  {id:'svc-15',name:'Beard Trim',        color:'#78716C',dur:15, price:2000, cats:['cat-05']},
  {id:'svc-16',name:'Hot Towel Shave',   color:'#A3A3A3',dur:30, price:0,    cats:['cat-05']},
];

function formatTimeFull(d){const h=d.getHours(),m=d.getMinutes();return`${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
function formatTimeShort(h,m){return`${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')}`;}

// Lock SVG icon for "Requested" badge
function LockIcon({size=12,color='#FBBF24'}){
  return(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

// Avatar matching calendar column headers
const AVATAR_COLORS=['#1E3A5F','#064E3B','#7C2D12','#4C1D95','#831843'];
function getInitials(n){return(n||'').split(' ').filter(w=>w).map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function TechAvatar({name,size=22,staffIndex=0,photo=null}){
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(
    <div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[staffIndex%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:'#E2E8F0',fontSize:size<24?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>
  );
}

export default function AppointmentDetailPopup({sl, allServiceLines, staff, onClose, onStatusChange, onChangeTech, onAddTime, onAddService, onCheckout}){
  var C = useTheme();
  // Look up client from clientStore by client_id (API mode), fall back to name-based lookup
  var storeClients = useClientStore(function(s) { return s.clients; });
  var storeClient = sl.client_id ? storeClients.find(function(c) { return c.id === sl.client_id; }) : null;
  var info = storeClient
    ? { phone: storeClient.phone || '—', notes: storeClient.notes || '', id: storeClient.id, first_name: storeClient.first_name, last_name: storeClient.last_name, email: storeClient.email }
    : (function() {
      var nameMatch = storeClients.find(function(c) { return (c.first_name + ' ' + c.last_name) === sl.client; });
      return nameMatch ? { phone: nameMatch.phone || '—', notes: nameMatch.notes || '', id: nameMatch.id, first_name: nameMatch.first_name, last_name: nameMatch.last_name } : { phone: '—', notes: '' };
    })();
  const staffMember=staff.find(s=>s.id===sl.staff_id);
  const statusCfg=STATUS_CONFIG[sl.status]||STATUS_CONFIG.pending;
  const endDate=new Date(sl.starts_at.getTime()+sl.dur*60000);
  const transitions=ALLOWED_TRANSITIONS[sl.status]||[];
  const isTerminal=transitions.length===0;

  // Sub-popup state
  const[confirmAction,setConfirmAction]=useState(null);
  const[showChangeTech,setShowChangeTech]=useState(false);
  const[selectedLineIds,setSelectedLineIds]=useState([]);
  const[showExtraTime,setShowExtraTime]=useState(false);
  const[stagedChanges,setStagedChanges]=useState([]); // [{lineId, newStaffId}]
  const[showPickTech,setShowPickTech]=useState(false); // full-screen avatar picker
  const[timingMode,setTimingMode]=useState(null); // 'sequential'|'same_time' — chosen on confirm screen
  const[showAddService,setShowAddService]=useState(false);
  const[addServiceCat,setAddServiceCat]=useState(SERVICE_CATEGORIES[0]?.id||'');
  const[stagedServices,setStagedServices]=useState([]); // [{svc object}]

  // Find all service lines for the same client (multi-service visit)
  const relatedLines=allServiceLines.filter(s=>s.client===sl.client&&s.id!==sl.id).sort((a,b)=>a.starts_at-b.starts_at);
  const allLines=[sl,...relatedLines].sort((a,b)=>a.starts_at-b.starts_at);

  // Lines not yet staged for reassignment
  const stagedLineIds=stagedChanges.map(c=>c.lineId);
  const remainingLines=allLines.filter(l=>!stagedLineIds.includes(l.id));

  function handleTransitionClick(nextStatus){
    setConfirmAction({nextStatus});
  }

  function confirmTransition(){
    if(!confirmAction)return;
    onStatusChange(sl,confirmAction.nextStatus);
    setConfirmAction(null);
    // Don't close popup on completed — show "Go to Checkout" button instead
    if(confirmAction.nextStatus!=='completed') onClose();
  }

  function toggleLineSelection(lineId){
    setSelectedLineIds(prev=>prev.includes(lineId)?prev.filter(id=>id!==lineId):[...prev,lineId]);
  }

  function handleTechSelect(newStaffId){
    if(selectedLineIds.length===0)return;
    // Stage these assignments
    const newStaged=[...stagedChanges,...selectedLineIds.map(id=>({lineId:id, newStaffId}))];
    setStagedChanges(newStaged);
    setSelectedLineIds([]);
    setShowPickTech(false);
    // If all lines are now staged, go straight to confirmation
    const allStaged=allLines.every(l=>newStaged.some(c=>c.lineId===l.id));
    if(allStaged){
      setShowChangeTech(false);
    }
    // Otherwise stay in showChangeTech — remaining lines will show
  }

  function handleFinishChangeTech(){
    if(stagedChanges.length===0){
      setShowChangeTech(false);
      setStagedChanges([]);
      setSelectedLineIds([]);
      return;
    }
    setShowChangeTech(false);
    setSelectedLineIds([]);
    // goes to confirmation popup (pendingTechChange block below)
  }

  function confirmTechChange(mode){
    var timing=mode||timingMode||'sequential';
    if(stagedChanges.length===0||!onChangeTech)return;
    // Group by newStaffId and call onChangeTech for each group
    const byStaff={};
    stagedChanges.forEach(c=>{
      if(!byStaff[c.newStaffId])byStaff[c.newStaffId]=[];
      byStaff[c.newStaffId].push(c.lineId);
    });
    // Pass all staged info plus timing so CalendarDayView can recalculate times
    var allStagedLineIds=stagedChanges.map(c=>c.lineId);
    var remainingOnSource=allLines.filter(l=>!allStagedLineIds.includes(l.id));
    Object.entries(byStaff).forEach(([staffId,lineIds])=>{
      onChangeTech(lineIds, staffId, timing, remainingOnSource);
    });
    setStagedChanges([]);
    setTimingMode(null);
    onClose();
  }

  function cancelTechChange(){
    setStagedChanges([]);
    setSelectedLineIds([]);
    setShowChangeTech(false);
    setShowPickTech(false);
    setTimingMode(null);
    onClose();
  }

  function handleAddTime(minutes){
    if(onAddTime) onAddTime(sl, minutes);
    setShowExtraTime(false);
    onClose(); // go back to calendar
  }

  // ── Confirmation sub-popup ──
  if(confirmAction){
    const nextStatus=confirmAction.nextStatus;
    const sty=TRANSITION_STYLES[nextStatus]||{};
    const isDanger=nextStatus==='cancelled'||nextStatus==='no_show';
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setConfirmAction(null)}>
        <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'24px 24px 16px'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:12}}>
              {isDanger?'⚠ Are you sure?':'Confirm Action'}
            </div>
            <div style={{fontSize:14,color:C.textPrimary,lineHeight:'1.6'}}>
              {TRANSITION_CONFIRM_MSG[nextStatus]||`Change status to ${TRANSITION_LABELS[nextStatus]}?`}
            </div>
            <div style={{fontSize:13,color:C.textMuted,marginTop:8}}>
              Client: <span style={{color:C.textPrimary}}>{sl.client}</span> · {sl.service}
            </div>
          </div>
          <div style={{display:'flex',gap:10,padding:'16px 24px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
            <button onClick={()=>{setConfirmAction(null);onClose();}} style={{padding:'9px 20px',borderRadius:7,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>No, Go Back</button>
            <button onClick={confirmTransition} style={{padding:'9px 20px',borderRadius:7,border:sty.border||'none',background:isDanger?(nextStatus==='no_show'?C.danger:'#64748B'):sty.bg,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>
              Yes, {TRANSITION_LABELS[nextStatus]}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full-screen Avatar Picker overlay ──
  if(showPickTech){
    var PICK_COLORS=['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444','#06B6D4','#84CC16'];
    var availableTechs=staff.filter(s=>s.active!==false).sort((a,b)=>a.display_name.localeCompare(b.display_name));
    var pickCols=4;while(Math.ceil(availableTechs.length/pickCols)>4&&pickCols<7)pickCols++;
    return(
      <div style={{position:'fixed',inset:0,backgroundColor:'rgba(11,17,32,0.95)',zIndex:310,display:'flex',flexDirection:'column',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'}}>
        <div style={{padding:'24px 32px',borderBottom:'1px solid #1E2D45',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'#F1F5F9'}}>Pick Technician</div>
            <div style={{fontSize:13,color:'#64748B',marginTop:2}}>Assign {selectedLineIds.length} service{selectedLineIds.length>1?'s':''} for {sl.client}</div>
          </div>
          <button onClick={()=>setShowPickTech(false)} style={{padding:'8px 18px',borderRadius:7,border:'1px solid #1E2D45',background:'none',color:'#F1F5F9',fontSize:13,fontWeight:500,cursor:'pointer'}}>← Back</button>
        </div>
        <div style={{flex:1,padding:32,display:'flex',alignItems:'flex-start',justifyContent:'center',overflow:'auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat('+pickCols+', 1fr)',gap:24,maxWidth:pickCols*164,width:'100%'}}>
            {availableTechs.map(function(tech,i){var color=PICK_COLORS[i%PICK_COLORS.length];return(
                <div key={tech.id} onClick={function(){handleTechSelect(tech.id);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'24px 12px',borderRadius:16,background:'#1A2340',border:'2px solid #1E2D45',cursor:'pointer',transition:'all 0.15s ease'}}
                  onMouseEnter={function(e){e.currentTarget.style.background='#213055';e.currentTarget.style.borderColor=color;e.currentTarget.style.transform='translateY(-2px)';}}
                  onMouseLeave={function(e){e.currentTarget.style.background='#1A2340';e.currentTarget.style.borderColor='#1E2D45';e.currentTarget.style.transform='translateY(0)';}}>
                  <div style={{width:80,height:80,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:600,color:'#fff',flexShrink:0}}>
                    {tech.photo_url?<img src={tech.photo_url} alt={tech.display_name} style={{width:80,height:80,borderRadius:'50%',objectFit:'cover'}}/>:getInitials(tech.display_name)}
                  </div>
                  <div style={{fontSize:15,fontWeight:600,color:'#F1F5F9',textAlign:'center',lineHeight:'1.3'}}>{tech.display_name}</div>
                </div>);})}
          </div>
        </div>
      </div>);
  }

  // ── Tech Change Confirmation (shows all staged changes + timing choice) ──
  if(!showChangeTech && stagedChanges.length>0){
    // Group changes by new tech for display
    const changesByTech={};
    stagedChanges.forEach(c=>{
      const t=staff.find(s=>s.id===c.newStaffId);
      const tName=t?.display_name||'—';
      if(!changesByTech[tName])changesByTech[tName]=[];
      const line=allLines.find(l=>l.id===c.lineId);
      if(line)changesByTech[tName].push(line);
    });
    // Check if some services stay with original tech (need timing choice)
    var allStagedIds=stagedChanges.map(c=>c.lineId);
    var someRemain=allLines.some(l=>!allStagedIds.includes(l.id));
    // Find original tech name for display
    var origTech=staff.find(s=>s.id===sl.staff_id);
    var origTechName=origTech?.display_name||'Original tech';
    var destTechNames=Object.keys(changesByTech);
    var destTechName=destTechNames[0]||'new tech';
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={cancelTechChange}>
        <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:460,maxHeight:'80vh',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'24px 24px 16px'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Confirm Tech Changes</div>
            <div style={{fontSize:13,color:C.textMuted}}>
              Client: <span style={{color:C.textPrimary}}>{sl.client}</span> · {stagedChanges.length} service{stagedChanges.length>1?'s':''} reassigned
            </div>
            {sl.requested&&(
              <div style={{marginTop:10,padding:'8px 12px',backgroundColor:'rgba(220,38,38,0.12)',borderRadius:8,border:'1px solid rgba(220,38,38,0.3)'}}>
                <div style={{fontSize:12,color:'#FCA5A5',fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
                  <LockIcon size={11} color="#FCA5A5"/> This client requested their current technician
                </div>
              </div>
            )}
          </div>
          <div style={{flex:1,overflow:'auto',padding:'0 24px 16px'}}>
            {Object.entries(changesByTech).map(([techName,lines])=>(
              <div key={techName} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:C.blueLight,fontWeight:500,marginBottom:6}}>→ {techName}</div>
                {lines.map(line=>{
                  const oldTech=staff.find(s=>s.id===line.staff_id);
                  return(
                    <div key={line.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.chromeDark,borderRadius:6,marginBottom:4}}>
                      <div style={{width:4,height:24,borderRadius:2,background:line.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.textPrimary}}>{line.service}</div>
                        <div style={{fontSize:11,color:C.textMuted}}>from {oldTech?.display_name||'—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Timing choice — only when some services remain on original tech */}
            {someRemain&&(
              <div style={{marginTop:8,padding:'14px 16px',background:C.chromeDark,borderRadius:10,border:`1px solid ${C.borderLight}`}}>
                <div style={{fontSize:12,color:C.textMuted,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.04em'}}>How should {destTechName} be scheduled?</div>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:10}}>Choose whether {destTechName} works at the same time or after {origTechName}.</div>
                <div style={{display:'flex',gap:10}}>
                  <div onClick={()=>confirmTechChange('same_time')}
                    style={{flex:1,height:52,borderRadius:8,background:C.blueTint,border:'2px solid '+C.blue,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,transition:'background 150ms'}}
                    onMouseEnter={function(e){e.currentTarget.style.background=C.accentBg;}}
                    onMouseLeave={function(e){e.currentTarget.style.background=C.blueTint;}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>Same time</div>
                    <div style={{fontSize:10,color:C.blueLight,fontWeight:400}}>Both techs start together</div>
                  </div>
                  <div onClick={()=>confirmTechChange('sequential')}
                    style={{flex:1,height:52,borderRadius:8,background:'rgba(217,119,6,0.1)',border:'2px solid '+C.warning,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,transition:'background 150ms'}}
                    onMouseEnter={function(e){e.currentTarget.style.background='rgba(217,119,6,0.2)';}}
                    onMouseLeave={function(e){e.currentTarget.style.background='rgba(217,119,6,0.1)';}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>After {origTechName}</div>
                    <div style={{fontSize:10,color:C.warning,fontWeight:400}}>Starts when first tech finishes</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:10,padding:'14px 24px',justifyContent:'flex-end',borderTop:`1px solid ${C.borderLight}`}}>
            <button onClick={cancelTechChange} style={{padding:'9px 20px',borderRadius:7,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>No, Go Back</button>
            {!someRemain&&(<button onClick={()=>confirmTechChange('same_time')} style={{padding:'9px 20px',borderRadius:7,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>Yes, Reassign</button>)}
          </div>
        </div>
      </div>
    );
  }

  // ── Add More Services sub-popup (multi-select) ──
  if(showAddService){
    const catServices=SERVICE_CATALOG.filter(s=>s.cats.includes(addServiceCat));
    const hasStaged=stagedServices.length>0;
    const totalAddedMin=stagedServices.reduce((sum,s)=>sum+s.dur,0);
    function addStagedService(svc){setStagedServices(prev=>[...prev,svc]);}
    function removeStagedService(idx){setStagedServices(prev=>prev.filter((_,i)=>i!==idx));}
    function applyAllServices(){
      if(onAddService) stagedServices.forEach(svc=>onAddService(sl,svc));
      setStagedServices([]);
      setShowAddService(false);
      onClose();
    }
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>{setShowAddService(false);setStagedServices([]);}}>
        <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:460,maxHeight:'80vh',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 24px 12px'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Add More Services</div>
            <div style={{fontSize:13,color:C.textPrimary}}>
              Adding to {sl.client}'s appointment with {staffMember?.display_name||'—'}
            </div>
          </div>
          {/* Category tabs */}
          <div style={{display:'flex',gap:4,padding:'0 24px 12px',overflowX:'auto'}}>
            {SERVICE_CATEGORIES.map(cat=>(
              <button key={cat.id} onClick={()=>setAddServiceCat(cat.id)}
                style={{padding:'6px 14px',borderRadius:6,border:addServiceCat===cat.id?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,background:addServiceCat===cat.id?C.blue:C.chromeDark,color:addServiceCat===cat.id?'#fff':C.textMuted,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                {cat.name}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflow:'auto'}}>
            {/* Staged services summary */}
            {hasStaged&&(
              <div style={{padding:'0 24px 10px'}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Added ({stagedServices.length}) · {totalAddedMin} min</div>
                {stagedServices.map((svc,idx)=>(
                  <div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:C.blueTint,borderRadius:6,marginBottom:4}}>
                    <div style={{width:4,height:20,borderRadius:2,background:svc.color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:C.textPrimary,flex:1}}>{svc.name}</span>
                    <span style={{fontSize:11,color:C.textMuted}}>{svc.dur}min</span>
                    <button onClick={()=>removeStagedService(idx)} style={{background:'none',border:'none',color:C.danger,fontSize:14,cursor:'pointer',padding:'0 4px',fontWeight:700}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {/* Service catalog list */}
            <div style={{padding:'0 24px 16px'}}>
              {catServices.map(svc=>(
                <button key={svc.id} onClick={()=>addStagedService(svc)}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:C.chromeDark,borderRadius:8,marginBottom:6,border:'1px solid transparent',cursor:'pointer',textAlign:'left'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+'60';e.currentTarget.style.background=C.blueTint;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background=C.chromeDark;}}>
                  <div style={{width:6,height:36,borderRadius:3,background:svc.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500,color:C.textPrimary}}>{svc.name}</div>
                    <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{svc.dur} min</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:500,color:C.textPrimary,flexShrink:0}}>${(svc.price/100).toFixed(0)}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{padding:'12px 24px 16px',borderTop:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between'}}>
            <button onClick={()=>{setShowAddService(false);setStagedServices([]);}} style={{padding:'9px 20px',borderRadius:7,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>Cancel</button>
            {hasStaged&&(
              <button onClick={applyAllServices} style={{padding:'9px 20px',borderRadius:7,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>
                Done ({stagedServices.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Extra Time sub-popup ──
  if(showExtraTime){
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowExtraTime(false)}>
        <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:380,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 24px 12px'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Add Extra Time</div>
            <div style={{fontSize:13,color:C.textPrimary}}>
              Current duration: <span style={{color:C.blueLight,fontWeight:500}}>{sl.dur} min</span> · {sl.client}
            </div>
          </div>
          <div style={{padding:'8px 24px 20px',display:'flex',flexDirection:'column',gap:8}}>
            {EXTRA_TIME_OPTIONS.map(opt=>(
              <button key={opt.minutes} onClick={()=>handleAddTime(opt.minutes)}
                style={{padding:'14px 16px',borderRadius:8,border:`1px solid ${C.borderMedium}`,background:C.chromeDark,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',textAlign:'left'}}>
                <span>{opt.label}</span>
                <span style={{fontSize:12,color:C.textMuted}}>→ {sl.dur+opt.minutes} min total</span>
              </button>
            ))}
          </div>
          <div style={{padding:'12px 24px 16px',borderTop:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'flex-end'}}>
            <button onClick={()=>setShowExtraTime(false)} style={{padding:'8px 20px',borderRadius:7,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Change Tech sub-popup (iterative assignment loop) ──
  if(showChangeTech){
    const hasSelection=selectedLineIds.length>0;
    const hasStaged=stagedChanges.length>0;
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>{setShowChangeTech(false);setStagedChanges([]);setSelectedLineIds([]);}}>
        <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:440,maxHeight:'80vh',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 24px 12px'}}>
            <div style={{fontSize:16,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Change Technician</div>
            <div style={{fontSize:13,color:C.textPrimary}}>Select services to reassign, then pick a tech{remainingLines.length<allLines.length?' (or hit Finish)':''}</div>
          </div>

          <div style={{flex:1,overflow:'auto'}}>
            {/* Already staged changes summary */}
            {hasStaged&&(
              <div style={{padding:'0 24px 10px'}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Staged changes</div>
                {stagedChanges.map(c=>{
                  const line=allLines.find(l=>l.id===c.lineId);
                  const newTech=staff.find(s=>s.id===c.newStaffId);
                  if(!line)return null;
                  return(
                    <div key={c.lineId} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:C.blueTint,borderRadius:6,marginBottom:4}}>
                      <div style={{width:4,height:20,borderRadius:2,background:line.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:C.textPrimary,flex:1}}>{line.service}</span>
                      <span style={{fontSize:12,color:C.blueLight}}>→ {newTech?.display_name||'—'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Remaining services to assign */}
            {remainingLines.length>0&&(
              <div style={{padding:'8px 24px 14px',borderTop:hasStaged?`1px solid ${C.borderLight}`:'none'}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                  {hasStaged?'Remaining services':'Select services'}
                </div>
                {remainingLines.map(line=>{
                  const checked=selectedLineIds.includes(line.id);
                  const lineTech=staff.find(s=>s.id===line.staff_id);
                  return(
                    <div key={line.id} onClick={()=>toggleLineSelection(line.id)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:checked?C.accentBg:C.chromeDark,border:checked?'1px solid rgba(56,189,248,0.4)':`1px solid transparent`,borderRadius:8,marginBottom:6,cursor:'pointer'}}>
                      <div style={{width:20,height:20,borderRadius:4,border:checked?'none':`2px solid ${C.borderMedium}`,background:checked?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {checked&&<span style={{color:'#fff',fontSize:14,fontWeight:700,lineHeight:1}}>✓</span>}
                      </div>
                      <div style={{width:4,height:28,borderRadius:2,background:line.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.textPrimary}}>{line.service}</div>
                        <div style={{fontSize:12,color:C.textMuted}}>with {lineTech?.display_name||'—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 2: Pick Tech button (only when services are checked) */}
            {hasSelection&&(
              <div style={{padding:'12px 24px 14px',borderTop:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'center'}}>
                <button onClick={()=>setShowPickTech(true)}
                  style={{padding:'12px 32px',borderRadius:8,border:'none',background:'#0E3D3D',color:'#5EEAD4',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Pick Tech ({selectedLineIds.length} service{selectedLineIds.length>1?'s':''})
                </button>
              </div>
            )}
          </div>

          {/* Footer: Cancel + Finish */}
          <div style={{padding:'12px 24px 16px',borderTop:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between'}}>
            <button onClick={()=>{setShowChangeTech(false);setStagedChanges([]);setSelectedLineIds([]);setShowPickTech(false);}} style={{padding:'9px 20px',borderRadius:7,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>Cancel</button>
            {hasStaged&&(
              <button onClick={handleFinishChangeTech} style={{padding:'9px 20px',borderRadius:7,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>
                Finish ({stagedChanges.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main detail popup ──
  return(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:14,width:460,maxHeight:'85vh',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.6)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>

        {/* Header with color accent bar */}
        <div style={{position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:4,background:sl.color}}/>
          <div style={{padding:'20px 24px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <span style={{fontSize:18,fontWeight:600,color:C.textPrimary}}>{sl.client}</span>
                {sl.requested&&(
                  <span style={{fontSize:11,color:'#FBBF24',background:'rgba(251,191,36,0.15)',padding:'3px 8px',borderRadius:4,fontWeight:500,display:'inline-flex',alignItems:'center',gap:4}}>
                    <LockIcon size={11}/> Requested
                  </span>
                )}
              </div>
              <div style={{fontSize:13,color:C.textPrimary}}>{info.phone}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#E2E8F0',fontSize:26,fontWeight:700,cursor:'pointer',padding:'2px 8px',borderRadius:6,lineHeight:1,flexShrink:0}}>✕</button>
          </div>
        </div>

        {/* Status badge */}
        <div style={{padding:'0 24px 16px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:8,background:statusCfg.bg}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:statusCfg.dot}}/>
            <span style={{fontSize:13,fontWeight:500,color:statusCfg.color}}>{statusCfg.label}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflow:'auto'}}>

          {/* Time & Tech card */}
          <div style={{padding:'0 24px 16px'}}>
            {(function(){
              // Collect unique techs across all service lines
              var techIds=[];var techNames=[];
              allLines.forEach(function(line){
                if(techIds.indexOf(line.staff_id)===-1){
                  techIds.push(line.staff_id);
                  var t=staff.find(function(s){return s.id===line.staff_id;});
                  techNames.push(t?t.display_name:'—');
                }
              });
              var multiTech=techNames.length>1;
              return(
                <div style={{background:C.chromeDark,borderRadius:10,padding:'14px 16px',display:'flex',gap:20}}>
                  <div>
                    <div style={{fontSize:11,color:C.textMuted,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>Time</div>
                    <div style={{fontSize:14,fontWeight:500,color:C.textPrimary}}>{formatTimeFull(sl.starts_at)} – {formatTimeFull(endDate)}</div>
                    <div style={{fontSize:12,color:C.textPrimary,marginTop:2}}>{sl.dur} min</div>
                  </div>
                  <div style={{width:1,background:C.borderLight}}/>
                  <div>
                    <div style={{fontSize:11,color:C.textMuted,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>{multiTech?'Technicians':'Technician'}</div>
                    {multiTech
                      ?techNames.map(function(name,i){return(
                        <div key={i} style={{fontSize:14,fontWeight:500,color:C.textPrimary,marginBottom:i<techNames.length-1?2:0}}>{name}</div>
                      );})
                      :<div style={{fontSize:14,fontWeight:500,color:C.textPrimary}}>{staffMember?.display_name||'—'}</div>
                    }
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Service lines */}
          <div style={{padding:'0 24px 16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:12,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                {allLines.length>1?`Services (${allLines.length})`:'Service'}
              </div>
              {!isTerminal&&(
                <button onClick={()=>setShowChangeTech(true)} style={{background:C.accentBg,border:'1px solid rgba(56,189,248,0.3)',color:C.blueLight,fontSize:12,fontWeight:500,cursor:'pointer',padding:'4px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:5}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>
                  Change Tech
                </button>
              )}
            </div>
            {(function(){
              // Group lines by tech (preserve time order within each group)
              var techGroups=[];var seenTechs=[];
              allLines.forEach(function(line){
                var idx=seenTechs.indexOf(line.staff_id);
                if(idx===-1){
                  seenTechs.push(line.staff_id);
                  techGroups.push({staffId:line.staff_id,lines:[line]});
                } else {
                  techGroups[idx].lines.push(line);
                }
              });
              var multiTech=techGroups.length>1;
              return techGroups.map(function(group,gIdx){
                var techObj=staff.find(function(s){return s.id===group.staffId;});
                var techName=techObj?techObj.display_name:'—';
                return(
                  <div key={group.staffId}>
                    {/* Tech divider tag — only shown when multiple techs */}
                    {multiTech&&(
                      <div style={{display:'flex',alignItems:'center',gap:8,margin:gIdx>0?'12px 0 6px':'0 0 6px'}}>
                        <TechAvatar name={techName} size={20} staffIndex={gIdx} photo={techObj?.photo_url}/>
                        <span style={{fontSize:12,fontWeight:600,color:C.blueLight}}>{techName}</span>
                        <div style={{flex:1,height:1,background:C.borderLight}}/>
                        <span style={{fontSize:10,color:C.textMuted}}>{group.lines.length} service{group.lines.length>1?'s':''}</span>
                      </div>
                    )}
                    {group.lines.map(function(line){
                      var lineEnd=new Date(line.starts_at.getTime()+line.dur*60000);
                      var lineTech=staff.find(function(s){return s.id===line.staff_id;});
                      return(
                        <div key={line.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:C.chromeDark,borderRadius:8,marginBottom:6}}>
                          <div style={{width:4,height:36,borderRadius:2,background:line.color,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,color:C.textPrimary}}>{line.service}</div>
                            <div style={{fontSize:12,color:C.textPrimary,marginTop:2}}>
                              {formatTimeShort(line.starts_at.getHours(),line.starts_at.getMinutes())}–{formatTimeShort(lineEnd.getHours(),lineEnd.getMinutes())} · {line.dur}min
                              {!multiTech&&lineTech&&<span style={{color:C.textMuted}}> · {lineTech.display_name}</span>}
                            </div>
                          </div>
                          <div style={{fontSize:13,fontWeight:500,color:C.textPrimary,flexShrink:0}}>{line.price_cents?'$'+(line.price_cents/100).toFixed(0):''}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>

          {/* Add Service + Add Extra Time buttons */}
          {!isTerminal&&(
            <div style={{padding:'0 24px 16px',display:'flex',gap:8}}>
              <button onClick={()=>setShowAddService(true)}
                style={{flex:1,padding:'11px 16px',borderRadius:8,border:`1px dashed ${C.borderMedium}`,background:'transparent',color:C.blueLight,fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                + Add More Services
              </button>
              <button onClick={()=>setShowExtraTime(true)}
                style={{flex:1,padding:'11px 16px',borderRadius:8,border:`1px dashed ${C.borderMedium}`,background:'transparent',color:C.blueLight,fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                + Add Extra Time
              </button>
            </div>
          )}

          {/* Booking Note */}
          {sl.note&&(
            <div style={{padding:'0 24px 16px'}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Booking Note</div>
              <div style={{fontSize:13,color:C.textPrimary,background:C.blueTint,border:`1px solid rgba(56,189,248,0.2)`,borderRadius:8,padding:'10px 14px',lineHeight:'1.5',display:'flex',alignItems:'flex-start',gap:6}}>
                <span style={{flexShrink:0}}>📝</span>
                <span>{sl.note}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {info.notes&&(
            <div style={{padding:'0 24px 16px'}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Notes</div>
              <div style={{fontSize:13,color:C.textPrimary,background:C.chromeDark,borderRadius:8,padding:'10px 14px',lineHeight:'1.5'}}>{info.notes}</div>
            </div>
          )}

          {/* Source */}
          <div style={{padding:'0 24px 16px'}}>
            <div style={{fontSize:12,color:C.textMuted}}>Source: <span style={{color:C.textPrimary}}>Staff-created</span></div>
          </div>
        </div>

        {/* Action footer */}
        {transitions.length>0?(
          <div style={{padding:'14px 24px',borderTop:`1px solid ${C.borderLight}`,display:'flex',gap:10,justifyContent:'flex-end',flexShrink:0}}>
            {transitions.map(nextStatus=>{
              const sty=TRANSITION_STYLES[nextStatus]||{};
              const isDanger=nextStatus==='cancelled'||nextStatus==='no_show';
              return(
                <button key={nextStatus} onClick={()=>handleTransitionClick(nextStatus)}
                  style={{
                    padding:'9px 20px',borderRadius:7,border:sty.border||'none',
                    background:sty.bg,color:sty.color,fontSize:13,fontWeight:500,
                    cursor:'pointer',minWidth:isDanger?'auto':100,
                  }}>
                  {TRANSITION_LABELS[nextStatus]||nextStatus}
                </button>
              );
            })}
          </div>
        ):(
          <div style={{padding:'14px 24px',borderTop:`1px solid ${C.borderLight}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontSize:12,color:C.textMuted}}>
              {sl.status==='completed'?'Service completed — ready for checkout'
               :sl.status==='no_show'?'Client did not show up'
               :sl.status==='cancelled'?'This appointment was cancelled'
               :'No further actions'}
            </span>
            {sl.status==='completed'&&(
              <button onClick={()=>{
                if(onCheckout){
                  // Build checkout data from all service lines for this client
                  const checkoutLines=allLines.map(line=>{
                    const techObj=staff.find(s=>s.id===line.staff_id);
                    return{id:line.id,name:line.service,tech:techObj?.display_name||'—',techId:line.staff_id,price_cents:line.price_cents||0,original_price_cents:line.price_cents||0,color:line.color,serviceCatalogId:line.service_catalog_id||null,open_price:!!line.open_price};
                  });
                  // Use store client data if available, fall back to name parse
                  var checkoutClient = storeClient
                    ? { id: storeClient.id, first_name: storeClient.first_name, last_name: storeClient.last_name, phone: (storeClient.phone || '').replace(/\D/g,''), email: storeClient.email || '' }
                    : (function() {
                        var nm = storeClients.find(function(c) { return (c.first_name + ' ' + c.last_name) === sl.client; });
                        return nm ? { id: nm.id, first_name: nm.first_name, last_name: nm.last_name, phone: (nm.phone || '').replace(/\D/g,'') }
                          : { first_name: (sl.client || '').split(' ')[0] || '', last_name: (sl.client || '').split(' ').slice(1).join(' ') || '', phone: '' };
                      })();
                  onCheckout({client:checkoutClient,services:checkoutLines,serviceLineIds:allLines.map(function(l){return l.id;})});
                }
                onClose();
              }} style={{padding:'9px 20px',borderRadius:7,border:'none',background:'#22C55E',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>
                Go to Checkout
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
