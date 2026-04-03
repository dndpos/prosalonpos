# ProSalonPOS — Project Context for Claude Code

> **This file gives Claude Code (Cindy) full context about the ProSalonPOS project.**
> Place this file in the root of the repo: `C:\Users\MarketMaker\Documents\GitHub\prosalonpos\CLAUDE.md`

---

## Project Overview

ProSalonPOS is a full-featured multi-tenant salon point-of-sale system. It consists of two sub-projects:

- `prosalonpos-station` — React/Vite frontend (~158 files)
- `prosalonpos-server` — Node.js/Express/Prisma backend (~29 files)

**Owner/Stakeholder:** Alex (Phat Tran) — sole product decision-maker
**Business model:** True multi-tenant — one deployment serves all salons via `salon_id` isolation
**Hosting:** Railway (PostgreSQL) for production; local PostgreSQL for development

---

## Local Development Setup

- **Database:** PostgreSQL 17 at `localhost:5432`, database `prosalonpos`, user `postgres`, password `salon123`
- **Server:** `cd prosalonpos-server && npm run dev` → runs on `localhost:3001`
- **Frontend:** `cd prosalonpos-station && npm run dev` → runs on `localhost:5173` (or next available port)
- **Prisma:** Version 7.6.0 with `prisma.config.js` for datasource URL (not in schema.prisma)
- **Dev detection:** Use `import.meta.env.DEV` (Vite built-in), NEVER `window.location.port === '5173'`

---

## Hard Coding Rules (MUST FOLLOW)

### File Rules
- **800-line hard cap per file** — split proactively before adding features
- No TypeScript — JavaScript only
- Use `var` declarations (no `const`/`let` in most places)
- Inline styles using theme tokens from `useTheme()` hook
- Color tokens come exclusively from `useTheme()` hook — never reference `C` from `calendarHelpers.js` for colors
- Never put `C./T.` references at module scope

### UI Rules
- No `<button>`, `<input>`, or `<select>` for price/number fields — use `div onClick` (Chrome kiosk virtual keyboard issue)
- All standalone numpads: calculator layout (7-8-9 top, 4-5-6 middle, 1-2-3 bottom)
- All price inputs: cash register mode (digits shift left through fixed decimal, e.g., 3500 = $35.00)
- All clickable tabs: styled as proper button tabs (background, border, border-radius, hover states) — never plain underlined text
- Minimum touch target: 44×44px on all interactive elements
- Minimum body font: 14px; absolute floor: 12px
- When modals need more space, expand horizontally (wider), not vertically
- Numpads must appear next to the field they control, not in a separate column
- Popups should sit toward the top of the screen rather than centered

### Component Rules
- `CategoryGrid`, `ServiceGrid`, `EmployeeGrid` in `src/components/domain/` — any screen showing services/categories must use these (never inline rendering)
- Owner layout state (`catSlots`, `svcSlots`, `empSlots`, column/row counts) lives in `App.jsx` and flows down as props
- All grid layout state must be persisted to `salon_settings` in the database — pushing an update must never wipe a salon's configured layout
- No cross-module imports — shared code lives in `src/components/ui/`, `src/components/domain/`, or `src/lib/`

### Style Patterns
- **Softcolor button style**: dark muted background + matching lighter text, each button a different color tone (reference: BookingFlow top bar with teal, indigo, amber, slate-green)
- Customer-facing screens (Kiosk, CustomerDisplay, OnlineBooking) keep their own light palettes — not themed
- `_isProduction` must be defined at module scope in `App.jsx`, not inside the component function

---

## Architecture Rules

### Multi-Tenant
- Every query must filter by `salon_id`
- New customers get a salon record via bootstrap and pair their station with a unique salon code
- No new infrastructure per customer

### PIN Authentication (3-Level Check)
The `verify-any-pin` endpoint must check in this order:
1. Staff PINs in the Staff table
2. Owner PIN on the Salon record (default: 0000)
3. Provider master code: 90706

**Important:** The owner PIN lives on the Salon record, NOT the Staff table.

### PIN Entry Pattern (Toast/Oracle Simphony Style)
- No debounce, no spinner
- PIN check fires immediately at 4+ digits
- Silence on mismatch until max length of 8 digits
- Fire-and-forget pattern

### API Rules
- All mock data permanently removed — app is API-only
- Every store uses `source: pending→api→error`
- Red banner shown when server disconnected
- Bridge files (`*Bridge.js`) replaced `*MockData.js`
- API responses must use named wrapper objects matching specific keys per domain (e.g., `{ staff: [...] }` not flat arrays)

### Database
- bcrypt rounds and library consistency matter — mismatches between `bcrypt` and `bcryptjs` cause hash incompatibility
- Bootstrap rehash safety net on server startup prevents corrupt owner PIN hashes
- Never use regex-based bulk patching for color token migration

---

## Locked Business Decisions (DO NOT CHANGE)

### Void & Refund
- Void = same-day only; refund = no time limit
- Once a refund exists on a ticket, void is disabled
- Commission reversed on void/refund (debits current pay period if crossed)
- Loyalty points clawed back on void/refund
- Gift card balance restored on void/refund
- Inventory NOT auto-restocked on void/refund

### Payments
- Cash/Zelle single-payment auto-removes tip (tip collected outside system)
- Split payments keep tip
- "Add Tip" on closed credit card tickets ALWAYS requires manager/owner PIN — not configurable
- Credit card checkout requires no integrated terminal — system records payment method and amount only
- No card on file — EVER. All payments collected at time of transaction. Permanent architectural decision.

### Commission
- No commission on package sales (prepaid revenue)
- Techs earn commission at redemption time at full catalog price
- Commission calculated at payroll, NOT at checkout
- Checkout records data only — no commission amount stored at checkout time
- Daily guarantee: `days_worked × daily_rate` vs. commission earned — tech gets whichever is higher
- `$0` daily rate = no guarantee
- Resolution priority: per-tech per-item > per-tech per-category > per-tech flat > location per-item > location per-category > location flat

### Deposits & Cancellations
- Deposits optional per salon, paid upfront at booking, applied to total at checkout
- No card on file ever — deposit is a completed payment at booking time
- Cancellation window in hours set by owner
- Cancel within window = full refund
- Cancel outside window = owner rules (forfeit all, partial refund, or full refund)
- No-show deposit rule configured independently from cancellation rule

### Gift Cards
- Digital and physical cards supported
- Gift cards never expire
- Partial redemption always allowed
- Can be linked to client profile or used as standalone codes
- Gift card purchases never earn loyalty points

### Loyalty
- Three earn methods: per dollar, per visit, or both
- Two reward types: dollar discount and free service
- Tier auto-promotion based on lifetime points (not current balance)
- Points awarded at checkout completion, reversed on void/refund
- Per-item earn control (owner toggles per service/product)

### Booking
- 15-minute booking increment
- Double-booking allowed silently, no system warnings
- Client tech requests bypass rotation (tech turn)
- Confirmation system optional per salon
- Duration override in 15-minute increments

### Calendar
- 30-minute buffer before opening and after closing time (e.g., 9AM–7PM → grid shows 8:30AM–7:30PM)
- Time column: separate div (`TIME_COL_W=64px`), synced to grid via JS scroll listener
- Grid: 20px per 15-min slot; `COL_MIN_W=90`
- Current time indicator: red horizontal line with dot

### Receipts & Printing
- QZ Tray for silent thermal printing
- Epson TM-T20 series
- ESC/POS commands in `src/lib/printService.js`

---

## Owner Dashboard Rules
- No global nav bar — renders full-screen with "← Staff View" in sidebar footer
- Sidebar is master hub — never gets covered
- All owner content renders in right panel
- CalendarDayView has Owner tab in top bar → calls `onOwnerClick` → sets `activePage='dashboard'`

---

## Files Approaching 800-Line Limit (Monitor)

| File | Lines | Status |
|------|-------|--------|
| printService.js | ~790 | CRITICAL — at limit |
| App.jsx | ~792 | CRITICAL |
| AppointmentDetailPopup.jsx | ~790 | CRITICAL |
| SalonSettingsPanel.jsx | ~786 | CRITICAL |
| PayrollModule.jsx | ~780 | CRITICAL |
| CheckoutScreen.jsx | ~738 | Monitor |
| CalendarDayView.jsx | ~723 | Monitor |

---

## Deployment Notes

### Railway (Production)
- Cannot change Railway region on an existing project — requires new project creation
- Current server in `asia-southeast1` (Singapore) causing latency — needs migration to `us-east4`
- Railway build phase cannot run `prisma generate` due to network restrictions — `prisma` must be in `dependencies` with `postinstall` script
- Railway Watch Paths field must be empty for auto-deploy to work
- GitHub repo: `github.com/dndpos/prosalonpos`
- Railway auto-deploys from main branch

### Local Development
- Database at `C:\ProgramData\ProSalonPOS\` for offline mode (deferred)
- Local dev uses PostgreSQL at localhost:5432

---

## Communication Style with Alex

- Alex is direct, informal, uses shorthand ("let go," "continue," "please" = approval)
- Describes UI issues in plain language, often with screenshots (sent to claude.ai, not here)
- Does not want unnecessary explanations or questions — debug and fix
- Prefers discussing approach before building when he says "dont build"
- Gets frustrated when fixes break other things or when asked obvious steps

---

## Deferred Features (Do Not Build Yet)

- **Phase 4 offline mode** — PWA + IndexedDB
- **Payment terminal integration** — PAX, Dejavoo, Clover (waiting on First Data SDK)
- **Provider Admin Panel** — web-based management for Andy (the ISO provider)
- **Technician phone view** — personal phone PWA with PIN + salon code login
- **Service tablet at tech station** — shows services/prices, prints slip
- **Staged rollout architecture** — separate staging vs production branches
- **Customer self-setup** — website-based onboarding (Phase 4)

---

## Session Documentation

At the end of each work session, update these files in the repo:
- `ProSalonPOS_Handoff_Session_Current.md` — what changed this session
- `ProSalonPOS_TechDebt_Session_Current.md` — current tech debt tracker
- `ProSalonPOS_Engineering_Standards_Current.md` — coding standards (if changed)

---

## Quick Reference: Key Salon Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| tax_rate_percentage | decimal | 0 | Tax rate for all transactions |
| tip_presets | array | [15,20,25] | Preset tip percentage buttons |
| tip_distribution_mode | enum | even | Multi-tech tip split: even, proportional, per_tech |
| void_refund_permission | enum | owner_only | Who can void/refund |
| discount_permission | enum | manager_owner | Who can apply discounts |
| commission_enabled | boolean | false | Master commission toggle |
| gift_card_enabled | boolean | false | Master gift card toggle |
| loyalty_enabled | boolean | false | Master loyalty toggle |
| receipt_options | array | [print] | Available receipt methods |

---

*This file is the single source of truth for project rules and context. Keep it updated.*
