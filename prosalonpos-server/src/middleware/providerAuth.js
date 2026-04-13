/**
 * ProSalonPOS — Provider Authentication Middleware
 * Verifies JWT Bearer token for provider-level routes.
 * Extracts provider_id, provider_role from the token.
 *
 * Provider tokens contain:
 *   { provider_id, provider_role: 'owner'|'support'|'sales' }
 * This is separate from salon-level auth (salon_id, staff_id, role).
 */
import { verifyToken } from '../config/auth.js';

export default function providerAuth(req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  var token = authHeader.slice(7);
  try {
    var decoded = verifyToken(token);

    // Must be a provider token (has provider_id, not salon_id)
    if (!decoded.provider_id) {
      return res.status(401).json({ error: 'Not a provider token' });
    }

    req.provider_id = decoded.provider_id;
    req.provider_role = decoded.provider_role; // owner | support | sales
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require owner role — blocks agents from owner-only endpoints
 */
export function requireOwner(req, res, next) {
  if (req.provider_role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}
