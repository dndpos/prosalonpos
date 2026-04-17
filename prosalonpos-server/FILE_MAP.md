# ProSalonPOS — File Map (C89 Updates)

**Last updated:** Session C89 (April 17, 2026)

---

## STATS UPDATE

- **Total files:** 256 (unchanged — no new files, no deletions)
- **Total lines:** ~66,570 (net +30 from C88 baseline of ~66,540)
  - C89: +18 in VirtualKeyboard.jsx, +8 in TabletCalendarView.jsx (logo reposition), +2 in calendarHelpers.js, +2 in calendarBridge.js

---

## FILE SIZE ALERTS

- `useCalendarDrag.js` — **788 lines**. Near cap. Extract before adding.
- `TabletCalendarView.jsx` — **~796 lines** after C89 (+8). Very close to cap — split before next addition.
- `CalendarDayView.jsx` — **714 lines**. Comfortable.
- `VirtualKeyboard.jsx` — **~238 lines** after C89 (+18). Fine.

---

## KNOWN LATENT ISSUES

### Online booking page timezone (unchanged)
- `src/routes/public.js` lines 156 and 283

### PWA caching on tablet (unchanged)
- JS hash `index-P2qGX24a.js` this build. CSS `index-jaZ6qTgx.css`. Close + reopen app after deploy; if stale, clear app cache.

### Money-path double-tap protection — still deferred

### Static tech/index.html hash must be hand-updated after every build
- C89: both JS and CSS hashes changed. Update `<script>` in `public/tech/index.html` → copy to `dist/tech/` → bake into `server/public/`.
- Vite regenerates hashes each build (timestamp-seeded). Always check actual dist/assets/ output.

---

## CHANGED FILES (C90)

### Station changes (1 file)

| File | Lines Before | Lines After | What Changed |
|------|-------------|-------------|--------------|
| `src/modules/appointments/CalendarDayView.jsx` | 725 | 738 | Added rowH state (default 20, min 12, max 40, step 4) persisted to localStorage. ROW_H import aliased as DEFAULT_ROW_H; var ROW_H = rowH declared in component body so all existing grid code uses live value. ▲ {rowH} ▼ buttons added to top nav right side after column +/- group. saveRowH() wrapper clamps and persists. Zero changes to any other file. |

### Server changes (C90)
**None.**

### Build assets (C90)
- JS: `index-DOPdQa8j.js`
- CSS: `index-Dl-D5agJ.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

### Database changes (C90)
**None.**

---

## CHANGED FILES (C89)

| File | Change | What |
|------|--------|------|
| `src/lib/calendarHelpers.js` | ROW_H 28 → 20 | More hours visible on screen. Both time col and grid col use this same constant — alignment stays perfect automatically. |
| `src/modules/appointments/calendarBridge.js` | buffer_minutes 30 → 0 (default + proxy getter) | Grid starts at exact open time, ends at exact close time. No padding. |
| `src/modules/tablet/TabletCalendarView.jsx` | T_ROW_H 36 → 26; logo moved left of View Tickets | More hours on tablet. Logo now: ☰ → Logo → View Tickets → Checkout. |
| `src/components/ui/VirtualKeyboard.jsx` | Samsung keyboard suppression via inputMode=none + blur/refocus | On first focusin: set inputMode=none, blur, refocus. OS never shows its keyboard. On true focusout: restore original inputMode. |

### Server changes (C89)
**None.**

---

## BUILD ASSETS (C89)

- JS: `index-P2qGX24a.js`
- CSS: `index-jaZ6qTgx.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

---

## DATABASE CHANGES (C89)

**None.**

---

## LOCALSTORAGE KEYS

Unchanged from C88.

---

## NEW CROSS-FILE DEPENDENCIES (C89)

None. All changes are self-contained within their files.

---

## BEHAVIORAL CHAINS (C89)

### Calendar grid hours visible

**Station before C89:** ROW_H=28, buffer=30min. 9AM–7PM salon → grid 8:30AM–7:30PM = 11hrs = 44 rows × 28px = 1232px tall. Typical viewport ~700px → ~5 hours visible.

**Station after C89:** ROW_H=20, buffer=0. 9AM–7PM salon → grid 9AM–7PM = 10hrs = 40 rows × 20px = 800px tall. Typical viewport ~700px → ~8-9 hours visible.

**Tablet before C89:** T_ROW_H=36, buffer=30min. Same salon → 44 rows × 36px = 1584px. Tablet viewport ~900px → ~5 hours visible.

**Tablet after C89:** T_ROW_H=26, buffer=0. 40 rows × 26px = 1040px. Tablet viewport ~900px → ~8 hours visible.

### Samsung keyboard suppression flow

```
User taps <input> →
  focusin fires (first pass) →
  kbCaptured not set →
  set inputMode='none', store origInputMode, set kbCaptured='true' →
  blur() →
  setTimeout 0ms: refocus() →

  focusin fires (second pass) →
  kbCaptured IS set →
  set activeRef, setVisible(true) →
  Our black VirtualKeyboard appears →
  Samsung OS never showed its keyboard (saw inputMode='none' before focus committed)

User taps away (not to keyboard button) →
  focusout fires →
  100ms delay →
  active element is not INPUT/TEXTAREA and not inside kbRef →
  restore origInputMode, delete kbCaptured →
  setVisible(false)
```

---

## FILES NOT TOUCHED (C89)

- Entire `prosalonpos-server/` — zero server changes.
- `src/modules/appointments/AppointmentBlocks.jsx` — byte-identical. Font sizes unchanged.
- `src/modules/appointments/CalendarDayView.jsx` — byte-identical. Uses ROW_H from calendarHelpers (picks up change automatically).
- `src/modules/appointments/useCalendarDrag.js` — byte-identical.
- `src/lib/hooks/useTabletTap.js` — unchanged.
- `App.jsx` — unchanged.
- All money-path files — zero touches.

---

## SUMMARY

**C89 = 4-file fix.** No server/DB changes. No new files. Net ~+30 lines.

1. `calendarHelpers.js` — ROW_H 28→20
2. `calendarBridge.js` — buffer 30→0
3. `TabletCalendarView.jsx` — T_ROW_H 36→26, logo left of View Tickets
4. `VirtualKeyboard.jsx` — Samsung keyboard suppression
