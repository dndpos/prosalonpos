import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { useRBAC } from '../../lib/RBACContext.jsx';
import { ACTIONS, ACTION_META, hasPermission } from '../../lib/rbac';
import EmployeeManagementScreen from '../staff/EmployeeManagementScreen';
import ServiceCatalogScreen from '../services/ServiceCatalogScreen';
import MessagingModule from '../messaging/MessagingModule';
import GiftCardModule from '../gift-cards/GiftCardModule';
import LoyaltyModule from '../loyalty/LoyaltyModule';
import MembershipModule from '../membership/MembershipModule';
import PackageModule from '../packages/PackageModule';
import InventoryModule from '../inventory/InventoryModule';
import PayrollModule from '../payroll/PayrollModule';
import BillPayModule from '../bill-pay/BillPayModule';
import ReportsModule from '../reports/ReportsModule';
import KioskApp from '../kiosk/KioskApp';
import CustomerDisplayApp from '../customer-display/CustomerDisplayApp';
import OnlineBookingPortal from '../online-booking/OnlineBookingPortal';
import SalonSettingsPanel from './SalonSettingsPanel';

/**
 * Pro Salon POS — Owner & Manager Dashboard
 * Micro-frontend #3: Back office for owner and manager
 * Dark theme (matches station app), 1920×1080 target
 * 
 * Session 37: Salon Settings extracted to SalonSettingsPanel.jsx (TD-061)
 */

// ═══════════════════════════════════════════
// SIDEBAR SECTIONS
// ═══════════════════════════════════════════

const SECTIONS = [
  { id:'salon', label:'Salon Settings', icon:'💈' },
  { id:'reports', label:'Reports', icon:'📈', nav:'reports' },
  { id:'payroll', label:'Payroll', icon:'📄' },
  { id:'billpay', label:'Bill Pay', icon:'💳' },
  { id:'staff', label:'Staff management', icon:'👤' },
  { id:'services', label:'Services & pricing', icon:'✂️' },
  { id:'inventory', label:'Inventory', icon:'📦' },
  { id:'messaging', label:'Messaging', icon:'💬' },
  { id:'loyalty', label:'Loyalty', icon:'⭐' },
  { id:'membership', label:'Membership', icon:'👑' },
  { id:'packages', label:'Packages', icon:'🎫' },
  { id:'giftcards', label:'Gift cards', icon:'🎁' },
  { id:'online', label:'Online booking', icon:'🌐' },
  { id:'kiosk', label:'Kiosk preview', icon:'📱' },
  { id:'custdisplay', label:'Customer display', icon:'🖥️' },
  { id:'provider', label:'Provider Admin', icon:'🔑' },
  { id:'station', label:'▶ Station Mode', icon:'🖥️' },
];

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function OwnerDashboard({ salonSettings, onSettingsUpdate, onBack, onLaunchStation, onProviderAdmin, employees, setEmployees, empColumns, setEmpColumns, empRows, setEmpRows, empSlots, setEmpSlots, catalogLayout, categories, setCategories, services, setServices, catColumns, setCatColumns, catRows, setCatRows, svcColumns, setSvcColumns, svcRows, setSvcRows, catSlots, setCatSlots, svcSlots, setSvcSlots, clockPunches, onAddPunch, onEditPunch, onDeletePunch }) {
  var T = useTheme();
  var rbac = useRBAC();

  // Map sidebar sections → RBAC action keys
  // Sections not in this map have no clearance gate (e.g. kiosk preview, customer display)
  var SECTION_ACTIONS = {
    salon: ACTIONS.SALON_SETTINGS,
    reports: ACTIONS.REPORTS,
    payroll: ACTIONS.PAYROLL,
    billpay: ACTIONS.BILL_PAY,
    staff: ACTIONS.STAFF_MANAGEMENT,
    services: ACTIONS.SERVICE_CATALOG,
    inventory: ACTIONS.INVENTORY,
    messaging: ACTIONS.SEND_TEXT_BLASTS,
    loyalty: ACTIONS.LOYALTY_MEMBERSHIP,
    membership: ACTIONS.LOYALTY_MEMBERSHIP,
    packages: ACTIONS.PACKAGES_MANAGEMENT,
    giftcards: ACTIONS.GIFT_CARD_MANAGEMENT,
    online: ACTIONS.ONLINE_BOOKING_SETTINGS,
  };

  // ALL hooks must be declared before any conditional return (React rules of hooks)
  const [section, setSection] = useState(null);
  const [billPayInitTab, setBillPayInitTab] = useState(null);
  const [showPortalPreview, setShowPortalPreview] = useState(false);
  var settings = salonSettings || {};

  // ── PIN at the door ──
  // Fire PIN popup once on mount. If cancelled, go back to Staff View.
  var mountedRef = useRef(false);
  useEffect(function() {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (!rbac.dashboardUser) {
      rbac.enterDashboard(
        function() {
          // success — dashboardUser is set by RBACContext, component re-renders
        },
        function() {
          // cancelled — return to Staff View
          if (onBack) onBack();
        }
      );
    }
  }, []);

  // If no dashboardUser yet (PIN not entered or cancelled), show blocked state
  if (!rbac.dashboardUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", color: T.text, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Owner Dashboard</div>
          <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>PIN required to access</div>
          <div onClick={function() { rbac.enterDashboard(function() {}, function() { if (onBack) onBack(); }); }}
            style={{ padding: '12px 28px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-block' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
          >Enter PIN</div>
          {onBack && (
            <div onClick={onBack}
              style={{ marginTop: 16, padding: '8px 20px', color: T.textMuted, fontSize: 13, cursor: 'pointer' }}
            >← Back to Staff View</div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard user is set — check permissions per section ──
  var dashUser = rbac.dashboardUser;
  var rolePermsForCheck = (salonSettings || {}).role_permissions || {};

  function handleSectionClick(sectionId) {
    // Station Mode — exit dashboard and launch real station flow
    if (sectionId === 'station') {
      if (onLaunchStation) onLaunchStation();
      return;
    }
    // Provider Admin — navigate to provider admin panel
    if (sectionId === 'provider') {
      if (onProviderAdmin) onProviderAdmin();
      return;
    }
    var actionKey = SECTION_ACTIONS[sectionId];
    if (!actionKey) {
      setSection(sectionId);
      return;
    }
    if (hasPermission(dashUser, actionKey, rolePermsForCheck)) {
      setSection(sectionId);
    } else {
      rbac.dashboardOverride(actionKey, function() {
        setSection(sectionId);
      });
    }
  }

  function handleBack() {
    rbac.leaveDashboard();
    if (onBack) onBack();
  }

  const set = (key, val) => { if (onSettingsUpdate) onSettingsUpdate(key, val); };

  // ═══════════════════════════════════════
  // SHARED COMPONENTS (used by Online Booking settings)
  // ═══════════════════════════════════════
  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: 20, fontWeight: 500, color: T.text, marginBottom: 16 }}>{children}</div>
  );

  const Card = ({ children, style }) => (
    <div style={{ background: T.surface, borderRadius: 10, padding: '20px 24px', marginBottom: 16, ...style }}>{children}</div>
  );

  const FieldRow = ({ label, desc, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${T.borderLight}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? T.success : T.borderLight, cursor: 'pointer', position: 'relative', transition: 'background 150ms' }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'left 150ms' }} />
    </div>
  );

  const Input = ({ value, onChange, type = 'text', style: s }) => (
    <input value={value} onChange={e => onChange(e.target.value)} type={type} style={{ background: T.grid, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', width: 120, ...s }} />
  );

  // ═══════════════════════════════════════
  // SECTION RENDERERS
  // ═══════════════════════════════════════

  const renderSalon = () => (
    <SalonSettingsPanel salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} />
  );

  const renderMessaging = () => (
    <MessagingModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} />
  );

  const renderLoyalty = () => (
    <LoyaltyModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} catalogLayout={catalogLayout} />
  );

  const renderMembership = () => (
    <MembershipModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} catalogLayout={catalogLayout} />
  );

  const renderPackages = () => (
    <PackageModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} services={services} categories={categories} catalogLayout={catalogLayout} />
  );

  const renderGiftCards = () => (
    <GiftCardModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} />
  );

  const renderInventory = () => (
    <InventoryModule salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} />
  );

  const renderPayroll = () => (
    <PayrollModule salonSettings={salonSettings} onNavigate={function() { setBillPayInitTab('history-payroll'); setSection('billpay'); }} clockPunches={clockPunches} onAddPunch={onAddPunch} onEditPunch={onEditPunch} onDeletePunch={onDeletePunch} />
  );

  const renderReports = () => (
    <ReportsModule />
  );

  const renderKiosk = () => (
    <KioskApp />
  );

  const renderCustDisplay = () => (
    <CustomerDisplayApp />
  );

  const renderOnline = () => {
    if (showPortalPreview) {
      return (
        <div style={{ margin: '-24px -32px', height: 'calc(100% + 48px)', position: 'relative' }}>
          <button onClick={() => setShowPortalPreview(false)}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, height: 36, padding: '0 16px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Close Preview
          </button>
          <OnlineBookingPortal salonSettings={salonSettings} />
        </div>
      );
    }
    return (
      <>
        <SectionTitle>Online booking portal</SectionTitle>
        <Card>
          <FieldRow label="Online booking enabled"><Toggle value={settings.online_booking_enabled} onChange={v => set('online_booking_enabled', v)} /></FieldRow>
          {settings.online_booking_enabled && (
            <>
              <FieldRow label="Group booking enabled"><Toggle value={settings.online_group_booking_enabled} onChange={v => set('online_group_booking_enabled', v)} /></FieldRow>
              {settings.online_group_booking_enabled && <FieldRow label="Max group size"><Input value={settings.max_group_size} onChange={v => set('max_group_size', v)} type="number" style={{ width: 60 }} /></FieldRow>}
            </>
          )}
        </Card>
        {settings.online_booking_enabled && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setShowPortalPreview(true)}
              style={{ height: 48, padding: '0 28px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              👁 Preview what customers see
            </button>
          </div>
        )}
      </>
    );
  };

  const renderStaff = () => (
    <div style={{ margin: '-24px -32px', height: 'calc(100% + 48px)' }}>
      <EmployeeManagementScreen employees={employees} setEmployees={setEmployees} empColumns={empColumns} setEmpColumns={setEmpColumns} empRows={empRows} setEmpRows={setEmpRows} empSlots={empSlots} setEmpSlots={setEmpSlots} catalogLayout={catalogLayout} salonSettings={salonSettings} />
    </div>
  );

  const renderServices = () => (
    <div style={{ margin: '-24px -32px -24px -16px', height: 'calc(100% + 48px)' }}>
      <ServiceCatalogScreen categories={categories} setCategories={setCategories} services={services} setServices={setServices} catColumns={catColumns} setCatColumns={setCatColumns} catRows={catRows} setCatRows={setCatRows} svcColumns={svcColumns} setSvcColumns={setSvcColumns} svcRows={svcRows} setSvcRows={setSvcRows} catSlots={catSlots} setCatSlots={setCatSlots} svcSlots={svcSlots} setSvcSlots={setSvcSlots} />
    </div>
  );

  const renderers = {
    salon: renderSalon,
    messaging: renderMessaging, loyalty: renderLoyalty,
    membership: renderMembership, giftcards: renderGiftCards, packages: renderPackages, inventory: renderInventory,
    payroll: renderPayroll, billpay: function() { return <BillPayModule initTab={billPayInitTab} onInitTabConsumed={function() { setBillPayInitTab(null); }} />; }, online: renderOnline, reports: renderReports, kiosk: renderKiosk,
    custdisplay: renderCustDisplay,
    staff: renderStaff, services: renderServices,
  };

  // ═══════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100vh', background: T.chrome, fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
      {/* Left nav */}
      <div style={{ width: 220, background: '#162032', borderRight: `1px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative' }}>
        <AreaTag id="OW-SIDE" />
        <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>Pro Salon POS</div>
          <div style={{ fontSize: 12, color: T.text }}>Owner Dashboard</div>
        </div>
        <div style={{ flex: 1, padding: '8px 8px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map(s => {
            var active = section === s.id;
            var actionKey = SECTION_ACTIONS[s.id];
            var isLocked = actionKey && !hasPermission(dashUser, actionKey, rolePermsForCheck);
            var isStation = s.id === 'station';
            return (
              <div key={s.id} onClick={function() { handleSectionClick(s.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: isStation ? '10px 12px' : '9px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                  borderRadius: isStation ? 8 : 6, position: 'relative',
                  backgroundColor: isStation ? 'rgba(16,185,129,0.15)' : (active ? T.accentBg : T.chrome),
                  color: isStation ? '#6EE7B7' : (active ? T.accent : (isLocked ? T.textMuted : T.text)),
                  border: isStation ? '1px solid rgba(16,185,129,0.4)' : (active ? `1px solid ${T.accent}40` : `1px solid ${T.borderLight}`),
                  fontWeight: isStation ? 600 : 'normal',
                  marginTop: isStation ? 8 : 0,
                  transition: 'background-color 150ms, color 150ms, border-color 150ms',
                  userSelect: 'none',
                  opacity: isLocked ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {isLocked && <span style={{ fontSize: 11 }}>🔒</span>}
              </div>
            );
          })}
        </div>
        {onBack && (
        <div style={{ padding: '8px 8px', borderTop: `1px solid ${T.borderLight}` }}>
          <div onClick={handleBack}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#7C3AED'; e.currentTarget.style.borderColor = '#7C3AED'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.15)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.35)',
              transition: 'background-color 150ms, border-color 150ms', userSelect: 'none',
            }}>← Staff View</div>
        </div>
        )}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.borderLight}`, fontSize: 11, color: T.text }}>
          {(settings && settings.salon_name) || 'Your Salon'}<br/>v1.0 · ProSalonPOS
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: (!section || section === 'staff' || section === 'services' || section === 'messaging' || section === 'giftcards' || section === 'loyalty' || section === 'membership' || section === 'packages' || section === 'inventory' || section === 'payroll' || section === 'billpay' || section === 'reports' || section === 'kiosk' || section === 'custdisplay' || (section === 'online' && showPortalPreview)) ? 0 : '24px 32px', position: 'relative' }}>
        <AreaTag id="OW-PAGE" pos="tr" />
        <div style={{ maxWidth: (!section || section === 'salon' || section === 'staff' || section === 'services' || section === 'messaging' || section === 'giftcards' || section === 'loyalty' || section === 'membership' || section === 'packages' || section === 'inventory' || section === 'payroll' || section === 'billpay' || section === 'reports' || section === 'kiosk' || section === 'custdisplay' || (section === 'online' && showPortalPreview)) ? 'none' : 800, height: (!section || section === 'staff' || section === 'services' || section === 'messaging' || section === 'giftcards' || section === 'loyalty' || section === 'membership' || section === 'packages' || section === 'inventory' || section === 'payroll' || section === 'billpay' || section === 'reports' || section === 'kiosk' || section === 'custdisplay' || (section === 'online' && showPortalPreview)) ? '100%' : 'auto' }}>
          {section && renderers[section] ? renderers[section]() : (function(){
            var sName=(salonSettings||{}).salon_name||'Your Salon';
            var today=new Date();var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
            var dateStr=days[today.getDay()]+', '+months[today.getMonth()]+' '+today.getDate()+', '+today.getFullYear();
            return(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'calc(100vh - 48px)',textAlign:'center',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle, rgba(212,175,117,0.04) 0%, transparent 60%)',pointerEvents:'none'}}/>
              <div style={{width:60,height:1,background:'linear-gradient(90deg, transparent, #C9A96E, transparent)',marginBottom:40}}/>
              <div style={{fontSize:42,fontWeight:300,letterSpacing:'0.14em',color:'#F1F5F9',fontFamily:"'Georgia','Times New Roman',serif",lineHeight:1.1}}>{sName}</div>
              <div style={{width:120,height:1,background:'linear-gradient(90deg, transparent, rgba(201,169,110,0.4), transparent)',margin:'20px 0'}}/>
              <div style={{fontSize:12,fontWeight:400,letterSpacing:'0.3em',color:'rgba(241,245,249,0.4)',marginBottom:48,textTransform:'uppercase'}}>Owner Dashboard</div>
              <div style={{fontSize:12,color:'rgba(241,245,249,0.25)',fontWeight:300,letterSpacing:'0.06em'}}>{dateStr}</div>
            </div>);
          })()}
        </div>
      </div>
    </div>
  );
}
