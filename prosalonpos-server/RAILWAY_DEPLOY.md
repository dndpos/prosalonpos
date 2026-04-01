# ProSalonPOS — Railway Deployment Guide

**Session 89**

## Overview

ProSalonPOS runs as a single Railway service. The server (Node.js/Express) serves both the API and the built frontend. Railway provisions a PostgreSQL database automatically.

## Repository Structure for Railway

Upload BOTH folders to a single GitHub repo or Railway project:

```
prosalonpos/
├── prosalonpos-station/     ← Frontend (React/Vite)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── prosalonpos-server/      ← Backend (Express/Prisma) — deploy root
    ├── src/
    ├── prisma/
    ├── scripts/
    └── package.json
```

## Railway Setup Steps

### 1. Create a New Project
- Go to railway.app → New Project → Deploy from GitHub repo
- Set the **Root Directory** to `prosalonpos-server`

### 2. Add PostgreSQL
- In the project, click "+ New" → "Database" → "PostgreSQL"
- Railway auto-sets `DATABASE_URL` for you

### 3. Set Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | *(auto-set by Railway)* | PostgreSQL connection string |
| `JWT_SECRET` | *(generate a random 32+ char string)* | Used for auth tokens |
| `PORT` | *(auto-set by Railway)* | Railway assigns this |
| `NODE_ENV` | `production` | Optional, for logging |
| `FRONTEND_URL` | `https://your-app.railway.app` | Optional, for CORS |

### 4. Configure Build & Start Commands

In Railway service settings:

- **Build Command:** `npm install && node scripts/build-railway.js`
- **Start Command:** `node src/server.js`

### 5. Deploy

Push to GitHub or click "Deploy" in Railway. The build script will:
1. Install server dependencies
2. Run `prisma generate` and `prisma migrate deploy`
3. Install and build the frontend
4. Copy built frontend to `public/` folder
5. Start the server

## What Happens on First Run

When the server starts with an empty database:
1. Prisma migrations create all tables
2. Auto-bootstrap creates a salon with a random 6-character code
3. Default data is seeded: 5 categories, 15 services, salon settings, 1 manager
4. Console shows the salon code, owner PIN (0000), and manager PIN (1234)

## Logging Into the App

1. Open `https://your-app.railway.app` in a browser
2. **Station Setup screen** appears — enter the salon code shown in Railway logs
3. **Login screen** appears — enter PIN `0000` (owner) or `1234` (manager)
4. You're in!

## License Check

On Railway (PostgreSQL mode), the license check returns `dev_mode` — the license activation screen is **skipped entirely**. Licensing only applies to the self-hosted .exe installer (SQLite mode).

## Updating

Push new code to GitHub. Railway auto-deploys. The build script re-runs frontend build + Prisma migrations.

## Troubleshooting

**"Server not connected" on login screen:**
- Check Railway logs — is the server running?
- Check that DATABASE_URL is set correctly

**Empty calendar / no data:**
- Check Railway logs for `[Bootstrap]` messages
- The bootstrap only runs once. If the salon already exists, it won't re-seed
- To reset: delete the PostgreSQL database in Railway and redeploy

**Station setup screen keeps appearing:**
- The salon code is only shown in the server logs on first run
- Check Railway's Deploy Logs for `[Bootstrap] ✅ New salon created — code: XXXXXX`
