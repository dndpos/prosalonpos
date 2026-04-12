/**
 * ProSalonPOS — WebSocket Event Broadcasting
 * Sends real-time updates to all stations in the same salon EXCEPT the sender.
 *
 * The sender's socket ID comes from the X-Socket-ID header set by apiClient.
 * This prevents the station that made the API call from receiving its own
 * broadcast event, which would trigger a redundant refetch and cause UI flicker.
 *
 * Usage: emit(req, 'staff:updated')
 */

var _io = null;

export function setIO(io) {
  _io = io;
}

export function getIO() {
  return _io;
}

export function emit(req, event, data) {
  if (!_io) return;
  var room = 'salon:' + req.salon_id;
  var senderSocketId = req.headers && req.headers['x-socket-id'];
  if (senderSocketId) {
    // Exclude the sender — they already updated their local store
    _io.to(room).except(senderSocketId).emit(event, data || {});
  } else {
    // No socket ID header — broadcast to everyone (fallback)
    _io.to(room).emit(event, data || {});
  }
}
