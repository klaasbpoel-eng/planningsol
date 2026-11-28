-- =============================================================================
-- DELETE EMPLOYEE + LINKED AUTH USER RPC
-- When an admin deletes an employee from Medewerkers, also delete their
-- user_roles and auth.users account so no orphaned Auth user remains behind.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_employee_and_auth_user(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Alleen beheerders mogen medewerkers verwijderen';
  END IF;

  SELECT user_id, email
  INTO v_user_id, v_email
  FROM public.profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medewerker niet gevonden';
  END IF;

  IF v_user_id IS NOT NULL AND v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Je kunt je eigen inlogaccount niet verwijderen';
  END IF;

  -- Verwijder profiel (en eventuele gekoppelde cascade-tabellen)
  DELETE FROM public.profiles WHERE id = p_profile_id;

  -- Verwijder rollen en het Supabase Auth-account
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  ELSIF v_email IS NOT NULL AND btrim(v_email) <> '' THEN
    -- Ruim eventueel een verweesd auth-account met hetzelfde e-mailadres op als geen ander profiel eraan hangt
    DELETE FROM auth.users u
    WHERE lower(u.email) = lower(v_email)
      AND u.id <> auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_employee_and_auth_user(uuid) TO authenticated;
