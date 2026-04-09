import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Client Name Entry Screen
 * Full-screen overlay for entering the name of a second/additional client
 * during group booking. Uses standard <input> — OS on-screen keyboard handles typing.
 * Extracted from BookingFlow.jsx (Session 71) to keep it under the 800-line cap.
 */
var F = 'Inter,system-ui,sans-serif';

export default function ClientNameScreen({ clientNameInput, setClientNameInput, confirmClientName, setScreen, setPickerMode, setPendingClient, warning }) {
  var C = useTheme();
  var INP = {width:'100%',background:'#1E2D3D',border:'1px solid #2A3F55',borderRadius:6,padding:'0 14px',color:'#F1F5F9',fontSize:18,fontFamily:F,outline:'none',boxSizing:'border-box'};
  var BS = {height:44,padding:'0 24px',background:'transparent',color:'#F1F5F9',border:'1px solid #2A3F55',borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:F};
  var BP = {height:44,padding:'0 24px',background:'#2563EB',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:F};

  return(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:270,background:'#0B1120',fontFamily:F,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',paddingTop:40}}>
      <div style={{width:580,background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:14,padding:28,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
        {/* Header */}
        <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Add Client Name</div>
        <div style={{fontSize:13,color:C.textMuted,marginBottom:16}}>Enter the name of the client being added to this booking.</div>
        {/* Name input — OS on-screen keyboard pops up on kiosk */}
        <input
          value={clientNameInput}
          onChange={function(e){ setClientNameInput(e.target.value); }}
          onKeyDown={function(e){
            if(e.key==='Enter'&&clientNameInput.trim()) confirmClientName();
            if(e.key==='Escape'){ setScreen('services'); setPickerMode(null); setClientNameInput(''); }
          }}
          placeholder="First and last name..."
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="words"
          autoFocus
          style={{...INP,height:48,marginBottom:24,letterSpacing:0.3}}
        />
        {/* Actions */}
        <div style={{display:'flex',gap:10}}>
          <button
            onClick={function(){ setScreen('services'); setPickerMode(null); setClientNameInput(''); }}
            style={{...BS,flex:1,height:44,fontSize:14}}>Cancel</button>
          <button
            onClick={function(){ setPendingClient(null); setClientNameInput(''); setScreen('techPicker'); }}
            style={{flex:1,height:44,background:'rgba(217,119,6,0.12)',border:'1px dashed #D97706',borderRadius:6,color:'#D97706',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:F}}>Walk-in</button>
          <button
            onClick={confirmClientName}
            disabled={!clientNameInput.trim()}
            style={{...BP,flex:1,height:44,fontSize:14,opacity:clientNameInput.trim()?1:0.4}}>Continue →</button>
        </div>
      </div>
    </div>
  );
}
