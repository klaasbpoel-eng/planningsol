
-- Table to store raw Access data per table
CREATE TABLE public.access_sync_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  external_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(table_name, external_id)
);

-- Sync log for tracking
CREATE TABLE public.access_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  rows_received integer NOT NULL DEFAULT 0,
  rows_upserted integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  source_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_access_sync_data_table ON public.access_sync_data(table_name);
CREATE INDEX idx_access_sync_log_created ON public.access_sync_log(created_at DESC);

-- RLS
ALTER TABLE public.access_sync_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read sync data and logs
CREATE POLICY "Admins can manage sync data" ON public.access_sync_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view sync logs" ON public.access_sync_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
