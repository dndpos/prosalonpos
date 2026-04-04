import { useTheme } from '../../lib/ThemeContext';
/** Pro Salon POS — Client Lookup Modal. Phone numpad + search + new client. */
import { useState } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_CLIENTS } from './checkoutBridge';
import { fp } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';

function autoCap(v){return v.replace(/(^|\s)\S/g,c=>c.toUpperCase());}
function Av({name,size=28,index=0}){
  var C = useTheme();
  var INP={height:38,background:'#283548',border:`1px solid ${C.borderMedium}`,borderRadius:6,padding:'0 10px',color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export default function ClientLookupModal({ onSelect, onClose }){
  var C = useTheme();
  const [phoneDigits, setPhoneDigits] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');

  const filtered = CHECKOUT_CLIENTS.filter(c=>phoneDigits?c.phone.includes(phoneDigits):true);

  function handleSelect(c){ onSelect(c); }
  function handleNewSave(){
    if(!newFirst.trim()||phoneDigits.length!==10)return;
    onSelect({id:'c-new-'+Date.now(),first_name:newFirst.trim(),last_name:newLast.trim(),phone:phoneDigits,outstanding_balance_cents:0});
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
        <AreaTag id="CO-CLIENT" />
      <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:480,maxHeight:'75vh',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0}}><div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Look Up Client</div></div>
        <div style={{flex:1,overflow:'auto',display:'flex'}}>
          <div style={{flex:1,padding:14,overflow:'auto'}}>
            {!showNew?(
              <>{phoneDigits.length>=3&&filtered.length===0?(
                <div style={{textAlign:'center',padding:'24px 0'}}><div style={{color:C.textMuted,fontSize:13,marginBottom:10}}>No client found</div><button onClick={()=>setShowNew(true)} style={{height:36,padding:'0 16px',background:C.blue,border:'none',borderRadius:6,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>+ New Client</button></div>
              ):(
                <><div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>{phoneDigits?`Results (${filtered.length})`:'Enter phone →'}</div>
                {filtered.slice(0,8).map((c,i)=>(
                  <button key={c.id} onClick={()=>handleSelect(c)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',background:C.chromeDark,border:`1px solid ${C.borderLight}`,borderRadius:6,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:3}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue} onMouseLeave={e=>e.currentTarget.style.borderColor=C.borderLight}>
                    <Av name={`${c.first_name} ${c.last_name}`} size={28} index={i}/><div><div style={{color:C.textPrimary,fontSize:13,fontWeight:500}}>{c.first_name} {c.last_name}</div><div style={{color:C.textMuted,fontSize:11}}>{fp(c.phone)}</div></div>
                  </button>
                ))}</>
              )}</>
            ):(
              <div><div style={{fontSize:13,color:C.textPrimary,fontWeight:500,marginBottom:10}}>New Client</div><div style={{color:C.textMuted,fontSize:11,marginBottom:6}}>Phone: {fp(phoneDigits)}</div>
                <input value={newFirst} onChange={e=>setNewFirst(autoCap(e.target.value))} placeholder="First name *" autoCapitalize="words" autoComplete="off" style={{...INP,width:'100%',marginBottom:6}}/>
                <input value={newLast} onChange={e=>setNewLast(autoCap(e.target.value))} placeholder="Last name" autoCapitalize="words" autoComplete="off" style={{...INP,width:'100%',marginBottom:10}}/>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{setShowNew(false);setNewFirst('');setNewLast('');}} style={{flex:1,height:36,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Back</button>
                  <button onClick={handleNewSave} disabled={!newFirst.trim()||phoneDigits.length!==10} style={{flex:1,height:36,background:newFirst.trim()&&phoneDigits.length===10?C.blue:'#334155',border:'none',borderRadius:6,color:newFirst.trim()&&phoneDigits.length===10?'#fff':C.textMuted,fontSize:12,fontWeight:500,cursor:newFirst.trim()&&phoneDigits.length===10?'pointer':'default',fontFamily:'inherit'}}>Save</button>
                </div>
              </div>
            )}
          </div>
          <div style={{width:180,borderLeft:`1px solid ${C.borderLight}`,padding:10,display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{background:phoneDigits.length===10?'rgba(5,150,105,0.15)':C.grid,borderRadius:6,padding:'6px 8px',marginBottom:4,display:'flex',alignItems:'center',justifyContent:'center',minHeight:32,border:phoneDigits.length===10?'1px solid rgba(5,150,105,0.3)':'1px solid transparent'}}>
              <span style={{color:phoneDigits?C.textPrimary:C.textMuted,fontSize:14,fontWeight:500,fontVariantNumeric:'tabular-nums'}}>{phoneDigits?fp(phoneDigits):'(___) ___-____'}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
              {['7','8','9','4','5','6','1','2','3'].map(d=>(<div key={d} onClick={()=>{if(phoneDigits.length<10)setPhoneDigits(prev=>prev+d);}} style={{background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:5,color:C.btnText,fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:'inherit',height:40,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>))}
              <div onClick={()=>setPhoneDigits('')} style={{background:'#334155',border:'1px solid #475569',borderRadius:5,color:C.warning,fontSize:10,fontWeight:500,cursor:'pointer',fontFamily:'inherit',height:40,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>CLR</div>
              <div onClick={()=>{if(phoneDigits.length<10)setPhoneDigits(prev=>prev+'0');}} style={{background:C.btnBg,border:'1px solid '+C.btnBorder,borderRadius:5,color:C.btnText,fontSize:16,fontWeight:500,cursor:'pointer',fontFamily:'inherit',height:40,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>0</div>
              <div onClick={()=>setPhoneDigits(prev=>prev.slice(0,-1))} style={{background:'#334155',border:'1px solid #475569',borderRadius:5,color:C.danger,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',height:40,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}} onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'} onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>⌫</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
