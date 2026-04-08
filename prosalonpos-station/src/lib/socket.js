/**
 * socket.js — Socket.io Client for Real-Time Multi-Station Sync
 * Session 46 | Phase 2C
 *
 * Connects to the backend WebSocket server. When one station makes a change
 * (e.g., adds a booking), the server broadcasts the event to all other
 * connected stations so their data updates automatically.
 *
 * Usage:
 *   import { connectSocket, disconnectSocket, onSocketEvent } from '../lib/socket';
 *
 *   // Connect when app mounts (after backend is confirmed available)
 *   connectSocket();
 *
 *   // Listen for events
 *   onSocketEvent('staff:updated', function(data) { staffStore.fetchStaff(); });
 *
 *   // Disconnect on unmount
 *   disconnectSocket();
 */

var _socket = null;
var _listeners = {};
var _connected = false;

// ── Self-originated event suppression ──
// When this station makes an API call that triggers a socket broadcast,
// the event bounces back and causes a redundant full refetch + flash.
// suppressNext(event) tells the handler to skip the NEXT occurrence.
var _suppressed = {};

function suppressNext(event, durationMs) {
  _suppressed[event] = Date.now() + (durationMs || 3000);
}

function isSuppressed(event) {
  var until = _suppressed[event];
  if (!until) return false;
  if (Date.now() < until) return true;
  delete _suppressed[event];
  return false;
}

/**
 * Connect to the backend WebSocket server.
 * Only connects once — safe to call multiple times.
 */
function connectSocket() {
  if (_socket) return; // already connected or connecting

  var socketBase = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;

  // Dynamic import to avoid loading socket.io if backend is not available
  var script = document.createElement('script');
  script.src = socketBase + '/socket.io/socket.io.js';
  script.onload = function() {
    if (typeof io === 'undefined') {
      console.warn('[socket] socket.io client library not available');
      return;
    }

    _socket = io(socketBase, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    _socket.on('connect', function() {
      _connected = true;
      console.log('[socket] Connected to server');

      // Join the salon room (using stored token's salon_id)
      var token = localStorage.getItem('prosalonpos_token');
      if (token) {
        try {
          var payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.salon_id) {
            _socket.emit('join-salon', payload.salon_id);
            console.log('[socket] Joined salon room');
          }
        } catch (e) {
          console.warn('[socket] Could not parse token for salon room');
        }
      }
    });

    _socket.on('disconnect', function() {
      _connected = false;
      console.log('[socket] Disconnected from server');
    });

    _socket.on('connect_error', function(err) {
      console.warn('[socket] Connection error:', err.message);
    });

    // Register any listeners that were added before connection
    var events = Object.keys(_listeners);
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var handlers = _listeners[event];
      for (var j = 0; j < handlers.length; j++) {
        _socket.on(event, handlers[j]);
      }
    }
  };

  script.onerror = function() {
    console.warn('[socket] Could not load socket.io client — backend may be offline');
  };

  document.head.appendChild(script);
}

/**
 * Disconnect from the WebSocket server.
 */
function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _connected = false;
  }
}

/**
 * Listen for a WebSocket event from the server.
 * Can be called before or after connectSocket().
 *
 * @param {string} event - Event name (e.g., 'staff:updated', 'service:created')
 * @param {function} handler - Callback function
 */
function onSocketEvent(event, handler) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(handler);

  // If already connected, register immediately
  if (_socket) {
    _socket.on(event, handler);
  }
}

/**
 * Remove a listener for a WebSocket event.
 */
function offSocketEvent(event, handler) {
  if (_listeners[event]) {
    _listeners[event] = _listeners[event].filter(function(h) { return h !== handler; });
  }
  if (_socket) {
    _socket.off(event, handler);
  }
}

/**
 * Check if currently connected.
 */
function isSocketConnected() {
  return _connected;
}

/**
 * Emit a WebSocket event to the server.
 * @param {string} event - Event name (e.g., 'print:request')
 * @param {*} data - Data to send
 */
function emitSocket(event, data) {
  if (_socket && _connected) {
    _socket.emit(event, data);
    return true;
  }
  return false;
}

export { connectSocket, disconnectSocket, onSocketEvent, offSocketEvent, isSocketConnected, emitSocket, suppressNext, isSuppressed };
