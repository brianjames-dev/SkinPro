# Roadmap (condensed)

Now: Refactor + cleanup
- Move/confirm all web UI files under `web/`, remove legacy shims when safe.
- Extract shared UI from `clients-dashboard.tsx`:
  - Buttons + button row, tabs/pills, modals/confirm dialogs
  - Form fields (label/input/select/textarea), notice/empty states
  - Search dropdowns + keyboard nav, tree/list rows, tables
  - Badges/status chips, receipt-style detail blocks
- Extract shared hooks/utilities:
  - `useQueryTabSync` (home/workspace/overview)
  - `useKeyboardListNavigation`
  - formatters (date, phone, currency) + parsing helpers
  - API table ensure helpers (notes/products/current flag)
- Incremental migration: refactor one screen at a time (Dashboard → Clients Overview → Modals).

Extraction order (proposed, `web/app/ui` + `web/lib/hooks`)
1) Buttons + ButtonRow
   - `web/app/ui/Button.tsx`, `web/app/ui/ButtonRow.tsx`
2) Tabs/pills + tab routing hook
   - `web/app/ui/Tabs.tsx`, `web/lib/hooks/useQueryTabSync.ts`
3) Form fields + Notice/Empty states
   - `web/app/ui/Field.tsx`, `web/app/ui/Notice.tsx`
4) Modal + ConfirmDialog
   - `web/app/ui/Modal.tsx`, `web/app/ui/ConfirmDialog.tsx`
5) Search dropdown + keyboard nav hook
   - `web/app/ui/SearchMenu.tsx`, `web/lib/hooks/useKeyboardListNavigation.ts`
6) List/Treeview + table rows
   - `web/app/ui/List.tsx`, `web/app/ui/TreeList.tsx`
7) Badges/status chips + receipt/detail blocks
   - `web/app/ui/Badge.tsx`, `web/app/ui/Receipt.tsx`
8) Utilities consolidation
   - `web/lib/format.ts`, `web/lib/parse.ts`, `web/lib/api/ensureTables.ts`
9) Remaining bespoke UI cleanup
   - `web/app/ui/TogglePill.tsx` (replace notes toggle + photo compare toggle)
   - `web/app/ui/TreeToggle.tsx` (replace product group expand/collapse button)
   - `web/app/ui/IconButton.tsx` (replace icon-only action buttons)
   - `web/app/ui/LockableCheckbox.tsx` (notes Done toggle with lock)
   - prune unused CSS (e.g., `.expandableToggle*` if unused)

Later: Packaging + polish
- Optional desktop wrapper after refactor stabilizes.

Tab-to-endpoint mapping (current)
- Dashboard: `/` with `tab=alerts|clients`
- Client overview: `/clients?clientId=...&tab=appointments|products|photos|prescriptions|notes&overview=info|health`
- API: `/api/clients`, `/api/clients/[id]`, `/api/clients/[id]/health`
- API: `/api/appointments`, `/api/photos`, `/api/prescriptions`, `/api/products`, `/api/notes`, `/api/alerts`
- Uploads: `/api/uploads/qr`, `/api/uploads/profile`
