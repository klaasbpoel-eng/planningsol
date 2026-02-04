
# Fix Plan: Loading Icon Stuck on Internal Orders Page

## Problem Analysis

The loading spinner runs indefinitely for admin users because of a logic flaw in `useInternalOrders.ts`:

1. The `fetchOrders` function exits early when `productionLocation` is `null` (line 81)
2. Admin users often have no assigned production location (as confirmed in network requests: `production_location: null`)
3. Even though `getIncomingOrders()` and `getOutgoingOrders()` handle the admin case correctly, the underlying `orders` array is never populated because `fetchOrders` never runs

## Solution

Modify the hook to account for admin users who should see all orders regardless of production location:

### Changes to `src/hooks/useInternalOrders.ts`

1. **Update `fetchOrders` condition** - Allow fetching if user is admin OR has a production location
2. **Wait for role loading** - Don't attempt fetch until we know the user's role
3. **Update realtime subscription** - Same logic for setting up subscription

```text
Current flow:
  productionLocation = null → fetchOrders exits → loading = true forever

Fixed flow:
  Wait for roleLoading → isAdmin = true → fetchOrders runs → loading = false
```

### Specific Code Changes

**fetchOrders function (around line 80-81)**
- Change: `if (!productionLocation) return;`
- To: `if (!productionLocation && !isAdmin) return;`

**useEffect for fetchOrders (around line 126-128)**
- Add `isAdmin` and `roleLoading` to dependencies
- Add guard: Don't run while `roleLoading` is true

**useEffect for realtime subscription (around line 131-152)**
- Update condition to also check for admin status
- Add `isAdmin` to dependencies

### Technical Details

File: `src/hooks/useInternalOrders.ts`

```typescript
// Line 80-82: Update fetchOrders guard
const fetchOrders = useCallback(async () => {
    // Allow admins to fetch all orders, others need a location
    if (!productionLocation && !isAdmin) return;
    // ... rest of function
}, [productionLocation, isAdmin]);

// Line 126-129: Update fetchOrders useEffect
useEffect(() => {
    if (roleLoading) return; // Wait for role check
    fetchOrders();
}, [fetchOrders, roleLoading]);

// Line 131-152: Update realtime subscription
useEffect(() => {
    if (!productionLocation && !isAdmin) return;
    // ... subscription setup
}, [productionLocation, isAdmin, fetchOrders]);
```

## Expected Result

After these changes:
- Admin users will see all orders load immediately
- Non-admin users will continue to see only orders for their location
- Loading spinner will properly disappear once data is fetched
