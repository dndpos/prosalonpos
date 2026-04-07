import { ThemeContext, useTheme } from './lib/ThemeContext';
import { getTheme } from './lib/theme';
import { useState, useEffect, useRef } from 'react';
import { useStaffStore } from './lib/stores/staffStore';
import { useServiceStore } from './lib/stores/serviceStore';
import { useSettingsStore } from './lib/stores/settingsStore';
import { useClientStore } from './lib/stores/clientStore';
import { useAppointmentStore } from './lib/stores/appointmentStore';
import { bootstrapStores } from './lib/hooks/useBootstrap';
import { useTicketStore } from './lib/stores/ticketStore';
import { useGiftCardStore } from './lib/stores/giftCardStore';
import { useInventoryStore } from './lib/stores/inventoryStore';
import { useLoyaltyStore } from './lib/stores/loyaltyStore';
import { useMembershipStore } from './lib/stores/membershipStore';
import { useMessagingStore } from './lib/stores/messagingStore';
import { usePayrollStore } from './lib/stores/payrollStore';
import { useCommissionStore } from './lib/stores/commissionStore';
import { useReportsStore } from './lib/stores/reportsStore';
import { usePackageStore } from './lib/stores/packageStore';
import { checkBackend, isPaired, getPairedSalonName, isLoggedIn, getToken, onAuthExpired } from './lib/apiClient';
import { autoSetup as printAutoSetup, isQzReady, printReceipt, printTechSlip, printDrawerSummary, printToNamedPrinter } from './lib/printService';
import { connectSocket, onSocketEvent, disconnectSocket, emitSocket } from './lib/socket';
import VirtualKeyboard from './components/ui/VirtualKeyboard';
import OnlineBookingsPopup from './components/ui/OnlineBookingsPopup';
import GiftCardBalancePopup from './components/ui/GiftCardBalancePopup';
import useTicketHandlers from './lib/hooks/useTicketHandlers';
import useGridPersistence from './lib/hooks/useGridPersistence';
import useCashDrawer from './lib/hooks/useCashDrawer';
import useTimeClock from './lib/hooks/useTimeClock';
import useGridLayoutState from './lib/hooks/useGridLayoutState';
import { RBACProvider, useRBAC } from './lib/RBACContext.jsx';
import { ToastProvider } from './lib/ToastContext.jsx';
import StationSetup from './modules/setup/StationSetup';
import LicenseActivationScreen from './modules/setup/LicenseActivationScreen';
import LoginScreen from './modules/login/LoginScreen';
import CalendarDayView from './modules/appointments/CalendarDayView';
import CheckoutScreen from './modules/checkout/CheckoutScreen';
import TicketViewer from './modules/checkout/TicketViewer';
import ClientList from './modules/clients/ClientList';
import GiftCardModule from './modules/gift-cards/GiftCardModule';
import LoyaltyModule from './modules/loyalty/LoyaltyModule';
import MembershipModule from './modules/membership/MembershipModule';
import InventoryModule from './modules/inventory/InventoryModule';
import MessagingModule from './modules/messaging/MessagingModule';
import PayrollModule from './modules/payroll/PayrollModule';
import OnlineBookingPortal from './modules/online-booking/OnlineBookingPortal';
import KioskApp from './modules/kiosk/KioskApp';
import CustomerDisplayApp from './modules/customer-display/CustomerDisplayApp';
import TechSelectApp from './modules/tech-select/TechSelectApp';
import TechPinApp from './modules/tech-pin/TechPinApp';
import OwnerDashboard from './modules/owner-dashboard/OwnerDashboard';
import ReportsModule from './modules/reports/ReportsModule';
import ServiceCatalogScreen from './modules/services/ServiceCatalogScreen';
import EmployeeManagementScreen from './modules/staff/EmployeeManagementScreen';
import CashierModule from './modules/cashier/CashierModule';
import TimeClockPopup from './modules/time-clock/TimeClockPopup';
import ProviderAdminPanel from './modules/provider-admin/ProviderAdminPanel';
import AreaTag from './components/ui/AreaTag';
import { phoneToDigits } from './lib/formatUtils';
function enrichClientBalance(client) {
  if (!client) return client;
  if (client.outstanding_balance_cents) return client;
  var storeClients = useClientStore.getState().clients || [];
  if (client.id) {
    var idMatch = storeClients.find(function(c) { return c.id === client.id; });
    if (idMatch) return Object.assign({}, client, { outstanding_balance_cents: idMatch.outstanding_balance_cents || 0 });
  }
  var phone = (client.phone || '').replace(/\D/g, '');
  var match = storeClients.find(function(c) { return phoneToDigits(c.phone) === phone; });
  return Object.assign({}, client, { outstanding_balance_cents: (match && match.outstanding_balance_cents) || 0 });
}

// Staff view nav: Calendar, Online Bookings (with notification badge), Checkout, Clients
const NAV_ITEMS = [
  { id: 'calendar',        label: 'Calendar' },
  { id: 'online-notifs',   label: 'Online Bookings', hasBadge: true },
  { id: 'checkout',        label: 'Checkout' },
  { id: 'tickets',         label: 'Tickets' },
  { id: 'clients',         label: 'Clients' },
];

export default function App() {
  const [activePage, setActivePage] = useState('calendar');
  const [showOwner, setShowOwner] = useState(false);
  const [showOnlinePopup, setShowOnlinePopup] = useState(false);
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [scrollTarget, setScrollTarget] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [activeTech, setActiveTech] = useState(null);
  const [stationPaired, setStationPaired] = useState(isPaired());
  const [licenseActivated, setLicenseActivated] = useState(false);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(function() { return !!getToken(); });
  const [loggedInStaff, setLoggedInStaff] = useState(null);
  var _hasNavigated = activePage !== 'calendar';

  var _staffSource = useStaffStore(function(s) { return s.source; });
  var _staffError = useStaffStore(function(s) { return s.error; });

  // ── License check on startup ──
  useEffect(function() {
    if (!stationPaired) { setLicenseChecked(true); setLicenseActivated(true); return; }
    var licenseBase = window.location.port === '5173'
      ? 'http://localhost:3001/api/v1/license'
      : window.location.protocol + '//' + window.location.host + '/api/v1/license';
    fetch(licenseBase + '/status', { signal: AbortSignal.timeout(3000) })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var status = data && data.licenseStatus && data.licenseStatus.status;
        if (status === 'valid' || status === 'dev_mode') setLicenseActivated(true);
        setLicenseChecked(true);
      })
      .catch(function() { setLicenseChecked(true); });
  }, []);

  useEffect(function() {
    onAuthExpired(function() { setLoggedIn(false); setLoggedInStaff(null); });
  }, []);

  // ── Salon Settings state ──
  var [salonSettings, setSalonSettings] = useState({
    salon_name: '', salon_phone: '', salon_email: '', salon_address: '',
    open_hour: 9, open_min: 0, close_hour: 19, close_min: 0, buffer_minutes: 30,
    tax_rate_percentage: 7.5, tip_enabled: true, tip_presets: [18, 20, 25],
    station_start_page: 'calendar', station_id_method: 'avatar', station_mode: 'checkout',
    station_can_process_payments: true,
  });
  var settingsStoreUpdate = useSettingsStore(function(s) { return s.updateSetting; });
  function handleSettingsUpdate(key, val) {
    setSalonSettings(function(prev) { var next = Object.assign({}, prev); next[key] = val; return next; });
    settingsStoreUpdate(key, val);
  }

  var ss = salonSettings || {};
  var stationConfig = {
    id_method: ss.station_id_method || 'avatar',
    station_mode: ss.station_mode || 'checkout',
    can_process_payments: ss.station_can_process_payments !== false
  };

  // ── Extracted hooks ──
  var gridPersist = useGridPersistence(salonSettings, handleSettingsUpdate);
  var drawer = useCashDrawer();
  var timeClock = useTimeClock();
  var grid = useGridLayoutState(salonSettings, handleSettingsUpdate, gridPersist);
  var C = getTheme(salonSettings.theme || 'dark');

  var openTickets = useTicketStore(function(s) { return s.openTickets; });
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });

  var storeSettings = useSettingsStore(function(s) { return s.settings; });
  var storeServiceLines = useAppointmentStore(function(s) { return s.serviceLines; });
  var fetchStaff = useStaffStore(function(s) { return s.fetchStaff; });
  var fetchServices = useServiceStore(function(s) { return s.fetchServices; });
  var fetchSettings = useSettingsStore(function(s) { return s.fetchSettings; });
  var fetchClients = useClientStore(function(s) { return s.fetchClients; });
  var fetchServiceLines = useAppointmentStore(function(s) { return s.fetchServiceLines; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var storeCreateTicket = useTicketStore(function(s) { return s.createTicket; });
  var fetchGiftCards = useGiftCardStore(function(s) { return s.fetchGiftCards; });
  var allGiftCards = useGiftCardStore(function(s) { return s.giftCards; });
  var fetchProducts = useInventoryStore(function(s) { return s.fetchProducts; });
  var fetchLoyaltyProgram = useLoyaltyStore(function(s) { return s.fetchProgram; });
  var fetchMembershipPlans = useMembershipStore(function(s) { return s.fetchPlans; });
  var fetchTemplates = useMessagingStore(function(s) { return s.fetchTemplates; });
  var fetchPayrollRuns = usePayrollStore(function(s) { return s.fetchRuns; });
  var fetchPackages = usePackageStore(function(s) { return s.fetchPackages; });
  var fetchCommission = useCommissionStore(function(s) { return s.fetchCommission; });

  var ticketHandlers = useTicketHandlers();
  var handleCloseTicket = ticketHandlers.handleCloseTicket;
  var handlePrintHold = ticketHandlers.handlePrintHold;
  var handleUpdateTicketTips = ticketHandlers.handleUpdateTicketTips;
  var handleAddTicketTip = ticketHandlers.handleAddTicketTip;
  var handleVoidTicket = ticketHandlers.handleVoidTicket;
  var handleRefundTicket = ticketHandlers.handleRefundTicket;
  var checkoutError = ticketHandlers.checkoutError;
  var clearCheckoutError = ticketHandlers.clearCheckoutError;

  // ── Bootstrap + Socket effects ──
  useEffect(function() {
    if (!loggedIn) return;
    bootstrapStores().then(function(success) {
      if (!success) {
        fetchStaff(); fetchServices(); fetchSettings(); fetchClients();
        fetchServiceLines(); fetchTickets(); fetchGiftCards(); fetchProducts();
        fetchLoyaltyProgram(); fetchMembershipPlans(); fetchTemplates(); fetchPackages();
      }
      fetchPayrollRuns(); fetchCommission();
    });
    connectSocket();
    onSocketEvent('staff:created', function() { fetchStaff(); });
    onSocketEvent('staff:updated', function() { fetchStaff(); });
    onSocketEvent('staff:deleted', function() { fetchStaff(); });
    onSocketEvent('service:created', function() { fetchServices(); });
    onSocketEvent('service:updated', function() { fetchServices(); });
    onSocketEvent('service:deleted', function() { fetchServices(); });
    onSocketEvent('category:created', function() { fetchServices(); });
    onSocketEvent('category:updated', function() { fetchServices(); });
    onSocketEvent('category:deleted', function() { fetchServices(); });
    onSocketEvent('settings:updated', function() { fetchSettings(); });
    onSocketEvent('client:created', function() { fetchClients(); });
    onSocketEvent('client:updated', function() { fetchClients(); });
    onSocketEvent('appointment:created', function() { fetchServiceLines(); });
    onSocketEvent('appointment:updated', function() { fetchServiceLines(); });
    onSocketEvent('appointment:deleted', function() { fetchServiceLines(); });
    onSocketEvent('ticket:created', function() { fetchTickets(); });
    onSocketEvent('ticket:updated', function() { fetchTickets(); });
    onSocketEvent('ticket:closed', function() { fetchTickets(); });
    onSocketEvent('ticket:voided', function() { fetchTickets(); });
    onSocketEvent('ticket:refunded', function() { fetchTickets(); fetchGiftCards(); });
    onSocketEvent('ticket:payment', function() { fetchTickets(); });
    onSocketEvent('ticket:tip_updated', function() { fetchTickets(); });
    onSocketEvent('giftcard:created', function() { fetchGiftCards(); });
    onSocketEvent('giftcard:updated', function() { fetchGiftCards(); });
    onSocketEvent('giftcard:redeemed', function() { fetchGiftCards(); });
    onSocketEvent('giftcard:reloaded', function() { fetchGiftCards(); });
    onSocketEvent('giftcard:restored', function() { fetchGiftCards(); });
    onSocketEvent('inventory:updated', function() { fetchProducts(); });
    onSocketEvent('loyalty:updated', function() { fetchLoyaltyProgram(); });
    onSocketEvent('membership:updated', function() { fetchMembershipPlans(); });
    onSocketEvent('messaging:updated', function() { fetchTemplates(); });
    onSocketEvent('payroll:updated', function() { fetchPayrollRuns(); });
    onSocketEvent('package:updated', function() { fetchPackages(); });
    onSocketEvent('commission:updated', function() { fetchCommission(); });
    onSocketEvent('print:request', function(data) {
      if (!isQzReady()) return;
      console.log('[App] Print relay received:', data.type);
      if (data.type === 'receipt') printReceipt(data.opts || {});
      else if (data.type === 'tech_slip') printTechSlip(data.opts || {});
      else if (data.type === 'drawer_summary') printDrawerSummary(data.opts || {});
    });
    return function() { disconnectSocket(); };
  }, [loggedIn]);

  // Sync store settings → local state
  useEffect(function() {
    setSalonSettings(function(prev) { return Object.assign({}, prev, storeSettings); });
    if (storeSettings && storeSettings.station_start_page) {
      setActivePage(function(current) {
        var defaults = ['calendar', 'tech-select', 'tech-pin', 'checkout'];
        if (defaults.indexOf(current) >= 0 && !_hasNavigated) return storeSettings.station_start_page;
        return current;
      });
    }
  }, [storeSettings]);

  function nextTicketNumber() {
    var allNums = openTickets.map(function(t){ return t.ticketNumber; })
      .concat(closedTickets.map(function(t){ return t.ticketNumber; }));
    if (allNums.length === 0) return 1;
    return Math.max.apply(null, allNums) + 1;
  }

  // ── QZ Tray silent printing ──
  useEffect(function() {
    var timer = setTimeout(function() {
      printAutoSetup().then(function(result) {
        if (result.connected && result.printer) console.log('[App] QZ Tray ready — printer: ' + result.printer);
        else if (result.connected) console.log('[App] QZ Tray connected but no Epson printer found.');
        else console.log('[App] QZ Tray not available — using browser print fallback.');
      });
    }, 2000);
    return function() { clearTimeout(timer); };
  }, []);

  const unviewedCount = onlineBookings.length;

  function handleNavClick(id, rbacStaff) {
    if (id === 'online-notifs') { setShowOnlinePopup(true); }
    else { if (id === 'checkout') setCheckoutData(rbacStaff ? { cashierStaff: rbacStaff } : { skipPin: true }); setActivePage(id); }
  }

  function handleCheckout(data, rbacStaff) {
    var enrichedClient = enrichClientBalance(data.client);
    var clientName = enrichedClient ? enrichedClient.first_name + ' ' + enrichedClient.last_name : 'Walk-in';
    var items = (data.services || []).map(function(s){ return {...s, type: s.type || 'service'}; });
    var ticketData = { client_id: enrichedClient ? enrichedClient.id : null, client_name: clientName, lineItems: items, deposit_cents: data.depositCents || 0 };
    storeCreateTicket(ticketData).then(function(ticket) {
      var checkoutPayload = { ...data, client: enrichedClient, openTicketId: ticket.id || ('ot-' + Date.now()) };
      if (rbacStaff) checkoutPayload.cashierStaff = rbacStaff;
      setCheckoutData(checkoutPayload);
      setActivePage('checkout');
    }).catch(function(err) {
      console.warn('[handleCheckout] Store create failed, using local:', err.message);
      var checkoutPayload = { ...data, client: enrichedClient, openTicketId: 'ot-' + Date.now() };
      if (rbacStaff) checkoutPayload.cashierStaff = rbacStaff;
      setCheckoutData(checkoutPayload);
      setActivePage('checkout');
    });
  }

  function handleTechSelected(tech) {
    setActiveTech(tech);
    if (stationConfig.station_mode === 'calendar') { setActivePage('calendar'); return; }
    var activeLines = storeServiceLines.filter(function(sl) {
      return sl.staff_id === tech.id && (sl.status === 'in_progress' || sl.status === 'checked_in');
    });
    if (activeLines.length > 0) {
      var firstLine = activeLines[0];
      var storeClients = useClientStore.getState().clients || [];
      var client = firstLine.client_id
        ? storeClients.find(function(c) { return c.id === firstLine.client_id; })
        : storeClients.find(function(c) { return (c.first_name + ' ' + c.last_name).toLowerCase() === (firstLine.client || '').toLowerCase(); });
      if (!client && firstLine.client) {
        var parts = (firstLine.client || '').split(' ');
        client = { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
      }
      setCheckoutData({
        cashierStaff: tech, client: client || null,
        services: activeLines.map(function(sl) { return { name: sl.service, price_cents: sl.price_cents || 0, type: 'service', techId: sl.staff_id, color: sl.color, serviceLineId: sl.id }; }),
        serviceLineIds: activeLines.map(function(sl) { return sl.id; }),
      });
    } else {
      setCheckoutData({ cashierStaff: tech });
    }
    setActivePage('checkout');
  }

  function handleBackToTechSelect() {
    setActiveTech(null); setCheckoutData(null);
    setActivePage(stationConfig.id_method === 'pin' ? 'tech-pin' : 'tech-select');
  }

  async function handleOpenTicketCheckout(ticketIds) {
    var selected = openTickets.filter(function(t){ return ticketIds.includes(t.id); });
    if (selected.length === 0) return;

    if (selected.length >= 2) {
      // Merge on server — absorber gets all items, absorbed get status='merged'
      try {
        var mergedTicket = await useTicketStore.getState().mergeTickets(ticketIds);
        var enrichedClient = enrichClientBalance(mergedTicket.client_id ? { id: mergedTicket.client_id, name: mergedTicket.clientName } : null);
        setCheckoutData({
          client: enrichedClient,
          services: mergedTicket.items,
          depositCents: mergedTicket.depositCents || 0,
          openTicketIds: [mergedTicket.id],
          openTicketId: mergedTicket.id,
          displayNumber: mergedTicket.displayNumber || null,
        });
        setActivePage('checkout');
      } catch (err) {
        alert('Merge failed: ' + err.message);
      }
    } else {
      // Single ticket — no merge needed
      var primary = selected[0];
      var enrichedClient = enrichClientBalance(primary.client);
      setCheckoutData({
        client: enrichedClient,
        services: primary.items,
        depositCents: primary.depositCents || 0,
        openTicketIds: ticketIds,
        openTicketId: primary.id,
        displayNumber: primary.displayNumber || null,
      });
      setActivePage('checkout');
    }
  }

  async function handleReopenTicket(ticket) {
    var reopenData = await ticketHandlers.handleReopenTicket(ticket);
    if (reopenData) { setCheckoutData(reopenData); setActivePage('checkout'); }
  }

  function handleMarkAllViewed() { setOnlineBookings([]); setShowOnlinePopup(false); }

  function handleBookingTap(booking) {
    setOnlineBookings(function(prev) { return prev.filter(function(b) { return b.id !== booking.id; }); });
    setShowOnlinePopup(false); setActivePage('calendar'); setShowOwner(false); setScrollTarget(booking.slId);
  }

  function handleLaunchStation() {
    var method = (salonSettings || {}).station_id_method || 'avatar';
    setShowOwner(false); setActiveTech(null); setCheckoutData(null);
    setActivePage(method === 'pin' ? 'tech-pin' : 'tech-select');
  }

  function renderPage() {
    switch (activePage) {
      case 'calendar':       return <CalendarDayView scrollTarget={scrollTarget} onScrollDone={function(){setScrollTarget(null);}} onCheckout={handleCheckout} catalogLayout={grid.catalogLayout} salonSettings={salonSettings} onNavClick={handleNavClick} onOwnerClick={function(){ setShowOwner(true); setActivePage('dashboard'); }} unviewedCount={unviewedCount} openTicketCount={openTickets.length} drawerSession={drawer.drawerSession} onCashierClick={function(rbacStaff){ drawer.setCashierStaff(rbacStaff || null); drawer.setShowCashierModal(true); }} hasHourlyStaff={grid.hasHourlyStaff} onTimeClockClick={function(){ timeClock.setShowTimeClockModal(true); }} clockPunches={timeClock.clockPunches} presenceRecords={timeClock.presenceRecords} />;
      case 'checkout':       return <CheckoutScreen appointmentData={checkoutData} onDone={function(){ setCheckoutData(null); if(activeTech){ handleBackToTechSelect(); } else { setActivePage('calendar'); } }} onCloseTicket={handleCloseTicket} onPrintHold={handlePrintHold} openTickets={openTickets} nextTicketNumber={nextTicketNumber} catalogLayout={grid.catalogLayout} drawerSession={drawer.drawerSession} salonSettings={salonSettings} onCashPayment={drawer.handleCashPaymentTracked} canProcessPayments={activeTech ? stationConfig.can_process_payments : true} />;
      case 'tickets':        return <TicketViewer closedTickets={closedTickets} openTickets={openTickets} onBack={function(){ setActivePage('calendar'); }} onReopen={handleReopenTicket} onOpenTicketCheckout={handleOpenTicketCheckout} onNewSale={function(){ setCheckoutData(null); setActivePage('checkout'); }} onUpdateTicketTips={handleUpdateTicketTips} onAddTicketTip={handleAddTicketTip} onVoid={handleVoidTicket} onRefund={handleRefundTicket} />;
      case 'clients':        return <ClientList onBack={function(){ setActivePage('calendar'); }} />;
      case 'gift-cards':     return <GiftCardModule />;
      case 'loyalty':        return <LoyaltyModule />;
      case 'membership':     return <MembershipModule />;
      case 'inventory':      return <InventoryModule />;
      case 'messaging':      return <MessagingModule />;
      case 'payroll':        return <PayrollModule clockPunches={timeClock.clockPunches} onAddPunch={timeClock.handleAddManualPunch} onEditPunch={timeClock.handleEditPunch} onDeletePunch={timeClock.handleDeletePunch} />;
      case 'online-booking': return <OnlineBookingPortal />;
      case 'kiosk':             return <KioskApp />;
      case 'customer-display':  return <CustomerDisplayApp />;
      case 'tech-select':       return <TechSelectApp onTechSelected={handleTechSelected} onExit={function(){ setActiveTech(null); setActivePage('calendar'); }} stationMode={stationConfig.station_mode} canProcessPayments={stationConfig.can_process_payments} activeAppointments={(function(){ var m={}; storeServiceLines.filter(function(sl){ return sl.status==='in_progress'||sl.status==='checked_in'; }).forEach(function(sl){ if(!m[sl.staff_id]) m[sl.staff_id]={clientName:sl.client,services:[]}; m[sl.staff_id].services.push({name:sl.service,price_cents:sl.price_cents||0}); }); return m; })()} />;
      case 'tech-pin':          return <TechPinApp onTechSelected={handleTechSelected} onExit={function(){ setActiveTech(null); setActivePage('calendar'); }} stationMode={stationConfig.station_mode} activeAppointments={(function(){ var m={}; storeServiceLines.filter(function(sl){ return sl.status==='in_progress'||sl.status==='checked_in'; }).forEach(function(sl){ if(!m[sl.staff_id]) m[sl.staff_id]={clientName:sl.client,services:[]}; m[sl.staff_id].services.push({name:sl.service,price_cents:sl.price_cents||0}); }); return m; })()} />;
      case 'dashboard':      return <OwnerDashboard salonSettings={salonSettings} onSettingsUpdate={handleSettingsUpdate} onBack={function(){ setShowOwner(false); setActivePage('calendar'); }} onLaunchStation={handleLaunchStation} onProviderAdmin={function(){ setActivePage('provider-admin'); }} employees={grid.empStaff} setEmployees={grid.setEmpStaff} empColumns={grid.empColumns} setEmpColumns={grid.setEmpColumns} empRows={grid.empRows} setEmpRows={grid.setEmpRows} empSlots={grid.empSlots} setEmpSlots={grid.setEmpSlots} catalogLayout={grid.catalogLayout} categories={grid.svcCatCategories} setCategories={grid.setSvcCatCategories} services={grid.svcCatServices} setServices={grid.setSvcCatServices} catColumns={grid.svcCatColumns} setCatColumns={grid.setSvcCatColumns} catRows={grid.svcCatRows} setCatRows={grid.setSvcCatRows} svcColumns={grid.svcGridColumns} setSvcColumns={grid.setSvcGridColumns} svcRows={grid.svcGridRows} setSvcRows={grid.setSvcGridRows} catSlots={grid.svcCatSlots} setCatSlots={grid.setSvcCatSlots} svcSlots={grid.svcSlots} setSvcSlots={grid.setSvcSlots} clockPunches={timeClock.clockPunches} onAddPunch={timeClock.handleAddManualPunch} onEditPunch={timeClock.handleEditPunch} onDeletePunch={timeClock.handleDeletePunch} />;
      case 'reports':        return <ReportsModule />;
      case 'provider-admin': return <ProviderAdminPanel onBack={function(){ setActivePage('dashboard'); }} />;
      default:               return <CalendarDayView />;
    }
  }

  // ─── License Activation Gate ───
  if (!licenseChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0B1220', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#E2E8F0', marginBottom: 12 }}>Pro Salon POS</div>
          <div style={{ fontSize: 14, color: '#64748B' }}>Checking license...</div>
        </div>
      </div>
    );
  }
  if (!licenseActivated) {
    return <LicenseActivationScreen onActivated={function() { setLicenseActivated(true); }} />;
  }

  // ─── Station Setup Gate ───
  if (!stationPaired) {
    return <StationSetup onPaired={function() { setStationPaired(true); }} />;
  }

  // ─── Login Gate ───
  if (!loggedIn) {
    return <LoginScreen onLogin={function(data) {
      setLoggedInStaff(data.staff || null);
      setLoggedIn(true);
    }} onStaleStation={function() {
      setStationPaired(false);
    }} />;
  }

  return (
    <ThemeContext.Provider value={C}>
    <RBACProvider salonSettings={salonSettings}>
    <ToastProvider>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: C.bg, overflow: 'hidden' }}>
      {_staffSource === 'error' && (
        <div style={{ background: '#DC2626', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
          ⚠ Server not connected{_staffError ? ' — ' + _staffError : ''}. Data will not load until the server is running.
        </div>
      )}
      {checkoutError && (
        <div style={{ background: '#92400E', color: '#FDE68A', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 600, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span>⚠ Ticket #{checkoutError.ticketNumber}: {checkoutError.message}. Saved locally — will sync when server reconnects.</span>
          <span onClick={clearCheckoutError} style={{ cursor: 'pointer', padding: '2px 10px', borderRadius: 4, border: '1px solid #FDE68A', fontSize: 11, flexShrink: 0 }}>Dismiss</span>
        </div>
      )}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {renderPage()}
      </main>
      <OnlineBookingsPopup show={showOnlinePopup} bookings={onlineBookings} unviewedCount={unviewedCount} onClose={function() { setShowOnlinePopup(false); }} onBookingTap={handleBookingTap} onMarkAllViewed={handleMarkAllViewed} />
      <GiftCardBalancePopup giftCards={allGiftCards} enabled={activePage !== 'checkout'} />
      {drawer.showCashierModal && (
        <CashierModule
          drawerSession={drawer.drawerSession && drawer.drawerSession.status === 'open' ? drawer.drawerSession : null}
          salonSettings={salonSettings}
          onOpen={function(startingCents) { drawer.handleDrawerOpen(startingCents, drawer.cashierStaff); }}
          onClose={drawer.handleDrawerClose}
          onDismiss={drawer.handleDrawerDismiss}
        />
      )}
      {timeClock.showTimeClockModal && (
        <TimeClockPopup show={true} clockPunches={timeClock.clockPunches} presenceRecords={timeClock.presenceRecords} onPunch={timeClock.handleClockPunch} onPresencePunch={timeClock.handlePresencePunch} onDismiss={function() { timeClock.setShowTimeClockModal(false); }} />
      )}
      <VirtualKeyboard />
      <div style={{ position: 'fixed', bottom: 4, right: 8, fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,0.4)', fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none', zIndex: 99999 }}>S110</div>
    </div>
    </ToastProvider>
    </RBACProvider>
    </ThemeContext.Provider>
  );
}
