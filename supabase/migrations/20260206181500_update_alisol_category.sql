DO $$
DECLARE
  target_category_id uuid;
BEGIN
  -- Zoek de categorie ID voor 'Voedingsgassen' (case-insensitive)
  SELECT id INTO target_category_id 
  FROM gas_type_categories 
  WHERE name ILIKE 'Voedingsgassen' 
  LIMIT 1;

  -- Als de categorie gevonden is, update dan de items
  IF target_category_id IS NOT NULL THEN
    UPDATE gas_types
    SET category_id = target_category_id
    WHERE name ILIKE '%Alisol%';
    
    RAISE NOTICE 'Updated Alisol gas types to category Voedingsgassen';
  ELSE
    RAISE NOTICE 'Category Voedingsgassen not found';
  END IF;
END $$;
