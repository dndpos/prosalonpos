import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Tip Distribution
 * Split tip across multiple technicians on a ticket.
 * 
 * Modes (owner setting):
 *   proportional — split by each tech's service total
 *   even — equal split
 *   per_tech — start at $0, fully manual
 *
 * Rules:
 *   - Preset buttons (Even / Proportional / Custom) at top
 *   - Tap any tech's amount → numpad to fine-tune
 *   - Confirm disabled until distributed total === tip total
 *   - canSkip allows deferring distribution (ticket still closes)
 */
import { useState, useMemo } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { CHECKOUT_STAFF, CHECKOUT_SETTINGS } from './checkoutBridge';
import { fmt } from '../../lib/formatUtils';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import AreaTag from '../../components/ui/AreaTag';


function Av({name,size=36,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:12,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

function numpadDisplay(raw, mode){
  if(mode==='cash_register'){
    if(!raw) return '0.00';
    return (parseInt(raw,10)/100).toFixed(2);
  }
  return raw || '0.00';
}
function numpadTap(d, prev, mode){
  if(d==='⌫') return prev.slice(0,-1);
  if(mode==='cash_register'){
    if(d==='.'||d==='00') return prev+'00';
    if(!/\d/.test(d)) return prev;
    return prev+d;
  }
  if(d==='.'&&prev.includes('.')) return prev;
  return prev+d;
}
function numpadToCents(raw, mode){
  if(mode==='cash_register') return parseInt(raw,10)||0;
  return Math.round(parseFloat(raw)*100)||0;
}
function numpadKeys(mode){
  return mode==='cash_register'
    ? ['7','8','9','4','5','6','1','2','3','00','0','⌫']
    : ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
}

export default function TipDistribution({ tipAmount, items, defaultMode, initialDistributions, canSkip, onConfirm, onSkip }){
  var C = useTheme();
  const npMode = CHECKOUT_SETTINGS.numpad_mode;

  // Build tech list with service totals
  const techList = useMemo(()=>{
    const map = {};
    items.forEach(it=>{
      if(!it.techId) return;
      if(!map[it.techId]) map[it.techId] = { techId:it.techId, techName:it.tech||'Unknown', serviceTotalCents:0 };
      map[it.techId].serviceTotalCents += (it.price_cents||0) * (it.qty||1);
    });
    return Object.values(map);
  },[items]);

  // Calculate distributions based on mode
  function calcDistributions(mode){
    if(mode==='even'){
      const base = Math.floor(tipAmount / techList.length);
      const remainder = tipAmount - base * techList.length;
      return techList.map((t,i)=>({ techId:t.techId, techName:t.techName, amount_cents: base + (i < remainder ? 1 : 0) }));
    }
    if(mode==='proportional'){
      const grandTotal = techList.reduce((s,t)=>s+t.serviceTotalCents,0);
      if(grandTotal===0){
        // Fallback to even if no service totals
        const base = Math.floor(tipAmount / techList.length);
        const remainder = tipAmount - base * techList.length;
        return techList.map((t,i)=>({ techId:t.techId, techName:t.techName, amount_cents: base + (i < remainder ? 1 : 0) }));
      }
      let distributed = 0;
      return techList.map((t,i)=>{
        if(i===techList.length-1){
          // Last tech gets remainder to avoid rounding issues
          return { techId:t.techId, techName:t.techName, amount_cents: tipAmount - distributed };
        }
        const share = Math.round(tipAmount * t.serviceTotalCents / grandTotal);
        distributed += share;
        return { techId:t.techId, techName:t.techName, amount_cents: share };
      });
    }
    // per_tech — all zeros
    return techList.map(t=>({ techId:t.techId, techName:t.techName, amount_cents:0 }));
  }

  const [activeMode, setActiveMode] = useState(defaultMode || 'proportional');
  const [distributions, setDistributions] = useState(()=>{
    if(initialDistributions && initialDistributions.length > 0) return initialDistributions;
    return calcDistributions(defaultMode || 'proportional');
  });
  const [editingTechId, setEditingTechId] = useState(null);
  const [editInput, setEditInput] = useState('');

  // Keyboard → numpad bridge for tip amount edit
  useNumpadKeyboard(!!editingTechId, function(d){ setEditInput(function(p){ return numpadTap(d,p,npMode); }); }, function(){ setEditInput(function(p){ return numpadTap('⌫',p,npMode); }); }, confirmEdit, function(){ setEditingTechId(null); setEditInput(''); }, [editingTechId]);

  const distributedTotal = distributions.reduce((s,d)=>s+d.amount_cents,0);
  const balanced = distributedTotal === tipAmount;
  const diff = tipAmount - distributedTotal;

  function applyMode(mode){
    setActiveMode(mode);
    setDistributions(calcDistributions(mode));
    setEditedTechs(new Set());
  }

  function startEdit(techId){
    setEditingTechId(techId);
    setEditInput('');
  }
  const [editedTechs, setEditedTechs] = useState(new Set()); // track manually edited techs

  function confirmEdit(){
    const cents = numpadToCents(editInput, npMode);
    const newEdited = new Set(editedTechs); newEdited.add(editingTechId);
    // Update edited tech's amount
    let updated = distributions.map(d=> d.techId===editingTechId ? {...d, amount_cents:cents} : d);
    // Auto-fill last remaining tech with remainder
    const uneditedTechs = updated.filter(d=> !newEdited.has(d.techId));
    if(uneditedTechs.length === 1){
      const editedSum = updated.filter(d=> newEdited.has(d.techId)).reduce((s,d)=>s+d.amount_cents,0);
      const remainder = Math.max(0, tipAmount - editedSum);
      const lastId = uneditedTechs[0].techId;
      updated = updated.map(d=> d.techId===lastId ? {...d, amount_cents:remainder} : d);
    }
    setDistributions(updated);
    setEditedTechs(newEdited);
    setEditingTechId(null);
    setEditInput('');
    setActiveMode('custom');
  }

  return(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:C.chrome,fontFamily:"'Inter',system-ui,sans-serif",position:'relative'}}>
      <AreaTag id="CO-TIPDIST" />
      <div style={{width:420,maxHeight:'85vh',display:'flex',flexDirection:'column'}}>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:20,flexShrink:0}}>
          <div style={{fontSize:18,fontWeight:600,color:C.textPrimary,marginBottom:4}}>Distribute Tip</div>
          <div style={{fontSize:28,fontWeight:700,color:C.blueLight}}>{fmt(tipAmount)}</div>
          <div style={{color:C.textMuted,fontSize:12,marginTop:4}}>{techList.length} technicians on this ticket</div>
        </div>

        {/* Mode presets */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:16,flexShrink:0}}>
          {[{id:'even',label:'Even'},{id:'proportional',label:'Proportional'},{id:'custom',label:'Custom'}].map(m=>{
            const active = activeMode===m.id;
            return(
              <button key={m.id} onClick={()=>{ if(m.id!=='custom') applyMode(m.id); else { setDistributions(prev=>prev.map(d=>({...d, amount_cents:0}))); setActiveMode('custom'); setEditedTechs(new Set()); } }}
                style={{height:40,background:active?C.blueTint:C.chromeDark,border:active?`1px solid ${C.blue}`:`1px solid ${C.borderMedium}`,borderRadius:6,color:active?C.blueLight:C.textPrimary,fontSize:13,fontWeight:active?600:400,cursor:'pointer',fontFamily:'inherit'}}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=C.blue;}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=C.borderMedium;}}}>
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Tech rows */}
        <div style={{flex:1,overflow:'auto',marginBottom:12}}>
          {distributions.map((d,i)=>{
            const tech = techList.find(t=>t.techId===d.techId);
            const staff = CHECKOUT_STAFF.find(s=>s.id===d.techId);
            return(
              <div key={d.techId} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:C.chromeDark,border:`1px solid ${C.borderLight}`,borderRadius:8,marginBottom:6}}>

                <Av name={d.techName} size={40} index={i} photo={staff?.photo_url}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:C.textPrimary,fontSize:14,fontWeight:600}}>{d.techName}</div>
                  <div style={{color:C.textMuted,fontSize:11}}>Services: {fmt(tech?.serviceTotalCents||0)}</div>
                </div>
                <button onClick={()=>startEdit(d.techId)}
                  style={{minWidth:90,height:40,background:C.grid,border:`1px solid ${C.borderMedium}`,borderRadius:6,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderMedium;}}>
                  <span style={{color:C.textPrimary,fontSize:16,fontWeight:600}}>{fmt(d.amount_cents)}</span>
                  <span style={{color:C.textMuted,fontSize:10}}>✎</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Running total */}
        <div style={{padding:'10px 14px',background:balanced?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.1)',border:balanced?'1px solid rgba(5,150,105,0.3)':'1px solid rgba(220,38,38,0.3)',borderRadius:8,marginBottom:14,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:balanced?C.success:C.danger,fontSize:13,fontWeight:500}}>
              Distributed: {fmt(distributedTotal)} / {fmt(tipAmount)}
            </span>
            {!balanced && (
              <span style={{color:C.danger,fontSize:12,fontWeight:500}}>
                {diff > 0 ? `${fmt(diff)} remaining` : `${fmt(Math.abs(diff))} over`}
              </span>
            )}
            {balanced && (
              <span style={{color:C.success,fontSize:12,fontWeight:500}}>✓ Balanced</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:8,flexShrink:0}}>
          {canSkip && (
            <button onClick={onSkip}
              style={{flex:1,height:44,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:8,color:C.textPrimary,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
              Skip for Now
            </button>
          )}
          <button onClick={()=>onConfirm(distributions)} disabled={!balanced}
            style={{flex:canSkip?1.5:1,height:44,background:balanced?C.success:'#334155',border:'none',borderRadius:8,color:balanced?'#fff':C.textMuted,fontSize:14,fontWeight:600,cursor:balanced?'pointer':'default',fontFamily:'inherit'}}>
            Confirm Split
          </button>
        </div>
      </div>

      {/* ── NUMPAD EDIT MODAL ── */}
      {editingTechId&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>{setEditingTechId(null);setEditInput('');}}>
          <div style={{background:C.chrome,border:`1px solid ${C.borderMedium}`,borderRadius:12,width:320,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.borderLight}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Edit Tip Amount</div>
              <div style={{color:C.textMuted,fontSize:12}}>{distributions.find(d=>d.techId===editingTechId)?.techName}</div>
            </div>
            <div style={{padding:16}}>
              <div style={{background:C.grid,borderRadius:8,padding:'12px 16px',marginBottom:12,textAlign:'center'}}>
                <span style={{color:C.textPrimary,fontSize:28,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>${numpadDisplay(editInput,npMode)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {numpadKeys(npMode).map(d=>(
                  <div key={d} onClick={()=>setEditInput(prev=>numpadTap(d,prev,npMode))}
                    style={{height:50,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#E2E8F0'}
                    onMouseLeave={e=>e.currentTarget.style.background=C.btnBg}>{d}</div>
                ))}
              </div>
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button onClick={()=>{setEditingTechId(null);setEditInput('');}} style={{flex:1,height:40,background:'transparent',border:`1px solid ${C.borderMedium}`,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={confirmEdit}
                  style={{flex:1,height:40,background:C.blue,border:'none',borderRadius:6,color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                  Set {editInput ? `$${numpadDisplay(editInput,npMode)}` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
