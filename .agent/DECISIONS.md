# Decisions

- Use Next.js with a local Node API for the web UI to keep iteration fast and avoid packaging overhead.
- Keep SQLite and the SkinProData folder unchanged; read config from ~/.skinpro_config_location.json.
- Use better-sqlite3 for the API layer (simple sync queries, single-user friendly).
- Pin to Node 20 LTS to avoid native build failures for better-sqlite3 on Node 24.
- Port prescription PDFs with pdfkit and add a PNG logo asset for compatibility.
- Store prescription templates in `SkinProData/prescriptions/templates.json` to avoid schema changes.
- Normalize photo/profile EXIF orientation on upload using `sharp`.
- Generate QR upload links via LAN IP detection with an optional `SKINPRO_QR_HOST` override.
