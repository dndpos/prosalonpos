# ProSalonPOS — Business Logic & Rules

**Last updated:** Session C89 (April 17, 2026)

*New entries: C90 — ▲▼ row-height zoom buttons added to station calendar top nav.*

---

## CHANGES IN C90 — Row Height Zoom Buttons (1 file)

### What Andy asked for:
Two buttons (▲ / ▼) on the station calendar screen to compress or expand the time grid rows — so the user can choose how many hours are visible at once without it being hardcoded.

### Implementation:

**File changed:** `src/modules/appointments/CalendarDayView.jsx` (725 → 738 lines)

1. **Import alias:** `ROW_H` imported as `DEFAULT_ROW_H` from calendarHelpers (the file-level constant stays at 20 and is used as the initial default only).

2. **State:** `rowH` useState, initialised from `localStorage` key `prosalonpos_row_h`, clamped 12–40, default 20.

3. **Alias:** `var ROW_H = rowH` declared in component body — all existing downstream references (grid height, time labels, AppointmentBlocks, useCalendarDrag ctx, useCalendarHandlers ctx, drag/resize calculations) pick up the live value automatically. Zero changes to any other file.

4. **Buttons:** ▲ ▼ with current value between them, placed in the top nav right side after the column −/+ group, separated by a divider. Same styling as column buttons. ▲ dims and disables at min (12). ▼ dims and disables at max (40). Step = 4px per press.

5. **Persist:** `saveRowH(n)` clamps, calls setRowH, writes to localStorage. Zoom survives day navigation and page reloads — same pattern as visibleCols (C76).

### Zoom range:
| rowH | Hours visible (9AM–7PM, no scroll) | 30-min block height |
|------|--------------------------------------|---------------------|
| 12 | ~14 hrs (all fit easily) | 44px (floor) |
| 20 | ~9 hrs (default C89) | 44px (floor) |
| 28 | ~6 hrs | 56px |
| 36 | ~5 hrs | 72px |
| 40 | ~4 hrs | 80px |

### What was NOT changed in C90:
- Zero server, zero DB, zero money-path
- Zero changes to useCalendarDrag.js, useCalendarHandlers.js, AppointmentBlocks.jsx, StaticGridLines, TabletCalendarView.jsx
- calendarHelpers.js ROW_H=20 stays — it is now the default only, not the live value on station
- All C89/C88/C87 protections intact

### Build hashes (C90):
- JS: `index-DOPdQa8j.js`
- CSS: `index-Dl-D5agJ.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

---

*New entries: C89 — logo repositioned on tablet (left of View Tickets), Samsung native keyboard suppressed in VirtualKeyboard, 30-min grid buffer removed, ROW_H reduced for more hours on screen.*

---

## CHANGES IN C89 — Three Fixes (3 files)

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

### Station layout (CalendarDayView.jsx) — after C88:
**Top nav:**
```
[Logo] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] | [−] N [+]
```
**Sidebar Cal tab:**
```
[Cal | Turn | Wait]
[MiniMonth 0]
[MiniMonth 1]
[Owner] [Clients]            ← Row 1
[Appointment Log full-width] ← Row 2 (shows activityLog.length badge)
[Online Bookings full-width] ← Row 3 (shows unviewedCount badge)
```

### Tablet layout (TabletCalendarView.jsx) — after C89 (logo repositioned):
**Top nav:**
```
[☰] [Logo 34×34 + "Pro Salon POS"] [View Tickets] [Checkout] ...date nav... [Clock In/Out] [Cashier] | [−] N [+]
```
**Sidebar Cal tab:** same as station.

### Rules (C88 carry-forward):
25. NEVER re-add Owner/Clients/Appointment Log/Online Bookings to the top nav on either platform.
26. NEVER re-add the 3rd MiniMonth (`monthOffset={2}`) to the sidebar.
27. NEVER show the relocated 4 buttons under Turn or Wait tab — Cal tab only.
28. NEVER change any of the 4 button handlers during future relocations.
29. NEVER use plain `<div onClick>` for the tablet buttons — always `<div {...tap(fn)}>`.
30. NEVER use `<div {...tap(fn)}>` for station buttons — station uses `<button onClick>`.
31. NEVER remove the `import prosalonLogo` statement from TabletCalendarView.jsx.
32. NEVER add a click/tap handler to the tablet top-nav logo — it's decorative branding.
33. NEVER make the tablet top-nav logo larger than 40×40 — it would bust the 52px nav bar.

---

## CHANGES IN C87 — Replace C86 Scroll-Lock With Overflow-Hidden

(Full details preserved — see C87 section in prior docs. Rules 20–24 in SESSION_RULES.md.)

---

## 39. TABLET TAP & DRAG PROTECTION — ARCHITECTURE OVERVIEW (C79 through C87)

Tablet interaction protection operates at SEVEN layers:

### Layer 1: Shared tap hook (C77/C79/C80/C81)
### Layer 2: Raw handler wiring on tablet-only files (C81)
### Layer 3: Document-level tap-through shield (C82)
### Layer 4: Hold-to-drag on draggable elements (C83)
### Layer 5: Early non-passive window touchmove attachment (C84)
### Layer 6: Momentum-scroll kill at drag activation (C85)
### Layer 7 (C87): Stop browser scroll at source via overflow:hidden

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

---

## 41. CALENDAR GRID LAYOUT CONSTANTS (C89)

| Constant | Location | Value (C89) | Was | Per hour |
|----------|----------|-------------|-----|----------|
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

### File size follow-up (unchanged from C88):
- `useCalendarDrag.js` at 788 lines. Close to cap.
- `TabletCalendarView.jsx` at 788 lines. Close to cap.
- Consider splits before adding new features.

### Deferred (still):
- Money-path double-tap protection.
- Tech phone per-name lockout — planned.
- Live testing with PAX and Clover hardware.
- Future: haptic feedback on drag activation.
- Future: full OwnerDashboard on tablet.

### Known latent (unchanged):
- `src/routes/public.js` online booking timezone.
