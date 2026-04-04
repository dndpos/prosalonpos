import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Checkout Right Panel
 * Top: Services | Products toggle + Add Tech + Sell Gift Card + Combine Ticket.
 * Below: two bordered panels using shared CategoryGrid + ServiceGrid (view mode, read-only).
 * Layout comes from App.jsx via catalogLayout prop (set by owner in ServiceCatalogScreen).
 */
import { useState, useEffect } from 'react';
import { AVATAR_COLORS, getInitials } from '../../lib/calendarHelpers';
import { RETAIL_CATEGORIES, MOCK_RETAIL, CHECKOUT_STAFF, CHECKOUT_SETTINGS } from './checkoutBridge';
import { usePackageStore } from '../../lib/stores/packageStore';
import { useMembershipStore } from '../../lib/stores/membershipStore';
import CategoryGrid from '../../components/domain/CategoryGrid';
import ServiceGrid from '../../components/domain/ServiceGrid';
import { fmt } from '../../lib/formatUtils';
import AreaTag from '../../components/ui/AreaTag';

function Av({name,size=28,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<28?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export default function CheckoutTabs({ activeTechId, onAddItem, onAddTech, onSellGiftCard, onSellPackage, onSellMembership, client, openTickets, onCombineTicket, catalogLayout, salonSettings }){
  var C = useTheme();
  var MOCK_SERVICE_PACKAGES = usePackageStore(function(s) { return s.packages; });
  var MOCK_SERVICE_PACKAGE_ITEMS = usePackageStore(function(s) { return s.packageItems; });
  var membershipPlans = useMembershipStore(function(s) { return s.plans; });
  var membershipPlans = useMembershipStore(function(s) { return s.plans; });
  var cl = catalogLayout || {};
  var categories = cl.categories || [];
  var services = cl.services || [];
  var catColumns = cl.catColumns || 2;
  var catRows = cl.catRows || 9;
  var svcColumns = cl.svcColumns || 4;
  var svcRows = cl.svcRows || 3;
  var catSlots = cl.catSlots || {};
  var svcSlotMap = cl.svcSlots || {};

  var activeCategories = categories.filter(function(c){ return c.active; });

  var [activeTab, setActiveTab] = useState('services');
  var _firstSlotCatId = catSlots[0] || (activeCategories.length > 0 ? activeCategories[0].id : null);
  var [activeSvcCat, setActiveSvcCat] = useState(_firstSlotCatId);
  // Map retail categories + products into shapes for shared CategoryGrid + ServiceGrid
  var retailCatObjects = RETAIL_CATEGORIES.map(function(name, i) {
    var catId = 'rcat-' + name.toLowerCase().replace(/\s+/g, '-');
    return { id: catId, name: name, active: true, calendar_color: ['#8B5CF6','#06B6D4','#F59E0B'][i % 3] };
  });
  var retailAsServices = MOCK_RETAIL.map(function(item) {
    var catId = 'rcat-' + item.cat.toLowerCase().replace(/\s+/g, '-');
    return { id: item.id, name: item.name, price_cents: item.price_cents, category_ids: [catId], active: true, calendar_color: retailCatObjects.find(function(c){ return c.id === catId; })?.calendar_color || '#8B5CF6' };
  });
  // Auto-generate slot assignments per category so ServiceGrid renders them
  var retailSlots = {};
  retailCatObjects.forEach(function(cat) {
    var prods = retailAsServices.filter(function(p) { return p.category_ids && p.category_ids.includes(cat.id); });
    var catMap = {};
    prods.forEach(function(p, idx) { catMap[idx] = p.id; });
    retailSlots[cat.id] = catMap;
  });
  // Auto-generate catSlots for retail categories so CategoryGrid renders them
  var retailCatSlots = {};
  retailCatObjects.forEach(function(cat, idx) { retailCatSlots[idx] = cat.id; });
  var [activeProdCat, setActiveProdCat] = useState(retailCatObjects.length > 0 ? retailCatObjects[0].id : null);
  var [prodSearch, setProdSearch] = useState('');
  var [showProdSearch, setShowProdSearch] = useState(false);
  var [showGcForm, setShowGcForm] = useState(false);
  var [gcAmount, setGcAmount] = useState('');
  var [gcNumber, setGcNumber] = useState('');
  var [gcField, setGcField] = useState('number'); // 'number' | 'amount' — which field keyboard goes to

  // Reset field focus when modal opens
  useEffect(function() {
    if (showGcForm) { setGcField('number'); setGcNumber(''); setGcAmount(''); }
  }, [showGcForm]);

  // Keyboard listener — routes to whichever field is active
  useEffect(function() {
    if (!showGcForm) return;
    function onKey(e) {
      var key = e.key;
      if (gcField === 'number') {
        if (key === 'Backspace') { setGcNumber(function(prev) { return prev.slice(0, -1); }); return; }
        if (key === 'Enter') { if (gcNumber.trim()) setGcField('amount'); return; }
        if (key.length === 1) { setGcNumber(function(prev) { return (prev + key).toUpperCase(); }); }
      }
      if (gcField === 'amount') {
        if (key === 'Backspace') { setGcAmount(function(prev) { return npTap('⌫', prev); }); return; }
        if (/^\d$/.test(key)) { setGcAmount(function(prev) { return npTap(key, prev); }); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [showGcForm, gcField, gcNumber]);
  var [showTechPicker, setShowTechPicker] = useState(false);
  var [showCombine, setShowCombine] = useState(false);
  var [combineSelected, setCombineSelected] = useState([]);
  var [showPackagePicker, setShowPackagePicker] = useState(false);
  var [showMembershipPicker, setShowMembershipPicker] = useState(false);
  var hasClient = !!client;

  // Numpad helpers
  var npMode = CHECKOUT_SETTINGS.numpad_mode;
  function npDisplay(raw){ return npMode==='cash_register' ? (!raw?'0.00':(parseInt(raw,10)/100).toFixed(2)) : (raw||'0.00'); }
  function npTap(d,prev){
    if(d==='⌫') return prev.slice(0,-1);
    if(npMode==='cash_register'){ if(d==='.'||d==='00') return prev+'00'; if(!/\d/.test(d)) return prev; return prev+d; }
    if(d==='.'&&prev.includes('.')) return prev;
    return prev+d;
  }
  function npFloat(raw){ return npMode==='cash_register' ? (parseInt(raw,10)||0)/100 : parseFloat(raw)||0; }
  function npKeys(){ return npMode==='cash_register' ? ['7','8','9','4','5','6','1','2','3','00','0','⌫'] : ['7','8','9','4','5','6','1','2','3','.','0','⌫']; }

  // Retail tap handler — maps back to original retail item shape for checkout
  function handleRetailTap(svc){
    var item = MOCK_RETAIL.find(function(r){ return r.id === svc.id; });
    if(item) onAddItem({id:item.id,type:'retail',name:item.name,price_cents:item.price_cents,cat:item.cat});
  }

  function handleServiceTap(svc){
    onAddItem({id:'svc-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type:'service',name:svc.name,price_cents:svc.price_cents,original_price_cents:svc.price_cents,color:svc.calendar_color,dur:svc.default_duration_minutes,serviceCatalogId:svc.id});
  }
  function handleGcAdd(){
    var cents = npMode==='cash_register' ? (parseInt(gcAmount,10)||0) : Math.round(parseFloat(gcAmount)*100);
    if(cents<=0||!gcNumber.trim())return;
    onSellGiftCard(cents, gcNumber.trim()); setGcAmount(''); setGcNumber(''); setShowGcForm(false);
  }
  function handleGcPreset(amt){
    if(npMode==='cash_register') setGcAmount(String(amt*100));
    else setGcAmount(String(amt));
  }
  function handleTechSelect(tech){ onAddTech(tech); setShowTechPicker(false); }

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',position:'relative'}}>
      <AreaTag id="CO-TABS2" />
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderBottom:'1px solid '+C.borderLight,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:2}}>
          <button onClick={function(){setActiveTab('services');}} style={{padding:'7px 16px',background:activeTab==='services'?C.blue:C.grid,border:activeTab==='services'?'1px solid '+C.blue:'1px solid '+C.borderMedium,borderRadius:'6px 0 0 6px',color:activeTab==='services'?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Services</button>
          <button onClick={function(){setActiveTab('products');}} style={{padding:'7px 16px',background:activeTab==='products'?C.blue:C.grid,border:activeTab==='products'?'1px solid '+C.blue:'1px solid '+C.borderMedium,borderRadius:'0 6px 6px 0',color:activeTab==='products'?'#fff':C.textMuted,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Products</button>
        </div>
        <div style={{width:1,height:28,background:C.borderMedium}}/>
        <button onClick={function(){setShowTechPicker(true);}} style={{padding:'7px 14px',background:'#0E3D3D',border:'1px solid #1A5C5C',borderRadius:6,color:'#5EEAD4',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}
          onMouseEnter={function(e){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}
          onMouseLeave={function(e){e.currentTarget.style.background='#0E3D3D';e.currentTarget.style.color='#5EEAD4';e.currentTarget.style.borderColor='#1A5C5C';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}>+ Tech</button>
        <button onClick={function(){if(activeTechId)setShowGcForm(true);}} style={{padding:'7px 14px',background:'#3D2608',border:'1px solid #5C3A10',borderRadius:6,color:activeTechId?'#FBB040':'#7A6030',fontSize:13,fontWeight:500,cursor:activeTechId?'pointer':'default',fontFamily:'inherit',opacity:activeTechId?1:0.5}}
          onMouseEnter={function(e){if(activeTechId){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}}
          onMouseLeave={function(e){e.currentTarget.style.background='#3D2608';e.currentTarget.style.color=activeTechId?'#FBB040':'#7A6030';e.currentTarget.style.borderColor='#5C3A10';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}>Sell Gift Card</button>
        <button onClick={function(){if(openTickets&&openTickets.length>0){setCombineSelected([]);setShowCombine(true);}}} style={{padding:'7px 14px',background:'#1E2554',border:'1px solid #2E3A7A',borderRadius:6,color:openTickets&&openTickets.length>0?'#A5B4FC':'#5A6080',fontSize:13,fontWeight:500,cursor:openTickets&&openTickets.length>0?'pointer':'default',fontFamily:'inherit',opacity:openTickets&&openTickets.length>0?1:0.5}}
          onMouseEnter={function(e){if(openTickets&&openTickets.length>0){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}}
          onMouseLeave={function(e){e.currentTarget.style.background='#1E2554';e.currentTarget.style.color=openTickets&&openTickets.length>0?'#A5B4FC':'#5A6080';e.currentTarget.style.borderColor='#2E3A7A';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}>{'Combine Ticket'+(openTickets&&openTickets.length>0?' ('+openTickets.length+')':'')}</button>
        <button onClick={function(){if(hasClient)setShowPackagePicker(true);}} style={{padding:'7px 14px',background:'#0E2E1E',border:'1px solid #1A4A30',borderRadius:6,color:hasClient?'#6EE7B7':'#3D6B50',fontSize:13,fontWeight:500,cursor:hasClient?'pointer':'default',fontFamily:'inherit',opacity:hasClient?1:0.5}}
          onMouseEnter={function(e){if(hasClient){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}}
          onMouseLeave={function(e){e.currentTarget.style.background='#0E2E1E';e.currentTarget.style.color=hasClient?'#6EE7B7':'#3D6B50';e.currentTarget.style.borderColor='#1A4A30';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}>Sell Package</button>
        <button onClick={function(){if(hasClient)setShowMembershipPicker(true);}} style={{padding:'7px 14px',background:'#3B1228',border:'1px solid #5C1E3E',borderRadius:6,color:hasClient?'#F9A8D4':'#7A4060',fontSize:13,fontWeight:500,cursor:hasClient?'pointer':'default',fontFamily:'inherit',opacity:hasClient?1:0.5}}
          onMouseEnter={function(e){if(hasClient){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}}
          onMouseLeave={function(e){e.currentTarget.style.background='#3B1228';e.currentTarget.style.color=hasClient?'#F9A8D4':'#7A4060';e.currentTarget.style.borderColor='#5C1E3E';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}>Sell Membership</button>
        {activeTab==='products' && (
          <button onClick={function(){setShowProdSearch(!showProdSearch);if(showProdSearch)setProdSearch('');}} style={{padding:'7px 14px',background:showProdSearch?'#4A1A6A':'#2E1042',border:'1px solid '+(showProdSearch?'#6B2E8A':'#4A1A6A'),borderRadius:6,color:showProdSearch?'#E9D5FF':'#C4B5FD',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}
            onMouseEnter={function(e){if(!showProdSearch){e.currentTarget.style.borderWidth='2px';e.currentTarget.style.padding='6px 13px';}}}
            onMouseLeave={function(e){if(!showProdSearch){e.currentTarget.style.background='#2E1042';e.currentTarget.style.color='#C4B5FD';e.currentTarget.style.borderColor='#4A1A6A';e.currentTarget.style.borderWidth='1px';e.currentTarget.style.padding='7px 14px';}}}>🔍 Search</button>
        )}
      </div>

      {/* ── PRODUCT SEARCH BAR ── */}
      {showProdSearch && activeTab==='products' && (
        <div style={{padding:'6px 12px',borderBottom:'1px solid '+C.borderLight,display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          <input value={prodSearch} onChange={function(e){setProdSearch(e.target.value);}} placeholder="Search products..." autoFocus
            style={{flex:1,padding:'7px 12px',background:C.chromeDark,border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontFamily:'inherit',outline:'none'}} />
          {prodSearch && <div onClick={function(){setProdSearch('');}} style={{color:C.textMuted,cursor:'pointer',fontSize:13,padding:'4px 8px'}}>✕</div>}
        </div>
      )}

      {/* ── PRODUCT SEARCH RESULTS (replaces grid when searching) ── */}
      {showProdSearch && prodSearch.trim() && activeTab==='products' ? (
        <div style={{flex:1,overflow:'auto',padding:12}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:8}}>
            {MOCK_RETAIL.filter(function(item){return item.name.toLowerCase().includes(prodSearch.toLowerCase());}).map(function(item){
              return(
                <div key={item.id} onClick={function(){handleRetailTap({id:item.id,name:item.name,price_cents:item.price_cents,category_ids:['x']});}}
                  style={{padding:'12px 14px',background:C.grid,border:'1px solid '+C.borderMedium,borderRadius:8,cursor:'pointer',transition:'background 150ms, border-color 150ms'}}
                  onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;e.currentTarget.style.borderColor=C.blue;}}
                  onMouseLeave={function(e){e.currentTarget.style.background=C.grid;e.currentTarget.style.borderColor=C.borderMedium;}}>
                  <div style={{color:C.textPrimary,fontSize:14,fontWeight:500,marginBottom:4}}>{item.name}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:C.blueLight,fontSize:13,fontWeight:600}}>{fmt(item.price_cents)}</span>
                    <span style={{color:C.textMuted,fontSize:11}}>{item.cat}</span>
                  </div>
                </div>
              );
            })}
            {MOCK_RETAIL.filter(function(item){return item.name.toLowerCase().includes(prodSearch.toLowerCase());}).length===0 && (
              <div style={{color:C.textMuted,fontSize:13,padding:20,gridColumn:'1/-1',textAlign:'center'}}>No products match "{prodSearch.trim()}"</div>
            )}
          </div>
        </div>
      ) : (

      /* ── BODY: two bordered panels ── */
      <div style={{flex:1,display:'flex',overflow:'hidden',padding:12,gap:12}}>

        {/* Left: Category panel */}
        <div style={{width:200,minWidth:200,overflow:'auto',padding:14,display:'flex',flexDirection:'column',border:'1px solid '+C.borderMedium,borderRadius:8,background:C.chrome,flexShrink:0}}>
          {activeTab==='services' ? (
            <CategoryGrid
              categories={categories}
              activeCat={activeSvcCat}
              onSelect={function(id){ setActiveSvcCat(id); }}
              catSlots={catSlots}
              catColumns={catColumns}
              catRows={catRows}
              layout="grid"
              mode="view"
            />
          ) : (
            <CategoryGrid
              categories={retailCatObjects}
              activeCat={activeProdCat}
              onSelect={function(id){ setActiveProdCat(id); }}
              catSlots={retailCatSlots}
              catColumns={catColumns}
              catRows={catRows}
              layout="grid"
              mode="view"
            />
          )}
        </div>

        {/* Right: Service/Product card grid */}
        <div style={{flex:1,overflow:'auto',padding:14,border:'1px solid '+C.borderMedium,borderRadius:8,background:C.chrome,display:'flex',flexDirection:'column'}}>
          {!activeTechId?(
            <div style={{padding:'40px 20px',textAlign:'center'}}>
              <div style={{color:C.textMuted,fontSize:14,marginBottom:8}}>Select a technician first</div>
              <div style={{color:C.textMuted,fontSize:12}}>Tap "+ Tech" above to assign who is making this sale.</div>
            </div>
          ) : activeTab==='services' ? (
            <ServiceGrid
              services={services}
              activeCat={activeSvcCat}
              svcSlots={svcSlotMap}
              svcColumns={svcColumns}
              svcRows={svcRows}
              mode="select"
              onTap={handleServiceTap}
              showTime={!salonSettings || salonSettings.show_service_time !== false}
              showProductCost={!salonSettings || salonSettings.show_product_deduction !== false}
            />
          ) : (
            <ServiceGrid
              services={retailAsServices}
              activeCat={activeProdCat}
              svcSlots={retailSlots}
              svcColumns={svcColumns}
              svcRows={svcRows}
              mode="select"
              onTap={handleRetailTap}
              showTime={!salonSettings || salonSettings.show_service_time !== false}
              showProductCost={!salonSettings || salonSettings.show_product_deduction !== false}
            />
          )}
        </div>
      </div>
      )}

      {/* ── TECH PICKER MODAL ── */}
      {showTechPicker&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',zIndex:300,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'12vh'}}>
          <div style={{background:'#131B2E',border:'1px solid #1E2D45',borderRadius:16,width:560,maxHeight:'70vh',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={function(e){e.stopPropagation();}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #1E2D45',flexShrink:0}}>
              <div style={{fontSize:17,fontWeight:600,color:'#F1F5F9'}}>Select Technician</div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
                {CHECKOUT_STAFF.map(function(tech,i){
                  return(
                  <div key={tech.id} onClick={function(){handleTechSelect(tech);}}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'16px 8px',background:'#1A2340',border:'1px solid #1E2D45',borderRadius:12,cursor:'pointer',userSelect:'none',transition:'all 150ms'}}
                    onMouseEnter={function(e){e.currentTarget.style.background='#213055';e.currentTarget.style.borderColor=AVATAR_COLORS[i%AVATAR_COLORS.length];e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={function(e){e.currentTarget.style.background='#1A2340';e.currentTarget.style.borderColor='#1E2D45';e.currentTarget.style.transform='translateY(0)';}}>
                    <div style={{width:56,height:56,borderRadius:'50%',background:AVATAR_COLORS[i%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:600,color:'#fff'}}>
                      {tech.photo_url ? <img src={tech.photo_url} alt={tech.display_name} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover'}}/> : getInitials(tech.display_name)}
                    </div>
                    <span style={{color:'#F1F5F9',fontSize:13,fontWeight:600,textAlign:'center',lineHeight:'1.3'}}>{tech.display_name}</span>
                  </div>
                  );
                })}
              </div>
            </div>
            <div style={{padding:'12px 24px',borderTop:'1px solid #1E2D45',flexShrink:0}}>
              <div onClick={function(){setShowTechPicker(false);}} style={{width:'100%',height:40,background:'transparent',border:'1px solid #334155',borderRadius:8,color:'#F1F5F9',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                onMouseEnter={function(e){e.currentTarget.style.background='#1A2340';}}
                onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>Cancel</div>
            </div>
          </div>
        </div>
      )}

      {/* ── GIFT CARD MODAL ── */}
      {showGcForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setShowGcForm(false);}}>
          <div style={{background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:12,width:380,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={function(e){e.stopPropagation();}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.borderLight}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Sell Gift Card</div>
            </div>
            <div style={{padding:20}}>
              {/* ── CARD NUMBER FIELD ── */}
              <div style={{marginBottom:14}} onClick={function(){setGcField('number');}}>
                <div style={{fontSize:11,color:gcField==='number'?C.accent:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5,fontWeight:gcField==='number'?600:400}}>
                  {gcField==='number'?'▶ Gift Card Number':'Gift Card Number'}
                </div>
                <div style={{width:'100%',height:42,background:'#283548',border:'2px solid '+(gcField==='number'?C.accent:C.borderMedium),borderRadius:6,padding:'0 12px',color:gcNumber?C.textPrimary:C.textMuted,fontSize:15,fontWeight:500,fontFamily:'inherit',boxSizing:'border-box',letterSpacing:'0.06em',display:'flex',alignItems:'center',cursor:'pointer',userSelect:'none',transition:'border-color 150ms'}}>
                  <span style={{flex:1}}>{gcNumber || 'Tap here then type or scan'}</span>
                  {gcNumber&&<span onClick={function(e){e.stopPropagation();setGcNumber('');setGcField('number');}} style={{color:C.danger,fontSize:16,cursor:'pointer',padding:'0 4px'}}>✕</span>}
                  {gcField==='number'&&<span style={{color:C.accent,fontSize:13,marginLeft:4,opacity:0.8}}>|</span>}
                </div>
              </div>
              {/* ── AMOUNT FIELD ── */}
              <div style={{fontSize:11,color:gcField==='amount'?C.accent:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5,fontWeight:gcField==='amount'?600:400}}>
                {gcField==='amount'?'▶ Amount':'Amount'}
              </div>
              <div onClick={function(){setGcField('amount');}} style={{background:gcField==='amount'?C.grid:'#283548',border:'2px solid '+(gcField==='amount'?C.accent:C.borderMedium),borderRadius:8,padding:'10px 16px',marginBottom:10,textAlign:'center',cursor:'pointer',transition:'all 150ms'}}>
                <span style={{color:C.textPrimary,fontSize:26,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{'$'+npDisplay(gcAmount)}</span>
              </div>
              {/* ── PRESET AMOUNTS ── */}
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {[25,50,75,100].map(function(amt){return(
                  <div key={amt} onClick={function(){setGcField('amount');handleGcPreset(amt);}} style={{flex:1,padding:'8px 0',background:C.grid,border:'1px solid '+C.borderLight,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}} onMouseLeave={function(e){e.currentTarget.style.background=C.grid;}}>{'$'+amt}</div>
                );})}
              </div>
              {/* ── NUMPAD (only active when on amount field) ── */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,opacity:gcField==='amount'?1:0.35,pointerEvents:gcField==='amount'?'auto':'none'}}>
                {npKeys().map(function(d){return(
                  <div key={d} onClick={function(){setGcAmount(function(prev){return npTap(d,prev);});}}
                    style={{height:46,background:d==='⌫'?'#334155':C.btnBg,border:d==='⌫'?'1px solid #475569':'1px solid '+C.btnBorder,borderRadius:6,color:d==='⌫'?C.danger:C.btnText,fontSize:d==='⌫'?16:d==='00'?18:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}
                    onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
                    onMouseLeave={function(e){e.currentTarget.style.background=C.grid;}}>{d}</div>
                );})}
              </div>
              {(function(){var v=npFloat(gcAmount); var valid=v>0&&gcNumber.trim().length>0; return(
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={function(){setShowGcForm(false);}} style={{flex:1,height:44,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
                <button onClick={handleGcAdd} disabled={!valid}
                  style={{flex:1,height:44,background:valid?C.blue:'#334155',border:'none',borderRadius:6,color:valid?'#fff':C.textMuted,fontSize:14,fontWeight:500,cursor:valid?'pointer':'default',fontFamily:'inherit'}}>Add to Ticket</button>
              </div>);})()}
            </div>
          </div>
        </div>
      )}

      {/* ── COMBINE TICKET MODAL ── */}
      {showCombine&&openTickets&&openTickets.length>0&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setShowCombine(false);setCombineSelected([]);}}>
          <div style={{background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:12,width:480,maxHeight:'70vh',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}} onClick={function(e){e.stopPropagation();}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.borderLight,flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Combine Ticket</div>
              <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Select open tickets to merge into the current checkout</div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'12px 16px'}}>
              {[].concat(openTickets).sort(function(a,b){return a.ticketNumber-b.ticketNumber;}).map(function(ticket){
                var total=ticket.items.reduce(function(s,it){return s+(it.price_cents*(it.qty||1));},0);
                var checked=combineSelected.includes(ticket.id);
                var byTech={};
                ticket.items.forEach(function(it){ var k=it.tech||'Unknown'; if(!byTech[k])byTech[k]=[]; byTech[k].push(it); });
                return(
                  <button key={ticket.id} onClick={function(){setCombineSelected(function(prev){return prev.includes(ticket.id)?prev.filter(function(x){return x!==ticket.id;}):[].concat(prev,[ticket.id]);});}}
                    style={{display:'flex',alignItems:'stretch',gap:12,width:'100%',padding:'12px 14px',background:checked?C.blueTint:C.chromeDark,border:checked?'1px solid '+C.blue:'1px solid '+C.borderLight,borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:6}}
                    onMouseEnter={function(e){if(!checked){e.currentTarget.style.borderColor=C.blue;}}}
                    onMouseLeave={function(e){if(!checked){e.currentTarget.style.borderColor=C.borderLight;}}}>
                    <div style={{display:'flex',alignItems:'center',flexShrink:0}}>
                      <div style={{width:22,height:22,borderRadius:4,border:checked?'2px solid '+C.blue:'2px solid '+C.borderMedium,background:checked?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {checked&&<span style={{color:'#fff',fontSize:14,fontWeight:700}}>✓</span>}
                      </div>
                    </div>
                    <div style={{width:40,height:40,borderRadius:8,background:'rgba(217,119,6,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:C.warning,fontSize:13,fontWeight:700}}>{'#'+ticket.ticketNumber}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.textPrimary,fontSize:14,fontWeight:600,marginBottom:3}}>{ticket.clientName||'Walk-in'}</div>
                      {Object.entries(byTech).map(function(entry){var tech=entry[0]; var items=entry[1]; return(
                        <div key={tech} style={{fontSize:12}}>
                          <span style={{color:C.blueLight,fontWeight:600}}>{tech}</span>
                          <span style={{color:C.textMuted}}>{' — '+items.map(function(it){return it.name;}).join(', ')}</span>
                        </div>
                      );})}
                    </div>
                    <div style={{display:'flex',alignItems:'center',flexShrink:0}}>
                      <span style={{color:C.textPrimary,fontSize:15,fontWeight:700}}>{'$'+(total/100).toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
              {openTickets.length===0&&<div style={{padding:'20px',textAlign:'center',color:C.textMuted,fontSize:13}}>No open tickets to combine</div>}
            </div>
            <div style={{padding:'12px 20px',borderTop:'1px solid '+C.borderLight,flexShrink:0,display:'flex',gap:8}}>
              <button onClick={function(){setShowCombine(false);setCombineSelected([]);}} style={{flex:1,height:40,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
              <button onClick={function(){combineSelected.forEach(function(id){onCombineTicket(id);});setCombineSelected([]);setShowCombine(false);}} disabled={combineSelected.length===0}
                style={{flex:1,height:40,background:combineSelected.length>0?C.success:'#334155',border:'none',borderRadius:6,color:combineSelected.length>0?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:combineSelected.length>0?'pointer':'default',fontFamily:'inherit'}}>
                {'Combine'+(combineSelected.length>0?' ('+combineSelected.length+' ticket'+(combineSelected.length!==1?'s':'')+')':'')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SELL PACKAGE PICKER MODAL ── */}
      {showPackagePicker&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setShowPackagePicker(false);}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:10,width:420,maxHeight:'70vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.borderLight,flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:600,color:C.textPrimary}}>Sell Package</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Select a package to add to this ticket</div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'8px 12px'}}>
              {MOCK_SERVICE_PACKAGES.filter(function(p){return p.active;}).length===0&&(
                <div style={{padding:30,textAlign:'center',color:C.textMuted,fontSize:13}}>No active packages available.</div>
              )}
              {MOCK_SERVICE_PACKAGES.filter(function(p){return p.active;}).map(function(pkg){
                var items=MOCK_SERVICE_PACKAGE_ITEMS.filter(function(i){return i.package_id===pkg.id;});
                return(
                  <div key={pkg.id}
                    onClick={function(){
                      if(onSellPackage)onSellPackage(pkg,items);
                      setShowPackagePicker(false);
                    }}
                    style={{padding:'12px 14px',marginBottom:6,borderRadius:6,border:'1px solid '+C.borderMedium,cursor:'pointer',background:C.chromeDark}}
                    onMouseEnter={function(e){e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=C.grid;}}
                    onMouseLeave={function(e){e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>{pkg.name}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.blue}}>{fmt(pkg.price_cents)}</span>
                    </div>
                    {pkg.description&&<div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>{pkg.description}</div>}
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {items.map(function(item){
                        return(<span key={item.id} style={{fontSize:10,padding:'2px 8px',borderRadius:4,background:C.grid,color:C.textSecondary,fontWeight:500}}>{item.quantity}× {item.service_name}</span>);
                      })}
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:6,fontSize:10,color:C.textMuted}}>
                      <span>{pkg.expiration_enabled?'Expires '+pkg.expiration_days+' days':'No expiration'}</span>
                      {pkg.transferable&&<span>Transferable</span>}
                      <span>{pkg.refundable?'Refundable':'Non-refundable'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:'12px 20px',borderTop:'1px solid '+C.borderLight,flexShrink:0}}>
              <button onClick={function(){setShowPackagePicker(false);}} style={{width:'100%',height:38,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SELL MEMBERSHIP PICKER MODAL ── */}
      {showMembershipPicker&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setShowMembershipPicker(false);}}>
          <div onClick={function(e){e.stopPropagation();}} style={{background:C.chrome,border:'1px solid '+C.borderMedium,borderRadius:10,width:420,maxHeight:'70vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.borderLight,flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:600,color:'#F9A8D4'}}>Sell Membership</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Select a membership plan for {client?client.name||client.display_name:'this client'}</div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'8px 12px'}}>
              {membershipPlans.filter(function(p){return p.active;}).length===0&&(
                <div style={{padding:30,textAlign:'center',color:C.textMuted,fontSize:13}}>No active membership plans available. Create plans in Owner Dashboard → Membership.</div>
              )}
              {membershipPlans.filter(function(p){return p.active;}).map(function(plan){
                var perks=plan.perks||[];
                var cycleDays=plan.billing_cycle_days||30;
                var cycleLabel=cycleDays===30?'mo':cycleDays===90?'qtr':cycleDays===365?'yr':cycleDays+'d';
                return(
                  <div key={plan.id}
                    onClick={function(){
                      if(onSellMembership)onSellMembership(plan);
                      setShowMembershipPicker(false);
                    }}
                    style={{padding:'12px 14px',marginBottom:6,borderRadius:6,border:'1px solid '+C.borderMedium,cursor:'pointer',background:C.chromeDark}}
                    onMouseEnter={function(e){e.currentTarget.style.borderColor='#F9A8D4';e.currentTarget.style.background=C.grid;}}
                    onMouseLeave={function(e){e.currentTarget.style.borderColor=C.borderMedium;e.currentTarget.style.background=C.chromeDark;}}
                  >

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.textPrimary}}>{plan.name}</span>
                      <span style={{fontSize:14,fontWeight:700,color:'#F9A8D4'}}>{fmt(plan.price_cents)}<span style={{fontSize:11,fontWeight:400,color:C.textMuted}}>/{cycleLabel}</span></span>
                    </div>
                    {plan.description&&<div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>{plan.description}</div>}
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {perks.map(function(pk){
                        var label='';
                        if(pk.type==='percentage_discount')label=(pk.discount_percentage||0)+'% off';
                        else if(pk.type==='free_service')label=(pk.quantity_per_cycle||1)+'× free service';
                        else if(pk.type==='service_credit')label=fmt(pk.credit_amount_cents||0)+' credit';
                        if(!label)return null;
                        return(<span key={pk.id} style={{fontSize:10,padding:'2px 8px',borderRadius:4,background:'rgba(249,168,212,0.15)',color:'#F9A8D4',fontWeight:500}}>{label}</span>);
                      })}
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:6,fontSize:10,color:C.textMuted}}>
                      <span>{plan.payment_method==='upfront'?'Pay upfront':'Pay each cycle'}</span>
                      {plan.freeze_allowed&&<span>Freeze allowed</span>}
                      {plan.credit_rollover&&<span>Credits roll over</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:'12px 20px',borderTop:'1px solid '+C.borderLight,flexShrink:0}}>
              <button onClick={function(){setShowMembershipPicker(false);}} style={{width:'100%',height:38,background:'transparent',border:'1px solid '+C.borderMedium,borderRadius:6,color:C.textPrimary,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
