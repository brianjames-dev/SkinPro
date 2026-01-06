# SkinPro Web Migration Roadmap

Goals and constraints
- Local/offline single-user workflow
- TS/JS frontend with a Node API
- Reuse the existing SQLite schema and SkinProData folder
- Optional cloud sync later, no changes required now

Phase 0 - API foundation (read-only)
- Read SkinProData config and open SQLite
- Add basic health and clients endpoints
- Stream local files via API (photos, PDFs)

Phase 1 - Core UI (clients + info + appointments)
- Clients list, search, create, edit, delete
- Client info and health data editing
- Appointments list, create, edit, delete

Phase 2 - Photos and profile pictures
- Photo upload and preview
- Appointment photo linking and deletion
- Profile picture upload

Phase 3 - Prescriptions and PDF generation
- Port 2/3/4 column prescriptions to Node
- PDF preview and download
- Match output with current ReportLab layouts

Phase 4 - Alerts, polish, and packaging
- Alerts CRUD
- UI polish and performance passes
- Optional desktop wrapper (Electron or Tauri)

Tab-to-endpoint mapping (initial sketch)
- Clients tab: GET/POST /api/clients, GET/PATCH/DELETE /api/clients/[id]
- Info tab: GET/PUT /api/clients/[id]/health
- Appointments tab: GET/POST /api/appointments, PATCH/DELETE /api/appointments/[id]
- Photos tab: GET/POST /api/photos, GET/DELETE /api/photos/[id], GET /api/photos/[id]/file
- Prescriptions tab: GET/POST /api/prescriptions, GET/DELETE /api/prescriptions/[id], GET /api/prescriptions/[id]/file
- Alerts tab: GET/POST /api/alerts, PATCH/DELETE /api/alerts/[id]
- QR uploads: POST /api/uploads/qr, POST /api/uploads/profile

Data and file notes
- Keep the SQLite schema unchanged
- Store file paths relative to SkinProData when possible
- Serve images and PDFs through the API (no direct file access from the browser)
- Add migration steps later if absolute paths need normalization
