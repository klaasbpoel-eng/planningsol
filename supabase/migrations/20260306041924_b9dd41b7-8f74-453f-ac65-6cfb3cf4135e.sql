
ALTER TABLE public.pgs_substances ADD COLUMN IF NOT EXISTS gevi_number text;
ALTER TABLE public.pgs_substances ADD COLUMN IF NOT EXISTS wms_classification text;
ALTER TABLE public.bulk_storage_tanks ADD COLUMN IF NOT EXISTS gevi_number text;
ALTER TABLE public.bulk_storage_tanks ADD COLUMN IF NOT EXISTS wms_classification text;
