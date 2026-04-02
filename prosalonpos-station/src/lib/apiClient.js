/**
 * apiClient.js — Centralized API Client
 * Session 59 | Phase 2B — Station Pairing + Auth
 *
 * Handles:
 * - All HTTP calls to the backend (GET/POST/PUT/DELETE)
 * - JWT token storage and injection
 * - Station pairing (salon_id stored in localStorage)
 * - Backend availability detection (mock fallback)
 * - Automatic 401 → re-login redirect
 *
 * Usage:
 *   import { api } from '../lib/apiClient';
 *   const { staff } = await api.get('/staff');
 *   await api.post('/staff', { display_name: 'Maria' });
 */

var API_BASE = (function() {
  // In production (.exe mode), the frontend is served by the backend on the same host/port
  // In dev mode, Vite runs on 5173 and backend runs on 3001
  var loc = window.location;
  if (loc.port === '5173') {
    return 'http://localhost:3001/api/v1';
  }
  return loc.protocol + '//' + loc.host + '/api/v1';
})();

// ─── Token Management ───
var _token = null;
var _salonId = null;
var _staffId = null;

function setToken(token) {
  _token = token;
  if (token) {
    try {
      // JWT payload is the middle segment, base64-encoded
      var payload = JSON.parse(atob(token.split('.')[1]));
      _salonId = payload.salon_id || null;
      _staffId = payload.staff_id || null;
    } catch (e) {
      _salonId = null;
      _staffId = null;
    }
    localStorage.setItem('prosalonpos_token', token);
  } else {
    _salonId = null;
    _staffId = null;
    localStorage.removeItem('prosalonpos_token');
  }
}

function getToken() { return _token; }
function getSalonId() { return _salonId || getPairedSalonId(); }
function getStaffId() { return _staffId; }
function isLoggedIn() { return !!_token; }

// Restore token from localStorage on module load
var _savedToken = localStorage.getItem('prosalonpos_token');
if (_savedToken) setToken(_savedToken);

// ─── Station Pairing ───
// One-time setup: station stores which salon it belongs to.
// This persists across sessions — the station always knows its salon.

function getPairedSalonId() {
  return localStorage.getItem('prosalonpos_salon_id') || null;
}

function getPairedSalonCode() {
  return localStorage.getItem('prosalonpos_salon_code') || null;
}

function getPairedSalonName() {
  return localStorage.getItem('prosalonpos_salon_name') || null;
}

function isPaired() {
  return !!getPairedSalonId();
}

function pairStation(salonId, salonCode, salonName) {
  localStorage.setItem('prosalonpos_salon_id', salonId);
  localStorage.setItem('prosalonpos_salon_code', salonCode);
  localStorage.setItem('prosalonpos_salon_name', salonName);
}

function unpairStation() {
  localStorage.removeItem('prosalonpos_salon_id');
  localStorage.removeItem('prosalonpos_salon_code');
  localStorage.removeItem('prosalonpos_salon_name');
  setToken(null);
}

// ─── Backend Availability ───
var _backendAvailable = null; // null = not checked, true/false
var _checkPromise = null;

async function checkBackend() {
  // Always re-check (don't cache forever — server may have started since last check)
  _checkPromise = (async function() {
    try {
      var healthBase = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
      var res = await fetch(healthBase + '/api/health', { signal: AbortSignal.timeout(2000) });
      _backendAvailable = res.ok;
    } catch (e) {
      _backendAvailable = false;
    }
    return _backendAvailable;
  })();
  return _checkPromise;
}

function isBackendAvailable() { return _backendAvailable; }

// Called after successful login — marks backend as confirmed alive
// so stores skip redundant health checks on initial data load
function markBackendAvailable() { _backendAvailable = true; }

// Production mode detection — true when backend is available (real data) or running as .exe
// In dev (port 5173), starts false but flips to true once backend is detected.
// This means dev mode uses real API data when the server is running.
var _isProduction = window.location.port !== '5173';
function isProduction() { return _isProduction || _backendAvailable === true; }

// ─── Auth Expiry Callback ───
// App.jsx registers a callback that fires when a 401 is received.
// This lets the app return to the login screen when the JWT expires.
var _onAuthExpired = null;

function onAuthExpired(callback) {
  _onAuthExpired = callback;
}

// ─── Core Fetch Wrapper ───
async function request(method, path, body) {
  var url = API_BASE + path;
  var headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = 'Bearer ' + _token;

  var opts = { method: method, headers: headers };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  var _t0 = Date.now();
  var res = await fetch(url, opts);
  var _elapsed = Date.now() - _t0;

  // 401 handling — but NOT for login/auth routes (they return 401 for "wrong PIN")
  var isAuthRoute = path.indexOf('/auth/') === 0;
  if (res.status === 401 && !isAuthRoute) {
    _debugApi(method, path, res.status, _elapsed, null, 'AUTH_EXPIRED');
    setToken(null);
    if (_onAuthExpired) _onAuthExpired();
    throw new Error('AUTH_EXPIRED');
  }

  var data = await res.json();

  if (!res.ok) {
    _debugApi(method, path, res.status, _elapsed, null, data.error);
    var err = new Error(data.error || 'API error ' + res.status);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  _debugApi(method, path, res.status, _elapsed, data);
  return data;
}

// Debug helper for API calls — only runs when debug is enabled
function _debugApi(method, path, status, ms, data, errorMsg) {
  try {
    var store = _getDebugStore();
    if (!store || !store.enabled) return;
    var label = method + ' ' + path + ' → ' + status + ' (' + ms + 'ms)';
    if (errorMsg) label += ' ✗ ' + errorMsg;
    var meta = null;
    if (data && !errorMsg) {
      // Try to show item counts for common response shapes
      var keys = Object.keys(data);
      var counts = [];
      keys.forEach(function(k) { if (Array.isArray(data[k])) counts.push(k + ':' + data[k].length); });
      if (counts.length > 0) meta = { items: counts.join(', ') };
    }
    store.addLog(errorMsg ? 'ERROR' : 'API', label, meta);
  } catch(e) { /* ignore debug errors */ }
}

var _debugStoreRef = null;
function _getDebugStore() {
  if (!_debugStoreRef) {
    try {
      // Lazy access — debugStore may not be loaded yet at module init time
      var mod = window.__prosalonDebugStore;
      if (mod) _debugStoreRef = mod;
    } catch(e) { return null; }
  }
  return _debugStoreRef ? _debugStoreRef.getState() : null;
}

// ─── Convenience Methods ───
var api = {
  get: function(path) { return request('GET', path); },
  post: function(path, body) { return request('POST', path, body); },
  put: function(path, body) { return request('PUT', path, body); },
  del: function(path) { return request('DELETE', path); },
};

// ─── Auth Shortcuts ───

// Verify a salon code exists (for one-time station setup)
async function verifySalonCode(code) {
  var data = await api.get('/auth/salon/' + encodeURIComponent(code.toUpperCase()));
  return data.salon; // { id, name, salon_code, status }
}

// Login with the station's paired salon_id + staff PIN
async function login(pin) {
  var salonId = getPairedSalonId();
  if (!salonId) throw new Error('Station not paired to a salon');
  var data = await api.post('/auth/login', { salon_id: salonId, pin: pin });
  if (data.token) setToken(data.token);
  return data;
}

function logout() {
  setToken(null);
}

export {
  api,
  login,
  logout,
  setToken,
  getToken,
  getSalonId,
  getStaffId,
  isLoggedIn,
  checkBackend,
  isBackendAvailable,
  markBackendAvailable,
  isProduction,
  onAuthExpired,
  // Station pairing
  verifySalonCode,
  isPaired,
  pairStation,
  unpairStation,
  getPairedSalonId,
  getPairedSalonCode,
  getPairedSalonName,
};
