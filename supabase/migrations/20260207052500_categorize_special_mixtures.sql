DO $$
DECLARE
  target_category_id uuid;
  weldmix_category_id uuid;
BEGIN
  -- Get Speciale mengsels category
  SELECT id INTO target_category_id
  FROM gas_type_categories
  WHERE name = 'Speciale mengsels'
  LIMIT 1;

  -- Get Weldmix category (to avoid overwriting)
  SELECT id INTO weldmix_category_id
  FROM gas_type_categories
  WHERE name ILIKE '%Weldmix%'
  LIMIT 1;

  IF target_category_id IS NOT NULL THEN
    UPDATE gas_types
    SET category_id = target_category_id
    WHERE (description LIKE '%\%%' OR name LIKE '%\%%') -- Check both for % symbol
    AND (
      category_id IS NULL 
      OR category_id != weldmix_category_id -- Don't overwrite Weldmix
      OR weldmix_category_id IS NULL -- Safety if Weldmix cat not found
    )
    AND name NOT ILIKE '%Weldmix%'; -- Double safety: exclude Weldmix by name

    RAISE NOTICE 'Updated special mixtures to category Speciale mengsels';
  ELSE
    RAISE NOTICE 'Category Speciale mengsels not found';
  END IF;
END $$;
