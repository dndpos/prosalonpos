import React, { useState, useRef } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { useClientStore } from '../../lib/stores/clientStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useGiftCardStore } from '../../lib/stores/giftCardStore';
import { useInventoryStore } from '../../lib/stores/inventoryStore';

/**
 * DataImportExport — Import / Export Salon Data
 * Right column in Salon Settings.
 * CSV-based import/export for Clients, Services, Categories, Gift Cards, Products.
 */

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(val) {
  if (val == null) return '';
  var s = String(val);
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(headers, rows) {
  var lines = [headers.map(escapeCSV).join(',')];
  rows.forEach(function(row) {
    lines.push(headers.map(function(h) { return escapeCSV(row[h]); }).join(','));
  });
  return lines.join('\n');
}

function parseCSV(text) {
  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (lines.length < 2) return { headers: [], rows: [] };
  // Simple CSV parse (handles quoted fields)
  function splitRow(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  }
  var headers = splitRow(lines[0]);
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = splitRow(lines[i]);
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function downloadCSV(filename, csvText) {
  var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Softcolor tones per data type ────────────────────────────────────────────

var DATA_TYPES = [
  { id: 'clients', label: 'Clients', icon: '👤', bg: '#0E3D3D', text: '#5EEAD4', border: '#1A5C5C' },
  { id: 'services', label: 'Services & Categories', icon: '✂️', bg: '#1E2554', text: '#A5B4FC', border: '#2E3A7A' },
  { id: 'giftcards', label: 'Gift Cards', icon: '🎁', bg: '#3D2608', text: '#FBB040', border: '#5C3A10' },
  { id: 'products', label: 'Products (Inventory)', icon: '📦', bg: '#0E2E1E', text: '#6EE7B7', border: '#1A4A30' },
];

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

export default function DataImportExport() {
  var T = useTheme();
  var fileRef = useRef(null);
  var [activeType, setActiveType] = useState(null);
  var [importMode, setImportMode] = useState(null); // null | 'preview'
  var [preview, setPreview] = useState(null); // { headers, rows, newCount, skipCount, type }
  var [importResult, setImportResult] = useState(null); // { added, skipped }
  var [exporting, setExporting] = useState(false);

  // Stores
  var clients = useClientStore(function(s) { return s.clients; });
  var createClient = useClientStore(function(s) { return s.createClient; });
  var services = useServiceStore(function(s) { return s.services; });
  var categories = useServiceStore(function(s) { return s.categories; });
  var createService = useServiceStore(function(s) { return s.createService; });
  var createCategory = useServiceStore(function(s) { return s.createCategory; });
  var fetchServices = useServiceStore(function(s) { return s.fetchServices; });
  var giftCards = useGiftCardStore(function(s) { return s.giftCards; });
  var createGiftCard = useGiftCardStore(function(s) { return s.createGiftCard; });
  var products = useInventoryStore(function(s) { return s.products; });

  // ── Export handlers ──

  function handleExport(type) {
    setExporting(true);
    var csv = '';
    var filename = '';

    if (type === 'clients') {
      var activeClients = clients.filter(function(c) { return c.active !== false; });
      var headers = ['first_name', 'last_name', 'phone', 'email', 'notes'];
      var rows = activeClients.map(function(c) {
        return { first_name: c.first_name || '', last_name: c.last_name || '', phone: c.phone || '', email: c.email || '', notes: c.notes || '' };
      });
      csv = toCSV(headers, rows);
      filename = 'clients_export.csv';
    }

    if (type === 'services') {
      var activeCats = categories.filter(function(c) { return c.active !== false; });
      var activeSvcs = services.filter(function(s) { return s.active !== false; });
      // Categories sheet
      var catHeaders = ['category_name', 'calendar_color'];
      var catRows = activeCats.map(function(c) {
        return { category_name: c.name || '', calendar_color: c.calendar_color || '' };
      });
      // Services sheet — combined into one CSV with category name
      var svcHeaders = ['service_name', 'price', 'duration_minutes', 'category'];
      var svcRows = activeSvcs.map(function(s) {
        var catName = '';
        if (s.category_ids && s.category_ids.length > 0) {
          var cat = activeCats.find(function(c) { return c.id === s.category_ids[0]; });
          if (cat) catName = cat.name;
        }
        return { service_name: s.name || '', price: ((s.price_cents || 0) / 100).toFixed(2), duration_minutes: s.default_duration_minutes || '', category: catName };
      });
      csv = '--- CATEGORIES ---\n' + toCSV(catHeaders, catRows) + '\n\n--- SERVICES ---\n' + toCSV(svcHeaders, svcRows);
      filename = 'services_export.csv';
    }

    if (type === 'giftcards') {
      var headers = ['code', 'type', 'initial_amount', 'balance', 'client_name', 'status', 'created_at'];
      var rows = giftCards.map(function(g) {
        return { code: g.code || '', type: g.type || '', initial_amount: ((g.initial_amount_cents || 0) / 100).toFixed(2), balance: ((g.balance_cents || 0) / 100).toFixed(2), client_name: g.client_name || '', status: g.status || '', created_at: g.created_at || '' };
      });
      csv = toCSV(headers, rows);
      filename = 'giftcards_export.csv';
    }

    if (type === 'products') {
      var prods = (products || []).filter(function(p) { return p.active !== false; });
      var headers = ['name', 'sku', 'price', 'cost', 'quantity', 'category', 'brand'];
      var rows = prods.map(function(p) {
        return { name: p.name || '', sku: p.sku || '', price: ((p.price_cents || 0) / 100).toFixed(2), cost: ((p.cost_cents || 0) / 100).toFixed(2), quantity: p.quantity || 0, category: p.category || '', brand: p.brand || '' };
      });
      csv = toCSV(headers, rows);
      filename = 'products_export.csv';
    }

    if (csv) downloadCSV(filename, csv);
    setExporting(false);
  }

  // ── Import handlers ──

  function handleFileSelect(type) {
    setActiveType(type);
    setImportResult(null);
    setPreview(null);
    fileRef.current.value = '';
    fileRef.current.click();
  }

  function handleFileChange(e) {
    var file = e.target.files[0];
    if (!file || !activeType) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = ev.target.result;
      var parsed = null;

      if (activeType === 'services') {
        // Split combined services CSV into categories + services
        var svcSection = text;
        if (text.indexOf('--- SERVICES ---') !== -1) {
          svcSection = text.split('--- SERVICES ---')[1] || '';
        }
        parsed = parseCSV(svcSection.trim());
      } else {
        parsed = parseCSV(text);
      }

      if (!parsed || parsed.rows.length === 0) {
        setPreview({ headers: [], rows: [], newCount: 0, skipCount: 0, type: activeType, error: 'No data rows found in the file.' });
        setImportMode('preview');
        return;
      }

      // Determine new vs existing
      var newCount = 0;
      var skipCount = 0;

      if (activeType === 'clients') {
        parsed.rows.forEach(function(row) {
          var phone = (row.phone || '').replace(/\D/g, '');
          var exists = phone && clients.some(function(c) { return (c.phone || '').replace(/\D/g, '') === phone; });
          if (exists) skipCount++;
          else newCount++;
        });
      } else if (activeType === 'services') {
        parsed.rows.forEach(function(row) {
          var name = (row.service_name || '').trim().toLowerCase();
          var exists = name && services.some(function(s) { return (s.name || '').toLowerCase() === name && s.active !== false; });
          if (exists) skipCount++;
          else newCount++;
        });
      } else if (activeType === 'giftcards') {
        parsed.rows.forEach(function(row) {
          var code = (row.code || '').trim();
          var exists = code && giftCards.some(function(g) { return g.code === code; });
          if (exists) skipCount++;
          else newCount++;
        });
      } else if (activeType === 'products') {
        parsed.rows.forEach(function(row) {
          var sku = (row.sku || '').trim();
          var exists = sku && (products || []).some(function(p) { return p.sku === sku && p.active !== false; });
          if (exists) skipCount++;
          else newCount++;
        });
      }

      setPreview({ headers: parsed.headers, rows: parsed.rows, newCount: newCount, skipCount: skipCount, type: activeType, error: null });
      setImportMode('preview');
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!preview || !preview.rows.length) return;
    var added = 0;
    var skipped = 0;

    try {

    if (preview.type === 'clients') {
      for (var ci = 0; ci < preview.rows.length; ci++) {
        var row = preview.rows[ci];
        var phone = (row.phone || '').replace(/\D/g, '');
        var exists = phone && clients.some(function(c) { return (c.phone || '').replace(/\D/g, '') === phone; });
        if (exists) { skipped++; continue; }
        await createClient({ first_name: row.first_name || '', last_name: row.last_name || '', phone: row.phone || '', email: row.email || '', notes: row.notes || '' });
        added++;
      }
    }

    if (preview.type === 'services') {
      // Step 1: Auto-create missing categories and wait for each one
      var existingCatNames = categories.filter(function(c) { return c.active !== false; }).map(function(c) { return (c.name || '').toLowerCase(); });
      var newCatNames = {};
      preview.rows.forEach(function(row) {
        var catName = (row.category || '').trim();
        if (catName && existingCatNames.indexOf(catName.toLowerCase()) === -1 && !newCatNames[catName.toLowerCase()]) {
          newCatNames[catName.toLowerCase()] = catName;
        }
      });

      // Create categories one at a time and collect them
      var createdCats = [];
      var catNameKeys = Object.keys(newCatNames);
      for (var cci = 0; cci < catNameKeys.length; cci++) {
        var newCat = await createCategory({ name: newCatNames[catNameKeys[cci]], calendar_color: '#8B5CF6' });
        if (newCat) createdCats.push(newCat);
      }

      // Step 2: Build fresh category lookup (existing + newly created)
      var allCats = categories.concat(createdCats);

      // Step 3: Create services with correct category IDs
      for (var si = 0; si < preview.rows.length; si++) {
        var srow = preview.rows[si];
        var sname = (srow.service_name || '').trim();
        var sexists = sname && services.some(function(s) { return (s.name || '').toLowerCase() === sname.toLowerCase() && s.active !== false; });
        if (sexists) { skipped++; continue; }
        var priceCents = Math.round(parseFloat(srow.price || 0) * 100);
        var dur = parseInt(srow.duration_minutes || 0) || 30;
        var catName = (srow.category || '').trim().toLowerCase();
        var matchCat = allCats.find(function(c) { return (c.name || '').toLowerCase() === catName && c.active !== false; });
        await createService({ name: sname, price_cents: priceCents, default_duration_minutes: dur, category_ids: matchCat ? [matchCat.id] : [] });
        added++;
      }
    }

    if (preview.type === 'giftcards') {
      for (var gi = 0; gi < preview.rows.length; gi++) {
        var grow = preview.rows[gi];
        var code = (grow.code || '').trim();
        var gexists = code && giftCards.some(function(g) { return g.code === code; });
        if (gexists) { skipped++; continue; }
        var initialCents = Math.round(parseFloat(grow.initial_amount || 0) * 100);
        var balanceCents = Math.round(parseFloat(grow.balance || 0) * 100);
        await createGiftCard({ code: code, type: grow.type || 'physical', initial_amount_cents: initialCents, balance_cents: balanceCents, client_name: grow.client_name || '', status: grow.status || 'active' });
        added++;
      }
    }

    if (preview.type === 'products') {
      for (var pi = 0; pi < preview.rows.length; pi++) {
        var prow = preview.rows[pi];
        var sku = (prow.sku || '').trim();
        var pexists = sku && (products || []).some(function(p) { return p.sku === sku && p.active !== false; });
        if (pexists) { skipped++; continue; }
        added++;
      }
    }

    } catch (importErr) {
      console.error('[Import] Error:', importErr);
      setImportResult({ added: added, skipped: skipped, error: importErr.message || 'Import failed partway through' });
      setImportMode(null);
      setPreview(null);
      return;
    }

    // Re-fetch stores so UI shows the new data immediately
    if (preview.type === 'services') fetchServices();

    setImportResult({ added: added, skipped: skipped });
    setImportMode(null);
    setPreview(null);
  }

  // ── Render ──

  return (
    <div>

      <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Success toast */}
      {importResult && (
        <div style={{ background: '#064E3B', border: '1px solid #166534', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: '#6EE7B7', fontWeight: 600, fontSize: 14 }}>Import complete!</span>
            <span style={{ color: '#A7F3D0', fontSize: 13, marginLeft: 10 }}>{importResult.added} added, {importResult.skipped} skipped (already exist)</span>
          </div>
          <div onClick={function() { setImportResult(null); }} style={{ color: '#6EE7B7', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</div>
        </div>
      )}

      {/* Import preview modal */}
      {importMode === 'preview' && preview && (
        <div style={{ background: T.surface, border: '1px solid ' + T.borderLight, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>Import Preview</div>
          {preview.error ? (
            <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 12 }}>{preview.error}</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8, lineHeight: 1.6 }}>
                Found <span style={{ color: '#5EEAD4', fontWeight: 600 }}>{preview.rows.length}</span> rows in the file.
                <span style={{ color: '#6EE7B7', fontWeight: 600 }}> {preview.newCount}</span> new records will be added.
                {preview.skipCount > 0 && <span><span style={{ color: '#FBB040', fontWeight: 600 }}> {preview.skipCount}</span> already exist and will be skipped.</span>}
              </div>
              {/* Preview table — show first 5 rows */}
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {preview.headers.map(function(h) {
                        return <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: T.textMuted, borderBottom: '1px solid ' + T.borderLight, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map(function(row, i) {
                      return (
                        <tr key={i}>
                          {preview.headers.map(function(h) {
                            return <td key={h} style={{ padding: '6px 10px', color: T.text, borderBottom: '1px solid ' + T.borderLight, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h] || ''}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {preview.rows.length > 5 && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>...and {preview.rows.length - 5} more rows</div>}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <div onClick={function() { setImportMode(null); setPreview(null); }}
              style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'transparent', border: '1px solid ' + T.borderLight, color: T.textMuted }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = T.text; e.currentTarget.style.color = T.text; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.color = T.textMuted; }}
            >Cancel</div>
            {preview.newCount > 0 && (
              <div onClick={handleConfirmImport}
                style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#0E3D3D', border: '1px solid #1A5C5C', color: '#5EEAD4' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 17px'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 18px'; }}
              >Save {preview.newCount} Records</div>
            )}
          </div>
        </div>
      )}

      {/* Data type cards */}
      {DATA_TYPES.map(function(dt) {
        var count = 0;
        if (dt.id === 'clients') count = clients.filter(function(c) { return c.active !== false; }).length;
        if (dt.id === 'services') count = services.filter(function(s) { return s.active !== false; }).length;
        if (dt.id === 'giftcards') count = giftCards.length;
        if (dt.id === 'products') count = (products || []).filter(function(p) { return p.active !== false; }).length;

        return (
          <div key={dt.id} style={{ background: T.surface, border: '1px solid ' + T.borderLight, borderRadius: 10, padding: '16px 20px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{dt.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{dt.label}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{count} records</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={function() { handleExport(dt.id); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', background: dt.bg, color: dt.text, border: '1px solid ' + dt.border }}
                onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '8px 0'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '9px 0'; }}
              >⬇ Export CSV</div>
              <div onClick={function() { handleFileSelect(dt.id); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', background: dt.bg, color: dt.text, border: '1px solid ' + dt.border }}
                onMouseEnter={function(e) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '8px 0'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '9px 0'; }}
              >⬆ Import CSV</div>
            </div>
          </div>
        );
      })}

      {/* Help text */}
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, marginTop: 12, padding: '0 4px' }}>
        <div style={{ fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Tips:</div>
        <div>• Export first to see the CSV format, then use the same columns for import</div>
        <div>• Clients are matched by phone number — duplicates are skipped</div>
        <div>• Services are matched by name — duplicates are skipped</div>
        <div>• Gift cards are matched by code — duplicates are skipped</div>
        <div>• Products are matched by SKU — duplicates are skipped</div>
        <div>• Importing services will auto-create any new categories found in the file</div>
      </div>
    </div>
  );
}
