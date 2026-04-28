/**
 * ProSalonPOS — Authentication Helpers
 * JWT token creation/verification + PIN hashing with bcrypt.
 * SHA-256 fast hashing for local PIN lookup on stations.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

var JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
var JWT_EXPIRY = '24h';            // Per-user (PIN-login) tokens — short-lived
var JWT_EXPIRY_SALON = '365d';     // v2.0.10: salon-scoped (pairing) tokens — long-lived
var PIN_SALT_ROUNDS = 6;

// ── JWT ──

// v2.0.10: salon-scoped tokens (no staff_id) get the long expiry so paired
// stations don't kick the user out periodically. Per-user tokens keep the
// short expiry — those are issued via /auth/login when a PIN is entered.
export function createToken(payload) {
  var isSalonScoped = payload && !payload.staff_id;
  var expiresIn = isSalonScoped ? JWT_EXPIRY_SALON : JWT_EXPIRY;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── PIN Hashing (bcrypt — for secure storage) ──

export function hashPin(pin) {
  return bcrypt.hashSync(String(pin), PIN_SALT_ROUNDS);
}

export function comparePin(pin, hash) {
  return bcrypt.compareSync(String(pin), hash);
}

// Async versions — non-blocking, use in request handlers
export async function hashPinAsync(pin) {
  return bcrypt.hash(String(pin), PIN_SALT_ROUNDS);
}

export async function comparePinAsync(pin, hash) {
  return bcrypt.compare(String(pin), hash);
}

// ── PIN SHA-256 (fast — for local station lookup) ──

export function pinSha256(pin) {
  return createHash('sha256').update(String(pin)).digest('hex');
}
