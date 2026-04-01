import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Client Notes
 * Session 7 Decision #171: Timestamped note history
 * - Add new note (auto-stamps date + staff name)
 * - Most recent first
 * - Staff cannot edit after saving
 * - Owner/manager can delete
 */
import { useState } from 'react';


function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ClientNotes({ notes = [], onAddNote, onDeleteNote }) {
  var C = useTheme();
  var [newText, setNewText] = useState('');
  var [confirmDelete, setConfirmDelete] = useState(null);

  function handleAdd() {
    if (!newText.trim()) return;
    if (onAddNote) onAddNote(newText.trim());
    setNewText('');
  }

  function handleDelete(noteId) {
    if (onDeleteNote) onDeleteNote(noteId);
    setConfirmDelete(null);
  }

  // Auto-capitalize first letter
  function handleChange(e) {
    var v = e.target.value;
    if (v.length === 1) v = v.toUpperCase();
    setNewText(v);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: C.textPrimary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, padding: '0 4px' }}>Notes</div>

      {/* Add note */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <textarea
          value={newText}
          onChange={handleChange}
          placeholder="Add a note..."
          rows={2}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="sentences"
          onFocus={function(e) { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
          style={{
            flex: 1, background: C.inputBg, border: '1px solid ' + C.inputBorder, borderRadius: 6,
            padding: '10px 14px', color: C.textPrimary, fontSize: 14, fontFamily: 'inherit',
            outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          style={{
            height: 44, padding: '0 16px', alignSelf: 'flex-end',
            background: newText.trim() ? C.blue : C.grid, color: newText.trim() ? '#fff' : C.textMuted,
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
            cursor: newText.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0,
          }}
        >Add</button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div style={{ padding: '20px 14px', background: C.chromeDark, borderRadius: 8, color: C.textMuted, fontSize: 13, textAlign: 'center' }}>
          No notes yet — add the first note above
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notes.map(function(note) {
            return (
              <div key={note.id} style={{ padding: '12px 14px', background: C.chromeDark, borderRadius: 8, border: '1px solid ' + C.borderLight }}>
                <div style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: C.textMuted, fontSize: 11 }}>
                    {note.staff_name} · {formatDate(note.created_at)}
                  </div>
                  {onDeleteNote && (
                    confirmDelete === note.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={function() { handleDelete(note.id); }} style={{ background: C.danger, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                        <button onClick={function() { setConfirmDelete(null); }} style={{ background: C.grid, color: C.textPrimary, border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={function() { setConfirmDelete(note.id); }}
                        style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}
                        onMouseEnter={function(e) { e.currentTarget.style.color = C.danger; }}
                        onMouseLeave={function(e) { e.currentTarget.style.color = C.textMuted; }}
                      >Delete</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
