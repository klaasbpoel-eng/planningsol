

## Fix: Excel Import for Tilburg Cylinder Orders

### Problem
The uploaded Excel file ("Tilburg.xlsx") has a different column structure than the current import dialog expects:

| Excel Column | Contains | Current Import Expects |
|---|---|---|
| **Datum** | Date | "datum" -- already matched |
| **Product** | Gas type name (e.g., "Zuurstof Medicinaal Gasv. SOL") | "gassoort" or "gastype" -- NOT matched |
| **Capaciteit** | Cylinder size as raw number (e.g., 800, 50, 2) | "cilinderinhoud", "formaat", etc. -- NOT matched |
| **Aantal** | Count | "aantal" -- already matched |
| **Branche** | Location (e.g., "SOL Nederland-Tilburg") | "locatie", "vestiging" -- NOT matched |
| **Klant** | Customer name | "klant" -- already matched |

Additionally:
- There is **no M/T column** for grade -- grade must be inferred from the product name (e.g., "Medicinaal" = medical)
- Capaciteit is a plain number (e.g., `800`), not formatted as "800L"
- "Branche" contains values like "SOL Nederland-Tilburg" which need to map to `sol_tilburg`

### Changes

**File: `src/components/production/ExcelImportDialog.tsx`**

1. **Header detection** -- Add "product" as alias for the gas type column, "capaciteit" as alias for the size column, and "branche" as alias for the location column in the header-matching logic

2. **Grade inference from product name** -- When no dedicated M/T or grade column is found, detect "medicinaal" in the product name to set grade to "medical", otherwise default to "technical"

3. **Cylinder size parsing** -- Handle raw numeric values from the "Capaciteit" column (e.g., `800` becomes `"800L"`, `2` becomes `"2L"`) with database matching

4. **Location parsing** -- Add support for "SOL Nederland-Tilburg" and "SOL Nederland-Emmen" patterns in the `parseLocation` function

### Technical Details

**Header detection additions** (in the second header detection block around line 366-401):
```
"product" -> columnMap.gasType
"capaciteit" -> columnMap.size  
"branche" -> columnMap.location
```

**Grade inference** (around line 462):
- If no grade column was mapped, check if the gas type string contains "medicinaal" to set grade to "medical"
- Otherwise default to "technical"

**parseCylinderSize enhancement**:
- Before all pattern matching, check if the input is purely numeric (e.g., "800", "50", "2") and convert to "XL" format (e.g., "800L") with database matching

**parseLocation enhancement**:
- Add pattern matching for "nederland-tilburg" and "nederland-emmen" to handle the "SOL Nederland-Tilburg" format from this Excel
