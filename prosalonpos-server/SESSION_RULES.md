# ProSalonPOS — Session Rules

**Read this FIRST before doing anything.**

You are "Cindy," the sole engineer on ProSalonPOS. Andy is the owner — he has NO dev background. Always explain in plain language. Never suggest terminal commands or VS Code actions.

**Project knowledge = 4 files:**
1. **SESSION_RULES.md** (this file)
2. **PROTECTED_CODE.md**
3. **FILE_MAP.md**
4. **BUSINESS_LOGIC.md**

---

## ⚠️ GOLDEN RULE FOR ALL 4 PROJECT FILES — READ EVERY SESSION ⚠️

**These 4 files are the institutional memory of ProSalonPOS. They are APPEND-ONLY.**

Every session ADDS new content. Nothing is ever deleted, replaced, summarized, or shortened.

**Why this matters:** Andy and Cindy work across sessions with no shared memory except these files. Every decision, every bug, every lesson learned, every "why did we do it this way" lives here. If history gets removed:
- We lose the story of why protected code exists
- We repeat bugs we already solved
- We can't trace where something went wrong
- We have no starting point when something breaks

**The rule for updating these files at session end:**
- SESSION_RULES: Add new lessons and red flags AT THE TOP under a C## section. Keep all prior lessons below.
- BUSINESS_LOGIC: Add new CHANGES section AT THE TOP. Every prior CHANGES section stays intact below forever.
- PROTECTED_CODE: Add new session notes AT THE TOP. Every prior P0XX entry stays intact with full detail. Never replace a detailed entry with a summary.
- FILE_MAP: Add new CHANGED FILES section AT THE TOP. All prior CHANGED FILES sections stay below forever.

**If you find yourself deleting lines from these files → STOP. That is always wrong.**

---

## Before ANY Code Work

1. **Extract and verify zips.** Server: name="prosalonpos-server", src/ has only server files. Station: has App.jsx, modules, lib. If anything fails → STOP.
2. **Scan PROTECTED_CODE.md.** For each entry, grep the file. Verify tech/index.html exists. No public/tech/tech/ orphan.
3. **Check file sizes.** >750 lines = warn, consider split before adding.
4. **Check FILE_MAP.md for blast radius.**
5. **Check BUSINESS_LOGIC.md for relevant rules.**

---

## FILE SIZE NOTES (C91 actual measurements)

- `src/modules/appointments/useCalendarDrag.js` — **795 lines**. Very close to 800 cap. Extract before adding anything. The tablet-specific machinery (C83+C84+C85+C87) should be extracted into a `useTabletHoldDrag` sub-hook when this file is next touched.
- `src/modules/tablet/TabletCalendarView.jsx` — **793 lines**. Watch carefully. Split before next significant addition.
- `src/modules/appointments/CalendarDayView.jsx` — **738 lines** (C90 added 13 lines for row-height zoom). Getting closer to 800 — watch.
- `src/components/ui/VirtualKeyboard.jsx` — **252 lines**. Fine.

---

## During Work

### Before editing: grep PROTECTED, check FILE_MAP deps.
### After editing: grep PROTECTED again, verify all survived.
### When fixing a bug: add `// PROTECTED C##:` inline + entry to PROTECTED_CODE.md.
### When unsure why a line exists: ASK ANDY, don't delete.

### C83 lesson — Hold-to-drag on tablet.
### C84 lesson — Non-passive window listener must attach at touchstart.
### C85 lesson — Momentum-scroll kill at drag activation.

### C86 LESSON (FAILED) — DO NOT try to "let the browser scroll then undo it."

C86 introduced `scrollLockRef` that captured grid scroll at activation and wrote it back on every tablet touchmove during drag. This DID stop the grid content from drifting, but CAUSED a new bug: every write-back fired a `scroll` event, which ran `syncScroll` in `TabletCalendarView.jsx`, which jerked the tech-name header left/right. Andy described it as *"the tech name move left right"*, *"jerky all over the screen"*, *"feel like im doing 2 thing at one"*.

Root lesson: if the UI has ANY scroll-event listeners (`syncScroll` does exactly that — line 346 of TabletCalendarView.jsx), then writing scrollTop back to the element fires those listeners. You can't "undo" a scroll silently — every scroll write is observable. **Attempting to fight the browser after it scrolls creates an observable ping-pong.**

### C87 LESSON — STOP THE SCROLL AT THE SOURCE, DON'T UNDO IT AFTER.

The correct fix is Andy's own plain-English rule: *"if drag is active stop all scrolling until i got closer to the edge. and only scroll tarward that edge only."*

On tablet, when drag activates, imperatively flip `gridRef.current.style.overflow` from `'auto'` to `'hidden'`. The browser cannot scroll a non-scrollable element, so no user-driven scroll events fire, so `syncScroll` doesn't jerk the header, so nothing drifts. Programmatic scroll (from the autoScroll interval when the finger is near an edge) STILL works because `scrollTop/scrollLeft` assignments bypass `overflow` — the element's scroll position can still be set in code, just not by the user. That programmatic scroll DOES fire `syncScroll` correctly, which is what we want.

Restore `overflow` to the original value in `handleDragEnd` and in unmount cleanup. Use an `originalOverflowRef` that captures the value at activation — don't hardcode `'auto'` in case something else changes it.

**Station mouse path untouched:** `activatePendingHold` is tablet-only (called from the HOLD_MS timer, scheduled only in the tablet branch of `handleBlockStart`). Station's mousemove handler never enters this path, so `originalOverflowRef` stays null on station and `handleDragEnd`'s null check skips the restore. Station's cursor+wheel two-channel drag is preserved.

Rule 20 (C87): NEVER write back to `scrollTop`/`scrollLeft` during tablet drag as a way to "undo" browser scroll. The correct approach is to prevent the scroll in the first place via `overflow: 'hidden'`.

Rule 21 (C87): NEVER set `gridRef.current.style.overflow = 'hidden'` outside `activatePendingHold`. That would affect station and/or fire outside the tablet drag lifecycle.

Rule 22 (C87): NEVER remove the restore in `handleDragEnd`. Grid stuck at `overflow: hidden` means the user cannot scroll the calendar after drag ends.

Rule 23 (C87): NEVER change the auto-scroll interval's scroll writes (`gridRef.current.scrollTop += scrollDy` etc.) to use a method that bypasses the grid's scroll event. The interval RELIES on firing `scroll` events so `syncScroll` updates the tech-name header. Change the interval's mechanism = break the header sync during drag-to-edge.

Rule 24 (C87): NEVER re-introduce `scrollLockRef` or anything similar. The whole concept of "write scroll back after it happens" is wrong.

### C88 LESSON — When moving navigation buttons.
1. Top nav vs sidebar placement is a layout choice, not a functional one. Button HANDLERS must stay identical when moving. If the handler on top nav was `rbac.requirePermission(ACTIONS.X, cb)`, the sidebar version must use the same call.
2. Station uses `<button>` elements with `onClick`. Tablet uses `<div {...tap(fn)}>` for the PROTECTED C79/C80/C81 tap-through shield behavior. **Never mix them.** Use the pattern already in the file you're editing.
3. If a button depends on a state variable (like `setShowLogPopup`, `activityLog`, `unviewedCount`), verify the variable is in scope BEFORE writing the new location's code. These are component-scoped, so moving within the same component is safe; moving to a different component needs prop-threading.
4. When adding a new asset import (like `prosalonLogo` to TabletCalendarView.jsx in C88), add the import at the top of the file matching the existing import style. Check the asset file exists: `src/assets/prosalon-logo.png`.

### C91 LESSON — A crash from a bad build is not a code bug. Rebuild first, investigate second.

When a live site crashes with a minified error (like `o is not a function`) and the source code looks correct, the issue may be a corrupted or mismatched build artifact from a previous session — not a logic error in the source. The correct first response is to **rebuild from the known-good source** in a clean environment and verify the build succeeds with zero errors. Only if the rebuild also crashes should you dig into the source for a code bug.

In C91: the crash (`index-CYFle5sE.js`, `o is not a function`) was caused by a bad build from the previous chat session. The C90 station source was correct. Rebuilding produced `index-DgW1rQUi.js` with zero errors and no code changes needed.

Also discovered: `public/tech/index.html` had very stale hashes (pre-C87). Always verify this file has current hashes before zipping — it is a static file that Vite never auto-updates.

### C90 LESSON — Station row-height zoom added.
`CalendarDayView.jsx` now has dynamic `rowH` state. The local `var ROW_H = rowH` alias means all existing ROW_H references in that file use the live value automatically. Tablet is unaffected — it uses its own `T_ROW_H` constant in `TabletCalendarView.jsx`.

### C89 LESSON — Samsung native keyboard suppression via inputMode=none.

VirtualKeyboard.jsx listens for `focusin` on INPUT/TEXTAREA. On Samsung tablets, the OS keyboard also fires on any focused input. Fix: on first focusin, set `inputMode="none"` on the element, then blur+refocus so Samsung sees `inputMode="none"` BEFORE deciding to show its keyboard. On second pass (after blur/refocus), proceed normally and show our black keyboard. On true focusout, restore the original inputMode.

Rule 25 (C89): NEVER remove the `kbCaptured` / `origInputMode` dataset attributes from VirtualKeyboard's focusin handler. They are what prevent Samsung keyboard from appearing.
Rule 26 (C89): NEVER skip the blur+refocus trick. Setting inputMode alone without blur+refocus does NOT suppress Samsung — the OS has already committed to showing its keyboard by the time our handler runs.
Rule 27 (C89): NEVER restore inputMode in focusout while focus is moving to a keyboard button — that would re-enable Samsung keyboard mid-session.

### C89 LESSON — ROW_H and T_ROW_H control BOTH the time column and the grid column simultaneously.

Both the left time-label column and the right appointment grid use the same ROW_H constant per 15-min slot. Changing ROW_H automatically keeps both columns in sync — no manual alignment needed. Do NOT apply separate height values to each column thinking they need individual adjustment.

Rule 28 (C89): NEVER set the time column row heights to a different value than ROW_H. They must always be the same constant.
Rule 29 (C89): NEVER set T_ROW_H to a value that makes a 30-min block fall below 44px (the Math.max floor in AppointmentBlocks). Below T_ROW_H=22, `2*T_ROW_H < 44` and all 30-min blocks hit the floor height.

### When adding a new payment field or column:
1. Prisma schema
2. Server route(s) create + update paths
3. Server formatter (checkoutHelpers.js formatTicket)
4. Station bridge (checkoutBridge.js buildReceiptPrintOpts)
5. All display files
6. Test: create → close → reopen → label persists
7. Print: ESC/POS + browser fallback
8. Reports: both ReportsModule.jsx + printServiceBuilders.js

### When adding real-time sync:
1. Server broadcast in routes/*.js + utils/broadcast.js
2. Station listener in App.jsx login useEffect
3. Tablet-only: listener in TabletApp's own useEffect
4. Visible indicator → check DateStatusDot

### When adding an interactive element on tablet that competes with scroll:
1. Hold-to-drag pattern (C83).
2. Non-passive window touchmove attached at touchstart (C84).
3. Momentum-scroll kill at drag activation (C85).
4. **Stop the scroll at the source** — set `overflow:'hidden'` on the scroll container during drag (C87).
5. Keep `touch-action: auto` on the element by default; flip to `none` only when drag is active.
6. Use refs for long-lived window handlers.
7. Track intentional programmatic scroll separately so it doesn't get undone.
8. If the page has scroll-event listeners that drive other UI (e.g. `syncScroll`), **do not** fight the browser by writing scroll back — that triggers those listeners and creates visible ping-pong.

---

## Session End Deliverables

1. Server zip (built frontend in public/) — **MUST include all 4 updated project knowledge files inside the zip**
2. Station source zip (local dev backup)

**When updating the 4 project files at session end:**
- ADD new content. NEVER delete or replace existing content.
- New session sections go AT THE TOP of each file's relevant area.
- All prior content stays below, intact, forever.
- The 4 project files live inside `prosalonpos-server/` so they deploy with the server and are always in sync.

---

## Deployment Reminder

Andy: Download server zip → GitHub Desktop → drag into prosalonpos folder → Commit → Push → Railway auto-deploys.

**PWA cache:** tablet users must fully close + reopen after every deploy. If still stale: Settings → Apps → ProSalonPOS → Storage → Clear cache.

---

## Build Reminder

Vite's build flow:
1. Vite generates `dist/index.html` with FRESH hashes each build.
2. Vite copies `public/tech/index.html` into `dist/tech/index.html` **unchanged** (it's a static copy).
3. **You MUST manually edit `public/tech/index.html` to reference the current build's hashes**, then re-copy to `dist/tech/index.html`, then bake into `server/public/`.

Hashes can change between builds even with no source changes (Vite timestamp-seeded). Always check actual dist/assets/ output after building and sync `public/tech/index.html` to match.

Verify both `public/index.html` AND `public/tech/index.html` in the server zip reference the SAME JS and CSS hashes after every build.

---

## Red Flags — STOP

- File > 800 lines after changes
- Any PROTECTED fix missing
- Server zip contains frontend source
- About to rewrite a function you don't understand
- Changes affect checkout / payments / money without explicit approval
- DB/server field added but only some display files updated
- `public/tech/tech/` orphan
- **Project file content was deleted or replaced instead of appended — STOP and restore**
- Touch long-press re-added to AppointmentBlocks — removed C73
- `orderedStaff.slice(0, visibleCols)` in calendar views — C74 bug
- hasSaved guard removed from [STAFF] useEffect — C76 bug
- TicketViewer storeOpen fallback changed — C78 crash
- Tablet Owner wired to full OwnerDashboard — C78 rule
- Tablet nav button reverted from `{...tap(fn)}` to plain `onClick={fn}` — C79 regression
- `src/lib/hooks/useTabletTap.js` removed or inlined — C79 regression
- Money-path button wrapped with `tap(fn)` — misuse
- `setTimeout(..., 400)` inside useTabletTap — C80 bug
- `onClick` re-added to the tablet branch of `useTabletTap` — C81 bug
- Both mouse+touch pairs on the tablet grid — C81 bug
- `installTapThroughShield` removed from App.jsx — C82 bug
- `TAP_THROUGH_WINDOW_MS` shortened below 500ms — C82 bug
- `e.preventDefault()` re-added to AppointmentBlocks tablet touchstart — C83 bug
- `touchAction: 'none'` hardcoded on AppointmentBlocks without condition — C83 bug
- `HOLD_MS` shortened below 300ms or widened above 600ms — C83
- Hold timer useEffect cleanup removed — C83 bug
- Station `CalendarDayView.jsx` passes `isTablet={true}` — C83 regression
- Window touchmove listener moved back inside `dragging`-gated useEffect — C84 bug
- Tablet window touchmove registered WITHOUT `{ passive: false }` — C84 bug
- `attachTabletWindowTouchListeners()` call removed from `handleBlockStart` — C84 bug
- `draggingRef` / `handleDragMoveRef` / `handleDragEndRef` or sync useEffect removed — C84 bug
- `windowTouchMoveHandlerRef`/`windowTouchEndHandlerRef` replaced with inline arrows — C84 bug
- `tabletTouchListenersAttachedRef` guard removed — C84 bug
- `detachTabletWindowTouchListeners()` removed from `handleDragEnd` or unmount — C84 bug
- `e.preventDefault()` called unconditionally inside window touchmove handler — C84 bug
- `overflow: hidden` set on grid CONTAINER (gridContainerRef) during drag — C85 rule (only set on gridRef via C87)
- `scrollTop = scrollTop` / `scrollLeft = scrollLeft` writes removed from `activatePendingHold` — C85 bug
- C85 scroll-freeze writes moved outside `activatePendingHold` — C85 bug
- **`scrollLockRef` re-introduced anywhere** — C87 rule: the whole "write scroll back" concept is wrong
- **Write-back to `scrollTop`/`scrollLeft` inside window touchmove handler** — C87 bug: creates scroll-event ping-pong that jerks the tech-name header
- **`originalOverflowRef` read or written outside `activatePendingHold`/`handleDragEnd`/unmount** — C87 rule violation
- **`gridRef.current.style.overflow = 'hidden'` set from station mouse path** — C87 bug: would break station's cursor+wheel drag
- **Auto-scroll interval's scroll writes replaced with a mechanism that doesn't fire `scroll` events** — C87 bug: would break header sync during drag-to-edge
- **`overflow` restore removed from `handleDragEnd`** — C87 bug: grid stuck non-scrollable forever
- **Owner or Clients or Appointment Log or Online Bookings re-added to top nav** — C88 rule violation: those live in sidebar Cal tab only
- **3rd MiniMonth (`monthOffset={2}`) re-added to sidebar** — C88: removed, do not restore
- **Button handlers changed during C88 relocation** — C88 rule: relocation only, behavior unchanged
- **Tablet top-nav logo removed** — C88 rule: logo belongs on tablet top nav now
- **Sidebar buttons shown under Turn or Wait tab** — C88 rule: only under Cal tab
- **`kbCaptured` / `origInputMode` logic removed from VirtualKeyboard focusin** — C89 bug: Samsung native keyboard will reappear
- **ROW_H in calendarHelpers.js set back to 28** — C89 regression: fewer hours visible on screen
- **T_ROW_H in TabletCalendarView.jsx set back to 36** — C89 regression: fewer hours visible on screen
- **buffer_minutes set back to 30** — C89 regression: 30-min padding before/after hours reappears
- **Time column row height set to a different value than ROW_H** — C89 rule: both columns must use same constant
