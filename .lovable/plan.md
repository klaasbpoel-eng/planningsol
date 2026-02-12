

# Fix: Customer Segmentation showing no data

## Problem
The `get_customer_segments` database function fails with error: `column reference "customer_id" is ambiguous`. This prevents any customer data from loading in the Klant Segmentatie widget.

## Root Cause
In PostgreSQL PL/pgSQL, the column names declared in `RETURNS TABLE(customer_id uuid, ...)` are treated as local variables inside the function. When the function body references `customer_id` without a table alias (in the threshold calculation subquery), PostgreSQL cannot determine whether it refers to the table column or the output variable.

The problematic line is in the threshold subquery:
```sql
SELECT customer_id, SUM(cylinder_count)::numeric as total
FROM gas_cylinder_orders
WHERE ...
GROUP BY customer_id
```
Here, `customer_id` is ambiguous.

## Solution
Create a new migration that recreates the function with proper table aliases on all column references, specifically adding a table alias in the threshold calculation subquery.

## Changes

### New migration SQL
- Recreate `get_customer_segments` function
- Add table alias `gco` to the threshold subquery (lines referencing `customer_id` and `cylinder_count` without qualifier)
- Change from:
  ```sql
  SELECT customer_id, SUM(cylinder_count)::numeric as total
  FROM gas_cylinder_orders
  WHERE ...
  GROUP BY customer_id
  ```
  To:
  ```sql
  SELECT gco.customer_id, SUM(gco.cylinder_count)::numeric as total
  FROM gas_cylinder_orders gco
  WHERE ...
  GROUP BY gco.customer_id
  ```

### Files changed
1. New migration file to fix the `get_customer_segments` function (single SQL migration)

No frontend code changes needed -- the component and API call are correct.
