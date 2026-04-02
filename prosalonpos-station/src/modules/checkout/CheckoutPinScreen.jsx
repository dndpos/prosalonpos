import { useTheme } from '../../lib/ThemeContext';
import { useEffect } from 'react';
/**
 * CheckoutPinScreen — PIN entry screen for checkout tech identification.
 * Session 95 — OK button added, no auto-detect.
 * Type PIN → tap OK → result.
 * Cancel (softcolor red) + OK (softcolor green) side by side.
 */

export default function CheckoutPinScreen({ pinDigits, pinError, pinMatch, onPinTap, onOk, onClear, onBackspace, onDone }) {
  var C = useTheme();

  // Keyboard: Enter = OK
  useEffect(function() {
    function onKey(e) {
      if (e.key === 'Enter' && onOk) {
        e.preventDefault();
        onOk();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [onOk]);

  var KEYS = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  var hasDigits = pinDigits && pinDigits.length > 0;

  return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,background:C.modalGradient,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{width:400,textAlign:'center',border:'1px solid '+C.borderMedium,borderRadius:12,padding:32,background:'rgba(30,41,59,0.85)',boxShadow:'0 16px 48px rgba(0,0,0,0.4)'}}>
        <div style={{fontSize:20,fontWeight:600,color:C.textPrimary,marginBottom:8}}>Enter Your PIN</div>
        <div style={{color:C.textPrimary,fontSize:14,marginBottom:28}}>Enter PIN, scan badge, or scan ticket</div>

        {/* PIN dots */}
        <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:24}}>
          {[0,1,2,3,4,5,6,7].map(function(i) {
            if (i >= (pinDigits || '').length && i >= 4) return null;
            return (
              <div key={i} style={{
                width:20,height:20,borderRadius:'50%',
                background: pinError ? C.danger : pinMatch && i < pinDigits.length ? C.success : i < pinDigits.length ? C.blueLight : 'transparent',
                border: pinError ? '2px solid '+C.danger : i < pinDigits.length ? '2px solid transparent' : '2px solid '+C.borderMedium,
                transition:'all 0.15s',
              }}/>
            );
          })}
        </div>

        {/* Match display */}
        {pinMatch && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:16,padding:'10px',background:'rgba(5,150,105,0.12)',borderRadius:8,border:'1px solid rgba(5,150,105,0.3)'}}>
            <img src={pinMatch.photo_url} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover'}}/>
            <span style={{color:'#6EE7B7',fontSize:16,fontWeight:600}}>{pinMatch.display_name}</span>
          </div>
        )}

        {/* Error */}
        {pinError && <div style={{color:C.danger,fontSize:13,marginBottom:12}}>Invalid PIN — try again</div>}

        {/* Numpad */}
        <div style={{maxWidth:260,margin:'0 auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
            {KEYS.map(function(d) {
              var isBack = d === '⌫';
              var isClear = d === 'C';
              var isAction = isBack || isClear;
              return (
                <div key={d} onClick={function(){
                  if(isClear) onClear();
                  else if(isBack) onBackspace();
                  else onPinTap(d);
                }} style={{
                  height:50,background:C.grid,border:'1px solid '+C.borderMedium,borderRadius:6,
                  color:isBack?C.danger:isClear?C.warning:C.textPrimary,
                  fontSize:isAction?16:20,fontWeight:500,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none',
                  transition:'background-color 150ms',
                }}
                onMouseEnter={function(e){e.currentTarget.style.backgroundColor=C.gridHover;}}
                onMouseLeave={function(e){e.currentTarget.style.backgroundColor=C.grid;}}>
                  {d}
                </div>
              );
            })}
          </div>

          {/* Cancel + OK buttons — side by side */}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <div onClick={onDone} style={{
              flex:1,height:57,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
              background:'#3B1C1C',color:'#F87171',border:'1px solid #5C2626',
              fontSize:16,fontWeight:700,cursor:'pointer',userSelect:'none',
              transition:'background 120ms',
            }}
            onMouseEnter={function(e){e.currentTarget.style.background='#4C2222';}}
            onMouseLeave={function(e){e.currentTarget.style.background='#3B1C1C';}}>
              Cancel
            </div>
            <div onClick={function(){ if(hasDigits && onOk) onOk(); }} style={{
              flex:1,height:57,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
              background:hasDigits?'#1C3B2A':C.grid,color:hasDigits?'#4ADE80':C.textMuted,
              border:'1px solid '+(hasDigits?'#2D5A3E':C.borderMedium),
              fontSize:16,fontWeight:700,cursor:hasDigits?'pointer':'not-allowed',userSelect:'none',
              transition:'background 120ms,color 120ms',
            }}
            onMouseEnter={function(e){if(hasDigits)e.currentTarget.style.background='#245638';}}
            onMouseLeave={function(e){if(hasDigits)e.currentTarget.style.background='#1C3B2A';}}>
              OK
            </div>
          </div>
        </div>

        <div style={{marginTop:16,color:C.textPrimary,fontSize:12}}>or scan badge / open ticket</div>
      </div>
    </div>
  );
}
