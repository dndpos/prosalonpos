import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Messaging Templates
 * Session 8 Decision #182: Owner picks from pre-written templates or writes custom.
 * Template variables: {client_name}, {date}, {time}, {service}, {technician},
 *   {salon_name}, {total}, {deposit_amount}
 *
 * Renders in OwnerDashboard right panel as a tab of MessagingModule.
 */

import React, { useState, useEffect } from 'react';
import { MESSAGE_TYPE_META, PLACEHOLDERS, previewTemplate } from '../../lib/messagingService';
import { MSG_TYPE_COLORS, MOCK_TEMPLATES } from './messagingBridge';
import { useMessagingStore } from '../../lib/stores/messagingStore';
import { isProduction } from '../../lib/apiClient';


export default function MessagingTemplates() {
  var T = useTheme();
  var _isProd = isProduction();
  var storeTemplates = useMessagingStore(function(s) { return s.templates; });
  var fetchTemplates = useMessagingStore(function(s) { return s.fetchTemplates; });
  var [templates, setTemplates] = useState(_isProd ? [] : MOCK_TEMPLATES);

  // Fetch and sync in production
  useEffect(function() { if (_isProd) fetchTemplates(); }, []);
  useEffect(function() { if (_isProd && storeTemplates.length > 0) setTemplates(storeTemplates); }, [_isProd, storeTemplates]);
  var [editingId, setEditingId] = useState(null); // null = list view, 'new' = creating, id = editing
  var [filterType, setFilterType] = useState('all');

  var typeOptions = [{ key: 'all', label: 'All types' }];
  Object.keys(MESSAGE_TYPE_META).forEach(function(k) {
    typeOptions.push({ key: k, label: MESSAGE_TYPE_META[k].label });
  });

  var filtered = filterType === 'all' ? templates : templates.filter(function(t) { return t.type === filterType; });

  function handleSave(tpl) {
    if (tpl.id === 'new') {
      var newTpl = { ...tpl, id: 'tpl-' + Date.now() };
      setTemplates(function(prev) { return prev.concat([newTpl]); });
    } else {
      setTemplates(function(prev) { return prev.map(function(t) { return t.id === tpl.id ? tpl : t; }); });
    }
    setEditingId(null);
  }

  function handleDelete(id) {
    setTemplates(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
    setEditingId(null);
  }

  function handleToggleActive(id) {
    setTemplates(function(prev) {
      return prev.map(function(t) {
        return t.id === id ? { ...t, active: !t.active } : t;
      });
    });
  }

  // ── EDITOR VIEW ──
  if (editingId) {
    var existing = editingId === 'new' ? null : templates.find(function(t) { return t.id === editingId; });
    return (
      <TemplateEditor
        template={existing}
        onSave={handleSave}
        onDelete={existing ? function() { handleDelete(editingId); } : null}
        onCancel={function() { setEditingId(null); }}
      />
    );
  }

  // ── LIST VIEW ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: T.textMuted }}>{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
          {/* Filter by type */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {[{ key: 'all', label: 'All' }].concat(
              [{ key: 'booking_confirm', label: 'Confirmation' }, { key: 'reminder', label: 'Reminder' }, { key: 'promotional', label: 'Promo' }]
            ).map(function(opt) {
              var active = filterType === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={function() { setFilterType(opt.key); }}
                  onMouseEnter={function(e) { if (!active) { e.currentTarget.style.backgroundColor = '#3E4C5E'; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.textMuted; } }}
                  onMouseLeave={function(e) { if (!active) { e.currentTarget.style.backgroundColor = T.chrome; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: active ? T.primary : T.chrome,
                    color: active ? '#fff' : T.textMuted,
                    border: '1px solid ' + (active ? T.primary : T.border),
                    userSelect: 'none', transition: 'background-color 150ms, color 150ms',
                  }}
                >{opt.label}</div>
              );
            })}
          </div>
        </div>
        <div
          onClick={function() { setEditingId('new'); }}
          style={{ padding: '6px 14px', borderRadius: 6, backgroundColor: T.primary, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >+ New template</div>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No templates found</div>
      )}

      {filtered.map(function(tpl) {
        var meta = MESSAGE_TYPE_META[tpl.type] || {};
        var color = MSG_TYPE_COLORS[tpl.type] || T.textMuted;
        var placeholders = (tpl.content || '').match(/\{[^}]+\}/g) || [];

        return (
          <div
            key={tpl.id}
            style={{ padding: '14px 16px', backgroundColor: T.grid, borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background-color 150ms' }}
            onClick={function() { setEditingId(tpl.id); }}
            onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = '#3B4A63'; }}
            onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = T.grid; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{tpl.name}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{meta.label || tpl.type}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  onClick={function(e) { e.stopPropagation(); handleToggleActive(tpl.id); }}
                  style={{
                    fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                    color: tpl.active ? T.success : T.textMuted,
                    backgroundColor: tpl.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                  }}
                >{tpl.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div style={{ color: T.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{tpl.content}</div>
            {placeholders.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {placeholders.map(function(ph, i) {
                  return <span key={i} style={{ fontSize: 10, color: T.blueLight, backgroundColor: T.accentBg, padding: '2px 6px', borderRadius: 3 }}>{ph}</span>;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════
// TEMPLATE EDITOR
// ════════════════════════════════════════════

function TemplateEditor({ template, onSave, onDelete, onCancel }) {
  var T = useTheme();
  var isNew = !template;
  var [name, setName] = useState(template ? template.name : '');
  var [type, setType] = useState(template ? template.type : 'booking_confirm');
  var [content, setContent] = useState(template ? template.content : '');
  var [active, setActive] = useState(template ? template.active : true);
  var [showPreview, setShowPreview] = useState(false);

  function handleInsertPlaceholder(phKey) {
    setContent(function(prev) { return prev + phKey; });
  }

  function handleSave() {
    if (!name.trim() || !content.trim()) return;
    onSave({
      id: template ? template.id : 'new',
      name: name.trim(),
      type: type,
      content: content.trim(),
      active: active,
    });
  }

  var typeKeys = Object.keys(MESSAGE_TYPE_META);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          onClick={onCancel}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >← Back</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{isNew ? 'New template' : 'Edit template'}</span>
      </div>

      {/* Template name — using textarea workaround for kiosk, wrapped in styled div */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Template name</div>
        <textarea
          value={name}
          onChange={function(e) { setName(e.target.value); }}
          rows={1}
          style={{ width: '100%', height: 40, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '10px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          placeholder="e.g. Default confirmation"
        />
      </div>

      {/* Message type selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Message type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {typeKeys.map(function(k) {
            var meta = MESSAGE_TYPE_META[k];
            var isActive = type === k;
            var color = MSG_TYPE_COLORS[k] || T.textMuted;
            return (
              <div
                key={k}
                onClick={function() { setType(k); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
                  border: '1px solid ' + (isActive ? T.primary : T.border),
                  backgroundColor: isActive ? T.accentBg : T.chrome,
                  color: isActive ? T.text : T.textMuted,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                {meta.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message content */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Message content</div>
        <textarea
          value={content}
          onChange={function(e) { setContent(e.target.value); }}
          rows={4}
          style={{ width: '100%', minHeight: 100, backgroundColor: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, padding: '10px 14px', color: T.text, fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
          placeholder="Type your message here..."
        />
      </div>

      {/* Placeholder insertion buttons */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Insert placeholder</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PLACEHOLDERS.map(function(ph) {
            return (
              <div
                key={ph.key}
                onClick={function() { handleInsertPlaceholder(ph.key); }}
                style={{ padding: '4px 10px', borderRadius: 4, backgroundColor: T.accentBg, color: T.blueLight, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '1px solid '+T.accent+'33' }}
              >{ph.key}</div>
            );
          })}
        </div>
      </div>

      {/* Preview toggle */}
      <div
        onClick={function() { setShowPreview(!showPreview); }}
        style={{ fontSize: 12, color: T.primary, cursor: 'pointer', marginBottom: 8, fontWeight: 500 }}
      >{showPreview ? '▾ Hide preview' : '▸ Show preview with example data'}</div>

      {showPreview && (
        <div style={{ backgroundColor: T.grid, borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid ' + T.borderLight }}>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Preview (example values)</div>
          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>{previewTemplate(content)}</div>
        </div>
      )}

      {/* Active toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: T.grid, borderRadius: 6, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Active</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>Only active templates are used for sending</div>
        </div>
        <div
          onClick={function() { setActive(!active); }}
          style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: active ? '#22C55E' : T.grid, cursor: 'pointer', position: 'relative', transition: 'background-color 150ms', flexShrink: 0, border: '1px solid ' + (active ? '#22C55E' : T.border) }}
        >
          <div style={{ position: 'absolute', top: 2, left: active ? 22 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: 'left 150ms' }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={handleSave}
          style={{
            padding: '10px 24px', borderRadius: 6, backgroundColor: T.primary, color: '#fff',
            fontSize: 13, fontWeight: 500, cursor: (name.trim() && content.trim()) ? 'pointer' : 'default',
            opacity: (name.trim() && content.trim()) ? 1 : 0.5,
          }}
        >{isNew ? 'Create template' : 'Save changes'}</div>
        <div
          onClick={onCancel}
          style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid ' + T.border, backgroundColor: T.chrome, color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >Cancel</div>
        {onDelete && (
          <div
            onClick={onDelete}
            style={{ marginLeft: 'auto', padding: '10px 16px', borderRadius: 6, border: '1px solid ' + T.danger, backgroundColor: 'transparent', color: T.danger, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >Delete</div>
        )}
      </div>
    </div>
  );
}
