import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Promotional Blasts
 * Session 8 Decisions #188, #189
 * 6 blast filters: all clients, last visit date, service type, birthday month,
 *   membership status (grayed out), loyalty tier (grayed out).
 * Multiple filters combinable (AND logic).
 *
 * Renders in OwnerDashboard right panel as a tab of MessagingModule.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { evaluateBlastFilters, sendBlast, PLACEHOLDERS } from '../../lib/messagingService';
import { MOCK_BLASTS, MOCK_TEMPLATES, MONTH_NAMES, STATUS_COLORS } from './messagingBridge';
import { useMessagingStore } from '../../lib/stores/messagingStore';
import { isProduction } from '../../lib/apiClient';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useClientStore } from '../../lib/stores/clientStore';


function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export default function MessagingBlasts({ settings }) {
  var T = useTheme();
  var _isProd = isProduction();
  var MOCK_CLIENTS = useClientStore(function(s) { return s.clients; });
  var MOCK_SERVICES = useServiceStore(function(s) { return s.services; });
  var storeTemplates = useMessagingStore(function(s) { return s.templates; });
  var fetchTemplates = useMessagingStore(function(s) { return s.fetchTemplates; });
  var [blasts, setBlasts] = useState(_isProd ? [] : MOCK_BLASTS);
  var [selectedBlast, setSelectedBlast] = useState(null);
  var [creating, setCreating] = useState(false);

  // ── BLAST DETAIL ──
  if (selectedBlast) {
    var b = selectedBlast;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            onClick={function() { setSelectedBlast(null); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >← Back</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Blast detail</span>
        </div>

        <div style={{ fontSize: 16, fontWeight: 500, color: T.text, marginBottom: 4 }}>{b.name}</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>Sent {formatDate(b.sent_at)}</div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Recipients', value: b.recipients, color: T.text },
            { label: 'Delivered', value: b.delivered, color: T.success },
            { label: 'Failed', value: b.failed, color: b.failed > 0 ? T.danger : T.textMuted },
          ].map(function(s) {
            return (
              <div key={s.label} style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: s.color }}>{s.value}</div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Message content</div>
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: 16, color: T.text, fontSize: 14, lineHeight: 1.6 }}>{b.template}</div>
      </div>
    );
  }

  // ── BLAST CREATION ──
  if (creating) {
    return (
      <BlastCreator
        settings={settings}
        onSend={function(blastRecord) {
          setBlasts(function(prev) { return [blastRecord].concat(prev); });
          setCreating(false);
        }}
        onCancel={function() { setCreating(false); }}
      />
    );
  }

  // ── BLAST LIST ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: T.textMuted }}>{blasts.length} blast{blasts.length !== 1 ? 's' : ''} sent</span>
        <div
          onClick={function() { setCreating(true); }}
          style={{ padding: '6px 14px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >+ New blast</div>
      </div>

      {blasts.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No blasts sent yet</div>
      )}

      {blasts.map(function(b) {
        return (
          <div
            key={b.id}
            onClick={function() { setSelectedBlast(b); }}
            style={{ padding: '14px 16px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3B4A63'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{b.name}</span>
              <span style={{ fontSize: 12, color: T.textMuted }}>{formatDate(b.sent_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.template}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: T.textSecondary }}>Recipients: {b.recipients}</span>
              <span style={{ color: T.success }}>Delivered: {b.delivered}</span>
              {b.failed > 0 && <span style={{ color: T.danger }}>Failed: {b.failed}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════
// BLAST CREATOR
// ════════════════════════════════════════════

function BlastCreator({ settings, onSend, onCancel }) {
  var T = useTheme();
  var [name, setName] = useState('');
  var [messageContent, setMessageContent] = useState('');
  var [selectedTemplate, setSelectedTemplate] = useState(null);
  var [showTemplates, setShowTemplates] = useState(false);

  // Filters state
  var [filterLastVisitEnabled, setFilterLastVisitEnabled] = useState(false);
  var [filterLastVisitDays, setFilterLastVisitDays] = useState(30);
  var [filterServiceEnabled, setFilterServiceEnabled] = useState(false);
  var [filterServiceId, setFilterServiceId] = useState(null);
  var [filterBirthdayEnabled, setFilterBirthdayEnabled] = useState(false);
  var [filterBirthdayMonth, setFilterBirthdayMonth] = useState(new Date().getMonth() + 1);

  var promoTemplates = (_isProd ? storeTemplates : MOCK_TEMPLATES).filter(function(t) { return t.type === 'promotional' && t.active; });

  // Build filter object
  var filters = {};
  if (filterLastVisitEnabled) filters.lastVisitDaysAgo = filterLastVisitDays;
  if (filterServiceEnabled && filterServiceId) filters.serviceId = filterServiceId;
  if (filterBirthdayEnabled) filters.birthdayMonth = filterBirthdayMonth;

  var recipientCount = useMemo(function() {
    return evaluateBlastFilters(MOCK_CLIENTS, filters).length;
  }, [filterLastVisitEnabled, filterLastVisitDays, filterServiceEnabled, filterServiceId, filterBirthdayEnabled, filterBirthdayMonth]);

  function handleSelectTemplate(tpl) {
    setSelectedTemplate(tpl);
    setMessageContent(tpl.content);
    setShowTemplates(false);
  }

  function handleInsertPlaceholder(phKey) {
    setMessageContent(function(prev) { return prev + phKey; });
  }

  function handleSend() {
    if (!name.trim() || !messageContent.trim() || recipientCount === 0) return;
    var recipients = evaluateBlastFilters(MOCK_CLIENTS, filters);
    var result = sendBlast(name.trim(), messageContent.trim(), recipients, settings);
    onSend(result.blastRecord);
  }

  function FilterToggle({ label, desc, enabled, onChange }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>
          {desc && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{desc}</div>}
        </div>
        <div
          onClick={function() { onChange(!enabled); }}
          style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: enabled ? T.primary : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (enabled ? T.primary : T.border) }}
        >
          <div style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', transition: 'left 150ms' }} />
        </div>
      </div>
    );
  }

  function DisabledFilter({ label, reason }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', opacity: 0.4 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>
          <div style={{ fontSize: 11, color: T.warning, marginTop: 1 }}>{reason}</div>
        </div>
        <div style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: T.grid, border: '1px solid ' + T.border, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: T.textMuted }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div onClick={onCancel} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>New blast</span>
      </div>

      {/* Blast name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Blast name</div>
        <textarea
          value={name}
          onChange={function(e) { setName(e.target.value); }}
          rows={1}
          placeholder="e.g. Spring color special"
          style={{ width: '100%', height: 40, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '10px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Template picker or custom message */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: T.textMuted }}>Message content</div>
          <div onClick={function() { setShowTemplates(!showTemplates); }} style={{ fontSize: 11, color: T.primary, cursor: 'pointer', fontWeight: 500 }}>
            {showTemplates ? '▾ Hide templates' : '▸ Pick template'}
          </div>
        </div>

        {showTemplates && (
          <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: 10, marginBottom: 8, maxHeight: 200, overflow: 'auto' }}>
            {promoTemplates.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: 8 }}>No active promo templates</div>}
            {promoTemplates.map(function(tpl) {
              return (
                <div
                  key={tpl.id}
                  onClick={function() { handleSelectTemplate(tpl); }}
                  style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 2, fontSize: 13, color: T.text, transition: 'background-color 150ms' }}
                  onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3B4A63'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{tpl.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{tpl.content}</div>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          value={messageContent}
          onChange={function(e) { setMessageContent(e.target.value); }}
          rows={3}
          placeholder="Type or pick a template..."
          style={{ width: '100%', minHeight: 80, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '10px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {PLACEHOLDERS.filter(function(p) { return p.key === '{client_name}' || p.key === '{salon_name}'; }).map(function(ph) {
            return (
              <div key={ph.key} onClick={function() { handleInsertPlaceholder(ph.key); }} style={{ padding: '3px 8px', borderRadius: 4, backgroundColor: T.accentBg, color: T.blueLight, fontSize: 10, fontWeight: 500, cursor: 'pointer', border: '1px solid '+T.accent+'33' }}>{ph.key}</div>
            );
          })}
        </div>
      </div>

      {/* ── AUDIENCE FILTERS (Decision #189) ── */}
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8, marginTop: 16 }}>Audience filters</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Combine filters to narrow your audience. Clients who opted out are automatically excluded.</div>

      <div style={{ backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 8, padding: '6px 14px', marginBottom: 10 }}>
        {/* Filter 1: Last visit */}
        <FilterToggle label="Last visit date" desc="Clients who haven't visited recently" enabled={filterLastVisitEnabled} onChange={setFilterLastVisitEnabled} />
        {filterLastVisitEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, paddingLeft: 4 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Not visited in</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[30, 60, 90, 180].map(function(d) {
                var active = filterLastVisitDays === d;
                return (
                  <div key={d} onClick={function() { setFilterLastVisitDays(d); }}
                    onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                    onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      backgroundColor: active ? T.primary : T.chrome, color: active ? '#fff' : T.textMuted,
                      border: '1px solid ' + (active ? T.primary : T.border),
                      userSelect: 'none', transition: 'background-color 150ms, color 150ms',
                    }}>{d}+ days</div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid ' + T.border }} />

        {/* Filter 2: Service type */}
        <FilterToggle label="Service type" desc="Clients who have had a specific service" enabled={filterServiceEnabled} onChange={setFilterServiceEnabled} />
        {filterServiceEnabled && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 10, paddingLeft: 4 }}>
            {MOCK_SERVICES.filter(function(s) { return s.active; }).map(function(svc) {
              var active = filterServiceId === svc.id;
              return (
                <div key={svc.id} onClick={function() { setFilterServiceId(svc.id); }}
                  onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                  onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.grid; e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.border; } }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: active ? T.primary : T.grid, color: active ? '#fff' : T.textSecondary,
                    border: '1px solid ' + (active ? T.primary : T.border), userSelect: 'none',
                    transition: 'background-color 150ms, color 150ms',
                  }}>{svc.name}</div>
              );
            })}
          </div>
        )}

        <div style={{ borderTop: '1px solid ' + T.border }} />

        {/* Filter 3: Birthday month */}
        <FilterToggle label="Birthday month" desc="Clients with birthdays in a specific month" enabled={filterBirthdayEnabled} onChange={setFilterBirthdayEnabled} />
        {filterBirthdayEnabled && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 10, paddingLeft: 4 }}>
            {MONTH_NAMES.map(function(name, i) {
              var month = i + 1;
              var active = filterBirthdayMonth === month;
              return (
                <div key={month} onClick={function() { setFilterBirthdayMonth(month); }}
                  onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                  onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.grid; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: active ? T.primary : T.grid, color: active ? '#fff' : T.textMuted,
                    border: '1px solid ' + (active ? T.primary : T.border), userSelect: 'none',
                    transition: 'background-color 150ms, color 150ms',
                  }}>{name.slice(0, 3)}</div>
              );
            })}
          </div>
        )}

        <div style={{ borderTop: '1px solid ' + T.border }} />

        {/* Filter 4: Membership status — GRAYED OUT */}
        <DisabledFilter label="Membership status" reason="Coming soon — Module 9" />

        <div style={{ borderTop: '1px solid ' + T.border }} />

        {/* Filter 5: Loyalty tier — GRAYED OUT */}
        <DisabledFilter label="Loyalty tier" reason="Coming soon — Module 8" />
      </div>

      {/* Recipient count preview */}
      <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Estimated recipients</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Excludes opted-out clients</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: recipientCount > 0 ? T.primary : T.textMuted }}>{recipientCount}</div>
      </div>

      {/* Send */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={handleSend}
          style={{
            padding: '10px 24px', borderRadius: 6, backgroundColor: T.primary, color: '#fff',
            fontSize: 13, fontWeight: 500,
            cursor: (name.trim() && messageContent.trim() && recipientCount > 0) ? 'pointer' : 'default',
            opacity: (name.trim() && messageContent.trim() && recipientCount > 0) ? 1 : 0.5,
          }}
        >Send now</div>
        <div onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</div>
      </div>
    </div>
  );
}
