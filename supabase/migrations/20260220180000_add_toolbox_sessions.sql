-- Create toolbox_sessions table
CREATE TABLE IF NOT EXISTS public.toolbox_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_id UUID NOT NULL REFERENCES public.toolboxes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_time TIME DEFAULT NULL,
  location TEXT DEFAULT NULL,
  instructor_id UUID REFERENCES public.profiles(id),
  notes TEXT DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create toolbox_session_participants table
CREATE TABLE IF NOT EXISTS public.toolbox_session_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.toolbox_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT true,
  signed_off BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, profile_id)
);

-- RLS for toolbox_sessions
ALTER TABLE public.toolbox_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON public.toolbox_sessions
FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users (admins/supervisors managed in app)"
ON public.toolbox_sessions
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
ON public.toolbox_sessions
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
ON public.toolbox_sessions
FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS for toolbox_session_participants
ALTER TABLE public.toolbox_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON public.toolbox_session_participants
FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.toolbox_session_participants
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
ON public.toolbox_session_participants
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
ON public.toolbox_session_participants
FOR DELETE
USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_toolbox_sessions_toolbox_id ON public.toolbox_sessions(toolbox_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_sessions_session_date ON public.toolbox_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_toolbox_session_participants_session_id ON public.toolbox_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_session_participants_profile_id ON public.toolbox_session_participants(profile_id);
