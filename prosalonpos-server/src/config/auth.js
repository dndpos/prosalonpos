/**
 * ProSalonPOS — Authentication Helpers
 * JWT token creation/verification + PIN hashing with bcrypt.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

var JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
var JWT_EXPIRY = '24h';
var PIN_SALT_ROUNDS = 6;

// ── JWT ──

export function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── PIN Hashing ──

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
