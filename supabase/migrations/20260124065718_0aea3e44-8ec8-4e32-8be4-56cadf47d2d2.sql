-- Remove the foreign key constraint on profiles.user_id to allow admin-created profiles
-- First, check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_fkey;
  END IF;
END $$;

-- Make user_id nullable so admins can create employee profiles without auth users
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;