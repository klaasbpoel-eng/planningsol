-- Create a new toolbox: "Veiligheidssignalering en Stickers"
DO $$
DECLARE
  v_toolbox_id uuid;
  v_base_order integer := 0;
BEGIN
  -- 1. Insert the Toolbox
  INSERT INTO public.toolboxes (
    title,
    description,
    category,
    cover_image_url,
    estimated_duration_minutes,
    is_mandatory,
    status,
    published_at
  ) VALUES (
    'Toolbox Meeting — Veiligheidssignalering en Stickers',
    'Herkenning en betekenis van veiligheidsstickers en gevaarsymbolen op de werkvloer.',
    'Veiligheid',
    '/toolbox-images/stickers/page_1.jpg',
    15,
    true,
    'published',
    now()
  ) RETURNING id INTO v_toolbox_id;

  -- 2. Insert Sections (Pages 1-10)

  -- Page 1
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Introductie', '/toolbox-images/stickers/page_1.jpg', v_base_order + 1);

  -- Page 2
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 2', '/toolbox-images/stickers/page_2.jpg', v_base_order + 2);

  -- Page 3
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 3', '/toolbox-images/stickers/page_3.jpg', v_base_order + 3);

  -- Page 4
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 4', '/toolbox-images/stickers/page_4.jpg', v_base_order + 4);

  -- Page 5
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 5', '/toolbox-images/stickers/page_5.jpg', v_base_order + 5);

  -- Page 6
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 6', '/toolbox-images/stickers/page_6.jpg', v_base_order + 6);

  -- Page 7
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 7', '/toolbox-images/stickers/page_7.jpg', v_base_order + 7);

  -- Page 8
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 8', '/toolbox-images/stickers/page_8.jpg', v_base_order + 8);

  -- Page 9
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Pagina 9', '/toolbox-images/stickers/page_9.jpg', v_base_order + 9);

  -- Page 10
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (v_toolbox_id, 'image', 'Afsluiting', '/toolbox-images/stickers/page_10.jpg', v_base_order + 10);

END $$;
