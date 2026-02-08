

## Update Reset Function to Match Current Table Schema

The "Gascilinder orders tabel resetten" edge function currently recreates the table with an incomplete schema -- it's missing several RLS policies that operators and supervisors need to create/view/update/delete orders. This means after resetting, only admins can import data. Additionally, the CSV import flow relies on these policies being present.

### What will change

**File: `supabase/functions/reset-gas-cylinder-orders/index.ts`**

Add the missing RLS policies to the `DROP TABLE ... CREATE TABLE` SQL block:

1. **Operator policies** (4 policies):
   - SELECT, INSERT, UPDATE, DELETE -- scoped to their `production_location`

2. **Supervisor policies** (4 policies):
   - SELECT, INSERT, UPDATE, DELETE -- scoped to their `production_location`

These policies use the same pattern as the current live table: checking `has_role(auth.uid(), 'operator'/'supervisor')` combined with `get_user_production_location(auth.uid())` to restrict access by location.

### Technical Details

The exact policies to add mirror what currently exists on the table:

```text
-- Operators: location-scoped CRUD
"Operators can view gas cylinder orders at their location" (SELECT)
"Operators can create gas cylinder orders at their location" (INSERT)
"Operators can update gas cylinder orders at their location" (UPDATE)
"Operators can delete gas cylinder orders at their location" (DELETE)

-- Supervisors: location-scoped CRUD
"Supervisors can view gas cylinder orders at their location" (SELECT)
"Supervisors can create gas cylinder orders at their location" (INSERT)
"Supervisors can update gas cylinder orders at their location" (UPDATE)
"Supervisors can delete gas cylinder orders at their location" (DELETE)
```

Each uses the condition:
```sql
has_role(auth.uid(), 'operator'::app_role)
AND (
  (get_user_production_location(auth.uid()) IS NOT NULL
   AND location = get_user_production_location(auth.uid()))
  OR get_user_production_location(auth.uid()) IS NULL
)
```

No other files need changes -- the import logic in `ExcelImportDialog.tsx` already writes the correct columns and values.

