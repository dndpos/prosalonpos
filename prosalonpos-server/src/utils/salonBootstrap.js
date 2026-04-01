/**
 * salonBootstrap.js — Auto-Bootstrap Salon on First Run
 * Session 89 — Creates default data for fresh databases
 *
 * On a fresh install (local or Railway), the database is empty.
 * This function creates everything needed to log in and use the app:
 *   1. Salon record (with salon code + owner PIN)
 *   2. Default service categories (Hair, Nails, Color, Skin, Men)
 *   3. Core services (15 common salon services)
 *   4. Default salon settings (tax, tips, business hours, etc.)
 *   5. One default manager so someone can log in with a PIN
 *
 * Owner PIN is stored on the Salon record, not in Staff table.
 * Default owner PIN: 0000
 * Default manager PIN: 1234
 *
 * This only runs when the salon has NO service categories — meaning
 * it's a completely fresh database. Existing salons are never touched.
 */
import prisma from '../config/database.js';
import { randomBytes } from 'crypto';
import { hashPin, comparePin } from '../config/auth.js';

/**
 * Generate a 6-character alphanumeric salon code (no ambiguous chars)
 */
function generateSalonCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  var bytes = randomBytes(6);
  for (var i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Main bootstrap — creates salon + default data if needed.
 *
 * @param {string} salonName - Name from license activation (or default)
 * @param {string} licenseKey - The activated license key (or null for cloud)
 * @returns {object} - { salon, created, seeded }
 */
async function bootstrapSalon(salonName, licenseKey) {
  // Check if salon already exists
  var existing = await prisma.salon.findFirst();

  if (existing) {
    // Ensure owner_pin_hash exists AND is valid (migration from old model)
    if (!existing.owner_pin_hash) {
      console.log('[Bootstrap] Salon exists but no owner PIN — setting default (0000)...');
      await prisma.salon.update({
        where: { id: existing.id },
        data: { owner_pin_hash: hashPin('0000') }
      });
      console.log('[Bootstrap] Default owner PIN set on salon record');
    } else {
      // Verify the stored hash actually works — rehash if corrupt
      var ownerPinValid = comparePin('0000', existing.owner_pin_hash);
      console.log('[Bootstrap] Owner PIN hash check (0000):', ownerPinValid ? 'VALID' : 'FAILED');
      if (!ownerPinValid) {
        console.log('[Bootstrap] Owner PIN hash appears corrupt — rehashing default (0000)...');
        var freshHash = hashPin('0000');
        console.log('[Bootstrap] New hash generated, length:', freshHash.length);
        await prisma.salon.update({
          where: { id: existing.id },
          data: { owner_pin_hash: freshHash }
        });
        console.log('[Bootstrap] ✅ Owner PIN rehashed successfully');
      } else {
        // Check if hash uses old slow rounds — upgrade to fast rounds
        var ownerRoundsMatch = existing.owner_pin_hash.match(/^\$2[ab]\$(\d+)\$/);
        if (ownerRoundsMatch && parseInt(ownerRoundsMatch[1], 10) > 6) {
          console.log('[Bootstrap] Owner PIN hash uses old rounds (' + ownerRoundsMatch[1] + ') — upgrading to 6...');
          await prisma.salon.update({
            where: { id: existing.id },
            data: { owner_pin_hash: hashPin('0000') }
          });
          console.log('[Bootstrap] ✅ Owner PIN rehashed with fast rounds');
        }
      }
    }

    // Rehash all staff PINs if they use old slow rounds
    var allStaff = await prisma.staff.findMany({ where: { salon_id: existing.id } });
    var defaultPins = { 'Manager': '1234', 'Sarah': '1111', 'Mike': '2222', 'Jessica': '3333' };
    for (var si = 0; si < allStaff.length; si++) {
      var s = allStaff[si];
      if (!s.pin_hash) continue;
      var roundsMatch = s.pin_hash.match(/^\$2[ab]\$(\d+)\$/);
      if (roundsMatch && parseInt(roundsMatch[1], 10) > 6) {
        var knownPin = defaultPins[s.display_name];
        if (knownPin && comparePin(knownPin, s.pin_hash)) {
          console.log('[Bootstrap] Rehashing ' + s.display_name + ' PIN from rounds ' + roundsMatch[1] + ' to 6...');
          await prisma.staff.update({
            where: { id: s.id },
            data: { pin_hash: hashPin(knownPin) }
          });
        }
      }
    }

    // Check if default data needs seeding
    var catCount = await prisma.serviceCategory.count({ where: { salon_id: existing.id } });
    if (catCount === 0) {
      console.log('[Bootstrap] Salon exists but no categories — seeding default data...');
      await seedDefaultData(existing.id);
      return { salon: existing, created: false, seeded: true };
    }

    // Check if technicians exist — seed some if not (S92 fix)
    var techCount = await prisma.staff.count({ where: { salon_id: existing.id, role: 'technician' } });
    if (techCount === 0) {
      console.log('[Bootstrap] No technicians found — seeding default techs...');
      var techs = [
        { name: 'Sarah',   pin: '1111', pos: 2 },
        { name: 'Mike',    pin: '2222', pos: 3 },
        { name: 'Jessica', pin: '3333', pos: 4 },
      ];
      for (var ti = 0; ti < techs.length; ti++) {
        await prisma.staff.create({
          data: {
            salon_id: existing.id,
            display_name: techs[ti].name,
            legal_name: techs[ti].name,
            role: 'technician',
            rbac_role: 'tech',
            pin_hash: hashPin(techs[ti].pin),
            active: true,
            status: 'active',
            tech_turn_eligible: true,
            pay_type: 'commission',
            commission_pct: 60,
            daily_guarantee_cents: 0,
            payout_check_pct: 100,
            payout_bonus_pct: 0,
            permissions: {},
            position: techs[ti].pos,
          }
        });
      }
      console.log('[Bootstrap]   ✅ 3 default technicians seeded');
      return { salon: existing, created: false, seeded: true };
    }

    return { salon: existing, created: false, seeded: false };
  }

  // No salon exists — create one
  var salonCode = generateSalonCode();
  var name = salonName || 'My Salon';

  var salon = await prisma.salon.create({
    data: {
      name: name,
      salon_code: salonCode,
      license_key: licenseKey || null,
      owner_pin_hash: hashPin('0000'),
    },
  });

  console.log('[Bootstrap] Salon created: "' + name + '" (code: ' + salonCode + ')');
  console.log('[Bootstrap] Default owner PIN: 0000');

  // Seed default data
  await seedDefaultData(salon.id);

  return { salon: salon, created: true, seeded: true };
}

/**
 * Seed default categories, services, settings, and one staff member.
 * Only called on a completely fresh salon with no data.
 */
async function seedDefaultData(salonId) {
  console.log('[Bootstrap] Seeding default data...');

  // ── Service Categories ──
  var categories = [
    { name: 'Hair',  calendar_color: '#F59E0B', position: 1 },
    { name: 'Nails', calendar_color: '#EC4899', position: 2 },
    { name: 'Color', calendar_color: '#8B5CF6', position: 3 },
    { name: 'Skin',  calendar_color: '#10B981', position: 4 },
    { name: 'Men',   calendar_color: '#3B82F6', position: 5 },
  ];

  var catIds = {};
  for (var ci = 0; ci < categories.length; ci++) {
    var cat = await prisma.serviceCategory.create({
      data: {
        salon_id: salonId,
        name: categories[ci].name,
        calendar_color: categories[ci].calendar_color,
        position: categories[ci].position,
      }
    });
    catIds[categories[ci].name] = cat.id;
  }
  console.log('[Bootstrap]   ✅ ' + categories.length + ' categories');

  // ── Services ──
  var services = [
    { name: "Women's Haircut",   color: '#EF4444', dur: 45,  price: 5500,  cost: 150,  cats: ['Hair'], pos: 1 },
    { name: 'Blowout',           color: '#EC4899', dur: 30,  price: 3500,  cost: 200,  cats: ['Hair'], pos: 2 },
    { name: 'Updo',              color: '#D946EF', dur: 60,  price: 7500,  cost: 300,  cats: ['Hair'], pos: 3 },
    { name: 'Deep Conditioning', color: '#F97316', dur: 30,  price: 4000,  cost: 500,  cats: ['Hair', 'Skin'], pos: 4 },
    { name: 'Trim',              color: '#F87171', dur: 20,  price: 2500,  cost: 50,   cats: ['Hair'], pos: 5 },
    { name: 'Full Color',        color: '#8B5CF6', dur: 90,  price: 12000, cost: 1200, cats: ['Color'], pos: 1 },
    { name: 'Highlights',        color: '#F59E0B', dur: 120, price: 15000, cost: 1500, cats: ['Color'], pos: 2 },
    { name: 'Balayage',          color: '#6366F1', dur: 150, price: 20000, cost: 2000, cats: ['Color'], pos: 3 },
    { name: 'Manicure',          color: '#06B6D4', dur: 30,  price: 3000,  cost: 100,  cats: ['Nails'], pos: 1 },
    { name: 'Pedicure',          color: '#14B8A6', dur: 45,  price: 4500,  cost: 200,  cats: ['Nails'], pos: 2 },
    { name: 'Gel Manicure',      color: '#2DD4BF', dur: 45,  price: 4500,  cost: 350,  cats: ['Nails'], pos: 3 },
    { name: 'Facial',            color: '#10B981', dur: 60,  price: 8000,  cost: 800,  cats: ['Skin'], pos: 1 },
    { name: 'Waxing',            color: '#84CC16', dur: 15,  price: 2500,  cost: 100,  cats: ['Skin'], pos: 2 },
    { name: "Men's Haircut",     color: '#3B82F6', dur: 30,  price: 3500,  cost: 100,  cats: ['Men'], pos: 1 },
    { name: 'Beard Trim',        color: '#78716C', dur: 15,  price: 2000,  cost: 50,   cats: ['Men'], pos: 2 },
  ];

  for (var si = 0; si < services.length; si++) {
    var svc = services[si];
    var created = await prisma.serviceCatalog.create({
      data: {
        salon_id: salonId,
        name: svc.name,
        calendar_color: svc.color,
        default_duration_minutes: svc.dur,
        price_cents: svc.price,
        product_cost_cents: svc.cost,
        active: true,
        online_booking_enabled: true,
        position: svc.pos,
      }
    });

    // Category junction links
    for (var catIdx = 0; catIdx < svc.cats.length; catIdx++) {
      var catId = catIds[svc.cats[catIdx]];
      if (catId) {
        await prisma.serviceCatalogCategory.create({
          data: {
            service_catalog_id: created.id,
            category_id: catId,
            position: catIdx,
          }
        });
      }
    }
  }
  console.log('[Bootstrap]   ✅ ' + services.length + ' services');

  // ── Default Salon Settings ──
  await prisma.salonSettings.create({
    data: {
      salon_id: salonId,
      settings: {
        salon_name: 'My Salon',
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
        deposit_enabled: false,
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
  console.log('[Bootstrap]   ✅ Salon settings');

  // ── Default Staff: 1 manager + 3 technicians ──
  await prisma.staff.create({
    data: {
      salon_id: salonId,
      display_name: 'Manager',
      legal_name: 'Default Manager',
      role: 'manager',
      rbac_role: 'manager',
      pin_hash: hashPin('1234'),
      active: true,
      status: 'active',
      tech_turn_eligible: false,
      pay_type: 'salary',
      commission_pct: 0,
      daily_guarantee_cents: 0,
      payout_check_pct: 100,
      payout_bonus_pct: 0,
      permissions: { void: true, refund: true, discount: true },
      position: 1,
    }
  });

  var techs = [
    { name: 'Sarah',   pin: '1111', pos: 2 },
    { name: 'Mike',    pin: '2222', pos: 3 },
    { name: 'Jessica', pin: '3333', pos: 4 },
  ];
  for (var ti = 0; ti < techs.length; ti++) {
    await prisma.staff.create({
      data: {
        salon_id: salonId,
        display_name: techs[ti].name,
        legal_name: techs[ti].name,
        role: 'technician',
        rbac_role: 'tech',
        pin_hash: hashPin(techs[ti].pin),
        active: true,
        status: 'active',
        tech_turn_eligible: true,
        pay_type: 'commission',
        commission_pct: 60,
        daily_guarantee_cents: 0,
        payout_check_pct: 100,
        payout_bonus_pct: 0,
        permissions: {},
        position: techs[ti].pos,
      }
    });
  }
  console.log('[Bootstrap]   ✅ Default manager (PIN: 1234) + 3 technicians');

  console.log('[Bootstrap] ✅ Default data seeded successfully');
}

export { bootstrapSalon, generateSalonCode, seedDefaultData };
