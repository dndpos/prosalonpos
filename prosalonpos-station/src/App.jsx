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
  const [scrollTarget, setScrollTarget] = useState(null); // service line ID to scroll to
  const [checkoutData, setCheckoutData] = useState(null); // {client, services} from appointment
  const [activeTech, setActiveTech] = useState(null); // tech who identified via tech-select or tech-pin
  const [stationPaired, setStationPaired] = useState(isPaired()); // one-time setup complete?
  const [licenseActivated, setLicenseActivated] = useState(false);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(function() { return !!getToken(); }); // has a valid JWT?
  const [loggedInStaff, setLoggedInStaff] = useState(null); // { display_name, role, rbac_role }
  var _hasNavigated = activePage !== 'calendar';

  // Connection status — show banner if any core store failed to connect
  // MUST be before any conditional returns to satisfy React hooks ordering rules
  var _staffSource = useStaffStore(function(s) { return s.source; });
  var _staffError = useStaffStore(function(s) { return s.error; });

  // ── License check on startup ──
  // In .exe mode (SQLite): call license status API. If valid, skip license screen.
  // In dev/cloud mode (PostgreSQL): server returns 'dev_mode' — skip license screen.
  useEffect(function() {
    if (!stationPaired) { setLicenseChecked(true); setLicenseActivated(true); return; } // not paired yet, skip
    var licenseBase = window.location.port === '5173'
      ? 'http://localhost:3001/api/v1/license'
      : window.location.protocol + '//' + window.location.host + '/api/v1/license';
    fetch(licenseBase + '/status', { signal: AbortSignal.timeout(3000) })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var status = data && data.licenseStatus && data.licenseStatus.status;
        if (status === 'valid' || status === 'dev_mode') {
          setLicenseActivated(true);
        }
        // else: not_found, invalid, error → stay on license screen
        setLicenseChecked(true);
      })
      .catch(function() {
        // Server not reachable yet — show license screen
        setLicenseChecked(true);
      });
  }, []);

  // Register auth expiry callback — if JWT expires during use, return to login screen
  useEffect(function() {
    onAuthExpired(function() {
      setLoggedIn(false);
      setLoggedInStaff(null);
    });
  }, []);

  // ── Station Config (reads from Salon Settings) ──
  // station_id_method: 'avatar' | 'pin' — which identification screen to show
  // station_mode: 'checkout' = go to checkout after tech selects | 'calendar' = go to calendar
  // can_process_payments: true = full checkout | false = print/hold only
  var ss = salonSettings || {};
  var stationConfig = {
    id_method: ss.station_id_method || 'avatar',
    station_mode: ss.station_mode || 'checkout',
    can_process_payments: ss.station_can_process_payments !== false
  };
  // ── Cash Drawer (Session 36) ──
  const [drawerSession, setDrawerSession] = useState(null); // active drawer session object or null
  const [showCashierModal, setShowCashierModal] = useState(false);
  const [cashierStaff, setCashierStaff] = useState(null); // staff who PIN'd for drawer
  function handleDrawerOpen(startingCents, cashierStaff) {
    setDrawerSession({
      id: 'drawer-' + Date.now(),
      cashier_id: cashierStaff ? cashierStaff.id : 'unknown',
      cashier_name: cashierStaff ? cashierStaff.display_name : 'Unknown',
      opened_at: Date.now(),
      closed_at: null,
      starting_cents: startingCents,
      reported_cents: null,
      cash_payments: [],
      status: 'open',
    });
  }
  function handleDrawerClose(reportedCents) {
    setDrawerSession(function(prev) {
      if (!prev) return null;
      return Object.assign({}, prev, { closed_at: Date.now(), reported_cents: reportedCents, status: 'closed' });
    });
  }
  function handleDrawerDismiss() {
    // If drawer was closed (result screen dismissed), clear session
    if (drawerSession && drawerSession.status === 'closed') setDrawerSession(null);
    setShowCashierModal(false);
  }
  function handleCashPaymentTracked(amountCents, ticketId) {
    setDrawerSession(function(prev) {
      if (!prev || prev.status !== 'open') return prev;
      return Object.assign({}, prev, {
        cash_payments: prev.cash_payments.concat([{ ticket_id: ticketId || 'unknown', amount_cents: amountCents, timestamp: Date.now() }]),
      });
    });
  }
  // ── Time Clock (TD-056, Session 38) ──
  const [clockPunches, setClockPunches] = useState([]); // { id, staff_id, type:'in'|'out', timestamp }
  const [showTimeClockModal, setShowTimeClockModal] = useState(false);
  function handleClockPunch(staffId, type) {
    setClockPunches(function(prev) {
      return prev.concat([{ id: 'punch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), staff_id: staffId, type: type, timestamp: Date.now() }]);
    });
  }
  function handleAddManualPunch(staffId, type, timestamp) {
    setClockPunches(function(prev) {
      return prev.concat([{ id: 'punch-manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), staff_id: staffId, type: type, timestamp: timestamp }])
        .sort(function(a, b) { return a.timestamp - b.timestamp; });
    });
  }
  function handleDeletePunch(punchId) {
    setClockPunches(function(prev) { return prev.filter(function(p) { return p.id !== punchId; }); });
  }
  // ── Open/Closed Tickets — read from ticketStore (Session 51) ──
  var openTickets = useTicketStore(function(s) { return s.openTickets; });
  var closedTickets = useTicketStore(function(s) { return s.closedTickets; });

  // ── Service Catalog layout state (shared between Owner and Checkout) ──
  var [svcCatCategories, setSvcCatCategories] = useState([]);
  var [svcCatServices, setSvcCatServices] = useState([]);
  var [svcCatColumns, setSvcCatColumns] = useState(1);
  var [svcGridColumns, setSvcGridColumns] = useState(7);
  var [svcGridRows, setSvcGridRows] = useState(9);
  var [svcCatSlots, setSvcCatSlots] = useState({});
  var [svcSlots, setSvcSlots] = useState({});

  // ── Employee grid layout state (shared, managed by Owner) ──
  var [empStaff, setEmpStaff] = useState([]);
  var [empColumns, setEmpColumns] = useState(4);
  var [empRows, setEmpRows] = useState(3);
  var [empSlots, setEmpSlots] = useState({});
  var hasHourlyStaff = empStaff.some(function(s) { return s.active && s.pay_type === 'hourly'; });

  // ── Salon Settings state (shared, managed by Owner → Salon Settings screen) ──
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
  // ── Grid layout persistence (TD-102) ──
  var gridPersist = useGridPersistence(salonSettings, handleSettingsUpdate);
  // ── Resolved theme from settings ──
  var C = getTheme(salonSettings.theme || 'dark');

  // ── Phase 2B: Store subscriptions ──
  // Fetch from API on mount (falls back to mock automatically)
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var storeServices = useServiceStore(function(s) { return s.services; });
  var storeCategories = useServiceStore(function(s) { return s.categories; });
  var storeSettings = useSettingsStore(function(s) { return s.settings; });
  var fetchStaff = useStaffStore(function(s) { return s.fetchStaff; });
  var fetchServices = useServiceStore(function(s) { return s.fetchServices; });
  var fetchSettings = useSettingsStore(function(s) { return s.fetchSettings; });
  var fetchClients = useClientStore(function(s) { return s.fetchClients; });
  var fetchServiceLines = useAppointmentStore(function(s) { return s.fetchServiceLines; });
  var storeServiceLines = useAppointmentStore(function(s) { return s.serviceLines; });
  var fetchTickets = useTicketStore(function(s) { return s.fetchTickets; });
  var storeCreateTicket = useTicketStore(function(s) { return s.createTicket; });
  var storeCloseTicket = useTicketStore(function(s) { return s.closeTicket; });
  var fetchGiftCards = useGiftCardStore(function(s) { return s.fetchGiftCards; });
  var allGiftCards = useGiftCardStore(function(s) { return s.giftCards; });
  var fetchProducts = useInventoryStore(function(s) { return s.fetchProducts; });
  var fetchLoyaltyProgram = useLoyaltyStore(function(s) { return s.fetchProgram; });
  var fetchMembershipPlans = useMembershipStore(function(s) { return s.fetchPlans; });
  var fetchTemplates = useMessagingStore(function(s) { return s.fetchTemplates; });
  var fetchPayrollRuns = usePayrollStore(function(s) { return s.fetchRuns; });
  var fetchPackages = usePackageStore(function(s) { return s.fetchPackages; });
  var fetchCommission = useCommissionStore(function(s) { return s.fetchCommission; });

  // ── Ticket lifecycle handlers (extracted from App.jsx) ──
  var ticketHandlers = useTicketHandlers();
  var handleCloseTicket = ticketHandlers.handleCloseTicket;
  var handlePrintHold = ticketHandlers.handlePrintHold;
  var handleUpdateTicketTips = ticketHandlers.handleUpdateTicketTips;
  var handleAddTicketTip = ticketHandlers.handleAddTicketTip;
  var handleVoidTicket = ticketHandlers.handleVoidTicket;
  var handleRefundTicket = ticketHandlers.handleRefundTicket;

  useEffect(function() {
    // Only fetch data after login (we need a JWT for all protected routes)
    if (!loggedIn) return;

    // ── BOOTSTRAP: single API call loads ALL data at once ──
    // Replaces 14 separate fetch calls, eliminating 13 round trips to Railway.
    // Falls back to individual fetches if bootstrap endpoint is unavailable.
    bootstrapStores().then(function(success) {
      if (!success) {
        // Bootstrap failed — fall back to individual fetches (pre-S99 behavior)
        fetchStaff(); fetchServices(); fetchSettings(); fetchClients();
        fetchServiceLines(); fetchTickets(); fetchGiftCards(); fetchProducts();
        fetchLoyaltyProgram(); fetchMembershipPlans(); fetchTemplates();
        fetchPackages();
      }
      // Payroll + commission always fetched individually (not in bootstrap)
      fetchPayrollRuns();
      fetchCommission();
    });

    // Connect WebSocket for real-time multi-station sync
    connectSocket();

    // When another station makes changes, refresh the affected store
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
    onSocketEvent('ticket:refunded', function() { fetchTickets(); });
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

    // ── Print relay: tablet → PC with QZ Tray ──
    onSocketEvent('print:request', function(data) {
      // Only handle if this station has QZ Tray running
      if (!isQzReady()) return;
      console.log('[App] Print relay received:', data.type);
      if (data.type === 'receipt') {
        printReceipt(data.opts || {});
      } else if (data.type === 'tech_slip') {
        printTechSlip(data.opts || {});
      } else if (data.type === 'drawer_summary') {
        printDrawerSummary(data.opts || {});
      }
    });

    return function() { disconnectSocket(); };
  }, [loggedIn]);

  // Sync store data → local state (so all existing props-based components work)
  useEffect(function() {
    setEmpStaff(storeStaff);
    // Rebuild empSlots when staff data arrives from API
    if (storeStaff.length > 0) {
      var activeIds = {};
      storeStaff.filter(function(s) { return s.active; }).forEach(function(s) { activeIds[s.id] = true; });

      setEmpSlots(function(prev) {
        // If we have existing slots, validate that the IDs still exist in staff
        if (Object.keys(prev).length > 0) {
          var cleaned = {};
          var validCount = 0;
          Object.keys(prev).forEach(function(k) {
            if (activeIds[prev[k]]) { cleaned[k] = prev[k]; validCount++; }
          });
          // If at least some valid slots remain, keep the cleaned version
          if (validCount > 0) return cleaned;
          // Otherwise fall through to auto-assign below
        }
        // Auto-assign active staff to sequential slots
        var slots = {};
        storeStaff.filter(function(s) { return s.active; }).forEach(function(emp, i) { slots[i] = emp.id; });
        return slots;
      });
    }
  }, [storeStaff]);

  useEffect(function() { setSvcCatServices(storeServices); }, [storeServices]);

  useEffect(function() {
    setSvcCatCategories(storeCategories);
    // S105: Cleanup ONLY — remove hard-deleted IDs. NEVER auto-append.
    if (storeCategories.length === 0) return;
    var knownIdSet = {}; storeCategories.forEach(function(c) { knownIdSet[c.id] = true; });
    setSvcCatSlots(function(prev) {
      var keys = Object.keys(prev);
      if (keys.length === 0) {
        var s = {}; storeCategories.filter(function(c) { return c.active !== false; }).sort(function(a, b) { return (a.position||0) - (b.position||0); }).forEach(function(c, i) { s[i] = c.id; }); return s;
      }
      var cleaned = {}; var changed = false;
      keys.forEach(function(k) {
        if (knownIdSet[prev[k]]) { cleaned[k] = prev[k]; } else { changed = true; }
      });
      return changed ? cleaned : prev;
    });
  }, [storeCategories]);

  // Rebuild svcSlots — fill empty categories, recover stale saved slots (S101)
  useEffect(function() {
    if (storeCategories.length === 0 || storeServices.length === 0) return;
    var svcIdSet = {}; storeServices.forEach(function(s) { svcIdSet[s.id] = true; });
    function autoAssign(catId) {
      var inCat = storeServices.filter(function(s) { return s.category_ids && s.category_ids.includes(catId) && s.active !== false; })
        .sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
      if (inCat.length === 0) return null;
      var m = {}; inCat.forEach(function(s, i) { m[i] = s.id; }); return m;
    }
    setSvcSlots(function(prev) {
      var next = Object.assign({}, prev); var changed = false;
      storeCategories.forEach(function(cat) {
        if (next[cat.id] !== undefined) {
          var existing = next[cat.id] || {}; var cleaned = {};
          Object.keys(existing).forEach(function(k) { if (svcIdSet[existing[k]]) cleaned[k] = existing[k]; });
          if (Object.keys(cleaned).length !== Object.keys(existing).length) { next[cat.id] = cleaned; changed = true; }
          // If slots ended up empty (stale or never populated), re-populate from actual services
          if (Object.keys(cleaned).length === 0) {
            var fresh = autoAssign(cat.id);
            if (fresh) { next[cat.id] = fresh; changed = true; }
          }
          return;
        }
        var fresh = autoAssign(cat.id);
        if (fresh) { next[cat.id] = fresh; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [storeServices, storeCategories]);

  // ── TD-102: Grid layout persistence refs (must be before effects that use them) ──
  var gridInitialized = useRef(false);
  var _restoringGrid = useRef(false);
  var _gridLayoutRestored = useRef(false); // S105: prevent settings from overwriting catSlots after initial load

  useEffect(function() {
    setSalonSettings(function(prev) { return Object.assign({}, prev, storeSettings); });
    // If backend provided a start page and we're still on the initial page, switch to it
    if (storeSettings && storeSettings.station_start_page) {
      setActivePage(function(current) {
        // Only change on first load — don't override user navigation
        var defaults = ['calendar', 'tech-select', 'tech-pin', 'checkout'];
        if (defaults.indexOf(current) >= 0 && !_hasNavigated) {
          return storeSettings.station_start_page;
        }
        return current;
      });
    }
    // ── TD-102: Restore grid layout from saved settings ──
    // S105: Restore grid layout ONCE on initial load only
    if (storeSettings && storeSettings.grid_layout && !_gridLayoutRestored.current) {
      _gridLayoutRestored.current = true;
      var gl = storeSettings.grid_layout;
      _restoringGrid.current = true;
      if (gl.catSlots) {
        if (storeCategories.length > 0) {
          var knownCatIds = {}; storeCategories.forEach(function(c) { knownCatIds[c.id] = true; });
          var validCatSlots = {}; Object.keys(gl.catSlots).forEach(function(k) { if (knownCatIds[gl.catSlots[k]]) validCatSlots[k] = gl.catSlots[k]; });
          setSvcCatSlots(validCatSlots);
        } else {
          setSvcCatSlots(gl.catSlots);
        }
      }
      if (gl.svcSlots) {
        if (storeServices.length > 0) {
          var validIds = {}; storeServices.forEach(function(s) { validIds[s.id] = true; });
          var validated = {};
          Object.keys(gl.svcSlots).forEach(function(catKey) {
            var catMap = gl.svcSlots[catKey] || {}; var clean = {};
            Object.keys(catMap).forEach(function(slot) { if (validIds[catMap[slot]]) clean[slot] = catMap[slot]; });
            validated[catKey] = clean;
          });
          setSvcSlots(validated);
        }
      }
      if (gl.empSlots && Object.keys(gl.empSlots).length > 0) setEmpSlots(gl.empSlots);
      if (gl.svcCatColumns !== undefined) setSvcCatColumns(gl.svcCatColumns);
      if (gl.svcGridColumns !== undefined) setSvcGridColumns(gl.svcGridColumns);
      if (gl.svcGridRows !== undefined) setSvcGridRows(gl.svcGridRows);
      if (gl.empColumns !== undefined) setEmpColumns(gl.empColumns);
      if (gl.empRows !== undefined) setEmpRows(gl.empRows);
      setTimeout(function() { _restoringGrid.current = false; }, 500);
    }
  }, [storeSettings]);

  // ── TD-102: Auto-save grid layout when it changes ──
  useEffect(function() {
    // Skip first render — don't overwrite saved layout with defaults
    if (!gridInitialized.current) {
      gridInitialized.current = true;
      return;
    }
    // Skip if we're in the middle of a restore (prevents infinite loop)
    if (_restoringGrid.current) return;
    gridPersist.save({
      catSlots: svcCatSlots, svcSlots: svcSlots, empSlots: empSlots,
      svcCatColumns: svcCatColumns, svcGridColumns: svcGridColumns, svcGridRows: svcGridRows,
      empColumns: empColumns, empRows: empRows,
    });
  }, [svcCatSlots, svcSlots, empSlots, svcCatColumns, svcGridColumns, svcGridRows, empColumns, empRows]);

  // Daily ticket numbering — starts at 1 each day, sequential
  function nextTicketNumber() {
    var allNums = openTickets.map(function(t){ return t.ticketNumber; })
      .concat(closedTickets.map(function(t){ return t.ticketNumber; }));
    if (allNums.length === 0) return 1;
    return Math.max.apply(null, allNums) + 1;
  }

  // ── QZ Tray silent printing — auto-connect on startup ──
  useEffect(function() {
    // Delay slightly to let qz-tray.js load
    var timer = setTimeout(function() {
      printAutoSetup().then(function(result) {
        if (result.connected && result.printer) {
          console.log('[App] QZ Tray ready — printer: ' + result.printer);
        } else if (result.connected) {
          console.log('[App] QZ Tray connected but no Epson printer found. Set printer in Salon Settings.');
        } else {
          console.log('[App] QZ Tray not available — using browser print fallback.');
        }
      });
    }, 2000);
    return function() { clearTimeout(timer); };
  }, []);

  const unviewedCount = onlineBookings.length;

  function handleNavClick(id, rbacStaff) {
    if (id === 'online-notifs') {
      setShowOnlinePopup(true);
    } else {
      if (id === 'checkout') setCheckoutData(rbacStaff ? { cashierStaff: rbacStaff } : null);
      setActivePage(id);
    }
  }

  function handleCheckout(data, rbacStaff) {
    // Calendar "Go to Checkout" — create open ticket in ticketStore + load it
    var enrichedClient = enrichClientBalance(data.client);
    var clientName = enrichedClient ? enrichedClient.first_name + ' ' + enrichedClient.last_name : 'Walk-in';
    var items = (data.services || []).map(function(s){ return {...s, type: s.type || 'service'}; });

    var ticketData = {
      client_id: enrichedClient ? enrichedClient.id : null,
      client_name: clientName,
      lineItems: items,
      deposit_cents: data.depositCents || 0,
    };

    // Create ticket in store (works in both mock and API mode)
    storeCreateTicket(ticketData).then(function(ticket) {
      var ot = {
        id: ticket.id || ('ot-' + Date.now()),
        ticketNumber: ticket.ticket_number || nextTicketNumber(),
        clientName: clientName,
        client: enrichedClient,
        items: items,
        depositCents: data.depositCents || 0,
        createdAt: Date.now(),
      };
      var checkoutPayload = { ...data, client: enrichedClient, openTicketId: ot.id };
      if (rbacStaff) checkoutPayload.cashierStaff = rbacStaff;
      setCheckoutData(checkoutPayload);
      setActivePage('checkout');
    }).catch(function(err) {
      // Fallback — proceed anyway with local ticket
      console.warn('[handleCheckout] Store create failed, using local:', err.message);
      var ot = {
        id: 'ot-' + Date.now(),
        ticketNumber: nextTicketNumber(),
        clientName: clientName,
        client: enrichedClient,
        items: items,
        depositCents: data.depositCents || 0,
        createdAt: Date.now(),
      };
      var checkoutPayload = { ...data, client: enrichedClient, openTicketId: ot.id };
      if (rbacStaff) checkoutPayload.cashierStaff = rbacStaff;
      setCheckoutData(checkoutPayload);
      setActivePage('checkout');
    });
  }

  function handleTechSelected(tech) {
    // Tech identified via avatar grid or PIN — route based on station config
    setActiveTech(tech);
    if (stationConfig.station_mode === 'calendar') {
      setActivePage('calendar');
    } else {
      // checkout mode — look up tech's real active appointment from live store
      var activeLines = storeServiceLines.filter(function(sl) {
        return sl.staff_id === tech.id &&
          (sl.status === 'in_progress' || sl.status === 'checked_in');
      });
      if (activeLines.length > 0) {
        // Build client from store — try to match by client_id first, then name
        var firstLine = activeLines[0];
        var storeClients = useClientStore.getState().clients || [];
        var client = firstLine.client_id
          ? storeClients.find(function(c) { return c.id === firstLine.client_id; })
          : storeClients.find(function(c) {
              return (c.first_name + ' ' + c.last_name).toLowerCase() === (firstLine.client || '').toLowerCase();
            });
        if (!client && firstLine.client) {
          // Fallback: build minimal client object from name on service line
          var parts = (firstLine.client || '').split(' ');
          client = { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
        }
        setCheckoutData({
          cashierStaff: tech,
          client: client || null,
          services: activeLines.map(function(sl) {
            return {
              name: sl.service,
              price_cents: sl.price_cents || 0,
              type: 'service',
              techId: sl.staff_id,
              color: sl.color,
              serviceLineId: sl.id,
            };
          }),
          serviceLineIds: activeLines.map(function(sl) { return sl.id; }),
        });
      } else {
        setCheckoutData({ cashierStaff: tech });
      }
      setActivePage('checkout');
    }
  }

  function handleBackToTechSelect() {
    // Return to tech identification screen (avatar or PIN based on station config)
    setActiveTech(null);
    setCheckoutData(null);
    setActivePage(stationConfig.id_method === 'pin' ? 'tech-pin' : 'tech-select');
  }

  function handleOpenTicketCheckout(ticketIds) {
    // Load selected open ticket(s) into checkout
    var selected = openTickets.filter(function(t){ return ticketIds.includes(t.id); });
    if (selected.length === 0) return;
    var primary = selected[0];
    var enrichedClient = enrichClientBalance(primary.client);
    // Merge all items from all selected tickets
    var allItems = [];
    var totalDeposit = 0;
    selected.forEach(function(t){
      t.items.forEach(function(it){ allItems.push(it); });
      totalDeposit += (t.depositCents || 0);
    });
    setCheckoutData({
      client: enrichedClient,
      services: allItems,
      depositCents: totalDeposit,
      openTicketIds: ticketIds,
      openTicketId: primary.id,
    });
    // DON'T remove from open tickets yet — only remove when ticket is closed/paid
    setActivePage('checkout');
  }

  function handleCombineTicket(ticketId) {
    // Pull an open ticket's items into the current checkout — called from inside checkout
    var ticket = openTickets.find(function(t){ return t.id === ticketId; });
    if (!ticket) return;
    useTicketStore.getState().removeOpenTicket(ticketId);
    return ticket; // CheckoutScreen will merge the items
  }

  function handleReopenTicket(ticket) {
    var reopenData = ticketHandlers.handleReopenTicket(ticket);
    setCheckoutData(reopenData);
    setActivePage('checkout');
  }

  function handleMarkAllViewed() {
    setOnlineBookings([]);
    setShowOnlinePopup(false);
  }

  function handleBookingTap(booking) {
    setOnlineBookings(function(prev) { return prev.filter(function(b) { return b.id !== booking.id; }); });
    setShowOnlinePopup(false);
    setActivePage('calendar');
    setShowOwner(false);
    setScrollTarget(booking.slId);
  }

  function handleLaunchStation() {
    var method = (salonSettings || {}).station_id_method || 'avatar';
    setShowOwner(false);
    setActiveTech(null);
    setCheckoutData(null);
    setActivePage(method === 'pin' ? 'tech-pin' : 'tech-select');
  }

  var catalogLayout = {categories:svcCatCategories,services:svcCatServices,catColumns:svcCatColumns,svcColumns:svcGridColumns,svcRows:svcGridRows,catSlots:svcCatSlots,svcSlots:svcSlots};
  function renderPage() {
    switch (activePage) {
      case 'calendar':       return <CalendarDayView scrollTarget={scrollTarget} onScrollDone={function(){setScrollTarget(null);}} onCheckout={handleCheckout} catalogLayout={catalogLayout} salonSettings={salonSettings} onNavClick={handleNavClick} onOwnerClick={function(){ setShowOwner(true); setActivePage('dashboard'); }} unviewedCount={unviewedCount} openTicketCount={openTickets.length} drawerSession={drawerSession} onCashierClick={function(rbacStaff){ setCashierStaff(rbacStaff || null); setShowCashierModal(true); }} hasHourlyStaff={hasHourlyStaff} onTimeClockClick={function(){ setShowTimeClockModal(true); }} />;
      case 'checkout':       return <CheckoutScreen appointmentData={checkoutData} onDone={function(){ setCheckoutData(null); if(activeTech){ handleBackToTechSelect(); } else { setActivePage('calendar'); } }} onCloseTicket={handleCloseTicket} onPrintHold={handlePrintHold} openTickets={openTickets} onCombineTicket={handleCombineTicket} nextTicketNumber={nextTicketNumber} catalogLayout={catalogLayout} drawerSession={drawerSession} salonSettings={salonSettings} onCashPayment={handleCashPaymentTracked} canProcessPayments={activeTech ? stationConfig.can_process_payments : true} />;
      case 'tickets':        return <TicketViewer closedTickets={closedTickets} openTickets={openTickets} onBack={function(){ setActivePage('calendar'); }} onReopen={handleReopenTicket} onOpenTicketCheckout={handleOpenTicketCheckout} onNewSale={function(){ setCheckoutData(null); setActivePage('checkout'); }} onUpdateTicketTips={handleUpdateTicketTips} onAddTicketTip={handleAddTicketTip} onVoid={handleVoidTicket} onRefund={handleRefundTicket} />;
      case 'clients':        return <ClientList onBack={function(){ setActivePage('calendar'); }} />;
      case 'gift-cards':     return <GiftCardModule />;
      case 'loyalty':        return <LoyaltyModule />;
      case 'membership':     return <MembershipModule />;
      case 'inventory':      return <InventoryModule />;
      case 'messaging':      return <MessagingModule />;
      case 'payroll':        return <PayrollModule clockPunches={clockPunches} onAddPunch={handleAddManualPunch} onDeletePunch={handleDeletePunch} />;
      case 'online-booking': return <OnlineBookingPortal />;
      case 'kiosk':             return <KioskApp />;
      case 'customer-display':  return <CustomerDisplayApp />;
      case 'tech-select':       return <TechSelectApp onTechSelected={handleTechSelected} onExit={function(){ setActiveTech(null); setActivePage('calendar'); }} stationMode={stationConfig.station_mode} canProcessPayments={stationConfig.can_process_payments} activeAppointments={(function(){ var m={}; storeServiceLines.filter(function(sl){ return sl.status==='in_progress'||sl.status==='checked_in'; }).forEach(function(sl){ if(!m[sl.staff_id]) m[sl.staff_id]={clientName:sl.client,services:[]}; m[sl.staff_id].services.push({name:sl.service,price_cents:sl.price_cents||0}); }); return m; })()} />;
      case 'tech-pin':          return <TechPinApp onTechSelected={handleTechSelected} onExit={function(){ setActiveTech(null); setActivePage('calendar'); }} stationMode={stationConfig.station_mode} activeAppointments={(function(){ var m={}; storeServiceLines.filter(function(sl){ return sl.status==='in_progress'||sl.status==='checked_in'; }).forEach(function(sl){ if(!m[sl.staff_id]) m[sl.staff_id]={clientName:sl.client,services:[]}; m[sl.staff_id].services.push({name:sl.service,price_cents:sl.price_cents||0}); }); return m; })()} />;
      case 'dashboard':      return <OwnerDashboard salonSettings={salonSettings} onSettingsUpdate={handleSettingsUpdate} onBack={function(){ setShowOwner(false); setActivePage('calendar'); }} onLaunchStation={handleLaunchStation} onProviderAdmin={function(){ setActivePage('provider-admin'); }} employees={empStaff} setEmployees={setEmpStaff} empColumns={empColumns} setEmpColumns={setEmpColumns} empRows={empRows} setEmpRows={setEmpRows} empSlots={empSlots} setEmpSlots={setEmpSlots} catalogLayout={catalogLayout} categories={svcCatCategories} setCategories={setSvcCatCategories} services={svcCatServices} setServices={setSvcCatServices} catColumns={svcCatColumns} setCatColumns={setSvcCatColumns} svcColumns={svcGridColumns} setSvcColumns={setSvcGridColumns} svcRows={svcGridRows} setSvcRows={setSvcGridRows} catSlots={svcCatSlots} setCatSlots={setSvcCatSlots} svcSlots={svcSlots} setSvcSlots={setSvcSlots} />;
      case 'reports':        return <ReportsModule />;
      case 'provider-admin': return <ProviderAdminPanel onBack={function(){ setActivePage('dashboard'); }} />;
      default:               return <CalendarDayView />;
    }
  }

  // ─── License Activation Gate — show loading while checking ───
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
  // If the station has never been paired to a salon, show the one-time setup screen.
  // Once paired, this never shows again unless unpaired from Salon Settings.
  if (!stationPaired) {
    return <StationSetup onPaired={function() { setStationPaired(true); }} />;
  }

  // ─── Login Gate ───
  // Station is paired but no JWT token — show PIN login screen.
  // After successful login, stores fetch real data from the backend.
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

      {/* ── Server Connection Banner ── */}
      {_staffSource === 'error' && (
        <div style={{ background: '#DC2626', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
          ⚠ Server not connected{_staffError ? ' — ' + _staffError : ''}. Data will not load until the server is running.
        </div>
      )}

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {renderPage()}
      </main>

      {/* ── Online Bookings Notification Popup ── */}
      <OnlineBookingsPopup
        show={showOnlinePopup}
        bookings={onlineBookings}
        unviewedCount={unviewedCount}
        onClose={function() { setShowOnlinePopup(false); }}
        onBookingTap={handleBookingTap}
        onMarkAllViewed={handleMarkAllViewed}
      />
      {/* ── Gift Card Balance Popup (scan anywhere except checkout) ── */}
      <GiftCardBalancePopup giftCards={allGiftCards} enabled={activePage !== 'checkout'} />
      {showCashierModal && (
        <CashierModule
          drawerSession={drawerSession && drawerSession.status === 'open' ? drawerSession : null}
          salonSettings={salonSettings}
          onOpen={function(startingCents) { handleDrawerOpen(startingCents, cashierStaff); }}
          onClose={handleDrawerClose}
          onDismiss={handleDrawerDismiss}
        />
      )}
      {showTimeClockModal && (
        <TimeClockPopup
          show={true}
          clockPunches={clockPunches}
          onPunch={handleClockPunch}
          onDismiss={function() { setShowTimeClockModal(false); }}
        />
      )}
      <VirtualKeyboard />
      <div style={{ position: 'fixed', bottom: 4, right: 8, fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,0.4)', fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none', zIndex: 99999 }}>S105</div>
    </div>
    </ToastProvider>
    </RBACProvider>
    </ThemeContext.Provider>
  );
}
