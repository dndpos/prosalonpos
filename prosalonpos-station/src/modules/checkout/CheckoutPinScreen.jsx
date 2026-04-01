import { useTheme } from '../../lib/ThemeContext';
/**
 * CheckoutPinScreen — PIN entry screen for checkout tech identification.
 * Extracted from CheckoutScreen.jsx (Session 63 split).
 * Supports PIN pad entry, badge scan match display, and cancel.
 */

export default function CheckoutPinScreen({ pinDigits, pinError, pinMatch, onPinTap, onClear, onBackspace, onDone }) {
  var C = useTheme();
  return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,background:C.modalGradient,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{width:400,textAlign:'center',border:`1px solid ${C.borderMedium}`,borderRadius:12,padding:32,background:'rgba(30,41,59,0.85)',boxShadow:'0 16px 48px rgba(0,0,0,0.4)'}}>
        <div style={{fontSize:20,fontWeight:600,color:C.textPrimary,marginBottom:8}}>Enter Your PIN</div>
        <div style={{color:C.textPrimary,fontSize:14,marginBottom:28}}>Enter PIN, scan badge, or scan ticket</div>
        <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:24}}>
          {[0,1,2,3].map(function(i) { return (
            <div key={i} style={{width:20,height:20,borderRadius:'50%',background:pinError?C.danger:pinMatch&&i<pinDigits.length?C.success:i<pinDigits.length?C.blueLight:'transparent',border:pinError?`2px solid ${C.danger}`:i<pinDigits.length?'2px solid transparent':`2px solid ${C.borderMedium}`,transition:'all 0.15s'}}/>
          ); })}
        </div>
        {pinMatch&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:16,padding:'10px',background:'rgba(5,150,105,0.12)',borderRadius:8,border:'1px solid rgba(5,150,105,0.3)'}}>
            <img src={pinMatch.photo_url} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover'}}/>
            <span style={{color:'#6EE7B7',fontSize:16,fontWeight:600}}>{pinMatch.display_name}</span>
          </div>
        )}
        {pinError&&<div style={{color:C.danger,fontSize:13,marginBottom:12}}>Invalid PIN — try again</div>}
        <div style={{maxWidth:260,margin:'0 auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
            {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(d) { return (
              <div key={d} onClick={function(){
                if(d==='C') onClear();
                else if(d==='⌫') onBackspace();
                else onPinTap(d);
              }} style={{height:50,background:C.grid,border:'1px solid '+C.borderMedium,borderRadius:6,color:d==='⌫'?C.danger:d==='C'?C.warning:C.textPrimary,fontSize:d==='C'?13:d==='⌫'?16:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',transition:'background-color 150ms'}}
                onMouseEnter={function(e){e.currentTarget.style.backgroundColor=C.gridHover;}}
                onMouseLeave={function(e){e.currentTarget.style.backgroundColor=C.grid;}}>
                {d}
              </div>
            ); })}
          </div>
        </div>
        <div onClick={onDone} style={{marginTop:20,height:38,padding:'0 24px',background:'transparent',border:'1px solid '+C.danger,borderRadius:8,color:C.danger,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>Cancel</div>
        <div style={{marginTop:16,color:C.textPrimary,fontSize:12}}>or scan badge / open ticket</div>
      </div>
    </div>
  );
}
