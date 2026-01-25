-- 1. Voeg profile_id kolom toe aan time_off_requests
ALTER TABLE public.time_off_requests 
ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Migreer bestaande data van user_id naar profile_id
UPDATE public.time_off_requests tor
SET profile_id = p.id
FROM public.profiles p
WHERE p.user_id = tor.user_id;

-- 3. Maak profile_id verplicht (alleen als alle bestaande records zijn gemigreerd)
ALTER TABLE public.time_off_requests 
ALTER COLUMN profile_id SET NOT NULL;

-- 4. Maak user_id nullable voor backward compatibility
ALTER TABLE public.time_off_requests 
ALTER COLUMN user_id DROP NOT NULL;

-- 5. Verwijder oude user-based RLS policies
DROP POLICY IF EXISTS "Users can view own requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Users can create own requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Users can update own pending requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Users can delete own pending requests" ON public.time_off_requests;

-- 6. Maak nieuwe profile-based RLS policies
CREATE POLICY "Users can view own requests via profile"
  ON public.time_off_requests FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Users can create own requests via profile"
  ON public.time_off_requests FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Users can update own pending requests via profile"
  ON public.time_off_requests FOR UPDATE
  USING (
    (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) 
     AND status = 'pending')
    OR is_admin()
  );

CREATE POLICY "Users can delete own pending requests via profile"
  ON public.time_off_requests FOR DELETE
  USING (
    (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) 
     AND status = 'pending')
    OR is_admin()
  );