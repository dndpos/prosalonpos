import { useTheme } from '../../lib/ThemeContext';
import AreaTag from '../../components/ui/AreaTag';

export default function ActivityLogPopup({activityLog, onClose}){
  var C = useTheme();
  return(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{backgroundColor:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:12,width:600,maxHeight:'80vh',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',position:'relative'}} onClick={function(e){e.stopPropagation();}}>
        <AreaTag id="CAL-LOG" />
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid '+C.borderLight,flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:600,color:C.textPrimary}}>Appointment Log ({activityLog.length})</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.textPrimary,fontSize:20,cursor:'pointer',padding:'4px 8px',borderRadius:4}}>✕</button>
        </div>
        <div style={{flex:1,overflow:'auto'}}>
          {activityLog.length===0?(
            <div style={{padding:'40px 20px',textAlign:'center',color:C.textPrimary,fontSize:14}}>No changes recorded yet</div>
          ):(
            activityLog.map(function(entry){
              var hasDetails = entry.details && entry.details.length > 0;
              var COLORS = ['#38BDF8','#F59E0B','#10B981','#8B5CF6'];
              return(
                <div key={entry.id} style={{padding:'14px 20px',borderBottom:'1px solid '+C.borderLight}}>
                  {/* Header row — description + timestamp */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.textPrimary}}>
                      {entry.description}
                      {entry.requested&&entry.changedTech&&<span style={{marginLeft:6,fontSize:12,color:'#EF4444',fontWeight:600}}>★ Requested tech changed</span>}
                    </span>
                    <span style={{fontSize:11,color:C.textMuted,flexShrink:0,marginLeft:12}}>
                      {entry.timestamp.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
                    </span>
                  </div>

                  {/* Booking with details — multiple client cards */}
                  {hasDetails?(
                    <div>
                      {entry.details.map(function(d, di){
                        return(
                          <div key={di} style={{
                            background:C.chromeDark,borderRadius:8,padding:'10px 14px',
                            marginBottom:di<entry.details.length-1?8:0,
                            borderLeft:'3px solid '+COLORS[di%COLORS.length]
                          }}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:d.services.length>1?6:0}}>
                              <span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>{d.client}</span>
                              <span style={{fontSize:12,color:C.blueLight,fontWeight:500}}>with {d.tech}</span>
                            </div>
                            {d.services.map(function(svc, si){
                              return(
                                <div key={si} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4}}>

                                  <span style={{fontSize:12,color:C.textPrimary}}>{svc.name}</span>
                                  <span style={{fontSize:11,color:C.textMuted}}>{svc.dur} min</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ):(
                    /* Single-service entries (status change, tech change, add time, etc.) — same card style */
                    <div style={{
                      background:C.chromeDark,borderRadius:8,padding:'10px 14px',
                      borderLeft:'3px solid #38BDF8'
                    }}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>{entry.client}</span>
                        {entry.techName&&<span style={{fontSize:12,color:C.blueLight,fontWeight:500}}>with {entry.techName}</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4}}>
                        <span style={{fontSize:12,color:C.textPrimary}}>{entry.service}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
