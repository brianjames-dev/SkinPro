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

## Risks (Mitigated / Remaining)
- QR **upload** pages are public but require a short-lived, single-use token.
- QR **minting** (`/api/uploads/qr-code`) requires an authenticated session (not public).
- Prescription share page + image APIs are public but require a short-lived, single-use token.
- Request-level QR `host` override is disabled; host is derived from env / LAN settings and private-host checks.
- Profile picture paths are not client-writable via JSON create/update APIs.

## Security Roadmap

### Step 1: Access Gate (Auth/PIN)
**Goal**: Prevent unauthenticated access to UI + API.  
**Status**: Implemented.  
**Plan**: Require a simple local PIN for UI + API; public exceptions only for token-bearing phone flows.

### Step 2: Short‑lived QR / Share Tokens
**Goal**: Limit QR upload and prescription share exposure.  
**Status**: Implemented.  
**Plan**:
- Token TTL: 10 minutes (configurable)
- Single-use: atomic consume on successful upload / first successful share render
- Upload tokens tied to `client_id` and (for photos) `appointment_id`
- Share tokens tied to `prescription_id`

### Step 3: Upload Limits + Validation
**Goal**: Reduce disk abuse and validate real images.  
**Status**: Implemented.  
**Defaults**:
- Photos: max 20 files/request, max 12 MB/file, max 150 MB/request
- Profile pic: max 1 file, max 8 MB/file
- Allowed types: jpeg, png, webp, heic/heif
- Validate MIME + extension + decode/re‑encode (sharp strict) + optional magic-byte helper

### Step 4: Rate Limiting
**Goal**: Throttle abusive or accidental request storms.  
**Status**: Implemented.  
**Defaults** (per IP + endpoint; IP from connection unless `SKINPRO_TRUST_PROXY=1`):
- Login: 5/min, 20/hour
- QR uploads: 10/min, 120/hour
- Profile uploads: 5/min, 60/hour
- General writes: 60/min
- Reads: 300/min

### Step 5: Localhost Default, LAN Opt‑in
**Goal**: Avoid LAN exposure by default.  
**Status**: Implemented.  
**Plan**: Bind to localhost unless explicit opt‑in is provided (env/flag).

### Step 6: Path containment
**Goal**: Never delete/serve files outside the data directory.  
**Status**: Implemented on photo/prescription/profile serve paths, client asset delete, and appointment photo cleanup.

## UX Impact Summary
- Small login step (PIN) when launching the web UI.
- QR uploads remain the same UX, with automatic token expiry and single-use after upload.
- Prescription share links work without PIN (token only) and expire after first successful image load or TTL.
- Upload errors only when limits are exceeded.
- Normal usage unaffected; rate limits only stop abusive patterns.

## Configuration
- `SKINPRO_PIN` access PIN for the web UI and API (required in production)
- `SKINPRO_AUTH_TTL_MINUTES` cookie TTL (default: 10080 = 7 days)
- `SKINPRO_AUTH_SECRET` HMAC secret for auth cookies (**recommended**; falls back to PIN with warning)
- `SKINPRO_AUTH_DISABLED=1` to bypass auth (**dev only**; ignored in production)
- `SKINPRO_COOKIE_SECURE=1` force Secure cookies (auto when request is HTTPS)
- `SKINPRO_TRUST_PROXY=1` trust `X-Forwarded-For` for rate-limit keys
- `SKINPRO_QR_TOKEN_TTL_MINUTES` QR upload token TTL (default: 10)
- `SKINPRO_SHARE_TOKEN_TTL_MINUTES` prescription share token TTL (default: 10)
- `SKINPRO_QR_LAN=1` to enable LAN QR links (default is localhost only)
- `SKINPRO_QR_HOST` optional fixed QR base URL (must be private/loopback or on allowlist)
- `SKINPRO_QR_HOST_ALLOWLIST` comma-separated allowed QR hosts/origins
