-- Remove old overloaded function versions that cause PGRST203 ambiguity errors
-- The newer versions with p_location DEFAULT NULL parameter will remain

DROP FUNCTION IF EXISTS public.get_monthly_order_totals(integer, text);
DROP FUNCTION IF EXISTS public.get_monthly_cylinder_totals_by_gas_type(integer);
DROP FUNCTION IF EXISTS public.get_yearly_totals_by_customer(integer);