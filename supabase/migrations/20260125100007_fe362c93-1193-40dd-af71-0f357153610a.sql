-- 1. Voeg type_id kolom toe die verwijst naar time_off_types
ALTER TABLE public.time_off_requests 
ADD COLUMN type_id UUID REFERENCES public.time_off_types(id) ON DELETE SET NULL;

-- 2. Map bestaande enum waarden naar time_off_types records waar mogelijk
-- Eerst: map 'vacation' naar 'Verlof'
UPDATE public.time_off_requests 
SET type_id = (SELECT id FROM public.time_off_types WHERE LOWER(name) = 'verlof' LIMIT 1)
WHERE type = 'vacation';

-- Map 'sick' naar 'Ziek'
UPDATE public.time_off_requests 
SET type_id = (SELECT id FROM public.time_off_types WHERE LOWER(name) = 'ziek' LIMIT 1)
WHERE type = 'sick';

-- Voor andere types, probeer een match te vinden of gebruik de eerste beschikbare
UPDATE public.time_off_requests 
SET type_id = (SELECT id FROM public.time_off_types WHERE is_active = true ORDER BY name LIMIT 1)
WHERE type_id IS NULL;