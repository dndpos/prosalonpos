# ProSalonPOS — Railway Deployment Guide

**Session 91**

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

|Setting|Value|
|-|-|
|**Root Directory**|*(leave BLANK — do NOT set to /prosalonpos-server)*|
|**Build Command**|`cd prosalonpos-server \&\& npm install \&\& node scripts/build-railway.js`|
|**Start Command**|`cd prosalonpos-server \&\& node src/server.js`|

**Why Root Directory must be blank:** Railway needs to see both folders during the build. The build script navigates into `prosalonpos-station/` to install and build the frontend, then copies the output to `prosalonpos-server/public/`. If Root Directory is set, Railway isolates to that folder and the frontend can't be found.

## Environment Variables

|Variable|Value|Notes|
|-|-|-|
|`DATABASE\_URL`|*(auto-set by Railway)*|PostgreSQL connection string|
|`JWT\_SECRET`|*(auto-generated or set manually)*|Used for auth tokens|
|`PORT`|*(auto-set by Railway)*|Railway assigns this|

## What the Build Script Does

1. `cd prosalonpos-server \&\& npm install` — installs server dependencies
2. `node scripts/build-railway.js` runs:

   * `npx prisma generate` — generates Prisma client
   * `npx prisma db push` — creates/updates database tables
   * `npm install` in `../prosalonpos-station/` — installs frontend deps
   * `npx vite build` in `../prosalonpos-station/` — builds React app
   * Copies `prosalonpos-station/dist/` → `prosalonpos-server/public/`

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

On Railway (PostgreSQL), license returns `dev\_mode` — activation screen is skipped.

## Updating

Push to GitHub → Railway auto-deploys → build script rebuilds frontend + pushes schema.

## Current Instance

* **URL:** prosalonpos-production.up.railway.app
* **Salon code:** 7AVM8Z
* **Owner PIN:** 0000
* **Manager PIN:** 1234
* 

