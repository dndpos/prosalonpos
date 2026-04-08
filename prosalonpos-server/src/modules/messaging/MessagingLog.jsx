import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Message Log
 * Session 8 Decision #190: Full message log with filters.
 * Every message logged: type, channel, recipient, content, timestamp, delivery status.
 * Filters: message type, channel, status, recipient search.
 *
 * Renders in OwnerDashboard right panel as a tab of MessagingModule.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MESSAGE_TYPE_META } from '../../lib/messagingService';
import { MSG_TYPE_COLORS, STATUS_COLORS, MOCK_MESSAGE_LOG } from './messagingBridge';
import { useMessagingStore } from '../../lib/stores/messagingStore';
import { isProduction } from '../../lib/apiClient';


function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = d.getHours();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var min = d.getMinutes();
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
}

export default function MessagingLog() {
  var T = useTheme();
  var _isProd = isProduction();
  var storeLog = useMessagingStore(function(s) { return s.messageLog; });
  var fetchLog = useMessagingStore(function(s) { return s.fetchLog; });
  var log = _isProd ? storeLog : MOCK_MESSAGE_LOG;

  // Fetch in production
  useEffect(function() { if (_isProd) fetchLog(); }, []);
  var [filterType, setFilterType] = useState('all');
  var [filterChannel, setFilterChannel] = useState('all');
  var [filterStatus, setFilterStatus] = useState('all');
  var [searchText, setSearchText] = useState('');

  var filtered = useMemo(function() {
    var result = log;
    if (filterType !== 'all') {
      result = result.filter(function(m) { return m.type === filterType; });
    }
    if (filterChannel !== 'all') {
      result = result.filter(function(m) { return m.channel === filterChannel; });
    }
    if (filterStatus !== 'all') {
      result = result.filter(function(m) { return m.status === filterStatus; });
    }
    if (searchText.trim()) {
      var q = searchText.trim().toLowerCase();
      result = result.filter(function(m) {
        return (m.recipient || '').toLowerCase().indexOf(q) !== -1 ||
               (m.recipientContact || '').toLowerCase().indexOf(q) !== -1 ||
               (m.content || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return result;
  }, [log, filterType, filterChannel, filterStatus, searchText]);

  // ── Filter bar (softcolor pills) ──
  var PILL_COLORS = {
    all:             { bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
    booking_confirm: { bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' },
    reminder:        { bg:'#3D2608', text:'#FBB040', border:'#5C3A10' },
    cancel_confirm:  { bg:'#3D1030', text:'#F9A8D4', border:'#6B1A50' },
    noshow:          { bg:'#3B1010', text:'#FCA5A5', border:'#6B1A1A' },
    receipt:         { bg:'#0E2E1E', text:'#6EE7B7', border:'#1A4A30' },
    promotional:     { bg:'#2E1042', text:'#C4B5FD', border:'#4A1A6A' },
    sms:             { bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
    email:           { bg:'#1E2554', text:'#A5B4FC', border:'#2E3A7A' },
    delivered:       { bg:'#0E2E1E', text:'#6EE7B7', border:'#1A4A30' },
    sent:            { bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
    failed:          { bg:'#3B1010', text:'#FCA5A5', border:'#6B1A1A' },
    bounced:         { bg:'#3D2608', text:'#FBB040', border:'#5C3A10' },
  };
  var PILL_DEFAULT = { bg:'#182A3A', text:'#7EB8DC', border:'#264460' };

  function FilterPills({ label, value, onChange, options }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: T.textMuted, minWidth: 52, fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {options.map(function(opt) {
            var active = value === opt.key;
            var pc = PILL_COLORS[opt.key] || PILL_DEFAULT;
            return (
              <div
                key={opt.key}
                onClick={function() { onChange(opt.key); }}
                onMouseEnter={function(e) { if (!active) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '6px 13px'; } }}
                onMouseLeave={function(e) { if (!active) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '7px 14px'; } }}
                style={{
                  padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  backgroundColor: pc.bg,
                  color: pc.text,
                  border: (active ? '2px' : '1px') + ' solid ' + pc.border,
                  userSelect: 'none', whiteSpace: 'nowrap',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >{opt.label}</div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: 10 }}>
        <textarea
          value={searchText}
          onChange={function(e) { setSearchText(e.target.value); }}
          rows={1}
          placeholder="Search recipient or message content..."
          style={{
            width: '100%', height: 36, backgroundColor: T.chrome, border: '1px solid ' + T.border,
            borderRadius: 6, padding: '8px 14px', color: T.text, fontSize: 13,
            fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <FilterPills
          label="Type"
          value={filterType}
          onChange={setFilterType}
          options={[
            { key: 'all', label: 'All' },
            { key: 'booking_confirm', label: 'Confirmation' },
            { key: 'reminder', label: 'Reminder' },
            { key: 'cancel_confirm', label: 'Cancellation' },
            { key: 'noshow', label: 'No-show' },
            { key: 'receipt', label: 'Receipt' },
            { key: 'promotional', label: 'Promo' },
          ]}
        />
        <FilterPills
          label="Channel"
          value={filterChannel}
          onChange={setFilterChannel}
          options={[
            { key: 'all', label: 'All' },
            { key: 'sms', label: 'SMS' },
            { key: 'email', label: 'Email' },
          ]}
        />
        <FilterPills
          label="Status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { key: 'all', label: 'All' },
            { key: 'delivered', label: 'Delivered' },
            { key: 'sent', label: 'Sent' },
            { key: 'failed', label: 'Failed' },
            { key: 'bounced', label: 'Bounced' },
          ]}
        />
      </div>

      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{filtered.length} message{filtered.length !== 1 ? 's' : ''}</div>

      {/* Message rows */}
      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No messages match your filters</div>
      )}

      {filtered.map(function(msg) {
        var typeColor = MSG_TYPE_COLORS[msg.type] || T.textMuted;
        var statusColor = STATUS_COLORS[msg.status] || T.textMuted;
        var meta = MESSAGE_TYPE_META[msg.type] || {};
        var isSms = msg.channel === 'sms';

        return (
          <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', backgroundColor: T.grid, borderRadius: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: typeColor, flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{msg.recipient}</span>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 500,
                  color: isSms ? T.blueLight : '#22C55E',
                  backgroundColor: isSms ? T.accentBg : 'rgba(34,197,94,0.15)',
                }}>{isSms ? 'SMS' : 'Email'}</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>{meta.label || msg.type}</span>
              </div>
              <div style={{ color: T.textMuted, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3 }}>{msg.content}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: statusColor, textTransform: 'capitalize' }}>{msg.status}</span>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap' }}>{formatDate(msg.sent_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
