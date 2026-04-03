/**
 * ProSalonPOS — Database Seed
 * Creates one salon with staff, services, categories, clients, and settings.
 * Matches the mock data in the frontend so the app looks the same when connected.
 *
 * Run: node prisma/seed.js
 *   (from the prosalonpos-server folder)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

var prisma = new PrismaClient();

function hashPin(pin) {
  return bcrypt.hashSync(String(pin), 12);
}

async function main() {
  console.log('Seeding database...');

  // ════════════════════════════════════════════
  // SALON
  // ════════════════════════════════════════════
  var salon = await prisma.salon.create({
    data: {
      id: 'salon-01',
      salon_code: 'LUXE2026',
      name: 'Luxe Hair Studio',
      phone: '(561) 555-0100',
      email: 'info@luxehairstudio.com',
      address1: '123 Royal Palm Way',
      address2: 'Palm Beach Gardens, FL 33410',
    }
  });
  console.log('  Created salon: ' + salon.name);

  // ════════════════════════════════════════════
  // STAFF
  // ════════════════════════════════════════════
  var staffData = [
    { id: 'staff-01', display_name: 'Maria',  legal_name: 'Maria Gonzalez',  role: 'technician', rbac_role: 'tech',    pin: '1111', tech_turn_eligible: true,  pay_type: 'commission', commission_pct: 60, daily_guarantee_cents: 20000, payout_check_pct: 80, payout_bonus_pct: 20, permissions: { void: false, refund: false, discount: true }, position: 1 },
    { id: 'staff-02', display_name: 'Ashley', legal_name: 'Ashley Williams', role: 'technician', rbac_role: 'tech',    pin: '2222', tech_turn_eligible: true,  pay_type: 'commission', commission_pct: 55, daily_guarantee_cents: 18000, payout_check_pct: 80, payout_bonus_pct: 20, permissions: { void: false, refund: false, discount: true }, position: 2 },
    { id: 'staff-03', display_name: 'James',  legal_name: 'James Chen',      role: 'technician', rbac_role: 'tech',    pin: '3333', tech_turn_eligible: true,  pay_type: 'hourly', hourly_rate_cents: 1800, commission_bonus_enabled: true, commission_pct: 15, payout_check_pct: 100, payout_bonus_pct: 0, permissions: { void: false, refund: false, discount: false }, position: 3 },
    { id: 'staff-04', display_name: 'Nicole', legal_name: 'Nicole Johnson',  role: 'technician', rbac_role: 'tech',    pin: '4444', tech_turn_eligible: true,  pay_type: 'commission', commission_pct: 60, daily_guarantee_cents: 15000, payout_check_pct: 70, payout_bonus_pct: 30, permissions: { void: false, refund: false, discount: true }, position: 4 },
    { id: 'staff-05', display_name: 'David',  legal_name: 'David Park',      role: 'technician', rbac_role: 'tech',    pin: '5555', tech_turn_eligible: true,  pay_type: 'commission', commission_pct: 50, daily_guarantee_cents: 0, payout_check_pct: 80, payout_bonus_pct: 20, permissions: { void: false, refund: false, discount: true }, position: 5 },
    { id: 'staff-06', display_name: 'Sarah',  legal_name: 'Sarah Thompson',  role: 'manager',    rbac_role: 'manager', pin: '6666', tech_turn_eligible: false, pay_type: 'salary', salary_amount_cents: 320000, salary_period: 'biweekly', payout_check_pct: 100, payout_bonus_pct: 0, permissions: { void: true, refund: true, discount: true }, position: 6 },
    { id: 'staff-00', display_name: 'Alex',   legal_name: 'Alex Tran',       role: 'owner',      rbac_role: 'owner',   pin: '0000', tech_turn_eligible: false, pay_type: 'salary', salary_amount_cents: 0, payout_check_pct: 100, payout_bonus_pct: 0, permissions: { void: true, refund: true, discount: true }, position: 0 },
  ];

  for (var i = 0; i < staffData.length; i++) {
    var sd = staffData[i];
    await prisma.staff.create({
      data: {
        id: sd.id,
        salon_id: salon.id,
        display_name: sd.display_name,
        legal_name: sd.legal_name,
        role: sd.role,
        rbac_role: sd.rbac_role,
        pin_hash: hashPin(sd.pin),
        active: true,
        status: 'active',
        tech_turn_eligible: sd.tech_turn_eligible,
        pay_type: sd.pay_type,
        commission_pct: sd.commission_pct || 0,
        daily_guarantee_cents: sd.daily_guarantee_cents || 0,
        hourly_rate_cents: sd.hourly_rate_cents || null,
        commission_bonus_enabled: sd.commission_bonus_enabled || false,
        salary_amount_cents: sd.salary_amount_cents || null,
        salary_period: sd.salary_period || null,
        payout_check_pct: sd.payout_check_pct || 100,
        payout_bonus_pct: sd.payout_bonus_pct || 0,
        permissions: sd.permissions,
        position: sd.position,
      }
    });
  }
  console.log('  Created ' + staffData.length + ' staff members');

  // ════════════════════════════════════════════
  // SERVICE CATEGORIES
  // ════════════════════════════════════════════
  var categories = [
    { id: 'cat-01', name: 'Hair',  calendar_color: '#F59E0B', position: 1 },
    { id: 'cat-02', name: 'Nails', calendar_color: '#EC4899', position: 2 },
    { id: 'cat-03', name: 'Color', calendar_color: '#8B5CF6', position: 3 },
    { id: 'cat-04', name: 'Skin',  calendar_color: '#10B981', position: 4 },
    { id: 'cat-05', name: 'Men',   calendar_color: '#3B82F6', position: 5 },
  ];

  for (var ci = 0; ci < categories.length; ci++) {
    var c = categories[ci];
    await prisma.serviceCategory.create({
      data: { id: c.id, salon_id: salon.id, name: c.name, calendar_color: c.calendar_color, position: c.position }
    });
  }
  console.log('  Created ' + categories.length + ' categories');

  // ════════════════════════════════════════════
  // SERVICES (core set — matches frontend mock data)
  // ════════════════════════════════════════════
  var services = [
    // Hair
    { id: 'svc-01', name: "Women's Haircut",  color: '#EF4444', dur: 45,  price: 5500,  cost: 150,  cats: ['cat-01'], pos: 1 },
    { id: 'svc-02', name: 'Blowout',          color: '#EC4899', dur: 30,  price: 3500,  cost: 200,  cats: ['cat-01'], pos: 2 },
    { id: 'svc-03', name: 'Updo',             color: '#D946EF', dur: 60,  price: 7500,  cost: 300,  cats: ['cat-01'], pos: 3 },
    { id: 'svc-04', name: 'Deep Conditioning', color: '#F97316', dur: 30, price: 4000,  cost: 500,  cats: ['cat-01', 'cat-04'], pos: 4 },
    { id: 'svc-17', name: 'Trim',             color: '#F87171', dur: 20,  price: 2500,  cost: 50,   cats: ['cat-01'], pos: 5 },
    // Color
    { id: 'svc-05', name: 'Full Color',       color: '#8B5CF6', dur: 90,  price: 12000, cost: 1200, cats: ['cat-03'], pos: 1 },
    { id: 'svc-06', name: 'Highlights',       color: '#F59E0B', dur: 120, price: 15000, cost: 1500, cats: ['cat-03'], pos: 2 },
    { id: 'svc-07', name: 'Balayage',         color: '#6366F1', dur: 150, price: 20000, cost: 2000, cats: ['cat-03'], pos: 3 },
    { id: 'svc-08', name: 'Custom Color',     color: '#FF6B6B', dur: 120, price: 0,     cost: 0,    cats: ['cat-03'], pos: 4, open_price: true },
    // Nails
    { id: 'svc-09', name: 'Manicure',         color: '#06B6D4', dur: 30,  price: 3000,  cost: 100,  cats: ['cat-02'], pos: 1 },
    { id: 'svc-10', name: 'Pedicure',         color: '#14B8A6', dur: 45,  price: 4500,  cost: 200,  cats: ['cat-02'], pos: 2 },
    { id: 'svc-11', name: 'Gel Manicure',     color: '#2DD4BF', dur: 45,  price: 4500,  cost: 350,  cats: ['cat-02'], pos: 3 },
    // Skin
    { id: 'svc-12', name: 'Facial',           color: '#10B981', dur: 60,  price: 8000,  cost: 800,  cats: ['cat-04'], pos: 1, requires_room: true },
    { id: 'svc-13', name: 'Waxing',           color: '#84CC16', dur: 15,  price: 2500,  cost: 100,  cats: ['cat-04'], pos: 2, requires_room: true },
    // Men
    { id: 'svc-14', name: "Men's Haircut",    color: '#3B82F6', dur: 30,  price: 3500,  cost: 100,  cats: ['cat-05'], pos: 1 },
    { id: 'svc-15', name: 'Beard Trim',       color: '#78716C', dur: 15,  price: 2000,  cost: 50,   cats: ['cat-05'], pos: 2 },
  ];

  for (var si = 0; si < services.length; si++) {
    var s = services[si];
    await prisma.serviceCatalog.create({
      data: {
        id: s.id,
        salon_id: salon.id,
        name: s.name,
        calendar_color: s.color,
        default_duration_minutes: s.dur,
        price_cents: s.price,
        product_cost_cents: s.cost,
        open_price: s.open_price || false,
        requires_room: s.requires_room || false,
        active: true,
        online_booking_enabled: true,
        position: s.pos,
      }
    });

    // Create category junction links
    for (var catIdx = 0; catIdx < s.cats.length; catIdx++) {
      await prisma.serviceCatalogCategory.create({
        data: {
          service_catalog_id: s.id,
          category_id: s.cats[catIdx],
          position: catIdx,
        }
      });
    }
  }
  console.log('  Created ' + services.length + ' services');

  // ════════════════════════════════════════════
  // SERVICE-STAFF ASSIGNMENTS (matches mock data assigned_service_ids)
  // ════════════════════════════════════════════
  // Staff with empty assigned_service_ids (Maria, Ashley, Sarah, Alex) can do ALL services.
  // Staff with specific assignments are limited to those services only.
  var serviceStaffAssignments = [
    // James (staff-03): Men's Haircut + Beard Trim only
    { staff_id: 'staff-03', service_catalog_id: 'svc-14' },
    { staff_id: 'staff-03', service_catalog_id: 'svc-15' },
    // Nicole (staff-04): Manicure, Pedicure, Gel Manicure only
    { staff_id: 'staff-04', service_catalog_id: 'svc-09' },
    { staff_id: 'staff-04', service_catalog_id: 'svc-10' },
    { staff_id: 'staff-04', service_catalog_id: 'svc-11' },
    // David (staff-05): Facial + Waxing only
    { staff_id: 'staff-05', service_catalog_id: 'svc-12' },
    { staff_id: 'staff-05', service_catalog_id: 'svc-13' },
  ];
  for (var ssai = 0; ssai < serviceStaffAssignments.length; ssai++) {
    await prisma.serviceStaffAssignment.create({
      data: serviceStaffAssignments[ssai]
    });
  }
  console.log('  Created ' + serviceStaffAssignments.length + ' service-staff assignments');

  // ════════════════════════════════════════════
  // CLIENTS
  // ════════════════════════════════════════════
  var clients = [
    { id: 'cli-01', first: 'Sarah',  last: 'Mitchell',  phone: '(561) 555-0101', email: 'sarah.m@email.com' },
    { id: 'cli-02', first: 'James',  last: 'Rodriguez', phone: '(561) 555-0102', email: 'james.r@email.com' },
    { id: 'cli-03', first: 'Lisa',   last: 'Thompson',  phone: '(561) 555-0103', email: 'lisa.t@email.com', balance: 3500 },
    { id: 'cli-04', first: 'Amy',    last: 'Kim',       phone: '(561) 555-0104' },
    { id: 'cli-05', first: 'Rachel', last: 'Parker',    phone: '(561) 555-0105', email: 'rachel.p@email.com', promo_opt_out: true },
    { id: 'cli-06', first: 'Maria',  last: 'Vasquez',   phone: '(561) 555-0106', balance: 5500 },
    { id: 'cli-07', first: 'Dan',    last: 'Brooks',    phone: '(561) 555-0107', email: 'dan.b@email.com', promo_opt_out: true },
    { id: 'cli-08', first: 'Nina',   last: 'Lee',       phone: '(561) 555-0108', email: 'nina.l@email.com' },
    { id: 'cli-09', first: 'Kate',   last: 'Jensen',    phone: '(561) 555-0109' },
    { id: 'cli-10', first: 'Tina',   last: 'Washington',phone: '(561) 555-0110', email: 'tina.w@email.com' },
    { id: 'cli-11', first: 'Robert', last: 'Chen',      phone: '(561) 555-0111' },
    { id: 'cli-12', first: 'Emma',   last: 'Davis',     phone: '(561) 555-0112', email: 'emma.d@email.com' },
  ];

  for (var cIdx = 0; cIdx < clients.length; cIdx++) {
    var cl = clients[cIdx];
    await prisma.client.create({
      data: {
        id: cl.id,
        salon_id: salon.id,
        first_name: cl.first,
        last_name: cl.last,
        phone: cl.phone || null,
        phone_digits: cl.phone ? cl.phone.replace(/\D/g, '') : null,
        email: cl.email || null,
        outstanding_balance_cents: cl.balance || 0,
        promo_opt_out: cl.promo_opt_out || false,
      }
    });
  }
  console.log('  Created ' + clients.length + ' clients');

  // ════════════════════════════════════════════
  // SALON SETTINGS (matches MOCK_SALON_SETTINGS)
  // ════════════════════════════════════════════
  await prisma.salonSettings.create({
    data: {
      salon_id: salon.id,
      settings: {
        salon_name: 'Luxe Hair Studio',
        salon_phone: '(561) 555-0100',
        salon_email: 'info@luxehairstudio.com',
        salon_address: '123 Royal Palm Way, Palm Beach Gardens, FL 33410',
        salon_address_line1: '123 Royal Palm Way',
        salon_address_line2: 'Palm Beach Gardens, FL 33410',
        use_confirmation: true,
        wait_display_mode: 'actual',
        booking_increment_minutes: 15,
        rotation_mode: 'round_robin',
        turn_counting_mode: 'simple',
        turn_price_minimum_cents: 2000,
        tax_rate_percent: 7,
        tax_rate_percentage: 7.5,
        tip_presets: '18,20,25',
        tip_presets_array: [18, 20, 25],
        tip_distribution_mode: 'proportional',
        commission_enabled: true,
        discount_reduces_commission: false,
        advanced_commission_enabled: false,
        retail_commission_pct: 10,
        retail_commission_enabled: false,
        deposit_enabled: true,
        deposit_trigger: 'above_threshold',
        deposit_threshold_cents: 5000,
        deposit_amount_type: 'percentage',
        deposit_percentage: 25,
        online_booking_enabled: true,
        gift_card_enabled: true,
        loyalty_enabled: true,
        membership_enabled: true,
        inventory_enabled: true,
        messaging_enabled: true,
        pay_period: 'biweekly',
        numpad_mode: 'cash_register',
        clearance_required: {
          create_edit_appointments: false,
          delete_cancel_appointments: true,
          move_appointments: false,
          process_checkout: false,
          process_cash_payments: true,
          apply_discounts: true,
          void_ticket: true,
          process_refunds: true,
          salon_settings: true,
          staff_management: true,
          service_catalog: true,
          payroll: true,
          reports: true,
        },
      }
    }
  });
  console.log('  Created salon settings');

  // ════════════════════════════════════════════
  // TODAY'S APPOINTMENTS + SERVICE LINES
  // ════════════════════════════════════════════
  var today = new Date();
  var y = today.getFullYear();
  var m = today.getMonth();
  var d = today.getDate();

  function t(hour, min) {
    return new Date(y, m, d, hour, min || 0);
  }

  var appointments = [
    { id: 'apt-01', client_id: 'cli-01', client_name: 'Sarah M.',  status: 'confirmed',   lines: [{ svc: 'svc-01', staff: 'staff-01', time: t(9,0),   dur: 45,  color: '#EF4444', name: "Women's Haircut" }] },
    { id: 'apt-02', client_id: 'cli-03', client_name: 'Lisa T.',   status: 'confirmed',   lines: [{ svc: 'svc-05', staff: 'staff-01', time: t(10,0),  dur: 90,  color: '#8B5CF6', name: 'Full Color' }] },
    { id: 'apt-03', client_id: 'cli-06', client_name: 'Maria V.',  status: 'pending',     lines: [{ svc: 'svc-02', staff: 'staff-01', time: t(13,0),  dur: 30,  color: '#EC4899', name: 'Blowout' }] },
    { id: 'apt-04', client_id: 'cli-12', client_name: 'Emma D.',   status: 'confirmed',   lines: [{ svc: 'svc-01', staff: 'staff-01', time: t(14,0),  dur: 45,  color: '#EF4444', name: "Women's Haircut" }] },
    { id: 'apt-05', client_id: 'cli-02', client_name: 'James R.',  status: 'in_progress', lines: [{ svc: 'svc-06', staff: 'staff-02', time: t(9,0),   dur: 120, color: '#F59E0B', name: 'Highlights' }] },
    { id: 'apt-06', client_id: 'cli-09', client_name: 'Kate J.',   status: 'confirmed',   lines: [{ svc: 'svc-03', staff: 'staff-02', time: t(12,0),  dur: 60,  color: '#D946EF', name: 'Updo' }] },
    { id: 'apt-07', client_id: 'cli-08', client_name: 'Nina L.',   status: 'pending',     lines: [{ svc: 'svc-07', staff: 'staff-02', time: t(14,0),  dur: 150, color: '#6366F1', name: 'Balayage' }] },
    { id: 'apt-08', client_id: 'cli-07', client_name: 'Dan B.',    status: 'completed',   lines: [{ svc: 'svc-14', staff: 'staff-03', time: t(9,0),   dur: 30,  color: '#3B82F6', name: "Men's Haircut" }] },
    { id: 'apt-09', client_id: 'cli-11', client_name: 'Robert C.', status: 'confirmed',   lines: [{ svc: 'svc-15', staff: 'staff-03', time: t(9,45),  dur: 15,  color: '#78716C', name: 'Beard Trim' }] },
    { id: 'apt-10', client_id: 'cli-07', client_name: 'Dan B.',    status: 'confirmed',   lines: [{ svc: 'svc-14', staff: 'staff-03', time: t(10,30), dur: 30,  color: '#3B82F6', name: "Men's Haircut" }] },
    { id: 'apt-11', client_id: 'cli-10', client_name: 'Tina W.',   status: 'pending',     lines: [{ svc: 'svc-04', staff: 'staff-03', time: t(13,0),  dur: 30,  color: '#F97316', name: 'Deep Conditioning' }] },
    { id: 'apt-12', client_id: 'cli-04', client_name: 'Amy K.',    status: 'confirmed',   lines: [{ svc: 'svc-09', staff: 'staff-04', time: t(9,0),   dur: 30,  color: '#06B6D4', name: 'Manicure' }] },
    { id: 'apt-13', client_id: 'cli-05', client_name: 'Rachel P.', status: 'in_progress', lines: [{ svc: 'svc-10', staff: 'staff-04', time: t(9,45),  dur: 45,  color: '#14B8A6', name: 'Pedicure' }] },
    { id: 'apt-14', client_id: 'cli-03', client_name: 'Lisa T.',   status: 'confirmed',   lines: [{ svc: 'svc-11', staff: 'staff-04', time: t(11,0),  dur: 45,  color: '#2DD4BF', name: 'Gel Manicure' }] },
    { id: 'apt-15', client_id: 'cli-12', client_name: 'Emma D.',   status: 'pending',     lines: [{ svc: 'svc-09', staff: 'staff-04', time: t(13,0),  dur: 30,  color: '#06B6D4', name: 'Manicure' }] },
    { id: 'apt-16', client_id: 'cli-05', client_name: 'Rachel P.', status: 'confirmed',   lines: [{ svc: 'svc-12', staff: 'staff-05', time: t(9,0),   dur: 60,  color: '#10B981', name: 'Facial' }] },
    { id: 'apt-17', client_id: 'cli-10', client_name: 'Tina W.',   status: 'confirmed',   lines: [{ svc: 'svc-13', staff: 'staff-05', time: t(10,30), dur: 15,  color: '#84CC16', name: 'Waxing' }] },
    { id: 'apt-18', client_id: 'cli-09', client_name: 'Kate J.',   status: 'pending',     lines: [{ svc: 'svc-12', staff: 'staff-05', time: t(11,0),  dur: 60,  color: '#10B981', name: 'Facial' }] },
  ];

  for (var ai = 0; ai < appointments.length; ai++) {
    var apt = appointments[ai];
    await prisma.appointment.create({
      data: {
        id: apt.id,
        salon_id: salon.id,
        client_id: apt.client_id,
        client_name: apt.client_name,
        status: apt.status,
        source: 'staff',
        service_lines: {
          create: apt.lines.map(function(ln, idx) {
            return {
              id: 'sl-' + String(ai * 10 + idx + 1).padStart(2, '0'),
              service_catalog_id: ln.svc,
              staff_id: ln.staff,
              starts_at: ln.time,
              duration_minutes: ln.dur,
              calendar_color: ln.color,
              status: apt.status,
              client_name: apt.client_name,
              service_name: ln.name,
              price_cents: services.find(function(s) { return s.id === ln.svc; })?.price || 0,
              position: idx,
            };
          })
        }
      }
    });
  }
  console.log('  Created ' + appointments.length + ' appointments with service lines');

  // ════════════════════════════════════════════
  // (Commission rules created later with tiers — see below)

  // ════════════════════════════════════════════
  // TICKETS (sample checkout data for today)
  // ════════════════════════════════════════════
  var now = new Date();

  // 3 open tickets (waiting for payment)
  var openTickets = [
    {
      id: 'ticket-01',
      ticket_number: 1,
      client_id: 'client-11',
      client_name: 'Sarah Mitchell',
      status: 'open',
      deposit_cents: 0,
      items: [
        { type: 'service', name: "Women's Haircut", price_cents: 5500, original_price_cents: 5500, tech_id: 'staff-01', tech_name: 'Maria', color: '#EF4444' },
        { type: 'service', name: 'Deep Conditioning', price_cents: 4000, original_price_cents: 4000, tech_id: 'staff-01', tech_name: 'Maria', color: '#F97316' },
      ],
    },
    {
      id: 'ticket-02',
      ticket_number: 2,
      client_id: 'client-03',
      client_name: 'Emma Davis',
      status: 'open',
      deposit_cents: 2500,
      items: [
        { type: 'service', name: 'Highlights', price_cents: 15000, original_price_cents: 15000, tech_id: 'staff-02', tech_name: 'Ashley', color: '#F59E0B' },
      ],
    },
    {
      id: 'ticket-03',
      ticket_number: 3,
      client_id: 'client-02',
      client_name: 'Dan Brooks',
      status: 'open',
      deposit_cents: 0,
      items: [
        { type: 'service', name: "Men's Haircut", price_cents: 3500, original_price_cents: 3500, tech_id: 'staff-03', tech_name: 'James', color: '#3B82F6' },
      ],
    },
  ];

  // 2 closed tickets (already paid today)
  var closedTickets = [
    {
      id: 'ticket-04',
      ticket_number: 4,
      client_id: 'client-01',
      client_name: 'Jessica Smith',
      status: 'paid',
      subtotal_cents: 8500,
      tax_cents: 638,
      discount_cents: 0,
      tip_cents: 1500,
      surcharge_cents: 0,
      deposit_cents: 0,
      total_cents: 10638,
      payment_method: 'credit',
      cashier_id: 'staff-06',
      cashier_name: 'Sarah',
      tip_distributions: [{ staff_id: 'staff-04', staff_name: 'Nicole', amount_cents: 1500 }],
      items: [
        { type: 'service', name: 'Gel Manicure', price_cents: 4500, original_price_cents: 4500, tech_id: 'staff-04', tech_name: 'Nicole', color: '#8B5CF6' },
        { type: 'service', name: 'Classic Pedicure', price_cents: 4000, original_price_cents: 4000, tech_id: 'staff-04', tech_name: 'Nicole', color: '#06B6D4' },
      ],
      payments: [
        { method: 'credit', amount_cents: 10638 },
      ],
    },
    {
      id: 'ticket-05',
      ticket_number: 5,
      client_id: 'client-05',
      client_name: 'Lisa Park',
      status: 'paid',
      subtotal_cents: 12000,
      tax_cents: 900,
      discount_cents: 0,
      tip_cents: 2000,
      surcharge_cents: 0,
      deposit_cents: 0,
      total_cents: 14900,
      payment_method: 'cash',
      cashier_id: 'staff-06',
      cashier_name: 'Sarah',
      tip_distributions: [{ staff_id: 'staff-05', staff_name: 'David', amount_cents: 2000 }],
      items: [
        { type: 'service', name: 'Color Retouch', price_cents: 9500, original_price_cents: 9500, tech_id: 'staff-05', tech_name: 'David', color: '#EC4899' },
        { type: 'product', name: 'Color Protect Shampoo', price_cents: 2500, original_price_cents: 2500, tech_id: null, tech_name: null, color: null },
      ],
      payments: [
        { method: 'cash', amount_cents: 14900 },
      ],
    },
  ];

  // Create open tickets
  for (var oti = 0; oti < openTickets.length; oti++) {
    var ot = openTickets[oti];
    await prisma.ticket.create({
      data: {
        id: ot.id,
        salon_id: salon.id,
        ticket_number: ot.ticket_number,
        client_id: ot.client_id,
        client_name: ot.client_name,
        status: ot.status,
        deposit_cents: ot.deposit_cents,
        created_at: new Date(now.getTime() - (openTickets.length - oti) * 600000),
        items: {
          create: ot.items.map(function(item) {
            return {
              type: item.type,
              name: item.name,
              price_cents: item.price_cents,
              original_price_cents: item.original_price_cents,
              tech_id: item.tech_id,
              tech_name: item.tech_name,
              color: item.color,
            };
          }),
        },
      },
    });
  }
  console.log('  Created ' + openTickets.length + ' open tickets');

  // Create closed tickets
  for (var cti = 0; cti < closedTickets.length; cti++) {
    var ct = closedTickets[cti];
    await prisma.ticket.create({
      data: {
        id: ct.id,
        salon_id: salon.id,
        ticket_number: ct.ticket_number,
        client_id: ct.client_id,
        client_name: ct.client_name,
        status: ct.status,
        subtotal_cents: ct.subtotal_cents,
        tax_cents: ct.tax_cents,
        discount_cents: ct.discount_cents,
        tip_cents: ct.tip_cents,
        surcharge_cents: ct.surcharge_cents,
        deposit_cents: ct.deposit_cents,
        total_cents: ct.total_cents,
        payment_method: ct.payment_method,
        cashier_id: ct.cashier_id,
        cashier_name: ct.cashier_name,
        tip_distributions: ct.tip_distributions,
        created_at: new Date(now.getTime() - (closedTickets.length - cti + openTickets.length) * 600000),
        items: {
          create: ct.items.map(function(item) {
            return {
              type: item.type,
              name: item.name,
              price_cents: item.price_cents,
              original_price_cents: item.original_price_cents,
              tech_id: item.tech_id,
              tech_name: item.tech_name,
              color: item.color,
            };
          }),
        },
        payments: {
          create: ct.payments.map(function(p) {
            return {
              method: p.method,
              amount_cents: p.amount_cents,
            };
          }),
        },
      },
    });
  }
  console.log('  Created ' + closedTickets.length + ' closed tickets');

  // ════════════════════════════════════════════
  // GIFT CARDS (sample cards matching frontend mock data)
  // ════════════════════════════════════════════
  var gcData = [
    { id: 'gc-01', code: 'GC-A7X2-9K4M', type: 'digital', initial: 10000, balance: 5000, client_id: 'client-11', client_name: 'Sarah Mitchell', buyer_id: 'client-03', buyer_name: 'Emma Davis',
      txns: [
        { type: 'purchase', amount: 10000, after: 10000, staff: 'Maria', date: '2026-03-10T10:00:00Z' },
        { type: 'redemption', amount: -3000, after: 7000, staff: 'Ashley', date: '2026-03-15T14:30:00Z' },
        { type: 'redemption', amount: -2000, after: 5000, staff: 'Maria', date: '2026-03-18T11:15:00Z' },
      ]},
    { id: 'gc-02', code: 'GC-B3Y5-7L2N', type: 'physical', initial: 5000, balance: 5000, client_id: null, client_name: null, buyer_id: null, buyer_name: null,
      txns: [
        { type: 'purchase', amount: 5000, after: 5000, staff: 'Sarah', date: '2026-03-05T14:00:00Z' },
      ]},
    { id: 'gc-03', code: 'GC-C8Z1-4M6P', type: 'digital', initial: 7500, balance: 0, client_id: 'client-03', client_name: 'Emma Davis', buyer_id: 'client-08', buyer_name: 'Nina Lee',
      txns: [
        { type: 'purchase', amount: 7500, after: 7500, staff: 'Online', date: '2026-02-14T09:30:00Z' },
        { type: 'redemption', amount: -7500, after: 0, staff: 'Nicole', date: '2026-02-28T15:45:00Z' },
      ]},
    { id: 'gc-04', code: 'GC-D2W8-5N3Q', type: 'digital', initial: 2500, balance: 2500, client_id: 'client-04', client_name: 'Amy Kim', buyer_id: 'client-04', buyer_name: 'Amy Kim',
      txns: [
        { type: 'purchase', amount: 2500, after: 2500, staff: 'Maria', date: '2026-03-20T11:00:00Z' },
      ]},
    { id: 'gc-05', code: 'GC-E6V4-8R1S', type: 'physical', initial: 10000, balance: 3500, client_id: 'client-02', client_name: 'Dan Brooks', buyer_id: null, buyer_name: null,
      txns: [
        { type: 'purchase', amount: 10000, after: 10000, staff: 'Sarah', date: '2026-02-28T16:00:00Z' },
        { type: 'redemption', amount: -4500, after: 5500, staff: 'Ashley', date: '2026-03-08T10:30:00Z' },
        { type: 'redemption', amount: -2000, after: 3500, staff: 'James', date: '2026-03-19T13:00:00Z' },
      ]},
  ];

  for (var gci = 0; gci < gcData.length; gci++) {
    var gc = gcData[gci];
    await prisma.giftCard.create({
      data: {
        id: gc.id,
        salon_id: salon.id,
        code: gc.code,
        type: gc.type,
        initial_amount_cents: gc.initial,
        balance_cents: gc.balance,
        status: gc.balance <= 0 ? 'depleted' : 'active',
        client_id: gc.client_id,
        client_name: gc.client_name,
        purchased_by_client_id: gc.buyer_id,
        purchased_by_name: gc.buyer_name,
        transactions: {
          create: gc.txns.map(function(t) {
            return {
              type: t.type,
              amount_cents: t.amount,
              balance_after_cents: t.after,
              staff_name: t.staff,
              created_at: new Date(t.date),
            };
          }),
        },
      },
    });
  }
  console.log('  Created ' + gcData.length + ' gift cards with transactions');

  // ════════════════════════════════════════════
  // PRODUCT CATEGORIES & PRODUCTS (Inventory)
  // ════════════════════════════════════════════
  var productCats = [
    { id: 'pcat-01', name: 'Hair Care',   position: 1 },
    { id: 'pcat-02', name: 'Styling',     position: 2 },
    { id: 'pcat-03', name: 'Nails',       position: 3 },
    { id: 'pcat-04', name: 'Skin Care',   position: 4 },
    { id: 'pcat-05', name: 'Tools',       position: 5 },
  ];
  for (var pci = 0; pci < productCats.length; pci++) {
    await prisma.productCategory.create({
      data: { id: productCats[pci].id, salon_id: salon.id, name: productCats[pci].name, position: productCats[pci].position }
    });
  }
  console.log('  Created ' + productCats.length + ' product categories');

  var suppliers = [
    { id: 'sup-01', name: 'Beauty Supply Co',  contact: 'John Davis',  phone: '(561) 555-9000', email: 'orders@beautysupply.com' },
    { id: 'sup-02', name: 'Olaplex Direct',    contact: 'Sarah K.',    phone: '(800) 555-0150', email: 'wholesale@olaplex.com' },
    { id: 'sup-03', name: 'Nail Essentials',   contact: 'Amy Chen',    phone: '(561) 555-8200', email: 'sales@nailessentials.com' },
  ];
  for (var si = 0; si < suppliers.length; si++) {
    await prisma.supplier.create({
      data: { id: suppliers[si].id, salon_id: salon.id, name: suppliers[si].name, contact: suppliers[si].contact, phone: suppliers[si].phone, email: suppliers[si].email }
    });
  }
  console.log('  Created ' + suppliers.length + ' suppliers');

  var products = [
    { id: 'prod-01', name: 'Olaplex No. 3',          category_id: 'pcat-01', supplier_id: 'sup-02', price_cents: 2800, cost_cents: 1400, stock_qty: 12, low_stock_qty: 4,  sku: '850018802147', position: 1 },
    { id: 'prod-02', name: 'Moroccan Oil Treatment',  category_id: 'pcat-01', supplier_id: 'sup-01', price_cents: 4400, cost_cents: 2200, stock_qty: 8,  low_stock_qty: 3,  sku: '7290011521011', position: 2 },
    { id: 'prod-03', name: 'Redken Shampoo 10oz',     category_id: 'pcat-01', supplier_id: 'sup-01', price_cents: 2200, cost_cents: 1100, stock_qty: 15, low_stock_qty: 5,  sku: '884486453440', position: 3 },
    { id: 'prod-04', name: 'Got2b Glued Spray',       category_id: 'pcat-02', supplier_id: 'sup-01', price_cents: 1200, cost_cents: 500,  stock_qty: 20, low_stock_qty: 6,  sku: '052336902008', position: 1 },
    { id: 'prod-05', name: 'Kenra Volume Spray 25',   category_id: 'pcat-02', supplier_id: 'sup-01', price_cents: 1900, cost_cents: 900,  stock_qty: 9,  low_stock_qty: 3,  sku: '014926166252', position: 2 },
    { id: 'prod-06', name: 'OPI Nail Polish',         category_id: 'pcat-03', supplier_id: 'sup-03', price_cents: 1100, cost_cents: 450,  stock_qty: 30, low_stock_qty: 8,  sku: '094100007120', position: 1 },
    { id: 'prod-07', name: 'Cuticle Oil Pen',         category_id: 'pcat-03', supplier_id: 'sup-03', price_cents: 800,  cost_cents: 300,  stock_qty: 18, low_stock_qty: 5,  position: 2 },
    { id: 'prod-08', name: 'Daily Moisturizer SPF30', category_id: 'pcat-04', supplier_id: 'sup-01', price_cents: 3200, cost_cents: 1600, stock_qty: 7,  low_stock_qty: 3,  position: 1 },
    { id: 'prod-09', name: 'Wide Tooth Comb',         category_id: 'pcat-05', supplier_id: 'sup-01', price_cents: 800,  cost_cents: 200,  stock_qty: 25, low_stock_qty: 8,  position: 1 },
    { id: 'prod-10', name: 'Round Brush Medium',      category_id: 'pcat-05', supplier_id: 'sup-01', price_cents: 1600, cost_cents: 600,  stock_qty: 10, low_stock_qty: 3,  position: 2 },
  ];
  for (var pi = 0; pi < products.length; pi++) {
    var pr = products[pi];
    await prisma.product.create({
      data: { id: pr.id, salon_id: salon.id, category_id: pr.category_id, name: pr.name, sku: pr.sku || null, price_cents: pr.price_cents, cost_cents: pr.cost_cents, stock_qty: pr.stock_qty, low_stock_qty: pr.low_stock_qty, supplier_id: pr.supplier_id, position: pr.position }
    });
  }
  console.log('  Created ' + products.length + ' products');

  // ════════════════════════════════════════════
  // COMMISSION RULES & TIERS
  // ════════════════════════════════════════════
  var commRules = [
    { staff_id: null, applies_to: 'service', scope: 'flat',     percentage: 50 },
    { staff_id: null, applies_to: 'service', scope: 'category', category_id: 'cat-03', percentage: 40 },
    { staff_id: null, applies_to: 'service', scope: 'item',     service_catalog_id: 'svc-07', percentage: 35 },
    { staff_id: null, applies_to: 'retail',  scope: 'flat',     percentage: 10 },
    { staff_id: 'staff-01', applies_to: 'service', scope: 'flat', percentage: 60 },
  ];
  for (var cri = 0; cri < commRules.length; cri++) {
    var cr = commRules[cri];
    await prisma.commissionRule.create({
      data: { salon_id: salon.id, staff_id: cr.staff_id, applies_to: cr.applies_to, scope: cr.scope, category_id: cr.category_id || null, service_catalog_id: cr.service_catalog_id || null, percentage: cr.percentage }
    });
  }
  console.log('  Created ' + commRules.length + ' commission rules');

  var commTiers = [
    { staff_id: null, min_revenue_cents: 0,      percentage: 40, position: 1 },
    { staff_id: null, min_revenue_cents: 300000,  percentage: 45, position: 2 },
    { staff_id: null, min_revenue_cents: 500000,  percentage: 50, position: 3 },
  ];
  for (var cti = 0; cti < commTiers.length; cti++) {
    var ct = commTiers[cti];
    await prisma.commissionTier.create({
      data: { salon_id: salon.id, staff_id: ct.staff_id, min_revenue_cents: ct.min_revenue_cents, percentage: ct.percentage, position: ct.position }
    });
  }
  console.log('  Created ' + commTiers.length + ' commission tiers');

  // ════════════════════════════════════════════
  // MESSAGE TEMPLATES
  // ════════════════════════════════════════════
  var templates = [
    { type: 'booking_confirm', channel: 'sms', body: 'Hi {client_name}, your appointment at {salon_name} is confirmed for {date} at {time}. See you soon!' },
    { type: 'reminder',        channel: 'sms', body: 'Reminder: Your appointment at {salon_name} is tomorrow at {time}. Reply C to cancel.' },
    { type: 'cancel',          channel: 'sms', body: 'Hi {client_name}, your appointment at {salon_name} on {date} has been cancelled. Call us to reschedule.' },
    { type: 'noshow',          channel: 'sms', body: 'We missed you today at {salon_name}! Please call us at {salon_phone} to reschedule your appointment.' },
    { type: 'receipt',         channel: 'email', subject: 'Receipt from {salon_name}', body: 'Thank you for visiting {salon_name}! Your total was {total}. See you next time!' },
    { type: 'promo',           channel: 'sms', body: 'Special offer from {salon_name}! {promo_details}. Book now: {booking_link}' },
  ];
  for (var ti = 0; ti < templates.length; ti++) {
    await prisma.messageTemplate.create({
      data: { salon_id: salon.id, type: templates[ti].type, channel: templates[ti].channel, subject: templates[ti].subject || null, body: templates[ti].body }
    });
  }
  console.log('  Created ' + templates.length + ' message templates');

  // ════════════════════════════════════════════
  // PROVIDER OWNER
  // ════════════════════════════════════════════
  var providerOwner = await prisma.providerOwner.create({
    data: {
      id: 'provider-owner-1',
      name: 'Andy Tran',
      email: 'andy@prosalonpos.com',
      pin_hash: hashPin('0000'),
    }
  });
  console.log('  Created provider owner: ' + providerOwner.name);

  // ════════════════════════════════════════════
  // PROVIDER AGENTS
  // ════════════════════════════════════════════
  var agent1 = await prisma.providerAgent.create({
    data: {
      id: 'agent-1',
      name: 'Jessica Rivera',
      email: 'jessica@prosalonpos.com',
      pin_hash: hashPin('1234'),
      role: 'sales',
      visibility: 'assigned',
    }
  });
  var agent2 = await prisma.providerAgent.create({
    data: {
      id: 'agent-2',
      name: 'Marcus Chen',
      email: 'marcus@prosalonpos.com',
      pin_hash: hashPin('5678'),
      role: 'support',
      visibility: 'all',
    }
  });
  console.log('  Created 2 provider agents');

  // ════════════════════════════════════════════
  // UPDATE SALON WITH PROVIDER FIELDS
  // ════════════════════════════════════════════
  await prisma.salon.update({
    where: { id: salon.id },
    data: {
      owner_name: 'Alex Tran',
      owner_phone: '(561) 555-0100',
      owner_email: 'alex@luxehairstudio.com',
      status: 'active',
      plan_tier: 'professional',
      station_count: 3,
      license_key: 'LUXE-PRO-2025-A1B2',
      processing_rate: 2.29,
      monthly_software_fee_cents: 14900,
      signup_date: new Date('2025-06-15'),
      assigned_agent_id: 'agent-1',
      features_enabled: ['appointments', 'client_profiles', 'loyalty', 'membership', 'gift_cards', 'online_booking', 'text_messaging', 'payroll', 'inventory', 'tech_turn'],
    }
  });

  // Create additional salons for provider to manage
  var salon2 = await prisma.salon.create({
    data: {
      id: 'salon-02',
      salon_code: 'BELLA',
      name: 'Bella Hair Studio',
      phone: '(561) 555-2002',
      address1: '456 Northlake Blvd',
      address2: 'North Palm Beach, FL 33408',
      owner_name: 'Maria Santos',
      owner_phone: '(561) 555-2002',
      owner_email: 'maria@bellahair.com',
      status: 'active',
      plan_tier: 'basic',
      station_count: 2,
      license_key: 'BELL-BAS-2025-C3D4',
      processing_rate: 2.49,
      monthly_software_fee_cents: 7900,
      signup_date: new Date('2025-09-01'),
      features_enabled: ['appointments', 'client_profiles', 'gift_cards', 'tech_turn'],
    }
  });

  var salon3 = await prisma.salon.create({
    data: {
      id: 'salon-03',
      salon_code: 'ZENSPA',
      name: 'Zen Day Spa',
      phone: '(561) 555-3003',
      address1: '789 US Highway 1',
      address2: 'Jupiter, FL 33477',
      owner_name: 'David Park',
      owner_phone: '(561) 555-3003',
      owner_email: 'david@zendayspa.com',
      status: 'trial',
      plan_tier: 'premium',
      station_count: 5,
      license_key: 'ZEN-PRE-2026-E5F6',
      processing_rate: 2.19,
      monthly_software_fee_cents: 24900,
      signup_date: new Date('2026-03-01'),
      trial_end_date: new Date('2026-03-31'),
      assigned_agent_id: 'agent-1',
      features_enabled: ['appointments', 'client_profiles', 'loyalty', 'membership', 'gift_cards', 'online_booking', 'group_booking', 'text_messaging', 'payroll', 'inventory', 'tech_turn', 'deposits', 'commission_tiers', 'advanced_reports', 'barcode_scan'],
    }
  });

  var salon4 = await prisma.salon.create({
    data: {
      id: 'salon-04',
      salon_code: 'CLASSIC',
      name: 'Classic Cuts Barbershop',
      phone: '(561) 555-4004',
      address1: '321 Indiantown Rd',
      address2: 'Jupiter, FL 33458',
      owner_name: 'James Brown',
      owner_phone: '(561) 555-4004',
      owner_email: 'james@classiccuts.com',
      status: 'suspended',
      plan_tier: 'basic',
      station_count: 1,
      license_key: 'CLAS-BAS-2025-G7H8',
      processing_rate: 2.49,
      monthly_software_fee_cents: 7900,
      signup_date: new Date('2025-04-20'),
      features_enabled: ['appointments', 'client_profiles'],
    }
  });
  console.log('  Created 3 additional salons for provider management');

  // ════════════════════════════════════════════
  // PROVIDER BILLING RECORDS
  // ════════════════════════════════════════════
  var billingData = [
    { salon_id: salon.id,  amount_cents: 14900, date: '2026-03-01', status: 'paid', method: 'ACH' },
    { salon_id: salon.id,  amount_cents: 14900, date: '2026-02-01', status: 'paid', method: 'ACH' },
    { salon_id: salon.id,  amount_cents: 14900, date: '2026-01-01', status: 'paid', method: 'ACH' },
    { salon_id: 'salon-02', amount_cents: 7900,  date: '2026-03-01', status: 'paid', method: 'Credit Card' },
    { salon_id: 'salon-02', amount_cents: 7900,  date: '2026-02-01', status: 'paid', method: 'Credit Card' },
    { salon_id: 'salon-03', amount_cents: 0,     date: '2026-03-01', status: 'trial', method: 'N/A' },
    { salon_id: 'salon-04', amount_cents: 7900,  date: '2026-02-01', status: 'overdue', method: 'Credit Card' },
    { salon_id: 'salon-04', amount_cents: 7900,  date: '2026-03-01', status: 'overdue', method: 'Credit Card' },
  ];
  for (var bi = 0; bi < billingData.length; bi++) {
    await prisma.providerBillingRecord.create({ data: billingData[bi] });
  }
  console.log('  Created ' + billingData.length + ' billing records');

  // ════════════════════════════════════════════
  // PROVIDER SALON NOTES
  // ════════════════════════════════════════════
  var noteData = [
    { salon_id: salon.id,   agent_id: 'agent-1',          agent_name: 'Jessica Rivera', content: 'Owner called about commission setup. Walked her through flat rate vs tiered. She wants flat 40% for now.', created_at: new Date('2026-03-27T11:15:00Z') },
    { salon_id: salon.id,   agent_id: 'provider-owner-1', agent_name: 'Andy Tran',      content: 'Enabled payroll module. Owner confirmed she wants check printing too — enabled provider toggle.', created_at: new Date('2026-03-28T14:30:00Z') },
    { salon_id: 'salon-02', agent_id: 'agent-2',          agent_name: 'Marcus Chen',    content: 'Helped owner set up gift cards. She wants to sell $25, $50, $100 denominations. All configured.', created_at: new Date('2026-03-20T13:00:00Z') },
    { salon_id: 'salon-03', agent_id: 'agent-1',          agent_name: 'Jessica Rivera', content: 'New premium trial started. Owner wants full demo of all features. Scheduled training call for next week.', created_at: new Date('2026-03-01T09:30:00Z') },
    { salon_id: 'salon-04', agent_id: 'provider-owner-1', agent_name: 'Andy Tran',      content: 'Owner not responding to calls. 2 months overdue. Suspended account pending payment.', created_at: new Date('2026-03-15T08:00:00Z') },
  ];
  for (var ni = 0; ni < noteData.length; ni++) {
    await prisma.providerSalonNote.create({ data: noteData[ni] });
  }
  console.log('  Created ' + noteData.length + ' salon notes');

  // ════════════════════════════════════════════
  // PROVIDER AUDIT LOG
  // ════════════════════════════════════════════
  var auditData = [
    { actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'feature_toggled', detail: 'Enabled "Payroll" for Luxe Hair Studio',                salon_id: salon.id,   created_at: new Date('2026-03-28T14:30:00Z') },
    { actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'note_added',      detail: 'Added support note for Luxe Hair Studio',               salon_id: salon.id,   created_at: new Date('2026-03-27T11:15:00Z') },
    { actor_id: 'agent-2',          actor_name: 'Marcus Chen',     action: 'feature_toggled', detail: 'Enabled "Online Booking" for Bella Hair Studio',         salon_id: 'salon-02', created_at: new Date('2026-03-26T16:45:00Z') },
    { actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'salon_created',   detail: 'Created salon account: Zen Day Spa (Premium trial)',     salon_id: 'salon-03', created_at: new Date('2026-03-01T09:00:00Z') },
    { actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'salon_created',   detail: 'Created salon account: Luxe Hair Studio',               salon_id: salon.id,   created_at: new Date('2025-06-15T10:30:00Z') },
    { actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'agent_created',   detail: 'Created agent: Jessica Rivera (Sales)',                  salon_id: null,       created_at: new Date('2025-11-15T10:00:00Z') },
    { actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'salon_suspended', detail: 'Suspended Classic Cuts Barbershop — 2 months overdue',   salon_id: 'salon-04', created_at: new Date('2026-03-15T08:00:00Z') },
    { actor_id: 'agent-2',          actor_name: 'Marcus Chen',     action: 'note_added',      detail: 'Added support note for Bella Hair Studio',              salon_id: 'salon-02', created_at: new Date('2026-03-20T13:00:00Z') },
    { actor_id: 'provider-owner-1', actor_name: 'Andy Tran',       action: 'agent_created',   detail: 'Created agent: Marcus Chen (Support)',                   salon_id: null,       created_at: new Date('2026-01-08T14:30:00Z') },
    { actor_id: 'agent-1',          actor_name: 'Jessica Rivera',  action: 'feature_toggled', detail: 'Enabled "Commission Tiers" for Zen Day Spa',            salon_id: 'salon-03', created_at: new Date('2026-03-05T10:00:00Z') },
  ];
  for (var ai = 0; ai < auditData.length; ai++) {
    await prisma.providerAuditLog.create({ data: auditData[ai] });
  }
  console.log('  Created ' + auditData.length + ' audit log entries');

  // ════════════════════════════════════════════
  // SERVICE PACKAGES (templates)
  // ════════════════════════════════════════════
  var packageData = [
    {
      id: 'pkg-01', salon_id: salon.id, location_id: salon.id,
      name: 'Nail Lovers Bundle',
      description: '10 nail services at a great price — mix manicures and pedicures.',
      price_cents: 35000, expiration_enabled: true, expiration_days: 365,
      transferable: false, refundable: true, active: true,
      created_at: new Date('2026-01-15T10:00:00Z'),
    },
    {
      id: 'pkg-02', salon_id: salon.id, location_id: salon.id,
      name: 'Spa Essentials',
      description: '5 facials + 5 waxing sessions — your monthly self-care sorted.',
      price_cents: 45000, expiration_enabled: true, expiration_days: 180,
      transferable: true, refundable: false, active: true,
      created_at: new Date('2026-02-01T10:00:00Z'),
    },
    {
      id: 'pkg-03', salon_id: salon.id, location_id: salon.id,
      name: "Men's Grooming Pack",
      description: "10 men's haircuts + 5 beard trims — look sharp all year.",
      price_cents: 40000, expiration_enabled: false, expiration_days: null,
      transferable: false, refundable: true, active: true,
      created_at: new Date('2026-02-20T10:00:00Z'),
    },
  ];
  for (var pi = 0; pi < packageData.length; pi++) {
    await prisma.servicePackage.create({ data: packageData[pi] });
  }
  console.log('  Created ' + packageData.length + ' service packages');

  // Package items (services inside each template)
  var pkgItemData = [
    { id: 'pki-01', package_id: 'pkg-01', service_id: 'svc-09', service_name: 'Manicure',       quantity: 5 },
    { id: 'pki-02', package_id: 'pkg-01', service_id: 'svc-10', service_name: 'Pedicure',       quantity: 5 },
    { id: 'pki-03', package_id: 'pkg-02', service_id: 'svc-12', service_name: 'Facial',         quantity: 5 },
    { id: 'pki-04', package_id: 'pkg-02', service_id: 'svc-13', service_name: 'Waxing',         quantity: 5 },
    { id: 'pki-05', package_id: 'pkg-03', service_id: 'svc-14', service_name: "Men's Haircut",  quantity: 10 },
    { id: 'pki-06', package_id: 'pkg-03', service_id: 'svc-15', service_name: 'Beard Trim',     quantity: 5 },
  ];
  for (var pii = 0; pii < pkgItemData.length; pii++) {
    await prisma.servicePackageItem.create({ data: pkgItemData[pii] });
  }
  console.log('  Created ' + pkgItemData.length + ' package items');

  // Client packages (purchased by clients)
  var clientPkgData = [
    {
      id: 'cpkg-01', salon_id: salon.id, client_id: 'cli-01', client_name: 'Sarah Mitchell',
      package_id: 'pkg-01', package_name: 'Nail Lovers Bundle',
      price_paid_cents: 35000, purchased_at: new Date('2026-02-10T14:30:00Z'),
      expires_at: new Date('2027-02-10T14:30:00Z'), transferable: false, refundable: true,
      status: 'active', sold_by_staff_id: 'staff-06', sold_by_staff_name: 'Sarah',
    },
    {
      id: 'cpkg-02', salon_id: salon.id, client_id: 'cli-07', client_name: 'Dan Brooks',
      package_id: 'pkg-03', package_name: "Men's Grooming Pack",
      price_paid_cents: 40000, purchased_at: new Date('2026-03-01T11:00:00Z'),
      expires_at: null, transferable: false, refundable: true,
      status: 'active', sold_by_staff_id: 'staff-01', sold_by_staff_name: 'Maria',
    },
  ];
  for (var cpi = 0; cpi < clientPkgData.length; cpi++) {
    await prisma.clientPackage.create({ data: clientPkgData[cpi] });
  }
  console.log('  Created ' + clientPkgData.length + ' client packages');

  // Client package items (remaining counts)
  var clientPkgItemData = [
    { id: 'cpi-01', client_package_id: 'cpkg-01', service_id: 'svc-09', service_name: 'Manicure',      total_quantity: 5, remaining: 3 },
    { id: 'cpi-02', client_package_id: 'cpkg-01', service_id: 'svc-10', service_name: 'Pedicure',      total_quantity: 5, remaining: 4 },
    { id: 'cpi-03', client_package_id: 'cpkg-02', service_id: 'svc-14', service_name: "Men's Haircut", total_quantity: 10, remaining: 8 },
    { id: 'cpi-04', client_package_id: 'cpkg-02', service_id: 'svc-15', service_name: 'Beard Trim',    total_quantity: 5, remaining: 4 },
  ];
  for (var cpii = 0; cpii < clientPkgItemData.length; cpii++) {
    await prisma.clientPackageItem.create({ data: clientPkgItemData[cpii] });
  }
  console.log('  Created ' + clientPkgItemData.length + ' client package items');

  // Package redemptions (history of used services)
  var redemptionData = [
    { id: 'pr-01', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-01', ticket_id: 'tk-301',
      service_redeemed_id: 'svc-09', service_redeemed_name: 'Manicure',
      package_service_id: 'svc-09', package_service_name: 'Manicure',
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-02-20T15:00:00Z'), staff_id: 'staff-04', staff_name: 'Nicole' },
    { id: 'pr-02', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-01', ticket_id: 'tk-312',
      service_redeemed_id: 'svc-09', service_redeemed_name: 'Manicure',
      package_service_id: 'svc-09', package_service_name: 'Manicure',
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-03-05T11:30:00Z'), staff_id: 'staff-04', staff_name: 'Nicole' },
    { id: 'pr-03', client_package_id: 'cpkg-01', client_package_item_id: 'cpi-02', ticket_id: 'tk-318',
      service_redeemed_id: 'svc-11', service_redeemed_name: 'Gel Manicure',
      package_service_id: 'svc-10', package_service_name: 'Pedicure',
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-03-12T14:00:00Z'), staff_id: 'staff-04', staff_name: 'Nicole' },
    { id: 'pr-04', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-03', ticket_id: 'tk-305',
      service_redeemed_id: 'svc-14', service_redeemed_name: "Men's Haircut",
      package_service_id: 'svc-14', package_service_name: "Men's Haircut",
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-03-08T10:00:00Z'), staff_id: 'staff-03', staff_name: 'James' },
    { id: 'pr-05', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-03', ticket_id: 'tk-320',
      service_redeemed_id: 'svc-14', service_redeemed_name: "Men's Haircut",
      package_service_id: 'svc-14', package_service_name: "Men's Haircut",
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-03-20T09:45:00Z'), staff_id: 'staff-03', staff_name: 'James' },
    { id: 'pr-06', client_package_id: 'cpkg-02', client_package_item_id: 'cpi-04', ticket_id: 'tk-305',
      service_redeemed_id: 'svc-15', service_redeemed_name: 'Beard Trim',
      package_service_id: 'svc-15', package_service_name: 'Beard Trim',
      upgrade_difference_cents: 0, redeemed_at: new Date('2026-03-08T10:00:00Z'), staff_id: 'staff-03', staff_name: 'James' },
  ];
  for (var ri = 0; ri < redemptionData.length; ri++) {
    await prisma.packageRedemption.create({ data: redemptionData[ri] });
  }
  console.log('  Created ' + redemptionData.length + ' package redemptions');

  console.log('');
  console.log('Seed complete!');
  console.log('  Salon ID: ' + salon.id);
  console.log('  Owner PIN: 0000');
  console.log('  Manager PIN: 6666');
  console.log('  Tech PINs: 1111 (Maria), 2222 (Ashley), 3333 (James), 4444 (Nicole), 5555 (David)');
}

main()
  .then(function() { return prisma.$disconnect(); })
  .catch(function(e) {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
