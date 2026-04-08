/**
 * CalendarOverlays.jsx — All modal/popup/overlay renders for CalendarDayView
 * Extracted from CalendarDayView.jsx (Session 67b split — was 777 lines)
 *
 * Renders: MovePopup, Group Move popup, AppointmentDetailPopup, Blocked Time popup,
 *          BookingFlow modal, ActivityLogPopup, Copy/Paste context menu,
 *          Clipboard indicator, Booking Confirmation Toast, VIP Check-In Alert
 *
 * All state and handlers live in CalendarDayView — this file is render-only.
 */
import AppointmentDetailPopup from './AppointmentDetailPopup';
import BookingFlow from './BookingFlow';
import ActivityLogPopup from './ActivityLogPopup';
import MovePopup from './MovePopup';
import { useTheme } from '../../lib/ThemeContext';
import { useRBAC } from '../../lib/RBACContext';
import { ACTIONS } from '../../lib/rbac';
import { minutesToTime, formatTimeFull } from '../../lib/calendarHelpers';
import { useStaffStore } from '../../lib/stores/staffStore';
import AreaTag from '../../components/ui/AreaTag';

export default function CalendarOverlays({
  // Drag move
  popupProps, pendingGroupMove, confirmGroupMoveAll, confirmGroupMoveOne, cancelGroupMove,
  // Appointment detail
  selectedAppt, setSelectedAppt, serviceLines,
  handleStatusChange, handleChangeTech, handleAddTime, handleAddService, onCheckout,
  // Blocked time
  selectedBlock, setSelectedBlock, setBlockedTimes, rbac,
  // Booking flow
  bookingCtx, techTurn, handleBookingSave, handleBookingCancel, handleCheckInSave, catalogLayout, salonSettings,
  // Activity log
  showLogPopup, setShowLogPopup, activityLog,
  // Copy/paste
  ctxMenu, setCtxMenu, copiedAppt, setCopiedAppt, handleCopyAppt, handlePasteAppt,
  // Toasts
  bookingConfirm, setBookingConfirm, vipCheckInAlert, setVipCheckInAlert,
}) {
  var C = useTheme();
  var STAFF = useStaffStore(function(s) { return s.staff || []; });

  return (
    <>
      {/* ── Move confirmation popup ── */}
      {popupProps && <MovePopup {...popupProps} />}

      {/* ── Group booking move popup ── */}
      {pendingGroupMove && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={cancelGroupMove}>
          <div style={{backgroundColor:C.chrome,border:'2px solid #B45309',borderRadius:12,width:440,padding:0,boxShadow:'0 20px 60px rgba(0,0,0,0.5)',position:'relative'}} onClick={e=>e.stopPropagation()}>
            <AreaTag id="CAL-OVR" />
            <div style={{padding:'18px 24px',background:'linear-gradient(135deg, #78350F 0%, #92400E 100%)',borderRadius:'10px 10px 0 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{fontSize:20}}>⚠️</span>
                <span style={{fontSize:16,fontWeight:700,color:'#FDE68A',letterSpacing:'0.02em'}}>Group Appointment</span>
              </div>
              <div style={{fontSize:13,color:'#FBBF24',lineHeight:'1.6'}}>
                This appointment is part of a group booking. Do you want to move <span style={{color:'#FFF',fontWeight:600}}>all clients</span> in this group to the new time?
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,padding:'18px 24px'}}>
              <button onClick={confirmGroupMoveAll}
                style={{width:'100%',padding:'14px 20px',borderRadius:10,border:'none',background:'#134E4A',color:'#5EEAD4',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif",textAlign:'left',transition:'background 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='#1a5e58';}}
                onMouseLeave={e=>{e.currentTarget.style.background='#134E4A';}}>
                <div>Move entire group</div>
                <div style={{fontSize:11,fontWeight:400,color:'#99F6E4',marginTop:3,opacity:0.8}}>All clients in this booking shift to the new time</div>
              </button>
              <button onClick={confirmGroupMoveOne}
                style={{width:'100%',padding:'14px 20px',borderRadius:10,border:'none',background:'#312E81',color:'#A5B4FC',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif",textAlign:'left',transition:'background 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='#3b3898';}}
                onMouseLeave={e=>{e.currentTarget.style.background='#312E81';}}>
                <div>Move only this client</div>
                <div style={{fontSize:11,fontWeight:400,color:'#C7D2FE',marginTop:3,opacity:0.8}}>Other clients stay at their current time</div>
              </button>
              <div style={{display:'flex',justifyContent:'center',marginTop:4}}>
                <button onClick={cancelGroupMove}
                  style={{padding:'9px 32px',borderRadius:8,border:'none',background:'#4C1D1D',color:'#FCA5A5',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:"'Inter',sans-serif",transition:'background 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='#5C2424';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#4C1D1D';}}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Appointment detail popup ── */}
      {selectedAppt && !popupProps && (
        <AppointmentDetailPopup
          sl={selectedAppt}
          allServiceLines={serviceLines}
          staff={STAFF}
          onClose={() => setSelectedAppt(null)}
          onStatusChange={handleStatusChange}
          onChangeTech={handleChangeTech}
          onAddTime={handleAddTime}
          onAddService={handleAddService}
          onCheckout={function(data) {
            rbac.requirePermission(ACTIONS.PROCESS_CHECKOUT, function(staff) { onCheckout(data, staff); });
          }}
        />
      )}

      {/* ── Blocked time delete popup ── */}
      {selectedBlock && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:300,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'18vh'}} onClick={function(){setSelectedBlock(null);}}>
          <div style={{background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:12,width:340,padding:'24px',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={function(e){e.stopPropagation();}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}><span style={{fontSize:18}}>🚫</span><span style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Blocked Time</span></div>
            <div style={{fontSize:13,color:C.textMuted,marginBottom:4}}>{(function(){var st=STAFF.find(function(s){return s.id===selectedBlock.staff_id;});return st?st.display_name:'Unknown';})()}</div>
            <div style={{fontSize:13,color:C.textPrimary,marginBottom:20}}>{formatTimeFull(selectedBlock.starts_at)+' — '+formatTimeFull(minutesToTime(selectedBlock.startMin+selectedBlock.dur))}</div>
            <div style={{display:'flex',gap:8}}>
              <div onClick={function(){setSelectedBlock(null);}} style={{flex:1,height:38,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid '+C.borderMedium,borderRadius:8,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',userSelect:'none'}}>Close</div>
              <div onClick={function(){rbac.requirePermission(ACTIONS.DELETE_CANCEL_APPOINTMENTS,function(){setBlockedTimes(function(prev){return prev.filter(function(b){return b.id!==selectedBlock.id;});});setSelectedBlock(null);});}} style={{flex:1,height:38,display:'flex',alignItems:'center',justifyContent:'center',background:C.danger,borderRadius:8,color:'#FFF',fontSize:13,fontWeight:600,cursor:'pointer',userSelect:'none'}}>Delete Block</div>
            </div>
          </div>
        </div>
      )}

      {/* ── BookingFlow modal ── */}
      {bookingCtx && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:250,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:720,maxWidth:'90vw',height:'85vh',maxHeight:700,borderRadius:14,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.6)',border:`1px solid ${C.borderMedium}`}}>
            <BookingFlow
              staff={STAFF} techTurn={techTurn}
              initialStaffId={bookingCtx.staffId}
              initialHour={bookingCtx.checkIn ? Math.floor(new Date().getHours()) : Math.floor(bookingCtx.startMin/60)}
              initialMin={bookingCtx.checkIn ? new Date().getMinutes() : bookingCtx.startMin%60}
              onSave={bookingCtx.checkIn ? handleCheckInSave : handleBookingSave} onCancel={handleBookingCancel}
              catalogLayout={catalogLayout} autoRequestMode={!!salonSettings?.auto_request_mode}
              salonSettings={salonSettings}
              checkInMode={!!bookingCtx.checkIn}
            />
          </div>
        </div>
      )}

      {/* ── Activity log popup ── */}
      {showLogPopup && <ActivityLogPopup activityLog={activityLog} onClose={() => setShowLogPopup(false)} />}

      {/* ── Copy/Paste context menu ── */}
      {ctxMenu && (
        <div onClick={function(){setCtxMenu(null);}} style={{position:'fixed',inset:0,zIndex:500}}>
          <div onClick={function(e){e.stopPropagation();}} style={{position:'fixed',top:ctxMenu.y,left:ctxMenu.x,zIndex:501,background:'#1E293B',border:'1px solid #334155',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.5)',minWidth:160,overflow:'hidden',fontFamily:"'Inter',system-ui,sans-serif"}}>
            {ctxMenu.type==='copy' && (
              <div onClick={function(){handleCopyAppt(ctxMenu.sl);}}
                style={{padding:'10px 16px',fontSize:13,fontWeight:500,color:'#F1F5F9',cursor:'pointer',display:'flex',alignItems:'center',gap:10,userSelect:'none'}}
                onMouseEnter={function(e){e.currentTarget.style.background='#334155';}}
                onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
                <span style={{fontSize:16}}>📋</span> Copy Appointment
              </div>
            )}
            {ctxMenu.type==='paste' && (
              <div onClick={function(){handlePasteAppt(ctxMenu.staffId,ctxMenu.startMin);}}
                style={{padding:'10px 16px',fontSize:13,fontWeight:500,color:'#F1F5F9',cursor:'pointer',display:'flex',alignItems:'center',gap:10,userSelect:'none'}}
                onMouseEnter={function(e){e.currentTarget.style.background='#334155';}}
                onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
                <span style={{fontSize:16}}>📌</span>
                <span>Paste: <span style={{color:'#94A3B8'}}>{copiedAppt && copiedAppt.client}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Clipboard indicator ── */}
      {copiedAppt && !ctxMenu && (
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:490,background:'#1E293B',border:'1px solid #3B82F6',borderRadius:8,padding:'8px 16px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 4px 16px rgba(0,0,0,0.4)',fontFamily:"'Inter',system-ui,sans-serif"}}>
          <span style={{fontSize:14}}>📋</span>
          <span style={{fontSize:12,fontWeight:500,color:'#CBD5E1'}}>{copiedAppt.client} — {copiedAppt.service}</span>
          <span style={{fontSize:11,color:'#64748B'}}>Right-click any empty slot to paste</span>
          <div onClick={function(){setCopiedAppt(null);}} style={{marginLeft:8,color:'#64748B',cursor:'pointer',fontSize:14,fontWeight:700,lineHeight:1,userSelect:'none'}}
            onMouseEnter={function(e){e.currentTarget.style.color='#F1F5F9';}}
            onMouseLeave={function(e){e.currentTarget.style.color='#64748B';}}>✕</div>
        </div>
      )}

      {/* ── Booking confirmation toast ── */}
      {bookingConfirm && (
        <div onClick={function(){setBookingConfirm(null);}} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:400,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'8vh'}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:'#131B2E',border:'1px solid #22C55E',borderRadius:16,padding:'24px 32px',width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(34,197,94,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>✓</div>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:'#22C55E'}}>Appointment Booked</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:1}}>{bookingConfirm.time}</div>
              </div>
            </div>
            <div style={{background:'#1A2340',borderRadius:10,padding:'14px 16px',border:'1px solid #1E2D45'}}>
              <div style={{fontSize:15,fontWeight:600,color:'#F1F5F9',marginBottom:6}}>{bookingConfirm.clients.join(', ')}</div>
              <div style={{fontSize:14,color:'#94A3B8',marginBottom:8}}>with {bookingConfirm.techs.join(', ')}</div>
              {bookingConfirm.services.map(function(svc,i){return(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:i===0?'1px solid #1E2D45':'none'}}>

                  <span style={{fontSize:14,color:'#E2E8F0'}}>{svc.name} <span style={{color:'#64748B'}}>({svc.dur}m)</span></span>
                  {svc.price>0&&<span style={{fontSize:14,color:'#94A3B8'}}>${(svc.price/100).toFixed(2)}</span>}
                </div>);})}
            </div>
            <div onClick={function(){setBookingConfirm(null);}} style={{marginTop:14,width:'100%',height:36,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid #334155',borderRadius:8,color:'#F1F5F9',fontSize:13,fontWeight:500,cursor:'pointer',userSelect:'none'}}
              onMouseEnter={function(e){e.currentTarget.style.background='#1A2340';}} onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>Close</div>
          </div>
        </div>
      )}

      {/* ── VIP check-in alert ── */}
      {vipCheckInAlert && (
        <div onClick={function(){setVipCheckInAlert(null);}} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:400,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'18vh'}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:'#131B2E',border:'2px solid #F59E0B',borderRadius:16,padding:'24px 32px',width:400,boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>👑</div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:'#F59E0B'}}>VIP Client Checked In</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{vipCheckInAlert.client} is a VIP</div>
              </div>
            </div>
            <div style={{background:'#1A2340',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(245,158,11,0.3)'}}>
              <div style={{fontSize:13,fontWeight:600,color:'#F1F5F9',marginBottom:4}}>{vipCheckInAlert.service}</div>
              {vipCheckInAlert.requested && <div style={{fontSize:12,color:'#FBBF24',marginTop:2}}>Requested: {vipCheckInAlert.requested}</div>}
              <div style={{fontSize:11,color:'#94A3B8',marginTop:6}}>VIP discount will auto-apply at checkout</div>
            </div>
            <div onClick={function(){setVipCheckInAlert(null);}} style={{marginTop:14,width:'100%',height:36,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:8,color:'#F59E0B',fontSize:13,fontWeight:600,cursor:'pointer',userSelect:'none'}}
              onMouseEnter={function(e){e.currentTarget.style.background='rgba(245,158,11,0.2)';}} onMouseLeave={function(e){e.currentTarget.style.background='rgba(245,158,11,0.1)';}}>Got It</div>
          </div>
        </div>
      )}
    </>
  );
}
