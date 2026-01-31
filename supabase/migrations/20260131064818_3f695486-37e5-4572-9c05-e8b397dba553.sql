-- Add intended_role column to profiles for pre-assigned roles by admin
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS intended_role text DEFAULT NULL;

-- Update the handle_new_user function to also assign the intended role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_intended_role text;
BEGIN
  -- Try to link to existing profile by email first (admin-created employee)
  UPDATE public.profiles
  SET user_id = NEW.id,
      full_name = COALESCE(full_name, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  WHERE email = NEW.email AND user_id IS NULL
  RETURNING id, intended_role INTO v_profile_id, v_intended_role;
  
  -- If an existing profile was updated and has an intended role, assign it
  IF v_profile_id IS NOT NULL AND v_intended_role IS NOT NULL AND v_intended_role != 'user' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_intended_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Clear the intended_role after assignment
    UPDATE public.profiles SET intended_role = NULL WHERE id = v_profile_id;
  END IF;
  
  -- If no existing profile was updated, create a new one (not approved by default)
  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name, is_approved)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), false);
  END IF;
  
  RETURN NEW;
END;
$$;