import { useTheme } from '../../lib/ThemeContext';
/** Pro Salon POS — Booking Creation Flow (Session 19 rewrite, Session 41 Reserve/Block) */
import { useState, useMemo, useEffect } from "react";
import { phoneToDigits, fmt, fp } from '../../lib/formatUtils';
import { useClientStore } from '../../lib/stores/clientStore';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import BookingFlowModals from './BookingFlowModals';
import BookingTicketPanel from './BookingTicketPanel';
import NewClientForm from './NewClientForm';
import ClientNameScreen from './ClientNameScreen';
import AreaTag from '../../components/ui/AreaTag';
function ft(h,m){return`${h>12?h-12:h===0?12:h}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
function autoCap(v){return v.replace(/(^|\s)\S/g,c=>c.toUpperCase());}
const F='Inter,system-ui,sans-serif';
const TICKET_W = 260;
const TAX_RATE = 7.5;
function getBalance(c){if(!c)return 0;return c.outstanding_balance_cents||0;}
function Av({name,size=32,i=0,photo=null}){
  if(photo)return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[i%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size<34?11:13,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}
export default function BookingFlow({staff=[],techTurn=[],initialStaffId,initialHour=11,initialMin=0,onSave,onCancel,catalogLayout,autoRequestMode=false,salonSettings}){
  var C = useTheme();
  var storeClients = useClientStore(function(s) { return s.clients; });
  var CLIENTS = useMemo(function() { return [...storeClients].sort(function(a,b) { return a.first_name.localeCompare(b.first_name); }); }, [storeClients]);
  var BP={height:44,padding:'0 24px',background:C.blue,color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'};
  var BS={height:44,padding:'0 24px',background:'transparent',color:C.textPrimary,border:`1px solid ${C.borderMedium}`,borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'};
  var BD={height:44,padding:'0 24px',background:C.danger,color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'};
  var INP={width:'100%',height:44,background:C.inputBg,border:`1px solid ${C.inputBorder}`,borderRadius:6,padding:'0 14px',color:C.inputText,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  var wrap={width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#2D3D50',fontFamily:F};
  var cl = catalogLayout || {};
  var CATEGORIES = cl.categories || [];
  var SERVICES_RAW = cl.services || [];
  var activeCategories = CATEGORIES.filter(function(c){ return c.active; });
  var svcSlots = cl.svcSlots || {};
  var svcColumns = cl.svcColumns || 4;
  var svcRows = cl.svcRows || 3;
  var catSlots = cl.catSlots || {};
  var catColumns = cl.catColumns || 2;
  const initTech=staff.find(s=>s.id===initialStaffId)||staff[0];
  const sortedStaff=[...staff].sort((a,b)=>a.display_name.localeCompare(b.display_name));
  // ══════════════════════════════════════
  // ── STATE ──
  // ══════════════════════════════════════
  const[screen,setScreen]=useState('search');
  // Client search state
  const[phoneDigits,setPhoneDigits]=useState('');
  const[nameQuery,setNameQuery]=useState('');
  const[newFirst,setNewFirst]=useState('');
  const[newLast,setNewLast]=useState('');
  const[newEmail,setNewEmail]=useState('');
  const[showNewForm,setShowNewForm]=useState(false);
  const[balanceAlert,setBalanceAlert]=useState(null);
  // Booking data — array of clients, each with techs, each with services
  const[bookingClients,setBookingClients]=useState([]);
  // Active pointers — which client and which tech we're currently adding services to
  const[activeClientIdx,setActiveClientIdx]=useState(0);
  const[activeTechKey,setActiveTechKey]=useState(null); // "cIdx-tIdx"
  const[showTimePopup,setShowTimePopup]=useState(false);
  const[showCancelConfirm,setShowCancelConfirm]=useState(false);
  const[showBlockTime,setShowBlockTime]=useState(false);
  const[blockFrom,setBlockFrom]=useState('');
  const[blockTo,setBlockTo]=useState('');
  // Default to the category in slot 0 (first visual position), not array[0]
  var _firstSlotCatId = catSlots[0] || (activeCategories.length > 0 ? activeCategories[0].id : null);
  const[activeCat,setActiveCat]=useState(_firstSlotCatId);
  // For "Add Technician" flow — stores the picked tech before timing popup
  const[pendingTech,setPendingTech]=useState(null);
  // For "Add Client" flow — which picker mode
  const[pickerMode,setPickerMode]=useState(null); // 'addTech' | 'addClientTech'
  // Temp client for "Add Client" flow
  const[pendingClient,setPendingClient]=useState(null);
  // Group booking — client name input (when group_booking_require_name is ON)
  const[clientNameInput,setClientNameInput]=useState('');

  // Per-client booking note
  const[showNotePopup,setShowNotePopup]=useState(null); // null or cIdx
  const[noteDraft,setNoteDraft]=useState('');
  // ══════════════════════════════════════
  // ── HELPERS ──
  // ══════════════════════════════════════
  function getActiveTechIds(){
    // All tech IDs currently in the booking (for highlighting active tech)
    const techKey = activeTechKey;
    if(!techKey) return {cIdx:0,tIdx:0};
    const parts=techKey.split('-');
    return {cIdx:parseInt(parts[0]),tIdx:parseInt(parts[1])};
  }
  function getActiveTech(){
    const{cIdx,tIdx}=getActiveTechIds();
    const bc=bookingClients[cIdx];
    if(!bc)return null;
    return bc.techs[tIdx]||null;
  }
  function getActiveTechId(){
    const t=getActiveTech();
    return t?t.techId:null;
  }
  // Count total services across all clients
  function totalServiceCount(){
    let c=0;
    bookingClients.forEach(bc=>bc.techs.forEach(t=>{c+=t.services.length;}));
    return c;
  }
  // Count techs for a specific client
  function techCountForClient(cIdx){
    return bookingClients[cIdx]?bookingClients[cIdx].techs.length:0;
  }
  // Get first tech of a client
  function getFirstTech(cIdx){
    return bookingClients[cIdx]?.techs[0]||null;
  }
  // ══════════════════════════════════════
  // ── INITIAL CLIENT SELECTION ──
  // ══════════════════════════════════════
  function selectClient(c){
    var bal=getBalance(c);
    if(bal>0){setBalanceAlert({client:c,amount:bal});}
    else{finishInitialClient(c);}
  }
  function confirmBalance(){
    if(balanceAlert){finishInitialClient(balanceAlert.client);setBalanceAlert(null);}
  }
  function cancelBalance(){setBalanceAlert(null);}
  function finishInitialClient(c){
    const techEntry={techId:initTech?.id,techName:initTech?.display_name||'?',timing:'parallel',requested:autoRequestMode,extraTime:0,services:[]};
    setBookingClients([{cIdx:0,client:c,techs:[techEntry],note:''}]);
    setActiveClientIdx(0);
    setActiveTechKey('0-0');
    setScreen('services');
  }
  function skipWalkIn(){
    const techEntry={techId:initTech?.id,techName:initTech?.display_name||'?',timing:'parallel',requested:autoRequestMode,extraTime:0,services:[]};
    setBookingClients([{cIdx:0,client:null,techs:[techEntry],note:''}]);
    setActiveClientIdx(0);
    setActiveTechKey('0-0');
    setScreen('services');
  }
  function handleBlockTime(minutes){
    var isBlock=showBlockTime==='block';var label=isBlock?'Blocked':'Reserved';
    if(onSave)onSave({services:[{clientName:label,name:label,dur:minutes,color:isBlock?'#EF4444':'#F59E0B',price:0,open_price:false,techId:initTech?.id,requested:false,timing:'parallel',note:''}],startHour:initialHour,startMin:initialMin});
  }
  function handleBlockConfirm(){
    if(!blockFrom||!blockTo)return;var fMin=parseInt(blockFrom);var tMin=parseInt(blockTo);if(fMin>=tMin)return;
    if(onSave)onSave({services:[{clientName:'Blocked',name:'Blocked',dur:tMin-fMin,color:'#EF4444',price:0,open_price:false,techId:initTech?.id,requested:false,timing:'parallel',note:''}],startHour:Math.floor(fMin/60),startMin:fMin%60});
  }
  function saveNewClient(){
    if(!newFirst.trim()||phoneDigits.length!==10)return;
    finishInitialClient({id:'c-new',first_name:newFirst.trim(),last_name:newLast.trim(),phone:phoneDigits});
  }
  // ══════════════════════════════════════
  // ── ADD TECHNICIAN FLOW ──
  // ══════════════════════════════════════
  function startAddTech(){
    setPickerMode('addTech');
    setScreen('techPicker');
  }
  function handlePickTechForAdd(tech){
    // Store pending tech, show timing popup
    setPendingTech(tech);
    setScreen('timingPopup');
  }
  function finishAddTech(timing){
    if(!pendingTech)return;
    const cIdx=activeClientIdx;
    setBookingClients(prev=>{
      const next=[...prev];
      const bc={...next[cIdx],techs:[...next[cIdx].techs]};
      const newTIdx=bc.techs.length;
      bc.techs.push({techId:pendingTech.id,techName:pendingTech.display_name,timing,requested:autoRequestMode,extraTime:0,services:[]});
      next[cIdx]=bc;
      return next;
    });
    const newTIdx=bookingClients[cIdx].techs.length; // will be the index after push
    setActiveTechKey(`${cIdx}-${newTIdx}`);
    setPendingTech(null);
    setScreen('services');
  }
  // ══════════════════════════════════════
  // ── ADD CLIENT FLOW ──
  // ══════════════════════════════════════
  function startAddClient(){
    setPickerMode('addClientTech');
    setPendingClient(null);
    setClientNameInput('');
    var requireName = (salonSettings || {}).group_booking_require_name !== false;
    if(requireName){
      setScreen('clientName');
    } else {
      setScreen('techPicker');
    }
  }
  function confirmClientName(){
    var name = clientNameInput.trim();
    if(name){
      // Build a minimal client object from the entered name
      var parts = name.split(' ');
      setPendingClient({ id: null, first_name: parts[0] || name, last_name: parts.slice(1).join(' ') || '' });
    } else {
      setPendingClient(null); // walk-in
    }
    setScreen('techPicker');
  }
  function handleAddClientBalance(){
    // Called from balance alert when adding a second client (screen !== 'search')
    // pendingClient is already set — dismiss alert and proceed to tech picker
    if(balanceAlert){ setPendingClient(balanceAlert.client); setBalanceAlert(null); }
    setPickerMode('addClientTech');
    setScreen('techPicker');
  }
  function handlePickTechForNewClient(tech){
    const newCIdx=bookingClients.length;
    const client=pendingClient; // could be null for walk-in
    setBookingClients(prev=>[...prev,{cIdx:newCIdx,client,techs:[{techId:tech.id,techName:tech.display_name,timing:'parallel',requested:autoRequestMode,extraTime:0,services:[]}],note:''}]);
    setActiveClientIdx(newCIdx);
    setActiveTechKey(`${newCIdx}-0`);
    setPendingClient(null);
    setPickerMode(null);
    setScreen('services');
  }
  // ══════════════════════════════════════
  // ── TECH PICKER DISPATCH ──
  // ══════════════════════════════════════
  function handleTechPickerSelect(tech){
    if(pickerMode==='addTech') handlePickTechForAdd(tech);
    else if(pickerMode==='addClientTech') handlePickTechForNewClient(tech);
    else setScreen('services');
  }
  function handleTechPickerBack(){
    if(pickerMode==='addClientTech'){setScreen('services');setPickerMode(null);}
    else setScreen('services');
  }
  // ══════════════════════════════════════
  // ── SERVICE TOGGLE ──
  // ══════════════════════════════════════
  function toggleService(svc){
    const{cIdx,tIdx}=getActiveTechIds();
    setBookingClients(prev=>{
      const next=prev.map((bc,ci)=>{
        if(ci!==cIdx)return bc;
        return{...bc,techs:bc.techs.map((te,ti)=>{
          if(ti!==tIdx)return te;
          const existing=te.services.find(s=>s.id===svc.id);
          if(existing) return{...te,services:te.services.filter(s=>s.id!==svc.id)};
          return{...te,services:[...te.services,{id:svc.id,name:svc.name,color:svc.calendar_color,dur:svc.default_duration_minutes,price:svc.price_cents,open_price:!!svc.open_price}]};
        })};
      });
      return next;
    });
  }
  function removeService(cIdx,tIdx,svcId){
    setBookingClients(prev=>prev.map((bc,ci)=>{
      if(ci!==cIdx)return bc;
      return{...bc,techs:bc.techs.map((te,ti)=>{
        if(ti!==tIdx)return te;
        return{...te,services:te.services.filter(s=>s.id!==svcId)};
      })};
    }));
  }
  function toggleRequested(cIdx,tIdx){
    setBookingClients(prev=>prev.map((bc,ci)=>{
      if(ci!==cIdx)return bc;
      return{...bc,techs:bc.techs.map((te,ti)=>{
        if(ti!==tIdx)return te;
        return{...te,requested:!te.requested};
      })};
    }));
  }
  function setActivePointer(cIdx,tIdx){
    setActiveClientIdx(cIdx);
    setActiveTechKey(`${cIdx}-${tIdx}`);
  }
  function setExtraTimeForActiveTech(mins){
    const{cIdx,tIdx}=getActiveTechIds();
    setBookingClients(prev=>prev.map((bc,ci)=>{
      if(ci!==cIdx)return bc;
      return{...bc,techs:bc.techs.map((te,ti)=>{
        if(ti!==tIdx)return te;
        return{...te,extraTime:te.extraTime===mins?0:mins}; // toggle off if same value
      })};
    }));
    setShowTimePopup(false);
  }
  // ══════════════════════════════════════
  // ── SAVE ──
  // ══════════════════════════════════════
  function handleSave(){
    if(totalServiceCount()===0)return;
    // Flatten to service list with client info, tech info, timing, extraTime
    const allServices=[];
    const firstBc=bookingClients[0];
    const firstName=firstBc&&firstBc.client?`${firstBc.client.first_name} ${firstBc.client.last_name.charAt(0)}.`:'Walk-in';
    bookingClients.forEach((bc,cIdx)=>{
      var cn;
      if(cIdx===0){
        cn=bc.client?`${bc.client.first_name} ${bc.client.last_name.charAt(0)}.`:'Walk-in';
      } else {
        if(bc.client&&bc.client.first_name){
          cn=`${bc.client.first_name}${bc.client.last_name?' '+bc.client.last_name.charAt(0)+'.':''} with ${firstName}`;
        } else {
          cn=`with ${firstName}`;
        }
      }
      bc.techs.forEach((te,tIdx)=>{
        te.services.forEach((svc,sIdx)=>{
          const isLastSvc=sIdx===te.services.length-1;
          allServices.push({
            clientName:cn,name:svc.name,dur:svc.dur+(isLastSvc?te.extraTime||0:0),color:svc.color,price:svc.price||0,open_price:!!svc.open_price,
            techId:te.techId,requested:autoRequestMode?true:te.requested,
            timing:tIdx===0?'parallel':te.timing,
            note:bc.note||''
          });
        });
      });
    });
    if(onSave)onSave({services:allServices,startHour:initialHour,startMin:initialMin});
  }
  function handleCancel(){
    // If still on search screen with no booking data, just close — no confirmation needed
    if(screen==='search'&&bookingClients.length===0){if(onCancel)onCancel();return;}
    setShowCancelConfirm(true);
  }
  function confirmCancel(){setShowCancelConfirm(false);if(onCancel)onCancel();}
  // ══════════════════════════════════════
  // ── DERIVED ──
  // ══════════════════════════════════════
  const filtered=useMemo(()=>{let r=CLIENTS;if(phoneDigits)r=r.filter(c=>phoneToDigits(c.phone).includes(phoneDigits));if(nameQuery.trim()){const q=nameQuery.toLowerCase();r=r.filter(c=>`${c.first_name} ${c.last_name}`.toLowerCase().includes(q));}return r;},[phoneDigits,nameQuery]);
  const noMatch=phoneDigits.length>=3&&filtered.length===0;
  // Service IDs for current active tech (for grid highlighting)
  const activeTechEntry=getActiveTech();
  const selIds=activeTechEntry?activeTechEntry.services.map(s=>s.id):[];
  // Totals
  const subtotal=useMemo(()=>{
    let s=0;bookingClients.forEach(bc=>bc.techs.forEach(t=>t.services.forEach(sv=>{s+=(sv.price||0);})));return s;
  },[bookingClients]);
  const taxAmount=Math.round(subtotal*TAX_RATE/100);
  const total=subtotal+taxAmount;
  const totalDur=useMemo(()=>{
    let d=0;bookingClients.forEach(bc=>bc.techs.forEach(t=>{t.services.forEach(sv=>{d+=sv.dur;});d+=(t.extraTime||0);}));return d;
  },[bookingClients]);
  const svcCount=totalServiceCount();
  // Can add tech? Current client must have < 2 techs
  const canAddTech=bookingClients[activeClientIdx]?bookingClients[activeClientIdx].techs.length<2:false;
  // Phone pad
  function padTap(d){if(phoneDigits.length>=10)return;setPhoneDigits(prev=>prev+d);}
  function padDel(){setPhoneDigits(prev=>prev.slice(0,-1));}
  function padClr(){setPhoneDigits('');}
  const numPad=(label)=>(
    <div style={{width:260,display:'flex',flexDirection:'column',padding:'12px',flexShrink:0,borderLeft:`1px solid ${C.borderLight}`,background:'#0B1120'}}>
      <div style={{fontSize:11,color:C.textPrimary,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:6}}>{label}</div>
      <div style={{background:phoneDigits.length===10?'rgba(5,150,105,0.15)':'#1A2340',borderRadius:6,padding:'8px 12px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,border:phoneDigits.length===10?'1px solid rgba(5,150,105,0.3)':'1px solid #1E2D45'}}>
        <span style={{color:phoneDigits?C.textPrimary:C.textMuted,fontSize:20,fontWeight:500,fontVariantNumeric:'tabular-nums',letterSpacing:0.5}}>{phoneDigits?fp(phoneDigits):'(___) ___-____'}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
        {['7','8','9','4','5','6','1','2','3'].map(d=>(<div key={d} onClick={()=>padTap(d)} style={{background:'#1A2340',border:'1px solid #1E2D45',borderRadius:6,color:'#F1F5F9',fontSize:23,fontWeight:500,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',height:57,userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#213055'} onMouseLeave={e=>e.currentTarget.style.background='#1A2340'}>{d}</div>))}
        <div onClick={padClr} style={{background:'#334155',border:'1px solid #475569',borderRadius:6,color:C.warning,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',height:57,userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#475569'} onMouseLeave={e=>e.currentTarget.style.background='#334155'}>Clear</div>
        <div onClick={()=>padTap('0')} style={{background:'#1A2340',border:'1px solid #1E2D45',borderRadius:6,color:'#F1F5F9',fontSize:23,fontWeight:500,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',height:57,userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#213055'} onMouseLeave={e=>e.currentTarget.style.background='#1A2340'}>0</div>
        <div onClick={padDel} style={{background:'#334155',border:'1px solid #475569',borderRadius:6,color:C.danger,fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',height:57,userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#475569'} onMouseLeave={e=>e.currentTarget.style.background='#334155'}>⌫</div>
      </div>
    </div>
  );

  // Keyboard hook for phone number entry on client search screen
  // Disabled when user is focused on a text input (new client name/email fields)
  useEffect(function() {
    if (screen !== 'search') return;
    function onKey(e) {
      var tag = document.activeElement && document.activeElement.tagName;
      var inputType = document.activeElement && document.activeElement.type;
      // If focus is on any text/email input, let that input handle keystrokes
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); padTap(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); padDel(); return; }
      if (e.key === 'Delete') { e.preventDefault(); padClr(); return; }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [screen, phoneDigits]);
  // Client name helper
  function clientLabel(bc,cIdx){
    var name=bc.client?`${bc.client.first_name} ${bc.client.last_name}`:'Walk-in';
    if(cIdx>0){
      var firstBc=bookingClients[0];
      var firstName=firstBc&&firstBc.client?`${firstBc.client.first_name} ${firstBc.client.last_name}`:'Walk-in';
      // If we collected a name for this client, show it: "Baby Phat with Maria V."
      if(bc.client&&bc.client.first_name){
        return `${name} with ${firstName}`;
      }
      return `with ${firstName}`;
    }
    return name;
  }
  // ══════════════════════════════════════
  // ── RENDER ──
  // ══════════════════════════════════════
  return(
    <div style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',background:'#2D3D50'}}>
      {/* ═══════════ INITIAL CLIENT SEARCH ═══════════ */}
      {screen==='search'&&(
        <div style={{...wrap, position:'absolute', top:0, left:0, right:0, bottom:'45%', borderRadius:'0 0 12px 12px', overflow:'hidden'}}>
          <div style={{height:52,background:'#283848',display:'flex',alignItems:'center',padding:'0 20px',gap:12,borderBottom:`1px solid ${C.borderMedium}`,flexShrink:0}}>
            <button onClick={handleCancel} style={{...BS,height:36,padding:'0 14px',fontSize:13,color:C.danger,borderColor:C.danger}}>Cancel</button>
            <span style={{color:C.textPrimary,fontSize:16,fontWeight:500}}>Select client</span>
            <span style={{color:C.textPrimary,fontSize:13}}>for {initTech?.display_name} at {ft(initialHour,initialMin)}</span>
          </div>
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0}}>
                <input value={nameQuery} onChange={e=>setNameQuery(autoCap(e.target.value))} placeholder="Search by name..." type="text" inputMode="text" autoComplete="off" autoCapitalize="words" style={{...INP,height:38}}/>
                <div style={{display:'flex',gap:6}}>
                <button onClick={skipWalkIn} style={{flex:1,marginTop:8,height:40,background:'rgba(217,119,6,0.12)',border:`1px dashed ${C.warning}`,borderRadius:6,color:C.warning,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(217,119,6,0.2)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(217,119,6,0.12)';}}>Walk-in</button>
                <div onClick={function(){setShowBlockTime(true);}} style={{flex:1,marginTop:8,height:40,background:'rgba(245,158,11,0.12)',border:'1px dashed #F59E0B',borderRadius:6,color:'#F59E0B',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                  onMouseEnter={function(e){e.currentTarget.style.background='rgba(245,158,11,0.25)';}}
                  onMouseLeave={function(e){e.currentTarget.style.background='rgba(245,158,11,0.12)';}}>Reserve</div>
                <div onClick={function(){setShowBlockTime('block');setBlockFrom(String(initialHour*60+initialMin));}} style={{flex:1,marginTop:8,height:40,background:'rgba(239,68,68,0.12)',border:'1px dashed #EF4444',borderRadius:6,color:'#EF4444',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                  onMouseEnter={function(e){e.currentTarget.style.background='rgba(239,68,68,0.25)';}}
                  onMouseLeave={function(e){e.currentTarget.style.background='rgba(239,68,68,0.12)';}}>Block</div>
                </div>
              </div>
              <div style={{flex:1,overflow:'auto',padding:'0 8px 8px'}}>
                {filtered.length>0&&<div style={{padding:'6px 8px',fontSize:12,color:C.textPrimary}}>{filtered.length} client{filtered.length!==1?'s':''}</div>}
                {filtered.map((c,i)=>(
                  <div key={c.id} onClick={()=>selectClient(c)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:6,cursor:'pointer',background:C.grid,border:`1px solid ${C.borderMedium}`,marginTop:4}}>
                    <Av name={`${c.first_name} ${c.last_name}`} size={32} i={i}/>
                    <div style={{flex:1}}><div style={{color:C.textPrimary,fontSize:13,fontWeight:500}}>{c.first_name} {c.last_name}</div></div>
                    <div style={{color:C.textPrimary,fontSize:12,fontVariantNumeric:'tabular-nums'}}>{fp(c.phone)}</div>
                  </div>
                ))}
                {noMatch&&(
                  <div style={{padding:'16px 8px'}}>
                    {!showNewForm&&(
                      <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'14px 16px',marginBottom:12}}>
                        <div style={{fontSize:14,fontWeight:500,color:'#FCA5A5',marginBottom:4}}>Client not found</div>
                        <div style={{fontSize:13,color:C.textPrimary}}>
                          {phoneDigits.length===10
                            ?<>No client matches <span style={{color:C.blueLight,fontWeight:500}}>{fp(phoneDigits)}</span></>
                            :<>Enter a full 10-digit phone number to search or add a new client</>}
                        </div>
                      </div>
                    )}
                    {phoneDigits.length===10&&!showNewForm&&(
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={function(){setShowNewForm(true);}} style={{...BP,flex:1,height:40,fontSize:13}}>Add New Client</button>
                        <button onClick={()=>{padClr();setShowNewForm(false);}} style={{...BS,flex:1,height:40,fontSize:13}}>Try Different Number</button>
                      </div>
                    )}
                    {showNewForm&&(
                      <NewClientForm
                        phoneDigits={phoneDigits} fp={fp}
                        newFirst={newFirst} setNewFirst={setNewFirst}
                        newLast={newLast} setNewLast={setNewLast}
                        newEmail={newEmail} setNewEmail={setNewEmail}
                        saveNewClient={saveNewClient}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            {numPad('Phone lookup')}
          </div>
        </div>
      )}
      {/* ═══════════ CLIENT NAME (Group Booking — 2nd client+) ═══════════ */}
      {screen==='clientName'&&(
        <ClientNameScreen
          clientNameInput={clientNameInput}
          setClientNameInput={setClientNameInput}
          confirmClientName={confirmClientName}
          setScreen={setScreen}
          setPickerMode={setPickerMode}
          setPendingClient={setPendingClient}
        />
      )}
      {/* ═══════════ SERVICE SELECTION + TICKET ═══════════ */}
      {screen==='services'&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:260,background:C.chrome,fontFamily:F,display:'flex',flexDirection:'column'}}>
          {/* Top bar */}
          <div style={{height:52,background:'#283848',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 16px',gap:8,borderBottom:`1px solid ${C.borderMedium}`,flexShrink:0}}>
            <button onClick={startAddClient}
              style={{height:36,padding:'0 16px',background:'#0E3D3D',color:'#5EEAD4',border:'1px solid #1A5C5C',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,transition:'background 150ms'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#174F4F';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#0E3D3D';}}>+ Add Client</button>
            {canAddTech?(
              <button onClick={startAddTech}
                style={{height:36,padding:'0 16px',background:'#1E2554',color:'#A5B4FC',border:'1px solid #2E3A7A',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,transition:'background 150ms'}}
                onMouseEnter={e=>{e.currentTarget.style.background='#263070';}}
                onMouseLeave={e=>{e.currentTarget.style.background='#1E2554';}}>+ Add Technician</button>
            ):(
              <button disabled
                style={{height:36,padding:'0 16px',background:'#1E2554',color:'#A5B4FC',border:'1px solid #2E3A7A',borderRadius:6,fontSize:13,fontWeight:600,cursor:'not-allowed',fontFamily:F,opacity:0.3}}>+ Add Technician</button>
            )}
            <button onClick={()=>setShowTimePopup(true)}
              style={{height:36,padding:'0 16px',background:'#3D2608',color:'#FBB040',border:'1px solid #5C3A10',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,transition:'background 150ms'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#4F3010';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#3D2608';}}>+ Add More Time</button>
            <button onClick={()=>{var bc=bookingClients[activeClientIdx];setNoteDraft(bc?bc.note||'':'');setShowNotePopup(activeClientIdx);}}
              style={{height:36,padding:'0 16px',background:'#0E2E1E',color:'#6EE7B7',border:'1px solid #1A4A30',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:F,transition:'background 150ms'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#163D28';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#0E2E1E';}}>{bookingClients[activeClientIdx]&&bookingClients[activeClientIdx].note?'✏ Edit Note':'+ Add Note'}</button>
          </div>
          {/* Body */}
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            {/* ═══ LEFT TICKET ═══ */}
            <BookingTicketPanel
              C={C} staff={staff} bookingClients={bookingClients} setBookingClients={setBookingClients}
              activeTechKey={activeTechKey} activeClientIdx={activeClientIdx}
              setActivePointer={setActivePointer} removeService={removeService}
              toggleRequested={toggleRequested} clientLabel={clientLabel}
              salonSettings={salonSettings} autoRequestMode={autoRequestMode}
              initialHour={initialHour} initialMin={initialMin} totalDur={totalDur}
              subtotal={subtotal} taxAmount={taxAmount} total={total} svcCount={svcCount}
              handleCancel={handleCancel} handleSave={handleSave}
              setNoteDraft={setNoteDraft} setShowNotePopup={setShowNotePopup} F={F}
            />
            {/* ═══ RIGHT CATALOG ═══ */}
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:12,gap:12}}>
              <div style={{flex:1,display:'flex',overflow:'hidden',gap:12}}>
                <div style={{width:200,minWidth:200,overflow:'auto',padding:10,display:'flex',flexDirection:'column',border:`1px solid ${C.borderMedium}`,borderRadius:8,background:C.chrome,flexShrink:0}}>
                  <CategoryGrid categories={CATEGORIES} activeCat={activeCat} onSelect={setActiveCat} catSlots={catSlots} catColumns={1} layout="grid" mode="view"/>
                </div>
                <div style={{flex:1,overflow:'auto',padding:14,border:`1px solid ${C.borderMedium}`,borderRadius:8,background:C.chrome,display:'flex',flexDirection:'column'}}>
                  <ServiceGrid services={SERVICES_RAW} activeCat={activeCat} svcSlots={svcSlots} svcColumns={svcColumns} svcRows={svcRows} mode="multi" onTap={toggleService} selectedIds={selIds} showTime={!salonSettings || salonSettings.show_service_time !== false} showProductCost={!salonSettings || salonSettings.show_product_deduction !== false}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ TECH PICKER (full screen) ═══════════ */}
      {screen==='techPicker'&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:270,background:'#0B1120',fontFamily:F,display:'flex',flexDirection:'column'}}>
          <div style={{height:52,background:'#131B2E',display:'flex',alignItems:'center',padding:'0 20px',gap:12,borderBottom:'1px solid #1E2D45',flexShrink:0}}>
            <div onClick={handleTechPickerBack} style={{height:36,padding:'0 14px',fontSize:13,background:'transparent',border:'1px solid #1E2D45',borderRadius:6,color:'#F1F5F9',cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',userSelect:'none'}}
              onMouseEnter={function(e){e.currentTarget.style.borderColor='#F1F5F9';}} onMouseLeave={function(e){e.currentTarget.style.borderColor='#1E2D45';}}>Back</div>
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <span style={{color:'#F1F5F9',fontSize:16,fontWeight:500}}>Select Technician</span>
              {pickerMode==='addClientTech'&&<span style={{color:C.warning,fontSize:16,fontWeight:500}}>for next client</span>}
            </div>
            <div style={{width:70}}/>
          </div>
          <div style={{flex:1,overflow:'auto',padding:32,display:'flex',justifyContent:'center',alignItems:'flex-start'}}>
            {(function(){
              var visibleStaff=sortedStaff.filter(function(tech){if(pickerMode==='addTech'){var bc=bookingClients[activeClientIdx];if(bc&&bc.techs.some(function(t){return t.techId===tech.id;}))return false;}return true;});
              var count=visibleStaff.length;var cols=4;var maxRows=4;while(Math.ceil(count/cols)>maxRows&&cols<8){cols++;}
              return(
              <div style={{display:'grid',gridTemplateColumns:'repeat('+cols+',1fr)',gap:20,maxWidth:cols*164,width:'100%'}}>
                {visibleStaff.map(function(tech,i){
                  var turnEntry=techTurn.find(function(t){return t.id===tech.id;});var isBusy=turnEntry&&(turnEntry.status==='busy'||turnEntry.status==='break');var color=AVATAR_COLORS[sortedStaff.indexOf(tech)%AVATAR_COLORS.length];
                  return(<div key={tech.id} onClick={function(){handleTechPickerSelect(tech);}}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'20px 8px',background:'#1A2340',border:'1px solid #1E2D45',borderRadius:12,cursor:isBusy?'default':'pointer',userSelect:'none',opacity:isBusy?0.35:1,transition:'all 150ms'}}
                    onMouseEnter={function(e){if(!isBusy){e.currentTarget.style.background='#213055';e.currentTarget.style.borderColor=color;e.currentTarget.style.transform='translateY(-2px)';}}}
                    onMouseLeave={function(e){if(!isBusy){e.currentTarget.style.background='#1A2340';e.currentTarget.style.borderColor='#1E2D45';e.currentTarget.style.transform='translateY(0)';}}}>
                    <div style={{width:64,height:64,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:600,color:'#fff'}}>
                      {tech.photo_url?<img src={tech.photo_url} alt={tech.display_name} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover'}}/>:getInitials(tech.display_name)}</div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:600,color:'#F1F5F9'}}>{tech.display_name}</div>
                      {isBusy?<div style={{color:'#64748B',fontSize:11,marginTop:2}}>{turnEntry&&turnEntry.status==='break'?'On break':'Busy'}</div>
                      :turnEntry&&turnEntry.position?<div style={{color:'#5EEAD4',fontSize:11,marginTop:2,fontWeight:500}}>Turn #{turnEntry.position}</div>
                      :null}</div>
                  </div>);
                })}
              </div>);
            })()}
          </div>
        </div>
      )}
      {/* ═══════════ TIMING POPUP (same time / after) ═══════════ */}
      {screen==='timingPopup'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'18vh',zIndex:300}}>
          <div style={{background:C.chrome,borderRadius:12,padding:28,maxWidth:420,width:'90%',border:`1px solid ${C.borderMedium}`}}>
            <div style={{color:C.textPrimary,fontSize:16,fontWeight:600,marginBottom:6}}>How should {pendingTech?.display_name} be scheduled?</div>
            <div style={{color:C.textPrimary,fontSize:13,marginBottom:20,lineHeight:1.5}}>Choose whether {pendingTech?.display_name} works at the same time or after {getFirstTech(activeClientIdx)?.techName}.</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>finishAddTech('parallel')} style={{flex:1,height:52,background:C.blueTint,border:`2px solid ${C.blue}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:F,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}
                onMouseEnter={e=>e.currentTarget.style.background=C.accentBg} onMouseLeave={e=>e.currentTarget.style.background=C.blueTint}>
                <span>Same time</span><span style={{fontSize:10,color:C.blueLight,fontWeight:400}}>Both techs start together</span></button>
              <button onClick={()=>finishAddTech('sequential')} style={{flex:1,height:52,background:'rgba(217,119,6,0.1)',border:`2px solid ${C.warning}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:F,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(217,119,6,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(217,119,6,0.1)'}>
                <span>After {getFirstTech(activeClientIdx)?.techName}</span><span style={{fontSize:10,color:C.warning,fontWeight:400}}>Starts when first tech finishes</span></button>
            </div>
            <button onClick={()=>{setPendingTech(null);setScreen('services');}} style={{width:'100%',marginTop:12,height:36,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:F}}>Cancel</button>
          </div>
        </div>
      )}
      {/* ═══════════ ADD MORE TIME POPUP ═══════════ */}
      {showTimePopup&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'18vh',zIndex:300}}>
          <div style={{background:C.chrome,borderRadius:12,padding:28,maxWidth:420,width:'90%',border:`1px solid ${C.borderMedium}`}}>
            <div style={{color:C.textPrimary,fontSize:16,fontWeight:600,marginBottom:6}}>Add extra time for {activeTechEntry?.techName}</div>
            <div style={{color:C.textPrimary,fontSize:13,marginBottom:20,lineHeight:1.5}}>Extra time will be added after {activeTechEntry?.techName}'s last service.{(activeTechEntry?.extraTime||0)>0?' Tap the same value to remove it.':''}</div>
            <div style={{display:'flex',gap:8}}>
              {[15,30,45,60].map(mins=>{const isSelected=(activeTechEntry?.extraTime||0)===mins;return(
                <button key={mins} onClick={()=>setExtraTimeForActiveTech(mins)} style={{flex:1,height:52,background:isSelected?C.blueTint:'transparent',border:isSelected?`2px solid ${C.blue}`:`2px solid ${C.borderMedium}`,borderRadius:8,color:C.textPrimary,fontSize:16,fontWeight:600,cursor:'pointer',fontFamily:F}}
                  onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background=C.gridHover;}} onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background=isSelected?C.blueTint:'transparent';}}>+{mins}<div style={{position:'relative',fontSize:10,fontWeight:400,color:C.textPrimary,marginTop:2}}>
        <AreaTag id="BOOK" />min</div></button>);})}
            </div>
            <button onClick={()=>setShowTimePopup(false)} style={{width:'100%',marginTop:12,height:36,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:F}}>Close</button>
          </div>
        </div>
      )}
      {/* ═══════════ MODALS (Note, Cancel, Block Time, Balance Alert) ═══════════ */}
      <BookingFlowModals
        showNotePopup={showNotePopup}
        setShowNotePopup={setShowNotePopup}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        bookingClients={bookingClients}
        setBookingClients={setBookingClients}
        clientLabel={clientLabel}
        showCancelConfirm={showCancelConfirm}
        setShowCancelConfirm={setShowCancelConfirm}
        confirmCancel={confirmCancel}
        showBlockTime={showBlockTime}
        setShowBlockTime={setShowBlockTime}
        blockFrom={blockFrom}
        setBlockFrom={setBlockFrom}
        blockTo={blockTo}
        setBlockTo={setBlockTo}
        handleBlockConfirm={handleBlockConfirm}
        handleBlockTime={handleBlockTime}
        salonSettings={salonSettings}
        initialHour={initialHour}
        initialMin={initialMin}
        initTech={initTech}
        balanceAlert={balanceAlert}
        setBalanceAlert={setBalanceAlert}
        setPendingClient={setPendingClient}
        confirmBalance={confirmBalance}
        handleAddClientBalance={handleAddClientBalance}
        screen={screen}
      />
    </div>
  );
}
