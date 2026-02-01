

# Plan: Add Pressure Column Mapping to Excel Import

## Current Situation

The uploaded Excel file `Productie_2026-2.xlsx` has an updated structure with a dedicated Pressure column:

| Index | Column Name | Example Value |
|-------|-------------|---------------|
| 0 | Datum | 2026-01-31 |
| 1 | Gastype | Formeer 5 |
| 2 | Cilinderinhoud | 10 |
| 3 | Aantal | 16 |
| 4 | M/T | (empty) |
| 5 | Location | SOL Nederland-Tilburg |
| 6 | Customer_Name | Gasco Nederland NV |
| 7 | Omschrijving | 10 liter cilinder |
| 8 | **Pressure** | 200, 300, or 4 |

Currently, pressure is extracted from the description text in `parseCylinderSize()`, but now it should be read directly from the Pressure column.

---

## Solution

### Step 1: Add Pressure to Column Detection
Add header detection for the "Pressure" column:

```typescript
if (cellStr.includes("pressure") || cellStr.includes("druk") || 
    cellStr.includes("bar")) {
  columnMap.pressure = idx;
}
```

### Step 2: Update Fallback Indices
Add pressure to the fallback column mapping:

```typescript
columnMap = { 
  date: 0, gasType: 1, size: 2, count: 3, grade: 4, 
  location: 5, customer: 6, notes: 7, pressure: 8 
};
```

### Step 3: Parse Pressure from Excel Column
Read pressure directly from the column when available:

```typescript
// Get pressure value from dedicated column
let pressure = 200; // default
if (columnMap.pressure !== undefined) {
  const pressureVal = parseInt(String(row[columnMap.pressure] || "200"));
  if (!isNaN(pressureVal) && pressureVal > 0) {
    pressure = pressureVal;
  }
} else {
  // Fallback: extract from description
  const { pressure: descPressure } = parseCylinderSize(sizeStr);
  pressure = descPressure;
}
```

### Step 4: Add Pressure Column to Preview Table
Display pressure in the import preview:

```tsx
<th className="text-right py-2">Bar</th>
...
<td className="py-1.5 text-right">{order.pressure}</td>
```

---

## Technical Changes Summary

| Line Range | Change |
|------------|--------|
| 256-270 | Add pressure header detection (`pressure`, `druk`, `bar`) |
| 278 | Add `pressure: 8` to fallback column map |
| 295-320 | Read pressure from column, fallback to description parsing |
| 526-531 | Add "Bar" column header to preview table |
| 537-546 | Add pressure cell to preview table rows |

---

## Expected Result

After these changes:
- The import will detect and use the dedicated "Pressure" column from Excel
- Values like 200, 300, and 4 (bar) will be correctly imported
- The preview table will show the pressure for each order
- Fallback to description-based parsing remains for older Excel formats

