DO $$
DECLARE
  target_category_id uuid;
BEGIN
  -- Look for existing category containing Weldmix
  SELECT id INTO target_category_id
  FROM gas_type_categories
  WHERE name ILIKE '%Weldmix%'
  ORDER BY name ASC
  LIMIT 1;

  -- Create if not exists
  IF target_category_id IS NULL THEN
    INSERT INTO gas_type_categories (name, sort_order)
    VALUES ('Weldmix', 10)
    RETURNING id INTO target_category_id;
    RAISE NOTICE 'Created new category Weldmix';
  ELSE
    RAISE NOTICE 'Found existing category for Weldmix: %', target_category_id;
  END IF;

  -- Update gas types
  UPDATE gas_types
  SET category_id = target_category_id
  WHERE name ILIKE '%Weldmix%';

  RAISE NOTICE 'Updated gas types with Weldmix in name to category %', target_category_id;
END $$;
