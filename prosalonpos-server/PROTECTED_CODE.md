# ProSalonPOS — Protected Code Registry

**Last updated:** Session C91 (April 17, 2026)

---

## ⚠️ GOLDEN RULE — THIS FILE IS APPEND-ONLY ⚠️

**NEVER delete, replace, shorten, or summarize any existing entry in this file.**
**NEVER replace a detailed P0XX entry with a one-liner.**

Every session ADDS new entries and session notes at the top. All prior entries stay intact below, forever.

This file is the safety net for the entire codebase. Each P0XX entry contains the full story: what the code does, why it exists, what bug it prevents, and what will break if it is removed. If that detail gets stripped out, future sessions lose the context needed to recognize when something is wrong — and protected fixes get accidentally deleted.

The rule is simple: **ADD DETAIL. NEVER REMOVE OR SUMMARIZE.**

If a prior entry needs updating (e.g. a hash changes, a line number shifts), add a note below the existing entry saying "Updated C##: [what changed]" — do NOT rewrite the original entry.

---

## MANDATORY SESSION START PROCEDURE

1. Extract both zips
2. For EACH entry below, `grep -n "PROTECTED" <file>`
3. If ANY entry missing → STOP → restore before work
4. Verify public/tech/index.html exists (P011)
5. Verify NO orphan public/tech/tech/ folder
6. Verify both public/index.html AND public/tech/index.html reference the SAME JS and CSS hashes
7. Verify App.jsx calls `installTapThroughShield()` (P029)
8. Verify `useCalendarDrag` accepts `isTablet` param (P030)
9. Verify `AppointmentBlocks` accepts tablet-specific props (P031)
10. Verify `useCalendarDrag` C84 refs/helpers/attach-calls/unmount-cleanup (P032)
11. Verify C85 scroll-write pair inside `activatePendingHold` (P033)
12. Verify `originalOverflowRef` declared, set in `activatePendingHold`, restored in `handleDragEnd` + unmount (P034 — C87 version)
13. Verify Owner+Clients+Appointment Log+Online Bookings are in sidebar Cal tab, NOT top nav (P035)
14. Verify ProSalonPOS logo is in tablet top nav LEFT of View Tickets (P036 — C89 position)
15. Verify `import prosalonLogo` exists in TabletCalendarView.jsx (P036)
16. Verify `ROW_H=20` in calendarHelpers.js (P037)
17. Verify `T_ROW_H=26` in TabletCalendarView.jsx (P037)
18. Verify `buffer_minutes:0` in calendarBridge.js default AND proxy getter (P037)
19. Verify `kbCaptured` / `origInputMode` logic exists in VirtualKeyboard.jsx focusin handler (P038)

---

## FILE SIZE WARNINGS

- `src/modules/appointments/useCalendarDrag.js` — **795 lines** (actual C89 build). Very close to 800 cap. Extract before adding.
- `src/modules/tablet/TabletCalendarView.jsx` — **793 lines** (actual C89 build). Watch carefully.
- `src/modules/appointments/CalendarDayView.jsx` — **725 lines** (actual C89 build). Comfortable.
- `src/components/ui/VirtualKeyboard.jsx` — **252 lines** (actual C89 build). Fine.

---

## C91 Session Notes

### Crash fix — build repair only, zero source code changes

**What:** The C90 deploy was crashing on tablet with `o is not a function` inside the tap→requirePermission call chain. Root cause was a bad build artifact from the previous session (different chat), not a source code bug.

**Fix:** Rebuilt C90 station source clean. Zero code changes. New build hash: `index-DgW1rQUi.js`.

**C90 feature carried forward (intact in this build):**
- `CalendarDayView.jsx` now has dynamic row-height zoom (`rowH` state, ▲/▼ buttons, localStorage persist). Station only — tablet unaffected.

**Build hashes (C91):**
- JS: `index-DgW1rQUi.js`
- CSS: `index-jaZ6qTgx.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

**P011 updated C91:** Both HTML files reference `index-DgW1rQUi.js` / `index-jaZ6qTgx.css`.

**Note on tech/index.html:** It had very old hashes (from before C87). Updated to current in C91. Always verify this file after every build — Vite copies it as-is and never updates it automatically.

---

## C89 Session Notes

### Fix 1: Tablet logo repositioned
`TabletCalendarView.jsx` — logo div moved BEFORE the nav-buttons map, so order is: ☰ → Logo → View Tickets → Checkout.
Inline marker: `PROTECTED C89: logo position`.
Note: In C88 the logo was placed AFTER View Tickets/Checkout. C89 moved it to the left of those buttons.

### Fix 2: Samsung native keyboard suppression
`VirtualKeyboard.jsx` — focusin handler now does a two-pass approach:
- Pass 1 (no `data-kb-captured` on element): set `inputMode='none'`, store original in `data-orig-input-mode`, mark `data-kb-captured='true'`, blur, setTimeout-0 refocus. Return early.
- Pass 2 (after blur/refocus, `data-kb-captured` IS set): set activeRef, setVisible(true). Our black keyboard appears. Samsung never shows because it saw `inputMode='none'` before committing.
- focusout: if focus truly left (not to keyboard button), restore origInputMode and clear kbCaptured.

### Fix 3: Buffer removal + row height
- `calendarHelpers.js`: ROW_H 28 → 20
- `calendarBridge.js`: buffer_minutes 30 → 0 in both `_defaultSettings` and SETTINGS proxy getter
- `TabletCalendarView.jsx`: T_ROW_H 36 → 26

### Build hashes (C89)
- JS: `index-P2qGX24a.js`
- CSS: `index-jaZ6qTgx.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged from C88)

---

## C88 Session Notes — Nav reorg (2 files)

**What:** Reorganized top nav buttons. Moved Owner, Clients, Appointment Log, Online Bookings from top nav (both station and tablet) into the left sidebar Cal tab. Removed the 3rd (bottom) MiniMonth. On tablet only, added Pro Salon POS logo to the top nav in the space freed by Owner+Clients removal.

**Layout inside Cal tab sidebar (both platforms):**
```
[tabs: Cal | Turn | Wait]
[MiniMonth month 0]
[MiniMonth month 1]
[Owner] [Clients]           ← Row 1
[Appointment Log full-width] ← Row 2
[Online Bookings full-width] ← Row 3
```

Only shows under Cal tab. Turn and Wait tabs unchanged.

**Files changed in C88:** 2
- `src/modules/appointments/CalendarDayView.jsx` — 702 → 714 lines (+12). Removed Owner and Clients from top nav. Removed Online Bookings and Appointment Log from top nav right side. Removed 3rd MiniMonth from sidebar. Added 4-button block below remaining 2 MiniMonths in Cal tab with same handlers as their old top-nav versions. Station uses `<button>` + `onClick`. C88 markers at each location.
- `src/modules/tablet/TabletCalendarView.jsx` — 767 → 788 lines (+21). Removed Owner from top nav. Removed Clients from the tickets/checkout array. Removed Online Bookings and Appointment Log from top nav right side. Removed 3rd MiniMonth from sidebar. Added 4-button block using `{...tap(...)}` pattern (not plain onClick) to preserve C79/C80/C81 tap-through shield behavior. Added logo to top nav at 34×34 (smaller than station's 40×40 to fit 52px nav). Added `import prosalonLogo from '../../assets/prosalon-logo.png';` at top of file. C88 markers throughout.

**What was NOT changed in C88:**
- Zero server, zero DB, zero money-path
- View Tickets, Checkout, Clock In/Out, Cashier, date arrows, Today, column +/− all stay in top nav on both platforms
- Turn tab and Wait tab in sidebar — unchanged
- Button handler behavior — identical to before
- Station top-nav logo unchanged (kept at 40×40)
- All C87 + C83/C84/C85 protections intact

**Build hashes after C88:**
- JS: `index-BRdWyDvi.js`
- CSS: `index-CRqiR-go.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

**P011 updated C88:** Both HTML files reference above hashes.
**P011 updated C89:** Both HTML files now reference `index-P2qGX24a.js` / `index-jaZ6qTgx.css`.

---

## C87 Session Notes — Replace C86 scroll-lock with overflow:hidden (1 file)

**Problem:** After C86 shipped, tablet drag still had visible jerky motion. Andy pinpointed it: *"the tech name move left right"*, *"jerky all over the screen"*, *"feel like im doing 2 thing at one"*. Time column stayed put. Only the tech-name header jumped around.

**Root cause — the REAL one:** C86's `scrollLockRef` write-back fired the grid's native `scroll` event on every touchmove during drag. `TabletCalendarView.jsx` line 346 has a `syncScroll` listener attached to that event that writes `headerRef.scrollLeft = grid.scrollLeft` to keep the tech-name header in sync with horizontal grid scroll. Every C86 write-back = one `scroll` event = one `syncScroll` run = one header jump. Since the browser was continuously trying to scroll and C86 was continuously undoing it, the header was getting two conflicting scroll positions written back-to-back on every touchmove — visible as jerky left/right motion.

**C86 was conceptually wrong:** "let the browser scroll, then undo it" creates observable ping-pong in any system that has scroll-event listeners. You cannot silently undo a scroll.

**Fix (C87) — Andy's own plain-English rule:**
*"if drag is active stop all scrolling until i got closer to the edge. and only scroll tarward that edge only."*

Imperatively set `gridRef.current.style.overflow = 'hidden'` in `activatePendingHold` (tablet-only path) BEFORE `setDragging`. Browser can't scroll a non-scrollable element, so no user-driven scroll events fire, so `syncScroll` doesn't jerk the header. Programmatic scroll (the existing autoScroll interval for drag-to-edge) still works because `scrollTop/scrollLeft` assignments bypass `overflow`. That programmatic scroll DOES fire `syncScroll` correctly, which is the intended behavior.

Restore `overflow` to original value in `handleDragEnd` and unmount. Use an `originalOverflowRef` to capture the value at activation (not hardcode `'auto'`) so unusual states are preserved.

**Files changed in C87:** 1
- `src/modules/appointments/useCalendarDrag.js` — 796 → 788 lines. Removed all 6 C86 markers + `scrollLockRef`. Added 6 C87 markers + `originalOverflowRef`. Imperative `overflow='hidden'` write in `activatePendingHold`. Restore in `handleDragEnd`. Clear in unmount cleanup.

**What was NOT changed in C87:**
- Zero server, zero DB, zero money-path
- Zero changes to `AppointmentBlocks.jsx`, `TabletCalendarView.jsx`, `CalendarDayView.jsx`
- Zero changes to C84 window-listener machinery
- Zero changes to C85 momentum kill
- Zero changes to C83 hold-to-drag timing

---

## Protected Fixes

### useGridLayoutState.js
**P001, P002** — catSlots cleanup-only + settings restore runs once (C105)

### calendarHelpers.js
**P009** — getGroup respects appointment_id boundaries (C54)

**P037 (C89)** — `ROW_H=20`. Do NOT change back to 28 — that reduces visible hours on screen. Both time col and grid col use this same constant — they stay aligned automatically. Changing ROW_H affects both columns identically, no manual sync needed.

### AppointmentBlocks.jsx
**P004** (C54), **P031** (C83). Not changed in C87, C88, or C89.

### useCalendarHandlers.js
**P003** (C49), **P010** (C54)

### BookingFlow.jsx
**P005** (C49), **P017** (C71), **P024** (C77)

### CheckoutTabs.jsx
**P006** (C52)

### SalonSettingsPanel.jsx
**P007** (C49)

### printRelay.js
**P008** (C40)

### public/tech/index.html
**P011** — Dedicated tech phone HTML. Must always exist. No `public/tech/tech/` orphan ever.
- Both `public/index.html` AND `public/tech/index.html` must reference the SAME JS and CSS hashes after every build.
- **C87 hashes:** JS = `index-Dar1a5Fj.js`, CSS = `index-CRqiR-go.css`
- **C88 hashes:** JS = `index-BRdWyDvi.js`, CSS = `index-CRqiR-go.css` (CSS unchanged)
- **C89 hashes:** JS = `index-P2qGX24a.js`, CSS = `index-jaZ6qTgx.css`, Logo = `prosalon-logo-C6XNqxUq.png`
- **C91 hashes:** JS = `index-DgW1rQUi.js`, CSS = `index-jaZ6qTgx.css`, Logo = `prosalon-logo-C6XNqxUq.png` (C90 was a bad build — C91 is the correct C90 rebuild)
- **Build reminder:** Vite rewrites `dist/index.html` with fresh hashes but copies `public/tech/index.html` as-is. Manually sync `public/tech/index.html` to match current build hashes, copy to `dist/tech/index.html`, then bake into server/public. Hashes change every build (Vite timestamp-seeded) — always verify actual dist/assets/ output.

### TechNotifications.jsx
**P012** (C57)

### Server timezone files
**P013, P014, P015** (C62)

### Server provider code
**P016** (C64)

### socket.js
**P018** (C72)

### TabletApp.jsx
**P019** (C72)

### DateStatusDot.jsx
**P020** (C72)

### TabletCalendarView.jsx
**P021** (C75), **P023** (C76), **P027** (C81). Not changed in C87.

**P036 (C88 + C89 update) — Pro Salon POS logo in tablet top nav.**
- Location: `src/modules/tablet/TabletCalendarView.jsx`
- What:
  - Import added at top of file: `import prosalonLogo from '../../assets/prosalon-logo.png';`
  - Logo element in top nav: 34×34 image + "Pro Salon POS" text. Non-interactive (no onClick/tap).
  - C88 position: placed AFTER View Tickets/Checkout, before center date-nav spacer.
  - C89 position update: moved BEFORE View Tickets/Checkout — now immediately right of ☰ toggle.
  - Order after C89: ☰ → Logo+text → View Tickets → Checkout → …date nav…
  - Inline marker: `PROTECTED C89: logo position`
- Why: Tablet previously had no logo. Space freed by Owner+Clients removal in C88.
- Rules:
  - NEVER remove the `import prosalonLogo` statement.
  - NEVER add an onClick or tap handler to the logo — it's decorative/branding, not navigation.
  - NEVER use a size larger than 40×40 — would bust the 52px nav bar.
  - Station's top-nav logo is a different element in a different file — do not confuse the two.

**P037 (C89)** — `T_ROW_H=26`. Do NOT change back to 36 — that reduces visible hours on tablet screen. Inline marker in TabletCalendarView.jsx.

### calendarBridge.js
**P037 (C89)** — `buffer_minutes:0` in BOTH `_defaultSettings` object AND the SETTINGS proxy getter `if (key === 'buffer_minutes') return 0`. Both must be 0. Do NOT restore to 30. Removing the buffer means the grid starts exactly at the salon's open time and ends exactly at close — no empty padding rows.

### CalendarDayView.jsx
**P022** (C76). Not changed in C87, C88, or C89. Picks up ROW_H=20 automatically from calendarHelpers import — no manual change needed in this file.

### TicketViewer.jsx
**P025** (C78)

### useTabletTap.js
**P026** (C79/C80/C81). Not changed in C87, C88, or C89.

### Callers of P026 (unchanged since C81)
TabletCalendarView.jsx, TicketViewer.jsx, ClientList.jsx, OnlineBookingsPopup.jsx, TimeClockPopup.jsx, SalonSettingsPanel.jsx, BookingFlow.jsx.

### useTabletTap.js + App.jsx
**P029** (C82). Not changed in C87, C88, or C89.

### useCalendarDrag.js

**P030** (C83) — Hold-to-drag. Not changed in C87, C88, or C89.
**P031** (C83) — Tablet block handling. Not changed in C87, C88, or C89.
**P032** (C84) — Early non-passive window listener attachment. Not changed in C87, C88, or C89.
**P033** (C85) — Momentum kill at activation. Not changed in C87, C88, or C89.

**P034 (C87) — REPLACES the former C86 version. Overflow-based scroll-stop during tablet drag.**

- Location: `src/modules/appointments/useCalendarDrag.js`
- What:
  - New ref `originalOverflowRef` (declared near other C84 refs at line ~156). Holds the grid's original `overflow` CSS value (typically `'auto'`) during tablet drag; null otherwise.
  - `activatePendingHold` captures `gridRef.current.style.overflow` (or `'auto'` fallback) into `originalOverflowRef.current` THEN sets `gridRef.current.style.overflow = 'hidden'`. Both BEFORE `setDragging`, AFTER the C85 momentum-kill writes. Done imperatively (not through React style prop) so it takes effect same-frame without waiting for re-render.
  - The tablet window touchmove handler is UNCHANGED beyond removing the C86 write-back. Just `preventDefault` + forward coords to `handleDragMove`. No scroll manipulation.
  - The auto-scroll interval inside `handleDragMove` is UNCHANGED — still writes `scrollTop/scrollLeft` additively. Works with `overflow: 'hidden'` because scrollTop/scrollLeft assignments bypass overflow. The grid's own `scroll` event fires from these writes, triggering `syncScroll` in `TabletCalendarView.jsx`, which updates the tech-name header correctly.
  - `handleDragEnd` reads `originalOverflowRef.current` and writes it back to `gridRef.current.style.overflow`, then clears `originalOverflowRef.current = null`. Null-guarded so station (where it was never set) skips silently.
  - Unmount cleanup does the same restore (for mid-drag unmount safety).
- Why: C86's "write scroll back" approach fired scroll events that made `syncScroll` jerk the header. Setting `overflow: 'hidden'` prevents scroll from happening in the first place, so no user-driven scroll events fire. Programmatic auto-scroll still works and DOES fire scroll events correctly for header sync.
- Rules:
  - NEVER set `originalOverflowRef` anywhere except `activatePendingHold`.
  - NEVER read `originalOverflowRef` anywhere except `handleDragEnd` and unmount cleanup.
  - NEVER hardcode `'auto'` in the restore — use the ref's captured value.
  - NEVER apply `overflow: 'hidden'` from the station (mouse) code path. `activatePendingHold` is tablet-only by construction; station goes through the fall-through branch of `handleBlockStart` and never calls `activatePendingHold`.
  - NEVER replace the auto-scroll interval's `scrollTop/scrollLeft +=` mechanism with something that doesn't fire `scroll` events. The header sync depends on those events firing.
  - NEVER re-introduce `scrollLockRef` or any "write scroll back" pattern. Lesson from C86.
- Inline markers: 6 `PROTECTED C87:` comments throughout the file.

### Station + Tablet nav reorganization (C88)

**P035 (C88) — Sidebar placement of relocated nav buttons.**
- Location: `src/modules/appointments/CalendarDayView.jsx` (station) AND `src/modules/tablet/TabletCalendarView.jsx` (tablet)
- What:
  - Owner, Clients, Appointment Log, Online Bookings removed from top nav.
  - Inside the `{activeTab==='calendar' && <div>...}` block in the left sidebar, after `MiniMonth monthOffset={0}` and `MiniMonth monthOffset={1}` (3rd MiniMonth REMOVED), a button group is rendered:
    - Row 1: Owner + Clients side-by-side (flex container, gap 8)
    - Row 2: Appointment Log (full width, same `setShowLogPopup(true)` handler + `activityLog.length` badge)
    - Row 3: Online Bookings (full width, same `onNavClick('online-notifs')` handler + `unviewedCount` badge)
  - Handlers unchanged from their former top-nav versions. Clients still runs `rbac.requirePermission(ACTIONS.VIEW_EDIT_CLIENTS, cb)`. Owner still calls `onOwnerClick`.
  - Station uses `<button>` + `onClick`. Tablet uses `<div {...tap(...)}>` for C79/C80/C81 tap-through shield compatibility. **Do not mix.**
- Why: Andy requested the layout change to free up top-nav space.
- Rules:
  - NEVER re-add Owner/Clients/Appointment Log/Online Bookings to the top nav on either platform.
  - NEVER re-add the 3rd MiniMonth (`monthOffset={2}`).
  - NEVER show the 4 relocated buttons under Turn or Wait tab. They're Cal-tab-only.
  - NEVER change button handlers during any future relocation. Relocation = move code, keep behavior.
  - NEVER use plain `onClick` on the tablet buttons — always `{...tap(fn)}`.

### VirtualKeyboard.jsx

**P038 (C89) — Samsung native keyboard suppression.**
- Location: `src/components/ui/VirtualKeyboard.jsx`
- What: In `handleFocusIn`, on first pass (no `data-kb-captured`):
  1. Set `e.target.setAttribute('inputmode', 'none')` — tells OS not to show keyboard
  2. Store original value: `e.target.dataset.origInputMode = e.target.getAttribute('inputmode') || ''`
  3. Set `e.target.dataset.kbCaptured = 'true'`
  4. `e.target.blur()`
  5. `setTimeout(() => e.target.focus({ preventScroll: true }), 0)`
  6. `return` early — second pass (after refocus) proceeds normally and shows our black keyboard
  In `handleFocusOut`, only restore when focus truly leaves (not to keyboard button):
  - Restore `origInputMode` attribute, delete `kbCaptured` and `origInputMode` dataset entries
- Why: Samsung fires its native keyboard on any focused input. Setting `inputMode='none'` prevents it, but only if set BEFORE Samsung commits to showing the keyboard — hence the blur+refocus. Without the blur+refocus, Samsung has already committed by the time the focusin handler runs.
- Rules:
  - NEVER remove the blur+refocus. inputMode alone is insufficient on Samsung.
  - NEVER restore inputMode while focus is moving to a keyboard button (breaks mid-session typing).
  - NEVER skip the `kbCaptured` guard — without it, every refocus triggers another blur/refocus loop.
  - `data-no-keyboard="true"` on an input still skips VirtualKeyboard entirely (unchanged behavior).

---

## How to Add New Entries

1. Add inline comment: `// PROTECTED C##: brief description`
2. Add entry here with ID, session, location, what, why, rules.
3. NEVER remove or shorten existing entries. Add a dated note below if something changes.
