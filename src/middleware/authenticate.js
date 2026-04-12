/**
 * ProSalonPOS — Authentication Middleware
 * Verifies JWT Bearer token on protected routes.
 * Extracts salon_id and staff_id from the token — NEVER from the request body.
 */
import { verifyToken } from '../config/auth.js';

export default function authenticate(req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  var token = authHeader.slice(7);
  try {
    var decoded = verifyToken(token);
    req.salon_id = decoded.salon_id;
    req.staff_id = decoded.staff_id;
    req.staff_role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
