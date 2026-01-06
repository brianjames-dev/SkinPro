# Status

Current
- Phase 3 complete: Prescriptions endpoints, PDF generation, and UI are wired up
- Added prescription templates, copy-to-client, and print workflow support in the web UI/API
- Added EXIF orientation normalization and QR-based upload endpoints/QR generation
- Phase 4 core done: Alerts API + dashboard UI added (Electron wrapper deferred)
- Clients dashboard layout refreshed with top overview panel and tabbed workspace
- Root page now includes a full clients directory table with search
- Root clients directory now supports keyboard navigation and live in-memory search
- Workspace clients panel can collapse with a compact finder bar
- Workspace client finder now lives at the top with a hideable sidebar toggle
- Profile photo upload now uses a Local/QR modal instead of a separate QR panel
- Health form moved into the Client Overview panel with Info/Health tabs

Next actions
- Verify alerts CRUD and status colors in the UI
- Verify QR uploads from a phone on the same LAN
- Confirm print dialog behavior for PDFs in the browser
- Decide later on optional Electron wrapper
