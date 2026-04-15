/**
 * ProSalonPOS — Provider Salon Routes (split from provider.js in C66)
 * All /salons/* endpoints + notes + audit.
 * Requires providerAuth middleware (mounted by provider.js before this sub-router).
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { hashPin, pinSha256 } from '../config/auth.js';
import { requireOwner } from '../middleware/providerAuth.js';
import { getIO } from '../utils/emit.js';

// SQLite stores JSON as strings
function toDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'object') return JSON.stringify(val);
  return val;
}
function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

// Strip down salon data for provider view (no internal POS data)
function formatProviderSalon(s) {
  return {
    id: s.id,
    salon_code: s.salon_code,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address1: s.address1,
    address2: s.address2,
    owner_name: s.owner_name,
    owner_phone: s.owner_phone,
    owner_email: s.owner_email,
    status: s.status,
    plan_tier: s.plan_tier,
    station_count: s.station_count,
    license_key: s.license_key,
    processing_rate: s.processing_rate,
    monthly_software_fee_cents: s.monthly_software_fee_cents,
    signup_date: s.signup_date,
    trial_end_date: s.trial_end_date,
    features_enabled: fromDb(s.features_enabled),
    setup_locked: s.setup_locked || false,
    login_locked: s.login_locked || false,
    created_at: s.created_at,
  };
}

// ── Audit helper ──
async function addAudit(req, action, detail, salonId) {
  var actorName = 'Unknown';
  try {
    var owner = await prisma.providerOwner.findUnique({ where: { id: req.provider_id } });
    if (owner) actorName = owner.name;
  } catch (e) { /* ignore lookup failure */ }

  await prisma.providerAuditLog.create({
    data: {
      actor_id: req.provider_id,
      actor_name: actorName,
      action: action,
      detail: detail,
      salon_id: salonId || null,
    }
  });
}

var router = Router();

// ════════════════════════════════════════════
// SALONS
// ════════════════════════════════════════════

// ── GET /salons — List salons ──
router.get('/salons', async function(req, res, next) {
  try {
    var salons = await prisma.salon.findMany({
      orderBy: { name: 'asc' }
    });

    // Get active session counts for all salons in one query
    var sessionCounts = await prisma.activeSession.groupBy({
      by: ['salon_id'],
      _count: { id: true }
    });
    var countMap = {};
    sessionCounts.forEach(function(sc) { countMap[sc.salon_id] = sc._count.id; });

    res.json({ salons: salons.map(function(s) {
      var formatted = formatProviderSalon(s);
      formatted.active_sessions = countMap[s.id] || 0;
      return formatted;
    }) });
  } catch (err) { next(err); }
});

// ── GET /salons/:id — Single salon detail ──
router.get('/salons/:id', async function(req, res, next) {
  try {
    var salon = await prisma.salon.findUnique({
      where: { id: req.params.id }
    });
    if (!salon) return res.status(404).json({ error: 'Salon not found' });
    // Get active sessions with detail
    var sessions = await prisma.activeSession.findMany({
      where: { salon_id: salon.id },
      orderBy: { created_at: 'asc' }
    });
    // Look up staff display names for each session
    var staffIds = sessions.map(function(s) { return s.staff_id; }).filter(function(id) { return id && id !== 'owner' && id !== 'provider'; });
    var staffMap = {};
    if (staffIds.length > 0) {
      var staffRecords = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, display_name: true } });
      staffRecords.forEach(function(s) { staffMap[s.id] = s.display_name; });
    }
    var formatted = formatProviderSalon(salon);
    formatted.active_sessions = sessions.length;
    formatted.sessions = sessions.map(function(s) {
      return {
        id: s.id,
        staff_name: s.staff_id === 'owner' ? 'Owner' : s.staff_id === 'provider' ? 'Provider' : (staffMap[s.staff_id] || s.staff_id || 'Unknown'),
        station_label: s.station_label || null,
        connected_at: s.created_at,
        last_heartbeat: s.last_heartbeat,
      };
    });
    res.json({ salon: formatted });
  } catch (err) { next(err); }
});

// ── DELETE /salons/:id/sessions/:sessionId — Kick a station ──
router.delete('/salons/:id/sessions/:sessionId', async function(req, res, next) {
  try {
    var session = await prisma.activeSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session || session.salon_id !== req.params.id) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Force-disconnect via Socket.io if possible
    var io = getIO();
    if (io && session.socket_id) {
      var target = io.sockets.sockets.get(session.socket_id);
      if (target) {
        target.emit('force-logout', { reason: 'Station disconnected by provider' });
        target.disconnect(true);
      }
    }
    await prisma.activeSession.delete({ where: { id: req.params.sessionId } });
    await addAudit(req, 'station_kicked', 'Kicked station session ' + (session.station_label || session.id), req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /salons — Create a new salon ──
// Creates: Salon + SalonSettings + owner Staff record (full onboarding)
router.post('/salons', async function(req, res, next) {
  try {
    var d = req.body;

    // Generate license key
    var prefix = (d.name || 'NEW').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    var tierCode = (d.plan_tier || 'BAS').substring(0, 3).toUpperCase();
    var year = new Date().getFullYear();
    var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    var licenseKey = prefix + '-' + tierCode + '-' + year + '-' + rand;

    // Generate salon code — 6 random alphanumeric chars (unique, easy to share)
    var salonCode = d.salon_code;
    if (!salonCode) {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O, 1/I
      salonCode = '';
      for (var ci = 0; ci < 6; ci++) salonCode += chars[Math.floor(Math.random() * chars.length)];
    }

    // Check salon code uniqueness
    var existing = await prisma.salon.findUnique({ where: { salon_code: salonCode } });
    if (existing) {
      salonCode = '';
      for (var ci2 = 0; ci2 < 6; ci2++) salonCode += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
    }

    // Default features — all new salons get this standard set
    var standardFeatures = [
      'appointments', 'client_profiles', 'tech_turn', 'gift_cards',
      'loyalty', 'membership', 'inventory', 'payroll',
      'barcode_scan', 'provider_pay_services_split', 'provider_print_check'
    ];

    var tier = d.plan_tier || 'basic';
    var features = d.features_enabled || standardFeatures;

    // Monthly fee based on tier
    var feeMap = { basic: 7900, professional: 14900, premium: 24900 };

    // Owner PIN — default to 0000 if not provided
    var ownerPin = d.owner_pin || '0000';
    var ownerPinHash = hashPin(ownerPin);
    var ownerPinSha = pinSha256(ownerPin);

    // Use a transaction to create Salon + SalonSettings + owner Staff atomically
    var result = await prisma.$transaction(async function(tx) {
      var salon = await tx.salon.create({
        data: {
          name: d.name || 'New Salon',
          salon_code: salonCode,
          phone: d.phone || null,
          email: d.email || null,
          address1: d.address1 || d.address || null,
          owner_name: d.owner_name || '',
          owner_phone: d.owner_phone || '',
          owner_email: d.owner_email || '',
          status: d.status || 'trial',
          plan_tier: tier,
          station_count: d.station_count || 1,
          license_key: licenseKey,
          processing_rate: d.processing_rate || 2.49,
          monthly_software_fee_cents: d.monthly_software_fee_cents || feeMap[tier] || 7900,
          signup_date: new Date(),
          trial_end_date: d.status === 'trial' ? new Date(Date.now() + 30 * 86400000) : null,
          features_enabled: toDb(features),
          owner_pin_hash: ownerPinHash,
          owner_pin_sha256: ownerPinSha,
          owner_pin_plain: ownerPin,
        }
      });

      await tx.salonSettings.create({
        data: {
          salon_id: salon.id,
          settings: {
            salon_name: d.name || 'New Salon',
            salon_phone: d.phone || '',
            salon_email: d.email || '',
            salon_address_line1: d.address1 || d.address || '',
            salon_address_line2: d.address2 || '',
            tax_rate_percentage: 0,
            tip_presets_array: [18, 20, 25],
            booking_increment_minutes: 15,
            rotation_mode: 'first_available',
            opening_time: '09:00',
            closing_time: '19:00',
            clearance_required: {
              void_ticket: true, process_refunds: true, view_tickets: true,
              salon_settings: true, staff_management: true, service_catalog: true,
              payroll: true, bill_pay: true, reports: true, inventory: true,
              online_booking_settings: true, packages_management: true,
              delete_cancel_appointments: true, delete_clients: true,
              gift_card_management: true, loyalty_membership: true,
              edit_timesheets: true, view_timesheet_reports: true,
            },
          }
        }
      });

      var ownerDisplayName = d.owner_name || 'Owner';
      await tx.staff.create({
        data: {
          salon_id: salon.id,
          display_name: ownerDisplayName.split(' ')[0],
          role: 'owner',
          rbac_role: 'owner',
          pin_hash: ownerPinHash,
          pin_sha256: ownerPinSha,
          position: 0,
          tech_turn_eligible: false,
          show_on_calendar: false,
        }
      });

      return salon;
    });

    await addAudit(req, 'salon_created', 'Created salon account: ' + result.name + ' (code: ' + salonCode + ')', result.id);

    var formatted = formatProviderSalon(result);
    formatted.owner_pin = ownerPin;
    res.status(201).json({ salon: formatted });
  } catch (err) { next(err); }
});

// ── PUT /salons/:id — Update salon details ──
router.put('/salons/:id', async function(req, res, next) {
  try {
    var existing = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Salon not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'phone', 'email', 'address1', 'address2',
      'owner_name', 'owner_phone', 'owner_email',
      'status', 'plan_tier', 'station_count', 'salon_code',
      'processing_rate', 'monthly_software_fee_cents',
      'trial_end_date', 'features_enabled'];

    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = f === 'features_enabled' ? toDb(d[f]) : d[f];
    });

    updateData.version = { increment: 1 };

    var salon = await prisma.salon.update({
      where: { id: req.params.id },
      data: updateData
    });

    await addAudit(req, 'salon_updated', 'Updated salon details: ' + salon.name, salon.id);

    if (updateData.status === 'suspended') {
      var io = getIO();
      if (io) {
        io.to('salon:' + salon.id).emit('force-logout', { reason: 'This salon account has been suspended.' });
        console.log('[Provider] Force-logout broadcast sent to salon:', salon.name);
      }
      await prisma.activeSession.deleteMany({ where: { salon_id: salon.id } }).catch(function() {});
    }

    res.json({ salon: formatProviderSalon(salon) });
  } catch (err) { next(err); }
});

// ── PUT /salons/:id/features — Toggle features for a salon ──
router.put('/salons/:id/features', async function(req, res, next) {
  try {
    var existing = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Salon not found' });

    var features = req.body.features_enabled;
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features_enabled must be an array' });
    }

    var salon = await prisma.salon.update({
      where: { id: req.params.id },
      data: { features_enabled: toDb(features), version: { increment: 1 } }
    });

    var oldFeats = fromDb(existing.features_enabled) || [];
    var added = features.filter(function(f) { return oldFeats.indexOf(f) < 0; });
    var removed = oldFeats.filter(function(f) { return features.indexOf(f) < 0; });
    if (added.length > 0) await addAudit(req, 'feature_toggled', 'Enabled "' + added.join(', ') + '" for ' + salon.name, salon.id);
    if (removed.length > 0) await addAudit(req, 'feature_toggled', 'Disabled "' + removed.join(', ') + '" for ' + salon.name, salon.id);

    res.json({ salon: formatProviderSalon(salon) });
  } catch (err) { next(err); }
});

// ── PUT /salons/:id/status — Change salon status ──
router.put('/salons/:id/status', async function(req, res, next) {
  try {
    var existing = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Salon not found' });

    var newStatus = req.body.status;
    if (!['active', 'trial', 'suspended'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    var salon = await prisma.salon.update({
      where: { id: req.params.id },
      data: { status: newStatus, version: { increment: 1 } }
    });

    await addAudit(req, 'salon_' + newStatus, 'Changed status of ' + salon.name + ' to ' + newStatus, salon.id);
    res.json({ salon: formatProviderSalon(salon) });
  } catch (err) { next(err); }
});

// ── DELETE /salons/:id — Permanently delete a salon and all related data ──
router.delete('/salons/:id', requireOwner, async function(req, res, next) {
  try {
    var existing = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Salon not found' });

    var salonId = existing.id;
    var salonName = existing.name;

    await prisma.$transaction(async function(tx) {
      var s = salonId;
      await tx.$executeRawUnsafe('DELETE FROM "PackageRedemption" WHERE client_package_id IN (SELECT id FROM "ClientPackage" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "ClientPackageItem" WHERE client_package_id IN (SELECT id FROM "ClientPackage" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "ClientPackage" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServicePackageItem" WHERE package_id IN (SELECT id FROM "ServicePackage" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServicePackage" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "TicketItem" WHERE ticket_id IN (SELECT id FROM "Ticket" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "TicketPayment" WHERE ticket_id IN (SELECT id FROM "Ticket" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "Ticket" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServiceLine" WHERE appointment_id IN (SELECT id FROM "Appointment" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "Appointment" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "BlockedTime" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "GiftCardTransaction" WHERE gift_card_id IN (SELECT id FROM "GiftCard" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "GiftCard" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "LoyaltyTransaction" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "LoyaltyAccount" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "LoyaltyReward" WHERE program_id IN (SELECT id FROM "LoyaltyProgram" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "LoyaltyTier" WHERE program_id IN (SELECT id FROM "LoyaltyProgram" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "LoyaltyProgram" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "MembershipPerk" WHERE plan_id IN (SELECT id FROM "MembershipPlan" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "MembershipAccount" WHERE plan_id IN (SELECT id FROM "MembershipPlan" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "MembershipPlan" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "CommissionTier" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "CommissionRule" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "PunchAuditLog" WHERE punch_id IN (SELECT id FROM "ClockPunch" WHERE staff_id IN (SELECT id FROM "Staff" WHERE salon_id = $1))', s);
      await tx.$executeRawUnsafe('DELETE FROM "ClockPunch" WHERE staff_id IN (SELECT id FROM "Staff" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "StaffPresence" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "MessageLogEntry" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "MessageTemplate" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServiceCatalogCategory" WHERE service_catalog_id IN (SELECT id FROM "ServiceCatalog" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServiceStaffAssignment" WHERE service_catalog_id IN (SELECT id FROM "ServiceCatalog" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "CategoryStaffAssignment" WHERE category_id IN (SELECT id FROM "ServiceCategory" WHERE salon_id = $1)', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServiceCatalog" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ServiceCategory" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "Product" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ProductCategory" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "Supplier" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "Client" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "Staff" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "SalonSettings" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ActiveSession" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ProviderSalonNote" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "ProviderBillingRecord" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "TechSession" WHERE salon_id = $1', s);
      await tx.$executeRawUnsafe('DELETE FROM "Salon" WHERE id = $1', s);
    }, { timeout: 30000 });

    await addAudit(req, 'salon_deleted', 'Permanently deleted salon: ' + salonName + ' (id: ' + salonId + ')');
    res.json({ deleted: true, name: salonName });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SALON NOTES
// ════════════════════════════════════════════

router.get('/salons/:id/notes', async function(req, res, next) {
  try {
    var notes = await prisma.providerSalonNote.findMany({
      where: { salon_id: req.params.id },
      orderBy: { created_at: 'desc' }
    });
    res.json({ notes: notes });
  } catch (err) { next(err); }
});

router.post('/salons/:id/notes', async function(req, res, next) {
  try {
    var salon = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!salon) return res.status(404).json({ error: 'Salon not found' });

    var actorName = 'Unknown';
    var owner = await prisma.providerOwner.findUnique({ where: { id: req.provider_id } });
    if (owner) actorName = owner.name;

    var note = await prisma.providerSalonNote.create({
      data: {
        salon_id: req.params.id,
        agent_id: req.provider_id,
        agent_name: actorName,
        content: req.body.content,
      }
    });

    var snippet = req.body.content.substring(0, 60) + (req.body.content.length > 60 ? '...' : '');
    await addAudit(req, 'note_added', 'Added support note: "' + snippet + '"', req.params.id);

    res.status(201).json({ note: note });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════

router.get('/audit', async function(req, res, next) {
  try {
    var where = {};
    if (req.query.salon_id) where.salon_id = req.query.salon_id;

    var entries = await prisma.providerAuditLog.findMany({
      where: where,
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    res.json({ entries: entries });
  } catch (err) { next(err); }
});

// ── POST /salons/:id/unlock-setup — Unlock a salon's setup lock (C65) ──
router.post('/salons/:id/unlock-setup', async function(req, res, next) {
  try {
    var salonId = req.params.id;
    await prisma.salon.update({
      where: { id: salonId },
      data: {
        setup_locked: false,
        setup_failed_attempts: 0,
        setup_locked_at: null
      }
    });

    await addAudit(req, 'unlock_setup', 'Unlocked salon setup', salonId);
    console.log('[Provider] Setup unlocked for salon', salonId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /salons/:id/unlock-login — Unlock a salon's login lock (C66) ──
router.post('/salons/:id/unlock-login', async function(req, res, next) {
  try {
    var salonId = req.params.id;
    await prisma.salon.update({
      where: { id: salonId },
      data: {
        login_locked: false,
        login_failed_attempts: 0,
        login_locked_at: null
      }
    });

    await addAudit(req, 'unlock_login', 'Unlocked salon login', salonId);
    console.log('[Provider] Login unlocked for salon', salonId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /salons/:id/force-logout-tech — Force clear a tech's phone session (C65) ──
// Provider calls this when tech lost their device and can't sign out
router.post('/salons/:id/force-logout-tech', async function(req, res, next) {
  try {
    var salonId = req.params.id;
    var { staff_id } = req.body;

    if (staff_id) {
      // Clear specific tech session
      var deleted = await prisma.techSession.deleteMany({
        where: { staff_id: staff_id, salon_id: salonId }
      });
      await addAudit(req, 'force_logout_tech', 'Force cleared tech session for staff ' + staff_id, salonId);
      console.log('[Provider] Force cleared tech session — staff:', staff_id, 'deleted:', deleted.count);
    } else {
      // Clear ALL tech sessions for this salon
      var deletedAll = await prisma.techSession.deleteMany({
        where: { salon_id: salonId }
      });
      await addAudit(req, 'force_logout_all_techs', 'Force cleared all tech sessions (' + deletedAll.count + ')', salonId);
      console.log('[Provider] Force cleared ALL tech sessions for salon', salonId, '— deleted:', deletedAll.count);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /salons/:id/tech-sessions — List active tech sessions for a salon (C65) ──
router.get('/salons/:id/tech-sessions', async function(req, res, next) {
  try {
    var salonId = req.params.id;
    var sessions = await prisma.techSession.findMany({
      where: { salon_id: salonId },
      orderBy: { created_at: 'desc' }
    });

    // Attach staff names
    var staffIds = sessions.map(function(s) { return s.staff_id; });
    var staffRecords = await prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, display_name: true }
    });
    var staffMap = {};
    staffRecords.forEach(function(s) { staffMap[s.id] = s.display_name; });

    var result = sessions.map(function(s) {
      return {
        id: s.id,
        staff_id: s.staff_id,
        staff_name: staffMap[s.staff_id] || 'Unknown',
        device_info: s.device_info,
        created_at: s.created_at
      };
    });

    res.json({ sessions: result });
  } catch (err) { next(err); }
});

export default router;
