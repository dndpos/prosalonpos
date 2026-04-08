/**
 * Pro Salon POS — Feature Flags
 * Centralized feature flag definitions.
 * 
 * Reference: Engineering Standards §19
 * 
 * Usage:
 *   import { FEATURES, isFeatureEnabled } from '../lib/features';
 *   if (isFeatureEnabled(FEATURES.LOYALTY)) { ... }
 * 
 * Lifecycle: Introduced → Tested → Stable → Removed. No permanent flags.
 */

export const FEATURES = {
  // ── Core (always on in v1) ──
  APPOINTMENTS:          { name: 'appointments',          default: true,  description: 'Appointment booking and calendar',       expires: null },
  CLIENT_PROFILES:       { name: 'client_profiles',       default: true,  description: 'Client records and history',             expires: null },

  // ── Modular features (toggled per salon via licensing) ──
  LOYALTY:               { name: 'loyalty',               default: false, description: 'Loyalty points module',                  expires: null },
  MEMBERSHIP:            { name: 'membership',            default: false, description: 'Membership plans module',                expires: null },
  GIFT_CARDS:            { name: 'gift_cards',            default: false, description: 'Gift card module',                       expires: null },
  ONLINE_BOOKING:        { name: 'online_booking',        default: false, description: 'Online booking portal',                  expires: null },
  GROUP_BOOKING:         { name: 'group_booking',         default: false, description: 'Group booking within online portal',     expires: null },
  TEXT_MESSAGING:        { name: 'text_messaging',        default: false, description: 'SMS/email messaging module',             expires: null },
  INVENTORY:             { name: 'inventory',             default: false, description: 'Retail inventory module',                expires: null },
  PURCHASE_ORDERS:       { name: 'purchase_orders',       default: false, description: 'Purchase order system within inventory', expires: null },
  TECH_TURN:             { name: 'tech_turn',             default: false, description: 'Tech turn rotation system',              expires: null },
  DEPOSITS:              { name: 'deposits',              default: false, description: 'Deposit collection system',              expires: null },
  CONFIRMATION_SYSTEM:   { name: 'confirmation_system',   default: false, description: 'Appointment confirmation workflow',      expires: null },
  PAYROLL:               { name: 'payroll',               default: false, description: 'Payroll and paycheck generation',        expires: null },
  COMMISSION_TIERS:      { name: 'commission_tiers',      default: false, description: 'Tiered commission structures',           expires: null },
  MULTI_LOCATION:        { name: 'multi_location',        default: false, description: 'Multi-location features',               expires: null },
  ADVANCED_REPORTS:      { name: 'advanced_reports',      default: false, description: 'Advanced reporting module',              expires: null },
  BARCODE_SCAN:          { name: 'barcode_scan',          default: false, description: 'Barcode scanning at checkout',           expires: null },

  // ── Provider-level flags (controlled by ProSalonPOS provider, NOT salon owner) ──
  // Phase 2: These move to a Provider Admin panel. Provider toggles per-salon.
  // Default OFF = salon only sees Paycheck at 100%. Provider turns ON to unlock.
  PROVIDER_PAY_SERVICES_SPLIT: { name: 'provider_pay_services_split', default: false, description: 'Unlock paycheck/services % split on staff Pay tab (provider-controlled)', expires: null },
  PROVIDER_PRINT_CHECK:        { name: 'provider_print_check',        default: false, description: 'Unlock print check option in payroll (provider-controlled)',              expires: null },
  // More provider-level toggles expected — add here as they come up.
};

// In-memory overrides (for development and testing)
const overrides = {};

/**
 * Check if a feature is enabled.
 * In Phase 1 (mock data), all features default to their flag value.
 * In Phase 2+, this will check salon licensing status.
 */
export function isFeatureEnabled(feature) {
  if (overrides[feature.name] !== undefined) {
    return overrides[feature.name];
  }
  return feature.default;
}

/**
 * Override a feature flag (for dev/testing only).
 */
export function setFeatureOverride(feature, enabled) {
  overrides[feature.name] = enabled;
}

/**
 * Clear all overrides.
 */
export function clearOverrides() {
  Object.keys(overrides).forEach(k => delete overrides[k]);
}
