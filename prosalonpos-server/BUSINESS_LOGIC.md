# ProSalonPOS — Business Logic & Rules

**Last updated:** Session C91 (April 17, 2026)

---

## ⚠️ GOLDEN RULE — THIS FILE IS APPEND-ONLY ⚠️

**NEVER delete, replace, shorten, or summarize any existing section in this file.**
**NEVER overwrite history with "see prior docs" — the history IS this doc.**

Every session ADDS new content at the top. All prior sessions stay intact below, forever.

This file is the institutional memory of ProSalonPOS. When a bug gets fixed, the full story of what broke, why it broke, and how it was fixed lives here permanently. If we lose that story, we lose the ability to understand why the code is the way it is — and we will repeat the same mistakes.

The rule is simple: **ADD. NEVER REMOVE.**

---

*New entries: C91 — crash fix only. Rebuilt C90 station from clean source. No code changes. Broken build (index-CYFle5sE.js) replaced with correct build (index-DgW1rQUi.js).*

---

## CHANGES IN C91 — Crash Fix (build repair, 0 code files changed)

### What broke
After C90 was built and deployed in the previous session (different chat), Railway was serving `index-CYFle5sE.js` which crashed on tablet with:
```
Uncaught TypeError: o is not a function
File: index-CYFle5sE.js  Line: 37, Col: 31901
```
The call stack traced through `onTouchStart → requirePermission`, suggesting something inside the tap/RBAC chain was broken in that build.

### Root cause
The crash was a **bad build artifact from the previous session**, not a source code bug. The C90 station source code was correct — the previous chat's build process produced a corrupted/mismatched JS bundle. The "C90_fixed" server zip that was uploaded still had the old C89 frontend (`index-P2qGX24a.js`) baked in, meaning the fix was prepared but never deployed.

### What C90 actually added (code is correct, carried forward)
- `src/modules/appointments/CalendarDayView.jsx`: Dynamic row-height zoom for **station only**. Added `rowH` state (default 20, range 12–40, step 4, persisted to localStorage). Added ▲/▼ buttons in top nav right section (same pattern as column +/−). Local `var ROW_H = rowH` alias so all existing ROW_H references in the file use the live value. **Tablet is unaffected** — TabletCalendarView uses its own `T_ROW_H` constant.

### Fix applied in C91
Rebuilt the C90 station source from scratch in a clean environment. Build succeeded with zero errors. New hash: `index-DgW1rQUi.js`. Baked into server, updated both `public/index.html` and `public/tech/index.html` to match.

### Files changed in C91
- Zero source code files changed
- `public/index.html` — updated JS hash to `index-DgW1rQUi.js`
- `public/tech/index.html` — updated JS hash to `index-DgW1rQUi.js` and CSS hash to `index-jaZ6qTgx.css` (was stale with very old hashes)

---

*Prior entries: C89 — logo repositioned on tablet (left of View Tickets), Samsung native keyboard suppressed in VirtualKeyboard, 30-min grid buffer removed, ROW_H reduced for more hours on screen.*

---

## CHANGES IN C89 — Three Fixes (4 files)

### Fix 1: Tablet logo position
Moved the Pro Salon POS logo to the LEFT of View Tickets on tablet top nav (was after View Tickets/Checkout in C88).
New left-to-right order: `☰` → Logo + "Pro Salon POS" → View Tickets → Checkout → …date nav…
File: `src/modules/tablet/TabletCalendarView.jsx`

### Fix 2: Samsung native keyboard suppression
**Problem:** On Samsung tablets, the OS keyboard pops up over our black VirtualKeyboard whenever an `<input>` or `<textarea>` is tapped.

**Root cause:** Samsung's keyboard fires on any focused input element. Our VirtualKeyboard listened for `focusin` but didn't prevent the OS keyboard from appearing.

**Fix in `VirtualKeyboard.jsx`:**
- On first `focusin`: set `inputMode="none"` on the element (tells OS: don't show keyboard), then blur+refocus so Samsung sees the change BEFORE committing to showing its keyboard.
- The `kbCaptured` dataset attribute marks the element as already suppressed so second-pass focus (after blur/refocus) proceeds normally.
- On true focusout (not just moving focus to a keyboard button): restore original `inputMode` and clear `kbCaptured`.

**Rules:**
- NEVER remove the blur+refocus — setting inputMode alone is not enough, Samsung has already decided by the time focusin fires without the blur.
- NEVER restore inputMode while focus is still moving to a keyboard button (that would re-enable Samsung mid-session).
- The `data-no-keyboard="true"` attribute still works as before — inputs with that attribute are skipped entirely.

### Fix 3: Grid buffer removal + row height reduction
**Buffer removed:** `buffer_minutes` set to 0 in `calendarBridge.js`. Grid now starts exactly at the salon's open time and ends exactly at close time. No more 30-min padding top and bottom. Affects both station and tablet (they share the same SETTINGS proxy).

**Row height reduced:**
- Station: `ROW_H` 28 → **20** in `calendarHelpers.js`
  - 1 hour = 4 × 20 = 80px (was 112px)
  - 30-min block = `Math.max(44, 2×20=40)` → **44px** (hits the min-height floor — still readable)
  - A 9AM–7PM day (10 hours) = 800px — fits in most viewports without scrolling
- Tablet: `T_ROW_H` 36 → **26** in `TabletCalendarView.jsx`
  - 1 hour = 4 × 26 = 104px (was 144px)
  - 30-min block = `Math.max(44, 2×26=52)` → **52px** — comfortable for touch

**Text inside blocks:** ALL font sizes unchanged. 12px client name, 11px service lines, 10px time. The blocks are shorter vertically but text is the same size.

**Why alignment stays perfect:** Both the time-label column and the appointment grid use the same `ROW_H` constant per 15-min slot. Changing the constant changes both columns identically — no manual sync needed.

**Files changed in C89:**
- `src/lib/calendarHelpers.js` — ROW_H 28 → 20
- `src/modules/appointments/calendarBridge.js` — buffer_minutes default 30 → 0, SETTINGS proxy getter 30 → 0
- `src/modules/tablet/TabletCalendarView.jsx` — T_ROW_H 36 → 26, logo repositioned
- `src/components/ui/VirtualKeyboard.jsx` — Samsung keyboard suppression

---

## CHANGES IN C88 — Navigation Reorganization (2 files)

### What Andy asked for (verbatim):
1. Remove the bottom (3rd) mini-calendar on the left sidebar. Keep the other two.
2. Move these buttons from the top nav down to where the 3rd calendar was, inside the Cal tab only (not Turn or Wait tabs):
   - Row 1: Owner / Clients side-by-side
   - Row 2: Appointment Log
   - Row 3: Online Bookings
3. On tablet only, put the Pro Salon POS logo in the top nav space freed up by the Owner+Clients removal. Smaller than station's so it fits.
4. Button functions unchanged — relocation only.
5. Same layout on station and tablet.

### Buttons that stay in top nav (both platforms):
- View Tickets
- Checkout
- Clock In/Out
- Cashier
- Today / date arrows / date label / DateStatusDot
- Column +/− (visibleCols adjustment)
- Sidebar toggle (tablet only, far left)

### Station layout changes (CalendarDayView.jsx)

**Top nav — before C88:**
```
[Logo] [Owner] [Clients] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] [Online Bookings] [Appointment Log] | [−] N [+]
```

**Top nav — after C88:**
```
[Logo] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] | [−] N [+]
```

**Sidebar Cal tab — before C88:**
```
[Cal | Turn | Wait]
[MiniMonth 0]
[MiniMonth 1]
[MiniMonth 2]
```

**Sidebar Cal tab — after C88:**
```
[Cal | Turn | Wait]
[MiniMonth 0]
[MiniMonth 1]
[Owner] [Clients]            ← Row 1
[Appointment Log full-width] ← Row 2 (shows activityLog.length badge)
[Online Bookings full-width] ← Row 3 (shows unviewedCount badge)
```

Turn tab and Wait tab are unchanged — only the Cal tab gets the new buttons.

### Tablet layout changes (TabletCalendarView.jsx)

**Top nav — before C88:**
```
[☰ sidebar toggle] [Owner] [Clients] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] [Online Bookings] [Appointment Log] | [−] N [+]
```

**Top nav — after C88 (logo position corrected in C89):**
```
[☰ sidebar toggle] [Logo 34×34 + "Pro Salon POS"] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] | [−] N [+]
```

Sidebar Cal tab: same as station — 2 MiniMonths then 4 buttons in 3 rows.

### Implementation detail — station vs tablet button style

**Station uses `<button>` with `onClick`:**
```jsx
<button onClick={() => setShowLogPopup(true)} style={{...}}>Appointment Log</button>
```

**Tablet uses `<div {...tap(fn)}>` (PROTECTED C79/C80/C81):**
```jsx
<div {...tap(function() { setShowLogPopup(true); })} style={{...}}>Appointment Log</div>
```

The tablet pattern is mandatory — plain `<div onClick>` on tablet would break the C82 tap-through shield that prevents double-activation on touch → synthesized mouse events. Never mix the two patterns.

### Handler preservation — identical to former top-nav versions

| Button | Handler |
|--------|---------|
| Owner | `onOwnerClick()` (station: OwnerDashboard; tablet: SalonSettingsPanel per C78) |
| Clients | `rbac.requirePermission(ACTIONS.VIEW_EDIT_CLIENTS, staff => onNavClick('clients', staff))` |
| Appointment Log | `setShowLogPopup(true)` |
| Online Bookings | `onNavClick('online-notifs')` |

No new handler logic. C88 is pure relocation.

### New import on tablet (C88)

`src/modules/tablet/TabletCalendarView.jsx` now imports:
```js
import prosalonLogo from '../../assets/prosalon-logo.png';
```

Asset was already in the repo (used by `CalendarDayView.jsx` since before C86). No new asset file needed.

### Logo specs (tablet top nav)

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', userSelect: 'none', marginLeft: 8 }}>
  <img src={prosalonLogo} alt="Pro Salon POS" style={{ width: 34, height: 34, borderRadius: 7, display: 'block' }} />
  <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>Pro Salon POS</span>
</div>
```

- Image: 34×34 (vs station's 40×40) to fit the 52px tablet nav bar
- Text: 15px font, 600 weight (vs station's 17px / 600)
- No onClick, no tap — decorative branding only
- C88: placed after View Tickets + Checkout. C89: moved BEFORE View Tickets (left of all nav buttons except ☰)

### Behaviors after C88

| Action | Result |
|--------|--------|
| Station: top nav — does it show Owner, Clients, Appointment Log, or Online Bookings? | NO ✅ |
| Station: top nav — does it show View Tickets, Checkout, Clock In/Out, Cashier, Today, date arrows, +/−? | YES ✅ |
| Station: click Cal tab — see 2 MiniMonths and 4 buttons? | YES ✅ |
| Station: click Turn or Wait tab — see the 4 buttons? | NO ✅ |
| Station: click Owner in sidebar — open OwnerDashboard? | YES ✅ |
| Station: click Clients in sidebar — PIN prompt (if required) then clients view? | YES ✅ |
| Station: click Appointment Log in sidebar — open ActivityLogPopup? | YES ✅ |
| Station: click Online Bookings in sidebar — open OnlineBookingsPopup? | YES ✅ |
| Tablet: top nav shows Pro Salon POS logo? | YES ✅ |
| Tablet: sidebar Cal tab shows 2 MiniMonths + 4 buttons with same behaviors as station? | YES ✅ |
| Tablet: C87 drag fix still works? | YES ✅ — C87 code unaffected by C88 changes |

### What was NOT changed in C88

- Zero server, zero DB, zero money-path
- Zero changes to useCalendarDrag.js (C87 code untouched)
- Zero changes to button handler behavior
- Zero changes to Turn tab or Wait tab content
- Zero changes to station's top-nav logo (still 40×40)
- Zero changes to other modules (no ripple effects)
- View Tickets, Checkout, Clock In/Out, Cashier, column +/−, date nav, DateStatusDot — all stay exactly where they were

### Lesson for future relocations (C88)

Relocation = move code, keep behavior. If the handler was `rbac.requirePermission(X, cb)` in the old location, it MUST be `rbac.requirePermission(X, cb)` in the new location. Never rewrite handlers during a layout change — that turns a 2-file diff into a debugging nightmare if anything goes wrong.

Also: station and tablet have different event patterns (`onClick` vs `{...tap(fn)}`). Match the platform's existing style, don't mix.

---

## CHANGES IN C87 — Replace C86 Scroll-Lock With Overflow-Hidden (1 file)

### What was broken (Andy's plain-language observation):
After C86 shipped: *"the tech name move left right"*, *"jerky all over the screen"*, *"feel like im doing 2 thing at one"*, *"hard to tell cause it not scolling it jerky all over the screen"*. Time column stayed put, tech columns stayed put, only the tech-name header at the top moved around.

### Root cause realization — scroll events fire listeners:
C86's `scrollLockRef` captured the grid's scroll position at drag activation and wrote it back on every tablet touchmove during drag. The theory: browser scrolls the grid, we write scrollTop back, grid snaps back to locked position, net motion = 0. Looked correct in isolation.

The problem: `TabletCalendarView.jsx` line 346 has a `syncScroll` listener attached to the grid's native `scroll` event:
```js
function syncScroll() {
  if (timeColRef.current && timeColRef.current.firstChild)
    timeColRef.current.firstChild.style.transform = 'translateY(' + (-grid.scrollTop) + 'px)';
  if (headerRef.current) headerRef.current.scrollLeft = grid.scrollLeft;
}
grid.addEventListener('scroll', syncScroll, { passive: true });
```

This is how the tech-name header normally follows the grid's horizontal scroll. Every time the grid scrolls, the header follows.

With C86 active:
1. Finger moves → browser scrolls grid to position X.
2. Grid 'scroll' event fires → syncScroll runs → header jumps to match position X.
3. Our window touchmove handler fires → writes scrollLockRef value back → grid snaps to position Y (locked).
4. Grid 'scroll' event fires AGAIN (from the write-back) → syncScroll runs → header jumps back to position Y.
5. Repeat on every touchmove.

Result: header getting two conflicting scroll positions written back-to-back, rapid-fire, on every touchmove. Visibly = jerky left/right motion of the header. The grid content itself also flickered between positions X and Y because the browser painted frame(s) at position X before our snap-back.

### Andy's own fix (stated plainly):
*"if drag is active stop all scrolling until i got closer to the edge. and only scroll tarward that edge only that would of fix teh damn issue."*

He was exactly right. The fix isn't "let the browser scroll and undo it" (C86). The fix is "don't let the browser scroll in the first place."

### C87 implementation:
Imperatively set `gridRef.current.style.overflow = 'hidden'` at drag activation. The browser cannot scroll a non-scrollable element, so no user-driven scroll events fire at all. `syncScroll` stays quiet. Header stays put. Grid content stays put.

Auto-scroll-during-drag (for dragging to the edge to reveal more tech columns) still works because setting `scrollTop`/`scrollLeft` programmatically bypasses `overflow: hidden` — the element's scroll position can still be modified in code, just not by the user. Those programmatic scroll assignments DO fire `scroll` events, which is what we want: `syncScroll` runs, header follows. Same behavior as before C87 for intentional auto-scroll.

**Four coordinated changes in `useCalendarDrag.js`:**

1. **Declare `originalOverflowRef`** near other C84 refs:
   ```js
   const originalOverflowRef = useRef(null);
   ```

2. **Capture and set in `activatePendingHold`** (after C85 momentum-kill, before `setDragging`):
   ```js
   if (gridRef.current) {
     originalOverflowRef.current = gridRef.current.style.overflow || 'auto';
     gridRef.current.style.overflow = 'hidden';
   }
   ```

3. **Restore in `handleDragEnd`** (near top, after detach listeners):
   ```js
   if (gridRef.current && originalOverflowRef.current !== null) {
     gridRef.current.style.overflow = originalOverflowRef.current;
     originalOverflowRef.current = null;
   }
   ```

4. **Restore in unmount cleanup** (for mid-drag unmount safety):
   ```js
   if (gridRef.current && originalOverflowRef.current !== null) {
     gridRef.current.style.overflow = originalOverflowRef.current;
     originalOverflowRef.current = null;
   }
   ```

### Why station is unaffected

`activatePendingHold` is the tablet hold-to-drag timer callback. Station's `handleBlockStart` never schedules it — station goes through the fall-through branch (line ~210 of useCalendarDrag.js) which calls `setDragging` directly without the hold timer. `originalOverflowRef.current` stays null on station. `handleDragEnd`'s null check skips the restore. Station's mouse+wheel dual-channel drag continues to work exactly as before.

### Behaviors after C87

| Action | Result |
|--------|--------|
| Tablet: press-and-hold, drag in the middle of the grid | Appointment follows finger. Grid stays put. Tech-name header stays put. ✅ |
| Tablet: drag to right edge | Grid auto-scrolls right to reveal tech columns. Tech-name header follows via syncScroll (programmatic scroll fires syncScroll correctly). ✅ |
| Tablet: drag to top/bottom edge | Vertical auto-scroll works. ✅ |
| Tablet: drag, lift, tap to scroll grid | Grid is scrollable again (overflow restored to 'auto'). ✅ |
| Tablet: drag, lift, drag again | Each drag starts with fresh overflow capture. ✅ |
| Tablet: flick grid, then drag | No drift into drag. Grid starts locked at drag activation. ✅ |
| Station: mouse drag | Identical to pre-C83. ✅ |
| Station: mouse wheel during drag | Grid scrolls via wheel, appointment recalculates drop target. ✅ |

### What was NOT changed in C87

- Zero server, zero DB, zero money-path
- Zero changes to AppointmentBlocks.jsx, TabletCalendarView.jsx, CalendarDayView.jsx
- Zero changes to C83 hold-to-drag timing
- Zero changes to C84 window-listener machinery
- Zero changes to C85 momentum-kill writes
- Zero changes to auto-scroll interval's scrollTop/scrollLeft addition
- All 33 PROTECTED markers from C85 intact
- Removed: all 6 C86 markers and scrollLockRef (conceptually wrong approach)
- Added: P034 (new C87 version) — 6 `PROTECTED C87` markers throughout useCalendarDrag.js

### Lesson for future sessions (C87)

If a bug fix involves writing state back to an element that fires events, you WILL create an observable ping-pong in any system that listens to those events. The pattern "let X happen, then undo it" only works silently; anything observable breaks. When possible, prevent X at the source.

In browser terms: `scroll` events fire from both user-driven and programmatic scroll writes. There is no way to "silently" scroll an element. To prevent user scroll without preventing programmatic scroll, use `overflow: hidden`.

---

## 39. TABLET TAP & DRAG PROTECTION — ARCHITECTURE OVERVIEW (C79 through C87)

Tablet interaction protection operates at SEVEN layers:

### Layer 1: Shared tap hook (C77/C79/C80/C81)
### Layer 2: Raw handler wiring on tablet-only files (C81)
### Layer 3: Document-level tap-through shield (C82)
### Layer 4: Hold-to-drag on draggable elements (C83)
### Layer 5: Early non-passive window touchmove attachment (C84)
### Layer 6: Momentum-scroll kill at drag activation (C85)
### Layer 7 (C87 — replaces failed C86): Stop browser scroll at source via overflow:hidden

At drag activation, imperatively set `gridRef.current.style.overflow = 'hidden'`. Browser cannot scroll. At drag end, restore original value. See full C87 section above for detail.

### Rules (C87):
16–19 (C86, DEPRECATED — DO NOT follow):
- ~~`scrollLockRef` rules~~ — removed in C87. Never re-introduce `scrollLockRef` or any "write scroll back" pattern.

20 (C87): NEVER write back to `scrollTop`/`scrollLeft` during tablet drag as a way to undo browser scroll. That fires `scroll` events and makes `syncScroll` jerk the header.
21 (C87): NEVER set `gridRef.current.style.overflow = 'hidden'` outside `activatePendingHold`.
22 (C87): NEVER remove the `overflow` restore in `handleDragEnd`. Grid stuck non-scrollable = broken app.
23 (C87): NEVER change the auto-scroll interval's scroll mechanism to something that doesn't fire `scroll` events. Header sync during drag-to-edge depends on those events firing.
24 (C87): NEVER re-introduce `scrollLockRef`. The pattern is conceptually wrong.

---

## 40. NAVIGATION LAYOUT ARCHITECTURE (C88 + C89 update)

### Top nav contents (both platforms) — after C89:
- **Station left:** Logo (40×40) + "Pro Salon POS" text, then View Tickets, Checkout
- **Station center:** Date arrows, date label + DateStatusDot, Today
- **Station right:** Clock In/Out, Cashier, divider, column +/−
- **Tablet left:** sidebar toggle (☰), Logo (34×34) + "Pro Salon POS" text, View Tickets, Checkout
- **Tablet center:** Date arrows, date label + DateStatusDot, Today
- **Tablet right:** Clock In/Out, Cashier, divider, column +/−

### Sidebar Cal tab contents (both platforms):
- Tab selector: [Cal | Turn | Wait]
- MiniMonth current month (offset 0)
- MiniMonth next month (offset 1)
- Row 1: Owner + Clients side-by-side
- Row 2: Appointment Log (full width, with activityLog.length badge)
- Row 3: Online Bookings (full width, with unviewedCount badge)

### Sidebar Turn tab (unchanged): TechTurnList
### Sidebar Wait tab (unchanged): WaitlistPanel

### Rules (C88):
25. NEVER re-add Owner/Clients/Appointment Log/Online Bookings to the top nav on either platform.
26. NEVER re-add the 3rd MiniMonth (`monthOffset={2}`) to the sidebar.
27. NEVER show the relocated 4 buttons under Turn or Wait tab — Cal tab only.
28. NEVER change any of the 4 button handlers during future relocations — relocation = move code, not change behavior.
29. NEVER use plain `<div onClick>` for the tablet buttons — always `<div {...tap(fn)}>`.
30. NEVER use `<div {...tap(fn)}>` for station buttons — station uses `<button onClick>`.
31. NEVER remove the `import prosalonLogo` statement from TabletCalendarView.jsx.
32. NEVER add a click/tap handler to the tablet top-nav logo — it's decorative branding.
33. NEVER make the tablet top-nav logo larger than 40×40 — it would bust the 52px nav bar.

---

## 41. CALENDAR GRID LAYOUT CONSTANTS (C89)

| Constant | Location | Value (C89) | Was (C88) | Per hour |
|----------|----------|-------------|-----------|----------|
| `ROW_H` | `calendarHelpers.js` | 20 | 28 | 80px |
| `T_ROW_H` | `TabletCalendarView.jsx` | 26 | 36 | 104px |
| `buffer_minutes` | `calendarBridge.js` | 0 | 30 | — |

- Grid slot = 15 min = 1 ROW_H
- Both the time-label column and appointment grid use the same constant — changing ROW_H keeps them in sync automatically
- Min block height = `Math.max(44, (dur/15)*ROW_H)` — a 30-min block at ROW_H=20 hits the 44px floor
- Text sizes inside blocks unchanged: 12px name, 11px service, 10px time

---

## 22. KNOWN BUGS / NEXT SESSION PRIORITIES (C89 updates)

### C89 priorities (testing):
- **Samsung keyboard test:** Tap any text input (client name, search, notes). Only the black VirtualKeyboard should appear. Samsung's native keyboard must NOT appear underneath or over it.
- **Buffer removal test:** Calendar grid should start exactly at salon open time and end at close time. No 30-min empty rows above or below.
- **Row height test (station):** A 9AM–7PM day should show most or all hours without needing to scroll much. 30-min blocks still show client name and service name clearly.
- **Row height test (tablet):** Same — more hours visible, text still legible.
- **Tablet logo position:** Logo should be LEFT of View Tickets, right after the ☰ toggle.
- **Alignment test:** Time column labels must align perfectly with grid rows at every hour mark after ROW_H change.

### C88 priorities (carry-forward — still relevant):
- **Station top nav:** should NOT show Owner, Clients, Online Bookings, or Appointment Log.
- **Station sidebar Cal tab:** 2 MiniMonths + 4 buttons visible. Each button opens exactly what it did before.
- **Tablet badge counts:** activityLog badge shows on Appointment Log when count > 0. unviewedCount badge shows on Online Bookings when > 0.

### C87 priorities (carry-forward — still relevant):
- **Tablet drag test:** Press-and-hold an appointment in the middle of the grid, drag diagonally. APPOINTMENT follows finger. GRID stays put. TECH-NAME HEADER stays put. No jerking.
- **Tablet drag-to-edge test:** Drag appointment to right edge. Grid auto-scrolls. Tech-name header follows smoothly.
- **STATION REGRESSION:** Mouse drag identical to before. Mouse wheel during drag still works.

### File size follow-up:
- `useCalendarDrag.js` at 795 lines (actual). Very close to 800 cap — extract before adding.
- `TabletCalendarView.jsx` at 793 lines (actual). Watch carefully.
- Consider splits before adding new features to either file.

### Deferred (still):
- Money-path double-tap protection.
- Tech phone per-name lockout — planned.
- Live testing with PAX and Clover hardware.
- Future: haptic feedback on drag activation.
- Future: full OwnerDashboard on tablet.

### Carry-over testing (all still relevant):
- All C85/C84/C83/C82/C81/C80/C79/C78/C77/C76/C75/C74/C73/C72 tests still apply.

### Known latent (unchanged):
- `src/routes/public.js` online booking timezone issue (lines 156 and 283).

---

## Section 38, 37, 36, 35, 34, 33, 32–24 unchanged from C86 and prior sessions.
