/**
 * ProSalonPOS — WebSocket Event Broadcasting
 * Sends real-time updates to all stations in the same salon.
 * 
 * Usage: emit(req, 'staff:updated')
 * This broadcasts to all connected stations in the salon EXCEPT the sender.
 */

var _io = null;

export function setIO(io) {
  _io = io;
}

export function emit(req, event, data) {
  if (!_io) return;
  // Broadcast to the salon room — all stations in this salon receive it
  _io.to('salon:' + req.salon_id).emit(event, data || {});
}
