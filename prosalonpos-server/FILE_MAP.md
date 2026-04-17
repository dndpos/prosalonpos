# ProSalonPOS — File Map

**Last updated:** Session C91 (April 17, 2026)

---

## ⚠️ GOLDEN RULE — THIS FILE IS APPEND-ONLY ⚠️

**NEVER delete, replace, or summarize any existing section in this file.**

Every session adds a new CHANGED FILES section and updates the STATS and FILE SIZE ALERTS at the top. All prior session sections stay intact below, forever.

This file tracks every file touched in every session — what changed, how many lines, and why. It is the blast-radius record. If history gets removed, future sessions cannot trace regressions back to the session that introduced them.

---

## STATS (C91)

- **Total files:** 256 (station source + server source combined — unchanged)
- **Station JS/JSX files:** 207
- **Station total lines (actual C91 build):** ~54,812 (+13 from C90 CalendarDayView changes)

---

## FILE SIZE ALERTS (C91 — actual measured values)

- `useCalendarDrag.js` — **795 lines** (unchanged from C89). Very close to 800 cap. Extract before adding anything.
- `TabletCalendarView.jsx` — **793 lines** (unchanged from C89). Watch carefully. Split before next significant addition.
- `CalendarDayView.jsx` — **738 lines** (C90 added 13 lines for row-height zoom). Getting closer to 800 — watch.
- `VirtualKeyboard.jsx` — **252 lines** (unchanged from C89). Fine.

---

## KNOWN LATENT ISSUES

### Online booking page timezone (unchanged since first noted)
- `src/routes/public.js` lines 156 and 283

### PWA caching on tablet
- After every deploy: tablet users must fully close + reopen the PWA.
- If still stale: Settings → Apps → ProSalonPOS → Storage → Clear cache.
- **C91 hashes:** JS = `index-DgW1rQUi.js`, CSS = `index-jaZ6qTgx.css`
- **C89 hashes:** JS = `index-P2qGX24a.js`, CSS = `index-jaZ6qTgx.css`
- **C88 hashes:** JS = `index-BRdWyDvi.js`, CSS = `index-CRqiR-go.css`
- **C87 hashes:** JS = `index-Dar1a5Fj.js`, CSS = `index-CRqiR-go.css`

### Money-path double-tap protection — still deferred

### Static tech/index.html hash must be hand-updated after every build
- Vite writes fresh hashes into `dist/index.html` each build.
- Vite COPIES `public/tech/index.html` to `dist/tech/index.html` unchanged (it's a static copy).
- If `public/tech/index.html` has old hashes, it gets baked into the server zip with stale refs → tech phone gets 404 on JS asset.
- **Always verify BOTH `dist/index.html` AND `dist/tech/index.html` agree on hashes before zipping.**

---

## CHANGED FILES (C91)

### Station source changes
**None.** C91 is a build repair only. The C90 station source was correct — the previous session's build process produced a bad artifact. C91 rebuilds from the same source cleanly.

### C90 feature (carried in this build, code unchanged from uploaded zip)

| File | Lines (C90) | What Changed vs C89 |
|------|-------------|---------------------|
| `src/modules/appointments/CalendarDayView.jsx` | 738 | Added `rowH` state (default 20, range 12–40, step 4, localStorage persist). Added ▲/▼ zoom buttons in top nav right section. Local `var ROW_H = rowH` alias. **Station only — tablet unaffected.** |

### Server changes (C91)
**None.**

### Build assets (C91)
- JS: `index-DgW1rQUi.js` (was `index-CYFle5sE.js` on broken C90 Railway deploy; was `index-P2qGX24a.js` in C89)
- CSS: `index-jaZ6qTgx.css` (unchanged from C89)
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

### Database changes (C91)
**None.**

### tech/index.html note (C91)
The file had very stale hashes (`index-DOPdQa8j.js` / `index-Dl-D5agJ.css` — from before C87). Updated to current in C91. Going forward, always check this file after every build.

---

## CHANGED FILES (C89)

### Station changes (4 files)

| File | Lines Before | Lines After | What Changed |
|------|-------------|-------------|--------------|
| `src/lib/calendarHelpers.js` | ~79 | ~81 | ROW_H 28 → 20. Both time col and grid col use this constant — changing it keeps both in sync automatically. |
| `src/modules/appointments/calendarBridge.js` | ~243 | ~245 | buffer_minutes 30 → 0 in both `_defaultSettings` object AND the SETTINGS proxy getter. Grid now starts at exact salon open time. |
| `src/modules/tablet/TabletCalendarView.jsx` | 788 | 793 | T_ROW_H 36 → 26. Logo div moved BEFORE View Tickets (was after in C88). New order: ☰ → Logo → View Tickets → Checkout. |
| `src/components/ui/VirtualKeyboard.jsx` | ~234 | 252 | Samsung keyboard suppression: two-pass focusin (set inputMode=none + blur+refocus on first pass, show our keyboard on second pass). Restore on true focusout. |

### Server changes (C89)
**None.**

### Build assets (C89)
- JS: `index-P2qGX24a.js`
- CSS: `index-jaZ6qTgx.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

### Database changes (C89)
**None.**

---

## BEHAVIORAL CHAINS (C89)

### Calendar grid hours visible

**Station before C89:** ROW_H=28, buffer=30min. 9AM–7PM salon → grid 8:30AM–7:30PM = 11hrs = 44 rows × 28px = 1232px tall. Typical viewport ~700px → ~5 hours visible.

**Station after C89:** ROW_H=20, buffer=0. 9AM–7PM salon → grid 9AM–7PM = 10hrs = 40 rows × 20px = 800px tall. Typical viewport ~700px → ~8–9 hours visible.

**Tablet before C89:** T_ROW_H=36, buffer=30min. Same salon → 44 rows × 36px = 1584px. Tablet viewport ~900px → ~5 hours visible.

**Tablet after C89:** T_ROW_H=26, buffer=0. 40 rows × 26px = 1040px. Tablet viewport ~900px → ~8 hours visible.

### Samsung keyboard suppression flow (C89)

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

## CHANGED FILES (C88)

### Station changes (1 file)

| File | Lines Before | Lines After | What Changed |
|------|-------------|-------------|--------------|
| `src/modules/appointments/CalendarDayView.jsx` | 702 | 714 | Removed Owner button from top nav. Removed Clients from navtabs array (kept only View Tickets and Checkout). Removed Online Bookings button from top nav. Removed Appointment Log button from top nav. Removed `MiniMonth monthOffset={2}` from sidebar Cal tab. Added 4-button block below remaining 2 MiniMonths: Owner+Clients side-by-side (Row 1), Appointment Log full-width (Row 2), Online Bookings full-width (Row 3). Handlers identical to former top-nav versions. Uses `<button>` + `onClick` (station pattern). Net: +12 lines. |

### Tablet changes (1 file)

| File | Lines Before | Lines After | What Changed |
|------|-------------|-------------|--------------|
| `src/modules/tablet/TabletCalendarView.jsx` | 767 | 788 | Removed Owner from top nav. Removed Clients from navtabs array. Removed Online Bookings from top nav right side. Removed Appointment Log from top nav right side. Removed `MiniMonth monthOffset={2}` from sidebar. Added 4-button block using `<div {...tap(fn)}>` pattern (NOT plain onClick) — C79/C80/C81 tap-through shield compatibility. Added Pro Salon POS logo: `import prosalonLogo` at top, logo element placed after View Tickets/Checkout (C89 later moves it before them). Added `import prosalonLogo from '../../assets/prosalon-logo.png';`. Net: +21 lines. |

### Server changes (C88)
**None.**

### Build assets (C88)
- JS: `index-BRdWyDvi.js` (was `index-Dar1a5Fj.js` after C87)
- CSS: `index-CRqiR-go.css` (unchanged from C87)
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

### C88 nav button behavioral paths

**Owner button (sidebar row 1, left side):**
- Click → `onOwnerClick()` → (station: opens OwnerDashboard) / (tablet: opens SalonSettingsPanel per C78)

**Clients button (sidebar row 1, right side):**
- Click → `rbac.requirePermission(ACTIONS.VIEW_EDIT_CLIENTS, staff => onNavClick('clients', staff))` → PIN prompt if unauthorized → opens clients view

**Appointment Log (sidebar row 2):**
- Click → `setShowLogPopup(true)` → ActivityLogPopup opens (already rendered by CalendarOverlays)
- Badge: shows `activityLog.length` when > 0

**Online Bookings (sidebar row 3):**
- Click → `onNavClick('online-notifs')` → OnlineBookingsPopup opens
- Badge: shows `unviewedCount` when > 0

All 4 handlers identical to their former top-nav implementations. C88 is pure relocation.

---

## CHANGED FILES (C87)

### Station changes (1 file)

| File | Lines Before | Lines After | What Changed |
|------|-------------|-------------|--------------|
| `src/modules/appointments/useCalendarDrag.js` | 796 | 788 | **Removed all C86 scroll-lock machinery.** Deleted `scrollLockRef` declaration (~24 lines). Deleted scroll-capture in `activatePendingHold`. Deleted write-back in window touchmove handler. Deleted update in auto-scroll interval. Deleted clears in `handleDragEnd` and unmount. **Added C87 `originalOverflowRef` machinery.** New ref declaration (~23 lines). Capture `overflow` value + imperatively set `'hidden'` in `activatePendingHold`. Restore in `handleDragEnd`. Restore in unmount. 6 inline `PROTECTED C87:` markers. Net: −8 lines. |

### Server changes (C87)
**None.**

### Build assets (C87)
- JS: `index-Dar1a5Fj.js` (was `index-2yIQ8-_7.js` after C86)
- CSS: `index-CRqiR-go.css` (unchanged)
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

### C87 behavioral chain — tablet drag before vs after

**Before C87 (C86 broken behavior):**
```
T=activation: scrollLockRef captures grid scroll position.
T+1ms: finger moves. Android Chrome scrolls grid (drift).
T+2ms: grid 'scroll' event fires. syncScroll runs. Header jumps to new position.
T+3ms: our window touchmove handler fires. Writes scrollLockRef value BACK to scrollTop/scrollLeft.
T+4ms: grid 'scroll' event fires AGAIN (from the write-back). syncScroll runs AGAIN. Header jumps back.
Result: PING-PONG every touchmove. Header jerks left/right. Grid content jitters.
```

**After C87 (correct behavior):**
```
T=activation: originalOverflowRef = 'auto'. gridRef.style.overflow = 'hidden' (imperatively).
T+1ms: finger moves. Browser CANNOT scroll grid — overflow:hidden blocks user-driven scroll. No 'scroll' event fires.
T+2ms: our window touchmove handler fires. preventDefault only. No scroll manipulation.
T+3ms: handleDragMove runs. Preview follows finger. Clean.
Result: No header jerking. Grid stays put. Appointment follows finger.
```

**Drag-to-edge (still works after C87):**
```
Finger within 60px of edge → auto-scroll interval fires:
  gridRef.scrollTop += scrollDy  ← programmatic scroll, bypasses overflow:hidden
  gridRef.scrollLeft += scrollDx
  grid 'scroll' event fires (intentional) →
  syncScroll runs → headerRef.scrollLeft = grid.scrollLeft → header moves WITH intentional scroll ✅
```

---

## NEW CROSS-FILE DEPENDENCIES (C89)

None. All C89 changes are self-contained within their files.

### C88 new dependency
- `src/modules/tablet/TabletCalendarView.jsx` now imports `src/assets/prosalon-logo.png`. Asset already existed (used by CalendarDayView.jsx since before C86).

---

## FILES NOT TOUCHED (C89)

- Entire `prosalonpos-server/` — zero server changes.
- `src/modules/appointments/AppointmentBlocks.jsx` — byte-identical. Font sizes unchanged.
- `src/modules/appointments/CalendarDayView.jsx` — byte-identical. Picks up ROW_H=20 automatically via calendarHelpers import.
- `src/modules/appointments/useCalendarDrag.js` — byte-identical.
- `src/lib/hooks/useTabletTap.js` — unchanged.
- `App.jsx` — unchanged.
- All money-path files — zero touches.
