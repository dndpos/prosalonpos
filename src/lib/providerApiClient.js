/**
 * providerApiClient.js — Provider Admin API Client
 * Session 65 | Wiring Provider Admin Panel to real backend
 *
 * Separate from apiClient.js because:
 *   - Provider auth uses a different JWT (provider_id, provider_role)
 *   - Salon auth uses (salon_id, staff_id, role)
 *   - They don't share tokens — you can be logged into Provider Admin
 *     without being logged into a salon station
 *
 * Usage:
 *   import { providerApi, providerLogin, providerLogout } from '../lib/providerApiClient';
 *   const { salons } = await providerApi.get('/salons');
 *   await providerApi.put('/salons/' + id, { name: 'New Name' });
 */

var API_BASE = (function() {
  var loc = window.location;
  if (loc.port === '5173') {
    return 'http://localhost:3001/api/v1/provider';
  }
  return loc.protocol + '//' + loc.host + '/api/v1/provider';
})();

// ─── Token Management ───
var _token = null;

function setProviderToken(token) {
  _token = token;
  if (token) {
    sessionStorage.setItem('prosalonpos_provider_token', token);
  } else {
    sessionStorage.removeItem('prosalonpos_provider_token');
  }
}

function getProviderToken() { return _token; }

// Restore token from sessionStorage on module load
var _saved = sessionStorage.getItem('prosalonpos_provider_token');
if (_saved) _token = _saved;

// ─── Core Fetch Wrapper ───
async function request(method, path, body) {
  var url = API_BASE + path;
  var headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = 'Bearer ' + _token;

  var opts = { method: method, headers: headers };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  var res = await fetch(url, opts);
  var data = await res.json();

  if (!res.ok) {
    var err = new Error(data.error || 'API error ' + res.status);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── Convenience Methods ───
var providerApi = {
  get: function(path) { return request('GET', path); },
  post: function(path, body) { return request('POST', path, body); },
  put: function(path, body) { return request('PUT', path, body); },
  del: function(path) { return request('DELETE', path); },
};

// ─── Login ───
// Calls POST /provider/auth/login with a PIN
// Returns { token, user: { id, name, email, role, visibility? } }
async function providerLogin(pin) {
  var data = await providerApi.post('/auth/login', { pin: pin });
  if (data.token) {
    setProviderToken(data.token);
  }
  return data;
}

function providerLogout() {
  setProviderToken(null);
}

// ─── Backend Check ───
// Quick check if the server is running (uses the same health endpoint)
async function checkProviderBackend() {
  try {
    var healthBase = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
    var res = await fetch(healthBase + '/api/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export {
  providerApi,
  providerLogin,
  providerLogout,
  checkProviderBackend,
  getProviderToken,
};
