-- Fix: Update profiles RLS policies to explicitly handle NULL user_id
-- This ensures orphaned profiles (admin-created employees) are properly protected

-- Drop existing user-specific policies and recreate with explicit NULL checks
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate with explicit NULL handling
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- Update the handle_new_user trigger to link existing profiles by email instead of creating duplicates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to link to existing profile by email first (admin-created employee)
  UPDATE public.profiles
  SET user_id = NEW.id,
      full_name = COALESCE(full_name, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  WHERE email = NEW.email AND user_id IS NULL;
  
  -- If no existing profile was updated, create a new one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  END IF;
  
  RETURN NEW;
END;
$$;