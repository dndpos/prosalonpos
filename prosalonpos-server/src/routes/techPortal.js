/**
 * Tech Portal — Dynamic routes for /tech/:salonCode
 * 
 * Generates per-salon: HTML page, PWA manifest, and app icon.
 * The salon name appears in the home screen icon and title.
 * 
 * Routes (all public, no auth):
 *   GET /tech/:code          → HTML page (loads same React bundle, custom manifest/icon)
 *   GET /tech-manifest/:code → PWA manifest with salon-specific start_url + name
 *   GET /tech-icon/:code.png → 192x192 PNG icon with salon initials + gradient
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from '../config/database.js';

var _sharp = null;
try { _sharp = (await import('sharp')).default; } catch (e) {
  console.warn('[TechPortal] sharp not available — icons will be SVG fallback');
}

var __dirname = dirname(fileURLToPath(import.meta.url));
var staticPath = join(__dirname, '..', '..', 'public');

// ── Cache salon lookups + rendered PNGs ──
var _salonCache = {};   // { CODE: { name, id, code, fetched } }
var _iconCache = {};    // { CODE: Buffer (PNG) }
var CACHE_TTL = 5 * 60 * 1000;

async function getSalonByCode(code) {
  var upper = (code || '').toUpperCase().trim();
  if (!upper) return null;
  var cached = _salonCache[upper];
  if (cached && Date.now() - cached.fetched < CACHE_TTL) return cached;
  try {
    var salon = await prisma.salon.findFirst({ where: { salon_code: upper } });
    if (!salon) return null;
    var entry = { name: salon.name, id: salon.id, code: upper, fetched: Date.now() };
    _salonCache[upper] = entry;
    return entry;
  } catch (e) {
    console.error('[TechPortal] Salon lookup failed:', e.message);
    return null;
  }
}

function getInitials(name) {
  if (!name) return 'ST';
  var words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function truncateName(name) {
  if (!name) return 'TECH';
  var upper = name.toUpperCase();
  return upper.length > 14 ? upper.substring(0, 13) + '\u2026' : upper;
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Generate SVG icon with salon initials ──
function generateIconSvg(salonName) {
  var initials = getInitials(salonName);
  var fs = initials.length <= 2 ? 72 : 56;
  var label = truncateName(salonName);
  var pillW = Math.max(80, Math.min(144, label.length * 10 + 24));
  var pillX = 96 - pillW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a2744"/><stop offset="100%" stop-color="#0d1829"/></linearGradient>
<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient>
<linearGradient id="in" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#1e3a5f"/><stop offset="100%" stop-color="#0f2440"/></linearGradient>
</defs>
<rect width="192" height="192" rx="40" fill="url(#bg)"/>
<circle cx="96" cy="88" r="58" fill="none" stroke="url(#rg)" stroke-width="2.5" opacity="0.8"/>
<circle cx="96" cy="88" r="48" fill="url(#in)"/>
<text x="96" y="92" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${fs}" font-weight="bold" fill="#93c5fd" letter-spacing="2">${esc(initials)}</text>
<rect x="${pillX}" y="158" width="${pillW}" height="22" rx="11" fill="#1e3a5f" opacity="0.9"/>
<text x="96" y="172" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="11" font-weight="bold" fill="#93c5fd" letter-spacing="0.5">${esc(label)}</text>
</svg>`;
}

// ── Convert SVG to PNG (cached) ──
async function getIconPng(salonName, code) {
  if (_iconCache[code]) return _iconCache[code];
  var svg = generateIconSvg(salonName);
  if (_sharp) {
    try {
      var buf = await _sharp(Buffer.from(svg)).resize(192, 192).png().toBuffer();
      _iconCache[code] = buf;
      return buf;
    } catch (e) {
      console.error('[TechPortal] Sharp PNG conversion failed:', e.message);
    }
  }
  return null; // fallback to SVG
}

function generateManifest(salonName, salonCode) {
  return JSON.stringify({
    name: salonName,
    short_name: salonName,
    start_url: '/tech/' + salonCode,
    display: 'standalone',
    background_color: '#0B1220',
    theme_color: '#0B1220',
    icons: [
      { src: '/tech-icon/' + salonCode + '.png', sizes: '192x192', type: 'image/png' }
    ]
  }, null, 2);
}

function generateTechHtml(salonName, salonCode) {
  var templatePath = join(staticPath, 'tech', 'index.html');
  var html = '';
  if (existsSync(templatePath)) {
    html = readFileSync(templatePath, 'utf8');
  } else {
    html = readFileSync(join(staticPath, 'index.html'), 'utf8');
  }
  html = html.replace(/href="\/tech-manifest\.json"/, 'href="/tech-manifest/' + salonCode + '"');
  html = html.replace(/href="\/manifest\.json"/, 'href="/tech-manifest/' + salonCode + '"');
  html = html.replace(/content="SalonTech"/, 'content="' + esc(salonName) + '"');
  html = html.replace(/content="SalonPOS"/, 'content="' + esc(salonName) + '"');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(salonName) + '</title>');
  html = html.replace(/href="\/icons\/icon-192\.png"/g, 'href="/tech-icon/' + salonCode + '.png"');
  return html;
}

export default function registerTechPortalRoutes(app) {

  app.get('/tech-manifest/:code', async function(req, res) {
    var salon = await getSalonByCode(req.params.code);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });
    res.set('Content-Type', 'application/manifest+json');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(generateManifest(salon.name, salon.code));
  });

  app.get('/tech-icon/:codeFile', async function(req, res) {
    var code = (req.params.codeFile || '').replace(/\.png$/i, '');
    var salon = await getSalonByCode(code);
    if (!salon) return res.status(404).send('Not found');

    var png = await getIconPng(salon.name, salon.code);
    if (png) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(png);
    } else {
      var svg = generateIconSvg(salon.name);
      res.set('Content-Type', 'image/svg+xml');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(svg);
    }
  });

  app.get('/tech/:code', async function(req, res) {
    var salon = await getSalonByCode(req.params.code);
    if (!salon) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      var fallback = join(staticPath, 'tech', 'index.html');
      if (existsSync(fallback)) return res.sendFile(fallback);
      return res.sendFile(join(staticPath, 'index.html'));
    }
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(generateTechHtml(salon.name, salon.code));
  });

  app.get('/tech', function(req, res) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    var fallback = join(staticPath, 'tech', 'index.html');
    if (existsSync(fallback)) return res.sendFile(fallback);
    res.sendFile(join(staticPath, 'index.html'));
  });
}
