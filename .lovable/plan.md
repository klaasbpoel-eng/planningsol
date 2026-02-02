
# Plan: Stock Management Badge System

## Objective
Create a dynamic stock management badge system based on the uploaded Excel file structure (Voorraadbeheer.xlsx), replacing the current hardcoded "Voorraadstatus" card with real inventory health indicators.

---

## Excel Data Analysis

The uploaded file contains:
| Column | Description | Example Values |
|--------|-------------|----------------|
| SubCode | Product code | 250049, 201112 |
| SubCodeDescription | Gas cylinder type | "Lucht Inhalatie (tech) (50L)" |
| Average_Consumption | Weekly/monthly usage | 1-17 |
| Number_On_Stock | Current inventory | 1-46 |
| Difference | Stock minus consumption | -8 to +35 |

**Stock Health Logic (based on Difference column):**
- **Critical** (Difference ≤ -3): Severe shortage, needs immediate action
- **Low** (Difference -2 to 0): At risk, reorder soon  
- **OK** (Difference 1 to 5): Healthy buffer
- **Surplus** (Difference > 5): Overstock, consider reducing orders

---

## Proposed Solution

### 1. Add New Badge Variants

Extend `src/components/ui/badge.tsx` to include semantic variants matching the button component:

```text
┌─────────────────────────────────────────────────────┐
│  Badge Variants (new)                               │
├─────────────────────────────────────────────────────┤
│  success   → Green  → "Op voorraad" / "Voldoende"  │
│  warning   → Orange → "Lage voorraad"               │
│  critical  → Red    → "Kritiek"                     │
│  info      → Cyan   → "Overschot"                   │
└─────────────────────────────────────────────────────┘
```

### 2. Create StockStatusBadge Component

New component at `src/components/production/StockStatusBadge.tsx`:

```typescript
// Determines stock health based on difference value
type StockStatus = "critical" | "low" | "ok" | "surplus";

interface StockStatusBadgeProps {
  difference: number;          // From Excel: Stock - Consumption
  showCount?: boolean;         // Show number of affected items
  compact?: boolean;           // Smaller version for tables
}
```

**Visual Examples:**
```text
┌──────────────────────────────────────────────────────────┐
│ 🔴 Kritiek (5)       → Red badge with count             │
│ 🟠 Lage voorraad (3) → Orange/warning badge             │
│ 🟢 Op voorraad       → Green/success badge              │
│ 🔵 Overschot (12)    → Cyan/info badge (optional)       │
└──────────────────────────────────────────────────────────┘
```

### 3. Create Stock Summary Widget

Replace the hardcoded "Voorraadstatus" card with a dynamic `StockSummaryWidget`:

```text
┌─────────────────────────────────────┐
│  📊 Voorraadstatus                  │
├─────────────────────────────────────┤
│                                     │
│  🔴 5 Kritiek                       │
│  🟠 8 Lage voorraad                 │
│  🟢 42 Op voorraad                  │
│                                     │
│  ──────────────────────────         │
│  Laatste update: vandaag 14:30      │
└─────────────────────────────────────┘
```

### 4. Database Table for Stock Data (Optional)

Create a `stock_levels` table to persist the Excel data:

```sql
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  average_consumption INTEGER DEFAULT 0,
  number_on_stock INTEGER DEFAULT 0,
  difference INTEGER GENERATED ALWAYS AS (number_on_stock - average_consumption) STORED,
  location production_location,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/badge.tsx` | Modify | Add `success`, `warning`, `info` variants |
| `src/components/production/StockStatusBadge.tsx` | Create | Reusable badge with status logic |
| `src/components/production/StockSummaryWidget.tsx` | Create | Dashboard widget with stock overview |
| `src/components/production/ProductionPlanning.tsx` | Modify | Replace hardcoded card with widget |
| `supabase/migrations/...` | Create | (Optional) stock_levels table |

---

## Implementation Steps

1. **Add badge variants** matching the button design system (`success`, `warning`, `info`)

2. **Create StockStatusBadge** component with:
   - Status calculation logic from difference value
   - Icon support (CheckCircle, AlertTriangle, ShieldAlert)
   - Compact mode for table rows

3. **Create StockSummaryWidget** that:
   - Aggregates stock data into status counts
   - Displays in the same card style as other stat cards
   - Shows breakdown by status category

4. **Update ProductionPlanning** to use the new widget

5. **(Optional)** Create database table and Excel import for persistent stock data

---

## Summary

This plan creates a complete stock management badge system that:
- Uses the existing design system colors (success, warning, destructive)
- Follows the Excel file's data structure (SubCode, Difference for status)
- Replaces the hardcoded "Goed" status with real-time inventory health
- Can be extended to show detailed item lists in a hover card or dialog
