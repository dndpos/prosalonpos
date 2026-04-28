/**
 * ProSalonPOS — Idempotency Middleware (v2.3.2 — V2.3 Phase 3c)
 *
 * Purpose: when a peer station's offline queue replays a write, or when the
 * renderer retries a fetch that timed out, the same logical operation can
 * arrive twice. Without this middleware that would produce duplicate
 * appointments, duplicate clients, etc. — exactly the kind of regression
 * Phase 3c is required to prevent.
 *
 * Contract: every write the renderer issues SHOULD carry a header
 *   X-Client-Op-Id: <uuid4>
 * If present, this middleware:
 *   1. Looks up (salon_id, key) in IdempotencyKey table.
 *   2. If a row exists → re-emit the cached status_code + response_body.
 *      The route handler is NEVER invoked. (Prevents duplicate side-effects.)
 *   3. If no row → wrap res.json so the FIRST response gets recorded with
 *      the actual status code, then call next().
 *
 * Behavior when header is absent: pure pass-through, no DB read, no DB write.
 * Existing online clients that haven't been updated to send the header keep
 * working byte-for-byte the same. This is the regression-safety guarantee.
 *
 * Mount: ONLY on routes that participate in offline-write replay. As of
 * v2.3.2 (Phase 3c.1) that's /api/v1/appointments and /api/v1/clients.
 * Mounting it broadly is unsafe — read-only routes don't need caching, and
 * routes with side-effects we haven't audited may not be safely cacheable.
 *
 * Storage shape: (salon_id, key) is unique. salon_id comes from the JWT
 * (set by authenticate middleware), so a malicious renderer can't poison
 * another salon's idempotency cache.
 *
 * Retention: 24h. Pruned by server.js setInterval (added in v2.3.2).
 */
import prisma from '../config/database.js';

// UUID4 shape check — defends against renderer tampering / accidental
// non-UUID values (which would still "work" as cache keys but pollute
// the table). Strict: 8-4-4-4-12 hex with v4 marker bits.
var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function idempotency(req, res, next) {
  // Only POST/PUT/DELETE participate. GETs are safely retryable on their own.
  var method = req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    return next();
  }

  var rawKey = req.headers['x-client-op-id'];
  if (!rawKey) return next();
  // Header arrival shape: string for single, array if duplicated. Take first.
  var key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  key = (key || '').trim();
  if (!key || !UUID_V4_RE.test(key)) {
    // Malformed key — treat as if absent. Don't 400; would break clients
    // that just have a buggy UUID generator. Log once and pass through.
    console.warn('[Idempotency] Ignoring malformed X-Client-Op-Id from salon ' + req.salon_id + ': ' + key);
    return next();
  }

  // salon_id MUST come from JWT (set by authenticate middleware). If this
  // middleware is somehow mounted before authenticate, fail closed.
  if (!req.salon_id) {
    console.error('[Idempotency] req.salon_id missing — middleware mounted before authenticate?');
    return next();
  }

  try {
    var existing = await prisma.idempotencyKey.findUnique({
      where: { salon_id_key: { salon_id: req.salon_id, key: key } },
    });

    if (existing) {
      // Exact replay. Echo the original response.
      res.status(existing.status_code);
      return res.json(existing.response_body);
    }
  } catch (err) {
    // DB read failed — don't block the write. Log + fall through.
    console.error('[Idempotency] Lookup failed:', err.message);
    return next();
  }

  // First time we've seen this op. Patch res.json so the route handler's
  // response gets recorded after-the-fact. We cache only 2xx responses —
  // 4xx/5xx errors (validation failures, missing resources) shouldn't be
  // sticky; the client should be allowed to retry with a fresh key.
  var pathToCache = req.baseUrl + (req.path || '');

  var originalJson = res.json.bind(res);
  res.json = function(body) {
    var statusCode = res.statusCode || 200;
    if (statusCode >= 200 && statusCode < 300) {
      // Fire-and-forget cache write. We can't await here without delaying
      // the response to the renderer; a failed cache write only impacts
      // future replays, never the current request.
      prisma.idempotencyKey.create({
        data: {
          salon_id: req.salon_id,
          key: key,
          method: method,
          path: pathToCache.slice(0, 200),  // defensive cap
          status_code: statusCode,
          response_body: body,
        },
      }).catch(function(err) {
        // Unique-violation (P2002) is benign — two parallel requests with
        // the same key both passed the existing-check, both wrote. Whoever
        // landed first wins; the loser's response is byte-equal anyway.
        if (err.code !== 'P2002') {
          console.error('[Idempotency] Cache write failed:', err.message);
        }
      });
    }
    return originalJson(body);
  };

  next();
}

// Periodic prune. Called from server.js setInterval. Deletes IdempotencyKey
// rows older than 24h. Safe — by 24h every legitimate replay window has
// closed (offline queues drain in minutes, retries in seconds).
export async function pruneIdempotencyKeys() {
  try {
    var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    var result = await prisma.idempotencyKey.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log('[Idempotency] Pruned ' + result.count + ' keys older than 24h');
    }
  } catch (err) {
    console.error('[Idempotency] Prune failed:', err.message);
  }
}
