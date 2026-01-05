# SkinPro Web

Local Next.js UI backed by the existing SkinPro SQLite database and SkinProData folder.

Prereqs
- Node 20 LTS (avoid Node 24 for better-sqlite3 prebuilds)
- Run the current desktop app at least once so it creates SkinProData and the pointer file

Config lookup order
1) `SKINPRO_DATA_DIR` env var (optional override)
2) `~/.skinpro_config_location.json` pointer created by the desktop app

If `paths.json` is missing, the API will create it using defaults to match current behavior.

Run
- `npm install`
- `npm run dev`

Notes
- PDF generation uses `icons/corium_logo.png` (created from the original WebP).
- Use `[[highlight]]` and `[[/highlight]]` in directions to highlight text in PDFs.
- QR uploads use the local LAN IP. Override with `SKINPRO_QR_HOST` if needed.
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
- `GET /api/uploads/qr?cid=123&aid=456`
- `POST /api/uploads/qr?cid=123&aid=456`
- `GET /api/uploads/profile?cid=123`
- `POST /api/uploads/profile?cid=123`
- `GET /api/uploads/qr-code?mode=photo&client_id=123&appointment_id=456`

PDF prototype
- `npm run pdf:prototype`
- Output: `web/tools/out/prescription_2col.pdf`
