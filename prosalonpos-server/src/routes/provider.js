/**
 * ProSalonPOS — Provider Admin Routes
 * ISO-level management: salons, agents, billing, audit, notes.
 *
 * Auth: /auth/login is public. All other endpoints require provider JWT.
 * Owner-only endpoints use requireOwner middleware.
 *
 * Route structure:
 *   POST /auth/login              → { token, user }
 *   GET  /salons                  → { salons: [...] }
 *   GET  /salons/:id              → { salon: {...} }
 *   POST /salons                  → { salon: {...} }
 *   PUT  /salons/:id              → { salon: {...} }
 *   PUT  /salons/:id/features     → { salon: {...} }
 *   PUT  /salons/:id/status       → { salon: {...} }
 *   GET  /agents                  → { agents: [...] }
 *   GET  /agents/:id              → { agent: {...} }
 *   POST /agents                  → { agent: {...} }
 *   PUT  /agents/:id              → { agent: {...} }
 *   DELETE /agents/:id            → { agent: {...} }
 *   GET  /salons/:id/notes        → { notes: [...] }
 *   POST /salons/:id/notes        → { note: {...} }
 *   GET  /billing                 → { records: [...] }
 *   GET  /billing/:salonId        → { records: [...] }
 *   POST /billing                 → { record: {...} }
 *   GET  /audit                   → { entries: [...] }
 */
import { Router } from 'express';
import prisma, { isSQLite } from '../config/database.js';
import { createToken, hashPin, comparePin, pinSha256 } from '../config/auth.js';
import providerAuth, { requireOwner } from '../middleware/providerAuth.js';

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

var router = Router();

// ════════════════════════════════════════════
// AUTH (public — no middleware)
// ════════════════════════════════════════════

// ── POST /auth/login — Provider owner or agent PIN login ──
router.post('/auth/login', async function(req, res, next) {
  try {
    var pin = req.body.pin;
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    // Try provider owner first
    var owners = await prisma.providerOwner.findMany();
    for (var i = 0; i < owners.length; i++) {
      if (comparePin(pin, owners[i].pin_hash)) {
        var token = createToken({
          provider_id: owners[i].id,
          provider_role: 'owner',
        });
        return res.json({
          token: token,
          user: {
            id: owners[i].id,
            name: owners[i].name,
            email: owners[i].email,
            role: 'owner',
          }
        });
      }
    }

    // Try agents
    var agents = await prisma.providerAgent.findMany({
      where: { active: true }
    });
    for (var j = 0; j < agents.length; j++) {
      if (comparePin(pin, agents[j].pin_hash)) {
        var agentToken = createToken({
          provider_id: agents[j].id,
          provider_role: agents[j].role,
        });
        return res.json({
          token: agentToken,
          user: {
            id: agents[j].id,
            name: agents[j].name,
            email: agents[j].email,
            role: agents[j].role,
            visibility: agents[j].visibility,
          }
        });
      }
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// All routes below require provider auth
// ════════════════════════════════════════════
router.use(providerAuth);

// ════════════════════════════════════════════
// SALONS
// ════════════════════════════════════════════

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
    assigned_agent_id: s.assigned_agent_id,
    features_enabled: fromDb(s.features_enabled),
    created_at: s.created_at,
  };
}

// ── GET /salons — List salons (filtered by agent visibility) ──
router.get('/salons', async function(req, res, next) {
  try {
    var where = {};

    // If agent with "assigned" visibility, only show their salons
    if (req.provider_role !== 'owner') {
      var agent = await prisma.providerAgent.findUnique({
        where: { id: req.provider_id },
        include: { assigned_salons: { select: { id: true } } }
      });
      if (agent && agent.visibility === 'assigned') {
        var salonIds = agent.assigned_salons.map(function(s) { return s.id; });
        where.id = { in: salonIds };
      }
    }

    var salons = await prisma.salon.findMany({
      where: where,
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
    var activeCount = await prisma.activeSession.count({ where: { salon_id: salon.id } });
    var formatted = formatProviderSalon(salon);
    formatted.active_sessions = activeCount;
    res.json({ salon: formatted });
  } catch (err) { next(err); }
});

// ── POST /salons — Create a new salon (owner + sales agents) ──
// Creates: Salon + SalonSettings + owner Staff record (full onboarding)
router.post('/salons', async function(req, res, next) {
  try {
    if (req.provider_role === 'support') {
      return res.status(403).json({ error: 'Support agents cannot create salons' });
    }

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
      // Regenerate once if collision
      salonCode = '';
      for (var ci2 = 0; ci2 < 6; ci2++) salonCode += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
    }

    // Default features based on plan tier
    var defaultFeatures = {
      basic: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards'],
      professional: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards', 'loyalty', 'membership', 'online_booking', 'text_messaging', 'inventory', 'payroll', 'deposits'],
      premium: ['appointments', 'client_profiles', 'tech_turn', 'gift_cards', 'loyalty', 'membership', 'online_booking', 'group_booking', 'text_messaging', 'inventory', 'payroll', 'deposits', 'commission_tiers', 'advanced_reports', 'barcode_scan'],
    };

    var tier = d.plan_tier || 'basic';
    var features = d.features_enabled || defaultFeatures[tier] || defaultFeatures.basic;

    // Monthly fee based on tier
    var feeMap = { basic: 7900, professional: 14900, premium: 24900 };

    // Owner PIN — default to 0000 if not provided
    var ownerPin = d.owner_pin || '0000';
    var ownerPinHash = hashPin(ownerPin);
    var ownerPinSha = pinSha256(ownerPin);

    // Use a transaction to create Salon + SalonSettings + owner Staff atomically
    var result = await prisma.$transaction(async function(tx) {
      // 1. Create the Salon
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
          assigned_agent_id: d.assigned_agent_id || (req.provider_role !== 'owner' ? req.provider_id : null),
          features_enabled: toDb(features),
          owner_pin_hash: ownerPinHash,
          owner_pin_sha256: ownerPinSha,
        }
      });

      // 2. Create default SalonSettings
      await tx.salonSettings.create({
        data: {
          salon_id: salon.id,
          settings: {
            salon_name: d.name || 'New Salon',
            tax_rate_percentage: 7.5,
            tip_presets_array: [18, 20, 25],
            booking_increment_minutes: 15,
            rotation_mode: 'round_robin',
            opening_time: '09:00',
            closing_time: '19:00',
          }
        }
      });

      // 3. Create owner Staff record (so the salon owner can log in)
      var ownerDisplayName = d.owner_name || 'Owner';
      await tx.staff.create({
        data: {
          salon_id: salon.id,
          display_name: ownerDisplayName.split(' ')[0], // First name only for display
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

    // Audit
    await addAudit(req, 'salon_created', 'Created salon account: ' + result.name + ' (code: ' + salonCode + ')', result.id);

    // Return salon data + the generated owner PIN for display
    var formatted = formatProviderSalon(result);
    formatted.owner_pin = ownerPin; // Only returned at creation time
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
      'trial_end_date', 'assigned_agent_id', 'features_enabled'];

    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = f === 'features_enabled' ? toDb(d[f]) : d[f];
    });

    // Only owner can change processing rate and monthly fee
    if (req.provider_role !== 'owner') {
      delete updateData.processing_rate;
      delete updateData.monthly_software_fee_cents;
    }

    updateData.version = { increment: 1 };

    var salon = await prisma.salon.update({
      where: { id: req.params.id },
      data: updateData
    });

    await addAudit(req, 'salon_updated', 'Updated salon details: ' + salon.name, salon.id);
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

    // Log which features changed
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
    if (!['active', 'trial', 'suspended', 'cancelled'].includes(newStatus)) {
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
// Owner only. Cascade deletes all records for this salon.
router.delete('/salons/:id', requireOwner, async function(req, res, next) {
  try {
    var existing = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Salon not found' });

    var salonId = existing.id;
    var salonName = existing.name;

    // Cascade delete in dependency order (children first, salon last)
    // Interactive transaction ensures sequential execution — array syntax runs parallel
    // which causes foreign key violations when parents delete before children
    await prisma.$transaction(async function(tx) {
      // Package redemptions → package items → client packages → packages
      await tx.packageRedemption.deleteMany({ where: { clientPackage: { salon_id: salonId } } });
      await tx.clientPackageItem.deleteMany({ where: { clientPackage: { salon_id: salonId } } });
      await tx.clientPackage.deleteMany({ where: { salon_id: salonId } });
      await tx.servicePackageItem.deleteMany({ where: { package: { salon_id: salonId } } });
      await tx.servicePackage.deleteMany({ where: { salon_id: salonId } });
      // Tickets → items + payments
      await tx.ticketItem.deleteMany({ where: { ticket: { salon_id: salonId } } });
      await tx.ticketPayment.deleteMany({ where: { ticket: { salon_id: salonId } } });
      await tx.ticket.deleteMany({ where: { salon_id: salonId } });
      // Appointments + service lines
      await tx.serviceLine.deleteMany({ where: { salon_id: salonId } });
      await tx.appointment.deleteMany({ where: { salon_id: salonId } });
      await tx.blockedTime.deleteMany({ where: { salon_id: salonId } });
      // Gift cards + transactions
      await tx.giftCardTransaction.deleteMany({ where: { gift_card: { salon_id: salonId } } });
      await tx.giftCard.deleteMany({ where: { salon_id: salonId } });
      // Loyalty
      await tx.loyaltyTransaction.deleteMany({ where: { account: { salon_id: salonId } } });
      await tx.loyaltyAccount.deleteMany({ where: { salon_id: salonId } });
      await tx.loyaltyReward.deleteMany({ where: { program: { salon_id: salonId } } });
      await tx.loyaltyTier.deleteMany({ where: { program: { salon_id: salonId } } });
      await tx.loyaltyProgram.deleteMany({ where: { salon_id: salonId } });
      // Memberships
      await tx.membershipPerk.deleteMany({ where: { plan: { salon_id: salonId } } });
      await tx.membershipAccount.deleteMany({ where: { plan: { salon_id: salonId } } });
      await tx.membershipPlan.deleteMany({ where: { salon_id: salonId } });
      // Commission
      await tx.commissionTier.deleteMany({ where: { rule: { salon_id: salonId } } });
      await tx.commissionRule.deleteMany({ where: { salon_id: salonId } });
      // Timeclock
      await tx.punchAuditLog.deleteMany({ where: { punch: { salon_id: salonId } } });
      await tx.clockPunch.deleteMany({ where: { salon_id: salonId } });
      await tx.staffPresence.deleteMany({ where: { salon_id: salonId } });
      // Messaging
      await tx.messageLogEntry.deleteMany({ where: { salon_id: salonId } });
      await tx.messageTemplate.deleteMany({ where: { salon_id: salonId } });
      // Services + categories + assignments
      await tx.serviceCatalogCategory.deleteMany({ where: { service: { salon_id: salonId } } });
      await tx.serviceStaffAssignment.deleteMany({ where: { service: { salon_id: salonId } } });
      await tx.categoryStaffAssignment.deleteMany({ where: { category: { salon_id: salonId } } });
      await tx.serviceCatalog.deleteMany({ where: { salon_id: salonId } });
      await tx.serviceCategory.deleteMany({ where: { salon_id: salonId } });
      // Products + inventory
      await tx.product.deleteMany({ where: { salon_id: salonId } });
      await tx.productCategory.deleteMany({ where: { salon_id: salonId } });
      await tx.supplier.deleteMany({ where: { salon_id: salonId } });
      // Clients
      await tx.client.deleteMany({ where: { salon_id: salonId } });
      // Staff
      await tx.staff.deleteMany({ where: { salon_id: salonId } });
      // Settings
      await tx.salonSettings.deleteMany({ where: { salon_id: salonId } });
      // Active sessions
      await tx.activeSession.deleteMany({ where: { salon_id: salonId } });
      // Provider notes + billing for this salon
      await tx.providerSalonNote.deleteMany({ where: { salon_id: salonId } });
      await tx.providerBillingRecord.deleteMany({ where: { salon_id: salonId } });
      // Finally: the salon itself
      await tx.salon.delete({ where: { id: salonId } });
    }, { timeout: 30000 });

    await addAudit(req, 'salon_deleted', 'Permanently deleted salon: ' + salonName + ' (id: ' + salonId + ')');
    res.json({ deleted: true, name: salonName });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// AGENTS (owner only for create/update/delete)
// ════════════════════════════════════════════

// ── GET /agents — List all agents ──
router.get('/agents', requireOwner, async function(req, res, next) {
  try {
    var agents = await prisma.providerAgent.findMany({
      include: { assigned_salons: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
    var safe = agents.map(function(a) {
      var copy = Object.assign({}, a);
      delete copy.pin_hash;
      copy.assigned_salon_ids = a.assigned_salons.map(function(s) { return s.id; });
      return copy;
    });
    res.json({ agents: safe });
  } catch (err) { next(err); }
});

// ── GET /agents/:id — Single agent ──
router.get('/agents/:id', requireOwner, async function(req, res, next) {
  try {
    var agent = await prisma.providerAgent.findUnique({
      where: { id: req.params.id },
      include: { assigned_salons: { select: { id: true, name: true } } }
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    delete agent.pin_hash;
    agent.assigned_salon_ids = agent.assigned_salons.map(function(s) { return s.id; });
    res.json({ agent: agent });
  } catch (err) { next(err); }
});

// ── POST /agents — Create agent ──
router.post('/agents', requireOwner, async function(req, res, next) {
  try {
    var d = req.body;
    var agent = await prisma.providerAgent.create({
      data: {
        name: d.name || 'New Agent',
        email: d.email || null,
        pin_hash: hashPin(d.pin || String(Math.floor(1000 + Math.random() * 9000))),
        role: d.role || 'support',
        visibility: d.visibility || 'assigned',
        active: d.active !== false,
      }
    });

    await addAudit(req, 'agent_created', 'Created agent: ' + agent.name + ' (' + agent.role + ')', null);
    delete agent.pin_hash;
    res.status(201).json({ agent: agent });
  } catch (err) { next(err); }
});

// ── PUT /agents/:id — Update agent ──
router.put('/agents/:id', requireOwner, async function(req, res, next) {
  try {
    var existing = await prisma.providerAgent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'email', 'role', 'visibility', 'active'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });

    if (d.pin) {
      updateData.pin_hash = hashPin(d.pin);
    }

    var agent = await prisma.providerAgent.update({
      where: { id: req.params.id },
      data: updateData
    });

    await addAudit(req, 'agent_updated', 'Updated agent: ' + agent.name + ' (' + agent.role + ')', null);
    delete agent.pin_hash;
    res.json({ agent: agent });
  } catch (err) { next(err); }
});

// ── DELETE /agents/:id — Deactivate agent ──
router.delete('/agents/:id', requireOwner, async function(req, res, next) {
  try {
    var existing = await prisma.providerAgent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    var agent = await prisma.providerAgent.update({
      where: { id: req.params.id },
      data: { active: false }
    });

    await addAudit(req, 'agent_updated', 'Deactivated agent: ' + agent.name, null);
    delete agent.pin_hash;
    res.json({ agent: agent });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SALON NOTES
// ════════════════════════════════════════════

// ── GET /salons/:id/notes — Notes for a salon ──
router.get('/salons/:id/notes', async function(req, res, next) {
  try {
    var notes = await prisma.providerSalonNote.findMany({
      where: { salon_id: req.params.id },
      orderBy: { created_at: 'desc' }
    });
    res.json({ notes: notes });
  } catch (err) { next(err); }
});

// ── POST /salons/:id/notes — Add a note ──
router.post('/salons/:id/notes', async function(req, res, next) {
  try {
    var salon = await prisma.salon.findUnique({ where: { id: req.params.id } });
    if (!salon) return res.status(404).json({ error: 'Salon not found' });

    // Look up the actor's name
    var actorName = 'Unknown';
    if (req.provider_role === 'owner') {
      var owner = await prisma.providerOwner.findUnique({ where: { id: req.provider_id } });
      if (owner) actorName = owner.name;
    } else {
      var agent = await prisma.providerAgent.findUnique({ where: { id: req.provider_id } });
      if (agent) actorName = agent.name;
    }

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
// BILLING (owner only)
// ════════════════════════════════════════════

// ── GET /billing — All billing records ──
router.get('/billing', requireOwner, async function(req, res, next) {
  try {
    var where = {};
    if (req.query.salon_id) where.salon_id = req.query.salon_id;
    if (req.query.status) where.status = req.query.status;

    var records = await prisma.providerBillingRecord.findMany({
      where: where,
      orderBy: { date: 'desc' },
      include: { salon: { select: { id: true, name: true } } }
    });
    res.json({ records: records });
  } catch (err) { next(err); }
});

// ── GET /billing/:salonId — Billing records for a specific salon ──
router.get('/billing/:salonId', requireOwner, async function(req, res, next) {
  try {
    var records = await prisma.providerBillingRecord.findMany({
      where: { salon_id: req.params.salonId },
      orderBy: { date: 'desc' }
    });
    res.json({ records: records });
  } catch (err) { next(err); }
});

// ── POST /billing — Create a billing record ──
router.post('/billing', requireOwner, async function(req, res, next) {
  try {
    var d = req.body;
    var record = await prisma.providerBillingRecord.create({
      data: {
        salon_id: d.salon_id,
        amount_cents: d.amount_cents || 0,
        date: d.date || new Date().toISOString().split('T')[0],
        status: d.status || 'pending',
        method: d.method || 'N/A',
      }
    });
    res.status(201).json({ record: record });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════

// ── GET /audit — View audit log ──
// Owner sees all, agents see their own entries
router.get('/audit', async function(req, res, next) {
  try {
    var where = {};

    // Agents only see their own entries
    if (req.provider_role !== 'owner') {
      where.actor_id = req.provider_id;
    }

    // Optional salon filter
    if (req.query.salon_id) {
      where.salon_id = req.query.salon_id;
    }

    var entries = await prisma.providerAuditLog.findMany({
      where: where,
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    res.json({ entries: entries });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// AUDIT HELPER
// ════════════════════════════════════════════

async function addAudit(req, action, detail, salonId) {
  // Look up actor name
  var actorName = 'Unknown';
  try {
    if (req.provider_role === 'owner') {
      var owner = await prisma.providerOwner.findUnique({ where: { id: req.provider_id } });
      if (owner) actorName = owner.name;
    } else {
      var agent = await prisma.providerAgent.findUnique({ where: { id: req.provider_id } });
      if (agent) actorName = agent.name;
    }
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

export default router;
