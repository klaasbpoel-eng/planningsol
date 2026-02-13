

## Fix: Restore Database - Memory Limit Exceeded

### Problem
The restore edge function crashes with "Memory limit exceeded" because the entire backup JSON (all 11 tables) is sent as a single HTTP request body and parsed into memory at once. Large tables like `gas_cylinder_orders` can contain thousands of rows, making the payload too big.

### Solution
Split the restore into a **chunked, table-by-table approach**:

1. **Client-side chunking** -- The frontend reads the backup file, then sends one table at a time to the edge function in separate requests
2. **Edge function accepts single-table restores** -- Each call processes only one table, keeping memory usage low
3. **Two-phase approach**: first a "clear" call to delete all data, then individual table inserts

### Changes

**File: `supabase/functions/restore-database/index.ts`**
- Accept a new request format: `{ action: "clear" }` to delete all tables, or `{ action: "insert", table: "gas_cylinder_orders", rows: [...] }` to insert rows for one table
- Each call handles only one table's data, staying well within memory limits
- Keep the same auth/admin checks

**File: `src/components/admin/DatabaseBackupRestore.tsx`**
- Update `handleRestore` to:
  1. Parse the backup JSON client-side
  2. First call the edge function with `{ action: "clear" }` to delete existing data
  3. Then loop through each table in dependency order, sending rows in batches (e.g., 500 rows per request)
  4. Show progress as each table is restored
- Add a progress indicator showing which table is being restored

### Technical Details

The edge function will support two actions:

```
POST { action: "clear" }
  -> Deletes all rows from all 11 tables in reverse dependency order

POST { action: "insert", table: "customers", rows: [...up to 500 rows...] }
  -> Inserts the provided rows into the specified table
```

The client iterates through tables in the correct dependency order (parents first) and sends batches of up to 500 rows per request. A progress bar shows completion percentage based on total tables/batches processed.

