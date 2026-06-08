ALTER TABLE public.time_off_requests ADD COLUMN IF NOT EXISTS series_id uuid;
CREATE INDEX IF NOT EXISTS time_off_requests_series_id_idx ON public.time_off_requests (series_id);