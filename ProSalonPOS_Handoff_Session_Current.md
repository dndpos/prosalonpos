# ProSalonPOS — Session Handoff (Current)

**Session Date:** 2026-04-02
**Engineer:** Claude (Cindy)

---

## What Was Done This Session

### 1. Prisma 7.6.0 Migration (prosalonpos-server)

**Problem:** `prisma migrate` failed with P1012 — `datasource url` is no longer supported in `schema.prisma` in Prisma 7.

**Fixes:**
- Removed `url = env("DATABASE_URL")` from `prisma/schema.prisma` datasource block
- Created `prisma.config.js` with `defineConfig` to hold the datasource URL (new Prisma 7 pattern)
- Updated `package.json`: upgraded `prisma` + `@prisma/client` from `^5.22.0` to `^7.6.0`
- Added `pg` and `@prisma/adapter-pg` packages
- Updated `src/config/database.js` to use `pg.Pool` + `PrismaPg` driver adapter (required for Prisma 7 query compiler)
- Ran `prisma migrate reset --force` + `prisma migrate dev --name init` to rebuild dev DB

### 2. Dev Mode Detection Fix (prosalonpos-station)

**Problem:** All API base URL logic used `window.location.port === '5173'` which breaks when Vite uses a different port.

**Fixes:** Replaced all occurrences with `import.meta.env.DEV` (Vite built-in) across:
- `src/lib/apiClient.js`
- `src/lib/providerApiClient.js`
- `src/lib/socket.js`
- `src/App.jsx`
- `src/modules/auth/LicenseActivationScreen.jsx`
- `src/modules/auth/LoginScreen.jsx`
- `src/components/ui/PinPopup.jsx`

### 3. .gitignore (repo root)

Created `.gitignore` at repo root covering `node_modules/` for both sub-projects and all `.env` files.

### 4. Bootstrap Missing category_ids on Services

**Problem:** Services loaded from `/api/v1/bootstrap` had no `category_ids` — they never appeared in the service grid.

**Fix:** Updated `prosalonpos-server/src/routes/bootstrap.js`:
- Added `include: { category_links: true }` to services query
- Added `category_ids` mapping: `obj.category_ids = s.category_links.map(l => l.category_id)`
- Added salon existence check: returns `404 { error: 'SALON_NOT_FOUND' }` when salon no longer exists

### 5. SALON_NOT_FOUND Auto-Unpair

**Problem:** After a DB reset, the stored JWT had a stale `salon_id` causing FK constraint errors on every write.

**Fixes:**
- `useBootstrap.js`: added detection of `err.status === 404 && err.data.error === 'SALON_NOT_FOUND'` → calls `unpairStation()` + `window.location.reload()`
- `App.jsx`: added `?reset` URL handler at module load — visiting `localhost:5173?reset` clears all pairing localStorage and reloads to pairing screen

### 6. Category Deactivate / Restore Feature (ServiceCatalogScreen + CategoryGrid)

**New feature:** Owner can deactivate and restore service categories.

**How it works:**
- In edit mode, each active category tile has a `⋯` context menu with "Deactivate" option
- Inactive category tiles show a green "Restore" button (bottom-right corner)
- "Show Inactive" checkbox in CategoryGrid footer reveals inactive tiles so they can be restored
- Toggling active state calls `svcStore.updateCategory(catId, { active: newActive })` to persist to DB
- When the last active category is deactivated, `activeCat` is set to `null` so the service grid clears correctly

**UI changes in CategoryGrid:**
- Stacked layout in footer: "Show Inactive" checkbox on top, column +/− controls below
- Both rows have soft `rgba(255,255,255,0.05)` background
- "Restore" button only on inactive tiles; `⋯` menu only on active tiles

### 7. catSlots Empty-Object Bug Fix (App.jsx)

**Problem (critical):** When all categories were deactivated, `catSlots` became `{}` (empty). This got saved to `salon_settings.grid_layout`. On the next page load, the saved `catSlots: {}` was restored — wiping the auto-built slots — making categories permanently invisible even after reactivation. This created an unrecoverable loop.

**Root cause:** Two issues:
1. The restore logic applied saved `catSlots` even when it was an empty object (truthy but useless)
2. The save logic wrote `catSlots: {}` to the DB

**Fixes in `App.jsx`:**
- Restore guard: `if (gl.catSlots && Object.keys(gl.catSlots).length > 0) setSvcCatSlots(gl.catSlots);`
- Save guard: `if (Object.keys(svcCatSlots).length === 0) return;` — never persist an empty catSlots

**DB recovery (one-time):**
```sql
UPDATE "ServiceCategory" SET active = true WHERE active = false;
UPDATE "SalonSettings" SET settings = settings - 'grid_layout';
```
Ran directly via psql to reactivate all 5 categories and clear the corrupted grid_layout.

---

## Files Changed

| File | Change |
|------|--------|
| `prosalonpos-server/prisma/schema.prisma` | Removed datasource url |
| `prosalonpos-server/prisma.config.js` | Created — Prisma 7 config |
| `prosalonpos-server/package.json` | Prisma 7.6.0, added pg + adapter-pg |
| `prosalonpos-server/src/config/database.js` | Driver adapter pattern |
| `prosalonpos-server/src/routes/bootstrap.js` | category_ids fix, SALON_NOT_FOUND |
| `prosalonpos-station/src/lib/apiClient.js` | DEV detection fix |
| `prosalonpos-station/src/lib/providerApiClient.js` | DEV detection fix |
| `prosalonpos-station/src/lib/socket.js` | DEV detection fix |
| `prosalonpos-station/src/lib/hooks/useBootstrap.js` | SALON_NOT_FOUND auto-unpair |
| `prosalonpos-station/src/App.jsx` | ?reset handler, catSlots empty-object guards |
| `prosalonpos-station/src/modules/auth/LicenseActivationScreen.jsx` | DEV detection fix |
| `prosalonpos-station/src/modules/auth/LoginScreen.jsx` | DEV detection fix |
| `prosalonpos-station/src/components/ui/PinPopup.jsx` | DEV detection fix |
| `prosalonpos-station/src/components/domain/CategoryGrid.jsx` | Restore button, Show Inactive, stacked footer |
| `prosalonpos-station/src/modules/services/ServiceCatalogScreen.jsx` | handleToggleCategory persist, activeCat null on last deactivate |
| `.gitignore` | Created at repo root |

---

## Known State at Session End

- All 5 categories (Hair, Nails, Color, Skin, Men) are `active: true` in DB
- `grid_layout` cleared from `SalonSettings` — will rebuild from category positions on next load
- Server running on `localhost:3001`, frontend on `localhost:5173`
- FK constraint / stale JWT issue: the `?reset` URL handler exists but user may still need to re-pair if JWT is stale

## Tech Debt Introduced

- None new

## Outstanding Issues

- The `?reset` URL param flow needs end-to-end verification — confirm it shows the pairing screen after clearing localStorage
- If the FK constraint error recurs on category/service writes, the JWT is still stale — user should visit `localhost:5173?reset` to re-pair
