# Decisions

- Next.js app router + local Node API; SQLite + SkinProData remain the source of truth.
- better-sqlite3 for sync, single-user local DB access; Node 20 LTS pin.
- Prescriptions: pdfkit output, templates in `SkinProData/prescriptions/templates.json`, unique file paths.
- Uploads: QR via LAN IP with `SKINPRO_QR_HOST` override; EXIF normalization via `sharp`.
- On-demand tables/columns: `client_products`, `client_notes`, `prescriptions.is_current`.
- Tab routing uses query params to preserve `clientId` and allow back/forward.
- Prescriptions: header supports optional second line (`ColX_Header2`); steps use a single product field.
- Highlighted text uses `[h]` tokens with a shared `HighlightTextarea` overlay component across edit surfaces.
- Maintenance dashboard uses a dedicated `maintenance` table and API endpoints, separate from alerts.
- Prescription QR share uses single-use tokens (10 min TTL) stored in `share_tokens`, served as PNG for mobile download.
- Prescription share PNG rendering uses `pdfjs-dist` + `@napi-rs/canvas` via a dedicated Node script to rasterize the first PDF page.
- Unsaved changes handling uses a shared guard hook + prompt component registered per section to standardize exit confirmations.
- Legacy desktop/Tkinter code moved under `legacy/`; the active web app now lives in `src/`.
- News dashboard uses Google News RSS with `fast-xml-parser`, cached JSON under `SkinProData/news/` and keyword-weighted ranking for facials/electrolysis.
- Track `src/lib` in git; narrow ignore to `/lib/` so core shared code ships across machines.
- Local HTTPS dev certs are machine-specific; ignore `src/.certs/` and avoid committing private keys.
- Dev tunnel uses `npm_execpath` when available (spawn `node` + npm CLI) and falls back to `npm.cmd` on Windows.
