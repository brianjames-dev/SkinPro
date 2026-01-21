# SkinPro Web

Local Next.js UI backed by the existing SkinPro SQLite database and SkinProData folder.

Prereqs
- Node 20 LTS (avoid Node 24 for better-sqlite3 prebuilds)
- Run the current desktop app at least once so it creates SkinProData and the pointer file
- Set `SKINPRO_PIN` to enable the access gate

Security config
- `SKINPRO_PIN` access PIN for the web UI and API
- `SKINPRO_AUTH_TTL_MINUTES` cookie TTL (default: 10080 = 7 days)
- `SKINPRO_AUTH_SECRET` optional HMAC secret override
- `SKINPRO_AUTH_DISABLED=1` to bypass auth (local dev only)
- `SKINPRO_QR_TOKEN_TTL_MINUTES` QR upload token TTL (default: 10)
- `SKINPRO_QR_LAN=1` to allow LAN QR links (default is localhost only)

News config
- `SKINPRO_NEWS_CACHE_MINUTES` news cache TTL (default: 360)
- `SKINPRO_NEWS_MAX` max stories per refresh (default: 18)

Config lookup order
1) `SKINPRO_DATA_DIR` env var (optional override)
2) `~/.skinpro_config_location.json` pointer created by the desktop app

If `paths.json` is missing, the API will create it using defaults to match current behavior.

Run
- `npm install`
- `npm run dev`

Notes
- PDF generation uses `SkincareByAmelia.png` in the repo root.
- Use `[[highlight]]` and `[[/highlight]]` in directions to highlight text in PDFs.
- QR uploads default to localhost; use `SKINPRO_QR_HOST` or `SKINPRO_QR_LAN=1` to enable LAN QR links.
- Prescription templates are stored in `SkinProData/prescriptions/templates.json`.

Endpoints
- `GET /api/health`
- `GET /api/clients?limit=25&q=search`
- `GET /api/clients/[id]`
- `POST /api/clients`
- `PATCH /api/clients/[id]`
- `DELETE /api/clients/[id]`
- `GET /api/clients/[id]/health`
- `PUT /api/clients/[id]/health`
- `GET /api/appointments?client_id=123`
- `POST /api/appointments`
- `GET /api/appointments/[id]`
- `PATCH /api/appointments/[id]`
- `DELETE /api/appointments/[id]`
- `GET /api/alerts`
- `POST /api/alerts`
- `PATCH /api/alerts/[id]`
- `DELETE /api/alerts/[id]`
- `GET /api/photos?client_id=123&appointment_id=456`
- `POST /api/photos`
- `PATCH /api/photos/[id]`
- `DELETE /api/photos/[id]`
- `GET /api/photos/[id]/file`
- `GET /api/clients/[id]/profile-picture`
- `POST /api/clients/[id]/profile-picture`
- `GET /api/prescriptions?client_id=123`
- `POST /api/prescriptions`
- `GET /api/prescriptions/[id]`
- `PATCH /api/prescriptions/[id]`
- `DELETE /api/prescriptions/[id]`
- `GET /api/prescriptions/[id]/file`
- `POST /api/prescriptions/[id]/copy`
- `GET /api/prescriptions/templates`
- `POST /api/prescriptions/templates`
- `DELETE /api/prescriptions/templates/[id]`
- `GET /api/uploads/qr?token=...`
- `POST /api/uploads/qr?token=...`
- `GET /api/uploads/profile?token=...`
- `POST /api/uploads/profile?token=...`
- `GET /api/uploads/qr-code?mode=photo&client_id=123&appointment_id=456`
- `GET /api/news?topics=facials,electrolysis&refresh=1`

PDF prototype
- `npm run pdf:prototype`
- Output: `src/tools/out/prescription_2col.pdf`
