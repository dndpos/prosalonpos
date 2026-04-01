/**
 * RBAC Permission Engine — Session 34
 *
 * System design (locked Session 32, updated Session 34):
 *   - No login screen — system stays open
 *   - PIN popup only when action requires it
 *   - Every staff member gets a 4-digit PIN
 *   - Four roles: owner, manager, receptionist, tech
 *   - Role sets default permissions
 *   - Per-tech overrides in staff profile can grant OR revoke any permission
 *   - Cashier feature tied to RBAC — PIN identifies who processed each transaction
 *
 * 27 protected actions with default role access.
 */

// ═══════════════════════════════════════
// ACTION KEYS — stable identifiers for all 25 protected actions
// ═══════════════════════════════════════
export var ACTIONS = {
  CREATE_EDIT_APPOINTMENTS: 'create_edit_appointments',
  DELETE_CANCEL_APPOINTMENTS: 'delete_cancel_appointments',
  MOVE_APPOINTMENTS: 'move_appointments',
  PROCESS_CHECKOUT: 'process_checkout',
  PROCESS_CASH_PAYMENTS: 'process_cash_payments',
  APPLY_DISCOUNTS: 'apply_discounts',
  VOID_TICKET: 'void_ticket',
  PROCESS_REFUNDS: 'process_refunds',
  EDIT_PRICES_CHECKOUT: 'edit_prices_checkout',
  SALON_SETTINGS: 'salon_settings',
  STAFF_MANAGEMENT: 'staff_management',
  SERVICE_CATALOG: 'service_catalog',
  PAYROLL: 'payroll',
  BILL_PAY: 'bill_pay',
  REPORTS: 'reports',
  INVENTORY: 'inventory',
  VIEW_EDIT_CLIENTS: 'view_edit_clients',
  DELETE_CLIENTS: 'delete_clients',
  GIFT_CARD_MANAGEMENT: 'gift_card_management',
  LOYALTY_MEMBERSHIP: 'loyalty_membership',
  SEND_TEXT_BLASTS: 'send_text_blasts',
  ONLINE_BOOKING_SETTINGS: 'online_booking_settings',
  PACKAGES_MANAGEMENT: 'packages_management',
  CLOCK_IN_OUT: 'clock_in_out',
  EDIT_TIMESHEETS: 'edit_timesheets',
  VIEW_TIMESHEET_REPORTS: 'view_timesheet_reports',
  CASHIER_DRAWER: 'cashier_drawer',
};

// ═══════════════════════════════════════
// ACTION METADATA — human-readable labels + categories for settings UI
// ═══════════════════════════════════════
export var ACTION_META = {};
ACTION_META[ACTIONS.CREATE_EDIT_APPOINTMENTS]  = { label: 'Create/edit appointments',     category: 'Calendar' };
ACTION_META[ACTIONS.DELETE_CANCEL_APPOINTMENTS] = { label: 'Delete/cancel appointments',   category: 'Calendar' };
ACTION_META[ACTIONS.MOVE_APPOINTMENTS]          = { label: 'Move appointments between techs', category: 'Calendar' };
ACTION_META[ACTIONS.PROCESS_CHECKOUT]            = { label: 'Process checkout',               category: 'Checkout' };
ACTION_META[ACTIONS.PROCESS_CASH_PAYMENTS]      = { label: 'Process cash payments',        category: 'Checkout' };
ACTION_META[ACTIONS.APPLY_DISCOUNTS]            = { label: 'Apply discounts',              category: 'Checkout' };
ACTION_META[ACTIONS.VOID_TICKET]                = { label: 'Void a ticket',                category: 'Checkout' };
ACTION_META[ACTIONS.PROCESS_REFUNDS]            = { label: 'Process refunds',              category: 'Checkout' };
ACTION_META[ACTIONS.EDIT_PRICES_CHECKOUT]        = { label: 'Edit prices at checkout',      category: 'Checkout' };
ACTION_META[ACTIONS.SALON_SETTINGS]             = { label: 'Salon Settings',               category: 'Admin' };
ACTION_META[ACTIONS.STAFF_MANAGEMENT]           = { label: 'Staff Management',             category: 'Admin' };
ACTION_META[ACTIONS.SERVICE_CATALOG]            = { label: 'Service Catalog',              category: 'Admin' };
ACTION_META[ACTIONS.PAYROLL]                    = { label: 'Payroll',                      category: 'Admin' };
ACTION_META[ACTIONS.BILL_PAY]                   = { label: 'Bill Pay',                     category: 'Admin' };
ACTION_META[ACTIONS.REPORTS]                    = { label: 'Reports',                      category: 'Admin' };
ACTION_META[ACTIONS.INVENTORY]                  = { label: 'Inventory',                    category: 'Admin' };
ACTION_META[ACTIONS.VIEW_EDIT_CLIENTS]          = { label: 'View/edit client profiles',    category: 'Clients' };
ACTION_META[ACTIONS.DELETE_CLIENTS]             = { label: 'Delete clients',               category: 'Clients' };
ACTION_META[ACTIONS.GIFT_CARD_MANAGEMENT]       = { label: 'Gift card management',         category: 'Programs' };
ACTION_META[ACTIONS.LOYALTY_MEMBERSHIP]         = { label: 'Loyalty/Membership management',category: 'Programs' };
ACTION_META[ACTIONS.SEND_TEXT_BLASTS]           = { label: 'Send text message blasts',     category: 'Messaging' };
ACTION_META[ACTIONS.ONLINE_BOOKING_SETTINGS]    = { label: 'Online booking settings',      category: 'Admin' };
ACTION_META[ACTIONS.PACKAGES_MANAGEMENT]        = { label: 'Packages management',          category: 'Admin' };
ACTION_META[ACTIONS.CLOCK_IN_OUT]               = { label: 'Clock in/out',                 category: 'Time Clock' };
ACTION_META[ACTIONS.EDIT_TIMESHEETS]            = { label: 'Edit timesheets',              category: 'Time Clock' };
ACTION_META[ACTIONS.VIEW_TIMESHEET_REPORTS]     = { label: 'View timesheet reports',       category: 'Time Clock' };
ACTION_META[ACTIONS.CASHIER_DRAWER]              = { label: 'Cash drawer in/out',           category: 'Checkout' };

// ═══════════════════════════════════════
// ROLE DEFAULTS — the 25-action permission table from Session 32
// true = allowed by default for this role
// ═══════════════════════════════════════
var ROLE_DEFAULTS = {
  owner: {},
  manager: {},
  receptionist: {},
  tech: {},
};

// Owner gets everything
Object.keys(ACTIONS).forEach(function(k) {
  ROLE_DEFAULTS.owner[ACTIONS[k]] = true;
});

// Manager defaults
ROLE_DEFAULTS.manager[ACTIONS.CREATE_EDIT_APPOINTMENTS]  = true;
ROLE_DEFAULTS.manager[ACTIONS.DELETE_CANCEL_APPOINTMENTS] = true;
ROLE_DEFAULTS.manager[ACTIONS.MOVE_APPOINTMENTS]          = true;
ROLE_DEFAULTS.manager[ACTIONS.PROCESS_CHECKOUT]            = true;
ROLE_DEFAULTS.manager[ACTIONS.PROCESS_CASH_PAYMENTS]      = true;
ROLE_DEFAULTS.manager[ACTIONS.APPLY_DISCOUNTS]            = true;
ROLE_DEFAULTS.manager[ACTIONS.VOID_TICKET]                = false;
ROLE_DEFAULTS.manager[ACTIONS.PROCESS_REFUNDS]            = false;
ROLE_DEFAULTS.manager[ACTIONS.EDIT_PRICES_CHECKOUT]        = true;
ROLE_DEFAULTS.manager[ACTIONS.SALON_SETTINGS]             = false;
ROLE_DEFAULTS.manager[ACTIONS.STAFF_MANAGEMENT]           = false;
ROLE_DEFAULTS.manager[ACTIONS.SERVICE_CATALOG]            = true;
ROLE_DEFAULTS.manager[ACTIONS.PAYROLL]                    = false;
ROLE_DEFAULTS.manager[ACTIONS.BILL_PAY]                   = false;
ROLE_DEFAULTS.manager[ACTIONS.REPORTS]                    = true;
ROLE_DEFAULTS.manager[ACTIONS.INVENTORY]                  = true;
ROLE_DEFAULTS.manager[ACTIONS.VIEW_EDIT_CLIENTS]          = true;
ROLE_DEFAULTS.manager[ACTIONS.DELETE_CLIENTS]             = false;
ROLE_DEFAULTS.manager[ACTIONS.GIFT_CARD_MANAGEMENT]       = true;
ROLE_DEFAULTS.manager[ACTIONS.LOYALTY_MEMBERSHIP]         = true;
ROLE_DEFAULTS.manager[ACTIONS.SEND_TEXT_BLASTS]           = false;
ROLE_DEFAULTS.manager[ACTIONS.ONLINE_BOOKING_SETTINGS]    = false;
ROLE_DEFAULTS.manager[ACTIONS.PACKAGES_MANAGEMENT]        = true;
ROLE_DEFAULTS.manager[ACTIONS.CLOCK_IN_OUT]               = true;
ROLE_DEFAULTS.manager[ACTIONS.EDIT_TIMESHEETS]            = false;
ROLE_DEFAULTS.manager[ACTIONS.VIEW_TIMESHEET_REPORTS]     = true;
ROLE_DEFAULTS.manager[ACTIONS.CASHIER_DRAWER]             = true;

// Receptionist defaults — front desk duties
ROLE_DEFAULTS.receptionist[ACTIONS.CREATE_EDIT_APPOINTMENTS]   = true;
ROLE_DEFAULTS.receptionist[ACTIONS.DELETE_CANCEL_APPOINTMENTS] = true;
ROLE_DEFAULTS.receptionist[ACTIONS.MOVE_APPOINTMENTS]          = true;
ROLE_DEFAULTS.receptionist[ACTIONS.PROCESS_CHECKOUT]            = true;
ROLE_DEFAULTS.receptionist[ACTIONS.PROCESS_CASH_PAYMENTS]      = true;
ROLE_DEFAULTS.receptionist[ACTIONS.APPLY_DISCOUNTS]            = false;
ROLE_DEFAULTS.receptionist[ACTIONS.VOID_TICKET]                = false;
ROLE_DEFAULTS.receptionist[ACTIONS.PROCESS_REFUNDS]            = false;
ROLE_DEFAULTS.receptionist[ACTIONS.EDIT_PRICES_CHECKOUT]       = false;
ROLE_DEFAULTS.receptionist[ACTIONS.SALON_SETTINGS]             = false;
ROLE_DEFAULTS.receptionist[ACTIONS.STAFF_MANAGEMENT]           = false;
ROLE_DEFAULTS.receptionist[ACTIONS.SERVICE_CATALOG]            = false;
ROLE_DEFAULTS.receptionist[ACTIONS.PAYROLL]                    = false;
ROLE_DEFAULTS.receptionist[ACTIONS.BILL_PAY]                   = false;
ROLE_DEFAULTS.receptionist[ACTIONS.REPORTS]                    = false;
ROLE_DEFAULTS.receptionist[ACTIONS.INVENTORY]                  = false;
ROLE_DEFAULTS.receptionist[ACTIONS.VIEW_EDIT_CLIENTS]          = true;
ROLE_DEFAULTS.receptionist[ACTIONS.DELETE_CLIENTS]             = false;
ROLE_DEFAULTS.receptionist[ACTIONS.GIFT_CARD_MANAGEMENT]       = true;
ROLE_DEFAULTS.receptionist[ACTIONS.LOYALTY_MEMBERSHIP]         = true;
ROLE_DEFAULTS.receptionist[ACTIONS.SEND_TEXT_BLASTS]           = false;
ROLE_DEFAULTS.receptionist[ACTIONS.ONLINE_BOOKING_SETTINGS]    = false;
ROLE_DEFAULTS.receptionist[ACTIONS.PACKAGES_MANAGEMENT]        = false;
ROLE_DEFAULTS.receptionist[ACTIONS.CLOCK_IN_OUT]               = true;
ROLE_DEFAULTS.receptionist[ACTIONS.EDIT_TIMESHEETS]            = false;
ROLE_DEFAULTS.receptionist[ACTIONS.VIEW_TIMESHEET_REPORTS]     = false;
ROLE_DEFAULTS.receptionist[ACTIONS.CASHIER_DRAWER]             = true;

// Tech defaults — very limited
Object.keys(ACTIONS).forEach(function(k) {
  if (ROLE_DEFAULTS.tech[ACTIONS[k]] === undefined) ROLE_DEFAULTS.tech[ACTIONS[k]] = false;
});
ROLE_DEFAULTS.tech[ACTIONS.EDIT_PRICES_CHECKOUT] = true;
ROLE_DEFAULTS.tech[ACTIONS.CLOCK_IN_OUT]          = true;

export { ROLE_DEFAULTS };

// ═══════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════

/**
 * Check if a staff member has permission for an action.
 *
 * Resolution order:
 *   1. Per-tech override (grant OR revoke) — highest priority
 *   2. Salon-customized role defaults (from salonSettings.role_permissions)
 *   3. Hardcoded role defaults from ROLE_DEFAULTS table
 *
 * @param {object} staff — staff record with rbac_role and permission_overrides
 * @param {string} actionKey — one of the ACTIONS values
 * @param {object} [rolePermissions] — optional salon-customized role permissions map
 * @returns {boolean}
 */
export function hasPermission(staff, actionKey, rolePermissions) {
  if (!staff) return false;

  var role = staff.rbac_role || mapLegacyRole(staff.role);

  // 1. Check per-tech override first
  var overrides = staff.permission_overrides || {};
  if (overrides[actionKey] !== undefined) {
    return !!overrides[actionKey];
  }

  // 2. Check salon-customized role defaults
  if (rolePermissions && rolePermissions[role] && rolePermissions[role][actionKey] !== undefined) {
    return !!rolePermissions[role][actionKey];
  }

  // 3. Fall back to hardcoded role default
  var roleDefs = ROLE_DEFAULTS[role];
  if (!roleDefs) return false;
  return !!roleDefs[actionKey];
}

/**
 * Map legacy staff.role values to RBAC roles.
 * Existing mock data uses 'technician' and 'manager' — no 'owner' yet.
 */
function mapLegacyRole(legacyRole) {
  if (legacyRole === 'owner') return 'owner';
  if (legacyRole === 'manager') return 'manager';
  if (legacyRole === 'receptionist') return 'receptionist';
  if (legacyRole === 'technician') return 'tech';
  return 'tech'; // default to most restrictive
}

/**
 * Get all permissions for a staff member (for settings UI display).
 * Returns { actionKey: boolean } for all 25 actions.
 */
export function getAllPermissions(staff, rolePermissions) {
  var result = {};
  Object.keys(ACTIONS).forEach(function(k) {
    result[ACTIONS[k]] = hasPermission(staff, ACTIONS[k], rolePermissions);
  });
  return result;
}

/**
 * Validate a 4-digit PIN against a staff list.
 * Returns the matching staff record or null.
 *
 * In Phase 1 (mock data), we compare plain text PINs.
 * Phase 2: compare against hashed PINs with bcrypt or similar.
 */
export function validatePin(pin, staffList) {
  if (!pin || pin.length < 2 || pin.length > 8) return null;
  return staffList.find(function(s) {
    return s.active && s.pin === pin;
  }) || null;
}
