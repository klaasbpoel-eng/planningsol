-- Create a new toolbox: "Fakkelbranden bij het vullen van gascilinders"
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
    'Toolbox Meeting — Fakkelbranden bij het vullen van gascilinders',
    'Leer hoe je fakkelbranden herkent, voorkomt en bestrijdt tijdens het vullen van gascilinders.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=2000', -- Placeholder image of industrial setting
    10,
    true,
    'published',
    now()
  ) RETURNING id INTO v_toolbox_id;

  -- 2. Insert Sections

  -- Sectie 1: Opening
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Waarom is dit belangrijk?',
    E'**"Vorige maand ging het bijna mis bij het vullen van een zuurstofcilinder. Dit had een fakkelbrand kunnen worden."**\n\nVeiligheid is geen luxe, het is noodzaak. Als operator sta je dagelijks met je neus bovenop processen die, als ze misgaan, levensgevaarlijk kunnen zijn. Fakkelbranden zijn zeldzaam, maar als ze gebeuren, zijn de gevolgen vaak ernstig.\n\nIn deze toolbox leer je precies wat een fakkelbrand is, hoe je de signalen herkent en - nog belangrijker - wat je moet doen om jezelf en je collega''s veilig te houden.',
    v_base_order + 1
  );

  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Risico in beeld',
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=2000', -- Placeholder: gas cylinders/medical
    v_base_order + 2
  );

  -- Sectie 2: Wat is een fakkelbrand?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat is een fakkelbrand?',
    E'Een fakkelbrand is eigenlijk precies wat de naam zegt: gas dat ontsnapt en direct verbrandt, net als een gigantische aansteker die niet uitgaat.\n\nHet ontstaat door de combinatie van drie dingen (de vuurdriehoek):\n1.  **Brandbaar gas** (zoals acetyleen, of zelfs de slang zelf in zuurstofrijke omgeving)\n2.  **Zuurstof** (uit de lucht of uit de cilinder/leiding)\n3.  **Ontstekingsbron** (vonk, hitte, statische elektriciteit)\n\nBij hogedruk zuurstof kan zelfs een klein beetje vet of olie al spontaan ontbranden zonder vlam (adiabatische compressie).',
    v_base_order + 3
  );

  -- Sectie 3: Wanneer kan het gebeuren?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Risicosituaties',
    '[
      {"text": "Lekkende aansluiting of poreuze slang"},
      {"text": "Vet of olie op een zuurstofventiel of in de koppeling"},
      {"text": "Beschadigde O-ring of pakking (lekkage = gevaar)"},
      {"text": "Te snel openen van het cilinderventiel (hitte door drukopbouw)"},
      {"text": "Vuil of deeltjes in het ventiel of de vulfitting"},
      {"text": "Verkeerde gassoort in de verkeerde cilinder proberen te vullen"}
    ]',
    v_base_order + 4
  );

  -- Sectie 4: Hoe herken je het?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Signalen van gevaar',
    E'Wees alert op de volgende signalen tijdens het vullen:\n\n*   🔊 **Geluid:** Een luid sissend of fluitend geluid bij het ventiel of de aansluiting.\n*   👃 **Geur:** Een brandlucht, of de geur van smeltend rubber/plastic.\n*   🔥 **Zicht:** Verkleuring van de slang, rookontwikkeling, of een zichtbare vlam.\n    *   *Let op: Een waterstofvlam is overdag bijna onzichtbaar!*\n*   🌡️ **Gevoel:** Plotselinge stralingswarmte als je in de buurt staat.\n\n**Bij twijfel: STOP direct en meld het.**',
    v_base_order + 5
  );

  -- Sectie 5: Wat doe je als het gebeurt?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🚨 NOODPROCEDURE: Fakkelbrand',
    E'1.  **BLIJF KALM.** Paniek leidt tot fouten.\n2.  **SLUIT HET VENTIEL**, maar **ALLEEN** als je dit veilig kunt doen zonder jezelf te verbranden (gebruik hittebestendige handschoenen als beschikbaar).\n3.  **GA WEG** bij de cilinder als de vlam niet stopt of het ventiel niet bereikbaar is.\n4.  **WAARSCHUW** je collega''s direct (roep luid "BRAND" en gebruik de noodknop/afsluiter van de vulstand).\n5.  **BEL** de Bedrijfshulpverlening of 112 volgens de interne procedure.\n6.  **BLUS VEILIG:** Gebruik **NOOIT WATER** op een gasbrand onder druk. Gebruik een poederblusser of CO2-blusser om de omgeving te koelen of de vlam te doven (als de gastoevoer dicht is).',
    v_base_order + 6
  );

  -- Sectie 6: Hoe voorkom je het?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Preventie Checklist (Elke dag!)',
    '[
      {"text": "Ik controleer slangen en aansluitingen visueel vóór gebruik."},
      {"text": "Ik zorg dat mijn handen en gereedschap VETVRIJ zijn bij zuurstof."},
      {"text": "Ik open ventielen altijd RUSTIG en gecontroleerd."},
      {"text": "Ik check of de O-ring/pakking aanwezig en onbeschadigd is."},
      {"text": "Ik controleer of de cilinder overeenkomt met de vulramp (juiste gas)."},
      {"text": "Ik meld beschadigde cilinders of koppelingen DIRECT en gebruik ze niet."},
      {"text": "Ik houd mijn werkplek schoon en vrij van oliepoetsdoeken of vuil."}
    ]',
    v_base_order + 7
  );

  -- Sectie 7: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis',
    '[
      {
        "question": "Wat is de belangrijkste oorzaak van fakkelbranden bij zuurstofcilinders?",
        "options": ["Te koud weer", "Vet of olie bij het ventiel", "Een volle cilinder", "Te langzaam vullen"],
        "correct": 1
      },
      {
        "question": "Wat doe je als EERSTE bij een fakkelbrand?",
        "options": ["Water erop gooien", "Wegrennen zonder te waarschuwen", "Ventiel dichtdraaien (als dat veilig kan)", "Gewoon doorwerken"],
        "correct": 2
      },
      {
        "question": "Hoe open je een cilinderventiel veilig?",
        "options": ["Zo snel mogelijk met een ruk", "Langzaam en gecontroleerd", "Met een hamer", "Maakt niet uit"],
        "correct": 1
      },
      {
        "question": "Welk blusmiddel gebruik je NIET bij een gasbrand?",
        "options": ["CO2-blusser", "Poederblusser", "Water", "Blusdeken"],
        "correct": 2
      },
      {
        "question": "Wanneer meld je een beschadigde cilinder?",
        "options": ["Aan het einde van de week", "Pas als het misgaat", "Direct, voordat je ermee werkt", "Alleen als de baas kijkt"],
        "correct": 2
      }
    ]',
    v_base_order + 8
  );

  -- Sectie 8: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Tot slot',
    E'**Veiligheid begint bij jou.**\n\nAls iets niet klopt, stop dan direct en meld het. Dat is geen teken van zwakte of onkunde, maar juist van professionaliteit en vakmanschap. Samen zorgen we ervoor dat iedereen aan het eind van de dag weer veilig naar huis gaat.\n\nHeb je nog vragen over deze toolbox of twijfel je over een situatie op de werkvloer? Stap dan naar je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 9
  );

END $$;
