-- Update max_allowed_kg for SOL Emmen based on official PGS register document
-- Source: document 20260326063537527.pdf (PGS register Emmen)
-- Changes: Propaan 3000→4000, Stikstof 3900→21975, Waterstof 175→6500, Zuurstof 6090→30850

-- Propaan, Emmen: 3.000 → 4.000 kg
UPDATE public.pgs_substances s
SET max_allowed_kg = 4000,
    updated_at = now()
FROM public.gas_types g
WHERE s.gas_type_id = g.id
  AND s.location = 'sol_emmen'
  AND g.name ILIKE '%propaan%';

-- Stikstof, Emmen: 3.900 → 21.975 kg (21.800 cryogeen + 175 cilinders)
UPDATE public.pgs_substances s
SET max_allowed_kg = 21975,
    updated_at = now()
FROM public.gas_types g
WHERE s.gas_type_id = g.id
  AND s.location = 'sol_emmen'
  AND g.name ILIKE '%stikstof%';

-- Waterstof, Emmen: 175 → 6.500 kg
UPDATE public.pgs_substances s
SET max_allowed_kg = 6500,
    updated_at = now()
FROM public.gas_types g
WHERE s.gas_type_id = g.id
  AND s.location = 'sol_emmen'
  AND g.name ILIKE '%waterstof%';

-- Zuurstof, Emmen: 6.090 → 30.850 kg
UPDATE public.pgs_substances s
SET max_allowed_kg = 30850,
    updated_at = now()
FROM public.gas_types g
WHERE s.gas_type_id = g.id
  AND s.location = 'sol_emmen'
  AND g.name ILIKE '%zuurstof%';
