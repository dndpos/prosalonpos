/**
 * ProSalonPOS — Auth Routes
 * GET  /api/v1/auth/salon/:code — verify salon code exists (public, for station setup)
 * POST /api/v1/auth/verify-setup — email + salon_code verification for station pairing (C65)
 * POST /api/v1/auth/login — salon_id + PIN → JWT token
 * POST /api/v1/auth/verify-pin — verify a staff PIN (for RBAC popups)
 * POST /api/v1/auth/tech-login — name + PIN → JWT for tech phone
 * POST /api/v1/auth/tech-logout — clear tech phone session (C65)
 */
import { Router } from 'express';
import { createHash } from 'crypto';
import prisma, { isSQLite } from '../config/database.js';
import { createToken, verifyToken, comparePin, hashPin, comparePinAsync, hashPinAsync, pinSha256 } from '../config/auth.js';
import { getIO } from '../utils/emit.js';
// PROTECTED C64: master code from env var via provider.js — never hardcoded
import { PROVIDER_MASTER_CODE } from './provider.js';

function fromDb(val) {
  if (val === null || val === undefined) return null;
  if (isSQLite && typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return val; } }
  return val;
}

// Check if a bcrypt hash uses old (slow) salt rounds and needs rehash
function needsRehash(hash) {
  var match = hash && hash.match(/^\$2[ab]\$(\d+)\$/);
  if (!match) return false;
  var rounds = parseInt(match[1], 10);
  return rounds > 6;
}

// ── Unified per-IP rate limiting for ALL auth endpoints (C66) ──
// 5 wrong attempts from any IP → blocked for 30 minutes (auto-unlocks)
// Covers: login, verify-setup, tech-login — any auth failure counts
var _ipAttempts = {}; // { ip: { count, firstAttempt } }
var IP_MAX_ATTEMPTS = 5;
var IP_BLOCK_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function checkIpBlocked(ip) {
  var entry = _ipAttempts[ip];
  if (!entry) return false; // not blocked
  // Window expired — auto-unlock
  if (Date.now() - entry.firstAttempt > IP_BLOCK_WINDOW_MS) {
    delete _ipAttempts[ip];
    return false;
  }
  return entry.count >= IP_MAX_ATTEMPTS; // blocked if 5+ failures
}

function getIpAttemptsRemaining(ip) {
  var entry = _ipAttempts[ip];
  if (!entry) return IP_MAX_ATTEMPTS;
  if (Date.now() - entry.firstAttempt > IP_BLOCK_WINDOW_MS) {
    delete _ipAttempts[ip];
    return IP_MAX_ATTEMPTS;
  }
  return Math.max(0, IP_MAX_ATTEMPTS - entry.count);
}

function recordIpFail(ip) {
  if (!_ipAttempts[ip]) _ipAttempts[ip] = { count: 0, firstAttempt: Date.now() };
  _ipAttempts[ip].count++;
}

function clearIpFails(ip) {
  delete _ipAttempts[ip];
}

// ── DB-level login lockout (C66) ──
var SALON_LOGIN_LOCK_THRESHOLD = 4; // lock after 4 consecutive wrong PINs
var SALON_LOGIN_WARN_AFTER = 3; // show remaining attempts after 3 failures

var router = Router();

// ── GET /salon/:code — Look up salon by code (one-time station setup) ──
// Public endpoint — returns salon name and id if code is valid
router.get('/salon/:code', async function(req, res, next) {
  try {
    var code = (req.params.code || '').toUpperCase();
    if (!code) return res.status(400).json({ error: 'Salon code is required' });

    var salon = await prisma.salon.findUnique({
      where: { salon_code: code }
    });

    if (!salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    res.json({
      salon: {
        id: salon.id,
        name: salon.name,
        salon_code: salon.salon_code,
        status: salon.status,
      }
    });
  } catch (err) { next(err); }
});

// ── POST /verify-setup — Email + salon code verification for station pairing (C65) ──
// Brute force protection: 5 wrong attempts → salon setup_locked = true
// Existing logged-in stations keep working, but no NEW stations can pair or log in.
router.post('/verify-setup', async function(req, res, next) {
  try {
    var ip = req.ip || req.connection.remoteAddress || 'unknown';
    var { email, salon_code } = req.body;
    if (!email || !salon_code) {
      return res.status(400).json({ error: 'Email and salon code are required' });
    }

    // C66: Unified IP block check
    if (checkIpBlocked(ip)) {
      return res.status(429).json({ error: 'Too many failed attempts. This device is temporarily blocked. Try again in 30 minutes.' });
    }

    var code = salon_code.trim().toUpperCase();
    var emailLower = email.trim().toLowerCase();

    var salon = await prisma.salon.findUnique({
      where: { salon_code: code }
    });

    if (!salon) {
      recordIpFail(ip);
      return res.status(404).json({ error: 'Salon not found. Check the code and try again.' });
    }

    // Check if setup is already locked
    if (salon.setup_locked) {
      return res.status(403).json({
        error: 'This salon has been locked due to too many failed attempts. Contact your provider to unlock.',
        code: 'SETUP_LOCKED'
      });
    }

    // Check if email matches owner_email on the salon record
    var salonEmail = (salon.owner_email || '').trim().toLowerCase();
    if (!salonEmail || salonEmail !== emailLower) {
      // Wrong email — increment failed attempts
      recordIpFail(ip);
      var newAttempts = (salon.setup_failed_attempts || 0) + 1;
      var shouldLock = newAttempts >= 5;

      await prisma.salon.update({
        where: { id: salon.id },
        data: {
          setup_failed_attempts: newAttempts,
          setup_locked: shouldLock,
          setup_locked_at: shouldLock ? new Date() : undefined
        }
      });

      if (shouldLock) {
        console.log('[Auth] SETUP LOCKED — salon', salon.name, '(' + code + ') after 5 failed attempts');
        return res.status(403).json({
          error: 'Too many failed attempts. This salon has been locked. Contact your provider to unlock.',
          code: 'SETUP_LOCKED'
        });
      }

      var remaining = 5 - newAttempts;
      return res.status(401).json({
        error: 'Email does not match our records. ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining.',
        remaining: remaining
      });
    }

    // Email matches — clear any failed attempts
    if (salon.setup_failed_attempts > 0) {
      await prisma.salon.update({
        where: { id: salon.id },
        data: { setup_failed_attempts: 0 }
      });
    }

    // Check salon status
    if (salon.status === 'cancelled') {
      return res.status(403).json({ error: 'This salon account has been cancelled.' });
    }
    if (salon.status === 'suspended') {
      return res.status(403).json({ error: 'This salon account is suspended. Contact your provider.' });
    }

    res.json({
      salon: {
        id: salon.id,
        name: salon.name,
        salon_code: salon.salon_code,
        status: salon.status,
      }
    });
  } catch (err) { next(err); }
});

// ── GET /pin-table/:salon_id — PIN + badge lookup tables for instant local verification ──
// Public endpoint — station calls this once on boot to enable instant PIN/badge checking.
// Returns { pinTable, badgeTable }:
//   pinTable:   SHA-256(pin) → staff info (hashed; station hashes typed PIN and looks up)
//   badgeTable: raw badge_id → staff info (not secret; station does direct lookup on scan)
// Zero network delay, exact match required. cc2 adds badgeTable; pinTable unchanged.
router.get('/pin-table/:salon_id', async function(req, res, next) {
  try {
    var salon_id = req.params.salon_id;
    if (!salon_id) return res.status(400).json({ error: 'salon_id is required' });

    var table = {};
    var badgeTable = {};

    // 1. Staff PINs + badges
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    for (var i = 0; i < staff.length; i++) {
      var entry = {
        id: staff[i].id,
        display_name: staff[i].display_name,
        role: staff[i].role,
        rbac_role: staff[i].rbac_role,
        permissions: fromDb(staff[i].permissions),
        permission_overrides: fromDb(staff[i].permission_overrides)
      };
      if (staff[i].pin_sha256) {
        table[staff[i].pin_sha256] = entry;
      }
      if (staff[i].badge_id) {
        badgeTable[staff[i].badge_id] = entry;
      }
    }

    // 2. Owner PIN (no badge — owner authenticates via PIN only)
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    if (salon && salon.owner_pin_sha256) {
      table[salon.owner_pin_sha256] = {
        id: 'owner',
        display_name: 'Owner',
        role: 'owner',
        rbac_role: 'owner'
      };
    }

    // 3. Provider master code (no badge — provider authenticates via master code only)
    table[pinSha256(PROVIDER_MASTER_CODE)] = {
      id: 'provider',
      display_name: 'Provider',
      role: 'owner',
      rbac_role: 'owner'
    };

    res.json({ pinTable: table, badgeTable: badgeTable });
  } catch (err) { next(err); }
});

// ── Login: salon_id + PIN → JWT ──
// Check order: 1) Staff PINs  2) Owner PIN (salon record)  3) Provider master code
router.post('/login', async function(req, res, next) {
  try {
    var ip = req.ip || req.connection.remoteAddress || 'unknown';
    var { salon_id, pin } = req.body;
    console.log('[Auth] Login attempt — salon_id:', salon_id);

    if (!salon_id || !pin) {
      return res.status(400).json({ error: 'salon_id and pin are required' });
    }

    // C66: Unified IP block check — 5 wrong attempts from any auth endpoint → 30 min block
    if (checkIpBlocked(ip)) {
      return res.status(429).json({ error: 'Too many failed attempts. This device is temporarily blocked. Try again in 30 minutes.' });
    }

    // ── Salon status + trial expiration check ──
    // Provider master code bypasses — you always need a way in to manage
    if (pin !== PROVIDER_MASTER_CODE) {
      var salonCheck = await prisma.salon.findUnique({
        where: { id: salon_id },
        select: { status: true, trial_end_date: true, setup_locked: true, login_locked: true, login_failed_attempts: true }
      });
      console.log('[Auth] Status gate — salon status:', salonCheck ? salonCheck.status : 'NOT FOUND');
      if (salonCheck) {
        // C66: Login locked — too many failed PIN attempts
        if (salonCheck.login_locked) {
          console.log('[Auth] BLOCKED — salon login is locked (brute force protection)');
          return res.status(403).json({
            error: 'This salon has been locked due to too many failed login attempts. Contact your provider to unlock.',
            code: 'LOGIN_LOCKED',
          });
        }
        // C65: Setup locked — no new stations can log in
        if (salonCheck.setup_locked) {
          console.log('[Auth] BLOCKED — salon setup is locked (brute force protection)');
          return res.status(403).json({
            error: 'This salon has been locked due to too many failed setup attempts. Contact your provider to unlock.',
            code: 'SETUP_LOCKED',
          });
        }
        if (salonCheck.status === 'suspended') {
          console.log('[Auth] BLOCKED — salon is suspended');
          return res.status(403).json({
            error: 'This salon account is suspended. Contact your provider.',
            code: 'SALON_SUSPENDED',
          });
        }
        if (salonCheck.status === 'trial' && salonCheck.trial_end_date) {
          if (new Date() > new Date(salonCheck.trial_end_date)) {
            return res.status(403).json({
              error: 'Your trial has expired. Contact your provider to activate your account.',
              code: 'TRIAL_EXPIRED',
            });
          }
        }
      }
    }

    // 1. Check staff PINs (async — non-blocking)
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    console.log('[Auth] Found', staff.length, 'active staff for salon', salon_id);

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash) {
        var isMatch = await comparePinAsync(pin, staff[i].pin_hash);
        if (isMatch) {
          matched = staff[i];
          console.log('[Auth] MATCHED staff:', matched.display_name, '| role:', matched.role, '| rbac_role:', matched.rbac_role);
          // Rehash if using old slow rounds (fire and forget)
          if (needsRehash(staff[i].pin_hash)) {
            hashPinAsync(pin).then(function(newHash) {
              prisma.staff.update({ where: { id: matched.id }, data: { pin_hash: newHash } }).catch(function() {});
            });
          }
          break;
        }
      }
    }

    if (matched) {
      clearIpFails(ip);
      // C66: Clear DB-level failed login counter on successful login
      await prisma.salon.update({ where: { id: salon_id }, data: { login_failed_attempts: 0 } }).catch(function() {});
      // ── Station enforcement: check active session count before allowing login ──
      // Provider master code bypasses — you always need a way in
      var salonRecord = await prisma.salon.findUnique({ where: { id: salon_id }, select: { station_count: true, status: true, trial_end_date: true } });
      if (salonRecord) {
        var activeCount = await prisma.activeSession.count({ where: { salon_id: salon_id } });
        if (activeCount >= salonRecord.station_count) {
          return res.status(403).json({
            error: 'This salon is already in use on ' + activeCount + ' device' + (activeCount > 1 ? 's' : '') + '. Your plan allows ' + salonRecord.station_count + '. Log out on another device or contact your provider to add more stations.',
            code: 'STATION_LIMIT',
            active: activeCount,
            limit: salonRecord.station_count,
          });
        }
      }

      var token = createToken({
        salon_id: matched.salon_id,
        staff_id: matched.id,
        role: matched.rbac_role
      });
      return res.json({
        token: token,
        staff: {
          id: matched.id,
          display_name: matched.display_name,
          role: matched.role,
          rbac_role: matched.rbac_role
        }
      });
    }

    // 2. Check owner PIN on Salon record
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    if (salon && salon.owner_pin_hash) {
      var ownerMatch = await comparePinAsync(pin, salon.owner_pin_hash);
      if (ownerMatch) {
        clearIpFails(ip);
        // C66: Clear DB-level failed login counter on successful login
        await prisma.salon.update({ where: { id: salon_id }, data: { login_failed_attempts: 0 } }).catch(function() {});
        // ── Station enforcement for owner login ──
        var ownerActiveCount = await prisma.activeSession.count({ where: { salon_id: salon_id } });
        if (ownerActiveCount >= salon.station_count) {
          return res.status(403).json({
            error: 'This salon is already in use on ' + ownerActiveCount + ' device' + (ownerActiveCount > 1 ? 's' : '') + '. Your plan allows ' + salon.station_count + '. Log out on another device or contact your provider to add more stations.',
            code: 'STATION_LIMIT',
            active: ownerActiveCount,
            limit: salon.station_count,
          });
        }

        // Rehash if using old slow rounds (fire and forget)
        if (needsRehash(salon.owner_pin_hash)) {
          hashPinAsync(pin).then(function(newHash) {
            prisma.salon.update({ where: { id: salon.id }, data: { owner_pin_hash: newHash } }).catch(function() {});
          });
        }
        var ownerToken = createToken({
          salon_id: salon_id,
          staff_id: 'owner',
          role: 'owner'
        });
        return res.json({
          token: ownerToken,
          staff: {
            id: 'owner',
            display_name: 'Owner',
            role: 'owner',
            rbac_role: 'owner'
          }
        });
      }
    }

    // 3. Provider master code (works on every system)
    if (pin === PROVIDER_MASTER_CODE) {
      var masterToken = createToken({
        salon_id: salon_id,
        staff_id: 'provider',
        role: 'owner'
      });
      return res.json({
        token: masterToken,
        staff: {
          id: 'provider',
          display_name: 'Provider',
          role: 'owner',
          rbac_role: 'owner'
        }
      });
    }

    recordIpFail(ip);

    // ── C66: DB-level login lockout — track consecutive failed PIN attempts ──
    var lockSalon = await prisma.salon.findUnique({
      where: { id: salon_id },
      select: { id: true, login_failed_attempts: true }
    });
    if (lockSalon) {
      var newFailCount = (lockSalon.login_failed_attempts || 0) + 1;
      var lockData = { login_failed_attempts: newFailCount };
      if (newFailCount >= SALON_LOGIN_LOCK_THRESHOLD) {
        lockData.login_locked = true;
        lockData.login_locked_at = new Date();
        console.log('[Auth] LOCKED salon login after', newFailCount, 'failed attempts — salon_id:', salon_id);
        await prisma.salon.update({ where: { id: salon_id }, data: lockData });
        return res.status(403).json({
          error: 'This salon has been locked due to too many failed login attempts. Contact your provider to unlock.',
          code: 'LOGIN_LOCKED',
        });
      }
      await prisma.salon.update({ where: { id: salon_id }, data: lockData });

      // Warn user when getting close to lockout (after 7 failures)
      if (newFailCount >= SALON_LOGIN_WARN_AFTER) {
        var attemptsLeft = SALON_LOGIN_LOCK_THRESHOLD - newFailCount;
        return res.status(401).json({
          error: 'Invalid PIN. ' + attemptsLeft + ' attempt' + (attemptsLeft > 1 ? 's' : '') + ' remaining before lockout.',
          code: 'PIN_WARNING',
          attempts_remaining: attemptsLeft,
        });
      }
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) { next(err); }
});

// ── Verify PIN (for RBAC popups) ──
// Same 3-level check: staff → owner → master code
router.post('/verify-pin', async function(req, res, next) {
  try {
    var { salon_id, pin } = req.body;
    if (!salon_id || !pin) {
      return res.status(400).json({ error: 'salon_id and pin are required' });
    }

    // 1. Staff PINs (async)
    var staff = await prisma.staff.findMany({
      where: { salon_id: salon_id, active: true }
    });

    var matched = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].pin_hash) {
        var isMatch = await comparePinAsync(pin, staff[i].pin_hash);
        if (isMatch) {
          matched = staff[i];
          if (needsRehash(staff[i].pin_hash)) {
            hashPinAsync(pin).then(function(newHash) {
              prisma.staff.update({ where: { id: matched.id }, data: { pin_hash: newHash } }).catch(function() {});
            });
          }
          break;
        }
      }
    }

    if (matched) {
      return res.json({
        staff: {
          id: matched.id,
          display_name: matched.display_name,
          role: matched.role,
          rbac_role: matched.rbac_role,
          permissions: fromDb(matched.permissions),
          permission_overrides: fromDb(matched.permission_overrides)
        }
      });
    }

    // 2. Owner PIN
    var salon = await prisma.salon.findUnique({ where: { id: salon_id } });
    if (salon && salon.owner_pin_hash) {
      var ownerMatch = await comparePinAsync(pin, salon.owner_pin_hash);
      if (ownerMatch) {
        if (needsRehash(salon.owner_pin_hash)) {
          hashPinAsync(pin).then(function(newHash) {
            prisma.salon.update({ where: { id: salon.id }, data: { owner_pin_hash: newHash } }).catch(function() {});
          });
        }
        return res.json({
          staff: { id: 'owner', display_name: 'Owner', role: 'owner', rbac_role: 'owner', permissions: null, permission_overrides: null }
        });
      }
    }

    // 3. Master code
    if (pin === PROVIDER_MASTER_CODE) {
      return res.json({
        staff: { id: 'provider', display_name: 'Provider', role: 'owner', rbac_role: 'owner', permissions: null, permission_overrides: null }
      });
    }

    return res.status(401).json({ error: 'Invalid PIN' });
  } catch (err) { next(err); }
});

// ── Change Owner PIN ──
// Requires JWT — inline auth check since this router is public
router.put('/owner-pin', async function(req, res, next) {
  try {
    console.log('[Auth] PUT /owner-pin called');
    var { new_pin, salon_id } = req.body;

    // Try JWT first, fall back to salon_id from body
    var resolvedSalonId = null;
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        var decoded = verifyToken(authHeader.slice(7));
        resolvedSalonId = decoded.salon_id;
      } catch (e) {
        // Token expired — fall through to salon_id from body
      }
    }
    if (!resolvedSalonId && salon_id) {
      resolvedSalonId = salon_id;
    }
    if (!resolvedSalonId) {
      return res.status(401).json({ error: 'salon_id required' });
    }

    if (!new_pin || String(new_pin).length < 2) {
      return res.status(400).json({ error: 'PIN must be at least 2 digits' });
    }

    var newHash = hashPin(String(new_pin));
    var newSha = pinSha256(String(new_pin));
    await prisma.salon.update({
      where: { id: resolvedSalonId },
      data: { owner_pin_hash: newHash, owner_pin_sha256: newSha, owner_pin_plain: String(new_pin) }
    });

    // Sync to any staff record with role 'owner' (they share the salon owner PIN)
    await prisma.staff.updateMany({
      where: { salon_id: resolvedSalonId, role: 'owner' },
      data: { pin_hash: newHash, pin_sha256: newSha }
    });

    console.log('[Auth] Owner PIN updated for salon', resolvedSalonId);

    // Broadcast to all stations in this salon so they refresh their pin table + settings
    var io = getIO();
    if (io) {
      io.to('salon:' + resolvedSalonId).emit('owner-pin-changed', { salon_id: resolvedSalonId });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// TECH PHONE LOGIN — display name + PIN → JWT
// C66: Uses unified IP blocker (5 attempts / 30 min)
// ════════════════════════════════════════════

router.post('/tech-login', async function(req, res, next) {
  try {
    var ip = req.ip || req.connection.remoteAddress || 'unknown';

    // C66: Unified IP block check
    if (checkIpBlocked(ip)) {
      return res.status(429).json({ error: 'Too many failed attempts. This device is temporarily blocked. Try again in 30 minutes.' });
    }

    var { name, pin, salon_code } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN are required' });

    var searchName = name.trim().toLowerCase();

    // Build query — scope to salon if salon_code provided
    var staffWhere = { active: true };
    if (salon_code) {
      var salon = await prisma.salon.findFirst({ where: { salon_code: salon_code.toUpperCase().trim() } });
      if (salon) staffWhere.salon_id = salon.id;
    }

    // Find all active staff matching the display name (case-insensitive)
    var allStaff = await prisma.staff.findMany({
      where: staffWhere,
      include: { salon: { select: { id: true, name: true, status: true, trial_end_date: true } } }
    });

    // Case-insensitive name match
    var matches = allStaff.filter(function(s) {
      return s.display_name && s.display_name.toLowerCase() === searchName;
    });

    if (matches.length === 0) {
      recordIpFail(ip);
      return res.status(401).json({ error: 'Name not found. Use the name your salon has on file.' });
    }

    // Try PIN against each match (handles same name at different salons)
    var inputHash = pinSha256(pin);
    var staff = null;
    for (var i = 0; i < matches.length; i++) {
      if (matches[i].pin_sha256 === inputHash) { staff = matches[i]; break; }
    }

    if (!staff) {
      recordIpFail(ip);
      var remaining = getIpAttemptsRemaining(ip);
      if (remaining <= 0) {
        return res.status(429).json({ error: 'Too many failed attempts. This device is temporarily blocked. Try again in 30 minutes.' });
      }
      return res.status(401).json({ error: 'Incorrect PIN. ' + remaining + ' attempt' + (remaining > 1 ? 's' : '') + ' remaining.' });
    }

    // Check salon status
    if (staff.salon && staff.salon.status === 'suspended') {
      return res.status(403).json({ error: 'This salon account is suspended' });
    }

    // C65: Single-device enforcement — check if already logged in elsewhere
    var existingSession = await prisma.techSession.findUnique({
      where: { staff_id: staff.id }
    });
    if (existingSession) {
      return res.status(403).json({
        error: 'You are already signed in on another device. Sign out there first, or ask your manager to contact the provider for help.',
        code: 'TECH_ALREADY_LOGGED_IN'
      });
    }

    // Success — clear rate limit and create JWT
    clearIpFails(ip);

    var tokenPayload = {
      staff_id: staff.id,
      salon_id: staff.salon_id,
      role: staff.role || 'tech',
      display_name: staff.display_name,
    };
    var token = createToken(tokenPayload);

    // C65: Create tech session record
    var userAgent = req.headers['user-agent'] || '';
    var deviceSnippet = userAgent.length > 100 ? userAgent.substring(0, 100) : userAgent;
    var tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.techSession.create({
      data: {
        staff_id: staff.id,
        salon_id: staff.salon_id,
        token_hash: tokenHash,
        device_info: deviceSnippet,
      }
    }).catch(function(err) {
      // If unique constraint fails (race condition), session already exists
      console.log('[Auth] TechSession create race condition for', staff.display_name, err.message);
    });

    res.json({
      token: token,
      staff_id: staff.id,
      staff_name: staff.display_name,
      salon_id: staff.salon_id,
      salon_name: staff.salon ? staff.salon.name : '',
      commission_rate: staff.commission_pct || 0,
      role: staff.role || 'tech',
      salary_period: staff.salary_period || 'biweekly',
      photo_url: staff.photo_url || null,  // cc4.5: so the avatar shows on reopen
    });
  } catch (err) { next(err); }
});

// ── POST /tech-logout — Clear tech phone session (C65) ──
router.post('/tech-logout', async function(req, res, next) {
  try {
    var { staff_id } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'staff_id is required' });

    await prisma.techSession.deleteMany({
      where: { staff_id: staff_id }
    });

    console.log('[Auth] Tech session cleared for staff_id:', staff_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
