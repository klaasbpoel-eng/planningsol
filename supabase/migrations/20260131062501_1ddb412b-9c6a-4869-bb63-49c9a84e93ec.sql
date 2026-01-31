-- Add is_approved column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Add approved_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN approved_at timestamp with time zone;

-- Add approved_by to track who approved
ALTER TABLE public.profiles 
ADD COLUMN approved_by uuid REFERENCES public.profiles(id);

-- Update handle_new_user function to set is_approved = false by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Try to link to existing profile by email first (admin-created employee)
  UPDATE public.profiles
  SET user_id = NEW.id,
      full_name = COALESCE(full_name, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  WHERE email = NEW.email AND user_id IS NULL;
  
  -- If no existing profile was updated, create a new one (not approved by default)
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, email, full_name, is_approved)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), false);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create function to check if current user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.profiles WHERE user_id = auth.uid()),
    false
  )
$$;