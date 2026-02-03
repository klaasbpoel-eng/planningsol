

# Plan: Fix Cylinder Size Dropdown Sorting

## Problem Identified

The cylinder size dropdown in the gas cylinder order form is sorting incorrectly. The database has the correct `sort_order` values:
- 1L = sort_order 1
- 2L = sort_order 2
- etc.

However, the component is fetching cylinder sizes and ordering by `capacity_liters` instead of `sort_order`:

```typescript
.order("capacity_liters", { ascending: true });
```

This causes 0,5L (capacity: 0.5) to appear first instead of 1L.

## Solution

Change the ordering in the `fetchCylinderSizes` function from `capacity_liters` to `sort_order`.

## Changes Required

### File: `src/components/production/CreateGasCylinderOrderDialog.tsx`

**Line 132**: Change the order clause

**Before:**
```typescript
.order("capacity_liters", { ascending: true });
```

**After:**
```typescript
.order("sort_order", { ascending: true });
```

## Expected Result

After this fix, the dropdown will display cylinder sizes in this order:
1. 1L, 2L, 4L, 5L, 10L, 20L, 30L, 40L, 50L (most used)
2. PP 16x50L, PP 12x50L, PP 12x40L, PP 16x40L (bundles)
3. Other sizes (0,5L, 0,6L, 3L, etc.)

## Technical Details

- Single line change in `CreateGasCylinderOrderDialog.tsx`
- No database changes required (sort_order values are already correctly set)
- No other files need modification

