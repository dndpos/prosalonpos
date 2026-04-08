import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — New Client Form
 * Shown when phone lookup finds no match and user taps "Add New Client".
 * Uses standard <input> fields — OS on-screen keyboard handles typing.
 * Extracted from BookingFlow.jsx to keep it under the 800-line cap.
 */
var F = 'Inter,system-ui,sans-serif';

export default function NewClientForm({
  phoneDigits, fp,
  newFirst, setNewFirst,
  newLast, setNewLast,
  newEmail, setNewEmail,
  saveNewClient,
}) {
  var C = useTheme();
  var INP = {width:'100%',background:'#1E2D3D',border:'1px solid #2A3F55',borderRadius:6,padding:'0 14px',color:'#F1F5F9',fontSize:14,fontFamily:F,outline:'none',boxSizing:'border-box'};
  var BP = {height:44,padding:'0 24px',background:'#2563EB',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:F};

  return(
    <div style={{background:'#1A2B3C',borderRadius:8,padding:16,border:'1px solid #253352'}}>
      <div style={{fontSize:13,fontWeight:500,color:'#F1F5F9',marginBottom:4}}>New client — {fp(phoneDigits)}</div>
      <div style={{fontSize:11,color:'#94A3B8',marginBottom:12}}>Phone and first name are required</div>

      <div style={{marginBottom:8}}>
        <label style={{display:'block',fontSize:11,marginBottom:3,fontWeight:500,color:'#94A3B8'}}>
          First name<span style={{color:'#F87171'}}> *</span>
        </label>
        <input
          value={newFirst}
          onChange={function(e){ setNewFirst(e.target.value); }}
          placeholder="First name"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="words"
          autoFocus
          style={{...INP,height:38}}
        />
      </div>

      <div style={{marginBottom:8}}>
        <label style={{display:'block',fontSize:11,marginBottom:3,fontWeight:400,color:'#94A3B8'}}>Last name</label>
        <input
          value={newLast}
          onChange={function(e){ setNewLast(e.target.value); }}
          placeholder="Optional"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="words"
          style={{...INP,height:38}}
        />
      </div>

      <div style={{marginBottom:12}}>
        <label style={{display:'block',fontSize:11,marginBottom:3,fontWeight:400,color:'#94A3B8'}}>Email</label>
        <input
          value={newEmail}
          onChange={function(e){ setNewEmail(e.target.value); }}
          placeholder="Optional"
          type="email"
          inputMode="email"
          autoComplete="off"
          style={{...INP,height:38}}
        />
      </div>

      <button
        onClick={saveNewClient}
        disabled={!newFirst.trim()||phoneDigits.length!==10}
        style={{...BP,width:'100%',height:40,fontSize:13,opacity:(!newFirst.trim()||phoneDigits.length!==10)?0.4:1}}>
        Save & continue
      </button>
    </div>
  );
}
