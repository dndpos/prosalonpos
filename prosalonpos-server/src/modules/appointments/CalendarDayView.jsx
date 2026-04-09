import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Calendar Day View
 * Module 1: Main calendar screen with tech columns, time grid, drag-drop.
 * Extracted: mock data → calendarMockData.js, Avatar/MiniMonth → CalendarComponents.jsx,
 *   MovePopup → MovePopup.jsx, block rendering → AppointmentBlocks.jsx,
 *   drag-drop logic → useCalendarDrag.js
 * Session 35: RBAC wiring for calendar actions.
 * Session 47: Drag logic extracted to useCalendarDrag hook.
 * Session 48: Wired to appointmentStore — service lines come from API/mock store.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import AppointmentDetailPopup from './AppointmentDetailPopup';
import BookingFlow from './BookingFlow';
import ActivityLogPopup from './ActivityLogPopup';
import WaitlistPanel from './WaitlistPanel';
import TechTurnList from './TechTurnList';
import MovePopup from './MovePopup';
import AppointmentBlocks from './AppointmentBlocks';
import { Avatar, MiniMonth } from './CalendarComponents';
import { today, timeToMinutes, minutesToTime, formatHour, formatMinLabel, formatTimeFull, snapTo15, getGroup, ROW_H, TIME_COL_W, LEFT_PANEL_W, COL_MAX_W, COL_MIN_W } from '../../lib/calendarHelpers';
import { SETTINGS } from './calendarBridge';
import { useAppointmentStore } from '../../lib/stores/appointmentStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import * as TurnEngine from '../../lib/techTurnEngine';
import { registerHandlers as registerTurnBus } from '../../lib/techTurnBus';
import { useRBAC } from '../../lib/RBACContext';
import { useToast } from '../../lib/ToastContext';
import { ACTIONS } from '../../lib/rbac';
import useCalendarDrag from './useCalendarDrag';
import useCalendarPersist from './useCalendarPersist';
import useCalendarHandlers from './useCalendarHandlers';
import CalendarOverlays from './CalendarOverlays';
import StaticGridLines from './StaticGridLines';
import DateStatusDot from './DateStatusDot';
import AreaTag from '../../components/ui/AreaTag';
export default function CalendarDayView({ scrollTarget, onScrollDone, onCheckout, catalogLayout, salonSettings, onNavClick, onOwnerClick, unviewedCount, openTicketCount, drawerSession, onCashierClick, hasHourlyStaff, onTimeClockClick, clockPunches, presenceRecords, onClockPunch, onPresencePunch }){
  var C = useTheme();
  var rbac = useRBAC();
  var toast = useToast();
  var _settings = salonSettings || {};

  var _storeStaff = useStaffStore(function(s) { return s.staff; });
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const[selectedDate,setSelectedDate]=useState(today);
  var _clockedInIds = useMemo(function() {
    var punches = clockPunches || []; var last = {};
    punches.forEach(function(p) {
      var ts = typeof p.timestamp === 'number' ? p.timestamp : new Date(p.timestamp).getTime();
      if (!last[p.staff_id] || ts > last[p.staff_id].ts) last[p.staff_id] = { ts: ts, type: p.type };
    });
    var ids = {};
    Object.keys(last).forEach(function(sid) { if (last[sid].type === 'in') ids[sid] = true; });
    // Presence records: one per staff, status is current state — no date filter needed.
    // If status is 'in', the person is signed in until they sign out.
    (presenceRecords || []).forEach(function(r) {
      if (r.status === 'in') ids[r.staff_id] = true;
      else if (r.status === 'out') delete ids[r.staff_id];
    });
    return ids;
  }, [clockPunches, presenceRecords, selectedDate]);

  var STAFF = useMemo(function() {
    var dayKey = DAY_KEYS[selectedDate.getDay()];
    return (_storeStaff || [])
      .filter(function(s) {
        if (s.status !== 'active' || s.show_on_calendar === false) return false;
        if (_clockedInIds[s.id]) return true;
        if (s.schedule && s.schedule[dayKey] && s.schedule[dayKey].enabled === false) return false;
        return true;
      })
      .map(function(s) { return { id: s.id, display_name: s.display_name, photo_url: s.photo_url || null }; })
      .sort(function(a, b) { return (a.display_name || '').localeCompare(b.display_name || ''); });
  }, [_storeStaff, selectedDate, _clockedInIds]);
  const[activeTab,setActiveTab]=useState('waitlist');
  const[visibleCols,setVisibleCols]=useState(Math.max(8, STAFF.length));
  const[now,setNow]=useState(new Date());
  const gridRef=useRef(null);
  const timeColRef=useRef(null);
  const headerRef=useRef(null);
  const gridContainerRef=useRef(null);
  const[gridWidth,setGridWidth]=useState(0);
  // Staff column order — owner can drag-reorder, persisted to localStorage
  const[staffOrder,setStaffOrder]=useState(function(){
    try{var saved=localStorage.getItem('prosalonpos_staff_order');if(saved){var ids=JSON.parse(saved);if(Array.isArray(ids)&&ids.length)return ids;}}catch(e){}
    return STAFF.map(function(s){return s.id;});
  });

  // ── Re-sync when STAFF loads from API or sign-in changes ──
  useEffect(function() {
    if (STAFF.length > 0) {
      setVisibleCols(function(prev) { return prev === 0 ? STAFF.length : Math.max(prev, STAFF.length); });
      setStaffOrder(function(prev) {
        if (prev.length === 0) return STAFF.map(function(s) { return s.id; });
        var newIds = STAFF.filter(function(s) { return !prev.includes(s.id); }).map(function(s) { return s.id; });
        if (newIds.length === 0) return prev;
        var byId={}; STAFF.forEach(function(s){byId[s.id]=s;}); var merged=prev.slice();
        newIds.forEach(function(nid){var nN=(byId[nid]&&byId[nid].display_name||'').toLowerCase();var idx=merged.findIndex(function(eid){return(byId[eid]&&byId[eid].display_name||'').toLowerCase()>nN;});if(idx>=0)merged.splice(idx,0,nid);else merged.push(nid);});
        return merged;
      });
    }
  }, [STAFF]);
  const[colDrag,setColDrag]=useState(null);
  const orderedStaff=useMemo(function(){
    var byId={};STAFF.forEach(function(s){byId[s.id]=s;});
    var result=staffOrder.map(function(id){return byId[id];}).filter(Boolean);
    // Insert any staff not yet in staffOrder alphabetically (instead of appending to end)
    STAFF.forEach(function(s){
      if(!staffOrder.includes(s.id)){
        var nN=(s.display_name||'').toLowerCase();
        var idx=result.findIndex(function(r){return(r.display_name||'').toLowerCase()>nN;});
        if(idx>=0)result.splice(idx,0,s);else result.push(s);
      }
    });
    return result;
  },[staffOrder, STAFF]);
  // ── Service lines from appointment store ──
  var storeServiceLines = useAppointmentStore(function(s){ return s.serviceLines; });
  var storeInitialized = useAppointmentStore(function(s){ return s.initialized; });
  var fetchServiceLines = useAppointmentStore(function(s){ return s.fetchServiceLines; }); var persist = useCalendarPersist(toast);
  var _fetchRef = useRef(fetchServiceLines);
  _fetchRef.current = fetchServiceLines;
  const[serviceLines,setServiceLines]=useState(storeServiceLines);
  // Optimistic lock: when local state is updated by user action (drag, status change),
  // suppress store→local sync for 2s to prevent socket-triggered refetch from
  // causing a re-render flash. The lock ref is set by setServiceLinesLocal.
  var _optimisticLock = useRef(0);
  var setServiceLinesLocal = function(updater) {
    _optimisticLock.current = Date.now() + 2000;
    setServiceLines(updater);
  };
  // Sync from store → local state (suppressed during optimistic window)
  useEffect(function(){
    if (Date.now() < _optimisticLock.current) return;
    setServiceLines(storeServiceLines);
  },[storeServiceLines]);
  // Fetch service lines when date changes (only selectedDate triggers this)
  useEffect(function(){
    var d = selectedDate;
    var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    _fetchRef.current(dateStr);
  },[selectedDate]);

  const[waitlist,setWaitlist]=useState([]);
  const _initTechs=useMemo(function(){
    var busyIds={};
    storeServiceLines.forEach(function(sl){ if(sl.status==='in_progress') busyIds[sl.staff_id]=true; });
    var eligible = STAFF.filter(function(t) { return _clockedInIds[t.id] || busyIds[t.id]; });
    var pos=1;
    return eligible.map(function(t,i){
      var isBusy=!!busyIds[t.id];
      return{id:t.id,name:t.display_name||t.name||'',photo_url:t.photo_url||null,status:isBusy?'busy':'available',position:isBusy?null:pos++,clockedInAt:Date.now()+i,dailyServiceCount:0,preservedPosition:null,lastFreeAt:Date.now()+i};
    });
  },[storeServiceLines, _clockedInIds, STAFF]);
  const[turnState,setTurnState]=useState({techs:_initTechs,turnLog:[]});
  useEffect(function() {
    setTurnState(function(prev) {
      var s = prev;
      var ids = {}; prev.techs.forEach(function(t) { ids[t.id] = t.status; });
      var busyIds = {}; storeServiceLines.forEach(function(sl) { if (sl.status === 'in_progress') busyIds[sl.staff_id] = true; });
      Object.keys(_clockedInIds).forEach(function(sid) {
        if (!ids[sid] || ids[sid] === 'off') {
          var st = STAFF.find(function(x) { return x.id === sid; });
          if (st) s = TurnEngine.clockIn(s, sid, st.display_name || st.name || '').state;
        }
      });
      // Clock out techs no longer punched in (unless busy with service)
      // Also remove techs not in STAFF (e.g. show_on_calendar toggled off)
      var staffIds = {}; STAFF.forEach(function(x) { staffIds[x.id] = true; });
      prev.techs.forEach(function(t) {
        if (t.status !== 'off' && (!_clockedInIds[t.id] || !staffIds[t.id]) && !busyIds[t.id]) {
          s = TurnEngine.clockOut(s, t.id).state;
        }
      });
      return s;
    });
  }, [_clockedInIds, STAFF, storeServiceLines]);
  // Derive flat techTurn array with mode-aware positions for UI
  const techTurn=useMemo(function(){
    var sorted=TurnEngine.getAvailableQueue(turnState,_settings);
    var busy=TurnEngine.getBusyTechs(turnState);
    var onBreak=TurnEngine.getBreakTechs(turnState);
    // Assign sequential positions to sorted available techs
    var result=sorted.map(function(t,i){return Object.assign({},t,{position:i+1});});
    return result.concat(busy.map(function(t){return Object.assign({},t,{position:null});}))
      .concat(onBreak.map(function(t){return Object.assign({},t,{position:null});}));
  },[turnState, _settings]);
  const[activityLog,setActivityLog]=useState([]);
  const[showLogPopup,setShowLogPopup]=useState(false);

  const[vipCheckInAlert,setVipCheckInAlert]=useState(null);
  const[selectedAppt,setSelectedAppt]=useState(null);
  const[bookingCtx,setBookingCtx]=useState(null);
  const[bookingConfirm,setBookingConfirm]=useState(null);
  const[blockedTimes,setBlockedTimes]=useState([]);
  // ── Copy/paste clipboard ──
  const[copiedAppt,setCopiedAppt]=useState(null); // {client, client_id, service, dur, color, price_cents, open_price}
  const[ctxMenu,setCtxMenu]=useState(null); // {x, y, type:'copy'|'paste', sl, staffId, startMin}
  const[selectedBlock,setSelectedBlock]=useState(null);

  useEffect(()=>{const iv=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(iv);},[]);

  // Register tech turn bus handlers for ticket close
  useEffect(function(){
    registerTurnBus(
      function(staffIds){ // markAvailable
        staffIds.forEach(function(id){
          setTurnState(function(prev){ return TurnEngine.markAvailable(prev,id,_settings).state; });
        });
      },
      function(staffIds){ // markBusy
        staffIds.forEach(function(id){
          setTurnState(function(prev){ return TurnEngine.markBusy(prev,id).state; });
        });
      }
    );
  },[]);
  const gridStartMin=SETTINGS.open_hour*60+SETTINGS.open_min-SETTINGS.buffer_minutes;
  const gridEndMin=SETTINGS.close_hour*60+SETTINGS.close_min+SETTINGS.buffer_minutes;
  const totalRows=(gridEndMin-gridStartMin)/15;
  // Scroll to a specific service line (e.g. from online booking notification tap)
  useEffect(()=>{
    if(!scrollTarget)return;
    const sl=serviceLines.find(s=>s.id===scrollTarget);
    if(!sl){if(onScrollDone)onScrollDone();return;}
    const slMin=timeToMinutes(sl.starts_at);
    const blockY=((slMin-gridStartMin)/15)*ROW_H;
    setTimeout(()=>{
      if(gridRef.current){gridRef.current.scrollTop=Math.max(0,blockY-150);}
      setSelectedAppt(sl);
      if(onScrollDone)onScrollDone();
    },100);
  },[scrollTarget]);
  useEffect(()=>{
    if(!gridContainerRef.current)return;
    const measure=()=>{if(gridContainerRef.current)setGridWidth(gridContainerRef.current.getBoundingClientRect().width);};
    measure();
    const obs=new ResizeObserver(()=>measure());
    obs.observe(gridContainerRef.current);
    return()=>obs.disconnect();
  },[]);
  const visibleStaff=orderedStaff.slice(0,visibleCols);
  const requestedCounts=useMemo(()=>{
    const c={};serviceLines.forEach(sl=>{if(sl.requested)c[sl.staff_id]=(c[sl.staff_id]||0)+1;});return c;
  },[serviceLines]);
  const nowMin=timeToMinutes(now);
  const nowY=((nowMin-gridStartMin)/15)*ROW_H;
  const showNow=nowMin>=gridStartMin&&nowMin<=gridEndMin;
  useEffect(()=>{if(gridRef.current&&showNow){gridRef.current.scrollTop=Math.max(0,nowY-200);}},[]);
  // Scroll sync: grid → time column (vertical) + header (horizontal)
  useEffect(()=>{
    const grid=gridRef.current;if(!grid)return;
    function syncScroll(){
      if(timeColRef.current&&timeColRef.current.firstChild)timeColRef.current.firstChild.style.transform='translateY('+(-grid.scrollTop)+'px)';
      if(headerRef.current)headerRef.current.scrollLeft=grid.scrollLeft;
    }
    grid.addEventListener('scroll',syncScroll,{passive:true});
    return()=>grid.removeEventListener('scroll',syncScroll);
  },[]);
  function shiftDate(days){const d=new Date(selectedDate);d.setDate(d.getDate()+days);setSelectedDate(d);}
  const dayShort=selectedDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const colAreaW=gridWidth-TIME_COL_W;
  const rawColW=visibleCols>0?colAreaW/visibleCols:0;
  const colW=Math.min(COL_MAX_W, Math.max(COL_MIN_W, rawColW));
  const totalGridW=colW*visibleCols;
  const needsScroll=totalGridW>colAreaW;
  function colLeftPx(i){return i*colW;}

  // ── Blocked time check (used by drag hook + booking save) ──
  function isBlockedSlot(techId,startMin,endMin){
    return blockedTimes.some(function(b){return b.staff_id===techId&&startMin<b.endMin&&endMin>b.startMin;});
  }

  // ── Drag-and-Drop (extracted to useCalendarDrag hook — Session 47) ──
  var drag=useCalendarDrag({
    serviceLines, setServiceLines: setServiceLinesLocal,
    gridRef, gridContainerRef, headerRef,
    gridStartMin, colW, visibleStaff,
    setSelectedAppt, setActivityLog,
    blockedTimes, isBlockedSlot,
    setBookingCtx,
    STAFF, persist,
  });
  var dragging=drag.dragging;
  var dragPreview=drag.dragPreview;
  var handleBlockStart=drag.handleBlockStart;
  var handleSlotStart=drag.handleSlotStart;
  var handleSlotEnd=drag.handleSlotEnd;
  var confirmMove=drag.confirmMove;
  var cancelMove=drag.cancelMove;
  var confirmGroupMoveAll=drag.confirmGroupMoveAll;
  var confirmGroupMoveOne=drag.confirmGroupMoveOne;
  var cancelGroupMove=drag.cancelGroupMove;
  var pendingMove=drag.pendingMove;
  var pendingGroupMove=drag.pendingGroupMove;

  // ── Move popup ──
  let popupProps=null;
  if(pendingMove){
    const{sl,newStaffId,newStartMin}=pendingMove;
    const newStaff=STAFF.find(s=>s.id===newStaffId);
    const oldStaff=STAFF.find(s=>s.id===sl.staff_id);
    popupProps={sl,newStaffName:newStaff?.display_name||'Unknown',newTime:minutesToTime(newStartMin),oldStaffName:oldStaff?.display_name||'Unknown',isRequestedWarning:sl.requested&&newStaffId!==sl.staff_id,groupCount:getGroup(sl.id,serviceLines).length,onConfirm:confirmMove,onCancel:cancelMove};
  }

  // ── Handlers extracted to useCalendarHandlers (Session V18) ──
  var handlers = useCalendarHandlers({
    rbac: rbac, toast: toast, STAFF: STAFF, persist: persist, _settings: _settings,
    serviceLines: serviceLines, setServiceLines: setServiceLinesLocal,
    setActivityLog: setActivityLog, setTurnState: setTurnState,
    setSelectedAppt: setSelectedAppt, setBookingCtx: setBookingCtx,
    setBookingConfirm: setBookingConfirm, setBlockedTimes: setBlockedTimes,
    setWaitlist: setWaitlist, setVipCheckInAlert: setVipCheckInAlert,
    copiedAppt: copiedAppt, setCopiedAppt: setCopiedAppt, setCtxMenu: setCtxMenu,
    gridRef: gridRef, visibleStaff: visibleStaff, colW: colW,
    gridStartMin: gridStartMin, gridEndMin: gridEndMin,
    turnState: turnState, blockedTimes: blockedTimes, isBlockedSlot: isBlockedSlot,
    ROW_H: ROW_H, onClockPunch: onClockPunch, onPresencePunch: onPresencePunch,
    _clockedInIds: _clockedInIds,
    fetchServiceLines: fetchServiceLines, selectedDate: selectedDate,
    setServiceLinesDirect: setServiceLines,
  });
  var handleStatusChange = handlers.handleStatusChange;
  var handleChangeTech = handlers.handleChangeTech;
  var handleAddTime = handlers.handleAddTime;
  var handleAddService = handlers.handleAddService;
  var handleBookingSave = handlers.handleBookingSave;
  var handleBookingCancel = handlers.handleBookingCancel;
  var handleContextMenu = handlers.handleContextMenu;
  var handleCopyAppt = handlers.handleCopyAppt;
  var handlePasteAppt = handlers.handlePasteAppt;
  var handleWaitlistStart = handlers.handleWaitlistStart;
  var handleWaitlistRemove = handlers.handleWaitlistRemove;
  var handleCheckIn = handlers.handleCheckIn;
  var handleCheckInSave = handlers.handleCheckInSave;
  var handleTechBreak = handlers.handleTechBreak;
  var handleTechEndBreak = handlers.handleTechEndBreak;
  return(
    <div style={{width:'100%',height:'100%',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",display:'flex',flexDirection:'column',overflow:'hidden',userSelect:dragging?'none':'auto'}}>
      <style>{`@keyframes skeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } } @keyframes spinDate { to { transform: rotate(360deg); } }`}</style>
      {/* TOP BAR — Nav + Date Controls */}
      <div style={{height:52,background:C.chromeDark,display:'flex',alignItems:'center',padding:0,gap:6,borderBottom:`1px solid ${C.borderLight}`,flexShrink:0,overflowX:'auto',overflowY:'hidden',position:'relative'}}>
        <AreaTag id="CAL-TOP" />
        {/* Logo — fixed width matching left panel */}
        <div style={{width:LEFT_PANEL_W,minWidth:LEFT_PANEL_W,display:'flex',alignItems:'center',gap:8,padding:'0 16px',cursor:'default',userSelect:'none',borderRight:`1px solid ${C.borderLight}`,height:'100%',boxSizing:'border-box'}}>
          <div style={{width:28,height:28,borderRadius:6,background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>PS</div>
          <span style={{fontSize:14,fontWeight:600,color:C.textPrimary,whiteSpace:'nowrap'}}>Pro Salon POS</span>
        </div>
        {/* Owner tab — aligns with calendar grid */}
        {onOwnerClick && (
          <button onClick={onOwnerClick}
            style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',background:C.gridHover,color:C.text,marginLeft:6}}
            onMouseEnter={function(e){e.currentTarget.style.background='#7C3AED';e.currentTarget.style.borderColor='#7C3AED';e.currentTarget.style.color='#fff';}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.color=C.text;}}>
            Owner
          </button>
        )}
        {/* Nav tabs: Clients > Tickets > Checkout */}
        {onNavClick && [{id:'clients',label:'Clients',action:ACTIONS.VIEW_EDIT_CLIENTS},{id:'tickets',label:'View Tickets',badge:openTicketCount,badgeColor:'#D97706',action:ACTIONS.VIEW_TICKETS},{id:'checkout',label:'Checkout',action:ACTIONS.PROCESS_CHECKOUT}].map(function(item){
          return(
            <button key={item.id} onClick={function(){
              rbac.requirePermission(item.action, function(staff){
                onNavClick(item.id, staff);
              });
            }}
              style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',gap:5,background:C.gridHover,color:C.text,letterSpacing:'0.01em'}}
              onMouseEnter={function(e){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}
              onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}>
              {item.label}
              {item.badge>0&&(<span style={{display:'flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:9,background:item.badgeColor,color:'#fff',fontSize:10,fontWeight:700}}>{item.badge}</span>)}
            </button>
          );
        })}
        {/* Center — Date Navigation */}
        <div style={{flex:1}}/>
        <button onClick={()=>shiftDate(-1)} style={{background:'none',border:'none',color:C.textPrimary,fontSize:18,cursor:'pointer',padding:'4px 8px'}}>‹</button>
        <div style={{color:C.textPrimary,fontSize:15,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
          {dayShort}
          <DateStatusDot />
        </div>
        <button onClick={()=>shiftDate(1)} style={{background:'none',border:'none',color:C.textPrimary,fontSize:18,cursor:'pointer',padding:'4px 8px'}}>›</button>
        <button onClick={()=>setSelectedDate(new Date())}
          style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',background:C.gridHover,color:C.text}}
          onMouseEnter={function(e){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}
          onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}>
          Today
        </button>
        <div style={{flex:1}}/>
        {/* Right — Clock In/Out + Cashier + Online Bookings + Appointment Log + Column Count */}
        {onTimeClockClick && (
          <button onClick={function(){ onTimeClockClick(); }}
            style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',gap:5,background:C.gridHover,color:C.text}}
            onMouseEnter={function(e){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}>
            Clock In/Out
          </button>
        )}
        {_settings.cashier_enabled && onCashierClick && (
          <button onClick={function(){
            rbac.requirePermission(ACTIONS.CASHIER_DRAWER, function(staff){
              onCashierClick(staff);
            });
          }}
            style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+(drawerSession&&drawerSession.status==='open'?C.success:C.borderMedium),outline:'none',whiteSpace:'nowrap',gap:5,background:drawerSession&&drawerSession.status==='open'?'rgba(34,197,94,0.15)':C.gridHover,color:drawerSession&&drawerSession.status==='open'?C.success:C.text}}
            onMouseEnter={function(e){if(!(drawerSession&&drawerSession.status==='open')){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}}
            onMouseLeave={function(e){if(!(drawerSession&&drawerSession.status==='open')){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}}>
            {drawerSession&&drawerSession.status==='open'?'Cashier: '+drawerSession.cashier_name:'Cashier'}
          </button>
        )}
        {onNavClick && (
          <button onClick={function(){onNavClick('online-notifs');}}
            style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',gap:5,background:C.gridHover,color:C.text}}
            onMouseEnter={function(e){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}>
            Online Bookings
            {unviewedCount>0&&(<span style={{display:'flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:9,background:'#EF4444',color:'#fff',fontSize:10,fontWeight:700}}>{unviewedCount}</span>)}
          </button>
        )}
        <button onClick={()=>setShowLogPopup(true)}
          style={{display:'flex',alignItems:'center',justifyContent:'center',height:34,padding:'0 14px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid '+C.borderMedium,outline:'none',whiteSpace:'nowrap',gap:5,background:C.gridHover,color:C.text}}
          onMouseEnter={function(e){e.currentTarget.style.background=C.borderMedium;e.currentTarget.style.color='#FFFFFF';}}
          onMouseLeave={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.color=C.text;}}>
          Appointment Log
          {activityLog.length>0&&<span style={{display:'flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:9,background:C.blueLight,color:C.chromeDark,fontSize:10,fontWeight:700}}>{activityLog.length}</span>}
        </button>
        <div style={{width:1,height:28,background:C.borderMedium}}/>
        <button onClick={()=>setVisibleCols(Math.max(8,visibleCols-1))} style={{background:'none',border:`1px solid ${C.borderMedium}`,color:C.textPrimary,fontSize:16,cursor:'pointer',padding:'2px 10px',borderRadius:4}}>−</button>
        <span style={{color:C.textMuted,fontSize:12,minWidth:16,textAlign:'center'}}>{visibleCols}</span>
        <button onClick={()=>setVisibleCols(Math.min(STAFF.length,visibleCols+1))} style={{background:'none',border:`1px solid ${C.borderMedium}`,color:C.textPrimary,fontSize:16,cursor:'pointer',padding:'2px 10px',borderRadius:4,marginRight:12}}>+</button>
      </div>
      {/* BODY */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* LEFT PANEL */}
        <div style={{width:LEFT_PANEL_W,background:C.chrome,borderRight:`1px solid ${C.borderLight}`,display:'flex',flexDirection:'column',flexShrink:0,position:'relative'}}>
          <AreaTag id="CAL-LEFT" />
          <div style={{display:'flex',borderBottom:`1px solid ${C.borderLight}`,gap:4,padding:'6px 8px'}}>
            {[{key:'calendar',label:'Cal'},{key:'turn',label:'Turn'},{key:'waitlist',label:'Wait'}].map(tab=>(
              <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{flex:1,padding:'7px 0',background:activeTab===tab.key?C.blue:C.gridHover,border:activeTab===tab.key?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:5,color:activeTab===tab.key?'#fff':C.text,fontSize:12,fontWeight:600,cursor:'pointer'}}>{tab.label}</button>
            ))}
          </div>
          <div style={{flex:1,overflow:'auto',padding:12}}>
            {activeTab==='calendar'&&<div><MiniMonth monthOffset={0} selectedDate={selectedDate} onDateClick={setSelectedDate}/><MiniMonth monthOffset={1} selectedDate={selectedDate} onDateClick={setSelectedDate}/><MiniMonth monthOffset={2} selectedDate={selectedDate} onDateClick={setSelectedDate}/></div>}
            {activeTab==='turn'&&<TechTurnList techTurn={techTurn} onReorder={r=>{const ids=r.sort((a,b)=>(a.position||0)-(b.position||0)).map(t=>t.id);setTurnState(prev=>TurnEngine.manualReorder(prev,ids,'Manager').state);}} onBreak={handleTechBreak} onEndBreak={handleTechEndBreak}/>}
            {activeTab==='waitlist'&&<WaitlistPanel waitlist={waitlist} techTurn={techTurn} onStartWorking={handleWaitlistStart} onRemove={handleWaitlistRemove} onCheckIn={function(){setBookingCtx({checkIn:true});}}/>}
          </div>
        </div>
        {/* CALENDAR GRID */}
        <div ref={gridContainerRef} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
          <AreaTag id="CAL-GRID" pos="tr" />
          {/* Tech headers row */}
          <div style={{display:'flex',flexShrink:0,borderBottom:`1px solid ${C.borderMedium}`}}>
            <div style={{width:TIME_COL_W,minWidth:TIME_COL_W,flexShrink:0,background:C.chrome,borderRight:`1px solid ${C.borderLight}`}}/>
            <div ref={headerRef} style={{flex:1,overflow:'hidden',background:C.chrome,position:'relative',height:52}}>
              <div style={{position:'relative',minWidth:needsScroll?colW*visibleCols:'100%',height:52}}>
              {colW>0&&visibleStaff.map((staff,i)=>(
                <div key={staff.id} draggable onDragStart={function(e){e.dataTransfer.effectAllowed='move';setColDrag({fromIdx:i,overIdx:i});}}
                  onDragOver={function(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(colDrag&&colDrag.overIdx!==i)setColDrag(function(p){return p?{...p,overIdx:i}:p;});}}
                  onDrop={function(e){e.preventDefault();if(!colDrag||colDrag.fromIdx===i){setColDrag(null);return;}var newOrder=[...staffOrder];var fromId=visibleStaff[colDrag.fromIdx]?.id;var toId=visibleStaff[i]?.id;if(!fromId||!toId){setColDrag(null);return;}var fi=newOrder.indexOf(fromId);var ti=newOrder.indexOf(toId);newOrder.splice(fi,1);newOrder.splice(ti,0,fromId);setStaffOrder(newOrder);try{localStorage.setItem('prosalonpos_staff_order',JSON.stringify(newOrder));}catch(e){}setColDrag(null);}}
                  onDragEnd={function(){setColDrag(null);}}
                  style={{position:'absolute',left:i*colW,width:colW,height:52,display:'flex',alignItems:'center',gap:8,paddingLeft:10,borderLeft:i>0?`1px solid ${C.colDivider}`:'none',borderRight:i===visibleStaff.length-1?`1px solid ${C.colDivider}`:'none',boxSizing:'border-box',cursor:'grab',opacity:colDrag&&colDrag.fromIdx===i?0.4:1,background:colDrag&&colDrag.overIdx===i&&colDrag.fromIdx!==i?C.accentBg:'transparent',transition:'background 150ms'}}>
                  <Avatar name={staff.display_name} size={32} index={i} photo={staff.photo_url}/>
                  <div style={{minWidth:0,overflow:'hidden'}}>
                    <div style={{color:C.textPrimary,fontSize:13,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{staff.display_name}</div>
                    <div style={{color:C.textPrimary,fontSize:11}}>{requestedCounts[staff.id]||0} req</div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
          {/* Body: time column + grid side by side */}
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            {/* Time column — no scrollbar, position synced via JS */}
            <div ref={timeColRef} style={{width:TIME_COL_W,minWidth:TIME_COL_W,flexShrink:0,overflowY:'hidden',overflowX:'hidden',background:C.grid,borderRight:`1px solid ${C.borderLight}`}}>
              <div style={{position:'relative',height:totalRows*ROW_H}}>
                {Array.from({length:totalRows},(_,i)=>{
                  const min=gridStartMin+i*15;const h=Math.floor(min/60),m=min%60;
                  const isHour=m===0,isHalf=m===30;const yPos=i*ROW_H;
                  let labelText,labelStyle;
                  if(isHour){labelText=formatHour(h);labelStyle={fontSize:12,fontWeight:600,color:C.textPrimary};}
                  else if(isHalf){labelText=formatMinLabel(m);labelStyle={fontSize:12,fontWeight:600,color:C.textPrimary};}
                  else{labelText=formatMinLabel(m);labelStyle={fontSize:11,fontWeight:600,color:C.textPrimary};}
                  return(<div key={'t'+i} style={{position:'absolute',top:yPos,left:0,right:0,height:ROW_H,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',paddingRight:4}}>
                    <span style={{...labelStyle,fontVariantNumeric:'tabular-nums',lineHeight:'1',userSelect:'none',whiteSpace:'nowrap'}}>{labelText}</span>
                  </div>);
                })}
              </div>
            </div>
            {/* Scrollable grid */}
            <div ref={gridRef}
              onMouseDown={e=>handleSlotStart(e.clientX,e.clientY,e.target,e.currentTarget)}
              onMouseUp={e=>handleSlotEnd(e.clientX,e.clientY)}
              onTouchStart={e=>{const t=e.touches[0];if(t)handleSlotStart(t.clientX,t.clientY,e.target,e.currentTarget);}}
              onTouchEnd={e=>{const t=e.changedTouches[0];if(t)handleSlotEnd(t.clientX,t.clientY);}}
              onContextMenu={handleContextMenu}
              style={{flex:1,overflow:'auto',background:C.grid,cursor:dragging?'grabbing':'default',touchAction:dragging?'none':'auto',contain:'style layout'}}>
              <div style={{position:'relative',height:totalRows*ROW_H,minWidth:needsScroll?colW*visibleCols:'100%'}}>
                <StaticGridLines totalRows={totalRows} gridStartMin={gridStartMin} ROW_H={ROW_H} colW={colW} staffCount={visibleStaff.length} />
                {/* DRAG PREVIEW */}
                {dragging&&dragPreview&&colW>0&&(()=>{
                  const sl=serviceLines.find(s=>s.id===dragging.slId);if(!sl)return null;
                  const topPx=((dragPreview.startMin-gridStartMin)/15)*ROW_H;
                  const gDur=dragging.groupDur||sl.dur;const heightPx=Math.max(44,(gDur/15)*ROW_H);
                  var previewStart=formatTimeFull(minutesToTime(dragPreview.startMin));
                  var previewEnd=formatTimeFull(minutesToTime(dragPreview.startMin+gDur));
                  return(<div style={{position:'absolute',top:topPx+1,left:dragPreview.staffIdx*colW+3,width:colW-6,height:heightPx-2,background:'rgba(59,130,246,0.35)',borderRadius:6,border:`2px dashed ${C.blueLight}`,zIndex:3,pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',paddingTop:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:'#FFFFFF',textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>{previewStart}</span>
                    <span style={{fontSize:11,fontWeight:600,color:'#FFFFFF',textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>to {previewEnd}</span>
                  </div>);
                })()}
                {/* APPOINTMENT BLOCKS */}
                {!storeInitialized&&serviceLines.length===0&&colW>0&&(
                  <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:4,pointerEvents:'none'}}>
                    {visibleStaff.map(function(_s,ci){
                      // 3 skeleton bars per column at staggered positions
                      return [0,1,2].map(function(bi){
                        var topMin=[30,120,240][bi]; // 9:00, 10:30, 12:30 offset from grid start
                        var durMin=[45,60,30][bi];
                        var topPx=(topMin/15)*ROW_H;
                        var hPx=Math.max(44,(durMin/15)*ROW_H);
                        return(
                          <div key={'sk-'+ci+'-'+bi} style={{
                            position:'absolute',
                            top:topPx+2,
                            left:ci*colW+4,
                            width:colW-8,
                            height:hPx-4,
                            borderRadius:6,
                            background:'linear-gradient(90deg, '+C.gridHover+' 25%, '+C.borderLight+' 50%, '+C.gridHover+' 75%)',
                            backgroundSize:'200% 100%',
                            animation:'skeletonShimmer 1.5s ease-in-out infinite',
                            opacity:0.5,
                          }}/>
                        );
                      });
                    })}
                  </div>
                )}
                <AppointmentBlocks serviceLines={serviceLines} blockedTimes={blockedTimes} visibleStaff={visibleStaff} colW={colW} gridStartMin={gridStartMin} ROW_H={ROW_H} colLeftPx={function(idx){return idx*colW;}} dragging={dragging} onBlockStart={handleBlockStart} onBlockClick={function(b){setSelectedBlock(b);}} autoRequestMode={!!_settings.auto_request_mode}/>
                {/* NOW LINE */}
                {showNow&&(<div style={{position:'absolute',top:nowY,left:-6,right:0,zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center'}}><div style={{width:10,height:10,borderRadius:'50%',background:C.nowLine,flexShrink:0}}/><div style={{flex:1,height:2,background:C.nowLine}}/></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <CalendarOverlays
        popupProps={popupProps} pendingGroupMove={pendingGroupMove}
        confirmGroupMoveAll={confirmGroupMoveAll} confirmGroupMoveOne={confirmGroupMoveOne} cancelGroupMove={cancelGroupMove}
        selectedAppt={selectedAppt} setSelectedAppt={setSelectedAppt} serviceLines={serviceLines}
        handleStatusChange={handleStatusChange} handleChangeTech={handleChangeTech}
        handleAddTime={handleAddTime} handleAddService={handleAddService} onCheckout={onCheckout}
        selectedBlock={selectedBlock} setSelectedBlock={setSelectedBlock} setBlockedTimes={setBlockedTimes} rbac={rbac}
        bookingCtx={bookingCtx} techTurn={techTurn} handleBookingSave={handleBookingSave}
        handleBookingCancel={handleBookingCancel} handleCheckInSave={handleCheckInSave} catalogLayout={catalogLayout} salonSettings={salonSettings}
        showLogPopup={showLogPopup} setShowLogPopup={setShowLogPopup} activityLog={activityLog}
        ctxMenu={ctxMenu} setCtxMenu={setCtxMenu} copiedAppt={copiedAppt} setCopiedAppt={setCopiedAppt}
        handleCopyAppt={handleCopyAppt} handlePasteAppt={handlePasteAppt}
        bookingConfirm={bookingConfirm} setBookingConfirm={setBookingConfirm}
        vipCheckInAlert={vipCheckInAlert} setVipCheckInAlert={setVipCheckInAlert}
      />
    </div>
  );
}