
# Plan: Fix Supervisor Access to Gas Cylinder Orders

## Problem Identified
When logged in as a supervisor, no orders are visible in the "vulwachrij" (gas cylinder filling queue) for January 2026, even though orders exist in the database.

### Root Cause Analysis
The Row-Level Security (RLS) policy on `gas_cylinder_orders` is too restrictive for supervisors:

**Current RLS Policy:**
```sql
Users can view assigned or created gas cylinder orders:
(created_by = user's profile id) OR (assigned_to = user's profile id)
```

This means supervisors can ONLY see orders they personally created or are assigned to. Since the January 2026 orders were created by a different user (kbpoel) and have no `assigned_to` value, the supervisor sees nothing.

**Expected Behavior:**
Supervisors (and operators) should be able to see all orders for their assigned production location, regardless of who created them.

---

## Solution

### Database Change: Update RLS Policy for `gas_cylinder_orders`

Add a new RLS policy that allows supervisors and operators to view orders based on their assigned production location:

```sql
-- Allow Supervisors to view all orders at their location
CREATE POLICY "Supervisors can view orders at their location"
ON public.gas_cylinder_orders FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND (
    -- If supervisor has a location assigned, show orders for that location
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    -- If no location assigned, show all orders (fallback)
    get_user_production_location(auth.uid()) IS NULL
  )
);

-- Allow Operators to view all orders at their location  
CREATE POLICY "Operators can view orders at their location"
ON public.gas_cylinder_orders FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);
```

### Apply Same Fix to `dry_ice_orders` Table

The same issue exists for dry ice orders. Add equivalent policies:

```sql
-- Allow Supervisors to view all dry ice orders at their location
CREATE POLICY "Supervisors can view dry ice orders at their location"
ON public.dry_ice_orders FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);

-- Allow Operators to view all dry ice orders at their location
CREATE POLICY "Operators can view dry ice orders at their location"  
ON public.dry_ice_orders FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);
```

---

## Technical Details

### Why This Works
1. The `has_role()` function checks if the current user has the supervisor or operator role
2. The `get_user_production_location()` function retrieves the user's assigned location from their profile
3. If a location is assigned, they can only see orders for that location
4. If no location is assigned (NULL), they can see all orders (backward compatibility)

### Security Considerations
- Admins retain full access via existing "Admins can view all" policies
- Supervisors/operators are still restricted to their assigned location
- Regular users still only see orders they created or are assigned to
- The policy is additive (multiple SELECT policies work with OR logic in Postgres)

### Impact
- No code changes required - the fix is entirely at the database level
- Supervisor "Guido Regtop" (assigned to sol_emmen) will immediately see all sol_emmen orders
- The fix applies to both gas cylinder and dry ice order tables

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add RLS policy for supervisors on `gas_cylinder_orders` |
| 2 | Add RLS policy for operators on `gas_cylinder_orders` |
| 3 | Add RLS policy for supervisors on `dry_ice_orders` |
| 4 | Add RLS policy for operators on `dry_ice_orders` |
