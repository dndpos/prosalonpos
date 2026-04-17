# ProSalonPOS — Protected Code Registry

**Last updated:** Session C89 (April 17, 2026)

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
12. Verify `originalOverflowRef` declared, set in `activatePendingHold`, restored in `handleDragEnd` + unmount (P034)
13. Verify Owner+Clients+Appointment Log+Online Bookings are in sidebar Cal tab, NOT top nav (P035)
14. Verify ProSalonPOS logo is in tablet top nav LEFT of View Tickets (P036 — C89 update)
15. Verify `import prosalonLogo` exists in TabletCalendarView.jsx (P036)
16. Verify `ROW_H=20` in calendarHelpers.js (P037)
17. Verify `T_ROW_H=26` in TabletCalendarView.jsx (P037)
18. Verify `buffer_minutes:0` in calendarBridge.js default AND proxy getter (P037)
19. Verify `kbCaptured` / `origInputMode` logic exists in VirtualKeyboard.jsx focusin handler (P038)
20. Verify `rowH` state + `saveRowH` + `var ROW_H = rowH` exist in CalendarDayView.jsx (C90)

---

## FILE SIZE WARNINGS

- `src/modules/appointments/useCalendarDrag.js` — **788 lines**. Near 800 cap. Extract before adding.
- `src/modules/tablet/TabletCalendarView.jsx` — **~796 lines** after C89. Very close to cap — split before next addition.
- `src/modules/appointments/CalendarDayView.jsx` — **714 lines**. Comfortable.
- `src/components/ui/VirtualKeyboard.jsx` — **~238 lines**. Fine.

---

## C90 Session Notes

### Row height zoom buttons
`CalendarDayView.jsx` — `ROW_H` import aliased as `DEFAULT_ROW_H`. `rowH` useState added (default 20, min 12, max 40, step 4, localStorage key `prosalonpos_row_h`). `var ROW_H = rowH` declared in component body so all existing grid code picks up the live value. ▲/▼ buttons added to top nav right side, same style as column +/- buttons.

No new PROTECTED markers needed — this is pure additive state. The existing `useCalendarDrag` ctx already accepted `ROW_H` as a param (P034 machinery unchanged). The calendarHelpers.js `ROW_H=20` export is now the DEFAULT only.

### Build hashes (C90)
- JS: `index-DOPdQa8j.js`
- CSS: `index-Dl-D5agJ.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

**P011 updated C90:** Both HTML files reference `index-DOPdQa8j.js` / `index-Dl-D5agJ.css`.

---

## C89 Session Notes

### Fix 1: Tablet logo repositioned
`TabletCalendarView.jsx` — logo div moved before the nav-buttons map, so order is: ☰ → Logo → View Tickets → Checkout. Inline marker: `PROTECTED C89: logo position`.

### Fix 2: Samsung native keyboard suppression
`VirtualKeyboard.jsx` — focusin handler now does a two-pass approach:
- Pass 1: set `inputMode='none'` on element, store original in `data-orig-input-mode`, mark `data-kb-captured='true'`, blur, setTimeout-0 refocus.
- Pass 2 (after refocus): activeRef set, VirtualKeyboard shown.
- focusout: if focus truly left (not to keyboard button), restore origInputMode and clear kbCaptured.

### Fix 3: Buffer removal + row height
- `calendarHelpers.js`: ROW_H 28 → 20
- `calendarBridge.js`: buffer_minutes 30 → 0 in both _defaultSettings and SETTINGS proxy getter
- `TabletCalendarView.jsx`: T_ROW_H 36 → 26

### Build hashes (C89)
- JS: `index-P2qGX24a.js`
- CSS: `index-jaZ6qTgx.css`
- Logo: `prosalon-logo-C6XNqxUq.png` (unchanged)

---

## Protected Fixes

### useGridLayoutState.js
**P001, P002** — catSlots cleanup-only + settings restore runs once

### calendarHelpers.js
**P009** — getGroup respects appointment_id boundaries (C54)
**P037 (C89)** — `ROW_H=20`. Do NOT change back to 28 — that reduces visible hours on screen. Both time col and grid col use this constant; they stay aligned automatically.

### AppointmentBlocks.jsx
**P004** (C54), **P031** (C83). Not changed in C89.

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
**P011** — Dedicated tech phone HTML.
- **C90 hashes:** JS = `index-DOPdQa8j.js`, CSS = `index-Dl-D5agJ.css`, Logo = `prosalon-logo-C6XNqxUq.png`
- **C89 hashes:** JS = `index-P2qGX24a.js`, CSS = `index-jaZ6qTgx.css`, Logo = `prosalon-logo-C6XNqxUq.png`.
- No `public/tech/tech/` orphan.
- Both HTMLs must reference same JS AND CSS hashes after each build.

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
**P021** (C75), **P023** (C76), **P027** (C81).
**P036 (C88/C89)** — Logo in top nav, LEFT of View Tickets. `import prosalonLogo` at top of file. 34×34, non-interactive.
**P037 (C89)** — `T_ROW_H=26`. Do NOT change back to 36.

### calendarBridge.js
**P037 (C89)** — `buffer_minutes:0` in both `_defaultSettings` and the SETTINGS proxy getter. Do NOT restore to 30.

### CalendarDayView.jsx
**P022** (C76). Not changed in C89. Picks up ROW_H=20 automatically from calendarHelpers import.

### TicketViewer.jsx
**P025** (C78)

### useTabletTap.js
**P026** (C79/C80/C81). Not changed in C89.

### useTabletTap.js + App.jsx
**P029** (C82). Not changed in C89.

### useCalendarDrag.js
**P030** (C83), **P031** (C83), **P032** (C84), **P033** (C85).
**P034 (C87)** — `originalOverflowRef` overflow-hidden during tablet drag. Not changed in C89.

### Station + Tablet nav reorganization
**P035 (C88)** — Owner/Clients/Appt Log/Online Bookings in sidebar Cal tab only. Not changed in C89.

### VirtualKeyboard.jsx
**P038 (C89) — NEW — Samsung native keyboard suppression.**
- Location: `src/components/ui/VirtualKeyboard.jsx`
- What: In `handleFocusIn`, on first pass (no `data-kb-captured`):
  1. Set `e.target.setAttribute('inputmode', 'none')` — tells OS not to show keyboard
  2. Store original value: `e.target.dataset.origInputMode = e.target.getAttribute('inputmode') || ''`
  3. Set `e.target.dataset.kbCaptured = 'true'`
  4. `e.target.blur()`
  5. `setTimeout(() => e.target.focus({ preventScroll: true }), 0)`
  6. `return` early — second pass (after refocus) proceeds normally
  In `handleFocusOut`, only restore when focus truly leaves (not to keyboard button):
  - Restore `origInputMode` attribute, delete `kbCaptured` and `origInputMode` dataset entries
- Why: Samsung fires its native keyboard on any focused input. Setting `inputMode='none'` prevents it, but only if set BEFORE Samsung commits to showing the keyboard — hence the blur+refocus.
- Rules:
  - NEVER remove the blur+refocus. inputMode alone is insufficient on Samsung.
  - NEVER restore inputMode while focus is moving to a keyboard button (breaks mid-session typing).
  - NEVER skip the `kbCaptured` guard — without it, every refocus triggers another blur/refocus loop.
  - `data-no-keyboard="true"` on an input still skips VirtualKeyboard entirely (unchanged).

---

## How to Add New Entries

1. Add inline comment: `// PROTECTED C##: brief description`
2. Add entry here with ID, session, location, what, why.
