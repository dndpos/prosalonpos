import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Move Appointment Confirmation Popup
 * Shows when drag-and-drop rescheduling lands on a new slot.
 * Includes requested technician warning.
 */
import { formatTimeFull } from '../../lib/calendarHelpers';

export default function MovePopup({sl, newStaffName, newTime, oldStaffName, isRequestedWarning, groupCount, onConfirm, onCancel}){
  var C = useTheme();
  return(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onCancel}>
      <div style={{backgroundColor:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:420,padding:0,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.borderLight}`}}>
          <div style={{fontSize:15,fontWeight:600,color:C.textPrimary,marginBottom:12}}>Move Appointment{groupCount>1?` (${groupCount} services)`:''}</div>
          <div style={{fontSize:13,color:C.textPrimary,lineHeight:'1.6'}}>
            You are moving <span style={{color:C.blueLight,fontWeight:500}}>{sl.client}</span>'s {groupCount>1?`${groupCount}-service `:''}appointment
            to <span style={{color:C.blueLight,fontWeight:500}}>{newStaffName}</span> at <span style={{color:C.blueLight,fontWeight:500}}>{formatTimeFull(newTime)}</span>.
          </div>
          {isRequestedWarning&&(
            <div style={{marginTop:12,padding:'10px 14px',backgroundColor:'rgba(220,38,38,0.12)',borderRadius:8,border:`1px solid rgba(220,38,38,0.3)`}}>
              <div style={{fontSize:13,color:'#FCA5A5',fontWeight:500}}>⚠ Requested Technician Warning</div>
              <div style={{fontSize:12,color:C.textPrimary,marginTop:4}}>
                This client specifically requested <span style={{color:C.blueLight,fontWeight:500}}>{oldStaffName}</span>. You are moving them to a different technician.
              </div>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,padding:'16px 24px',justifyContent:'flex-end'}}>
          <button onClick={onCancel} style={{padding:'8px 20px',borderRadius:6,border:`1px solid ${C.borderMedium}`,background:'none',color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer'}}>No</button>
          <button onClick={onConfirm} style={{padding:'8px 20px',borderRadius:6,border:'none',background:C.blue,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>Yes</button>
        </div>
      </div>
    </div>
  );
}
