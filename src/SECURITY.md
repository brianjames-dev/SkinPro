# Security Plan (Web)

This document captures the current data flow and the staged security hardening plan
for the local SkinPro web UI.

## Current Data Flow
- The web UI connects to an existing SQLite database created by the desktop app.
- Data directory resolution order:
  1) `SKINPRO_DATA_DIR` env var (override)
  2) `~/.skinpro_config_location.json` pointer file created by the desktop app
- Paths are stored in `SkinProData/paths.json` (created if missing):
  - `database` (default: `SkinProData/skinpro.db`)
  - `photos` (default: `SkinProData/images`)
  - `profile_pictures` (default: `SkinProData/profile_pictures`)
- Photos and PDFs are stored on disk, with file paths saved in the SQLite DB.

## Risks (Current)
- QR upload endpoints are reachable on the LAN but require a valid token.
- QR host override can generate URLs pointing anywhere.

## Security Roadmap (Planned)

### Step 1: Access Gate (Auth/PIN)
**Goal**: Prevent unauthenticated access to UI + API.  
**Status**: Implemented.  
**Plan**: Require a simple local PIN or token for all `/api/*` routes and UI.

### Step 2: Short‑lived QR Tokens
**Goal**: Limit QR upload exposure.  
**Status**: Implemented.  
**Plan**:
- Token TTL: 10 minutes
- Single‑use: invalid after successful upload
- Tied to `client_id` and (for photos) `appointment_id`

### Step 3: Upload Limits + Validation
**Goal**: Reduce disk abuse and validate real images.  
**Status**: Implemented.  
**Defaults**:
- Photos: max 20 files/request, max 12 MB/file, max 150 MB/request
- Profile pic: max 1 file, max 8 MB/file
- Allowed types: jpeg, png, webp, heic/heif
- Validate MIME + extension + decode/re‑encode

### Step 4: Rate Limiting
**Goal**: Throttle abusive or accidental request storms.  
**Status**: Implemented.  
**Defaults** (per IP + endpoint):
- QR uploads: 10/min, 120/hour
- Profile uploads: 5/min, 60/hour
- General writes: 60/min
- Reads: 300/min

### Step 5: Localhost Default, LAN Opt‑in
**Goal**: Avoid LAN exposure by default.  
**Status**: Implemented.  
**Plan**: Bind to localhost unless explicit opt‑in is provided (env/flag).

## UX Impact Summary
- Small login step (PIN) when launching the web UI.
- QR uploads remain the same UX, with automatic token expiry.
- Upload errors only when limits are exceeded.
- Normal usage unaffected; rate limits only stop abusive patterns.

## Configuration
- `SKINPRO_PIN` access PIN for the web UI and API
- `SKINPRO_AUTH_TTL_MINUTES` cookie TTL (default: 10080 = 7 days)
- `SKINPRO_AUTH_SECRET` optional HMAC secret override
- `SKINPRO_AUTH_DISABLED=1` to bypass auth (local dev only)
- `SKINPRO_QR_TOKEN_TTL_MINUTES` QR upload token TTL (default: 10)
- `SKINPRO_QR_LAN=1` to enable LAN QR links (default is localhost only)
Future limits (upload/rate) will be configurable via env vars to fit small vs. large
clinics and slower vs. faster networks.
