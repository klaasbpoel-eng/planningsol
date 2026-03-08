

## Plan: Access Data Viewer admin page

### What we're building
A new "Access Data" tab in the admin sidebar where you can browse all synced Access tables, search/filter rows, and view sync history.

### Changes

**1. New component: `src/components/admin/AccessDataViewer.tsx`**
- Fetches distinct `table_name` values from `access_sync_data` to show a table selector dropdown
- On table select, fetches all rows for that table from `access_sync_data`
- Dynamically extracts column headers from `row_data` JSONB (union of all keys across rows)
- Renders a searchable, filterable data table:
  - Global text search across all fields
  - Column headers auto-generated from the JSONB keys
  - Shows `synced_at` / `updated_at` timestamps
  - Pagination (50 rows per page)
- Sync Log section at the bottom showing recent entries from `access_sync_log` (status, rows received/upserted, timestamp, errors)
- "Verwijder tabeldata" button to delete all rows for a specific table (with confirmation dialog)

**2. Update `AdminSidebar.tsx`**
- Add new nav item `{ id: "access-data", label: "Access Data", icon: Database }`

**3. Update `AdminDashboard.tsx`**
- Add conditional render for `activeTab === 'access-data'` showing `<AccessDataViewer />`

### UI Structure
```text
┌─────────────────────────────────────┐
│ Access Data Synchronisatie          │
│ [Table selector ▼]  [🔍 Zoeken...] │
├─────────────────────────────────────┤
│ KlantID │ Naam          │ Synced    │
│ K001    │ Testbedrijf   │ 08-03... │
│ K002    │ Ander bedrijf │ 08-03... │
├─────────────────────────────────────┤
│ Pagina 1 van 1          [< >]      │
├─────────────────────────────────────┤
│ Sync Logboek                        │
│ TestKlanten │ 3 rijen │ success    │
└─────────────────────────────────────┘
```

### No database changes needed
Both `access_sync_data` and `access_sync_log` tables already exist. RLS policies need to be checked — if admin-only policies exist, the existing `is_admin()` check should suffice since this is an admin page.

