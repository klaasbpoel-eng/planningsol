-- Create profile for existing user
INSERT INTO public.profiles (user_id, email, full_name)
SELECT 
  id as user_id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) as full_name
FROM auth.users
WHERE id = '44796921-47bb-4c5c-b447-db545fd439ad'
  AND id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Also sync any other existing users who might be missing profiles
INSERT INTO public.profiles (user_id, email, full_name)
SELECT 
  id as user_id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) as full_name
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Create or replace the trigger function for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

-- Create trigger if it doesn't exist (drop first to ensure clean state)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();