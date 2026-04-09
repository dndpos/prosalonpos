/**
 * providerMockData.js — Mock Data for Provider Admin Panel
 * Session 53 | Micro-frontend #5 data layer
 *
 * Three levels:
 *   1. Provider Owner (ISO) — sees everything, controls everything
 *   2. Agents (Support / Sales) — limited access, per-agent salon visibility
 *   3. Salon Owners — never see this panel (they use the POS app)
 *
 * Agent roles:
 *   - support: view salon details, toggle features, add notes, view own audit log
 *   - sales:   everything support can do + create new salon accounts
 *
 * Agent visibility:
 *   - all:      sees every salon in the system
 *   - assigned: sees only salons assigned to them
 */

// ═══════════════════════════════════════
// PROVIDER OWNER
// ═══════════════════════════════════════
export var PROVIDER_OWNER = {
  id: 'provider-owner-1',
  name: 'Andy Tran',
  email: 'andy@prosalonpos.com',
  pin: '0000',
  role: 'owner',       // provider-level owner
};

// ═══════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════
export var MOCK_AGENTS = [
  {
    id: 'agent-1',
    name: 'Jessica Rivera',
    email: 'jessica@prosalonpos.com',
    pin: '1234',
    role: 'sales',             // can create salons + everything support can do
    visibility: 'assigned',    // only sees her assigned salons
    assigned_salon_ids: ['salon-1', 'salon-3'],
    active: true,
    created_at: '2025-11-15T10:00:00Z',
  },
  {
    id: 'agent-2',
    name: 'Marcus Chen',
    email: 'marcus@prosalonpos.com',
    pin: '5678',
    role: 'support',           // view + toggle features + notes
    visibility: 'all',         // sees all salons (general support)
    assigned_salon_ids: [],
    active: true,
    created_at: '2026-01-08T14:30:00Z',
  },
];

// ═══════════════════════════════════════
// SALONS
// ═══════════════════════════════════════
export var MOCK_PROVIDER_SALONS = [
  {
    id: 'salon-1',
    name: 'Glamour Nails & Spa',
    owner_name: 'Lily Nguyen',
    owner_phone: '(561) 555-1001',
    owner_email: 'lily@glamournails.com',
    address: '123 PGA Blvd, Palm Beach Gardens, FL 33410',
    status: 'active',             // active | trial | suspended | cancelled
    plan_tier: 'professional',    // basic | professional | premium
    station_count: 3,
    license_key: 'GLAM-PRO-2025-A1B2',
    salon_code: 'GLAMOUR',
    processing_rate: 2.29,        // % credit card processing rate
    monthly_software_fee_cents: 14900,  // $149/mo
    signup_date: '2025-06-15T00:00:00Z',
    trial_end_date: null,
    assigned_agent_id: 'agent-1',
    features_enabled: ['appointments', 'client_profiles', 'loyalty', 'membership', 'gift_cards', 'online_booking', 'text_messaging', 'payroll', 'inventory', 'tech_turn'],
  },
  {
    id: 'salon-2',
    name: 'Bella Hair Studio',
    owner_name: 'Maria Santos',
    owner_phone: '(561) 555-2002',
    owner_email: 'maria@bellahair.com',
    address: '456 Northlake Blvd, North Palm Beach, FL 33408',
    status: 'active',
    plan_tier: 'basic',
    station_count: 2,
    license_key: 'BELL-BAS-2025-C3D4',
    salon_code: 'BELLA',
    processing_rate: 2.49,
    monthly_software_fee_cents: 7900,  // $79/mo
    signup_date: '2025-09-01T00:00:00Z',
    trial_end_date: null,
    assigned_agent_id: null,   // no assigned agent
    features_enabled: ['appointments', 'client_profiles', 'gift_cards', 'tech_turn'],
  },
  {
    id: 'salon-3',
    name: 'Zen Day Spa',
    owner_name: 'David Park',
    owner_phone: '(561) 555-3003',
    owner_email: 'david@zendayspa.com',
    address: '789 US Highway 1, Jupiter, FL 33477',
    status: 'trial',
    plan_tier: 'premium',
    station_count: 5,
    license_key: 'ZEN-PRE-2026-E5F6',
    salon_code: 'ZENSPA',
    processing_rate: 2.19,
    monthly_software_fee_cents: 24900,  // $249/mo
    signup_date: '2026-03-01T00:00:00Z',
    trial_end_date: '2026-03-31T00:00:00Z',
    assigned_agent_id: 'agent-1',
    features_enabled: ['appointments', 'client_profiles', 'loyalty', 'membership', 'gift_cards', 'online_booking', 'group_booking', 'text_messaging', 'payroll', 'inventory', 'tech_turn', 'deposits', 'commission_tiers', 'advanced_reports', 'barcode_scan'],
  },
  {
    id: 'salon-4',
    name: 'Classic Cuts Barbershop',
    owner_name: 'James Brown',
    owner_phone: '(561) 555-4004',
    owner_email: 'james@classiccuts.com',
    address: '321 Indiantown Rd, Jupiter, FL 33458',
    status: 'suspended',
    plan_tier: 'basic',
    station_count: 1,
    license_key: 'CLAS-BAS-2025-G7H8',
    salon_code: 'CLASSIC',
    processing_rate: 2.49,
    monthly_software_fee_cents: 7900,
    signup_date: '2025-04-20T00:00:00Z',
    trial_end_date: null,
    assigned_agent_id: null,
    features_enabled: ['appointments', 'client_profiles'],
  },
];

// ═══════════════════════════════════════
// FEATURE CATALOG — all toggleable features with display info
// ═══════════════════════════════════════
export var FEATURE_CATALOG = [
  { key: 'appointments',        label: 'Appointments & Calendar', tier: 'basic',        description: 'Core booking and calendar' },
  { key: 'client_profiles',     label: 'Client Profiles',         tier: 'basic',        description: 'Client records and history' },
  { key: 'tech_turn',           label: 'Tech Turn Rotation',      tier: 'basic',        description: 'Walk-in rotation system' },
  { key: 'gift_cards',          label: 'Gift Cards',              tier: 'basic',        description: 'Gift card sales and redemption' },
  { key: 'loyalty',             label: 'Loyalty Program',         tier: 'professional', description: 'Points and rewards' },
  { key: 'membership',          label: 'Membership Plans',        tier: 'professional', description: 'Recurring membership billing' },
  { key: 'online_booking',      label: 'Online Booking',          tier: 'professional', description: 'Client-facing booking portal' },
  { key: 'group_booking',       label: 'Group Booking',           tier: 'professional', description: 'Multi-person online booking' },
  { key: 'text_messaging',      label: 'Text Messaging',          tier: 'professional', description: 'SMS/email notifications' },
  { key: 'inventory',           label: 'Inventory',               tier: 'professional', description: 'Product tracking and orders' },
  { key: 'payroll',             label: 'Payroll',                 tier: 'professional', description: 'Paycheck generation' },
  { key: 'deposits',            label: 'Deposits',                tier: 'professional', description: 'Booking deposit collection' },
  { key: 'commission_tiers',    label: 'Commission Tiers',        tier: 'premium',      description: 'Tiered commission structures' },
  { key: 'advanced_reports',    label: 'Advanced Reports',        tier: 'premium',      description: 'Detailed analytics' },
  { key: 'barcode_scan',        label: 'Barcode Scanning',        tier: 'premium',      description: 'Scan products at checkout' },
  { key: 'multi_location',      label: 'Multi-Location',          tier: 'premium',      description: 'Cross-location management' },
  { key: 'purchase_orders',     label: 'Purchase Orders',         tier: 'premium',      description: 'Supplier order management' },
  { key: 'confirmation_system', label: 'Confirmation System',     tier: 'premium',      description: 'Appointment confirmation workflow' },
  // Provider-level toggles
  { key: 'provider_pay_services_split', label: 'Pay/Services Split',  tier: 'provider', description: 'Unlock paycheck/services % on staff Pay tab' },
  { key: 'provider_print_check',        label: 'Print Checks',        tier: 'provider', description: 'Unlock check printing in payroll' },
];

// ═══════════════════════════════════════
// PLAN TIERS — what's included at each level
// ═══════════════════════════════════════
export var PLAN_TIERS = {
  basic:        { label: 'Basic',        color: '#6B7280', monthly_cents: 7900,  includes: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards'] },
  professional: { label: 'Professional', color: '#3B82F6', monthly_cents: 14900, includes: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards', 'loyalty', 'membership', 'online_booking', 'group_booking', 'text_messaging', 'inventory', 'payroll', 'deposits'] },
  premium:      { label: 'Premium',      color: '#8B5CF6', monthly_cents: 24900, includes: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards', 'loyalty', 'membership', 'online_booking', 'group_booking', 'text_messaging', 'inventory', 'payroll', 'deposits', 'commission_tiers', 'advanced_reports', 'barcode_scan', 'multi_location', 'purchase_orders', 'confirmation_system'] },
};

// ═══════════════════════════════════════
// BILLING RECORDS
// ═══════════════════════════════════════
export var MOCK_BILLING_RECORDS = [
  { id: 'bill-1', salon_id: 'salon-1', amount_cents: 14900, date: '2026-03-01', status: 'paid', method: 'ACH' },
  { id: 'bill-2', salon_id: 'salon-1', amount_cents: 14900, date: '2026-02-01', status: 'paid', method: 'ACH' },
  { id: 'bill-3', salon_id: 'salon-1', amount_cents: 14900, date: '2026-01-01', status: 'paid', method: 'ACH' },
  { id: 'bill-4', salon_id: 'salon-2', amount_cents: 7900,  date: '2026-03-01', status: 'paid', method: 'Credit Card' },
  { id: 'bill-5', salon_id: 'salon-2', amount_cents: 7900,  date: '2026-02-01', status: 'paid', method: 'Credit Card' },
  { id: 'bill-6', salon_id: 'salon-3', amount_cents: 0,     date: '2026-03-01', status: 'trial', method: 'N/A' },
  { id: 'bill-7', salon_id: 'salon-4', amount_cents: 7900,  date: '2026-02-01', status: 'overdue', method: 'Credit Card' },
  { id: 'bill-8', salon_id: 'salon-4', amount_cents: 7900,  date: '2026-03-01', status: 'overdue', method: 'Credit Card' },
];

// ═══════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════
export var MOCK_AUDIT_LOG = [
  { id: 'audit-1',  actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'feature_toggled',  detail: 'Enabled "Payroll" for Glamour Nails & Spa',             salon_id: 'salon-1', timestamp: '2026-03-28T14:30:00Z' },
  { id: 'audit-2',  actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'note_added',       detail: 'Added support note: "Owner called about commission setup"', salon_id: 'salon-1', timestamp: '2026-03-27T11:15:00Z' },
  { id: 'audit-3',  actor_id: 'agent-2',          actor_name: 'Marcus Chen',     action: 'feature_toggled',  detail: 'Enabled "Online Booking" for Bella Hair Studio',        salon_id: 'salon-2', timestamp: '2026-03-26T16:45:00Z' },
  { id: 'audit-4',  actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'salon_created',    detail: 'Created salon account: Zen Day Spa (Premium trial)',     salon_id: 'salon-3', timestamp: '2026-03-01T09:00:00Z' },
  { id: 'audit-5',  actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'salon_created',    detail: 'Created salon account: Glamour Nails & Spa',            salon_id: 'salon-1', timestamp: '2025-06-15T10:30:00Z' },
  { id: 'audit-6',  actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'agent_created',    detail: 'Created agent: Jessica Rivera (Sales)',                 salon_id: null,      timestamp: '2025-11-15T10:00:00Z' },
  { id: 'audit-7',  actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'salon_suspended',  detail: 'Suspended Classic Cuts Barbershop — 2 months overdue',  salon_id: 'salon-4', timestamp: '2026-03-15T08:00:00Z' },
  { id: 'audit-8',  actor_id: 'agent-2',          actor_name: 'Marcus Chen',     action: 'note_added',       detail: 'Added support note: "Helped owner set up gift cards"',   salon_id: 'salon-2', timestamp: '2026-03-20T13:00:00Z' },
  { id: 'audit-9',  actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'agent_created',    detail: 'Created agent: Marcus Chen (Support)',                  salon_id: null,      timestamp: '2026-01-08T14:30:00Z' },
  { id: 'audit-10', actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'feature_toggled',  detail: 'Enabled "Commission Tiers" for Zen Day Spa',            salon_id: 'salon-3', timestamp: '2026-03-05T10:00:00Z' },
];

// ═══════════════════════════════════════
// SALON NOTES (support history)
// ═══════════════════════════════════════
export var MOCK_SALON_NOTES = [
  { id: 'note-1', salon_id: 'salon-1', agent_id: 'agent-1',          agent_name: 'Jessica Rivera', content: 'Owner called about commission setup. Walked her through flat rate vs tiered. She wants flat 40% for now.', created_at: '2026-03-27T11:15:00Z' },
  { id: 'note-2', salon_id: 'salon-1', agent_id: 'provider-owner-1', agent_name: 'Andy Tran',      content: 'Enabled payroll module. Owner confirmed she wants check printing too — enabled provider toggle.',          created_at: '2026-03-28T14:30:00Z' },
  { id: 'note-3', salon_id: 'salon-2', agent_id: 'agent-2',          agent_name: 'Marcus Chen',    content: 'Helped owner set up gift cards. She wants to sell $25, $50, $100 denominations. All configured.',           created_at: '2026-03-20T13:00:00Z' },
  { id: 'note-4', salon_id: 'salon-3', agent_id: 'agent-1',          agent_name: 'Jessica Rivera', content: 'New premium trial started. Owner wants full demo of all features. Scheduled training call for next week.',   created_at: '2026-03-01T09:30:00Z' },
  { id: 'note-5', salon_id: 'salon-4', agent_id: 'provider-owner-1', agent_name: 'Andy Tran',      content: 'Owner not responding to calls. 2 months overdue. Suspended account pending payment.',                      created_at: '2026-03-15T08:00:00Z' },
];
