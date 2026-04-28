# ProSalonPOS — Railway Deployment Guide

**Session V23 — Fixed**

## Overview

ProSalonPOS runs as a single Railway service. The server (Node.js/Express) serves both the API and the built frontend. Railway provisions a PostgreSQL database automatically.

## Repository Structure

```
prosalonpos/                     ← GitHub repo root
├── prosalonpos-station/         ← Frontend (React/Vite)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── prosalonpos-server/          ← Backend (Express/Prisma)
    ├── src/
    ├── prisma/
    ├── scripts/build-railway.js
    └── package.json
```

## Railway Settings

| Setting | Value |
|---------|-------|
| **Root Directory** | *(leave BLANK)* |
| **Build Command** | `node scripts/build-railway.js` |
| **Custom Start Command** | `node src/server.js` |

**Note:** Railway's Railpack auto-detects the server folder and copies only its contents into `/app/`. The `cd prosalonpos-server` prefix is NOT needed — Railpack already runs from inside the server folder. The frontend is pre-built locally and committed as `public/` inside the server folder.

## Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | *(auto-set by Railway)* | PostgreSQL connection string |
| `JWT_SECRET` | *(auto-generated or set manually)* | Used for auth tokens |
| `PORT` | *(auto-set by Railway)* | Railway assigns this |

## What the Build Script Does

1. Railway's Railpack detects Node.js, runs `npm ci` automatically
2. `node scripts/build-railway.js` runs:
   - `npx prisma generate` — generates Prisma client
   - Verifies pre-built frontend exists in `public/`
3. On server start, `prisma db push` creates/updates database tables
4. Server auto-bootstraps salon data on first run

## What Happens on First Run

1. Prisma creates all database tables
2. Server auto-bootstraps: creates salon with random 6-char code
3. Seeds: 5 categories, 15 services, salon settings, 1 manager
4. Console shows salon code, owner PIN (0000), manager PIN (1234)

## Logging In

1. Open `https://your-app.railway.app`
2. **Station Setup** — enter salon code from Railway deploy logs
3. **Login** — enter PIN `0000` (owner) or `1234` (manager)

## License Check

On Railway (PostgreSQL), license returns `dev_mode` — activation screen is skipped.

## Updating

Push to GitHub → Railway auto-deploys → build script rebuilds frontend + pushes schema.

## Current Instance

- **URL:** prosalonpos-production.up.railway.app
- **Salon code:** 7AVM8Z
- **Owner PIN:** 0000
- **Manager PIN:** 1234

