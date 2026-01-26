# Status

Current
- Core web UI is functional: clients, alerts, appointments, photos, prescriptions, products, notes
- Prescriptions: PDF generation, templates, copy, preview/edit, current marker; header second line + edit-mode dividers
- Uploads: local + QR flows, EXIF normalization, shared success dialog
- UI polish: tabbed workspace, search UX, birthday celebration, notes workflow
- Highlightable text fields: shared highlight textarea used in prescriptions + health, with clear action and token stripping in read mode
- Home dashboard: Maintenance tab mirrors alerts with separate datastore and highlightable notes
- Home dashboard: News tab with rotating, topic-weighted industry feed and local cache
- Prescriptions: QR share flow generates single-use, 10-minute download links and renders a QR in the UI
- Unsaved-changes guard/prompt now applied to edit flows across alerts/maintenance/clients
- Repository layout: legacy Tkinter code moved to `legacy/`, web app renamed to `src/`
- Repo: `src/lib` now tracked for cross-machine setup

Next actions
- Refactor/cleanup: modularize shared UI + hooks, reduce clients-dashboard.tsx size
 - Consolidate web-only files under `src/` and remove legacy shims when safe
- Verify alerts + notes flows and PDF print behavior after refactor
