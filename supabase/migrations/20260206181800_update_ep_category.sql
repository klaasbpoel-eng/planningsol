DO $$
DECLARE
  target_category_id uuid;
BEGIN
  -- Zoek de categorie ID voor 'Medische gassen' (case-insensitive)
  SELECT id INTO target_category_id 
  FROM gas_type_categories 
  WHERE name ILIKE 'Medische gassen' 
  LIMIT 1;

  -- Als de categorie gevonden is, update dan de items
  IF target_category_id IS NOT NULL THEN
    UPDATE gas_types
    SET category_id = target_category_id
    WHERE description ILIKE '%EP%';
    
    RAISE NOTICE 'Updated gas types with EP in description to category Medische gassen';
  ELSE
    RAISE NOTICE 'Category Medische gassen not found';
  END IF;
END $$;
