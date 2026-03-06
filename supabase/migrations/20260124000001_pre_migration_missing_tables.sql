-- Pre-migration: create tables that exist in the source DB but have no migration
-- This must run before any other migration that references these tables.

CREATE TABLE IF NOT EXISTS public.time_off_types (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#3b82f6',
  description TEXT DEFAULT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_types (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#3b82f6',
  description TEXT DEFAULT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
  -- parent_id wordt toegevoegd via migratie 20260125071030
  -- sort_order wordt toegevoegd via migratie 20260125074824
);

-- tasks and notifications reference profiles which is created in the next migration,
-- so we defer FK constraints using DO blocks (add FKs after profiles exists).
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  priority    TEXT NOT NULL DEFAULT 'medium',
  due_date    DATE NOT NULL,
  assigned_to UUID,
  created_by  UUID NOT NULL,
  type_id     UUID REFERENCES public.task_types(id) ON DELETE SET NULL,
  series_id   UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
  -- start_time/end_time worden toegevoegd via migratie 20260125072218
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- customer_products: exists in source DB but has no CREATE TABLE migration.
-- No FKs here because customers/products tables don't exist yet at this point.
CREATE TABLE IF NOT EXISTS public.customer_products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  product_id  UUID NOT NULL,
  warehouse   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
