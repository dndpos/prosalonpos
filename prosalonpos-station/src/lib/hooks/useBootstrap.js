/**
 * useBootstrap.js — Single-call data loader for login
 * Session 99 | Performance Optimization
 *
 * Replaces 14 individual store fetches with ONE /bootstrap API call.
 * Hydrates all Zustand stores directly from the single response.
 * Falls back to individual fetches if bootstrap endpoint fails.
 *
 * Performance gain: eliminates 13 network round trips on every login.
 * On Railway (Virginia → Florida), saves ~1.5-3 seconds.
 */

import { api } from '../apiClient';
import { useStaffStore } from '../stores/staffStore';
import { useServiceStore } from '../stores/serviceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useClientStore } from '../stores/clientStore';
import { useAppointmentStore, normalizeAll as normalizeServiceLines } from '../stores/appointmentStore';
import { useTicketStore } from '../stores/ticketStore';
import { useGiftCardStore } from '../stores/giftCardStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useLoyaltyStore } from '../stores/loyaltyStore';
import { useMembershipStore } from '../stores/membershipStore';
import { useMessagingStore } from '../stores/messagingStore';
import { usePackageStore } from '../stores/packageStore';

// Settings defaults (must match settingsStore._DEFAULT_SETTINGS)
var SETTINGS_DEFAULTS = {
  salon_name: '', salon_phone: '', salon_email: '', salon_address: '',
  salon_address_line1: '', salon_address_line2: '',
  open_hour: 9, open_min: 0, close_hour: 19, close_min: 0, buffer_minutes: 30,
  tax_rate_percentage: 7.5, tip_enabled: true, tip_presets: [18, 20, 25],
  price_adjust_permission: 'all_staff',
  discount_types_enabled: ['pct_total', 'flat_total', 'pct_line_item'],
  discount_default_type: 'flat_total',
  discount_presets_pct: [10, 15, 20, 25],
  discount_presets_flat_cents: [500, 1000, 1500, 2000],
  discount_permission: 'all_staff',
  commission_enabled: false,
  retail_commission_enabled: false,
  retail_commission_pct: 0,
  check_next_number: 1001,
};

/**
 * Load all app data in a single API call and hydrate stores.
 * Returns true if bootstrap succeeded, false if caller should fall back.
 */
async function bootstrapStores() {
  try {
    var data = await api.get('/bootstrap');

    // Staff
    useStaffStore.setState({
      staff: data.staff || [], loading: false, source: 'api', initialized: true, error: null,
      pinTable: data.pinTable || null,
    });

    // Services + Categories
    useServiceStore.setState({
      services: data.services || [], categories: data.categories || [],
      loading: false, source: 'api', initialized: true, error: null
    });

    // Settings (merge with defaults)
    useSettingsStore.setState({
      settings: Object.assign({}, SETTINGS_DEFAULTS, data.settings || {}),
      loading: false, source: 'api', initialized: true, error: null
    });

    // Clients
    useClientStore.setState({
      clients: data.clients || [], loading: false, source: 'api', initialized: true, error: null
    });

    // Today's service lines (calendar)
    useAppointmentStore.setState({
      serviceLines: normalizeServiceLines(data.serviceLines),
      loading: false, source: 'api', initialized: true, error: null,
      loadedDate: data.today || null
    });

    // Tickets (split open/closed)
    var tickets = data.tickets || [];
    var openT = tickets.filter(function(t) { return t.status === 'open'; });
    var closedT = tickets.filter(function(t) { return t.status !== 'open'; });
    useTicketStore.setState({
      openTickets: openT, closedTickets: closedT,
      loading: false, source: 'api', initialized: true, error: null
    });

    // Gift cards
    useGiftCardStore.setState({
      giftCards: data.giftCards || [], loading: false, source: 'api', initialized: true, error: null
    });

    // Inventory / Products
    useInventoryStore.setState({
      products: data.products || [], loading: false, source: 'api', initialized: true, error: null
    });

    // Loyalty
    useLoyaltyStore.setState({
      program: data.loyaltyProgram || null, loading: false, source: 'api', initialized: true, error: null
    });

    // Memberships
    useMembershipStore.setState({
      plans: data.membershipPlans || [], loading: false, source: 'api', initialized: true, error: null
    });

    // Messaging templates
    useMessagingStore.setState({
      templates: data.templates || [], loading: false, source: 'api', initialized: true, error: null
    });

    // Packages
    usePackageStore.setState({
      packages: data.packages || [], packageItems: data.packageItems || [], loading: false, source: 'api', initialized: true, error: null
    });

    return true;
  } catch (err) {
    return false;
  }
}

export { bootstrapStores };
